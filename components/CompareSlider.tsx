'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';

type CompareSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  /** LCP 対象(히어로 쇼케이스)일 때만 true */
  priority?: boolean;
  sizes?: string;
  className?: string;
};

/**
 * ビフォー/アフター比較スライダー（拡大鏡機能付き）
 */
export default function CompareSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  priority = false,
  sizes = '(max-width: 768px) 100vw, 896px',
  className = '',
}: CompareSliderProps) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // 拡大鏡（Magnifier）ステート
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [[x, y], setXY] = useState([0, 0]);
  const [[imgWidth, imgHeight], setImgSize] = useState([0, 0]);
  const [isHoveringLeft, setIsHoveringLeft] = useState(false);

  const moveTo = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, ratio)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
    setShowMagnifier(false); // ドラッグ中は非表示
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (draggingRef.current) {
      moveTo(e.clientX);
      setShowMagnifier(false);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const xCoord = e.clientX - rect.left;
    const yCoord = e.clientY - rect.top;

    // 画像の範囲内にある場合のみ拡大鏡を表示
    if (xCoord >= 0 && xCoord <= rect.width && yCoord >= 0 && yCoord <= rect.height) {
      setXY([xCoord, yCoord]);
      setImgSize([rect.width, rect.height]);
      
      // スライダーの境界線より左側にいるかどうかを判定
      const hoverRatio = (xCoord / rect.width) * 100;
      setIsHoveringLeft(hoverRatio < pos);
      setShowMagnifier(true);
    } else {
      setShowMagnifier(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') {
      setPos((p) => Math.max(0, p - step));
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      setPos((p) => Math.min(100, p + step));
      e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`group relative w-full aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-sand select-none touch-none cursor-ew-resize shadow-deep ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (draggingRef.current = false)}
      onPointerCancel={() => (draggingRef.current = false)}
      onMouseEnter={() => setShowMagnifier(true)}
      onMouseLeave={() => setShowMagnifier(false)}
    >
      {/* Before */}
      <Image
        src={beforeSrc}
        alt={beforeAlt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
        draggable={false}
      />
      <span className="absolute bottom-4 right-4 rounded-md bg-ink/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper backdrop-blur-sm">
        Before
      </span>

      {/* After — clip-path로 좌측 pos%만 노출 */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <Image
          src={afterSrc}
          alt={afterAlt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          draggable={false}
        />
        <span className="absolute bottom-4 left-4 rounded-md bg-clay px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper">
          After
        </span>
      </div>

      {/* 🔍 拡大鏡ルーペ（PCホバー環境専用） */}
      {showMagnifier && !draggingRef.current && (
        <div
          className="absolute pointer-events-none rounded-full border-2 border-paper shadow-lg bg-paper hidden lg:block"
          style={{
            width: '140px',
            height: '140px',
            top: `${y - 70}px`,
            left: `${x - 70}px`,
            zIndex: 30,
            backgroundImage: `url('${isHoveringLeft ? afterSrc : beforeSrc}')`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${imgWidth * 2.5}px ${imgHeight * 2.5}px`,
            backgroundPosition: `${-x * 2.5 + 70}px ${-y * 2.5 + 70}px`,
          }}
        />
      )}

      {/* ハンドる */}
      <div
        className="absolute inset-y-0 w-0.5 bg-paper shadow-[0_0_12px_rgba(33,27,19,0.4)]"
        style={{ left: `${pos}%`, zIndex: 10 }}
      >
        <button
          type="button"
          role="slider"
          aria-label="ビフォー・アフター比較スライダー"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onKeyDown={onKeyDown}
          className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-line bg-paper-raised text-ink shadow-deep transition-transform duration-200 group-hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-clay"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M4 3L1 7l3 4M10 3l3 4-3 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
