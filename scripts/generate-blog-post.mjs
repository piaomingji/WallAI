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
    titleHint: 'ベージュやグレーの外壁塗装で失敗しない！おしゃれに仕上げる配色テクニック'
  },
  {
    keyword: '外壁 遮熱塗料 効果 寿命',
    titleHint: '遮熱塗料は本当に効果がある？節電メリットと寿命・費用相場を徹底解説'
  },
  {
    keyword: '外壁塗装 ツートンカラー 組み合わせ',
    titleHint: '【実例あり】外壁塗装をツートンカラーでおしゃれにする黄金比率とおすすめの組み合わせ'
  },
  {
    keyword: '外壁塗装 費用相場 坪数別',
    titleHint: '外壁塗装の適正価格は？30坪・40坪の費用相場と悪徳業者を見分ける見積りのチェックポイント'
  },
  {
    keyword: '外装サイディング メンテナンス 時期',
    titleHint: 'サイディング外壁の寿命は何年？塗り替えや張り替えのサインと後悔しないメンテナンス計画'
  }
];

// ランダムにトピックを1つ選択
const selectedTopic = topics[Math.floor(Math.random() * topics.length)];

async function generateArticle() {
  const prompt = `
あなたは外壁塗装と住宅リフォームのプロのSEOライターです。
ターゲットキーワード: "${selectedTopic.keyword}" を含み、以下のヒントに沿った高品質なSEO集客ブログ記事を生成してください。
タイトルヒント: "${selectedTopic.titleHint}"

【満たすべき条件】
1. 読者の悩みや疑問を解決する信頼性の高い情報を含め、自然な日本語で執筆してください。
2. 見出し（h2, h3）、太字（<strong>）、順不同リスト（<ul> <li>）などを使って綺麗にマークアップされたHTML本文（contentHtml）にしてください。
3. 記事内の後半に, 当サービス（WallAI）のAI外壁カラーシミュレーションを紹介し、以下のCTAリンクを「必ず」中央寄せで設置してください：
   <p class="text-center my-8">
     <a href="/?contact=false" class="inline-flex items-center justify-center rounded-full bg-clay px-8 py-4 text-sm font-bold text-paper hover:bg-ink transition-all hover:scale-105 shadow-lg gap-2">
       🎨 我が家で無料シミュレーションを試す
     </a>
   </p>
4. 出力は以下のJSON構造に厳密に従ってください。

【返却するJSONの構造スキーマ】
{
  "slug": "英語でURLに適したユニークなスラッグ（例: wall-paint-beige-gray-guide）",
  "title": "読者を引きつけるSEOに強い記事タイトル",
  "excerpt": "記事の概要・抜粋（100〜150文字程度）",
  "keywords": ["キーワード1", "キーワード2", "キーワード3"],
  "contentHtml": "h2、h3、p、ul、li、strong等のHTMLタグで構成された本文（markdownではなく素のHTML文字列）"
}
`;

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    }
  });

  const textContent = response.text;
  if (!textContent) {
    throw new Error('Empty response from Gemini API');
  }
  return JSON.parse(textContent);
}

// 記事の内容に沿ったアイキャッチ画像を生成する関数 (Imagen 3がエラーの場合はUnsplashのフリー画像をフォールバック)
async function generateImage(title, excerpt) {
  const promptForImagePrompt = `
以下のブログ記事のタイトルと概要に合致する、美しくプロフェッショナルな画像生成AI用のプロンプト（英語）を1行で作成してください。
余計な説明文や挨拶は一切省き、プロンプトテキストのみを返却してください。

タイトル: ${title}
概要: ${excerpt}
`;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const promptResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptForImagePrompt
    });

    const imagePrompt = promptResponse.text.trim();
    console.log(`Generated Image Prompt: ${imagePrompt}`);

    console.log('Attempting to generate image via Imagen 3...');
    // Imagenモデルで画像を生成
    const imageResponse = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `${imagePrompt}, professional architecture photography, beautiful residential exterior house paint design, daytime daylight, highly detailed, blog header banner`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '16:9'
      }
    });

    const base64Image = imageResponse.generatedImages[0].image.imageBytes;
    return { type: 'buffer', data: Buffer.from(base64Image, 'base64') };
  } catch (error) {
    console.log('Imagen 3 generation failed or not supported. Falling back to high-quality Unsplash image...', error.message);
    
    // 外壁用の高画質Unsplash画像リスト
    const fallbackImages = [
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
    ];
    const selectedUrl = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
    return { type: 'url', data: selectedUrl };
  }
}

async function main() {
  try {
    console.log('Generating AI Blog post...');
    const article = await generateArticle();
    
    // 画像の自動生成
    console.log('Generating matching eyecatch image...');
    const resultImage = await generateImage(article.title, article.excerpt);
    
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

    // lib/blog.ts の更新
    const filePath = path.join(process.cwd(), 'lib/blog.ts');
    let fileContent = fs.readFileSync(filePath, 'utf-8');

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
