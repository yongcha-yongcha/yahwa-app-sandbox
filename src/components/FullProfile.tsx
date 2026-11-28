// 야화 — 인연 전체 프로필 (시안 사이트 '시스템 적용' ve 갤러리 + ye 프로필 상세, 1015 실측)
// 대표 사진(360 높이, 안 연 사람은 흐리게) → 이름 + 기본 인증 씰 · 선택 인증 줄 · 나이·거주지·MBTI · 마음 가는 사람
//   · 사진2 · 키·직업·학력 · 선택 질문1 · 사진3 · 음주·흡연·종교(·정치 성향) · 선택 질문2 · 이 인연 숨기기
// 사실 행은 선 없이 가운데 정렬, 질문 24/650 · 답 17/500(시안 1015 '굵은 글씨' 개정).
// (사진이 1장뿐이면 같은 사진을 반복하지 않고 없는 자리는 건너뛴다)
// 프로필 상세(전체 화면)와 내 프로필 미리보기가 같은 컴포넌트를 쓴다. 오늘의 인연 카드는 affinity/DeckCard.
import { ScaleMark } from './affinity/balance/ScaleMark';
import { iAmChip } from './affinity/balance/content';
import React, { memo, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { colors, ease, fontSerif } from '../tokens';
import { NATIVE } from '../ui';
import { ProfilePhoto } from './affinity/ProfilePhoto';
import { VerificationSeal, CredentialSymbol, CertBadge, RIcons } from './affinity/icons';
import { VerificationDialog, CertDialog, type Credential, type VerificationTarget } from './affinity/Verification';
import { LS, profileInk, pressFx, exactColor, keepAll } from './affinity/ui';
import { FactIcon, type FactIconName } from './entry/art';
import { originalPhoto } from '../lib/img';
import { useThemeTick } from '../lib/theme';

export type FullProfileData = {
  nickname: string;
  age?: number | null;
  region?: string | null;
  mbti?: string | null;
  height?: number | null;
  job?: string | null;
  school?: string | null;        // 학교 메일 인증한 학교명(users.univ_name)
  education?: string | null;     // 학력 단계 (0148, 필수 항목)
  drinking?: string | null;
  smoking?: string | null;
  religion?: string | null;
  politics?: string | null;      // 공개 설정한 경우에만 값이 온다(서버 마스킹)
  ideal?: string | null;         // 이런 사람에게 마음이 가요 (users.intro_want)
  extras?: { q: string; a: string }[] | null;
  photos: (string | number)[];
  basicVerified?: boolean;       // 기본 인증(성별·나이·전화번호)
  credentials?: Credential[] | null;  // 승인된 선택 인증만
};

// '경기/수원' · '경기 / 수원' 혼재 → 표시만 '경기 / 수원'으로 통일
export const fmtRegion = (r?: string | null) => (r ? r.replace(/\s*\/\s*/g, ' / ') : '');

const GALLERY_H = 360;
const galleryRatios = new Map<string, number>();
const STORY_H = 320;
const W650 = '650' as any;

// 시안 대표 사진 — 열기 전에는 흐리게 + '사진 보기', 연 뒤에는 누르면 전체 화면
// 프로필 페이지는 대표 사진 원본을 원본 비율 그대로 보여준다(카드 썸네일은 회원이 고른 부분, 1017)
function Gallery({ src, width, blurred, onReveal, onOpen, overlay }: {
  src?: string | number; width: number; blurred?: boolean; onReveal?: () => void; onOpen?: () => void; overlay?: React.ReactNode;
}) {
  const shadow = { textShadowColor: exactColor('rgba(0,0,0,0.333)'), textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 12 } as const;
  // 비율은 그린 사진(expo-image)이 불러와질 때 알게 된다 — 따로 내려받지 않고, 한 번 본 사진은 기억해 다시 열 때 높이가 튀지 않게
  const key = typeof src === 'string' ? src : '';
  const [ratio, setRatio] = useState<{ key: string; r: number } | null>(null);
  const r = ratio?.key === key ? ratio.r : galleryRatios.get(key);
  const h = r ? Math.round(width / r) : GALLERY_H;
  return (
    <View style={{ width, height: h, borderRadius: 14, overflow: 'hidden' }}>
      <ProfilePhoto
        src={src} width={width} height={h} radius={14} blur={blurred ? 16 : 0} scale={1.07} position={{ top: '35%', left: '50%' }}
        onLoad={key ? (e) => {
          const { width: w, height: hh } = e.source;
          if (w > 0 && hh > 0) { galleryRatios.set(key, w / hh); setRatio({ key, r: w / hh }); }
        } : undefined}
      />
      {blurred ? (
        <Pressable
          onPress={onReveal}
          disabled={!onReveal}
          accessibilityRole="button"
          accessibilityLabel="사진 보기"
          style={({ pressed }) => [StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(21,26,31,0.05)' }, pressFx(pressed)]}
        >
          <Text style={{ fontSize: 18, lineHeight: 29.7, letterSpacing: LS, color: '#fff', ...shadow }}>사진 보기</Text>
          <Text style={{ fontSize: 11, lineHeight: 18.15, letterSpacing: LS, color: exactColor('rgba(255,255,255,0.816)'), ...shadow }}>한 번 눌러 인연을 만나보세요</Text>
        </Pressable>
      ) : onOpen ? (
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="프로필 전체 화면으로 보기" style={({ pressed }) => [StyleSheet.absoluteFillObject, pressFx(pressed)]} />
      ) : null}
      {!blurred && overlay}
    </View>
  );
}

// 사실 행 — 가운데 정렬, 작은 라벨 위 · 값 아래(16/500 · 한 줄)
// 학력이 비면 두 칸으로(좌우 31 안쪽, 1017)
function Facts({ items }: { items: [string, string | null | undefined][] }) {
  const ink = profileInk();
  // 4칸(음주·흡연·종교·정치 성향)은 칸이 좁아 값 글자를 15로 줄이고, 앱에서는 넘치면 칸에 맞게 더 줄인다(잘림 방지)
  const four = items.length >= 4;
  // 1020 시안: 옅은 회색 상자(위아래 16 · 좌우 8 · 모서리 12), 칸 사이 흰 세로선 2(위아래 4 안쪽)
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.bgSoft, marginHorizontal: items.length === 2 ? 31 : 0 }}>
      {items.map(([label, value], i) => (
        <View key={label} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 7 }}>
          {i > 0 && <View style={{ position: 'absolute', left: -1, top: 4, bottom: 4, width: 2, backgroundColor: colors.surface }} />}
          <Text style={{ marginBottom: 4, fontSize: 12, lineHeight: 18, letterSpacing: LS, color: colors.sub, textAlign: 'center' }}>{label}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ alignSelf: 'stretch', fontSize: four ? 15 : 16, lineHeight: 24, fontWeight: '500', letterSpacing: four ? -0.3 : LS, color: ink, textAlign: 'center' }}>{value || '미등록'}</Text>
        </View>
      ))}
    </View>
  );
}

// 질문 제목 — 시안처럼 긴 질문은 구절 단위로 줄을 나눈다
const QUESTION_BREAKS: Record<string, string> = {
  '좋아하는 사람에게 애정을 표현하는 방식은?': '좋아하는 사람에게 애정을\n표현하는 방식은?',
  '연인이 생기면 가장 먼저 함께하고 싶은 것은?': '연인이 생기면 가장 먼저\n함께하고 싶은 것은?',
  '사소하지만 꼭 지키고 싶은 연애 습관은?': '사소하지만 꼭 지키고 싶은\n연애 습관은?',
  '요즘 가장 많은 시간을 쓰고 있는 것은?': '요즘 가장 많은 시간을\n쓰고 있는 것은?',
};

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View>
      <Text lineBreakStrategyIOS="hangul-word" style={{ fontSize: 24, lineHeight: 34.8, fontWeight: W650, letterSpacing: -0.6, color: colors.text, marginBottom: 12, ...keepAll }}>
        {(QUESTION_BREAKS[title] ?? title).split('\n').map((t, i) => (i ? [<React.Fragment key={i}>{'\n'}{t}</React.Fragment>] : t))}
      </Text>
      <Text style={{ fontSize: 17, lineHeight: 31.45, fontWeight: '500', letterSpacing: LS, color: profileInk() }}>{body}</Text>
    </View>
  );
}

// 이름 + 기본 인증 씰(44 터치) · 선택 인증 2열
function Heading({ name, width, basic, credentials, onVerify }: {
  name: string; width: number; basic?: boolean; credentials?: Credential[] | null; onVerify: (t: VerificationTarget) => void;
}) {
  const cellW = (width - 12) / 2;
  return (
    <View style={{ paddingTop: 12, paddingBottom: 2 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', minHeight: basic ? 44 : undefined }}>
        <Text style={{ flexShrink: 1, fontSize: 28, lineHeight: 36.4, fontWeight: W650, letterSpacing: -0.98, color: colors.text }}>{name}</Text>
        {basic && (
          <Pressable onPress={() => onVerify('basic')} accessibilityRole="button" accessibilityLabel="기본 인증 확인" style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', ...pressFx(pressed) })}>
            <CertBadge size={23} hi={!!credentials?.length} />
          </Pressable>
        )}
      </View>
      {/* 선택 인증 — 없어도 시안처럼 위 6 · 아래 4 자리를 둔다 */}
      {!credentials?.length ? <View style={{ height: 10 }} /> : (
        <View style={{ marginTop: 6, paddingBottom: 4, flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2 }}>
          {credentials.map((c) => (
            <Pressable
              key={c.kind}
              onPress={() => onVerify(c)}
              accessibilityRole="button"
              accessibilityLabel={`${c.label} 인증 설명`}
              style={({ pressed }) => ({ width: cellW, minHeight: 44, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5, ...pressFx(pressed) })}
            >
              <CredentialSymbol kind={c.kind} size={16} color={colors.sub} />
              <Text style={{ flexShrink: 1, fontSize: 13, lineHeight: 18.85, fontWeight: '500', letterSpacing: LS, color: colors.text }}>{c.label}</Text>
              <VerificationSeal size={18} extra />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// 사는 곳 — '서울/마포' → '서울 마포구'(시안 표기, 구·시·군이 없으면 '구'를 붙인다)
export function regionText(r?: string | null): string | null {
  if (!r) return null;
  const parts = r.split('/').map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? null;
  const [a, b] = parts;
  if (b === '기타') return a;
  return `${a} ${/[구시군]$/.test(b) ? b : `${b}구`}`;
}

// 시안은 블록 사이 세로 여백이 CSS 마진 겹침으로 정해진다 — 같은 규칙(큰 양수 + 음수)으로 계산
type Block = { key: string; mt: number; mb: number; node: React.ReactNode };
const collapse = (a: number, b: number) => Math.max(a, b, 0) + Math.min(a, b, 0);
function Stack({ blocks, firstTop }: { blocks: Block[]; firstTop?: number }) {
  return (
    <View>
      {blocks.map((b, i) => (
        <View key={b.key} style={{ marginTop: i === 0 ? (firstTop ?? b.mt) : collapse(blocks[i - 1].mb, b.mt) }}>{b.node}</View>
      ))}
      {!!blocks.length && <View style={{ height: blocks[blocks.length - 1].mb }} />}
    </View>
  );
}

export const FullProfile = memo(function FullProfile({
  p, width, blurred, onReveal, onOpen, photoOverlay,
}: {
  p: FullProfileData;
  width: number;            // 콘텐츠 폭(좌우 여백 제외)
  blurred?: boolean;        // 아직 안 연 사람 — 대표 사진만 흐리게(시안 전체 화면과 같음)
  onReveal?: () => void;    // '사진 보기'
  onOpen?: () => void;      // 연 뒤 사진을 누르면(프로필 전체 화면)
  photoOverlay?: React.ReactNode;  // 대표 사진 위 표시(보낸 관심·편지)
}) {
  useThemeTick();
  const [verify, setVerify] = useState<VerificationTarget | null>(null);
  const extras = p.extras ?? [];
  const basicFacts: [string, string | null | undefined][] = [['나이', p.age ? `${p.age}세` : null], ['거주지', fmtRegion(p.region)], ['MBTI', p.mbti]];
  // 학력 — 승인된 학력 인증이 있으면 그 내용, 없으면 입력한 학력 단계 · 학교. 비면 칸을 뺀다(시안 two-facts)
  const schoolCred = p.credentials?.find((c) => c.kind === 'school')?.label;
  const edu = schoolCred || [p.education, p.school].filter(Boolean).join(' · ');
  const facts2: [string, string | null | undefined][] = [['키', p.height ? `${p.height}cm` : null], ['직업', p.job], ...(edu ? [['학력', edu] as [string, string]] : [])];

  // 음주 저장값 '안마심'은 시안 글자 '안함'으로 보인다(프로필 편집과 같음)
  // 시안 실측 여백(마진 겹침): 사실 행 위 12 · 아래 20, 질문 위아래 32, 사진 아래 22
  const blocks: Block[] = [
    { key: 'heading', mt: 0, mb: 0, node: <Heading name={p.nickname} width={width} basic={p.basicVerified} credentials={p.credentials} onVerify={setVerify} /> },
    { key: 'facts1', mt: 12, mb: 20, node: <Facts items={basicFacts} /> },
  ];
  if (p.ideal) blocks.push({ key: 'ideal', mt: 32, mb: 32, node: <Section title="이런 사람에게 마음이 가요" body={p.ideal} /> });
  if (p.photos[1] != null) blocks.push({ key: 'photo2', mt: 0, mb: 22, node: <ProfilePhoto src={p.photos[1]} width={width} height={STORY_H} radius={10} /> });
  blocks.push({ key: 'facts2', mt: 12, mb: 20, node: <Facts items={facts2} /> });
  if (extras[0]) blocks.push({ key: 'extra1', mt: 32, mb: 32, node: <Section title={extras[0].q} body={extras[0].a} /> });
  if (p.photos[2] != null) blocks.push({ key: 'photo3', mt: 0, mb: 22, node: <ProfilePhoto src={p.photos[2]} width={width} height={STORY_H} radius={10} /> });
  // 정치 성향은 공개한 사람만 같은 상자의 4번째 칸으로(대표 지시 1027) — 상자 밖 별도 줄로 두지 않는다
  const facts3: [string, string | null | undefined][] = [['음주', p.drinking === '안마심' ? '안함' : p.drinking], ['흡연', p.smoking], ['종교', p.religion]];
  if (p.politics) facts3.push(['정치 성향', p.politics]);
  blocks.push({ key: 'facts3', mt: 12, mb: 20, node: <Facts items={facts3} /> });
  if (extras[1]) blocks.push({ key: 'extra2', mt: 32, mb: 32, node: <Section title={extras[1].q} body={extras[1].a} /> });
  return (
    <View>
      <Gallery src={originalPhoto(p.photos[0])} width={width} blurred={blurred} onReveal={onReveal} onOpen={onOpen} overlay={photoOverlay} />
      <Stack blocks={blocks} firstTop={0} />
      <VerificationDialog target={verify} onClose={() => setVerify(null)} />
    </View>
  );
});

// ── 상대 프로필 본문(리뉴얼 1120 · 시안 #match-profile, spec-dating §3.3) ──
// 대표 사진 한 장(폭 × 400, 모서리 20) → 이름 ・나이 + 인증 배지 → 호감 칩 → 직업 → 사는 곳 → 정보 2열 → 질문 · 답과 사진이 번갈아.
// 대표가 아닌 사진은 이야기 사이마다 한 장씩, 남으면 마지막 이야기 뒤. 성별 · 해시태그는 보여 주지 않는다.
export type LikeChip = 'received' | 'mutual' | 'sent' | null;
const DRINK_TEXT: Record<string, string> = { 안마심: '술 안 마심', 가끔: '술 가끔', 즐김: '술 즐김' };

function LikeChipView({ kind, name }: { kind: Exclude<LikeChip, null>; name: string }) {
  const text = kind === 'received' ? '나에게 호감을 보냈어요' : kind === 'mutual' ? '서로 호감이 있어요' : `${name} 님에게 호감을 보냈어요`;
  // 처음 생길 때 · 글이 바뀔 때 4 아래에서 떠오른다
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 220, easing: ease.out, useNativeDriver: NATIVE }).start();
  }, [kind, v]);
  return (
    <Animated.View style={{ alignSelf: 'flex-start', marginTop: 12, height: 28, borderRadius: 14, paddingLeft: 8, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: kind === 'sent' ? colors.sub : colors.love, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }}>
      <RIcons.heartFill size={14} color={colors.inverse} />
      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.inverse }}>{text}</Text>
    </Animated.View>
  );
}

export const MatchProfile = memo(function MatchProfile({ p, width, like, balanceChip, onNameY }: {
  p: FullProfileData;
  width: number;                       // 콘텐츠 폭(화면 − 40)
  like: LikeChip;
  balanceChip?: string | null;         // 오늘의 밸런스에 참여한 사람 — 그 사람이 고른 답 '전 부먹파예요'
  onNameY?: (bottomY: number) => void; // 이름 줄 아래 끝(본문 기준) — 머리 줄에 이름을 띄울 때 쓴다
}) {
  const [certOpen, setCertOpen] = useState(false);
  const company = p.credentials?.find((c) => c.kind === 'company')?.label;
  const school = p.credentials?.find((c) => c.kind === 'school')?.label;
  const job = company || p.job;
  const edu = [p.education, school || p.school].filter(Boolean).join(' · ');
  const facts: { key: string; icon: React.ReactNode; value: string }[] = [];
  // 정보 아이콘은 미리보기 · 프로필 수정과 같은 FactIcon(피그마 Line 세트, 11-22)
  const add = (key: string, name: FactIconName, value?: string | null) => { if (value) facts.push({ key, icon: <FactIcon name={name} />, value }); };
  add('키', 'height', p.height ? `${p.height}cm` : null);
  add('성격', 'mbti', p.mbti);
  add('흡연', 'smoking', p.smoking);
  add('음주', 'drinking', p.drinking ? DRINK_TEXT[p.drinking] ?? `술 ${p.drinking}` : null);
  add('종교', 'religion', p.religion);
  add('학력', 'education', edu);
  add('정치 성향', 'politics', p.politics);   // 공개한 사람만 값이 온다

  const stories = [...(p.ideal ? [{ q: '이런 사람에게 마음이 가요', a: p.ideal }] : []), ...(p.extras ?? []).filter((x) => x?.q && x?.a)];
  const rest = p.photos.slice(1);
  const region = regionText(p.region);
  const cellW = (width - 12) / 2;
  const blocks: React.ReactNode[] = [];
  let prev: 'facts' | 'story' | 'photo' = 'facts';
  const photo = (src: string | number, i: number) => {
    blocks.push(<View key={`ph${i}`} accessibilityLabel={`${p.nickname}의 사진 ${i + 2}`} style={{ marginTop: prev === 'photo' ? 12 : 32 }}><ProfilePhoto src={src} width={width} height={width} radius={12} /></View>);
    prev = 'photo';
  };
  stories.forEach((st, i) => {
    blocks.push(
      <View key={`st${i}`} style={{ marginTop: prev === 'facts' ? 48 : prev === 'photo' ? 40 : 25 }}>
        <Text accessibilityRole="header" lineBreakStrategyIOS="hangul-word" style={{ fontFamily: fontSerif, fontSize: 22, lineHeight: 35, color: colors.accentStrong, ...keepAll }}>“{st.q}”</Text>
        <Text lineBreakStrategyIOS="hangul-word" style={{ marginTop: 16, fontSize: 16, lineHeight: 28.8, color: colors.textSecondary, ...keepAll }}>{st.a}</Text>
      </View>,
    );
    prev = 'story';
    if (rest[i] != null) photo(rest[i], i);
  });
  rest.slice(stories.length).forEach((src, k) => photo(src, stories.length + k));

  return (
    <View>
      <View accessibilityLabel={`${p.nickname}의 대표 사진`}>
        <ProfilePhoto src={originalPhoto(p.photos[0])} width={width} height={400} radius={20} position={{ top: '40%', left: '50%' }} />
      </View>
      <View onLayout={(e) => onNameY?.(e.nativeEvent.layout.y + e.nativeEvent.layout.height)} style={{ marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1, fontFamily: fontSerif, fontSize: 30, lineHeight: 39, letterSpacing: -0.5, color: colors.text }}>
          {p.nickname}
          {p.age != null && <Text>{' '}·{p.age}세</Text>}
        </Text>
        {p.basicVerified && (
          <Pressable onPress={() => setCertOpen(true)} accessibilityRole="button" accessibilityLabel={`인증 정보 보기${p.credentials?.length ? ' · 학력 · 직장 · 소득 인증 포함' : ' · 본인 인증'}`} hitSlop={11}>
            <CertBadge size={22} hi={!!p.credentials?.length} />
          </Pressable>
        )}
      </View>
      {(!!like || !!balanceChip) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
          {like && <LikeChipView kind={like} name={p.nickname} />}
          {!!balanceChip && (
            <View accessibilityLabel={`오늘의 밸런스, ${iAmChip(balanceChip)}`} style={{ alignSelf: 'flex-start', marginTop: 12, height: 28, borderRadius: 14, paddingLeft: 8, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bgSoft }}>
              <ScaleMark tilt={balanceChip} size={14} />
              <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.text }}>{iAmChip(balanceChip)}</Text>
            </View>
          )}
        </View>
      )}
      {!!job && (
        <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <FactIcon name="job" />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>{job}</Text>
        </View>
      )}
      {!!region && (
        <View style={{ marginTop: job ? 8 : 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <FactIcon name="pin" />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>{region}</Text>
        </View>
      )}
      {!!facts.length && (
        <View accessibilityLabel="정보" style={{ marginTop: 28, flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 14 }}>
          {facts.map((f) => (
            <View key={f.key} accessibilityLabel={`${f.key} ${f.value}`} style={{ width: cellW, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {f.icon}
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, lineHeight: 22, color: colors.textSecondary }}>{f.value}</Text>
            </View>
          ))}
        </View>
      )}
      {blocks}
      <CertDialog open={certOpen} name={p.nickname} basic={p.basicVerified} credentials={p.credentials} onClose={() => setCertOpen(false)} />
    </View>
  );
});

// FriendProfile(서버 행) → 표시용 데이터
export function toFullProfile(fp: {
  nickname: string; age: number | null; region: string | null; mbti: string | null; height: number | null;
  job?: string | null; univ_name?: string | null; education?: string | null; drinking: string | null; smoking: string | null;
  religion?: string | null; politics?: string | null; intro_want: string | null; headline: string | null;
  extra_answers?: { q: string; a: string }[] | null; photos: string[] | null;
  basic_verified?: boolean; credentials?: Credential[] | null;
}): FullProfileData {
  return {
    nickname: fp.nickname,
    age: fp.age,
    region: fp.region,
    mbti: fp.mbti,
    height: fp.height,
    job: fp.job,
    school: fp.univ_name,
    education: fp.education,
    drinking: fp.drinking,
    smoking: fp.smoking,
    religion: fp.religion,
    politics: fp.politics,
    ideal: fp.intro_want || fp.headline,
    extras: fp.extra_answers,
    photos: (fp.photos ?? []).filter(Boolean),
    basicVerified: !!fp.basic_verified,
    credentials: fp.credentials ?? null,
  };
}
