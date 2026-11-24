// 야화 티어 — 야화 매장 누적 결제액(원) 기준. 누적 추적은 추후(태그히어) 연동.
import type { ImageSourcePropType } from 'react-native';
export type TierKey = 'black' | 'diamond' | 'platinum' | 'gold' | 'red';

// 티어별 다이아 이모지 이미지 (assets). require는 정적이어야 하므로 맵으로 고정.
export const TIER_ICON: Record<TierKey, ImageSourcePropType> = {
  black: require('../../assets/blackdiamong.png'),
  diamond: require('../../assets/diamond.png'),
  platinum: require('../../assets/silver.png'),
  gold: require('../../assets/gold.png'),
  red: require('../../assets/red.png'),
};

export type TierInfo = {
  key: TierKey;
  label: string;
  color: string;            // 대표 색
  threshold: number;        // 누적 결제액(원)
  hiddenThreshold?: boolean; // 비공개(블랙 다이아몬드)
  leafBonusPct: number;     // 리프 구매 시 추가 적립 %
  benefits: string[];
  note?: string;
};

// 높은 등급 → 낮은 등급 순.
export const TIERS: TierInfo[] = [
  {
    key: 'black', label: '블랙 다이아몬드', color: '#111114', threshold: 100_000_000, hiddenThreshold: true,
    leafBonusPct: 10,
    benefits: ['리프 구매 시 10% 추가 적립', '전 지점 칵테일 무제한 (동반 1인까지)'],
    note: '3개월마다 갱신',
  },
  { key: 'diamond', label: '다이아몬드', color: '#4FC3F7', threshold: 5_000_000, leafBonusPct: 10,
    benefits: ['리프 구매 시 10% 추가 적립'] },
  { key: 'platinum', label: '플래티넘', color: '#9AA7BD', threshold: 2_000_000, leafBonusPct: 5,
    benefits: ['리프 구매 시 5% 추가 적립'] },
  { key: 'gold', label: '골드', color: '#E5B33E', threshold: 500_000, leafBonusPct: 3,
    benefits: ['리프 구매 시 3% 추가 적립'] },
  { key: 'red', label: '레드', color: '#F23E3E', threshold: 0, leafBonusPct: 0, benefits: [] },
];

export function tierOf(spend: number): TierInfo {
  for (const t of TIERS) {
    if (spend >= t.threshold) return t;
  }
  return TIERS[TIERS.length - 1];
}
