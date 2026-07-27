'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  FREE_GENERATIONS,
  HOUSE_TYPES,
  PAINT_COLORS,
  PAINT_PARTS,
  PAINT_PRESETS,
  PaintPreset,
} from '@/lib/constants';
import { useLocalStorage } from '@/lib/useLocalStorage';
import CompareSlider from './CompareSlider';
import Reveal from './Reveal';

const LOADING_STATUSES = [
  '住宅の立体構造を解析中...',
  '外壁・屋根・サッシの領域をマッピング中...',
  '指定カラーの塗料テクスチャを調合中...',
  '光の反射と影をレンダリング中...',
];

export default function Studio() {
  // Input states
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedHouseType, setSelectedHouseType] = useState<string | null>(null);

  // Selected colors for each paint part
  const [partColors, setPartColors] = useState<{ [key: string]: string }>({
    all_walls: 'ivory',
    first_floor: 'ivory',
    second_floor: 'ivory',
    accent: 'natural_beige',
    roof: 'charcoal_black',
    trim: 'creamy_white',
  });

  // Current active paint part being colored
  const [selectedPart, setSelectedPart] = useState<string>('all_walls');

  // Lighting environment condition
  const [lighting, setLighting] = useState<string>('daylight');

  // Drag and drop status
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorSampleInputRef = useRef<HTMLInputElement>(null);

  // Custom color sample state
  const [customColor, setCustomColor] = useState<{ hex: string; base64: string | null }>({
    hex: '',
    base64: null,
  });

  // Local storage properties for credits & plans
  const [freeCountRaw, setFreeCountRaw] = useLocalStorage(
    'wallai_free_generations',
    String(FREE_GENERATIONS)
  );
  const freeCount = Number(freeCountRaw);
  const [userPlan] = useLocalStorage('wallai_user_plan', 'free');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [byokModeRaw] = useLocalStorage('wallai_byok_mode', 'false');
  const byokMode = byokModeRaw === 'true';
  const [byokKey] = useLocalStorage('wallai_byok_key', '');

  // Generation status
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [generationTime, setGenerationTime] = useState<number | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // プレビュー拡大鏡（Magnifier）ステート
  const [showPreviewMagnifier, setShowPreviewMagnifier] = useState(false);
  const [[previewX, previewY], setPreviewXY] = useState([0, 0]);
  const [[previewWidth, previewHeight], setPreviewDimensions] = useState([0, 0]);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    const rect = previewContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xCoord = e.clientX - rect.left;
    const yCoord = e.clientY - rect.top;
    if (xCoord >= 0 && xCoord <= rect.width && yCoord >= 0 && yCoord <= rect.height) {
      setPreviewXY([xCoord, yCoord]);
      setPreviewDimensions([rect.width, rect.height]);
      setShowPreviewMagnifier(true);
    } else {
      setShowPreviewMagnifier(false);
    }
  };

  // Syncing changes on mount or storage trigger
  useEffect(() => {
    const handleSync = () => {
      // Sync logic if needed
    };
    window.addEventListener('storage', handleSync);
    return () => window.removeEventListener('storage', handleSync);
  }, []);

  // Preset click handler (1-tap application)
  const applyPreset = (preset: PaintPreset) => {
    setPartColors({
      all_walls: preset.colors.main,
      first_floor: preset.colors.main,
      second_floor: preset.colors.main,
      accent: preset.colors.accent,
      roof: preset.colors.roof,
      trim: preset.colors.trim,
    });
    setResultImage(null);
    setErrorMsg(null);
  };

  // Reset all paint colors, custom color, and result image
  const resetPaintStates = () => {
    setPartColors({
      all_walls: '',
      first_floor: '',
      second_floor: '',
      accent: '',
      roof: '',
      trim: '',
    });
    setCustomColor({
      hex: '',
      base64: null,
    });
    setResultImage(null);
    setErrorMsg(null);
    setSelectedPart('all_walls');
  };

  // Preset house click handler
  const selectPresetHouse = (imageUrl: string, houseId: string) => {
    setUploadedImage(imageUrl);
    setSelectedHouseType(houseId);
    resetPaintStates();
  };

  // Image preprocess downscale
  const handleImageFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('画像ファイル（JPG、PNG、WebP）のみアップロードできます。');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('ファイルサイズは10MBを超過できません。');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 1024;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setUploadedImage(canvas.toDataURL('image/jpeg', 0.85));
          setSelectedHouseType(null); // custom file
          resetPaintStates();
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Color sample image preprocess and average color extraction
  const handleColorSampleFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('画像ファイルのみアップロードできます。');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('色サンプルファイルは5MBを超過できません。');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = 50;
          canvas.height = 50;
          ctx.drawImage(img, 0, 0, 50, 50);
          const imgData = ctx.getImageData(0, 0, 50, 50).data;
          
          let r = 0, g = 0, b = 0;
          const count = imgData.length / 4;
          for (let i = 0; i < imgData.length; i += 4) {
            r += imgData[i];
            g += imgData[i+1];
            b += imgData[i+2];
          }
          
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          
          const rgbToHex = (red: number, green: number, blue: number) => {
            return '#' + [red, green, blue].map(x => {
              const hexStr = x.toString(16);
              return hexStr.length === 1 ? '0' + hexStr : hexStr;
            }).join('');
          };
          
          const hex = rgbToHex(r, g, b);
          
          // Generate a small base64 representation for API transmission (e.g. 100x100 jpeg)
          const miniCanvas = document.createElement('canvas');
          miniCanvas.width = 100;
          miniCanvas.height = 100;
          const miniCtx = miniCanvas.getContext('2d');
          if (miniCtx) {
            miniCtx.drawImage(img, 0, 0, 100, 100);
            const sampleBase64 = miniCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            
            setCustomColor({ hex, base64: sampleBase64 });
            
            // Assign custom color to currently selected part
            setPartColors((prev) => ({ ...prev, [selectedPart]: 'custom_sample' }));
            setResultImage(null);
            setErrorMsg(null);
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      setErrorMsg('シミュレーションの元となる住宅写真をアップロードまたは選択してください。');
      return;
    }

    // Limit check for non-BYOK and non-pro users
    if (!byokMode && userPlan !== 'pro' && freeCount <= 0) {
      setShowUpgradeModal(true);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setResultImage(null);
    setLoadingStep(0);

    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % LOADING_STATUSES.length);
    }, 2500);
    const startTime = Date.now();

    const isPremiumUser = userPlan === 'pro' || (userPlan === 'quota' && freeCount > 0);
    const hasCustomSample = Object.values(partColors).includes('custom_sample');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'omit',
        body: JSON.stringify({
          image: uploadedImage,
          houseTypeId: selectedHouseType || 'custom',
          partColors,
          lighting,
          byokKey: byokMode ? byokKey.trim() : null,
          isPremiumUser,
          userPlan,
          quotaRemaining: freeCount,
          customSampleColor: hasCustomSample && customColor.hex ? {
            hex: customColor.hex,
            base64: customColor.base64,
          } : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '塗装シミュレーションの生成に失敗しました。');
      }

      setResultImage(`data:image/png;base64,${data.image}`);
      setGenerationTime(Number(((Date.now() - startTime) / 1000).toFixed(1)));

      setTimeout(() => {
        document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      if (!byokMode && userPlan !== 'pro') {
        const nextCount = Math.max(0, freeCount - 1);
        setFreeCountRaw(String(nextCount));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'シミュレーション生成中にエラーが発生しました。もう一度お試しください。'
      );
    } finally {
      clearInterval(interval);
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;

    try {
      const parts = resultImage.split(';base64,');
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);

      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }

      const blob = new Blob([uInt8Array], { type: contentType });
      const blobUrl = URL.createObjectURL(blob);

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.open(blobUrl, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `wallai_simulation_${selectedHouseType || 'custom'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (e) {
      console.error('Download wrapper failed, using fallback:', e);
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(
          `<img src="${resultImage}" style="max-width: 100%; height: auto;" alt="完成イメージ" />`
        );
      }
    }
  };

  // Triggers print layout for color card PDF
  const handlePrintPDF = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const resetResult = () => {
    setResultImage(null);
    setGenerationTime(null);
  };

  const resetAll = () => {
    setUploadedImage(null);
    setSelectedHouseType(null);
    setGenerationTime(null);
    resetPaintStates();
  };

  // Color lookup helper
  const getColorDetails = (partKey: string) => {
    let colorId = partColors[partKey];
    // If getting color for first_floor or second_floor and all_walls is active, inherit all_walls color
    if ((partKey === 'first_floor' || partKey === 'second_floor') && partColors.all_walls) {
      colorId = partColors.all_walls;
    }

    if (!colorId) {
      return {
        id: 'none',
        label: '指定なし（変更しない）',
        hex: 'transparent',
        jpma: '未指定',
        prompt: 'do not alter, keep original paint color',
      };
    }
    if (colorId === 'custom_sample') {
      return {
        id: 'custom_sample',
        label: 'カスタム抽出色',
        hex: customColor.hex || '#CCCCCC',
        jpma: 'カスタム',
        prompt: `custom color matching hex code ${customColor.hex || '#CCCCCC'} and reference sample`,
      };
    }
    return PAINT_COLORS.find((c) => c.id === colorId) || PAINT_COLORS[0];
  };

  return (
    <section id="studio" className="w-full scroll-mt-16 border-t border-line">
      {/* ── Hidden Print Section (PDF Report Layout) ── */}
      <div className="hidden print:block fixed inset-0 bg-white z-50 p-10 text-black font-sans">
        <div className="flex items-center justify-between border-b-2 border-gray-300 pb-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">🏠 WallAI カラー配色カルテ</h1>
            <p className="text-sm text-gray-500 mt-1">AI Exterior Paint Color Chart & Simulation Report</p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>生成日時: {new Date().toLocaleDateString('ja-JP')}</p>
            <p>シミュレーションID: WA-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 my-8">
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-2">【施工前 (Original Photo)】</p>
            {uploadedImage && (
              <div className="relative aspect-[4/3] w-full border border-gray-200 rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedImage} alt="施工前" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-2">【AI塗装完成イメージ (After Simulation)】</p>
            {resultImage && (
              <div className="relative aspect-[4/3] w-full border border-gray-200 rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultImage} alt="完成イメージ" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden mt-6">
          <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
            <h3 className="text-base font-bold text-gray-800">選定カラーシミュレーション詳細</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-100/50 text-gray-600 font-semibold">
                <th className="px-5 py-3">塗装部位</th>
                <th className="px-5 py-3">選定色（標準またはカスタムカラー）</th>
                <th className="px-5 py-3">カラーコード</th>
                <th className="px-5 py-3">色サンプル</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-700">
              {PAINT_PARTS.map((part) => {
                const color = getColorDetails(part.id);
                return (
                  <tr key={part.id}>
                    <td className="px-5 py-4 font-medium">{part.label}</td>
                    <td className="px-5 py-4">{color.label}</td>
                    <td className="px-5 py-4 font-mono font-bold text-gray-900">{color.jpma}</td>
                    <td className="px-5 py-4">
                      <div
                        className="h-6 w-16 rounded border border-gray-300"
                        style={{ backgroundColor: color.hex }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 text-xs text-gray-500">
          <div>
            <p className="font-bold mb-1 text-gray-700">■ 環境設定・ライティング</p>
            <p>設定時間帯: {lighting === 'daylight' ? '昼の太陽光' : lighting === 'sunset' ? '夕焼け・西日' : '曇り空'}</p>
          </div>
          <div>
            <p className="font-bold mb-1 text-gray-700">■ ご注意点</p>
            <p>※本書はAIによる視覚的シミュレーション結果です。実際の塗料の発色や陰影は、外壁素材や気候条件によって異なります。塗装工事の最終確認には、塗装業者が提示する実際のカラーチップ（塗料サンプル板）をご参照ください。</p>
          </div>
        </div>

        <div className="mt-16 text-center text-xs text-gray-400 border-t border-gray-100 pt-6">
          <p>© WallAI Painting Simulator. All rights reserved.</p>
        </div>
      </div>

      {/* ── Regular Interactive Web App Section ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-clay">
              COLOR SIMULATOR
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
              AIカラーシミュレーション
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-ink-soft">
              わずか数ステップで外壁の塗り替え後イメージをAIが作成します。
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* ── LEFT COLUMN: Input Control Panel (lg:col-span-5) ── */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* STEP 1: Upload House Image */}
              <div className="rounded-3xl border border-line bg-paper-raised p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-clay text-xs font-bold text-paper">
                    1
                  </span>
                  <h3 className="font-display text-sm font-bold text-ink">住宅写真のアップロード</h3>
                </div>

                {!uploadedImage ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    className={`flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 ${
                      isDragOver
                        ? 'scale-[0.99] border-clay bg-clay-soft'
                        : 'border-line-strong bg-paper hover:border-ink-faint'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
                        e.target.value = '';
                      }}
                    />
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-ink-faint"
                    >
                      <path
                        d="M3 16V21H21V16M12 3L12 16M12 3L7 8M12 3L17 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-ink">
                        ファイルをドラッグ＆ドロップ、またはクリックしてアップロード
                      </p>
                      <p className="mt-1 text-[10px] text-ink-faint">
                        PNG・JPG・WebP、最大10MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line">
                    <Image
                      src={uploadedImage}
                      alt="シミュレーション対象の住宅写真"
                      fill
                      className="object-cover animate-fade-in"
                    />
                    <button
                      onClick={resetAll}
                      title="写真をリセット"
                      className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-ink/75 text-paper backdrop-blur-sm transition-all duration-200 hover:bg-ink active:scale-95"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Preset sample buildings */}
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-ink-soft mb-2 uppercase tracking-wider">
                    建物サンプル（クリックでお試し可能）
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {HOUSE_TYPES.map((house) => (
                      <button
                        key={house.id}
                        type="button"
                        onClick={() => selectPresetHouse(house.image, house.id)}
                        className={`group relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border p-1 text-center transition-all ${
                          selectedHouseType === house.id
                            ? 'border-clay bg-clay-soft'
                            : 'border-line bg-paper hover:border-line-strong'
                        }`}
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md">
                          <Image
                            src={house.image}
                            alt={house.label}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                        <span className="text-[9px] font-semibold text-ink leading-tight">
                          {house.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* STEP 2: Paint Parts & Palette */}
              <div className="rounded-3xl border border-line bg-paper-raised p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-clay text-xs font-bold text-paper">
                    2
                  </span>
                  <h3 className="font-display text-sm font-bold text-ink">塗り替え部位＆カラーパレット</h3>
                </div>

                {/* Accordion Paint Parts */}
                <div className="space-y-3">
                  {PAINT_PARTS.map((part) => {
                    const isPartOpen = selectedPart === part.id;
                    const currentColor = getColorDetails(part.id);
                    
                    return (
                      <div key={part.id} className="border border-line rounded-2xl bg-paper overflow-hidden shadow-2xs transition-all">
                        {/* Accordion Header */}
                        <button
                          type="button"
                          onClick={() => setSelectedPart(isPartOpen ? '' : part.id)}
                          className={`w-full flex items-center justify-between p-3.5 cursor-pointer transition-colors ${
                            isPartOpen ? 'bg-paper-raised' : 'hover:bg-paper-raised/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clay/90 text-[9px] font-bold text-paper">
                              {part.id === 'all_walls' ? 'W' : part.id === 'first_floor' ? '1' : part.id === 'second_floor' ? '2' : part.id === 'accent' ? 'A' : part.id === 'roof' ? 'R' : 'T'}
                            </span>
                            <span className="text-xs font-bold text-ink">{part.label}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-3.5 w-3.5 rounded-full border shadow-inner ${
                                currentColor.id === 'none' ? 'border-dashed border-ink-faint bg-transparent' : 'border-ink/10'
                              }`}
                              style={{ backgroundColor: currentColor.id === 'none' ? undefined : currentColor.hex }}
                            />
                            <span className="text-[10px] font-bold text-ink-soft">
                              {currentColor.label}
                              {(part.id === 'first_floor' || part.id === 'second_floor') && partColors.all_walls && (
                                <span className="text-[9px] text-clay ml-1 font-semibold">(全体優先)</span>
                              )}
                            </span>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`text-ink-faint transition-transform duration-200 ${isPartOpen ? 'rotate-180' : ''}`}
                            >
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </div>
                        </button>

                        {/* Accordion Content (Color Palette) */}
                        {isPartOpen && (
                          <div className="p-4 border-t border-line bg-paper-raised/50 animate-fade-in">
                            <p className="text-[9px] font-bold text-ink-faint mb-2.5 uppercase tracking-wider">
                              カラーを選択してください（同じ色をもう一度押すと選択解除）
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5 gap-2">
                              {/* 🚫 指定なし（元画像のまま）Option */}
                              <button
                                type="button"
                                onClick={() => {
                                  setPartColors((prev) => {
                                    const next = { ...prev, [part.id]: '' };
                                    if (part.id === 'all_walls') {
                                      next.first_floor = '';
                                      next.second_floor = '';
                                    } else if (part.id === 'first_floor' || part.id === 'second_floor') {
                                      next.all_walls = '';
                                    }
                                    return next;
                                  });
                                  setResultImage(null);
                                  setErrorMsg(null);
                                }}
                                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-all ${
                                  !partColors[part.id]
                                    ? 'border-clay bg-clay-soft shadow-sm scale-102 font-bold'
                                    : 'border-line bg-paper hover:border-line-strong'
                                }`}
                              >
                                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-ink-faint bg-transparent text-[10px] text-ink-soft">
                                  🚫
                                </span>
                                <div className="flex flex-col items-center min-h-[30px] justify-center">
                                  <span className="text-[9px] font-bold text-ink leading-tight">
                                    指定なし
                                  </span>
                                  <span className="text-[8px] font-semibold text-ink-faint leading-none mt-0.5">
                                    元画像のまま
                                  </span>
                                </div>
                              </button>

                              {/* Custom Sample Color Swatch (Show second if extracted) */}
                              {customColor.hex && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const isSelected = partColors[part.id] === 'custom_sample';
                                    const targetValue = isSelected ? '' : 'custom_sample';
                                    setPartColors((prev) => {
                                      const next = { ...prev, [part.id]: targetValue };
                                      if (part.id === 'all_walls') {
                                        next.first_floor = targetValue;
                                        next.second_floor = targetValue;
                                      } else if (part.id === 'first_floor' || part.id === 'second_floor') {
                                        next.all_walls = '';
                                      }
                                      return next;
                                    });
                                    setResultImage(null);
                                    setErrorMsg(null);
                                  }}
                                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-all ${
                                    partColors[part.id] === 'custom_sample'
                                      ? 'border-clay bg-clay-soft shadow-sm scale-102 font-bold'
                                      : 'border-line bg-paper hover:border-line-strong'
                                  }`}
                                >
                                  <span
                                    className="h-7 w-7 rounded-full border border-ink/10 shadow-inner"
                                    style={{ backgroundColor: customColor.hex }}
                                  />
                                  <div className="flex flex-col items-center min-h-[30px] justify-center">
                                    <span className="text-[9px] font-bold text-ink leading-tight">
                                      カスタム抽出色
                                    </span>
                                    <span className="text-[8px] font-semibold text-ink-faint leading-none mt-0.5">
                                      {customColor.hex}
                                    </span>
                                  </div>
                                </button>
                              )}

                              {/* Standard Swatches */}
                              {PAINT_COLORS.map((color) => {
                                const isColorSelected = partColors[part.id] === color.id;
                                return (
                                  <button
                                    key={color.id}
                                    type="button"
                                    onClick={() => {
                                      const isSelected = partColors[part.id] === color.id;
                                      const targetValue = isSelected ? '' : color.id;
                                      setPartColors((prev) => {
                                        const next = { ...prev, [part.id]: targetValue };
                                        if (part.id === 'all_walls') {
                                          next.first_floor = targetValue;
                                          next.second_floor = targetValue;
                                        } else if (part.id === 'first_floor' || part.id === 'second_floor') {
                                          next.all_walls = '';
                                        }
                                        return next;
                                      });
                                      setResultImage(null);
                                      setErrorMsg(null);
                                    }}
                                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-all ${
                                      isColorSelected
                                        ? 'border-clay bg-clay-soft shadow-sm scale-102 font-bold'
                                        : 'border-line bg-paper hover:-translate-y-0.5 hover:border-line-strong'
                                    }`}
                                  >
                                    <span
                                      className="h-7 w-7 rounded-full border border-ink/10 shadow-inner"
                                      style={{ backgroundColor: color.hex }}
                                    />
                                    <div className="flex flex-col items-center min-h-[30px] justify-center">
                                      <span className="text-[9px] font-bold text-ink leading-tight">
                                        {color.label}
                                      </span>
                                      <span className="text-[8px] font-semibold text-ink-faint leading-none mt-0.5">
                                        {color.jpma}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 明示的なカラーサンプル画像アップロード枠 */}
                <div className="mt-6 rounded-2xl border-2 border-dashed border-line-strong bg-paper p-5 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => colorSampleInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          colorSampleInputRef.current?.click();
                        }
                      }}
                      className="w-full flex flex-col items-center justify-center gap-2.5 py-4 cursor-pointer hover:bg-paper-raised rounded-xl transition-all"
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint">
                        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4M12 4L8 8M12 4v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div>
                        <p className="text-[11px] font-bold text-ink">
                          または希望のカラーサンプル画像をアップロード
                        </p>
                        <p className="text-[9px] text-ink-soft leading-normal mt-1 max-w-xs mx-auto">
                          塗料見本や希望する色の写真をドラッグ＆ドロップ、またはクリックしてアップロード。自動で色味を抽出してシミュレーションに適用します。
                        </p>
                      </div>
                    </div>

                    <input
                      ref={colorSampleInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleColorSampleFile(e.target.files[0]);
                        e.target.value = '';
                      }}
                    />

                    {customColor.hex && (
                      <div className="w-full mt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-paper-raised p-3 rounded-xl border border-line animate-fade-in text-left">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-7 w-7 rounded-full border border-ink/10 shadow-inner"
                            style={{ backgroundColor: customColor.hex }}
                          />
                          <div>
                            <p className="text-[9px] font-bold text-ink-soft leading-none">
                              自動抽出カラー
                            </p>
                            <p className="text-[10px] font-mono font-bold text-clay mt-1 leading-none">
                              {customColor.hex}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 select-none">
                          <span className="text-[9px] font-bold text-ink-soft">
                            適用部位:
                          </span>
                          <select
                            value={selectedPart}
                            onChange={(e) => {
                              const newPart = e.target.value;
                              setSelectedPart(newPart);
                              setPartColors((prev) => {
                                const next = { ...prev, [newPart]: 'custom_sample' };
                                if (newPart === 'all_walls') {
                                  next.first_floor = 'custom_sample';
                                  next.second_floor = 'custom_sample';
                                } else if (newPart === 'first_floor' || newPart === 'second_floor') {
                                  next.all_walls = '';
                                }
                                return next;
                              });
                              setResultImage(null);
                              setErrorMsg(null);
                            }}
                            className="text-[10px] bg-paper border border-line rounded px-2.5 py-1.5 font-bold text-ink focus:outline-none cursor-pointer"
                          >
                            {PAINT_PARTS.map((part) => (
                              <option key={part.id} value={part.id}>
                                {part.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Presets (1-tap setup) */}
                <div className="border-t border-line mt-6 pt-5">
                  <p className="text-[10px] font-bold text-ink-soft mb-2.5 uppercase tracking-wider">
                    人気の配色プリセット（1タップ適用）
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {PAINT_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="rounded-lg border border-line bg-paper px-3 py-2.5 text-left hover:border-line-strong hover:bg-paper-raised transition-all"
                      >
                        <span className="text-[10px] font-bold text-ink block">{preset.label}</span>
                        <span className="text-[8px] text-ink-faint mt-0.5 leading-tight block">
                          {preset.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* STEP 3: Lighting and Environment */}
              <div className="rounded-3xl border border-line bg-paper-raised p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-clay text-xs font-bold text-paper">
                    3
                  </span>
                  <h3 className="font-display text-sm font-bold text-ink">天候・ライティング設定</h3>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-paper p-1 rounded-xl border border-line">
                  {[
                    { id: 'daylight', label: '☀️ 昼の太陽光' },
                    { id: 'sunset', label: '🌅 夕焼け・西日' },
                    { id: 'overcast', label: '☁️ 曇り空' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setLighting(option.id);
                        setResultImage(null);
                        setErrorMsg(null);
                      }}
                      className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                        lighting === option.id
                          ? 'bg-ink text-paper shadow-sm'
                          : 'text-ink-soft hover:bg-paper-raised hover:text-ink'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 4: Submit Button & Status */}
              <div className="flex flex-col gap-3">
                {errorMsg && (
                  <div
                    role="alert"
                    className="rounded-xl border border-clay/30 bg-clay-soft p-4 text-xs leading-relaxed text-clay-deep"
                  >
                    {errorMsg}
                  </div>
                )}

                {/* Quota notification */}
                {!byokMode && (
                  <div className="flex justify-between items-center text-xs font-semibold text-ink-soft bg-paper-raised px-4 py-3 rounded-xl border border-line select-none shadow-sm">
                    <span>シミュレーター残数:</span>
                    {userPlan === 'pro' ? (
                      <span className="text-clay font-bold animate-pulse">PROプラン（使い放題）</span>
                    ) : userPlan === 'quota' ? (
                      <span className="text-ink font-bold text-ink-strong">追加プラン（残り {freeCount}回）</span>
                    ) : (
                      <span className="text-ink-soft">無料体験（残り {freeCount}回）</span>
                    )}
                  </div>
                )}

                {/* Action button */}
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isLoading || !uploadedImage}
                  className={`w-full rounded-2xl py-4 text-base font-bold transition-all duration-300 ${
                    isLoading || !uploadedImage
                      ? 'cursor-not-allowed bg-sand text-ink-faint'
                      : 'cursor-pointer bg-ink text-paper shadow-lift hover:-translate-y-0.5 hover:bg-clay active:scale-[0.99]'
                  }`}
                >
                  {isLoading ? 'シミュレーション作成中...' : '塗装シミュレーションを実行'}
                </button>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Interactive Before-After Preview (lg:col-span-7) ── */}
            <div className="lg:col-span-7 flex flex-col gap-6 lg:sticky lg:top-24">
              <div className="rounded-3xl border border-line bg-paper-raised p-6 shadow-sm min-h-[300px] flex flex-col items-center justify-center">
                {isLoading ? (
                  /* ── LOADING SCREEN ── */
                  <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
                    <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
                      <div className="absolute inset-0 animate-ping rounded-full bg-clay/20" />
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-clay border-t-transparent" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-ink">
                      塗装完成イメージを生成中
                    </h3>
                    <p className="mt-2 text-xs text-ink-soft animate-pulse max-w-xs">
                      {LOADING_STATUSES[loadingStep]}
                    </p>
                  </div>
                ) : resultImage && uploadedImage ? (
                  /* ── SUCCESS COMPARISON SCREEN ── */
                  <div className="w-full flex flex-col gap-6 animate-fade-in">
                    <div className="text-center">
                      <span className="rounded-full bg-clay px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-paper">
                        Simulation Ready
                      </span>
                      <h3 className="font-display mt-4 text-xl font-bold text-ink">
                        外壁塗装シミュレーション完了
                      </h3>
                      <p className="mt-1 text-xs text-ink-faint">
                        生成時間: {generationTime}秒
                      </p>
                    </div>

                    <CompareSlider
                      beforeSrc={uploadedImage}
                      afterSrc={resultImage}
                      beforeAlt="塗装前（元の写真）"
                      afterAlt="完成イメージ"
                    />

                    {/* Paint configuration summary badges */}
                    <div className="bg-paper p-4 rounded-2xl border border-line text-xs flex flex-col gap-2">
                      <p className="font-bold text-ink mb-1">■ 選択されたカラー配色</p>
                      <div className="grid grid-cols-2 gap-2">
                        {PAINT_PARTS.map((part) => {
                          const color = getColorDetails(part.id);
                          return (
                            <div key={part.id} className="flex items-center gap-2 bg-paper-raised p-2 rounded-lg border border-line">
                              <span
                                className="h-4 w-4 rounded-full border border-ink/10"
                                style={{ backgroundColor: color.hex }}
                              />
                              <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-ink-soft">{part.label}</span>
                                <span className="text-[10px] font-bold text-ink leading-tight">
                                  {color.label} ({color.jpma})
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Control Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="w-full sm:w-auto cursor-pointer text-center rounded-full bg-ink px-6 py-3.5 text-xs font-bold text-paper shadow-lift transition-all hover:bg-clay active:scale-95 whitespace-nowrap"
                      >
                        高画質PNGを保存
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintPDF}
                        className="w-full sm:w-auto cursor-pointer text-center rounded-full bg-clay text-paper px-6 py-3.5 text-xs font-bold shadow-lift transition-all hover:bg-ink active:scale-95 whitespace-nowrap"
                      >
                        配色カルテ（PDF）を印刷・保存
                      </button>
                      <button
                        type="button"
                        onClick={resetResult}
                        className="w-full sm:w-auto cursor-pointer text-center rounded-full border border-line-strong bg-paper px-6 py-3.5 text-xs font-bold text-ink transition-all hover:border-ink active:scale-95"
                      >
                        別の色を試す
                      </button>
                    </div>
                  </div>
                ) : uploadedImage ? (
                  /* ── UPLOADED IMAGE LOADED, AWAITING RUN SCREEN ── */
                  <div className="w-full flex flex-col items-center justify-center text-center gap-4 py-8 animate-fade-in">
                    <div
                      ref={previewContainerRef}
                      onMouseMove={handlePreviewMouseMove}
                      onMouseEnter={() => setShowPreviewMagnifier(true)}
                      onMouseLeave={() => setShowPreviewMagnifier(false)}
                      className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border border-line shadow-sm cursor-zoom-in select-none"
                    >
                      <Image
                        src={uploadedImage}
                        alt="元の住宅写真"
                        fill
                        className="object-cover"
                        draggable={false}
                      />

                      {/* 🔍 拡大ルーペ（PCホバー環境専用） */}
                      {showPreviewMagnifier && (
                        <div
                          className="absolute pointer-events-none rounded-full border-2 border-paper shadow-lg bg-paper hidden lg:block"
                          style={{
                            width: '140px',
                            height: '140px',
                            top: `${previewY - 70}px`,
                            left: `${previewX - 70}px`,
                            zIndex: 30,
                            backgroundImage: `url('${uploadedImage}')`,
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: `${previewWidth * 2.5}px ${previewHeight * 2.5}px`,
                            backgroundPosition: `${-previewX * 2.5 + 70}px ${-previewY * 2.5 + 70}px`,
                          }}
                        />
                      )}
                    </div>
                    <div className="max-w-xs mt-2">
                      <h4 className="text-xs font-bold text-ink">住宅写真セット完了</h4>
                      <p className="text-[10px] text-ink-soft mt-1 leading-relaxed">
                        STEP 2で各部位の色を選び、STEP 3で時間帯を指定してから「塗装シミュレーションを実行」ボタンを押してください。
                      </p>
                    </div>
                  </div>
                ) : (
                  /* ── COMPLETELY EMPTY INITIAL STATE ── */
                  <div className="text-center py-16 max-w-sm flex flex-col items-center">
                    <div className="h-12 w-12 rounded-2xl bg-paper border border-line flex items-center justify-center text-ink-faint shadow-inner mb-4">
                      🏠
                    </div>
                    <h3 className="font-display text-sm font-bold text-ink">
                      塗装完成イメージをここに表示
                    </h3>
                    <p className="mt-2 text-2xs text-ink-soft leading-relaxed">
                      左のパネルから住宅の写真をアップロードするか、建物サンプルをクリックしてシミュレーションを開始してください。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Upgrade Limit Check Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-line bg-paper p-6 text-center shadow-lift">
            <h3 className="font-display text-lg font-bold text-ink">無料体験回数を使い切りました</h3>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">
              WallAIを継続してご利用いただくには、生成クレジットのご購入、または無制限Proプランへの加入をご検討ください。
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <a
                href="#pricing"
                onClick={() => setShowUpgradeModal(false)}
                className="rounded-full bg-ink py-3 text-xs font-bold text-paper hover:bg-clay transition-all block"
              >
                料金プランを見る
              </a>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="rounded-full border border-line bg-paper-raised py-3 text-xs font-bold text-ink-soft hover:text-ink transition-all"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
