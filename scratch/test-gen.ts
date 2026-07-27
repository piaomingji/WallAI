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
  try {
    console.log('Calling generateContent...');
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Hello, what model are you?' }
          ],
        },
      ],
    });
    console.log('Response:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

run();
