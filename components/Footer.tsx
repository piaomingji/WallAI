"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Footer() {
  const [modalType, setModalType] = useState<'terms' | 'privacy' | 'contact' | null>(null);

  // お問い合わせ入力フォーム用ステート
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactType, setContactType] = useState('その他');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalType(null);
      }
    };
    if (modalType) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalType]);

  // クエリパラメータに contact=true があれば自動でお問い合わせを開く
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('contact') === 'true') {
        setModalType('contact');
      }
    }
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactSubject.trim() || !contactMessage.trim()) {
      setContactError('すべての項目を入力してください。');
      return;
    }
    setIsSubmitting(true);
    setContactError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          type: contactType,
          subject: contactSubject,
          message: contactMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'お問い合わせの送信に失敗しました。');
      }
      setSubmitSuccess(true);
      setContactName('');
      setContactEmail('');
      setContactType('その他');
      setContactSubject('');
      setContactMessage('');
    } catch (err: any) {
      setContactError(err.message || '接続エラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="w-full border-t border-line bg-paper-raised">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-6 py-10 text-xs text-ink-faint">
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-baseline sm:gap-2">
          <span className="font-display text-sm font-bold text-ink text-center">
            🏠 WallAI
          </span>
          <span className="text-center">© 2026 All Rights Reserved.</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-ink-soft">
          <button
            onClick={() => {
              setModalType('contact');
              setSubmitSuccess(false);
              setContactError(null);
            }}
            className="cursor-pointer transition-colors hover:text-clay hover:underline bg-transparent border-0 p-0 text-xs text-ink-soft"
          >
            お問い合わせ
          </button>
          <button
            onClick={() => setModalType('terms')}
            className="cursor-pointer transition-colors hover:text-clay hover:underline bg-transparent border-0 p-0 text-xs text-ink-soft"
          >
            利用規約
          </button>
          <button
            onClick={() => setModalType('privacy')}
            className="cursor-pointer transition-colors hover:text-clay hover:underline bg-transparent border-0 p-0 text-xs text-ink-soft"
          >
            プライバシーポリシー
          </button>
          <a
            href="/tokushoho"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-clay hover:underline"
          >
            特定商取引法に基づく表記
          </a>
          <Link
            href="/blog"
            className="transition-colors hover:text-clay hover:underline text-xs text-ink-soft font-medium"
          >
            ブログ
          </Link>
        </div>
      </div>

      {/* モーダル表示 */}
      {modalType && (
        <div
          onClick={() => setModalType(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 sm:p-6 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-paper border border-line rounded-3xl shadow-lift max-h-[80vh] flex flex-col overflow-hidden animate-scale-up"
          >
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between border-b border-line p-5 sm:p-6 bg-paper-raised">
              <h3 className="font-display text-base font-bold text-ink">
                {modalType === 'terms' ? '利用規約' : modalType === 'privacy' ? 'プライバシーポリシー' : 'お問い合わせ'}
              </h3>
              <button
                onClick={() => setModalType(null)}
                className="cursor-pointer p-1.5 rounded-full hover:bg-line text-ink-soft hover:text-ink transition-colors"
                aria-label="閉じる"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* モーダルコンテンツ */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-xs text-ink-soft space-y-4 leading-relaxed scrollbar-thin">
              {modalType === 'terms' ? (
                <>
                  <p className="font-semibold text-ink">第1条（適用）</p>
                  <p>本規約は、WallAI（以下「当サービス」）の提供条件および当サービスと利用者との間の権利義務関係を定めるものです。</p>

                   <p className="font-semibold text-ink">第2条（利用制限およびアカウント管理）</p>
                  <p>1. 当サービスは、登録不要で体験回数を初回通算5回まで無料で提供します。</p>
                  <p>2. 有料プラン（Proプラン）の契約者は、1日最大100回までの画像生成が可能です。生成可能回数は、毎日日本標準時（JST）午前0時にリセットされます。システムへの過度な負荷防止、または不正検知ツールにより、この制限値が調整される場合があります。</p>
                  <p>3. 有料プラン（法人プラン）の契約者は、同一法人内で最大5名様まで同時に共有・ご利用いただけます（1日の合計生成上限500回）。</p>
                  <p>4. 有料プラン（Proプラン）のアカウントは、契約者ご本人様（1名）のみが利用できるものとし、同一アカウントを複数人で共有・使い回す行為は禁止します。共有や不当な複数端末での同時利用が発覚した場合、システムの安全保護のためアカウントを一時停止またはセッションを強制切断する場合があります。</p>

                  <p className="font-semibold text-ink">第3条（アップロード画像の取り扱いおよび著作権）</p>
                  <p>1. 利用者は、自身が適法な送信・使用権利を保有する画像データ（住宅の写真）のみをアップロードするものとします。</p>
                  <p>2. アップロードされた画像およびAIにより生成された塗装完成イメージの著作権は、利用者に留保されます。当サービスが所有権を主張することはありません。</p>
                  <p>3. アップロードされた元画像および生成画像は、AIへの変換リクエストおよびユーザーへの画像配信以外の目的では使用されず、第三者に無断公開されることはありません。</p>

                  <p className="font-semibold text-ink">第4条（禁止事項）</p>
                  <p>利用者は、他人の権利（著作権、プライバシー権など）を侵害する画像、公序良俗に反するコンテンツの送信、サービスに対する負荷攻撃、その他当サービスが不適切と判断する行為を行ってはなりません。</p>

                  <p className="font-semibold text-ink">第5条（データ削除および保存期間）</p>
                  <p>当サービスは画像ストレージを提供するものではなく、アップロードされた画像および生成された塗装完成イメージデータをサーバー上に一切保存いたしません。すべての画像データは生成処理のメモリ上でのみ一時的に処理され、処理完了後に即座に自動破棄されます（データ保存期間：0秒）。そのため、必要な成果物は利用者自身で都度ダウンロードし保存してください。</p>

                  <p className="font-semibold text-ink">第6条（免責事項）</p>
                  <p>当サービスにより生成される塗装完成イメージはAIモデルの計算によるシミュレーション結果であり、実際の外壁塗装施工結果や色味を完全に保証するものではありません。実際の施工の際は専門業者へご相談ください。</p>
                </>
              ) : modalType === 'privacy' ? (
                <>
                  <p className="font-semibold text-ink">1. 個人情報の収集目的</p>
                  <p>当サービスは、決済手続き（Stripe経由での決済認証）、お問い合わせへの対応、およびサービスの利用状況分析（Cookie等の利用）のために必要最小限の個人情報を収集します。</p>

                  <p className="font-semibold text-ink">2. アップロード画像データのプライバシー保護</p>
                  <p>1. 利用者がアップロードした「住宅の写真」は、AIモデルへの画像生成処理のみに使用されます。</p>
                  <p>2. アップロードされた画像データ、および生成された塗装完成イメージを、利用者の事前の明示的な同意なくAIの追加学習モデルやシステム開発のためのデータセットとして流用・二次利用することは一切ありません。</p>
                  <p>3. 画像データは安全な通信プロトコル（SSL/TLS）により暗号化されて処理されます。</p>

                  <p className="font-semibold text-ink">3. 画像データの保管および安全な削除</p>
                  <p>プライバシー保護の観点から、アップロードされた一時画像および生成された塗装完成イメージは、生成処理が終了した時点で当サービスのサーバー上から即座に自動破棄され、保存・蓄積されることはありません（データ保存期間：0秒）。</p>

                  <p className="font-semibold text-ink">4. 第三者への開示・提供の制限</p>
                  <p>当サービスは、収集した個人情報およびアップロード画像データを、法令に基づく要請がある場合を除き、利用者の承諾なしに第三者へ開示または提供することはありません。</p>

                  <p className="font-semibold text-ink">5. プライバシーポリシーの改定</p>
                  <p>当サービスは、個人情報保護法の改正やサービスの変更に伴い、本プライバシーポリシーを随時更新することがあります。重要な変更がある場合は、サービスサイト上で事前お知らせいたします。</p>
                </>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4 text-left">
                  {submitSuccess ? (
                    <div className="rounded-2xl border border-line bg-paper-raised p-6 text-center space-y-3">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <h4 className="font-display text-sm font-bold text-ink">送信が完了しました</h4>
                      <p className="text-xs text-ink-soft leading-relaxed">
                        お問い合わせありがとうございます。送信内容を確認の上、担当者より「wallai.support@gmail.com」より順次ご返信いたします。
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-ink-soft leading-relaxed mb-4">
                        サービスや契約に関するご質問など、以下のフォームよりお気軽にお問い合わせください。
                      </p>
                      {contactError && (
                        <div className="p-3 text-xs text-red-500 bg-red-50 rounded-xl border border-red-100 font-semibold">
                          ⚠️ {contactError}
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-ink">お名前</label>
                        <input
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="山田 太郎"
                          className="w-full rounded-xl border border-line bg-paper px-4 py-2 text-xs text-ink placeholder-ink-faint focus:border-clay focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-ink">メールアドレス</label>
                        <input
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="your-email@example.com"
                          className="w-full rounded-xl border border-line bg-paper px-4 py-2 text-xs text-ink placeholder-ink-faint focus:border-clay focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-ink">お問い合わせ種別</label>
                        <select
                          value={contactType}
                          onChange={(e) => setContactType(e.target.value)}
                          className="w-full rounded-xl border border-line bg-paper px-4 py-2 text-xs text-ink focus:border-clay focus:outline-none transition-colors"
                        >
                          <option value="製品について">製品について</option>
                          <option value="技術サポート">技術サポート</option>
                          <option value="料金・プラン">料金・プラン</option>
                          <option value="その他">その他</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-ink">件名</label>
                        <input
                          type="text"
                          required
                          value={contactSubject}
                          onChange={(e) => setContactSubject(e.target.value)}
                          placeholder="サービス内容についてのご質問"
                          className="w-full rounded-xl border border-line bg-paper px-4 py-2 text-xs text-ink placeholder-ink-faint focus:border-clay focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-ink">お問い合わせ内容</label>
                        <textarea
                          required
                          rows={4}
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          placeholder="ご質問、不具合、ご意見などを詳しくご記入ください。"
                          className="w-full rounded-xl border border-line bg-paper px-4 py-2 text-xs text-ink placeholder-ink-faint focus:border-clay focus:outline-none transition-colors resize-none"
                        />
                      </div>
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full cursor-pointer rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-paper hover:bg-clay disabled:bg-ink-faint disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          {isSubmitting ? (
                            <>
                              <svg className="animate-spin h-4 w-4 text-paper" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              送信中...
                            </>
                          ) : (
                            '送信する'
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="border-t border-line p-4 sm:p-5 flex justify-end bg-paper-raised">
              <button
                onClick={() => setModalType(null)}
                className="cursor-pointer rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-paper hover:bg-clay transition-all active:scale-95"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
