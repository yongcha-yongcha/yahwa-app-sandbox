// 야화 — 소개 채움(리뉴얼 1120). MY 사진 둘레 링(%)과 프로필 수정의 채움 카드(n/6)가 같은 6칸을 센다.
// 칸: 대표 사진 · 사진 3장 · 기본 정보(필수 7개) · 음주 · 기본 소개 · 이야기 두 장
import { REQUIRED } from '../components/entry/DetailStep';
import { storyOk } from '../components/entry/StoryStep';

export type FillStep = 'photos' | 'details' | 'story';
export type FillSlot = { done: boolean; hint: string; step: FillStep };

export type FillInput = {
  photos: number;
  details: Partial<Record<(typeof REQUIRED)[number], unknown>>;
  drinking?: string | null;
  ideal?: string | null;
  extras?: { a?: string | null }[] | null;
};

export function fillSlots(p: FillInput): FillSlot[] {
  const missing = REQUIRED.filter((k) => !p.details[k]).length;
  return [
    { done: p.photos >= 1, hint: '대표 사진을 올리면 소개가 시작돼요.', step: 'photos' },
    { done: p.photos >= 3, hint: `사진 ${Math.max(1, 3 - p.photos)}장을 더 올리면 첫인상이 또렷해져요.`, step: 'photos' },
    { done: !missing, hint: '기본 정보를 채우면 추천이 더 정확해져요.', step: 'details' },
    { done: !!p.drinking, hint: '음주 여부를 알려 주면 대화가 편해져요.', step: 'details' },
    { done: storyOk(p.ideal ?? ''), hint: '기본 소개를 적으면 마음이 더 잘 닿아요.', step: 'story' },
    { done: (p.extras ?? []).filter((x) => storyOk(x.a ?? '')).length >= 2, hint: '이야기를 두 장 담으면 대화 거리가 생겨요.', step: 'story' },
  ];
}

export const fillRateOf = (p: FillInput) => {
  const s = fillSlots(p);
  return s.filter((x) => x.done).length / s.length;
};
