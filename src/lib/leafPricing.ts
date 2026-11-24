// 야화 — 리프 가격(리프 정책 v2, 마이그레이션 0187). 서버 get_leaf_pricing()이 기준 — 화면은 이 훅으로 같은 값을 읽는다.
// 서버 함수가 아직 없거나 불러오는 중이면 같은 표를 앱이 계산한다(남/여 · 2026-12-31 23:59 KST까지 이벤트가).
// 이벤트가는 일반편지 발송·답장과 특별편지 발송(바꾸기 차액 포함)에만. 추가 소개(2명 20) · 프로필 교환(10) · 사진 다시 보기(10)는 남녀 공통.
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { serverNow } from './deck';
import { usePreview, previewSelectors } from './previewStore';

export type LeafPriceKey = 'letter' | 'reply' | 'invite' | 'upgrade' | 'extra' | 'exchange' | 'mind_photo';
export type LeafPrices = Record<LeafPriceKey, number>;
export type LeafPricing = { event: boolean; prices: LeafPrices; normal: LeafPrices };

export const LEAF_EVENT_UNTIL = Date.parse('2027-01-01T00:00:00+09:00');
export const LEAF_EVENT_LABEL = '연말까지 오픈 특별가';

export function leafPriceTable(female: boolean, event: boolean): LeafPrices {
  const letter = female ? (event ? 5 : 15) : (event ? 15 : 45);
  const invite = female ? (event ? 8 : 25) : (event ? 25 : 70);
  return { letter, reply: letter, invite, upgrade: invite - letter, extra: 20, exchange: 10, mind_photo: 10 };
}

function localPricing(female: boolean): LeafPricing {
  const event = serverNow() < LEAF_EVENT_UNTIL;
  return { event, prices: leafPriceTable(female, event), normal: leafPriceTable(female, false) };
}

export function useLeafPricing(): LeafPricing {
  const female = usePreview(previewSelectors.myProfile)?.gender === 'F';
  const q = useQuery({
    queryKey: ['leaf-pricing', female],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LeafPricing | null> => {
      const { data, error } = await supabase.rpc('get_leaf_pricing' as never);
      if (error || !data) return null;  // 0187 적용 전이면 앱 표로
      const d = data as unknown as LeafPricing;
      return { event: !!d.event, prices: d.prices, normal: d.normal };
    },
  });
  return q.data ?? localPricing(female);
}
