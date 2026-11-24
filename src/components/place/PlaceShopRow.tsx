// 쿠폰함 매장 한 줄 — 작은 티켓 카드(시안 coupon-box B안, 11-23). 흰 카드 · 1px 선 · 모서리 14 · 높이 약 72.
//  왼쪽(누르면 매장 자세히): [대표 사진 48 · 모서리 10] 분류 · 거리 12 → 매장 이름 15/21 600 → 혜택 13/19 500 강조 파랑(쿠폰이 없으면 주소 글자-연)
//  오른쪽(쿠폰이 있을 때만, 폭 68): 세로 점선 + 위아래 홈 너머 '쿠폰 받기'(받는 중 · 받음 ✓ — 받음을 누르면 내 쿠폰)
//  쿠폰이 없으면 오른쪽 칸 대신 꺾쇠. 카드 테두리는 따로 그린 선이라 홈(흰 원)이 그 위를 덮는다.
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '../../tokens';
import { Icon } from '../../ui';
import type { Store } from '../../data/mock';
import type { StoreCouponInfo } from '../../lib/hooks';
import { SmartImg } from '../SmartImg';
import { DashedLine } from './ui';

const R = 14;       // 카드 모서리
const SIDE = 68;    // 오른쪽 받기 칸 폭
const NOTCH = 12;   // 위아래 홈 지름

// 지도 이동·실시간 갱신·폴링마다 목록 전체가 다시 그려지지 않게 memo — 콜백은 매장 id를 받는 고정 함수로 넘긴다
export const PlaceShopRow = React.memo(function PlaceShopRow({ s, photo, distance, coupon, busy, onOpen, onCoupon }: {
  s: Store;
  photo?: string;         // 매장 대표 사진(네이버에서 가져온 첫 장)
  distance?: string;      // 내 위치를 알 때만
  coupon?: StoreCouponInfo;
  busy?: boolean;         // 이 매장 쿠폰 받는 중
  onOpen: (id: string) => void;    // 왼쪽 — 매장 자세히
  onCoupon: (id: string) => void;  // 오른쪽 — 쿠폰 받기 / 받음(내 쿠폰 보기)
}) {
  const meta = [s.cat, distance].filter(Boolean).join(' · ');
  return (
    <View style={{ flexDirection: 'row', borderRadius: R, backgroundColor: colors.surface, overflow: 'hidden' }}>
      <Pressable
        onPress={() => onOpen(s.id)}
        accessibilityRole="button"
        accessibilityLabel={`${s.name} 매장 자세히`}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: pressed ? colors.bgSoft : 'transparent' })}
      >
        <View style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.muted }}>
          {!!photo && <SmartImg src={photo} width={200} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {!!meta && <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: colors.mute }}>{meta}</Text>}
          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>{s.name}</Text>
          {coupon
            ? <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 13, lineHeight: 19, fontWeight: '500', color: colors.accentStrong }}>{coupon.title}</Text>
            : !!s.address && <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 13, lineHeight: 19, color: colors.mute }}>{s.address}</Text>}
        </View>
        {!coupon && <Icon name="chevron-right" size={20} color={colors.chevron} />}
      </Pressable>
      {coupon && (
        <Pressable
          onPress={() => onCoupon(s.id)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={coupon.owned ? `${s.name} 받은 쿠폰 보기` : `${s.name} 쿠폰 받기`}
          accessibilityState={{ disabled: !!busy, busy: !!busy }}
          style={({ pressed }) => ({ width: SIDE, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: pressed ? colors.btnTextPress : 'transparent' })}
        >
          {busy ? (
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.mute }}>받는 중</Text>
          ) : coupon.owned ? (
            <>
              <Icon name="check" size={16} color={colors.mute} />
              <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.mute }}>받음</Text>
            </>
          ) : (
            <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.btnSecondaryFg, textAlign: 'center' }}>{'쿠폰\n받기'}</Text>
          )}
        </Pressable>
      )}
      {/* 카드 테두리 — 홈보다 먼저 그려 홈이 선을 끊는다 */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: R, borderWidth: 1, borderColor: colors.line }} />
      {coupon && (
        <>
          <DashedLine vertical style={{ position: 'absolute', right: SIDE - 0.75, top: NOTCH / 2 + 2, bottom: NOTCH / 2 + 2 }} />
          <View pointerEvents="none" style={{ position: 'absolute', right: SIDE - NOTCH / 2, top: -NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg }} />
          <View pointerEvents="none" style={{ position: 'absolute', right: SIDE - NOTCH / 2, bottom: -NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg }} />
        </>
      )}
    </View>
  );
});
