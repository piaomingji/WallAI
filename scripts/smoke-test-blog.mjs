// ブログ自動生成スクリプトが「壊れていないか」を、APIもお金も使わずに確かめる。
//
// なぜこれがあるか（2026-08-22）:
//   コミットの巻き戻しで withRetry の定義だけが消え、呼び出しだけが残った。
//   構文としては正しいので気づけず、3アプリとも毎朝の自動生成が
//   ReferenceError: withRetry is not defined で丸1日ぶん落ちていた。
//   同じことが二度と起きないよう、push のたびにこの検査を走らせる。
//
// 2種類の検査をする:
//   1. 静的検査 — 呼んでいるのに定義が無い関数を探す（実行されない分岐も見つかる）
//   2. 実行検査 — @google/genai を偽物に差し替え、一時フォルダで最後まで実際に走らせる
//
// 使い方: node scripts/smoke-test-blog.mjs

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const TARGETS = ['scripts/generate-blog-post.mjs', 'scripts/regenerate-eyecatch.mjs'];

let failures = 0;
const fail = (msg) => { console.error(`  NG: ${msg}`); failures++; };
const pass = (msg) => console.log(`  OK: ${msg}`);

// ---------------------------------------------------------------- 静的検査

// JavaScript/Node が最初から持っているもの。ここに無い名前を呼んでいたら定義が必要。
const BUILTINS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'await', 'function',
  'new', 'do', 'else', 'yield', 'void', 'delete', 'in', 'of', 'instanceof',
  'console', 'JSON', 'Math', 'Number', 'String', 'Boolean', 'Array', 'Object',
  'Promise', 'Buffer', 'Error', 'TypeError', 'RangeError', 'RegExp', 'Date', 'Set', 'Map',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'require', 'import', 'fetch',
  'structuredClone', 'encodeURIComponent', 'decodeURIComponent', 'process'
]);

function definedNames(src) {
  const names = new Set();
  const add = (re, group = 1) => {
    for (const m of src.matchAll(re)) names.add(m[group]);
  };
  add(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g);
  add(/(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g);
  add(/(?:^|\n)\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g);
  // import { A, B as C } from '...' / import D from '...'
  for (const m of src.matchAll(/import\s+([^;]+?)\s+from\s+/g)) {
    for (const piece of m[1].replace(/[{}]/g, ' ').split(',')) {
      const name = piece.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  // 関数の引数とアロー関数の引数
  for (const m of src.matchAll(/(?:function\s*[\w$]*\s*|\)\s*=>|=>)?\(([^()]*)\)\s*(?:=>|\{)/g)) {
    for (const piece of m[1].split(',')) {
      const name = piece.trim().replace(/[={].*$/, '').replace(/^\.\.\./, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  for (const m of src.matchAll(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) names.add(m[1]);
  for (const m of src.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s*\[?([^\]);]*)/g)) {
    for (const piece of m[1].split(',')) {
      const name = piece.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  return names;
}

// 文字列・テンプレート文字列・コメントを消す（この中の () は呼び出しではない）
function stripLiterals(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\.|\$\{[^{}]*\}|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function staticCheck(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf-8');
  const defined = definedNames(src);
  const code = stripLiterals(src);
  const missing = new Set();
  for (const m of code.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[2];
    if (BUILTINS.has(name) || defined.has(name)) continue;
    missing.add(name);
  }
  if (missing.size > 0) {
    fail(`${file}: 呼んでいるのに定義が見つからない関数があります -> ${[...missing].join(', ')}`);
    console.error('      （コミットの巻き戻しで定義だけ消えていないか確認してください）');
  } else {
    pass(`${file}: 未定義の関数呼び出しはありません`);
  }
}

// ---------------------------------------------------------------- 実行検査

const STUB = `const FAIL_ONCE = process.env.STUB_FAIL_ONCE === '1';
let failed = false;
const bigImage = Buffer.alloc(60000, 7).toString('base64');
export class GoogleGenAI {
  constructor() {
    this.models = {
      generateContent: async (opts) => {
        if (FAIL_ONCE && !failed) {
          failed = true;
          const e = new Error('This model is currently experiencing high demand.');
          e.status = 503;
          throw e;
        }
        if ((opts?.config?.responseModalities || []).includes('IMAGE')) {
          return { candidates: [{ content: { parts: [{ inlineData: { data: bigImage } }] } }] };
        }
        const schema = opts?.config?.responseSchema;
        if (schema) {
          const props = schema.properties || {};
          const out = {};
          for (const k of Object.keys(props)) {
            out[k] = props[k].type === 'array' ? ['smoke'] : \`smoke-\${k}\`;
          }
          return { text: JSON.stringify(out) };
        }
        return { text: 'A stubbed English image prompt used only by the smoke test.' };
      }
    };
  }
}
`;

function buildSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-smoke-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'public/blog'), { recursive: true });
  const stubDir = path.join(dir, 'node_modules/@google/genai');
  fs.mkdirSync(stubDir, { recursive: true });
  fs.writeFileSync(path.join(stubDir, 'package.json'),
    JSON.stringify({ name: '@google/genai', version: '0.0.0-smoke', type: 'module', main: 'index.mjs' }));
  fs.writeFileSync(path.join(stubDir, 'index.mjs'), STUB);
  for (const file of TARGETS) {
    fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));
  }
  fs.copyFileSync(path.join(ROOT, 'lib/blog.ts'), path.join(dir, 'lib/blog.ts'));
  return dir;
}

function run(dir, label, script, args, env, expect) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: dir,
    encoding: 'utf-8',
    env: { ...process.env, GEMINI_API_KEY: 'smoke-test-dummy-key', ...env },
    timeout: 5 * 60 * 1000
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0) {
    fail(`${label}: 異常終了しました`);
    console.error(output.split('\n').slice(-15).map((l) => `      ${l}`).join('\n'));
    return;
  }
  for (const needle of expect) {
    if (!output.includes(needle)) {
      fail(`${label}: 期待した出力「${needle}」がありません`);
      console.error(output.split('\n').slice(-15).map((l) => `      ${l}`).join('\n'));
      return;
    }
  }
  pass(label);
}

// ---------------------------------------------------------------- 実行

console.log('ブログ自動生成スクリプトの検査を開始します（APIは呼びません）\n');

console.log('[1/2] 静的検査');
for (const file of TARGETS) staticCheck(file);

console.log('\n[2/2] 実行検査（偽の@google/genaiで最後まで走らせます）');
const sandbox = buildSandbox();
try {
  run(sandbox, '記事の自動生成が最後まで通る', 'scripts/generate-blog-post.mjs', [], {},
    ['Successfully added new article']);

  fs.copyFileSync(path.join(ROOT, 'lib/blog.ts'), path.join(sandbox, 'lib/blog.ts'));
  run(sandbox, 'アイキャッチの作り直しが最後まで通る', 'scripts/regenerate-eyecatch.mjs',
    ['--force', '--limit', '1'], {}, ['成功 1 件 / 失敗 0 件']);

  if (process.env.SMOKE_SKIP_RETRY !== '1') {
    fs.copyFileSync(path.join(ROOT, 'lib/blog.ts'), path.join(sandbox, 'lib/blog.ts'));
    run(sandbox, '503が返っても再試行して続行する', 'scripts/generate-blog-post.mjs', [],
      { STUB_FAIL_ONCE: '1' }, ['秒待ってから再試行します', 'Successfully added new article']);
  }
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}

console.log('');
if (failures > 0) {
  console.error(`検査に失敗しました（${failures} 件）。このままでは毎朝の自動生成が落ちます。`);
  process.exit(1);
}
console.log('すべての検査に合格しました。自動生成は動く状態です。');
