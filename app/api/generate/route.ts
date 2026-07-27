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

    // Get color specifications
    const mainColor = PAINT_COLORS.find((c) => c.id === partColors?.main) || PAINT_COLORS[0];
    const accentColor = PAINT_COLORS.find((c) => c.id === partColors?.accent) || PAINT_COLORS[1];
    const roofColor = PAINT_COLORS.find((c) => c.id === partColors?.roof) || PAINT_COLORS[5];
    const trimColor = PAINT_COLORS.find((c) => c.id === partColors?.trim) || PAINT_COLORS[9];

    let lightingText = '';
    if (lighting === 'sunset') {
      lightingText = 'Warm golden hour sunset glow, warm lighting, long soft shadows';
    } else if (lighting === 'overcast') {
      lightingText = 'Diffused overcast cloudy day lighting, soft shadows, no direct sun glare';
    } else {
      lightingText = 'Bright sunny daylight at noon, clear blue sky, natural solar shadows';
    }

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

    const ai = new GoogleGenAI({ apiKey });
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
