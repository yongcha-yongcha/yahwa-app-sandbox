// 야화 — 쿠폰 자세히 · 직원에게 보여주세요(리뉴얼 1120 · spec-rest §4.4 · §9.2)
// 사용 확정은 그대로: 매장 직원이 확인코드(PIN 4자리)를 누르면 서버(redeem_coupon)가 검증한다.
// 관리자 발행 쿠폰(매장 없음)은 사용할 매장을 먼저 고르고, 매장 발행 쿠폰은 그 매장으로 고정이다(서버 0111도 강제).
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { colors } from '../../tokens';
import { BreathingDots, Button, Card, DockArea, Icon, OtpInput, Row, TextField } from '../../ui';
import { SmartImg } from '../SmartImg';
import { useUseCouponMutation } from '../../lib/hooks';
import { previewActions } from '../../lib/previewStore';
import { Screen, EmptyLine, GroupTitle } from '../my/ui';
import { myParams, type MyNav } from '../my/nav';
import { Note, Ticket, TicketRow, smallText, ticketTitle } from './ui';
import { useCouponList, couponState, couponDateLine, dDay, STATE_LABEL, type CouponState, type UserCoupon } from './coupons';

// RN-web은 Alert.alert가 no-op — 웹에선 window.alert로 폴백
function notify(title: string, body?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(body ? `${title}\n${body}` : title);
  else Alert.alert(title, body);
}

function useMyCoupon() {
  const { list, isLoading, stores, storeName, photoOf } = useCouponList();
  const uc = list.find((x) => x.id === myParams.userCouponId) ?? null;
  return { uc, isLoading, stores, storeName, photoOf };
}

// 쿠폰 티켓(시안 coupon-box 개선안) — 윗칸: 매장 줄(사진 28 · 이름 · 꺾쇠 → 매장 자세히) → 상태 칩 → 혜택(명조 21) [→ 지금 시각]
//  아랫칸(쿠폰 자세히만): 사용 기한 + D-n(3일 안이면 장미색) / 사용일 · 혜택 표기 · 이용 조건
function CouponTicket({ uc, store, photo, onOpenStore, live }: { uc: UserCoupon; store: string; photo?: string; onOpenStore?: () => void; live?: boolean }) {
  const c = uc.coupons;
  const state = couponState(uc);
  const dd = state === 'usable' ? dDay(c?.valid_until) : null;
  const label = c?.discount_label?.trim();
  const note = c?.description?.trim();
  const title = c?.title ?? '쿠폰';
  return (
    <Ticket
      top={
        <>
          <Pressable
            onPress={onOpenStore}
            disabled={!onOpenStore}
            accessibilityRole={onOpenStore ? 'button' : undefined}
            accessibilityLabel={onOpenStore ? `${store} 매장 자세히` : undefined}
            style={{ minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            {!!photo && (
              <View style={{ width: 28, height: 28, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.muted }}>
                <SmartImg src={photo} width={120} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              </View>
            )}
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text }}>{store}</Text>
            {!!onOpenStore && <Icon name="chevron-right" size={18} color={colors.subtle} />}
          </Pressable>
          {!live && <StateChip state={state} />}
          <Text style={[ticketTitle, { marginTop: live ? 12 : 10 }]}>{title}</Text>
          {live && <LiveClock />}
        </>
      }
      bottom={live ? undefined : (
        <>
          <TicketRow label={uc.status === 'used' ? '사용일' : '사용 기한'}>
            {couponDateLine(uc).replace(/^사용일 /, '')}
            {!!dd && <Text style={{ fontWeight: '600', color: dd.soon ? colors.dueSoon : colors.sub }}>{`  ${dd.label}`}</Text>}
          </TicketRow>
          {!!label && label !== title && <TicketRow label="혜택">{label}</TicketRow>}
          {!!note && <TicketRow label="이용 조건">{note}</TicketRow>}
        </>
      )}
    />
  );
}

// 상태 칩 — 사용 가능: 세이지 / 사용 완료 · 기간 만료: 회색
function StateChip({ state }: { state: CouponState }) {
  const ok = state === 'usable';
  return (
    <View style={{ alignSelf: 'flex-start', marginTop: 14, height: 24, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: ok ? colors.validSoft : colors.muted }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ok ? colors.valid : colors.subtle }} />
      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: ok ? colors.validInk : colors.sub }}>{STATE_LABEL[state]}</Text>
    </View>
  );
}

// 지금 시각(초 단위로 움직인다) — 직원이 캡처한 화면이 아니라는 걸 바로 알 수 있게
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = now.getHours();
  const text = `${now.getMonth() + 1}월 ${now.getDate()}일 ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  return (
    <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={`지금 시각 ${text}`}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.activityDot }} />
      <Text style={{ fontSize: 13, lineHeight: 20, fontWeight: '500', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{text}</Text>
    </View>
  );
}

function Missing({ nav, loading }: { nav: MyNav; loading: boolean }) {
  return (
    <Screen title="쿠폰" onBack={nav.back} gnb={false}>
      {loading ? <View style={{ paddingTop: 40, alignItems: 'center' }}><BreathingDots /></View> : <EmptyLine>쿠폰을 찾을 수 없어요.</EmptyLine>}
    </Screen>
  );
}

export function CouponDetailScreen({ nav }: { nav: MyNav }) {
  const { uc, isLoading, storeName, photoOf } = useMyCoupon();
  if (!uc) return <Missing nav={nav} loading={isLoading} />;
  const state = couponState(uc);
  const storeId = uc.coupons?.store_id ?? null;
  return (
    <Screen
      title="쿠폰 자세히"
      onBack={nav.back}
      gnb={false}
      contentStyle={state === 'usable' ? { paddingBottom: 48 } : undefined}  // 아래 고정 버튼 위 흐림(48)에 내용이 덮이지 않게
      dock={state === 'usable' ? <DockArea fade><Button size="sheet" block label="매장에서 사용하기" onPress={() => nav.push('myCouponUse')} /></DockArea> : undefined}
    >
      <CouponTicket uc={uc} store={storeName(storeId)} photo={photoOf(storeId)} onOpenStore={storeId ? () => nav.openStore(storeId) : undefined} />
      {state === 'usable' ? (
        <View style={{ marginTop: 24 }}>
          <Text style={{ marginBottom: 10, fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.text }}>이렇게 써요</Text>
          <View style={{ gap: 10 }}>
            {[storeId ? '매장에서 ‘매장에서 사용하기’를 눌러요' : '‘매장에서 사용하기’를 누르고 사용할 매장을 골라요', '직원에게 화면을 보여 줘요', '직원이 확인코드를 누르면 사용 완료'].map((t, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ marginTop: 1, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.textSecondary }}>{i + 1}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text style={[smallText, { marginTop: 20, textAlign: 'center' }]}>{state === 'used' ? '이미 사용한 쿠폰이에요.' : '사용 기한이 지나 다시 사용할 수 없어요.'}</Text>
      )}
    </Screen>
  );
}

export function CouponUseScreen({ nav }: { nav: MyNav }) {
  const { uc, isLoading, stores, storeName, photoOf } = useMyCoupon();
  const useMut = useUseCouponMutation();
  const bound = uc?.coupons?.store_id ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pin, setPin] = useState('');
  if (!uc) return <Missing nav={nav} loading={isLoading} />;
  const storeId = bound ?? picked;
  const busy = useMut.isPending;

  function submit() {
    if (!uc || !storeId || pin.length !== 4 || busy) return;
    useMut
      .mutateAsync({ userCouponId: uc.id, storeId, pin })
      .then(() => {
        previewActions.showToast('쿠폰을 사용했어요.', 2600);
        // 받은 쿠폰의 '사용 완료' 칩으로(지나온 화면이면 뒤로 돌아가는 움직임이 된다)
        myParams.couponTab = 'used';
        nav.push('couponWallet');
      })
      .catch((e: any) => { setPin(''); notify('사용 실패', e?.message ?? '잠시 후 다시 시도해주세요.'); });
  }

  // 관리자 발행 쿠폰 — 사용할 매장 고르기(매장명 검색)
  if (!storeId) {
    const q = query.trim();
    const open = stores.filter((s) => s.active !== false);
    const filtered = q ? open.filter((s) => (s.name ?? '').includes(q)) : open;
    return (
      <Screen title="사용할 매장" onBack={nav.back} gnb={false}>
        <TextField value={query} onChangeText={setQuery} placeholder="매장명 검색 (예: 성수, 노원)" accessibilityLabel="매장명 검색" clearable />
        <GroupTitle top={20}>사용할 매장을 선택해주세요</GroupTitle>
        {filtered.length === 0 ? (
          <EmptyLine>{q ? `'${q}'로 찾은 매장이 없어요.` : '매장 목록을 불러오지 못했어요.'}</EmptyLine>
        ) : (
          <Card>
            {filtered.map((s, i) => <Row key={s.id} kind="group" first={i === 0} label={s.name} onPress={() => setPicked(s.id)} />)}
          </Card>
        )}
      </Screen>
    );
  }

  return (
    <Screen title="직원에게 보여주세요" onBack={nav.back} gnb={false}>
      <CouponTicket uc={uc} store={storeName(storeId)} photo={photoOf(storeId)} onOpenStore={() => nav.openStore(storeId)} live />
      <Note style={{ marginTop: 16 }}>직원이 확인코드를 누르면 사용이 끝나요. 끝난 쿠폰은 다시 쓸 수 없어요.</Note>
      <GroupTitle top={24}>직원 확인코드</GroupTitle>
      <OtpInput length={4} value={pin} onChange={setPin} />
      <Button size="dock" style={{ marginTop: 24 }} label={busy ? '확인 중…' : '사용 완료하기'} disabled={pin.length !== 4 || busy} onPress={submit} />
      <Button variant="text" block style={{ marginTop: 8 }} label="아직 사용하지 않을게요" onPress={nav.back} />
      {!bound && <Button variant="text" block style={{ marginTop: 4 }} label="매장 다시 선택" onPress={() => { setPicked(null); setPin(''); }} />}
    </Screen>
  );
}
