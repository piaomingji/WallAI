import fs from 'fs';
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
  const response = await ai.models.generateContent({
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
  });

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
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
    }
  });

  const textContent = response.text;
  if (!textContent) {
    throw new Error('Empty response from Gemini API');
  }
  return JSON.parse(textContent);
}

// 記事の内容に沿ったアイキャッチ画像を生成する関数 (Imagen 3がエラーの場合はUnsplashのフリー画像をフォールバック)
async function generateImage(title, excerpt, defaultEyecatch, keywords, existingEyecatches, slug) {
  const promptForImagePrompt = `
You are an expert prompt engineer for AI image generators (Imagen 3).
Create a highly detailed, descriptive English prompt for generating a blog cover image that perfectly matches the following article:

Article Title: ${title}
Article Excerpt: ${excerpt}

Requirements for the generated prompt:
1. Describe a realistic, high-quality, professional photograph of a residential house exterior in Japan.
2. The image MUST visually represent the theme of the article. For example:
   - If the article is about "beige and gray", describe a modern house with beige and gray exterior walls.
   - If the article is about "twotone color", describe a house with a clear two-tone color combination (e.g., dark brown first floor, white second floor).
   - If the article is about "cost estimation" or "checking quotes", describe a beautiful modern house exterior showing high value and quality.
   - If the article is about "siding maintenance", describe a house with clean, high-quality siding textures.
   - If the article is about seasons/timing (e.g., spring/autumn), describe a house exterior with beautiful clear sky and seasonal trees (like cherry blossoms for spring or autumn leaves).
3. Specify realistic lighting (e.g., "warm afternoon sunlight", "bright daytime daylight") and setting (e.g., "clean street", "subtle green plants in the front garden").
4. Use architectural photography style keywords: "architectural photography, modern Japanese house design, high-end residential exterior, detailed texture, 8k resolution".
5. Do NOT include any text, overlays, UI elements, signs, or people in the image.
6. The prompt must be in English and output ONLY the prompt text, without any introductory or concluding remarks.
`;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, vertexai: false });
    const promptResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptForImagePrompt
    });

    const imagePrompt = promptResponse.text.trim();
    console.log(`Generated Image Prompt: ${imagePrompt}`);

    console.log('Attempting to generate image via gemini-3.1-flash-image...');
    // gemini-3.1-flash-image で画像を生成
    const imageResponse = await ai.interactions.create({
      model: 'gemini-3.1-flash-image',
      input: [
        { type: 'text', text: `${imagePrompt}, professional architecture photography, beautiful residential exterior house paint design, daytime daylight, highly detailed, blog header banner` }
      ],
      response_format: {
        type: 'image',
        aspect_ratio: '16:9',
        image_size: '2K'
      }
    });

    if (imageResponse.output_image && imageResponse.output_image.data) {
      const base64Image = imageResponse.output_image.data;
      return { type: 'buffer', data: Buffer.from(base64Image, 'base64') };
    }
    throw new Error('Image data not found in response');
  } catch (error) {
    console.log('Gemini Image generation failed or not supported. Falling back to specific image...', error.message);
    
    // プリセットのデフォルト画像が指定されており、まだ使われていない場合はそれを使用
    if (defaultEyecatch && !existingEyecatches.includes(defaultEyecatch)) {
      console.log(`Using default preset eyecatch: ${defaultEyecatch}`);
      return { type: 'url', data: defaultEyecatch };
    }
    
    // 静的なフォールバック画像リスト（他で使用済みのURLは排除する - 住宅の外装のみ）
    const photoIds = [
      'photo-1513584684374-8bab748fbf90', 'photo-1605276374104-dee2a0ed3cd6', 'photo-1580587771525-78b9dba3b914', 'photo-1512917774080-9991f1c4c750',
      'photo-1600585154340-be6161a56a0c', 'photo-1600596542815-ffad4c1539a9', 'photo-1512915922686-57c11dde9b6b', 'photo-1600585154526-990dced4db0d',
      'photo-1513694203232-719a280e022f', 'photo-1486406146926-c627a92ad1ab', 'photo-1542314831-068cd1dbfeeb', 'photo-1416331108676-a22ccb276e35',
      'photo-1507089947368-19c1da9775ae', 'photo-1523217582562-09d0def993a6', 'photo-1592595896551-12b371d546d5', 'photo-1582268611958-ebfd161ef9cf',
      'photo-1583608205776-bfd35f0d9f83', 'photo-1598257006458-087169a1f08d', 'photo-1602941525421-8f8b81d3edbb', 'photo-1505873242700-f289a29e1e0f',
      'photo-1505691938895-1758d7feb511', 'photo-1510798831971-661eb04b3739', 'photo-1513694203232-719a280e022f', 'photo-1549517045-bc93de006e53',
      'photo-1554995207-c18c203602cb', 'photo-1582063287911-c75c3f3f3f30', 'photo-1584622781564-1d987f733321', 'photo-1585412727339-54e4bae3bbf9',
      'photo-1599809275671-b59411bc4824', 'photo-1600047509807-ba8f99d2cdde', 'photo-1600585154363-67eb9e2e2099', 'photo-1600596542815-ffad4c1539a9',
      'photo-1600607687920-4e2a09cf159d', 'photo-1605117882932-f9e32b03fea9', 'photo-1613490493576-7fde63acd811', 'photo-1613977257363-707ba9348227',
      'photo-1615529182904-14819c35db37', 'photo-1618219908412-a29a1bb7b86e', 'photo-1618219944342-824e40a13285', 'photo-1618221195710-dd6b41faaea6',
      'photo-1628624747186-a941c476b7ef', 'photo-1628744504164-05177a80b8e8', 'photo-1502005229762-fc1b2b812ca5', 'photo-1512917774080-9991f1c4c750',
      'photo-1516450360452-9312f5e86fc7', 'photo-1528909514045-2fa4ac7a08ba', 'photo-1558036117-15d82a90b9b1', 'photo-1570129477492-45c003edd2be',
      'photo-1576941089067-2de3c901e126', 'photo-1580587771525-78b9dba3b914', 'photo-1591825729269-caeb344f6df2', 'photo-1592595896551-12b371d546d5',
      'photo-1592595896619-22497f511477', 'photo-1600047509807-ba8f99d2cdde', 'photo-1600585154340-be6161a56a0c', 'photo-1600585154526-990dced4db0d',
      'photo-1600596542815-ffad4c1539a9', 'photo-1600607687644-c7171b42498f', 'photo-1600607687939-ce8a6c25118c', 'photo-1602941525421-8f8b81d3edbb',
      'photo-1605276374104-dee2a0ed3cd6', 'photo-1613977257363-707ba9348227', 'photo-1615529182904-14819c35db37', 'photo-1618219908412-a29a1bb7b86e',
      'photo-1618219944342-824e40a13285', 'photo-1618220179428-22790b461013', 'photo-1618221195710-dd6b41faaea6', 'photo-1618221381711-42ca8ab6e908',
      'photo-1628624747186-a941c476b7ef', 'photo-1628744504164-05177a80b8e8', 'photo-1448630360428-65456885c650', 'photo-1464146072230-91cabc268266',
      'photo-1475855581690-80acf93304a3', 'photo-1484154218962-a197022b5858', 'photo-1490122417551-6ee9691429d0', 'photo-1501183007986-d0d080b147f9',
      'photo-1501854140801-50d01698950b', 'photo-1505873242700-f289a29e1e0f', 'photo-1507089947368-19c1da9775ae', 'photo-1512915922686-57c11dde9b6b',
      'photo-1512917774080-9991f1c4c750', 'photo-1512918751678-df1611a2f6bf', 'photo-1513584684374-8bab748fbf90', 'photo-1513694203232-719a280e022f',
      'photo-1518780664697-55e3ad937233', 'photo-1518780664697-55e3ad937233', 'photo-1523217582562-09d0def993a6', 'photo-1542314831-068cd1dbfeeb',
      'photo-1542838132-92c53300491e', 'photo-1564013799919-ab600027ffc6', 'photo-1568605114967-8130f3a36994', 'photo-1570129477492-45c003edd2be',
      'photo-1572120360610-d971b9d7767c', 'photo-1575908513180-d60f43f81002', 'photo-1576941089067-2de3c901e126', 'photo-1580587771525-78b9dba3b914',
      'photo-1582268611958-ebfd161ef9cf', 'photo-1583608205776-bfd35f0d9f83', 'photo-1584622781564-1d987f733321', 'photo-1585412727339-54e4bae3bbf9'
    ];

    const fallbackImages = photoIds.map(id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`);
    
    // 未使用の画像のみにフィルタリング
    const unusedFallbackImages = fallbackImages.filter(img => !existingEyecatches.includes(img));
    
    if (unusedFallbackImages.length > 0) {
      const selectedUrl = unusedFallbackImages[Math.floor(Math.random() * unusedFallbackImages.length)];
      console.log(`Using unused fallback Unsplash image URL: ${selectedUrl}`);
      return { type: 'url', data: selectedUrl };
    } else {
      // すべて使用済みの場合は、slugのハッシュ値に基づいて決定論的にプールから選択し、リンク切れを回避
      let hash = 0;
      for (let i = 0; i < slug.length; i++) {
        hash = slug.charCodeAt(i) + ((hash << 5) - hash);
      }
      const index = Math.abs(hash) % fallbackImages.length;
      const selectedUrl = fallbackImages[index];
      console.log(`All fallback images used. Selecting deterministic image from pool: ${selectedUrl}`);
      return { type: 'url', data: selectedUrl };
    }
  }
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
    
    // 画像の自動生成
    console.log('Generating matching eyecatch image...');
    const resultImage = await generateImage(article.title, article.excerpt, selectedTopic.defaultEyecatch, article.keywords, existingEyecatches, article.slug);
    
    if (resultImage.type === 'buffer') {
      const imageFilename = `${article.slug}.jpg`;
      const imagePath = path.join(process.cwd(), 'public/blog', imageFilename);
      fs.writeFileSync(imagePath, resultImage.data);
      console.log(`Saved generated eyecatch image to: public/blog/${imageFilename}`);
      article.eyecatch = `/blog/${imageFilename}`;
    } else {
      console.log(`Using fallback Unsplash image URL: ${resultImage.data}`);
      article.eyecatch = resultImage.data;
    }
    
    // 本日の日付
    const today = new Date().toISOString().split('T')[0];
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
