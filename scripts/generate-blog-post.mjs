import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// ローカル開発環境での動作確認のために .env.local をロード
try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of envLines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        // クォーテーションのトリミング
        if (val.length > 0 && val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
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

// SEOキーワードとテーマ候補 (WallAI用 - 外壁塗装・外装)
const topics = [
  {
    keyword: '外壁塗装 色選び ベージュ グレー',
    titleHint: 'ベージュやグレーの外壁塗装で失敗しない！おしゃれに仕上げる配色テクニック',
    defaultEyecatch: '/blog/beige-gray-guide.png'
  },
  {
    keyword: '外壁 遮熱塗料 効果 寿命',
    titleHint: '遮熱塗料は本当に効果がある？節電メリットと寿命・費用相場を徹底解説',
    defaultEyecatch: '/blog/heat-shielding-paint-guide.png'
  },
  {
    keyword: '外壁塗装 ツートンカラー 組み合わせ',
    titleHint: '【実例あり】外壁塗装をツートンカラーでおしゃれにする黄金比率とおすすめの組み合わせ',
    defaultEyecatch: '/blog/two-tone-guide.png'
  },
  {
    keyword: '外壁塗装 費用相場 坪数別',
    titleHint: '外壁塗装の適正価格は？30坪・40坪の費用相場と悪徳業者を見分ける見積りのチェックポイント',
    defaultEyecatch: '/blog/estimation-guide.png'
  },
  {
    keyword: '外装サイディング メンテナンス 時期',
    titleHint: 'サイディング外壁の寿命は何年？塗り替えや張り替えのサインと後悔しないメンテナンス計画',
    defaultEyecatch: '/blog/wall-color-guide.png'
  }
];

const responseSchema = {
  type: 'object',
  properties: {
    slug: { type: 'string' },
    title: { type: 'string' },
    excerpt: { type: 'string' },
    keywords: {
      type: 'array',
      items: { type: 'string' }
    },
    contentHtml: { type: 'string' }
  },
  required: ['slug', 'title', 'excerpt', 'keywords', 'contentHtml']
};

// Gemini API は混雑時に 503 / 429 / 500 を返すことがある。
// （2026-08-21、Studio AI の自動生成が「This model is currently experiencing high demand」で
//   1回で諦めて失敗した。記事本文を書くステップには再試行が無かった。）
// 一時的な失敗なら待って自動で試し直す。指定回数を使い切ったときだけ例外にする。
const API_RETRIES = 4;
const RETRYABLE_HTTP = [408, 429, 500, 502, 503, 504];

function isRetryableApiError(error) {
  const status = Number(error?.status ?? error?.code ?? error?.response?.status);
  if (RETRYABLE_HTTP.includes(status)) return true;
  const text = `${error?.message ?? ''} ${error?.status ?? ''}`;
  return /UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|DEADLINE_EXCEEDED|high demand|overloaded|rate limit|try again|ECONNRESET|ETIMEDOUT|fetch failed/i.test(text);
}

// label は失敗時のログに出す作業名
async function withRetry(label, fn) {
  let lastError;
  for (let attempt = 1; attempt <= API_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableApiError(error) || attempt === API_RETRIES) throw error;
      const waitMs = Math.min(60000, 15000 * attempt);
      console.log(`  ${label}: 一時的なエラー (${attempt}/${API_RETRIES}) ${String(error?.message ?? error).slice(0, 200)}`);
      console.log(`  ${Math.round(waitMs / 1000)}秒待ってから再試行します...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

// 既存の記事と重複しない新しいトピックをGeminiで自動生成する関数
async function generateUniqueTopic(existingTitles, existingKeywords) {
  const prompt = `
あなたは住宅リフォームおよび外壁塗装の専門家であり、SEOコンサルタントです。
現在、ブログには以下のタイトルおよびテーマの記事がすでに存在します：
${existingTitles.map(t => `- ${t}`).join('\n')}

これらと内容が重複（ダブり）せず、かつ「外壁塗装」「屋根塗装」「住宅外装リフォーム」に関連する、ユーザーの検索意図に沿った新しいターゲットSEOキーワードと記事タイトル案を1つ作成してください。
特に、以下の既存テーマとは絶対に重複しないようにしてください：
- ベージュとグレーの外壁塗装・色選び
- 遮熱塗料の効果、メリット、寿命
- ツートンカラーの組み合わせや黄金比率
- 外壁塗装の費用相場や見積もりのチェック方法
- 外壁サイディングの寿命やメンテナンス時期

魅力的な切り口（例：外壁塗装をするのに最適な季節・月、DIYでの補修限界、近隣への挨拶マナー、雨漏り対策、塗料メーカーごとの比較など）を検討してください。

以下のJSONフォーマットに厳密に従って返却してください：
{
  "keyword": "ターゲットとなるSEOキーワード（日本語、スペース区切りで複数可）",
  "titleHint": "記事のタイトル案（日本語、魅力的でクリックしたくなるもの）"
}
`;

  console.log('Generating a completely new, unique topic using Gemini...');
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, vertexai: false });
  const response = await withRetry('テーマの生成', () =>
    ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          titleHint: { type: 'string' }
        },
        required: ['keyword', 'titleHint']
      }
    }
  })
  );

  const generated = JSON.parse(response.text);
  console.log(`Generated Dynamic Topic: [Keyword: ${generated.keyword}] [TitleHint: ${generated.titleHint}]`);
  return generated;
}

async function generateArticle(selectedTopic) {
  const currentYear = new Date().getFullYear();
  const prompt = `
あなたのメインテーマは外壁塗装と住宅リフォームです。
ターゲットキーワード: "${selectedTopic.keyword}" を含み、以下のヒントに沿った高品質なSEO集集ブログ記事を生成してください。
タイトルヒント: "${selectedTopic.titleHint}"

【満たすべき条件】
1. 読者の悩みや疑問を解決する信頼性の高い情報を含め、自然な日本語で執筆してください。タイトルや本文中、要約（excerpt）などで「最新」や年号に言及する場合は、必ず現在の年である「${currentYear}年」を使用し、過去の年（2024年や2025年など）を使用しないでください（例：【${currentYear}年最新】）。
2. 見出し（h2, h3）、太字（<strong>）、順不同リスト（<ul> <li>）などを使って綺麗にマークアップされたHTML本文（contentHtml）にしてください。
3. 記事内の後半に、当サービス（WallAI）のAI外壁カラーシミュレーションを紹介し、以下のCTAリンクを「必ず」中央寄せで設置してください（HTMLタグに含めてください）：
   <p class="text-center my-8">
     <a href="/?contact=false" class="inline-flex items-center justify-center rounded-full bg-clay px-8 py-4 text-sm font-bold text-paper hover:bg-ink transition-all hover:scale-105 shadow-lg gap-2">
       🎨 我が家で無料シミュレーションを試す
     </a>
   </p>
4. JSON構造に厳密に従ってください。HTML本文内ではダブルクォーテーションを適切にエスケープするか、シングルクォーテーションを使用してください。
`;

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, vertexai: false });
  const response = await withRetry('記事本文の生成', () =>
    ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
    }
  })
  );

  const textContent = response.text;
  if (!textContent) {
    throw new Error('Empty response from Gemini API');
  }
  return JSON.parse(textContent);
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
      if (attempt < ATTEMPTS_PER_MODEL) await sleep(20000);
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

  const promptResponse = await withRetry('画像プロンプトの生成', () =>
    ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: promptForImagePrompt
  })
  );

  const imagePrompt = promptResponse.text.trim();
  console.log(`Generated Image Prompt: ${imagePrompt}`);

  const finalPrompt = `${imagePrompt}

Photorealistic architectural exterior photography of a Japanese detached house, 16:9 horizontal composition, bright natural daylight, high dynamic range, tack-sharp focus, accurate straight architectural lines. This is an outdoor exterior photograph, never an interior. Absolutely no text, letters, characters, signage, logos or watermarks anywhere in the image.`;

  return renderImageWithFallback(ai, finalPrompt);
}

async function main() {
  try {
    // lib/blog.ts から既存のブログ記事の情報を読み込む
    const filePath = path.join(process.cwd(), 'lib/blog.ts');
    let fileContent = fs.readFileSync(filePath, 'utf-8');

    // 既存の記事タイトル、キーワード、スラッグ、アイキャッチを正規表現で抽出
    const existingTitles = [...fileContent.matchAll(/"title":\s*"([^"]+)"/g)].map(m => m[1]);
    const existingKeywords = [...fileContent.matchAll(/"keywords":\s*\[([\s\S]*?)\]/g)].flatMap(m => {
      return m[1].split(',').map(k => k.trim().replace(/"/g, ''));
    });
    const existingSlugs = [...fileContent.matchAll(/"slug":\s*"([^"]+)"/g)].map(m => m[1]);
    const existingEyecatches = [...fileContent.matchAll(/"eyecatch":\s*"([^"]+)"/g)].map(m => m[1]);

    console.log(`Loaded ${existingSlugs.length} existing articles from lib/blog.ts.`);

    // プリセットトピックからまだ使われていないものを抽出
    const unusedTopics = topics.filter(topic => {
      // タイトルまたは主要な類似表現が既に存在するかチェック
      const isTitleExists = existingTitles.some(title => title.includes(topic.titleHint.slice(0, 8)));
      return !isTitleExists;
    });

    let selectedTopic;
    if (unusedTopics.length > 0) {
      // 未使用のプリセットがあれば、そこからランダムに選択
      selectedTopic = unusedTopics[Math.floor(Math.random() * unusedTopics.length)];
      console.log(`Selected unused preset topic: [Keyword: ${selectedTopic.keyword}]`);
    } else {
      // すべてのプリセットが使用済みの場合は、Geminiで新しいユニークなテーマを生成
      selectedTopic = await generateUniqueTopic(existingTitles, existingKeywords);
    }

    console.log('Generating AI Blog post...');
    const article = await generateArticle(selectedTopic);

    // 既存のスラッグと重複した場合の回避措置
    if (existingSlugs.includes(article.slug)) {
      article.slug = `${article.slug}-${Date.now().toString().slice(-4)}`;
    }
    
    // 画像の生成とローカル保存（生成できなかった場合は例外を投げ、記事を追加せず終了する）
    console.log('Generating matching eyecatch image...');
    const imageBuffer = await generateImage(article.title, article.excerpt, selectedTopic.defaultEyecatch, article.keywords, existingEyecatches, article.slug);
    
    const blogDir = path.join(process.cwd(), 'public/blog');
    if (!fs.existsSync(blogDir)) {
      fs.mkdirSync(blogDir, { recursive: true });
    }

    const imageFilename = `${article.slug}.jpg`;
    const imagePath = path.join(blogDir, imageFilename);
    fs.writeFileSync(imagePath, imageBuffer);
    console.log(`Saved eyecatch image to ${imagePath}`);
    article.eyecatch = `/blog/${imageFilename}`;
    
    // 本日の日付
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    article.date = today;

    console.log(`Generated article title: ${article.title}`);

    // blogPosts 配列の定義部分を見つける
    const arrayStartMatch = fileContent.match(/export const blogPosts: BlogPost\[\] = \[\s*/);
    
    if (!arrayStartMatch) {
      throw new Error('Could not find blogPosts array in lib/blog.ts');
    }

    const insertIndex = arrayStartMatch.index + arrayStartMatch[0].length;
    
    // 挿入するJSONオブジェクトの生成
    const jsonString = JSON.stringify(article, null, 2);
    
    // 新しい記事を配列の先頭に追加
    const newContent = fileContent.slice(0, insertIndex) + jsonString + ',\n  ' + fileContent.slice(insertIndex);
    
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log('Successfully added new article to lib/blog.ts');
  } catch (error) {
    console.error('Failed to run blog generation:', error);
    process.exit(1);
  }
}

main();
