// 야화 — 프로필 교환 신청 시트(리뉴얼 1120, spec-rest §3.5). 글 상세에서 남의 얼굴 · 닉네임을 누르면 뜬다.
// 상대와의 상태에 따라 네 가지: 처음(사람 카드 + 사용할 리프 카드 + [취소 · 요청하기]) · 이미 보냄([닫기]) · 상대가 먼저 보냄 / 교환한 사이([교환 탭으로]).
// 가격은 서버 기준(요청 10리프 남녀 공통 — useLeafPricing, 수락 안 돼도 반환 없음을 미리 알린다). 리프가 모자라면 오른쪽 버튼이 "리프 충전하기".
// 시트(Modal) 안에서는 토스트 · 충전 창을 띄우지 않는다 — 먼저 닫고 나서 처리한다.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, radius } from '../../tokens';
import { BottomSheet, Button, SheetHeader } from '../../ui';
import { previewActions, requireAuth } from '../../lib/previewStore';
import { useLeafPricing } from '../../lib/leafPricing';
import { HIDE_IOS_CURRENCY } from '../../lib/flags';
import { useRequestProfileExchangeMutation } from '../../lib/hooks';
import { LeafConfirmSheet } from '../letters/ui';
import { CommunityAvatar } from '../CommunityAvatar';

export type ExchangeAskTarget = {
  kind: 'post' | 'comment';
  id: string;                       // 글 id 또는 댓글 id(서버 요청 대상)
  nick: string;
  gender?: 'M' | 'F' | null;
  face: number;                     // 글에서 보던 얼굴 번호
  state: 'none' | 'sent' | 'received' | 'accepted';
};

function PersonCard({ t }: { t: ExchangeAskTarget }) {
  // 사람 카드(.an-card) — 회색 카드 · 모서리 16 · 안쪽 24/16/20 · 가운데: 얼굴 64 → 6 → 닉네임 16/22.4 600 → 누구인지 12/16.8
  return (
    <View style={{ marginBottom: 16, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 20, borderRadius: radius.card, backgroundColor: colors.bgSoft, alignItems: 'center' }}>
      <CommunityAvatar gender={t.gender} size={64} variant={t.face} />
      <Text numberOfLines={1} style={{ marginTop: 12, fontSize: 16, lineHeight: 22.4, fontWeight: '600', color: colors.text }}>{t.nick}</Text>
      <Text style={{ marginTop: 6, fontSize: 12, lineHeight: 16.8, color: colors.mute }}>{t.kind === 'post' ? '이 글의 글쓴이' : '이 글에 이야기를 남긴 사람'}</Text>
    </View>
  );
}

export function ExchangeRequestSheet({ target, onClose, onOpenExchanges }: {
  target: ExchangeAskTarget | null;
  onClose: () => void;
  onOpenExchanges?: () => void;
}) {
  const exchangeMut = useRequestProfileExchangeMutation();
  const cost = useLeafPricing().prices.exchange;
  // 닫히는 움직임 동안에도 내용이 남아 있게 마지막 대상을 들고 있는다
  const [last, setLast] = useState(target);
  if (target && target !== last) setLast(target);
  const t = target ?? last;
  if (!t) return null;

  function send() {
    onClose();
    if (!requireAuth('프로필 교환은 로그인 후 가능해요')) return;
    exchangeMut.mutate(t!.kind === 'comment' ? { commentId: t!.id } : { postId: t!.id }, {
      onSuccess: () => previewActions.showToast('교환 요청을 보냈어요. 수락하면 알려 드릴게요.'),
      onError: (e: any) => {
        if (e?.code === '53100' || String(e?.message ?? '').includes('insufficient')) {
          previewActions.openPaywall(cost, '프로필 교환 요청에는 리프가 필요해요');
        } else {
          previewActions.showToast(e?.message ?? '요청하지 못했어요', 2400);
        }
      },
    });
  }

  if (t.state === 'none') {
    return (
      <LeafConfirmSheet
        open={!!target}
        onClose={onClose}
        title="프로필 교환을 신청할까요?"
        desc={`상대가 수락하면 서로의 인연 프로필을 볼 수 있어요.${HIDE_IOS_CURRENCY ? '' : ' 상대가 수락하지 않아도 리프는 돌려드리지 않아요.'}`}
        cost={cost}
        confirmLabel="요청하기"
        onConfirm={send}
        shortReason="프로필 교환 요청에는 리프가 필요해요"
      >
        <PersonCard t={t} />
      </LeafConfirmSheet>
    );
  }
  const sent = t.state === 'sent';
  return (
    <BottomSheet open={!!target} onClose={onClose}>
      <SheetHeader
        title={sent ? '교환 요청을 보냈어요' : t.state === 'received' ? '먼저 요청이 와 있어요' : '교환한 사이예요'}
        desc={sent ? '상대가 수락하면 알림으로 알려 드려요.' : t.state === 'received' ? '교환 탭에서 수락하면 서로의 인연 프로필이 열려요.' : '교환 탭에서 서로의 인연 프로필을 볼 수 있어요.'}
      />
      <PersonCard t={t} />
      {sent
        ? <Button label="닫기" variant="gray" size="sheet" block onPress={onClose} />
        : <Button label="교환 탭으로" size="sheet" block onPress={() => { onClose(); onOpenExchanges?.(); }} />}
    </BottomSheet>
  );
}
