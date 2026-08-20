import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message, type } = await req.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'すべての項目を入力してください。' },
        { status: 400 }
      );
    }

    // Googleフォームの裏側POST連携データ構築
    const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSc2ae-xalCKC6_S-uEZOccZnwFXNPCGnvYtISd6CJPQkydhLw/formResponse';
    
    const params = new URLSearchParams();
    params.append('entry.256677115', name);       // お名前
    params.append('entry.786759119', email);        // メールアドレス
    // 4アプリが同じGoogleフォームを共有していて、どのアプリから来たのかを示す項目が
    // ありません。件名の頭にアプリ名を付けて、受信側で見分けられるようにしています。
    params.append('entry.973342212', `[WallAI] ${subject}`);      // 件名
    params.append('entry.1795818340', message);      // お問い合わせ内容
    params.append('entry.2093645915', type || 'その他');      // お問い合わせ種別

    const response = await fetch(formUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok && response.status !== 0) {
      throw new Error(`Google Form submission failed with status: ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Contact submit error:', error);
    return NextResponse.json(
      { error: 'お問い合わせの送信に失敗しました。時間をおいて再度お試しください。' },
      { status: 500 }
    );
  }
}
