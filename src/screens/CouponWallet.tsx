// 야화 — 받은 쿠폰(리뉴얼 1120 · spec-rest §4.3, 시안 coupon-box 개선안 11-23). 상태 칩 3개(이름 + 개수) + 한 줄 쿠폰 카드(누르면 쿠폰 자세히)
// + 목록 끝 '주변 혜택 더 보기'.
// 가입 환영 쿠폰 팝업 · 쿠폰 도착 알림의 도착지도 이 화면이다. 사용은 쿠폰 자세히 → 직원 확인(확인코드)으로 이어진다.
import React, { useState } from 'react';
import { Animated, Pressable, View, Text } from 'react-native';
import { colors, radius } from '../tokens';
import { BreathingDots, Icon, usePress } from '../ui';
import { SmartImg } from '../components/SmartImg';
import { Screen } from '../components/my/ui';
import { myParams, type MyNav } from '../components/my/nav';
import { PlaceButton, smallText } from '../components/place/ui';
import { useCouponList, couponState, couponDateLine, dDay, STATE_LABEL, type CouponState, type UserCoupon } from '../components/place/coupons';
import { fontSerif } from '../tokens';

const STATES: CouponState[] = ['usable', 'used', 'expired'];
const EMPTY: Record<CouponState, string> = { usable: '아직 받은 쿠폰이 없어요.', used: '사용 완료 쿠폰이 없어요.', expired: '기간이 지난 쿠폰이 없어요.' };

// 상태 칩(.fx-tabs) — 높이 36 · 좌우 14 · 알약 · 14/21 500. 고른 것: 진회색 + 흰 글자, 나머지: 회색 카드 + 글자-보조
//  개수는 이름 뒤에 조금 흐리게
function StateTab({ label, count, selected, onPress }: { label: string; count: number; selected: boolean; onPress: () => void }) {
  const press = usePress(0.96);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={`${label} ${count}장`}>
      <Animated.View style={[{ height: 36, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: selected ? colors.inverseStrong : colors.bgSoft }, press.scaleStyle]}>
        <Text style={{ fontSize: 14, lineHeight: 21, fontWeight: '500', color: selected ? colors.inverse : colors.textSecondary }}>
          {label}<Text style={{ opacity: 0.7, fontVariant: ['tabular-nums'] }}>{` ${count}`}</Text>
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// 한 줄 쿠폰 카드 — 흰 카드 · 1px 선 · 모서리 16: [매장 사진 48] 매장 12 → 혜택 명조 16/24 → 기한 12(3일 안이면 장미색 D-n) + 꺾쇠
function CouponRow({ uc, store, photo, onPress }: { uc: UserCoupon; store: string; photo?: string; onPress: () => void }) {
  const state = couponState(uc);
  const dd = state === 'usable' ? dDay(uc.coupons?.valid_until) : null;
  const date = couponDateLine(uc);
  const title = uc.coupons?.title ?? '쿠폰';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${store} ${title} · ${date} · 쿠폰 자세히`}
      style={({ pressed }) => ({ marginTop: 8, paddingVertical: 14, paddingLeft: 14, paddingRight: 12, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? colors.bgSoft : colors.surface })}
    >
      <View style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', opacity: state === 'usable' ? 1 : 0.6 }}>
        {photo ? <SmartImg src={photo} width={200} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Text style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 20, color: colors.sub }}>야화</Text>}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: colors.mute }}>{store}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontFamily: fontSerif, fontSize: 16, lineHeight: 24, color: state === 'usable' ? colors.inverseStrong : colors.sub }}>{title}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, lineHeight: 16, color: dd?.soon ? colors.dueSoon : colors.sub, fontWeight: dd?.soon ? '600' : '400' }}>
          {dd?.soon ? `${date} · ${dd.label}` : date}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.chevron} />
    </Pressable>
  );
}

export function CouponWallet({ nav }: { nav: MyNav }) {
  const { list, isLoading, storeName, photoOf } = useCouponList();
  const [tab, setTab] = useState<CouponState>(myParams.couponTab);
  const pick = (s: CouponState) => { myParams.couponTab = s; setTab(s); };
  const shown = list.filter((uc) => couponState(uc) === tab);
  return (
    <Screen title="받은 쿠폰" onBack={nav.back}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {STATES.map((s) => (
          <StateTab key={s} label={STATE_LABEL[s]} count={list.filter((uc) => couponState(uc) === s).length} selected={tab === s} onPress={() => pick(s)} />
        ))}
      </View>
      {isLoading ? (
        <View style={{ paddingVertical: 48, alignItems: 'center' }}><BreathingDots /></View>
      ) : shown.length === 0 ? (
        <View style={{ paddingVertical: 48, alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 15, lineHeight: 22, color: colors.mute }}>{EMPTY[tab]}</Text>
          {tab === 'usable' && <Text style={smallText}>쿠폰함에서 마음에 드는 공간을 찾아보세요.</Text>}
        </View>
      ) : (
        shown.map((uc) => {
          const sid = uc.coupons?.store_id ?? null;
          return (
            <CouponRow
              key={uc.id}
              uc={uc}
              store={storeName(sid)}
              photo={photoOf(sid)}
              onPress={() => { myParams.userCouponId = uc.id; nav.push('myCouponDetail'); }}
            />
          );
        })
      )}
      <PlaceButton label="주변 혜택 더 보기" style={{ marginTop: 20 }} onPress={() => nav.push('place')} />
    </Screen>
  );
}
