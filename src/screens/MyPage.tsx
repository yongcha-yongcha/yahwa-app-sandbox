// 야화 — 마이페이지(리뉴얼 1120 · spec-rest §6.1 · §6.6)
// 제목 → 사진 + 채움 링(% 알약) · 이름 · 정보 · 상태 칩 → '프로필 수정' → 리프 카드(보유 · 충전) → 목록 줄 → 사업자 정보 푸터.
// 기능은 전부 머리 줄 있는 안쪽 화면으로 연다(src/components/my/nav). 리프·포인트·미션·쿠폰 데이터는 기존 서버 훅 그대로다.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Animated, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { colors, ease, fontSerif, layout, radius } from '../tokens';
import { Card, Dot, Row, TabTitle, TextLink, usePress, useTabBarClearance, reduceMotion } from '../ui';
import { TabTour } from '../components/tour/TabTour';
import { tourRef } from '../components/tour/tourTargets';
import { fmtRegion } from '../components/FullProfile';
import { useMyVerification } from '../components/credentials/useMyVerification';
import { MyLine } from '../components/my/icons';
import type { MyNav } from '../components/my/nav';
import { useCouponList } from '../components/place/coupons';
import { isUsable } from '../components/place/coupons';
import { useMissionsToday } from '../lib/missions';
import { thumbUrl } from '../lib/img';
import { COMPANY_INFO } from '../lib/company';
import { fillRateOf } from '../lib/profileFill';
import { getCurrentUserId, previewSelectors, usePreview, type MyProfile } from '../lib/previewStore';
import { HIDE_IOS_LEAF_TOPUP, HIDE_IOS_CURRENCY, SHOW_TIER } from '../lib/flags';
import { TIERS, TIER_ICON, type TierInfo } from '../lib/tier';
import { TierGuide } from '../components/TierGuide';
import { Icons } from '../icons';

// 모임 기능 잠시 중단(대표 지시 1007) — 다시 열 때 true
const SHOW_GATHER_MENUS = false;

// 티어 카드 — 현재 등급 + 혜택 + 다음 등급까지 진행도 (티어 개념 임시 숨김: SHOW_TIER)
function TierCard({ tier, spend }: { tier: TierInfo; spend: number }) {
  const idx = TIERS.findIndex((t) => t.key === tier.key);
  const next = idx > 0 ? TIERS[idx - 1] : null;  // TIERS는 상위→하위 순
  const toNext = next ? Math.max(0, next.threshold - spend) : 0;
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <View style={{ backgroundColor: colors.surface, marginTop: 8, paddingHorizontal: 16, paddingVertical: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: colors.sub, fontWeight: '600' }}>내 등급</Text>
        {/* 티어 안내 시트 열기 */}
        <Pressable onPress={() => setGuideOpen(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontSize: 11, color: colors.mute }}>티어 안내</Text>
          <Icons.chev size={12} color={colors.mute} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* 티어 다이아 이모지 */}
        <Image source={TIER_ICON[tier.key]} style={{ width: 44, height: 44 }} contentFit="contain" />

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{tier.label}</Text>
          {tier.note && <Text style={{ fontSize: 10, color: colors.mute, marginTop: 1 }}>{tier.note}</Text>}
        </View>
      </View>

      {tier.benefits.length > 0 && (
        <View style={{ marginTop: 12, gap: 6 }}>
          {tier.benefits.map((b) => (
            <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icons.check size={14} color={colors.primary} />
              <Text style={{ fontSize: 11.5, color: colors.text }}>{b}</Text>
            </View>
          ))}
        </View>
      )}

      {next && (
        <Text style={{ fontSize: 11, color: colors.mute, marginTop: 12 }}>
          {next.hiddenThreshold
            ? `최상위 ${next.label}은 비공개 기준으로 운영돼요.`
            : `${next.label}까지 야화 매장에서 ${toNext.toLocaleString()}원 더 결제하면 돼요.`}
        </Text>
      )}
      <Text style={{ fontSize: 10, color: colors.mute, marginTop: 6 }}>
        등급은 야화 매장 누적 결제액으로 산정돼요.
      </Text>

      <TierGuide open={guideOpen} onClose={() => setGuideOpen(false)} currentKey={tier.key} />
    </View>
  );
}

// 소개 채움 — 프로필 수정의 채움 카드와 같은 6칸(src/lib/profileFill.ts)
function fillRate(p: MyProfile): number {
  return fillRateOf({
    photos: p.photos?.length ?? (p.photo ? 1 : 0),
    details: { job: p.job, region: p.region, height: p.height, mbti: p.mbti, education: p.education, religion: p.religion, smoking: p.smoking },
    drinking: p.drinking, ideal: p.introWant, extras: p.extraAnswers,
  });
}

const RING = 72, RING_W = 3, RING_R = (RING - RING_W) / 2, RING_C = 2 * Math.PI * RING_R;

// 사진 + 채움 링(.mp-av) — 72 원 안 사진 60. 링은 12시부터 시계 방향, 값이 바뀌면 600ms. 아래에 % 알약
// 링은 값이 바뀔 때만 600ms 움직이므로 Animated 값을 듣고 Circle에 숫자로 넘긴다
// (Animated.createAnimatedComponent(Circle)은 웹에서 <circle collapsable>로 그려져 콘솔 경고가 났다)
function Avatar({ photo, rate, dim, onPress }: { photo?: string | number; rate: number; dim?: string; onPress: () => void }) {
  const v = useRef(new Animated.Value(rate)).current;
  const [shown, setShown] = useState(rate);
  useEffect(() => {
    const id = v.addListener(({ value }) => setShown(value));
    return () => v.removeListener(id);
  }, [v]);
  useEffect(() => {
    if (reduceMotion()) { v.setValue(rate); return; }
    Animated.timing(v, { toValue: rate, duration: 600, easing: ease.out, useNativeDriver: false }).start();
  }, [rate, v]);
  const pct = Math.round(rate * 100);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`내 프로필 보기 · 소개 ${pct}% 채움`} style={{ width: RING, height: RING }}>
      <Svg width={RING} height={RING} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={colors.accentSubtle} strokeWidth={RING_W} fill="none" />
        <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={colors.ringFill} strokeWidth={RING_W} strokeLinecap="round" fill="none" strokeDasharray={`${RING_C} ${RING_C}`} strokeDashoffset={RING_C * (1 - shown)} />
      </Svg>
      <View style={{ position: 'absolute', left: 6, top: 6, width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
        {photo
          ? <Image source={typeof photo === 'string' ? { uri: thumbUrl(photo, 200) ?? photo } : photo} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
          : <MyLine name="contacts" color={colors.mute} />}
        {/* 운영팀 재검토 중 — 어둡게 + 글자 */}
        {!!dim && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrimDeep, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 11, lineHeight: 16.5, fontWeight: '600', color: colors.inverse }}>{dim}</Text>
          </View>
        )}
      </View>
      {/* % 알약 — 시안 38×20(좌우 7) + 흰 링 2를 테두리로 그려 겉 42×24, 사진 아래로 6 걸친다 */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: -8, alignItems: 'center' }}>
        <View style={{ height: 24, paddingHorizontal: 7, borderRadius: 12, borderWidth: 2, borderColor: colors.bg, backgroundColor: colors.ringFill, justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, lineHeight: 20, fontWeight: '600', color: colors.ringInk, fontVariant: ['tabular-nums'] }}>{pct}%</Text>
        </View>
      </View>
    </Pressable>
  );
}

// 상태 칩(.mp-state) — 높이 28 · 회색 카드 · 점 6 + 12/28 500. 공개 중이면 아무것도 없다
function StateChip({ label, dot }: { label: string; dot: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', marginTop: 8, height: 28, borderRadius: 14, paddingLeft: 14, paddingRight: 10, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Dot size={6} color={dot} label="" />
      <Text style={{ fontSize: 12, lineHeight: 28, fontWeight: '500', color: colors.text }}>{label}</Text>
    </View>
  );
}

export function MyPage({ nav, onOpenMySocialings, onOpenFollowing, onOpenSettlementInfo }: {
  nav: MyNav;
  // 모임 메뉴(숨김 플래그) — 다시 열 때 쓴다
  onOpenMySocialings?: () => void;
  onOpenFollowing?: () => void;
  onOpenSettlementInfo?: () => void;
}) {
  const bottomSpace = useTabBarClearance();
  const profile = usePreview(previewSelectors.myProfile);
  const leafBalance = usePreview(previewSelectors.leafBalance);
  const tier = usePreview(previewSelectors.tier);
  const storeSpend = usePreview(previewSelectors.storeSpendTotal);
  const signedIn = !!getCurrentUserId();
  const certs = useMyVerification(signedIn).credentials.length;
  const missions = Object.keys(useMissionsToday(signedIn).data ?? {}).length;
  const coupons = useCouponList().list.filter(isUsable).length;

  const photo = profile.photos?.[0] ?? profile.photo;
  const suspended = !!profile.affinitySuspended;  // 운영 조치(0139)
  const resting = !!profile.affinityHidden || !!profile.affinityDeckPaused;  // 쉬어가는 중(0108 플래그)
  const reviewing = suspended && !!profile.affinityReviewRequestedAt;  // 수정 후 운영팀 재검토 중
  const regionText = fmtRegion(profile.region);
  const meta = [profile.gender === 'F' ? '여성' : '남성', profile.age > 0 ? `만 ${profile.age}세` : '', regionText].filter(Boolean).join(' · ');
  const editPress = usePress(0.98);
  const chargePress = usePress(0.97);
  const edit = () => nav.push('profileEdit');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomSpace }}>
        <TabTitle title="마이페이지" />
        <View style={{ paddingTop: 14, paddingHorizontal: layout.gutter }}>
          {/* 프로필 — 사진(링) + 이름 · 정보 · 상태 칩 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: RING }}>
            <Avatar photo={photo} rate={fillRate(profile)} dim={reviewing ? '검토 중' : undefined} onPress={() => nav.push('myPreview')} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: fontSerif, fontSize: 22, lineHeight: 28.6, color: colors.text }}>{profile.nickname || '닉네임을 정해주세요'}</Text>
              {!!meta && <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.mute }}>{meta}</Text>}
              {!profile.profileCompleted ? <StateChip label="미완성" dot={colors.subtle} />
                : reviewing ? <StateChip label="검토 중" dot={colors.subtle} />
                  : suspended ? <StateChip label="공개 중지" dot={colors.danger} />
                    : resting ? <StateChip label="쉬어가는 중" dot={colors.subtle} /> : null}
            </View>
          </View>

          {/* 운영 조치 안내 — 관리자가 인연 공개를 중지한 경우(0139) */}
          {suspended && (
            <Card pad={16} style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text }}>인연 프로필 공개가 중지됐어요</Text>
              {!!profile.affinitySuspendedReason && <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 20, color: colors.sub }}>사유: {profile.affinitySuspendedReason}</Text>}
              <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 20, color: colors.sub }}>
                {profile.affinityReviewRequestedAt
                  ? '수정한 프로필을 운영팀이 확인하고 있어요. 확인이 끝나면 알림으로 알려드릴게요.'
                  : '사진이나 소개를 정책에 맞게 수정해 주세요. 수정하면 운영팀이 다시 확인해요.'}
              </Text>
              <TextLink label="프로필 수정하기" color={colors.accent} onPress={edit} style={{ alignSelf: 'flex-start' }} />
            </Card>
          )}

          {/* 프로필 수정 — 첫 방문 안내 대상 */}
          <Pressable ref={tourRef('my.shortcuts')} onPress={edit} onPressIn={editPress.onPressIn} onPressOut={editPress.onPressOut} accessibilityRole="button" style={{ marginTop: 16 }}>
            <Animated.View style={[{ height: 44, borderRadius: radius.cta, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' }, editPress.scaleStyle]}>
              <Text style={{ fontSize: 14, lineHeight: 20.3, fontWeight: '600', color: colors.text }}>{profile.profileCompleted ? '프로필 수정' : '프로필 등록'}</Text>
            </Animated.View>
          </Pressable>

          {/* 리프 카드 — 숫자 쪽은 사용 · 적립 내역, 충전은 리프 충전 */}
          {!HIDE_IOS_CURRENCY && (
            <Card pad={16} style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => nav.push('spendHistory')} accessibilityRole="button" accessibilityLabel={`보유 리프 ${leafBalance}, 사용 적립 내역 보기`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <MyLine name="leaf" />
                </View>
                <View>
                  <Text style={{ fontSize: 12, lineHeight: 16.8, color: colors.mute }}>보유 리프</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                    <Text style={{ fontSize: 22, lineHeight: 28.6, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] }}>{leafBalance.toLocaleString()}</Text>
                    <Text style={{ fontSize: 14, lineHeight: 18.2, fontWeight: '500', color: colors.textSecondary }}>리프</Text>
                  </View>
                </View>
              </Pressable>
              {!HIDE_IOS_LEAF_TOPUP && (
                <Pressable onPress={() => nav.push('charge')} onPressIn={chargePress.onPressIn} onPressOut={chargePress.onPressOut} accessibilityRole="button" accessibilityLabel="리프 충전" hitSlop={4}>
                  <Animated.View style={[{ width: 56, height: 36, borderRadius: radius.chip, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, chargePress.scaleStyle]}>
                    <Text style={{ fontSize: 14, lineHeight: 20.3, fontWeight: '600', color: colors.inverse }}>충전</Text>
                  </Animated.View>
                </Pressable>
              )}
            </Card>
          )}

          {/* 티어 카드 — 티어 개념 임시 숨김(SHOW_TIER) */}
          {SHOW_TIER && <TierCard tier={tier} spend={storeSpend} />}

          {/* 목록 */}
          <View style={{ marginTop: 8 }}>
            <Row icon={<MyLine name="shield" />} label="배지 · 인증" value={certs ? `${certs}개` : undefined} onPress={() => nav.push('badgeManage')} />
            <Row icon={<MyLine name="userx" />} label="지인 차단" onPress={() => nav.push('myContactBlock')} />
            {!HIDE_IOS_CURRENCY && <Row icon={<MyLine name="gift" />} label="무료 리프 받기" value={`${missions} / 5`} onPress={() => nav.push('myRewards')} />}
            <Row icon={<MyLine name="coupon" />} label="쿠폰함" value={`${coupons}개`} onPress={() => nav.push('place')} />
            <Row icon={<MyLine name="bell" />} label="알림 설정" onPress={() => nav.push('myNotif')} />
            <Row icon={<MyLine name="settings" />} label="설정 · 도움말" onPress={() => nav.push('mySettings')} />
            {SHOW_GATHER_MENUS && <Row label="내 모임" onPress={onOpenMySocialings} />}
            {SHOW_GATHER_MENUS && <Row label="팔로우한 호스트" onPress={onOpenFollowing} />}
            {SHOW_GATHER_MENUS && <Row label="정산 정보 등록" onPress={onOpenSettlementInfo} />}
          </View>

          {/* 맨 아래 사업자 정보 푸터(1119 대표 지시 — 필수) */}
          <BizFooter />
        </View>
      </ScrollView>
      {/* 탭 첫 방문 안내(새 가입자 한 번) */}
      <TabTour tab="my" active />
    </View>
  );
}

// 사업자 정보 푸터 — 이용약관 · 개인정보처리방침(굵게) · 고객센터, 그 아래 상호·대표자·사업자등록번호 등 11/16.5(비어 있는 칸은 빼고)
function BizFooter() {
  const c = COMPANY_INFO;
  const link = (label: string, path: string, strong = false) => (
    <Pressable key={path} onPress={() => router.push(path as never)} accessibilityRole="link" hitSlop={{ top: 13, bottom: 13, left: 6, right: 6 }}>
      <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: strong ? '600' : '500', color: strong ? colors.text : colors.mute }}>{label}</Text>
    </Pressable>
  );
  const lines = [
    [c.name, c.ceo && `대표 ${c.ceo}`].filter(Boolean).join(' | '),
    [c.bizNo && `사업자등록번호 ${c.bizNo}`, c.mailOrderNo && `통신판매업 신고 ${c.mailOrderNo}`].filter(Boolean).join(' | '),
    c.address,
    [c.phone && `고객센터 ${c.phone}`, c.email && `이메일 ${c.email}`].filter(Boolean).join(' | '),
  ].filter(Boolean);
  return (
    <View style={{ marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.line, gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 }}>
        {link('이용약관', '/terms')}
        {link('개인정보처리방침', '/privacy', true)}
        {link('고객센터', '/support')}
      </View>
      <View style={{ gap: 2 }}>
        {lines.map((t) => (
          <Text key={t} selectable style={{ fontSize: 11, lineHeight: 16.5, color: colors.mute }}>{t}</Text>
        ))}
      </View>
    </View>
  );
}
