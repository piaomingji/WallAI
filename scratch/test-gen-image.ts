import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          if (key && !process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (e) {
    console.error('Error loading env.local:', e);
  }
}

loadEnv();

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('API Key exists:', !!apiKey);
  if (!apiKey) return;

  const ai = new GoogleGenAI({ apiKey });
  
  // Read a sample image
  const imagePath = path.resolve(process.cwd(), 'public/japanese_house.png');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = 'image/png';

  const parts: any[] = [];
  parts.push({ inlineData: { mimeType, data: base64Image } });
  
  const mainColor = { label: 'アイボリー', hex: '#FDFBF7', prompt: 'creamy ivory paint finish' };
  const accentColor = { label: 'ナチュラルベージュ', hex: '#E6D7C3', prompt: 'warm natural beige paint finish' };
  const roofColor = { label: 'チャコールブラック', hex: '#222222', prompt: 'sleek charcoal black matte paint finish' };
  const trimColor = { label: 'クリーミーホワイト', hex: '#F9F6F0', prompt: 'clean creamy white paint finish' };
  const lightingText = 'Bright sunny daylight at noon, clear blue sky, natural solar shadows';

  const instruction = `You are an expert AI house painting visualization tool.
You are given a photo of a house:
- Image 1: The original photo of the house exterior before painting. This is the structural template.

REDESIGN TASK (House Exterior Paint Simulator):
- Paint the house exterior parts with the following exact colors:
  1. Main Walls: Paint using "${mainColor.label}" (refer to hex: ${mainColor.hex}, style: ${mainColor.prompt}).
  2. Accent Walls: Paint using "${accentColor.label}" (refer to hex: ${accentColor.hex}, style: ${accentColor.prompt}).
  3. Roof: Paint using "${roofColor.label}" (refer to hex: ${roofColor.hex}, style: ${roofColor.prompt}).
  4. Doors, Window Sashes, Rain Gutters, and Trims: Paint using "${trimColor.label}" (refer to hex: ${trimColor.hex}, style: ${trimColor.prompt}).

LIGHTING & ATMOSPHERE:
- Render the entire scene under the specified lighting condition: ${lightingText}. Adjust the highlights, shadows, sky appearance, and reflection values on painted walls accordingly.

CRITICAL GEOMETRY CONSTRAINT (HIGHEST PRIORITY):
- You must STRICTLY lock the original building geometry, structures, wireframe boundaries, outlines, perspective, window frames, doors, landscape (trees, roads, ground), and neighbor buildings 100% perfectly.
- Do not warp, tilt, distort, add, remove, or modify any architectural elements (such as windows, doors, roof geometry, columns, or chimneys). Only change the paint colors and light reflection of the specified parts.
- The output image must look like a high-quality professional architectural photo. Keep it extremely realistic with natural shadows, reflections, and paint texture.`;

  parts.push({ text: instruction });

  try {
    console.log('Calling generateContent with image and prompt...');
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
    });

    const candidate = res.candidates?.[0];
    console.log('Finish Reason:', candidate?.finishReason);
    
    const imagePart = candidate?.content?.parts?.find((p) => p.inlineData);
    const outputBase64 = imagePart?.inlineData?.data;
    
    if (outputBase64) {
      console.log('Success! Received base64 image of length:', outputBase64.length);
      fs.writeFileSync(path.resolve(process.cwd(), 'scratch/output.png'), Buffer.from(outputBase64, 'base64'));
      console.log('Saved to scratch/output.png');
    } else {
      console.log('No inlineData image found in response parts. Content was:');
      console.log(JSON.stringify(candidate?.content, null, 2));
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

run();
