// 야화 — 쿠폰함 묶음이 같이 쓰는 쿠폰 계산과 '쿠폰 받기' 흐름(리뉴얼 1120 · spec-rest §4 · §9.2)
// 상태 계산은 예전 CouponWallet 그대로: 서버는 status를 'expired'로 바꾸지 않으니 기한(한국 날짜)이 지났으면 만료로 본다.
import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMyCoupons, useStores, useStoreCoupons, useDownloadStoreCouponMutation, type StoreCouponInfo } from '../../lib/hooks';
import { fetchMyCoupons } from '../../lib/api';
import { previewActions, requireAuth } from '../../lib/previewStore';
import { kstDate } from '../my/ui';
import { myParams, type MyNav } from '../my/nav';

export type UserCoupon = {
  id: string;
  coupon_id: string;
  status: 'active' | 'used' | 'expired';
  granted_at: string;
  used_at: string | null;
  coupons: {
    title: string;
    description: string | null;
    discount_label: string | null;
    valid_until: string | null;
    kind: string;
    store_id: string | null;
  } | null;
};
export type CouponState = 'usable' | 'used' | 'expired';
export const STATE_LABEL: Record<CouponState, string> = { usable: '사용 가능', used: '사용 완료', expired: '기간 만료' };

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const isExpired = (uc: UserCoupon) => uc.status === 'expired' || (!!uc.coupons?.valid_until && uc.coupons.valid_until.slice(0, 10) < kstToday());
export const isUsable = (uc: UserCoupon) => uc.status === 'active' && !isExpired(uc);
export const couponState = (uc: UserCoupon): CouponState => (isUsable(uc) ? 'usable' : uc.status === 'used' ? 'used' : 'expired');

// 기한 줄 — 사용 가능: 'YYYY. M. D.까지' / '기한 없음', 사용 완료: '사용일 …'
export function couponDateLine(uc: UserCoupon): string {
  if (uc.status === 'used' && uc.used_at) return `사용일 ${kstDate(uc.used_at)}`;
  const until = kstDate(uc.coupons?.valid_until);
  return until ? `${until}까지` : '기한 없음';
}

// 기한까지 남은 날(한국 날짜 기준, 오늘 끝나면 0) — 기한이 없으면 null
export function daysLeft(until: string | null | undefined): number | null {
  if (!until) return null;
  const end = Date.parse(until.slice(0, 10));
  if (isNaN(end)) return null;
  return Math.round((end - Date.parse(kstToday())) / 86_400_000);
}
// 남은 날 표시 — 'D-12' · 오늘 끝나면 '오늘까지'. soon: 3일 안(장미색으로 알린다)
export function dDay(until: string | null | undefined): { label: string; soon: boolean } | null {
  const d = daysLeft(until);
  if (d === null || d < 0) return null;
  return { label: d === 0 ? '오늘까지' : `D-${d}`, soon: d <= 3 };
}

// 매장 대표 사진(네이버에서 가져온 첫 장)
export const storePhoto = (s: any): string | undefined => ((s?.imageUrls ?? s?.image_urls ?? []) as string[]).filter(Boolean)[0];

// 내 쿠폰 + 매장 이름(매장 발행 쿠폰은 발행 매장에서만 쓴다 — 서버 0111)
export function useCouponList() {
  const { data, isLoading } = useMyCoupons();
  const storesQ = useStores();
  const list = (data ?? []) as unknown as UserCoupon[];
  const stores = (storesQ.data ?? []) as any[];
  const storeName = (id: string | null) => (id ? (stores.find((s) => s.id === id)?.name ?? '발행 매장 전용') : '야화 전 매장');
  const photoOf = (id: string | null) => (id ? storePhoto(stores.find((s) => s.id === id)) : undefined);
  return { list, isLoading, stores, storeName, photoOf };
}

const NONE: Record<string, StoreCouponInfo> = {};

// 매장 쿠폰 받기(하루 한 번) — 받으면 알림 한 줄과 함께 쿠폰 자세히로. 이미 받은 쿠폰이면 바로 쿠폰 자세히('내 쿠폰 보기').
// onCoupon은 매장 id를 받는 고정 함수(memo된 매장 카드에 그대로 넘긴다).
export function useStoreCouponFlow(nav: MyNav) {
  const qc = useQueryClient();
  const coupons = useStoreCoupons().data ?? NONE;
  const mut = useDownloadStoreCouponMutation();
  const live = useRef({ coupons, mut, nav });
  live.current = { coupons, mut, nav };

  const onCoupon = useCallback((storeId: string) => {
    const c = live.current.coupons[storeId];
    if (!c) return;
    if (!requireAuth('쿠폰을 받으려면 로그인해 주세요')) return;
    // 방금 받은 쿠폰을 내 쿠폰 목록에서 찾아 연다(쓸 수 있는 것 먼저). 못 찾으면 받은 쿠폰 화면으로
    const open = async () => {
      const mine = (await qc.fetchQuery({ queryKey: ['my-coupons'], queryFn: fetchMyCoupons }).catch(() => [])) as unknown as UserCoupon[];
      const same = mine.filter((x) => x.coupon_id === c.couponId);
      const uc = same.find(isUsable) ?? same[0];
      if (!uc) { live.current.nav.push('couponWallet'); return; }
      myParams.userCouponId = uc.id;
      live.current.nav.push('myCouponDetail');
    };
    if (c.owned) { void open(); return; }
    live.current.mut.mutate(storeId, {
      onSuccess: (r) => {
        if (r === 'granted' || r === 'already') {
          previewActions.showToast('쿠폰함에 담았어요.', 2600);
          void open();
        } else previewActions.showToast('지금은 받을 수 있는 쿠폰이 없어요.', 2600);
      },
      onError: () => previewActions.showToast('쿠폰을 받지 못했어요. 잠시 후 다시 시도해주세요.', 2200),
    });
  }, [qc]);

  // 받는 중인 매장만 '받는 중…'
  const busyStoreId = mut.isPending ? (mut.variables as string | undefined) : undefined;
  return { coupons, busyStoreId, onCoupon };
}
