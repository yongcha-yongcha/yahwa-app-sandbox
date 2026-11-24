// 야화 — 모임 생성 직후, 호스트 정산 정보가 아직 없으면 등록을 안내하는 바텀시트.
import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../tokens';
import { Icons } from '../icons';
import { Btn } from './atoms';
import { DraggableSheet } from './DraggableSheet';

export function SettlementPromptSheet({
  open, onClose, onRegisterNow,
}: {
  open: boolean;
  onClose: () => void;
  onRegisterNow: () => void;
}) {
  return (
    <DraggableSheet open={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icons.card size={22} color={colors.primary} />
        </View>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 14 }}>
          모임이 등록됐어요!
        </Text>
        <Text style={{ fontSize: 12.5, color: colors.sub, marginTop: 8, lineHeight: 19 }}>
          참가비 정산을 받으려면 정산 정보(계좌·주민등록번호·이메일)를 등록해야 해요.
        </Text>
        <View style={{ marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: colors.primarySoft, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Icons.info size={15} color={colors.danger} />
          <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '700', color: colors.danger, lineHeight: 17 }}>
            정산 정보를 등록하지 않으면 참가비가 입금되지 않아요.{'\n'}
            <Text style={{ fontWeight: '600', color: colors.sub }}>나중에 하려면 마이페이지 → "정산 정보 등록"에서 할 수 있어요.</Text>
          </Text>
        </View>
        <View style={{ marginTop: 20, gap: 10 }}>
          <Btn kind="primary" full size="lg" onPress={onRegisterNow}>지금 등록하기</Btn>
          <Btn kind="line" full size="lg" onPress={onClose}>나중에 할게요</Btn>
        </View>
      </View>
    </DraggableSheet>
  );
}
