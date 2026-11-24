// 야화 — MY 안쪽 화면: 무료 리프 받기 · 포인트를 리프로(리뉴얼 1120 · spec-rest §5.4 · §5.5)
// 미션 지급·판정은 전부 서버(0147)가 한다. 보상 수량은 서버 미션 표(MISSIONS), 환전 비율은 POINTS_PER_LEAF.
// 시안의 '신뢰를 더해요' 인증 보상 · 친구 초대 보상은 지급 기능이 없어 숫자 없이 둔다(spec-rest §10 A-5).
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { colors } from '../../tokens';
import { Button, Card, DockArea, Icon, Row } from '../../ui';
import { MISSIONS, type MissionKey } from '../../lib/api';
import { useMissionsToday } from '../../lib/missions';
import { exchangePointsToLeaf, POINTS_PER_LEAF } from '../../lib/hooks';
import { appNav } from '../../lib/appNav';
import { getCurrentUserId, previewActions, previewSelectors, usePreview } from '../../lib/previewStore';
import { LoungeWrite } from '../../screens/LoungeWrite';
import { Screen, GroupTitle, KV, Sub, WalletLeaf } from './ui';
import { IpIcon } from './icons';
import { CfInput } from './BadgeCredentials';
import type { MyNav } from './nav';

const amountOf = (k: MissionKey) => MISSIONS.find((m) => m.key === k)?.amount ?? 0;

// 미션 한 줄(.rw-row) — 제목 15/21 500 + 보상 줄(잎 14 + 13 600) | 오른쪽 상태 13 500 + 꺾쇠. 끝낸 줄은 흐리게 + '완료'
function MissionRow({ title, reward, note, state, done, first, onPress }: { title: string; reward: number; note?: string; state: string; done: boolean; first?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={done} accessibilityRole="button" accessibilityLabel={`${title}, ${reward}리프${done ? ', 오늘 받음' : ''}`} style={{ marginHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
      {/* 줄 사이 선 — 높이에 더하지 않고 윗줄 마지막 1px에 겹친다(시안 box-shadow 0 -1px) */}
      {!first && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -1, height: 1, backgroundColor: colors.line }} />}
      <View style={{ flex: 1, opacity: done ? 0.45 : 1 }}>
        <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '500', letterSpacing: -0.2, color: colors.text }}>{title}</Text>
        <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <WalletLeaf size={14} color={colors.accent} />
          <Text style={{ fontSize: 13, lineHeight: 22.75, fontWeight: '600', color: colors.accentStrong }}>+{reward}</Text>
          {!!note && <Text style={{ fontSize: 13, lineHeight: 22.75, color: colors.sub }}> · {note}</Text>}
        </View>
      </View>
      {done ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IpIcon name="check" size={14} color={colors.inverseStrong} stroke={2} />
          <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.inverseStrong }}>완료</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.textSecondary }}>{state}</Text>
          <Icon name="chevron-right" size={20} color={colors.mute} />
        </View>
      )}
    </Pressable>
  );
}

export function RewardsScreen({ nav }: { nav: MyNav }) {
  // 비회원은 조회하지 않는다 → 전부 '안 받음'으로 보인다
  const got = useMissionsToday(!!getCurrentUserId()).data ?? {};
  const has = (k: MissionKey) => k in got;
  const [writeOpen, setWriteOpen] = useState(false);
  const likes = Number(has('like1')) + Number(has('like2'));
  const done = Object.keys(got).length;
  const goDeck = () => appNav({ kind: 'tab', tab: 'affinity' });
  return (
    <Screen title="무료 리프 받기" onBack={nav.back}>
      <GroupTitle top={0} bottom={4} right={<Text style={{ fontSize: 12, lineHeight: 20, fontWeight: '500', color: colors.textSecondary }}><Text style={{ fontWeight: '600', color: colors.text }}>{done}</Text> / {MISSIONS.length} 완료</Text>}>오늘의 미션</GroupTitle>
      <Card>
        <MissionRow first title="호감 보내기" reward={amountOf('like1')} note="하루 처음 두 명, 각각" state={`${likes} / 2명`} done={likes === 2} onPress={goDeck} />
        <MissionRow title="오늘의 인연 8명 확인" reward={amountOf('deck_read')} state="보러 가기" done={has('deck_read')} onPress={goDeck} />
        <MissionRow title="커뮤니티 첫 글" reward={amountOf('post')} state="시작하기" done={has('post')} onPress={() => setWriteOpen(true)} />
        <MissionRow title="커뮤니티 첫 댓글" reward={amountOf('comment')} state="시작하기" done={has('comment')} onPress={() => appNav({ kind: 'tab', tab: 'lounge' })} />
      </Card>
      <Text style={{ marginTop: 12, fontSize: 12, lineHeight: 18, color: colors.mute }}>매일 0시에 새로 시작해요.</Text>

      <GroupTitle top={24}>신뢰를 더해요</GroupTitle>
      <Card>
        <Row kind="group" first label="배지 · 인증으로 신뢰를 더해요" onPress={() => nav.push('badgeManage')} />
      </Card>

      <GroupTitle top={24}>친구 초대</GroupTitle>
      <Card pad={16}>
        <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '500', color: colors.text }}>친구에게 야화 알려 주기</Text>
        <Sub style={{ marginTop: 4 } as any}>초대한 친구의 인연 프로필이 처음 등록되면 리프를 드리는 혜택을 준비하고 있어요. 준비가 끝나면 알림으로 알려드릴게요.</Sub>
        <Button size="M" block disabled label="준비 중" style={{ marginTop: 16 }} />
      </Card>
      <LoungeWrite open={writeOpen} onClose={() => setWriteOpen(false)} />
    </Screen>
  );
}

// 포인트를 리프로 — 바꿀 포인트를 적으면 받을 리프 · 남는 포인트를 미리 보여 준다
export function ConvertScreen({ nav }: { nav: MyNav }) {
  const qc = useQueryClient();
  const points = usePreview(previewSelectors.points);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const typed = parseInt(text, 10) || 0;
  const leaf = Math.floor(typed / POINTS_PER_LEAF);
  const after = Math.max(0, points - leaf * POINTS_PER_LEAF);
  const ok = leaf >= 1 && typed <= points;

  async function exchange() {
    if (busy) return;
    if (!ok) { previewActions.showToast(`보유 포인트 안에서 ${POINTS_PER_LEAF}포인트 이상 입력해주세요.`, 2400); return; }
    setBusy(true);
    try {
      const r = await exchangePointsToLeaf(leaf);
      if (!r.ok) { previewActions.showToast(r.reason, 2600); return; }
      // 서버 잔액(리프·포인트)을 다시 받아 화면 갱신
      qc.invalidateQueries({ queryKey: ['me'] });
      previewActions.showToast('리프로 바꿨어요.', 2400);
      nav.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="포인트를 리프로"
      onBack={nav.back}
      gnb={false}
      dock={<DockArea note={ok || !text ? undefined : typed > points ? '보유 포인트보다 많아요' : `${POINTS_PER_LEAF}포인트부터 바꿀 수 있어요`}><Button size="sheet" block label="리프로 바꾸기" disabled={!ok} loading={busy} onPress={exchange} /></DockArea>}
    >
      <Sub>{`매장에서 적립한 포인트를 리프로 바꿔 쓸 수 있어요. ${POINTS_PER_LEAF}포인트 → 1리프 · 남은 포인트는 보관돼요.`}</Sub>
      <GroupTitle top={20} right={<Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>보유 {points.toLocaleString()}P</Text>}>사용할 포인트</GroupTitle>
      <CfInput
        value={text}
        onChangeText={(v) => setText(v.replace(/\D/g, '').slice(0, 9))}
        keyboardType="number-pad"
        placeholder="0"
        accessibilityLabel="사용할 포인트"
        right={(
          <Pressable onPress={() => setText(String(points))} accessibilityRole="button" style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.muted, justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.text }}>전액</Text>
          </Pressable>
        )}
      />
      <View style={{ marginTop: 24, gap: 14 }}>
        <KV label="받을 리프" value={`${leaf.toLocaleString()}리프`} />
        <KV label="환전 후 포인트" value={`${after.toLocaleString()}P`} />
      </View>
    </Screen>
  );
}
