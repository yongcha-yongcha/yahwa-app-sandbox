// 야화 — 커뮤니티 이용수칙(리뉴얼 1120, spec-rest §3.8 · §9.1 · §9.3-3 — 안내 글 화면)
// 머리 줄 "이용수칙" → 회색 안내 한 줄 → 항목 9개(번호 12 600 글자-연 → 제목 16 600 → 설명 14/22.4 글자-보조, 항목 사이 1px 선) → 아래 고정 주 버튼 "확인했어요".
// '확인했어요'를 누르면 서버(users.community_guide_ack_at, 0175)에 기록한다 — 서버 함수가 없으면 이 기기에 남긴다.
import React from 'react';
import { View, ScrollView } from 'react-native';
import { colors, layout } from '../../tokens';
import { Button, DockArea, T, TopBar } from '../../ui';
import { getCurrentUserId } from '../../lib/previewStore';
import { ackCommunityGuide } from '../../lib/communityApi';
import { PageModal } from './PageModal';

const RULES: [string, string][] = [
  ['익명은 함께 지켜요', '본인이나 다른 사람을 알아볼 수 있는 얼굴 사진, 프로필 캡처, 신상 추측은 올리지 말아 주세요. 약한 블러나 필터로 얼굴이 식별되는 사진도 포함돼요.'],
  ['개인 연락처는 공개하지 않아요', '전화번호·카카오톡 ID·SNS 계정·오픈채팅 링크를 게시하거나 요구하지 말아 주세요. 프로필 교환 후 인연의 편지 기능을 이용해 주세요.'],
  ['광고와 거래는 삼가 주세요', '홍보 링크, 추천인 코드, 상품 판매와 구인 글은 올릴 수 없어요. 제휴 매장 혜택은 플레이스에서 확인해 주세요.'],
  ['금전 요구와 사기를 금지해요', '송금·대출·투자 권유, 허위 수익 인증 등 금전 피해를 일으키는 글과 댓글은 금지해요.'],
  ['서로를 존중해요', '욕설, 특정인을 겨냥한 비방, 혐오·차별 표현, 성희롱과 다툼을 부추기는 행동은 삼가 주세요.'],
  ['성적 노출은 올릴 수 없어요', '나체, 성적 부위를 강조한 사진·음성, 성적 행위 묘사, 성매매를 유도하는 내용은 게시할 수 없어요.'],
  ['불편하거나 위험한 이미지는 피해 주세요', '피·상처 등 유혈 이미지, 잔혹한 장면, 폭력이나 자해를 부추기는 내용은 올릴 수 없어요.'],
  ['내가 만든 이야기로 참여해요', '타인의 사진·음성 도용, 사칭, 반복 게시와 공감·댓글을 강요하는 글은 삼가 주세요.'],
  ['문제가 보이면 신고해 주세요', '글과 댓글의 메뉴에서 신고할 수 있어요. 위반 내용은 확인 후 삭제되거나 이용이 제한될 수 있어요. 직접 다투기보다 신고로 알려 주세요.'],
];

export function CommunityGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  function confirm() {
    const uid = getCurrentUserId();
    if (uid) void ackCommunityGuide(uid);
    onClose();
  }
  return (
    <PageModal open={open} onRequestClose={onClose}>
      <TopBar title="이용수칙" onBack={onClose} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 16, paddingHorizontal: layout.gutter, paddingBottom: 24 }}>
        <T v="body3" color={colors.mute} style={{ lineHeight: 20, marginBottom: 4 }}>글·사진·음성·댓글 모두 같은 기준으로 이용해 주세요.</T>
        {RULES.map(([h, d], i) => (
          <View key={h} style={{ paddingVertical: 16, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <T v="label4" color={colors.mute} style={{ fontWeight: '600' }}>{String(i + 1).padStart(2, '0')}</T>
            <T v="heading4" style={{ marginTop: 4 }}>{h}</T>
            <T v="body2" color={colors.textSecondary} style={{ marginTop: 4, lineHeight: 22.4 }}>{d}</T>
          </View>
        ))}
      </ScrollView>
      <DockArea fade>
        <Button label="확인했어요" size="dock" onPress={confirm} />
      </DockArea>
    </PageModal>
  );
}
