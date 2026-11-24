// 야화 — 가입 환영 쿠폰 안내(리뉴얼 1120: 공용 바텀 시트 확인형, spec-shell §5.4 b-14).
// "신규 가입 자동" 쿠폰이 지급된 직후 첫 메인 화면에서 1회만 뜬다. 닫히는 움직임이 끝난 뒤에 부모에 알린다.
import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, dur } from '../tokens';
import { BottomSheet, Icon, SheetButtons, SheetHeader } from '../ui';

export function SignupCouponPopup({
  title,
  discountLabel,
  onGoWallet,
  onClose,
}: {
  title: string;
  discountLabel?: string | null;
  onGoWallet: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const after = useRef(onClose);
  const leave = (then: () => void) => { if (!open) return; after.current = then; setOpen(false); setTimeout(() => after.current(), dur.sheetOut); };
  return (
    <BottomSheet open={open} onClose={() => leave(onClose)}>
      <SheetHeader title="쿠폰이 지급되었어요" desc="쿠폰함에서 확인해 보세요." />
      {/* 지급된 쿠폰 — 회색 카드 한 줄: 이름 + 혜택, 오른쪽 '사용 가능' */}
      <Pressable
        onPress={() => leave(onGoWallet)}
        accessibilityRole="button"
        style={({ pressed }) => ({ marginBottom: 20, padding: 16, borderRadius: 16, backgroundColor: pressed ? colors.muted : colors.bgSoft, flexDirection: 'row', alignItems: 'center', gap: 12 })}
      >
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>{title}</Text>
          {discountLabel ? <Text numberOfLines={2} style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: colors.sub }}>{discountLabel}</Text> : null}
        </View>
        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.mute }}>사용 가능</Text>
        <Icon name="chevron-right" size={20} color={colors.mute} />
      </Pressable>
      <SheetButtons cancelLabel="나중에" onCancel={() => leave(onClose)} confirmLabel="쿠폰함 가기" onConfirm={() => leave(onGoWallet)} />
    </BottomSheet>
  );
}
