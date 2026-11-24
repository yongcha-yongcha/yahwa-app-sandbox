// 야화 — 매장 상세(리뉴얼 1120 · spec-rest §4.2 · §9.2, 시안 coupon-box 개선안 11-23). 쌓이는 화면:
// 머리(매장 이름) → 사진 넘기기 → 분류 + 매장 이름(머리 제목이 스크롤로 가려져도 보이게) → 혜택 티켓(혜택 · 하루 한 번 · 사용 기한 · 이용 안내)
// → 정보 표(주소 + 복사 · 실시간 현황) → [지도에서 보기][길찾기]. 쿠폰이 있으면 '쿠폰 받기 / 내 쿠폰 보기'를 아래에 고정한다(하단 메뉴는 숨김).
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '../tokens';
import { BreathingDots, Button, DockArea, Icon } from '../ui';
import type { Store } from '../data/mock';
import { useStores } from '../lib/hooks';
import { SHOW_STORE_LIVE } from '../lib/flags';
import { copyText } from '../lib/clipboard';
import { previewActions } from '../lib/previewStore';
import { Screen, EmptyLine, kstDate } from '../components/my/ui';
import { myParams, type MyNav } from '../components/my/nav';
import { StorePhotos, StoreLiveRows, openDirections } from '../components/place/StoreInfo';
import { DetailRows, Ticket, TicketRow, smallText, ticketTitle } from '../components/place/ui';
import { useStoreCouponFlow } from '../components/place/coupons';

export function StoreDetail({ id, nav }: { id: string; nav: MyNav }) {
  const storesQ = useStores();
  const s = ((storesQ.data as Store[] | undefined) ?? []).find((x) => x.id === id);
  const { coupons, busyStoreId, onCoupon } = useStoreCouponFlow(nav);
  const coupon = coupons[id];

  if (!s) {
    return (
      <Screen title="매장" onBack={nav.back} gnb={false}>
        {storesQ.isLoading ? <View style={{ paddingTop: 40, alignItems: 'center' }}><BreathingDots /></View> : <EmptyLine>매장 정보를 찾을 수 없어요.</EmptyLine>}
      </Screen>
    );
  }

  const photos = ((s.imageUrls ?? (s as any).image_urls ?? []) as string[]).filter(Boolean).slice(0, 5);
  const address = s.address || s.region || '';
  const busy = busyStoreId === id;
  const until = kstDate(coupon?.validUntil);
  const note = coupon?.description?.trim();

  return (
    <Screen
      title={s.name}
      onBack={nav.back}
      gnb={false}
      // 아래 고정 버튼 위 흐림(48)이 맨 끝 버튼을 덮지 않게, 끝까지 내리면 내용이 흐림 위로 올라오도록 비운다
      contentStyle={coupon ? { paddingBottom: 48 } : undefined}
      dock={coupon ? (
        <DockArea fade>
          <Button size="sheet" block label={busy ? '받는 중…' : coupon.owned ? '내 쿠폰 보기' : '쿠폰 받기'} disabled={busy} onPress={() => onCoupon(id)} />
        </DockArea>
      ) : undefined}
    >
      {photos.length > 0 && <StorePhotos photos={photos} />}
      {/* 분류 + 매장 이름 */}
      <View style={{ marginTop: photos.length ? 16 : 0 }}>
        <Text style={{ fontSize: 13, lineHeight: 20, color: colors.mute }}>{s.cat}</Text>
        <Text accessibilityRole="header" style={{ marginTop: 2, fontSize: 22, lineHeight: 30, fontWeight: '600', color: colors.inverseStrong }}>{s.name}</Text>
      </View>
      {/* 야화 플레이스 혜택 — 티켓 */}
      {!!coupon && (
        <Ticket
          style={{ marginTop: 20 }}
          top={
            <>
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.sub }}>야화 플레이스 혜택</Text>
              <Text style={[ticketTitle, { marginTop: 8 }]}>{coupon.title}</Text>
              <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.sub }}>쿠폰은 하루 한 번 받을 수 있어요.</Text>
            </>
          }
          bottom={
            <>
              <TicketRow label="사용 기한">{until ? `${until}까지` : '기한 없음'}</TicketRow>
              {!!note && <TicketRow label="이용 안내">{note}</TicketRow>}
            </>
          }
        />
      )}
      <View style={{ marginTop: 20 }}>
        <DetailRows
          rows={[{
            label: '주소',
            value: address ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 13, lineHeight: 22.1, color: colors.text }}>{address}</Text>
                <Pressable
                  onPress={() => { void copyText(address); previewActions.showToast('주소를 복사했어요.'); }}
                  accessibilityRole="button"
                  accessibilityLabel="주소 복사"
                  hitSlop={{ top: 11, bottom: 11, left: 8, right: 8 }}
                  style={({ pressed }) => ({ height: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: 'center', backgroundColor: pressed ? colors.muted : colors.bgSoft })}
                >
                  <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.textSecondary }}>복사</Text>
                </Pressable>
              </View>
            ) : '주소 미등록',
          }]}
        />
        {SHOW_STORE_LIVE && <StoreLiveRows s={s} />}
      </View>
      <View style={{ marginTop: 20, flexDirection: 'row', gap: 8 }}>
        <IconButton label="지도에서 보기" icon={<Icon name="map-pin" size={18} color={colors.inverseStrong} />} onPress={() => { myParams.placeFocusStoreId = id; nav.push('place'); }} />
        <IconButton label="길찾기" icon={<Icon name="navigation" size={18} color={colors.inverseStrong} />} onPress={() => openDirections(s)} />
      </View>
      {!coupon && <Text style={[smallText, { marginTop: 16, textAlign: 'center' }]}>이 매장은 지금 받을 수 있는 쿠폰이 없어요.</Text>}
    </Screen>
  );
}

// 아이콘 + 글자 작은 버튼(높이 44 · 모서리 12 · 회색)
function IconButton({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: pressed ? colors.muted : colors.bgSoft, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      {icon}
      <Text style={{ fontSize: 14, lineHeight: 21, color: colors.inverseStrong }}>{label}</Text>
    </Pressable>
  );
}
