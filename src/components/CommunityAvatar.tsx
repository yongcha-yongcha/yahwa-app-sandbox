// 야화 — 커뮤니티 익명 얼굴(리뉴얼 1120, spec-rest §2.8 · §10 A-3)
// 시안 anonSketch()의 손그림 인물 12종(viewBox 72×80) — 여성 6(짝수 번호) · 남성 6(홀수 번호).
// 원 바탕은 성별 색: 여성 rose-100 · 남성 sky-100, 안쪽 여백 2. 성별을 모르는 예전 글은 회색 원 + 사람 선 그림.
// 어떤 얼굴인지는 seed(글 id + 작성자 id)의 해시로 고정한다 — 같은 글 안의 같은 사람은 늘 같은 얼굴.
//   variant를 직접 주면 그 번호(0~5)를 쓴다(글 상세에서 사람마다 겹치지 않게 나눠 줄 때).
// ring: 글쓴이가 단 댓글(바탕 2 + 강조 파랑 1.5 고리) · dim: 지운 글·댓글(투명도 45%).
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors, palette } from '../tokens';

const HAIR = [
  'M25 29C17 15 30 8 41 15C46 19 43 27 48 29M24 21Q33 25 40 16M23 25Q18 34 26 37',
  'M24 30C18 14 35 9 42 18L47 36M24 20Q33 17 40 23M40 23L44 27',
  'M22 37L23 23C23 8 43 11 44 24L46 40M28 17L28 37',
  'M24 27C16 21 23 10 35 13C48 10 49 26 42 29M24 20Q33 24 42 18',
  'M22 45Q14 37 23 24C18 10 42 8 45 22L48 46M25 19Q33 23 41 18',
  'M23 26L21 18L27 14L30 10L35 14L40 11L45 18L43 27',
  'M23 32Q14 27 20 19C12 8 24 5 28 14Q41 8 45 22M26 20L42 18',
  'M22 29L22 18Q32 8 43 16L46 29M24 20L33 17L41 21',
  'M21 43Q14 34 23 19Q31 8 42 17Q51 26 45 44M27 18Q35 24 42 20',
  'M22 25Q17 13 27 12Q34 6 43 14L45 25M24 19L41 19',
  'M22 43L22 23Q22 10 35 12Q47 12 46 25L46 43M25 22L42 22M31 14L31 21',
  'M22 27L21 17Q34 7 45 18L44 27M25 19Q35 22 42 17',
];
const SHIRT = 'M14 77L18 50Q21 43 29 42L35 49L42 42Q52 44 56 53L61 77';
const FACE = 'M28 25L28 33Q34 42 41 33L42 27M30 38L29 43M39 38L42 43M19 54L16 73M52 54L56 74M29 43Q34 55 42 43';
const EYES = 'M32 28h.3M39 28h.3';
const GLASSES = 'M26 26h9v6h-9zM37 26h8v6h-8zM35 28h2';

// 성별 색(시안 .gender-sketch): 원 바탕 · 옷 채움 · 선
const TONE = {
  F: { bg: colors.loveSoft, shirt: palette.rose[300], line: colors.love },
  M: { bg: colors.selected, shirt: colors.control, line: colors.sub },
} as const;

// 문자열 → 0~5 (같은 seed는 늘 같은 얼굴)
export function faceVariant(seed: string | null | undefined): number {
  const s = seed ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 6;
}

export function CommunityAvatar({ gender, size = 32, seed, variant, ring, dim }: {
  gender?: 'M' | 'F' | null; size?: number; seed?: string | null; variant?: number; ring?: boolean; dim?: boolean;
}) {
  const known = gender === 'M' || gender === 'F';
  const tone = known ? TONE[gender] : null;
  const v = ((variant ?? faceVariant(seed)) % 6 + 6) % 6;
  const n = gender === 'F' ? v * 2 : v * 2 + 1;
  const inner = size - 4;
  const face = (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: tone ? tone.bg : colors.line, alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.45 : 1 }}>
      {tone ? (
        <Svg width={inner} height={inner} viewBox="0 0 72 80">
          <Path d={SHIRT} fill={tone.shirt} stroke={colors.textSecondary} strokeWidth={1.5} strokeLinejoin="round" />
          <G fill="none" stroke={tone.line} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <Path d={HAIR[n]} />
            {(n === 3 || n === 7 || n === 11) && <Path d={GLASSES} />}
            <Path d={FACE} />
            <Path d={EYES} />
          </G>
        </Svg>
      ) : (
        <Svg width={inner} height={inner} viewBox="0 0 72 80" fill="none" stroke={colors.mute} strokeWidth={3} strokeLinecap="round">
          <Circle cx="36" cy="27" r="12" />
          <Path d="M14 70Q14 46 36 46Q58 46 58 70" />
        </Svg>
      )}
    </View>
  );
  if (!ring) return face;
  // 글쓴이 고리 — 얼굴 밖으로 바탕 2 + 강조 파랑 1.5(자리를 차지하지 않게 겹쳐 그린다)
  return (
    <View style={{ width: size, height: size }}>
      {face}
      <View pointerEvents="none" style={{ position: 'absolute', left: -3.5, top: -3.5, right: -3.5, bottom: -3.5, borderRadius: size / 2 + 3.5, borderWidth: 1.5, borderColor: colors.accent }} />
    </View>
  );
}
