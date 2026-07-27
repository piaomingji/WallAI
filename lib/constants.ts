// WallAI - AI House Exterior Painting Simulator Constants

export type HouseType = {
  id: string;
  label: string;
  image: string;
  prompt: string;
};

export type PaintColor = {
  id: string;
  label: string;
  hex: string;
  jpma: string;
  prompt: string;
};

export type PaintPart = {
  id: string;
  label: string;
  prompt: string;
};

export type PaintPreset = {
  id: string;
  label: string;
  desc: string;
  colors: {
    main: string;    // PaintColor ID
    accent: string;  // PaintColor ID
    roof: string;    // PaintColor ID
    trim: string;    // PaintColor ID
  };
};

export const HOUSE_TYPES: HouseType[] = [
  { id: 'japanese', label: '和風住宅', image: '/japanese_house.png', prompt: 'traditional Japanese style house exterior' },
  { id: 'western', label: '洋風住宅', image: '/western_house.png', prompt: 'classic Western suburban house exterior' },
  { id: 'modern', label: 'モダンスタイル', image: '/modern_house.png', prompt: 'modern minimalist luxury house exterior' },
  { id: 'apartment', label: 'アパート', image: '/apartment_house.png', prompt: 'low-rise residential apartment building exterior' },
];

export const PAINT_PARTS: PaintPart[] = [
  { id: 'first_floor', label: '1階の外壁', prompt: '1st floor exterior walls' },
  { id: 'second_floor', label: '2階の外壁', prompt: '2nd floor exterior walls' },
  { id: 'accent', label: 'アクセント部・ベランダ', prompt: 'balcony and accent sections' },
  { id: 'roof', label: '屋根', prompt: 'roof' },
  { id: 'trim', label: 'ドア・サッシ・雨樋・破風', prompt: 'doors, window frames, sashes, rain gutters, fascia boards, and trim' },
];

export const PAINT_COLORS: PaintColor[] = [
  { id: 'ivory', label: 'アイボリー', hex: '#FDFBF7', jpma: '25-92B', prompt: 'creamy ivory paint finish' },
  { id: 'natural_beige', label: 'ナチュラルベージュ', hex: '#E6D7C3', jpma: '19-80F', prompt: 'warm natural beige paint finish' },
  { id: 'light_gray', label: 'ライトグレー', hex: '#D1D5DB', jpma: 'N-75', prompt: 'modern light gray paint finish' },
  { id: 'medium_brown', label: 'ミディアムブラウン', hex: '#8B5A2B', jpma: '15-40H', prompt: 'rich medium brown earth tone paint finish' },
  { id: 'charcoal_gray', label: 'チャコールグレー', hex: '#4A4A4A', jpma: 'N-35', prompt: 'deep charcoal gray paint finish' },
  { id: 'charcoal_black', label: 'チャコールブラック', hex: '#222222', jpma: 'N-15', prompt: 'sleek charcoal black matte paint finish' },
  { id: 'navy_blue', label: 'ネイビーブルー', hex: '#1E293B', jpma: '75-30D', prompt: 'dark navy blue paint finish' },
  { id: 'olive_green', label: 'オリーブグリーン', hex: '#4B5320', jpma: '35-30D', prompt: 'muted olive green paint finish' },
  { id: 'terracotta', label: 'テラコッタ', hex: '#C25A3F', jpma: '09-50L', prompt: 'warm terracotta clay orange paint finish' },
  { id: 'creamy_white', label: 'クリーミーホワイト', hex: '#F9F6F0', jpma: '22-90C', prompt: 'clean creamy white paint finish' },
];

export const PAINT_PRESETS: PaintPreset[] = [
  {
    id: 'modern_preset',
    label: 'モダン',
    desc: 'ダークグレー × 木目/ホワイト',
    colors: {
      main: 'charcoal_gray',
      accent: 'creamy_white',
      roof: 'charcoal_black',
      trim: 'charcoal_black',
    },
  },
  {
    id: 'natural_preset',
    label: 'ナチュラル',
    desc: 'ベージュ × アイボリー',
    colors: {
      main: 'natural_beige',
      accent: 'ivory',
      roof: 'medium_brown',
      trim: 'creamy_white',
    },
  },
  {
    id: 'luxury_preset',
    label: '高級感',
    desc: 'ブラック × ダークブラウン',
    colors: {
      main: 'charcoal_black',
      accent: 'medium_brown',
      roof: 'charcoal_black',
      trim: 'charcoal_black',
    },
  },
];

export const FREE_GENERATIONS = 2;
export const DAILY_IP_LIMIT = 5;
