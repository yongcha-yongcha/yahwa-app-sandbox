// 야화 — 리프 충전(리뉴얼 1120 · spec-rest §5.1 · §5.2). 쌓이는 화면 하나: 큰 제목 → 보유 리프 → 충전 묶음 → 리프 더 모으기.
// 묶음을 누르면 확인 시트가 뜨고 'N원 결제하기'가 결제를 시작한다. 결제(웹 토스 · 앱 토스 인앱 브라우저 · 미리보기)는 그대로다.
// 리프 정책 v2(0187): 묶음은 '기본 + 추가'(총량에 포함, 보너스 따로 없음) · 이벤트 중이면 위에 한 줄 띠.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, type as typo } from '../tokens';
import { configureIAP, listLeafPackages } from '../lib/iap';
import { requestLeafPayment, requestLeafPaymentNative } from '../lib/tosspay';
import { fetchMe } from '../lib/api';
import { supabase } from '../lib/supabase';
import { POINTS_PER_LEAF } from '../lib/hooks';
import { useMissionsToday } from '../lib/missions';
import { previewActions, previewSelectors, usePreview, getCurrentUserId } from '../lib/previewStore';
import { HIDE_IOS_LEAF_TOPUP, HIDE_IOS_CURRENCY } from '../lib/flags';
import { LEAF_EVENT_LABEL, useLeafPricing } from '../lib/leafPricing';
import { BottomSheet, Button, Card, Icon, LeafCostCard, SheetButtons, SheetHeader, usePress } from '../ui';
import { Animated } from 'react-native';
import { Screen, GroupTitle, KV, WalletLeaf } from '../components/my/ui';
import type { MyNav } from '../components/my/nav';

const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW_MODE === '1';

// 리프 정책 v2(0187) — 결제 금액(원)별 지급량. 지급량은 서버(credit_leaf_purchase)가 금액으로 정한다 — 여기는 표시용 사본.
// extra(추가)는 총량(n)에 포함된 수량이다. 첫 충전·등급 보너스는 없다.
type Opt = { n: number; base: number; extra: number; won: number };
const OPTS: Opt[] = [
  { won: 8900, base: 90, extra: 0 },
  { won: 16900, base: 170, extra: 30 },
  { won: 34900, base: 350, extra: 150 },
  { won: 69900, base: 700, extra: 600 },
  { won: 139000, base: 1400, extra: 1600 },
].map((o) => ({ ...o, n: o.base + o.extra }));

// RN-web은 Alert.alert가 no-op — 웹에선 window.alert로 폴백
function notify(title: string, body?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(body ? `${title}\n${body}` : title);
  else Alert.alert(title, body);
}

const NOTE = '많이 충전할수록 리프를 더 드려요 · 토스페이먼츠 결제';


// 결제 — 웹은 토스 결제창으로 이동, 앱은 시스템 브라우저로 토스 결제(적립은 /pay-success 딥링크가 처리)
function useLeafPurchase(active: boolean) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (active) configureIAP(); }, [active]);
  async function purchase(opt: Opt, onDone?: () => void) {
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        // 세션을 못 읽었을 때 'preview'로 넘기면 /pay-success가 미리보기로 보고 로컬에만 적립했다 — 운영에선 실제 세션이 있어야 결제한다
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id ?? (PREVIEW ? 'preview' : null);
        if (!uid) throw new Error('로그인 정보를 확인하지 못했어요. 다시 로그인한 뒤 충전해 주세요.');
        await requestLeafPayment({ n: opt.n, won: opt.won, orderName: '야화컴퍼니(주) 리프' }, uid, 'card');
        return;  // 결제창으로 리다이렉트
      }
      if (PREVIEW) {
        previewActions.chargeLeaf(opt.n);
        onDone?.();
        return;
      }
      // RevenueCat IAP는 키/상품 미설정이라 테스트 목적상 웹과 같은 토스 결제를 인앱 브라우저로 태운다.
      // (정식 iOS 출시 시엔 RevenueCat IAP로 되돌려야 App Store 3.1.1 준수)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');
      await requestLeafPaymentNative({ n: opt.n, won: opt.won, orderName: '야화컴퍼니(주) 리프' }, user.id);
    } catch (e: any) {
      if (e?.userCancelled || e?.code === 'PURCHASE_CANCELLED' || e?.code === 'USER_CANCEL') return;
      notify('결제 실패', e?.message || '잠시 후 다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  }
  return { busy, purchase };
}

// 누르면 60%로 흐려지는 줄(.wl-bal · .wl-pack)
function FadePress({ onPress, label, style, children }: { onPress: () => void; label: string; style: object; children: React.ReactNode }) {
  const press = usePress(1);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={[style, { opacity: press.p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }]}>{children}</Animated.View>
    </Pressable>
  );
}

// '리프 더 모으기' 줄(.rw-row) — 위아래 12, 제목 15/21 500 + 보조 13/22.75(위 4) | 값 13 500 글자-보조 + 2 + 꺾쇠(높이 44). 줄 사이 1px 선(좌우 16 안쪽)
function MoreRow({ label, sub, value, first, onPress }: { label: string; sub?: string; value: string; first?: boolean; onPress: () => void }) {
  const press = usePress(1);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={`${label} ${value}`}>
      <Animated.View style={{ marginHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: press.p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }}>
        {!first && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -1, height: 1, backgroundColor: colors.line }} />}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '500', letterSpacing: -0.2, color: colors.text }}>{label}</Text>
          {!!sub && <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 22.75, color: colors.sub }}>{sub}</Text>}
        </View>
        <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{value}</Text>
          <Icon name="chevron-right" size={20} color={colors.mute} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function Charge({ nav }: { nav: MyNav }) {
  const active = !HIDE_IOS_LEAF_TOPUP;
  const { busy, purchase } = useLeafPurchase(active);
  // 루트(app/index)와 같은 키 — 같은 내 정보를 한 번만 받는다
  const meQ = useQuery({ queryKey: ['me', getCurrentUserId()], queryFn: fetchMe });
  const pricing = useLeafPricing();
  useQuery({ queryKey: ['leaf-packages'], queryFn: listLeafPackages, retry: 0, enabled: active });
  const previewBal = usePreview(previewSelectors.leafBalance);
  const points = usePreview(previewSelectors.points);
  const bal = PREVIEW ? previewBal : (meQ.data?.leaf_balance ?? previewBal);
  const got = useMissionsToday(!!getCurrentUserId()).data ?? {};
  // 확인 시트 — 닫히는 동안에도 내용이 남게 마지막으로 고른 묶음을 따로 둔다
  const [sel, setSel] = useState<Opt | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <Screen onBack={nav.back}>
      <Text accessibilityRole="header" style={[typo.display2, { lineHeight: 37.7 }]}>리프 충전</Text>
      {/* 이벤트 한 줄 띠(리프 정책 v2) — 할인율 없이 이름 + 실제 리프 */}
      {pricing.event && !HIDE_IOS_CURRENCY && (
        <View style={{ marginTop: 16, minHeight: 40, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.accentSubtle, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <WalletLeaf size={14} color={colors.accentStrong} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.accentStrong }}>
            <Text style={{ fontWeight: '600' }}>{LEAF_EVENT_LABEL}</Text>{` · 일반편지 ${pricing.prices.letter}리프`}
          </Text>
        </View>
      )}
      {/* 보유 리프 — 누르면 사용 · 적립 내역 */}
      <FadePress onPress={() => nav.push('spendHistory')} label={`보유 리프 ${bal.toLocaleString()}, 사용 적립 내역 보기`} style={{ marginTop: pricing.event && !HIDE_IOS_CURRENCY ? 12 : 20, height: 72, paddingLeft: 20, paddingRight: 12, borderRadius: 16, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontSize: 13, lineHeight: 22.75, color: colors.sub }}>보유 리프</Text>
        <WalletLeaf size={20} color={colors.accent} />
        <Text style={{ marginLeft: 6, fontSize: 24, lineHeight: 24, fontWeight: '600', letterSpacing: -0.4, color: colors.text, fontVariant: ['tabular-nums'] }}>{bal.toLocaleString()}</Text>
        <View style={{ marginLeft: 12 }}><Icon name="chevron-right" size={20} color={colors.mute} /></View>
      </FadePress>

      {active ? (
        <>
          <GroupTitle top={24} bottom={4}><Text style={{ lineHeight: 40 }}>충전</Text></GroupTitle>
          <View style={{ gap: 8 }}>
            {OPTS.map((o) => (
              <FadePress
                key={o.won}
                onPress={() => { setSel(o); setOpen(true); }}
                label={`${o.won.toLocaleString()}원, 리프 ${o.n.toLocaleString()}개${o.extra > 0 ? `, 기본 ${o.base.toLocaleString()} 더하기 추가 ${o.extra.toLocaleString()}` : ''}`}
                style={{ height: 64, paddingLeft: 16, paddingRight: 12, borderRadius: 16, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center' }}
              >
                {/* 🍃기본 + 🍃추가(추가는 총량에 포함) — 잎은 숫자 앞 */}
                <WalletLeaf size={16} />
                <Text style={{ marginLeft: 6, fontSize: 17, lineHeight: 17, fontWeight: '600', letterSpacing: -0.2, color: colors.text, fontVariant: ['tabular-nums'] }}>{o.base.toLocaleString()}</Text>
                {o.extra > 0 && (
                  <>
                    <Text style={{ marginHorizontal: 6, fontSize: 14, lineHeight: 14, fontWeight: '500', color: colors.mute }}>+</Text>
                    <WalletLeaf size={14} color={colors.accentStrong} />
                    <Text style={{ marginLeft: 4, fontSize: 15, lineHeight: 15, fontWeight: '600', color: colors.accentStrong, fontVariant: ['tabular-nums'] }}>{o.extra.toLocaleString()}</Text>
                  </>
                )}
                <Text style={{ flex: 1, marginRight: 8, textAlign: 'right', fontSize: 15, lineHeight: 15, fontWeight: '500', color: colors.text }}>{o.won.toLocaleString()}원</Text>
                <Icon name="chevron-right" size={20} color={colors.mute} />
              </FadePress>
            ))}
          </View>
          <Text style={{ marginTop: 12, fontSize: 12, lineHeight: 18, color: colors.mute, textAlign: 'center' }}>{NOTE}</Text>
        </>
      ) : (
        // iOS는 리프 충전을 임시로 제공하지 않음(Apple 3.1.1) — 외부 결제처로 유인하지 않는 중립 안내
        <View style={{ marginTop: 32, alignItems: 'center' }}>
          <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.text, textAlign: 'center' }}>리프는 활동으로 모을 수 있어요</Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22.4, color: colors.textSecondary, textAlign: 'center' }}>적립·리워드로 받은 리프를 앱에서 바로 사용할 수 있어요.</Text>
        </View>
      )}

      <GroupTitle top={24} bottom={4}><Text style={{ lineHeight: 40 }}>리프 더 모으기</Text></GroupTitle>
      <Card>
        <MoreRow first label="무료 리프 받기" value={`${Object.keys(got).length} / 5`} onPress={() => nav.push('myRewards')} />
        {!HIDE_IOS_CURRENCY && (
          <MoreRow label="포인트를 리프로 바꾸기" sub={`${POINTS_PER_LEAF}P당 1리프`} value={`${points.toLocaleString()}P`} onPress={() => nav.push('myConvert')} />
        )}
      </Card>

      {/* 충전 확인 시트 — 결제 금액은 버튼에만 */}
      <BottomSheet open={open} onClose={() => setOpen(false)} dismissable={!busy}>
        <Text accessibilityRole="header" style={{ marginTop: 4, fontSize: 18, lineHeight: 26, fontWeight: '600', letterSpacing: -0.2, color: colors.text, marginBottom: 20 }}>리프 충전</Text>
        {!!sel && (
          <>
            {/* 표(.cg-tbl) — 좌우 2 안쪽, 줄 사이 14, 선은 위아래 2 + 14 */}
            <View style={{ gap: 14, paddingHorizontal: 2 }}>
              <KV label="보유 리프" value={`${bal.toLocaleString()}리프`} />
              <KV label="충전 리프" value={`${sel.n.toLocaleString()}리프`} />
            </View>
            <View style={{ height: 1, marginVertical: 16, marginHorizontal: 2, backgroundColor: colors.line }} />
            <View style={{ paddingHorizontal: 2 }}><KV strong label="충전 후 리프" value={`${(bal + sel.n).toLocaleString()}리프`} /></View>
            {sel.extra > 0 && <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 18, color: colors.mute }}>기본 {sel.base.toLocaleString()}리프에 {sel.extra.toLocaleString()}리프를 더한 묶음이에요.</Text>}
            <Button size="sheet" block style={{ marginTop: 20 }} label={`${sel.won.toLocaleString()}원 결제하기`} loading={busy} onPress={() => purchase(sel, () => { setOpen(false); previewActions.showToast(`${sel.n.toLocaleString()}리프를 충전했어요`); })} />
            <Pressable onPress={() => setOpen(false)} disabled={busy} accessibilityRole="button" style={{ marginTop: 4, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.textSecondary }}>취소</Text>
            </Pressable>
          </>
        )}
      </BottomSheet>
    </Screen>
  );
}

// 리프 부족 안내 — 시트 없이 서버가 부족을 알려 온 경우. 앱 전역(_layout)의 Paywall · 편지 쓰기가 띄운다.
// '리프 충전하기'는 충전 화면으로 보낸다(app/index가 pendingCharge를 받아 연다).
export function LeafShortSheet({ open, needed, onClose }: { open: boolean; needed: number; onClose: () => void }) {
  const bal = usePreview(previewSelectors.leafBalance);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <SheetHeader title="리프가 조금 부족해요" desc={HIDE_IOS_LEAF_TOPUP ? '리프는 활동으로 모을 수 있어요.' : `${Math.max(0, needed - bal).toLocaleString()}리프가 더 필요해요.`} />
      <LeafCostCard cost={needed} balance={bal} />
      {HIDE_IOS_LEAF_TOPUP
        ? <Button size="sheet" block label="확인" onPress={onClose} />
        : <SheetButtons cancelLabel="닫기" onCancel={onClose} confirmLabel="리프 충전하기" onConfirm={() => { onClose(); previewActions.requestCharge(); }} />}
    </BottomSheet>
  );
}
