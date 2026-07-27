import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { HOUSE_TYPES, PAINT_COLORS } from '@/lib/constants';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

// IP 및 Google 계정의 누적 생성 횟수를 추적하기 위한 인메모리 맵 (통산 2회 제한, 리셋 없음)
const ipCounts = new Map<string, number>();
const googleUserCounts = new Map<string, number>();

// PRO 회원 안전대책 (일일 100회 제한 & 10秒 연속생성 제한) 추적 맵
const proUsageTracker = new Map<string, { dailyCount: number; resetAt: number; lastGeneratedAt: number }>();

export async function POST(req: NextRequest) {
  try {
    // Sanitize headers to prevent ByteString conversion crashes in any outgoing runtime fetch calls
    try {
      const keys = Array.from(req.headers.keys());
      for (const key of keys) {
        const val = req.headers.get(key) || '';
        let hasNonAscii = false;
        for (let i = 0; i < val.length; i++) {
          if (val.charCodeAt(i) > 255) {
            hasNonAscii = true;
            break;
          }
        }
        if (hasNonAscii) {
          req.headers.set(key, encodeURIComponent(val));
        }
      }
    } catch (e) {
      console.error('Error sanitizing headers:', e);
    }

    // 요청 용량 제한 체크 (~8MB)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'アップロード容量制限（8MB）を超過しました。画像の解像度を下げてください。' },
        { status: 413 }
      );
    }

    const {
      image,
      houseTypeId,
      partColors,
      lighting,
      byokKey,
      userId,
      userEmail,
      isPremiumUser,
      userPlan,
      customSampleColor,
    } = await req.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'シミュレーションする住宅写真をアップロードしてください。' },
        { status: 400 }
      );
    }

    const houseType = HOUSE_TYPES.find((h) => h.id === houseTypeId) || HOUSE_TYPES[0];

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    // API 키 결정 (BYOK 우선, 없으면 서버 환경변수 키)
    const apiKey = (typeof byokKey === 'string' && byokKey.trim()) || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'APIキーが設定されていません。' },
        { status: 500 }
      );
    }

    // Google 계정 식별자 추출 (IAP 헤더 또는 바디 정보)
    const getSafeHeader = (name: string): string => {
      const val = req.headers.get(name) || '';
      if (!val) return '';
      try {
        if (val.startsWith('base64:')) {
          return Buffer.from(val.slice(7), 'base64').toString('utf8').trim();
        }
        return decodeURIComponent(val).trim();
      } catch {
        return val.trim();
      }
    };

    const googleUserEmailHeader = getSafeHeader('x-goog-authenticated-user-email') || getSafeHeader('x-user-email') || '';
    const googleUserIdHeader = getSafeHeader('x-goog-authenticated-user-id') || getSafeHeader('x-user-id') || '';
    const bodyUserId = (typeof userId === 'string' && userId.trim()) || '';
    const bodyUserEmail = (typeof userEmail === 'string' && userEmail.trim()) || '';
    const finalUserIdentifier = googleUserEmailHeader || googleUserIdHeader || bodyUserEmail || bodyUserId || null;

    // PROプラン（サブスク会員）のユーザーに対する安全対策（API乱用・連打防止）
    const isProUser = userPlan === 'pro';
    const trackingKey = finalUserIdentifier || ip;

    // 無料体験枠（通算2回）の制限チェック（IPとGoogleアカウントのダブル判定）
    const isDemoMode = !byokKey;

    if (isProUser && isDemoMode) {
      const now = Date.now();
      let record = proUsageTracker.get(trackingKey);

      // 初期화 또는 24시간 리셋
      if (!record || now > record.resetAt) {
        record = {
          dailyCount: 0,
          resetAt: now + 24 * 60 * 60 * 1000,
          lastGeneratedAt: 0,
        };
        proUsageTracker.set(trackingKey, record);
      }

      // 1. 連打・短時間連続リクエストの防止（レートリミット: 10秒間隔）
      const timeSinceLast = now - record.lastGeneratedAt;
      if (timeSinceLast < 10 * 1000) {
        return NextResponse.json(
          { error: 'リクエストの間隔が短すぎます。前回の生成から10秒以上あけて再度お試しください。' },
          { status: 429 }
        );
      }

      // 2. 1日あたりの生成上限（フェアユース制限: 最大100回）
      if (record.dailyCount >= 100) {
        return NextResponse.json(
          { error: '本日の生成上限（100回）に達しました。明日以降に再度お試しください。' },
          { status: 429 }
        );
      }
    }

    const isPremium = !!isPremiumUser; // Check premium status sent from client
    if (isDemoMode && !isPremium) {
      const currentIpCount = ipCounts.get(ip) || 0;
      const currentGoogleCount = finalUserIdentifier ? (googleUserCounts.get(finalUserIdentifier) || 0) : 0;

      if (currentIpCount >= 2 || currentGoogleCount >= 2) {
        return NextResponse.json(
          { error: '無料体験枠（通算2回）をすべて消費しました。引き続きご利用いただくには有料プランをご検討ください。' },
          { status: 429 }
        );
      }
    }

    let mimeType = 'image/jpeg';
    let base64Image = image;
    if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        mimeType = match[1];
        base64Image = match[2];
      }
    } else if (image.startsWith('/')) {
      try {
        const filePath = path.join(process.cwd(), 'public', image);
        if (fs.existsSync(filePath)) {
          const fileBuffer = fs.readFileSync(filePath);
          base64Image = fileBuffer.toString('base64');
          if (image.endsWith('.png')) {
            mimeType = 'image/png';
          } else if (image.endsWith('.webp')) {
            mimeType = 'image/webp';
          }
        } else {
          return NextResponse.json(
            { error: `サンプル画像ファイルが見つかりません: ${image}` },
            { status: 400 }
          );
        }
      } catch (e) {
        console.error('Error reading local sample image:', e);
        return NextResponse.json(
          { error: 'サンプル画像の読み込み中にエラーが発生しました。' },
          { status: 500 }
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];
    parts.push({ inlineData: { mimeType, data: base64Image } }); // Image 1 is always the main house photo

    if (customSampleColor && customSampleColor.base64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: customSampleColor.base64,
        },
      }); // Image 2 is the custom color/texture reference sample
    }

    // Get color specifications
    const getColorDetailsServer = (colorId: string) => {
      if (!colorId) {
        return {
          id: 'none',
          label: '指定なし（変更しない）',
          hex: 'transparent',
          prompt: 'do not paint or alter, keep original color',
        };
      }
      if (colorId === 'custom_sample' && customSampleColor) {
        return {
          id: 'custom_sample',
          label: 'カスタム抽出色',
          hex: customSampleColor.hex,
          prompt: `custom paint color matching hex code ${customSampleColor.hex} and texture referenced from Image 2`,
        };
      }
      return PAINT_COLORS.find((c) => c.id === colorId) || PAINT_COLORS[0];
    };

    const allWallsColor = getColorDetailsServer(partColors?.all_walls);
    const firstFloorColor = getColorDetailsServer(partColors?.first_floor);
    const secondFloorColor = getColorDetailsServer(partColors?.second_floor);
    const accentColor = getColorDetailsServer(partColors?.accent);
    const roofColor = getColorDetailsServer(partColors?.roof);
    const trimColor = getColorDetailsServer(partColors?.trim);

    const isAllWallsPainted = allWallsColor.id !== 'none';

    const allWallsPrompt = isAllWallsPainted
      ? `MUST paint using color "${allWallsColor.label}" (Hex: ${allWallsColor.hex}, Style: ${allWallsColor.prompt}). Apply "${allWallsColor.label}" to all exterior wall surfaces (both 1st and 2nd floors uniformly). Ensure even coverage across the entire house while maintaining original textures and window trims. Shaded and shadowed wall areas should also be covered uniformly. ${allWallsColor.id === 'custom_sample' ? 'Extrapolate this paint color and texture directly from the reference sample shown in Image 2.' : ''}`
      : '';

    const firstFloorPrompt = firstFloorColor.id === 'none'
      ? 'Do NOT paint or alter the color/texture of the 1st floor exterior walls. Keep it exactly identical to the original Image 1.'
      : `MUST paint using color "${firstFloorColor.label}" (Hex: ${firstFloorColor.hex}, Style: ${firstFloorColor.prompt}). Apply "${firstFloorColor.label}" to the entire 1st floor exterior walls including areas behind carports/garages, under balconies, and shadowed areas. Ensure complete color coverage for all 1st floor wall sections while preserving original textures, grid lines, and natural lighting shadows. Do NOT make the walls look flat or smooth, and do not leave any original 1st floor wall color unpainted. ${firstFloorColor.id === 'custom_sample' ? 'Extrapolate this paint color and texture directly from the reference sample shown in Image 2.' : ''}`;

    const secondFloorPrompt = secondFloorColor.id === 'none'
      ? 'Do NOT paint or alter the color/texture of the 2nd floor exterior walls. Keep it exactly identical to the original Image 1.'
      : `MUST paint using color "${secondFloorColor.label}" (Hex: ${secondFloorColor.hex}, Style: ${secondFloorColor.prompt}). Apply "${secondFloorColor.label}" to the entire 2nd floor exterior walls. Ensure complete color coverage for all 2nd floor wall sections while preserving original textures, grid lines, and natural lighting shadows. Do NOT make the walls look flat or smooth, and do not leave any original 2nd floor wall color unpainted. ${secondFloorColor.id === 'custom_sample' ? 'Extrapolate this paint color and texture directly from the reference sample shown in Image 2.' : ''}`;

    const accentColorPrompt = accentColor.id === 'none'
      ? 'Do NOT paint or alter the color/texture of the accent sections and balconies. Keep it exactly identical to the original Image 1.'
      : `MUST paint using color "${accentColor.label}" (Hex: ${accentColor.hex}, Style: ${accentColor.prompt}). Apply "${accentColor.label}" to ALL designated accent exterior wall surfaces, columns, and balconies. Ensure complete color coverage for all accent sections while preserving original textures, grid lines, and natural lighting shadows. Do NOT make the walls look flat or smooth. ${accentColor.id === 'custom_sample' ? 'Extrapolate this paint color and texture directly from the reference sample shown in Image 2.' : ''}`;

    const roofColorPrompt = roofColor.id === 'none'
      ? 'Do NOT paint or alter the color/texture of the Roof. Keep it exactly identical to the original Image 1.'
      : `MUST paint using color "${roofColor.label}" (Hex: ${roofColor.hex}, Style: ${roofColor.prompt}). Apply the paint color as a semi-transparent overlay coat, keeping all the underlying roof tile lines, seams, and texture of Image 1 fully visible. Do NOT smooth or flatten the roof surface. ${roofColor.id === 'custom_sample' ? 'Extrapolate this paint color and texture directly from the reference sample shown in Image 2.' : ''}`;

    const trimColorPrompt = trimColor.id === 'none'
      ? 'Do NOT paint or alter the color/texture of the doors, window sashes, rain gutters, fascia boards, and trims. Keep it exactly identical to the original Image 1.'
      : `MUST paint using color "${trimColor.label}" (Hex: ${trimColor.hex}, Style: ${trimColor.prompt}). Apply the paint color precisely as a thin overlay coat, maintaining all edge details and material texture without smoothing. ${trimColor.id === 'custom_sample' ? 'Extrapolate this paint color and texture directly from the reference sample shown in Image 2.' : ''}`;

    let twotonePrompt = '';
    if (isAllWallsPainted) {
      twotonePrompt = `\n- Single unified color design: Paint both 1st and 2nd floors with the same color "${allWallsColor.label}" (Hex: ${allWallsColor.hex}) for a seamless, unified exterior look.`;
    } else if (firstFloorColor.id !== 'none' && secondFloorColor.id !== 'none') {
      if (firstFloorColor.id !== secondFloorColor.id) {
        twotonePrompt = `\n- TWO-TONE EXTERIOR PAINTING (HORIZONTAL DIVISION):
      * LOWER LEVEL (1st floor): Paint the entire lower section from the ground up to the 1st floor ceiling/dividing line with "${firstFloorColor.label}" (Hex: ${firstFloorColor.hex}).
      * UPPER LEVEL (2nd floor): Paint the entire upper section from the 2nd floor base line up to the roof line (including the upper balcony exterior) with "${secondFloorColor.label}" (Hex: ${secondFloorColor.hex}).
      * The boundary must strictly follow the natural horizontal architectural division line between the 1st and 2nd stories. Do NOT cut colors in the middle of a balcony wall or window.`;
      } else {
        twotonePrompt = `\n- Single unified color design: Paint both 1st and 2nd floors with the same color "${firstFloorColor.label}" (Hex: ${firstFloorColor.hex}) for a seamless, unified exterior look.`;
      }
    } else if (firstFloorColor.id !== 'none') {
      twotonePrompt = `\n- Paint only the 1st floor exterior walls with "${firstFloorColor.label}" (Hex: ${firstFloorColor.hex}). The 2nd floor exterior walls must remain entirely unpainted, maintaining its original color and texture from Image 1.`;
    } else if (secondFloorColor.id !== 'none') {
      twotonePrompt = `\n- Paint only the 2nd floor exterior walls with "${secondFloorColor.label}" (Hex: ${secondFloorColor.hex}). The 1st floor exterior walls must remain entirely unpainted, maintaining its original color and texture from Image 1.`;
    }

    let lightingText = '';
    if (lighting === 'sunset') {
      lightingText = 'Warm golden hour sunset glow, warm lighting, long soft shadows';
    } else if (lighting === 'overcast') {
      lightingText = 'Diffused overcast cloudy day lighting, soft shadows, no direct sun glare';
    } else {
      lightingText = 'Bright sunny daylight at noon, clear blue sky, natural solar shadows';
    }

    const instruction = `You are a highly precise, professional AI house painting visualization tool.
You are given the following input:
- Image 1: The original photo of the house exterior before painting. This is the structural template.
${customSampleColor && customSampleColor.base64 ? '- Image 2: A reference color or texture sample uploaded by the user.\n' : ''}

REDESIGN TASK (House Exterior Paint Simulator):
- Paint the house exterior parts with the following exact, independent colors:${twotonePrompt}
${isAllWallsPainted
  ? `  1. All exterior walls (unified): ${allWallsPrompt}`
  : `  1. 1st floor exterior walls: ${firstFloorPrompt}\n  2. 2nd floor exterior walls: ${secondFloorPrompt}`}
  3. Accent sections and balconies: ${accentColorPrompt}
  4. Roof: ${roofColorPrompt}
  5. Doors, window sashes, rain gutters, fascia boards, and trims: ${trimColorPrompt}

LIGHTING & ATMOSPHERE:
- Render the entire scene under the specified lighting condition: ${lightingText}. Adjust the highlights, shadows, sky appearance, and reflection values on painted walls accordingly.

CRITICAL ARCHITECTURAL CONSTRAINTS (MANDATORY / HIGHEST PRIORITY):
- Strictly keep the original wall texture, tile grid lines, joints, grout lines, and surface bumpiness. Do NOT smooth or flatten the wall or roof surfaces.
- The paint color division must align perfectly with the house's horizontal architectural lines, such as girth belts (胴差し幕板), fascia, trim lines, or horizontal joints. Follow the natural structural edges detected in Image 1 and do NOT allow colors to bleed or transition in the middle of a continuous flat surface like a balcony wall or siding panel.
- Preserve the exact surface roughness, depth map characteristics, bumpiness, and normal map details of the walls in Image 1.
- Keep the exact same architectural structure, geometry, windows, doors, roof shape, columns, details, landscape, trees, fences, sky, ground, neighbor buildings, and background of the input image (Image 1) 100% perfectly identical.
- Do NOT alter, warp, distort, tilt, modify, add, or remove any architectural or background elements of the house structure.
- Only change the paint colors and their light reflections of the specified parts (1st floor walls, 2nd floor walls, Roof, Accent walls, Doors/Trims) that are requested to be painted. Keep all other elements exactly identical to Image 1.
- The output image must look 100% like a high-quality professional photograph of the same house, but painted with the specified colors.`;

    parts.push({ text: instruction });

    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      config: {
        temperature: 0.1,
      },
    });

    const candidate = res.candidates?.[0];

    if (candidate?.finishReason === 'SAFETY') {
      return NextResponse.json(
        { error: '安全ポリシーにより画像の生成がブロックされました。別の画像を使用してください。' },
        { status: 400 }
      );
    }

    const part = candidate?.content?.parts?.find((p) => p.inlineData);
    const imageBase64 = part?.inlineData?.data;

    if (!imageBase64) {
      return NextResponse.json(
        { error: '画像の生成に失敗したか、ブロックされました。別のカラー構成や画像でお試しください。' },
        { status: 400 }
      );
    }

    if (isDemoMode) {
      if (!isPremium) {
        // IP 주소 기준 누적 횟수 증가
        const newIpCount = (ipCounts.get(ip) || 0) + 1;
        ipCounts.set(ip, newIpCount);

        // Google 계정 기준 누적 횟수 증가
        if (finalUserIdentifier) {
          const newGoogleCount = (googleUserCounts.get(finalUserIdentifier) || 0) + 1;
          googleUserCounts.set(finalUserIdentifier, newGoogleCount);
        }
      }

      // PRO 회원 생성 기록 업데이트 (누적 횟수 증가 및 최종 생성 시각 업데이트)
      if (isProUser) {
        const record = proUsageTracker.get(trackingKey);
        if (record) {
          record.dailyCount += 1;
          record.lastGeneratedAt = Date.now();
        }
      }
    }

    return NextResponse.json({ image: imageBase64 });
  } catch (error) {
    console.error('Gemini Generate API Error:', error);
    const errMsg = error instanceof Error ? error.message : '';

    if (
      errMsg.includes('API_KEY_INVALID') ||
      errMsg.includes('API key not valid') ||
      errMsg.includes('invalid api key')
    ) {
      return NextResponse.json(
        { error: 'APIキーが無効です。発行された有効なAPIキーを正しく入力してください。' },
        { status: 401 }
      );
    }

    if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('429')) {
      return NextResponse.json(
        { error: 'APIの無料リクエスト制限を超過しました。しばらく時間をおいてから再試行してください。' },
        { status: 429 }
      );
    }

    if (errMsg.includes('SAFETY') || errMsg.includes('safety') || errMsg.includes('blocked')) {
      return NextResponse.json(
        { error: '安全フィルターにより生成が拒否されました。別の写真やスタイルでお試しください。' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: `塗装完成イメージの生成に失敗しました: ${errMsg || '不明なサーバーエラー'}` },
      { status: 500 }
    );
  }
}
