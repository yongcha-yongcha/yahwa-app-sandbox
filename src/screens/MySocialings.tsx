// 야화 — 내 모임. 내가 만든 모임(대기 신청 수 표시)과 참여 신청한 모임(내 상태)을
// 한 곳에서 관리. 탭하면 상세로 이동해 승인/연락처 확인.
import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { NavBar } from '../components/atoms';
import { useMyGatherings, useCancelGatheringMutation } from '../lib/hooks';
import { previewActions } from '../lib/previewStore';
import type { MyGatheringItem } from '../lib/hooks';

// 모임이 끝났는지 — 취소/완료 상태이거나 시작 시각이 지난 것.
// 홈 노출 제외 기준(Gather.tsx)과 같은 규칙을 쓴다.
export function isGatheringClosed(item: { status: string; startAt: string | null }): boolean {
  if (item.status === 'cancelled' || item.status === 'done') return true;
  if (item.startAt && new Date(item.startAt).getTime() < Date.now()) return true;
  return false;
}

function StatusChip({ item }: { item: MyGatheringItem }) {
  // 종료된 모임은 상태를 먼저 알린다(홈에서는 빠지고 여기에만 남는다)
  if (item.status === 'cancelled') {
    return (
      <View style={{ backgroundColor: colors.bgSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.mute }}>취소됨</Text>
      </View>
    );
  }
  if (isGatheringClosed(item)) {
    return (
      <View style={{ backgroundColor: colors.bgSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.mute }}>마감</Text>
      </View>
    );
  }
  // 호스트: 대기 신청 수 강조 / 게스트: 내 승인 상태
  if (item.role === 'host') {
    if (item.pendingCount > 0) {
      return (
        <View style={{ backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>신청 {item.pendingCount}</Text>
        </View>
      );
    }
    return (
      <View style={{ backgroundColor: colors.bgSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.sub }}>확정 {item.memberCount}</Text>
      </View>
    );
  }
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    pending: { label: '승인 대기', bg: colors.bgSoft, fg: colors.sub },
    approved: { label: '참여 확정', bg: colors.primarySoft, fg: colors.primary },
    rejected: { label: '거절됨', bg: colors.bgSoft, fg: colors.mute },
  };
  const s = map[item.mySlotStatus ?? 'pending'] ?? map.pending;
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: s.fg }}>{s.label}</Text>
    </View>
  );
}

function Row({ item, onPress, onCancel, cancelling }: {
  item: MyGatheringItem; onPress: () => void;
  onCancel?: () => void; cancelling?: boolean;
}) {
  // 내가 만든 모임 중 아직 살아있는 것만 내릴 수 있다
  const canCancel = item.role === 'host' && item.status !== 'cancelled' && !isGatheringClosed(item);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icons.calendar size={18} color={colors.sub} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: colors.text }}>{item.title}</Text>
        <Text numberOfLines={1} style={{ fontSize: 11, color: colors.mute, marginTop: 2 }}>
          {[item.whenText, item.region ?? item.place].filter(Boolean).join(' · ') || '일정 미정'}
        </Text>
      </View>
      <StatusChip item={item} />
      <Icons.chev size={18} color={colors.mute} />
    </Pressable>
    {canCancel && (
      <Pressable
        onPress={onCancel}
        disabled={cancelling}
        style={{ alignSelf: 'flex-start', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2, opacity: cancelling ? 0.5 : 1 }}
      >
        <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.danger }}>
          {cancelling ? '내리는 중…' : '모임 내리기'}
        </Text>
      </Pressable>
    )}
    </View>
  );
}

function Section({ title, items, onOpenGather, onCancel, cancellingId }: {
  title: string; items: MyGatheringItem[]; onOpenGather?: (id: string) => void;
  onCancel?: (item: MyGatheringItem) => void; cancellingId?: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.sub, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.surface }}>
        {items.map((it) => (
          <Row
            key={`${it.role}_${it.id}`}
            item={it}
            onPress={() => onOpenGather?.(it.id)}
            onCancel={onCancel ? () => onCancel(it) : undefined}
            cancelling={cancellingId === it.id}
          />
        ))}
      </View>
    </View>
  );
}

export function MySocialings({ onBack, onOpenGather }: { onBack?: () => void; onOpenGather?: (id: string) => void }) {
  const { data, isLoading } = useMyGatherings();
  const cancelMut = useCancelGatheringMutation();
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  function confirmCancel(item: MyGatheringItem) {
    const run = () => {
      setCancellingId(item.id);
      cancelMut.mutate(item.id, {
        onSuccess: () => { setCancellingId(null); previewActions.showToast('모임을 내렸어요', 2400); },
        onError: (e: any) => {
          setCancellingId(null);
          const msg = String(e?.message ?? '모임을 내리지 못했어요');
          if (Platform.OS === 'web') { try { window.alert(msg); } catch { /* ignore */ } }
          else Alert.alert('모임 내리기 실패', msg);
        },
      });
    };
    const q = `"${item.title}" 모임을 내릴까요?\n참여 신청한 분들에게 취소 알림이 가고, 홈에서 더 이상 보이지 않아요.`;
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm(q)) run();
      return;
    }
    Alert.alert('모임 내리기', q, [
      { text: '취소', style: 'cancel' },
      { text: '내리기', style: 'destructive', onPress: run },
    ]);
  }

  const hosting = data?.hosting ?? [];
  const joined = data?.joined ?? [];
  const empty = !isLoading && hosting.length === 0 && joined.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSoft }}>
      <NavBar
        title="내 모임"
        left={
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            <Icons.chevLeft size={22} color={colors.text} />
          </Pressable>
        }
      />
      {isLoading ? (
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : empty ? (
        <View style={{ paddingVertical: 60, alignItems: 'center', gap: 8 }}>
          <Icons.calendar size={28} color={colors.mute} />
          <Text style={{ fontSize: 12.5, color: colors.mute }}>아직 모임이 없어요</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Section
            title="내가 만든 모임"
            items={hosting}
            onOpenGather={onOpenGather}
            onCancel={confirmCancel}
            cancellingId={cancellingId}
          />
          <Section title="참여 신청한 모임" items={joined} onOpenGather={onOpenGather} />
        </ScrollView>
      )}
    </View>
  );
}
