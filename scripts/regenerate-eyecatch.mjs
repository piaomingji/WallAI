// ========================================================================
// 既存記事のアイキャッチ画像を作り直す一回限りのメンテナンス用スクリプト
//
// 2026-08-17 に Google が Imagen 系のAPIを提供終了したため、それ以前から
// 画像生成は断続的に失敗しており、記事と無関係な Unsplash 画像や
// 低解像度の代替画像（1024x576 など）が公開されたままになっている。
// このスクリプトは、そうした画像だけを洗い出して新モデルで作り直し、
// public/blog 配下のローカル画像に統一する。
//
// 使い方（アプリのフォルダ直下で実行）:
//   node scripts/regenerate-eyecatch.mjs --dry-run     … 対象一覧を表示するだけ
//   node scripts/regenerate-eyecatch.mjs --limit 3     … 先頭3件だけ作り直す
//   node scripts/regenerate-eyecatch.mjs               … 対象をすべて作り直す
//   node scripts/regenerate-eyecatch.mjs --compress-only … 既存画像の圧縮だけ行う（無料）
// ========================================================================
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// ローカル開発環境での動作確認のために .env.local をロード
try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = match[2] || '';
        if (val.length > 1 && val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[match[1]] = val;
      }
    }
  }
} catch (e) {
  console.log('Skipped loading .env.local:', e.message);
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable is not set.');
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const COMPRESS_ONLY = args.includes('--compress-only');
const limitIndex = args.indexOf('--limit');
const LIMIT = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : Infinity;

// 「作り直しが必要」と判断する基準: 生成に成功した画像は幅1376px以上になる
const MIN_GOOD_WIDTH = 1376;

// JPEGのヘッダから画像サイズを読み取る
function jpegSize(file) {
  const data = fs.readFileSync(file);
  let i = 2;
  while (i < data.length) {
    if (data[i] !== 0xff) { i += 1; continue; }
    const marker = data[i + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: data.readUInt16BE(i + 7), height: data.readUInt16BE(i + 5) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    i += 2 + data.readUInt16BE(i + 2);
  }
  return null;
}

// ===================== アイキャッチ画像の生成 =====================
// 2026-08 変更点:
//   旧 imagen-3.0-generate-002 は Google 側で提供終了（後継の imagen-4.0 系も
//   2026-08-17 に提供終了）。そのため毎日の生成が失敗し、記事と無関係な
//   Unsplash 画像や低解像度の代替画像が公開されていた。
//   → Nano Banana 系（gemini-3-pro-image / gemini-3.1-flash-image）に移行し、
//     低品質なフォールバックは全廃した。画像が作れなければ記事も追加しない。
const IMAGE_MODELS = ['gemini-3-pro-image', 'gemini-3.1-flash-image'];
const ATTEMPTS_PER_MODEL = 2;
const MIN_IMAGE_BYTES = 30000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// generateContent 形式のレスポンスから画像バイト列を取り出す
function pickInlineImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const data = part?.inlineData?.data ?? part?.inline_data?.data;
    if (data) return Buffer.from(data, 'base64');
  }
  return null;
}

// interactions 形式のレスポンスから画像バイト列を取り出す
function pickInteractionImage(interaction) {
  const direct = interaction?.output_image?.data ?? interaction?.outputImage?.data;
  if (direct) return Buffer.from(direct, 'base64');
  for (const step of interaction?.steps ?? []) {
    for (const block of step?.content ?? []) {
      const isImage = block?.type === 'image' ||
        (typeof block?.mime_type === 'string' && block.mime_type.startsWith('image/'));
      if (isImage && block?.data) return Buffer.from(block.data, 'base64');
    }
  }
  return null;
}

// 1モデルで1回だけ画像生成を試みる（新旧2つのAPI形式に対応）
async function renderImage(ai, model, prompt) {
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '16:9', imageSize: '2K' }
      }
    });
    const buffer = pickInlineImage(response);
    if (buffer && buffer.length > MIN_IMAGE_BYTES) return buffer;
    console.log(`  [${model}] generateContent: 画像が返りませんでした`);
  } catch (error) {
    console.log(`  [${model}] generateContent 失敗: ${error.message}`);
  }

  if (typeof ai.interactions?.create === 'function') {
    try {
      const interaction = await ai.interactions.create({
        model,
        input: prompt,
        response_format: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: '16:9',
          image_size: '2K'
        }
      });
      const buffer = pickInteractionImage(interaction);
      if (buffer && buffer.length > MIN_IMAGE_BYTES) return buffer;
      console.log(`  [${model}] interactions: 画像が返りませんでした`);
    } catch (error) {
      console.log(`  [${model}] interactions 失敗: ${error.message}`);
    }
  }

  return null;
}

// ブログ表示用の画像圧縮
// 生成直後の画像は 2752x1536・3MB 前後あり、ブログの読み込みが重くなる。
// 幅1600pxまで縮小し、品質82のJPEGに変換して 300KB 前後まで落とす（見た目はほぼ変わらない）。
// sharp が入っていない環境では圧縮せずそのまま保存する（生成自体は止めない）。
const MAX_IMAGE_WIDTH = 1600;
const JPEG_QUALITY = 82;

async function compressJpeg(buffer) {
  try {
    const sharp = (await import('sharp')).default;
    const output = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
      .toBuffer();
    if (output.length > 0 && output.length < buffer.length) {
      console.log(`  圧縮: ${Math.round(buffer.length / 1024)}KB -> ${Math.round(output.length / 1024)}KB`);
      return output;
    }
    return buffer;
  } catch (error) {
    console.log(`  警告: 画像を圧縮できませんでした（npm install sharp が必要です）: ${error.message}`);
    return buffer;
  }
}

// pro → flash の順に、各モデル2回ずつ試す。すべて駄目なら例外を投げる（＝記事を追加しない）
async function renderImageWithFallback(ai, prompt) {
  for (const model of IMAGE_MODELS) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      console.log(`画像生成を試行中: ${model} (${attempt}/${ATTEMPTS_PER_MODEL})`);
      const buffer = await renderImage(ai, model, prompt);
      if (buffer) {
        console.log(`画像生成に成功しました: ${model} (${Math.round(buffer.length / 1024)}KB)`);
        return compressJpeg(buffer);
      }
      if (attempt < ATTEMPTS_PER_MODEL) await sleep(4000);
    }
  }
  throw new Error(
    'アイキャッチ画像を生成できませんでした。品質の低い代替画像は使用しない方針のため、今回の記事は追加しません。'
  );
}

// 記事の内容に沿ったアイキャッチ画像を生成する（必ず Buffer を返す。作れなければ例外）
async function generateImage(title, excerpt, defaultEyecatch, keywords, existingEyecatches, slug) {
  console.log(`Generating matching eyecatch image for slug: ${slug}`);
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, vertexai: false });

  const promptForImagePrompt = `
You are an expert prompt engineer for Google's Gemini image model (Nano Banana).
Write ONE detailed English prompt for a 16:9 blog cover photograph that matches this Japanese article about EXTERIOR house painting and exterior renovation (外壁塗装・屋根塗装・住宅外装).

Article Title: ${title}
Article Excerpt: ${excerpt}
Keywords: ${(keywords || []).join(', ')}

RULES
1. THIS IS AN EXTERIOR TOPIC. The photograph must show the OUTSIDE of a Japanese detached house (外観). NEVER describe an interior room, living room, furniture, or indoor lighting.
2. THE SUBJECT MUST MATCH THE ARTICLE. Read the title carefully:
   - ベージュ / グレー / 色選び -> a modern house whose walls clearly show those colours
   - ツートン -> a house with an obvious two-tone wall colour split
   - 遮熱塗料 -> a sunlit house exterior under a strong bright sky
   - シーリング / コーキング -> a close view of the joint lines between siding boards
   - サイディング -> a house with clean, sharply detailed siding texture
   - モルタル -> a house with mortar/stucco wall texture
   - 雨樋 -> a composition where the rain gutter along the eaves is clearly visible
   - ALC -> a house with the characteristic panel joints of ALC board walls
   - カビ / 苔 / 汚れ / 劣化 -> the affected wall surface as the focus, shown honestly but photographed beautifully
   - 屋根 -> a composition that clearly shows the roof
   - 費用 / 業者選び / 補助金 -> a handsome, well-maintained modern Japanese house exterior that conveys value
   - 季節 / 時期 -> the exterior with a clear seasonal sky and seasonal trees
3. Describe a photorealistic architectural exterior photograph taken in Japan. Demand: straight vertical walls, correct perspective, tack-sharp focus, physically plausible construction, no warped or melted shapes, no duplicated windows, no impossible geometry.
4. Bright natural daylight or warm late-afternoon sun, clean street or tidy front garden, subtle greenery, the quality level of an architectural magazine feature.
5. The image must contain NO text, NO Japanese characters, NO letters, NO signage, NO logos, NO watermarks, NO UI elements, NO borders, and NO people.
6. Output ONLY the prompt text, with no preamble or closing remarks.
`;

  const promptResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: promptForImagePrompt
  });

  const imagePrompt = promptResponse.text.trim();
  console.log(`Generated Image Prompt: ${imagePrompt}`);

  const finalPrompt = `${imagePrompt}

Photorealistic architectural exterior photography of a Japanese detached house, 16:9 horizontal composition, bright natural daylight, high dynamic range, tack-sharp focus, accurate straight architectural lines. This is an outdoor exterior photograph, never an interior. Absolutely no text, letters, characters, signage, logos or watermarks anywhere in the image.`;

  return renderImageWithFallback(ai, finalPrompt);
}


// 記事1件ぶんのアイキャッチを生成する
async function generateEyecatch(ai, post) {
  return generateImage(post.title, post.excerpt, null, post.keywords, [], post.slug);
}


// lib/blog.ts から記事一覧を取り出す
function loadPosts(fileContent) {
  const posts = [];
  const slugRe = /"slug":\s*"([^"]+)"/g;
  const positions = [];
  let m;
  while ((m = slugRe.exec(fileContent)) !== null) positions.push({ slug: m[1], start: m.index });
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].start;
    const end = i + 1 < positions.length ? positions[i + 1].start : fileContent.length;
    const block = fileContent.slice(start, end);
    const pick = (key) => (block.match(new RegExp(`"${key}":\\s*"((?:[^"\\\\]|\\\\.)*)"`)) || [])[1];
    const keywordsRaw = (block.match(/"keywords":\s*\[([\s\S]*?)\]/) || [])[1] || '';
    posts.push({
      slug: positions[i].slug,
      title: JSON.parse(`"${pick('title') ?? ''}"`),
      excerpt: JSON.parse(`"${pick('excerpt') ?? ''}"`),
      eyecatch: pick('eyecatch') ?? '',
      date: pick('date') ?? '',
      keywords: [...keywordsRaw.matchAll(/"([^"]*)"/g)].map((k) => k[1]),
      start,
      end
    });
  }
  return posts;
}

// 作り直しが必要かどうかを判定する
function inspect(post) {
  if (!post.eyecatch) return { needs: true, reason: '画像が未設定' };
  if (/^https?:\/\//.test(post.eyecatch)) return { needs: true, reason: '外部URL（リンク切れの恐れ）' };
  const file = path.join(process.cwd(), 'public', post.eyecatch.replace(/^\//, ''));
  if (!fs.existsSync(file)) return { needs: true, reason: 'ファイルが存在しない' };
  if (!file.endsWith('.jpg') && !file.endsWith('.jpeg')) {
    return { needs: true, reason: '手動で用意した固定画像（png）' };
  }
  let size = null;
  try { size = jpegSize(file); } catch (e) { /* 読めなければ作り直す */ }
  if (!size) return { needs: true, reason: '画像を読み取れない' };
  if (size.width < MIN_GOOD_WIDTH) {
    return { needs: true, reason: `低解像度 ${size.width}x${size.height}（代替画像）` };
  }
  return { needs: false, reason: `OK ${size.width}x${size.height}` };
}

// 既存の画像で大きすぎるものを圧縮し直す（APIを使わないので無料）
const COMPRESS_THRESHOLD_BYTES = 600 * 1024;

async function compressExistingImages() {
  const blogDir = path.join(process.cwd(), 'public/blog');
  if (!fs.existsSync(blogDir)) return;

  const heavy = fs.readdirSync(blogDir)
    .filter((name) => /\.(jpg|jpeg)$/i.test(name))
    .filter((name) => fs.statSync(path.join(blogDir, name)).size > COMPRESS_THRESHOLD_BYTES);

  if (heavy.length === 0) {
    console.log('圧縮が必要な既存画像はありませんでした。\n');
    return;
  }

  console.log(`既存画像の圧縮: ${heavy.length} 件が ${Math.round(COMPRESS_THRESHOLD_BYTES / 1024)}KB を超えています`);
  let before = 0;
  let after = 0;
  for (const name of heavy) {
    const file = path.join(blogDir, name);
    const original = fs.readFileSync(file);
    const output = await compressJpeg(original);
    if (output.length < original.length) {
      fs.writeFileSync(file, output);
      before += original.length;
      after += output.length;
    }
  }
  console.log(`既存画像の圧縮が完了: ${Math.round(before / 1024 / 1024 * 10) / 10}MB -> ${Math.round(after / 1024 / 1024 * 10) / 10}MB\n`);
}

async function main() {
  // まず既存画像の圧縮（APIを使わない・無料）
  await compressExistingImages();
  if (COMPRESS_ONLY) {
    console.log('--compress-only のため、ここで終了します。');
    return;
  }

  const filePath = path.join(process.cwd(), 'lib/blog.ts');
  let fileContent = fs.readFileSync(filePath, 'utf-8');
  const posts = loadPosts(fileContent);

  const targets = [];
  console.log(`記事数: ${posts.length}\n`);
  for (const post of posts) {
    const result = inspect(post);
    console.log(`${result.needs ? '要作り直し' : '  そのまま'} | ${post.date} | ${result.reason} | ${post.title.slice(0, 40)}`);
    if (result.needs) targets.push(post);
  }

  console.log(`\n作り直し対象: ${targets.length} 件 / 全 ${posts.length} 件`);
  if (DRY_RUN) {
    console.log('--dry-run のため、ここで終了します。');
    return;
  }

  const queue = targets.slice(0, LIMIT);
  console.log(`今回処理するのは ${queue.length} 件です。\n`);

  const blogDir = path.join(process.cwd(), 'public/blog');
  if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, vertexai: false });
  const succeeded = [];
  const failed = [];

  for (const [index, post] of queue.entries()) {
    console.log(`\n[${index + 1}/${queue.length}] ${post.title.slice(0, 40)}`);
    try {
      const buffer = await generateEyecatch(ai, post);
      const filename = `${post.slug}.jpg`;
      fs.writeFileSync(path.join(blogDir, filename), buffer);
      succeeded.push({ post, eyecatch: `/blog/${filename}` });
      console.log(`  保存しました: public/blog/${filename}`);
    } catch (error) {
      console.log(`  失敗しました（この記事の画像は据え置き）: ${error.message}`);
      failed.push(post);
    }
  }

  // lib/blog.ts の eyecatch を更新する（後ろの記事から順に置換して位置ずれを防ぐ）
  const updates = succeeded
    .filter((s) => s.post.eyecatch !== s.eyecatch)
    .sort((a, b) => b.post.start - a.post.start);

  for (const { post, eyecatch } of updates) {
    const block = fileContent.slice(post.start, post.end);
    const replaced = block.replace(/("eyecatch":\s*")(?:[^"\\]|\\.)*(")/, `$1${eyecatch}$2`);
    fileContent = fileContent.slice(0, post.start) + replaced + fileContent.slice(post.end);
  }

  if (updates.length > 0) {
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    console.log(`\nlib/blog.ts の eyecatch を ${updates.length} 件更新しました。`);
  }

  console.log(`\n完了: 成功 ${succeeded.length} 件 / 失敗 ${failed.length} 件`);
  if (failed.length > 0) {
    console.log('失敗した記事:');
    for (const post of failed) console.log(`  - ${post.slug}`);
    console.log('もう一度同じコマンドを実行すると、失敗したぶんだけ再挑戦します。');
  }
}

main().catch((error) => {
  console.error('処理に失敗しました:', error);
  process.exit(1);
});
