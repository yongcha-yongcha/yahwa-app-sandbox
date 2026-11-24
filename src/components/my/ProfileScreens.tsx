// 야화 — MY 안쪽 화면: 내 프로필 보기 · 인연 공개 · 지인 차단(리뉴얼 1120 · spec-rest §6.3 · §6.4 · §7.3)
import React, { useState } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { colors } from '../../tokens';
import { Button, Card, DockArea, Dot, Switch } from '../../ui';
import { previewSelectors, usePreview } from '../../lib/previewStore';
import { MatchProfile } from '../FullProfile';
import { useMyVerification } from '../credentials/useMyVerification';
import { useResting, VisibilitySheet } from '../VisibilitySheet';
import { ContactBlockStatusCard, useContactBlockStatus, useContactBlockSync } from '../ContactBlockGate';
import { Screen, GroupTitle, Fact, Sub } from './ui';
import { IpIcon } from './icons';
import type { MyNav } from './nav';

// 내 프로필 보기 — 머리는 뒤로만(spec-rest §6.3). 본문은 상대 프로필과 같은 MatchProfile(영역 1), 호감 칩 없이
export function PreviewScreen({ nav }: { nav: MyNav }) {
  const profile = usePreview(previewSelectors.myProfile);
  const verification = useMyVerification(true);  // 승인된 선택 인증만 보인다(0157)
  const { width: winW } = useWindowDimensions();
  return (
    <Screen onBack={nav.back} top={0}>
      <MatchProfile
        width={Math.min(winW, 560) - 40}
        like={null}
        p={{
          nickname: profile.nickname || '내 프로필', age: profile.age, region: profile.region, mbti: profile.mbti,
          height: profile.height, job: profile.job, school: null, education: profile.education ?? null, drinking: profile.drinking, smoking: profile.smoking,
          religion: profile.religion, politics: profile.politicsPublic ? profile.politics : null, ideal: profile.introWant,
          extras: profile.extraAnswers, photos: (profile.photos ?? []).filter(Boolean),
          basicVerified: verification.basicVerified,
          credentials: verification.credentials,
        }}
      />
    </Screen>
  );
}

// 인연 공개 — 스위치 카드 + 사실 줄. 끌 때만 확인 시트, 켤 때는 바로
export function VisibilityScreen({ nav }: { nav: MyNav }) {
  const profile = usePreview(previewSelectors.myProfile);
  const { resting, setResting } = useResting();
  const [confirm, setConfirm] = useState(false);
  // 프로필 미완성 · 운영 조치로 중지된 회원은 여기서 켜고 끌 수 없다
  const blocked = !profile.profileCompleted || !!profile.affinitySuspended;
  const state = !profile.profileCompleted ? '프로필을 등록하면 공개돼요'
    : profile.affinitySuspended ? '운영 조치로 공개가 중지됐어요'
      : resting ? '쉬는 중' : '공개 중 · 오늘의 인연에 소개되고 있어요';
  return (
    <Screen title="인연 공개" onBack={nav.back}>
      <Card style={{ height: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '500', color: colors.text }}>인연 공개</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!blocked && !resting && <Dot size={6} color={colors.positive} label="공개 중" />}
            <Text style={{ fontSize: 12, lineHeight: 17, color: colors.mute }}>{state}</Text>
          </View>
        </View>
        <Switch tone="primary" value={!blocked && !resting} disabled={blocked} accessibilityLabel="인연 공개" onChange={(on) => (on ? setResting(false) : setConfirm(true))} />
      </Card>
      <GroupTitle top={24} bottom={12}>{resting ? '다시 공개하면' : '쉬어가면'}</GroupTitle>
      {/* 사실 줄(.ip-facts) — 위 4 · 좌우 4 안쪽 */}
      <View style={{ gap: 14, paddingTop: 4, paddingHorizontal: 4 }}>
        {resting ? (
          <>
            <Fact icon={<IpIcon name="eye" />}>다음 소개 시간부터 오늘의 인연에 다시 소개돼요</Fact>
            <Fact icon={<IpIcon name="mail" />}>쉬는 동안 받은 편지 · 호감은 그대로 남아 있어요</Fact>
          </>
        ) : (
          <>
            <Fact icon={<IpIcon name="eyeoff" />}>내 프로필이 소개되지 않고, 다른 인연도 볼 수 없어요</Fact>
            <Fact icon={<IpIcon name="chat" />}>커뮤니티 · 쿠폰함은 그대로 쓸 수 있어요</Fact>
            <Fact icon={<IpIcon name="mail" />}>주고받던 편지의 보관 기간은 그대로 흘러가요</Fact>
          </>
        )}
      </View>
      <VisibilitySheet open={confirm} onClose={() => setConfirm(false)} />
    </Screen>
  );
}

// 지인 차단 — 가운데 안내 + 상태 카드(켜짐: 흰 카드 · 초록 방패 · 업데이트 / 꺼짐: 회색 카드 · 회색 방패 + 아래 '연락처 불러오기')
// 숫자는 "연락처 N개"(올린 번호 개수). 업데이트는 새로 추가된 번호만 더한다(지운 번호는 풀리지 않음 — lib/contacts)
export function ContactBlockScreen({ nav }: { nav: MyNav }) {
  const statusQ = useContactBlockStatus();
  const { syncing, sync } = useContactBlockSync();
  const web = Platform.OS === 'web';
  const on = statusQ.data?.consent === 'granted';
  const at = statusQ.data?.syncedAt ? new Date(new Date(statusQ.data.syncedAt).getTime() + 9 * 3600_000) : null;
  const status = web ? '모바일 앱에서 켤 수 있어요'
    : on ? `연락처 ${(statusQ.data?.count ?? 0).toLocaleString()}개${at ? ` · ${at.getUTCMonth() + 1}월 ${at.getUTCDate()}일 불러옴` : ''}`
      : '아는 사람에게 내 프로필이 보일 수 있어요';
  return (
    <Screen
      title="지인 차단"
      onBack={nav.back}
      top={24}
      gnb={false}
      dock={on ? undefined : <DockArea><Button size="sheet" block label="연락처 불러오기" loading={syncing} onPress={() => { void sync(); }} /></DockArea>}
    >
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
          <IpIcon name="contacts" size={26} />
        </View>
        <Text accessibilityRole="header" style={{ marginTop: 8, fontSize: 18, lineHeight: 26, fontWeight: '600', color: colors.text }}>아는 사람과 마주치지 않게</Text>
        <Sub style={{ marginTop: 8, textAlign: 'center' } as any}>{'연락처에 있는 번호와 서로 소개되지 않아요.\n번호는 암호화해 비교에만 쓰고, 원본은 저장하지 않아요.'}</Sub>
      </View>
      {/* 안내 묶음 아래 4 + 24(.ip-lead 아래 안쪽 4) */}
      <View style={{ marginTop: 28 }}>
        <ContactBlockStatusCard
          on={on}
          flat={!on}
          sub={status}
          right={on ? <Button variant="tertiary" size="S" label="업데이트" loading={syncing} onPress={() => { void sync(); }} /> : undefined}
        />
      </View>
      {on && <Text style={{ marginTop: 16, fontSize: 12, lineHeight: 18, color: colors.mute, textAlign: 'center' }}>{'연락처가 바뀌었다면 업데이트를 눌러 주세요.\n새로 추가된 번호가 반영돼요.'}</Text>}
    </Screen>
  );
}
