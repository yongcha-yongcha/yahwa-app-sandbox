// 소개 본문 조각 — 가입 4/4 미리보기와 프로필 수정이 함께 쓴다(spec-shell §4.12 · spec-rest §6.2).
// 대표 사진 한 장(모서리 20) → 이름 ・나이 → 직업 · 사는 곳 → 정보 2열 → 이야기(질문 명조 20 파랑 · 답 16/28.8) 사이사이 나머지 사진.
import React from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, fontSerif, radius } from '../../tokens';
import { T } from '../../ui';
import { FactIcon, type FactIconName } from './art';
import { regionText, shownValue } from './profileOptions';
import { thumbUrl, originalPhoto } from '../../lib/img';

export type BodyData = {
  nickname: string; age?: number | null; job?: string; region?: string; height?: number | null; mbti?: string; smoking?: string; drinking?: string;
  religion?: string; education?: string; politics?: string | null; photos: string[]; stories: { q: string; a: string }[];
};

export function MainPhoto({ src }: { src?: string }) {
  return (
    <View style={{ height: 330, borderRadius: radius.photo, overflow: 'hidden', backgroundColor: colors.bgSoft }}>
      {!!src && <Image source={{ uri: thumbUrl(originalPhoto(src), 960) ?? src }} accessibilityLabel="대표 사진" style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />}
    </View>
  );
}

const line = { fontSize: 14, lineHeight: 20, color: colors.textSecondary } as const;
// 이름 줄 + 직업 · 사는 곳 + 정보 목록(빈 값은 칸이 빠진다, 성별은 보여 주지 않는다)
export function Facts({ p }: { p: BodyData }) {
  const drink = p.drinking ? `술 ${shownValue(p.drinking)}` : '';
  const facts = ([
    ['height', p.height ? `${p.height}cm` : ''], ['mbti', p.mbti], ['smoking', p.smoking], ['drinking', drink],
    ['religion', p.religion], ['education', p.education], ['politics', p.politics],
  ] as [FactIconName, string | null | undefined][]).filter((x) => !!x[1]);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fontSerif, fontSize: 30, lineHeight: 39, letterSpacing: -0.5, color: colors.text }}>{p.nickname || '나의 이름'}</Text>
        {!!p.age && <Text style={{ fontFamily: fontSerif, fontSize: 30, lineHeight: 39, letterSpacing: -0.5, color: colors.text }}>・{p.age}세</Text>}
      </View>
      {!!p.job && (
        <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <FactIcon name="job" /><Text style={line}>{p.job}</Text>
        </View>
      )}
      {!!p.region && (
        <View style={{ marginTop: p.job ? 8 : 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <FactIcon name="pin" /><Text style={line}>{regionText(p.region)}</Text>
        </View>
      )}
      {!!facts.length && (
        <View style={{ marginTop: 28, flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
          {facts.map(([k, v]) => (
            <View key={k} style={{ width: '50%', paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <FactIcon name={k} /><Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: colors.textSecondary }}>{v}</Text>
            </View>
          ))}
        </View>
      )}
      {!p.job && !facts.length && <Text style={{ marginTop: 24, fontSize: 13, lineHeight: 19.5, color: colors.sub }}>상세 정보를 아직 입력하지 않았어요.</Text>}
    </View>
  );
}

// 이야기 + 사이 사진 — 대표를 뺀 사진을 이야기 뒤에 한 장씩, 남으면 마지막 이야기 뒤에. first: 첫 이야기의 위 여백
export function Stories({ p, first = 48 }: { p: BodyData; first?: number }) {
  const rest = p.photos.slice(1);
  const photo = (src: string, k: number) => (
    // 폭을 먼저 정한다 — 비율만 주면 iOS(Yoga)가 높이부터 잡고 폭을 거꾸로 맞춰 왼쪽에 쏠린 좁은 정사각형이 된다
    <View key={`ph${k}`} style={{ marginTop: 32, marginBottom: 40, width: '100%', aspectRatio: 1, borderRadius: radius.field, overflow: 'hidden', backgroundColor: colors.bgSoft }}>
      <Image source={{ uri: thumbUrl(src, 960) ?? src }} accessibilityLabel={`나의 사진 ${k + 2}`} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
    </View>
  );
  const out: React.ReactNode[] = [];
  let afterPhoto = false;
  p.stories.forEach((s, k) => {
    out.push(
      <View key={`q${k}`} style={{ marginTop: afterPhoto ? 0 : k === 0 ? first : 48 }}>
        <T accessibilityRole="header" style={{ fontFamily: fontSerif, fontSize: 22, lineHeight: 35, color: colors.accentStrong }}>“{s.q}”</T>
        <T style={{ marginTop: 16, fontSize: 16, lineHeight: 28.8, color: colors.textSecondary }}>{s.a.trim()}</T>
      </View>,
    );
    afterPhoto = false;
    if (rest[k] && k < p.stories.length - 1) { out.push(photo(rest[k], k)); afterPhoto = true; }
  });
  rest.slice(Math.max(0, p.stories.length - 1)).forEach((src, i) => out.push(photo(src, Math.max(0, p.stories.length - 1) + i)));
  return <View>{out}</View>;
}
