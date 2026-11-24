// 야화 — 사용 · 적립 내역(리뉴얼 1120 · spec-rest §5.3 · §9.4). 누적 합계 카드 → 묶음 '리프'(사용 + 무료 적립, 최신순) · '포인트'(매장별 적립 + 사용).
import React from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, radius } from '../tokens';
import { BreathingDots, Card } from '../ui';
import { useMySpendHistory, useMyStoreBalances, type ServerTransaction } from '../lib/hooks';
import { fetchMyLeafRewards } from '../lib/api';
import { Screen, GroupTitle, LedgerRow, EmptyLine, kstDate } from '../components/my/ui';
import type { MyNav } from '../components/my/nav';

const REASON_LABELS: Record<string, string> = {
  friend_connect: '호감 친구 연결',
  gather_join: '모임 참여',
  store_gender_stats: '매장 인원 조회',
};

export function labelFor(tx: ServerTransaction): string {
  const meta = tx.meta ?? {};
  const reason = (meta.reason as string) ?? (meta.feature as string) ?? null;
  if (reason && REASON_LABELS[reason]) return REASON_LABELS[reason];
  if (meta.target_profile_id) return '프로필 열람';
  if (tx.provider === 'taghere') return '태그히어 매장 결제';
  return '앱 내 사용';
}

export function currencyFor(tx: ServerTransaction): 'leaf' | 'point' {
  const meta = tx.meta ?? {};
  if (meta.currency === 'point') return 'point';
  if (meta.currency === 'leaf') return 'leaf';
  return tx.provider === 'taghere' ? 'point' : 'leaf';
}

// 무료 리프 적립 이름(미션 키 → 문구)
const MISSION_LABEL: Record<string, string> = {
  like1: '관심 보내기', like2: '관심 한 번 더', deck_read: '오늘의 인연 모두 읽기',
  post: '커뮤니티 첫 글 작성', comment: '커뮤니티 첫 댓글 작성',
};

// 누적 합계 한 칸 — 쿠폰함 요약 카드와 같은 모양
function Total({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 14 }}>
      <Text style={{ fontSize: 12, lineHeight: 17.4, color: colors.sub }}>{label}</Text>
      <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] }}>{value.toLocaleString()}</Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.sub }}>{unit}</Text>
      </View>
    </View>
  );
}

export function SpendHistory({ nav }: { nav: MyNav }) {
  const { data, isLoading } = useMySpendHistory();
  const rewardsQ = useQuery({ queryKey: ['my-leaf-rewards'], queryFn: fetchMyLeafRewards, staleTime: 10_000 });
  const stores = useMyStoreBalances().data ?? [];
  const spent = data ?? [];
  const totals = spent.reduce((acc, tx) => { acc[currencyFor(tx)] += Math.abs(tx.amount); return acc; }, { leaf: 0, point: 0 });
  // 리프: 사용 기록 + 무료 리프 적립 기록을 최신순으로 함께(1014)
  const leafRows = [...spent.filter((tx) => currencyFor(tx) === 'leaf'), ...(rewardsQ.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pointRows = spent.filter((tx) => currencyFor(tx) === 'point');
  return (
    <Screen title="사용 · 적립 내역" onBack={nav.back}>
      <View style={{ flexDirection: 'row', paddingVertical: 12, borderRadius: radius.cta, backgroundColor: colors.bgSoft }}>
        <Total label="누적 사용 리프" value={totals.leaf} unit="리프" />
        <View style={{ width: 1, backgroundColor: colors.line }} />
        <Total label="누적 사용 포인트" value={totals.point} unit="P" />
      </View>
      <GroupTitle top={28}>리프</GroupTitle>
      {isLoading ? <View style={{ paddingVertical: 24, alignItems: 'center' }}><BreathingDots /></View>
        : leafRows.length === 0 ? <EmptyLine>아직 내역이 없어요.</EmptyLine> : (
          <Card>
            {leafRows.map((tx, i) => (tx.amount > 0
              ? <LedgerRow key={tx.id} first={i === 0} title={MISSION_LABEL[(tx.meta as any)?.mission] ?? '무료 리프'} at={kstDate(tx.created_at, true)} amount={`+${tx.amount.toLocaleString()}`} />
              : <LedgerRow key={tx.id} first={i === 0} title={labelFor(tx as ServerTransaction)} at={kstDate(tx.created_at, true)} amount={`-${Math.abs(tx.amount).toLocaleString()}`} />))}
          </Card>
        )}
      <GroupTitle top={28}>포인트</GroupTitle>
      {stores.length + pointRows.length === 0 ? <EmptyLine>아직 내역이 없어요.</EmptyLine> : (
        <Card>
          {stores.map((b, i) => <LedgerRow key={b.storeId} first={i === 0} title={b.storeName} at={kstDate(b.syncedAt, true)} amount={`+${b.balance.toLocaleString()}`} />)}
          {pointRows.map((tx, i) => <LedgerRow key={tx.id} first={stores.length + i === 0} title={labelFor(tx)} at={kstDate(tx.created_at, true)} amount={`-${Math.abs(tx.amount).toLocaleString()}`} />)}
        </Card>
      )}
    </Screen>
  );
}
