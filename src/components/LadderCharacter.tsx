// 야화 — 사다리게임 참가자 캐릭터. 외부 이미지 없이 SVG로 그린다(번들 가볍고 어떤 크기로도 선명).
// 12종을 손으로 그리지 않고 "얼굴색 + 귀 모양 + 포인트색" 조합 데이터로 생성한다.
import React from 'react';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';

type Ear = 'round' | 'pointy' | 'long' | 'none';

// 순서 = 참가자 번호. 파스텔 톤으로 브랜드(레드) 위에서도 서로 잘 구분되게 골랐다.
const CHARACTERS: { body: string; ear: Ear; inner: string; accent?: string }[] = [
  { body: '#F6A6A0', ear: 'round',  inner: '#FBD3D0' },                     // 1 돼지
  { body: '#FFD98A', ear: 'pointy', inner: '#FFEBC2' },                     // 2 고양이
  { body: '#FFFFFF', ear: 'long',   inner: '#FFD6E0' },                     // 3 토끼
  { body: '#8FD3F4', ear: 'round',  inner: '#C7E9FB' },                     // 4 물개
  { body: '#B8A0E8', ear: 'pointy', inner: '#DCCFF5' },                     // 5 여우
  { body: '#9BDBA6', ear: 'none',   inner: '#C8ECCF' },                     // 6 개구리
  { body: '#F5C89A', ear: 'round',  inner: '#FBE2CB' },                     // 7 곰
  { body: '#3D3D46', ear: 'round',  inner: '#6F6F78', accent: '#FFFFFF' },  // 8 판다
  { body: '#FFE9A8', ear: 'none',   inner: '#FFF4D2' },                     // 9 병아리
  { body: '#A8C8E8', ear: 'pointy', inner: '#D2E3F3' },                     // 10 늑대
  { body: '#F2A0C4', ear: 'long',   inner: '#F9CFE1' },                     // 11 플라밍고
  { body: '#C9B79A', ear: 'round',  inner: '#E3D8C6' },                     // 12 코알라
];

export const CHARACTER_COUNT = CHARACTERS.length;

export function LadderCharacter({
  index,
  size = 34,
  dimmed,
}: {
  index: number;
  size?: number;
  /** 이미 결과를 확인한 참가자는 흐리게 */
  dimmed?: boolean;
}) {
  const c = CHARACTERS[index % CHARACTERS.length];
  const eye = c.accent ?? '#2B2B31';
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" opacity={dimmed ? 0.4 : 1}>
      <G>
        {/* 귀 — 종류별로 위치/모양만 다르게 */}
        {c.ear === 'round' && (
          <>
            <Circle cx="9" cy="10" r="6" fill={c.body} />
            <Circle cx="31" cy="10" r="6" fill={c.body} />
            <Circle cx="9" cy="10" r="3" fill={c.inner} />
            <Circle cx="31" cy="10" r="3" fill={c.inner} />
          </>
        )}
        {c.ear === 'pointy' && (
          <>
            <Path d="M7 16 L8 4 L18 10 Z" fill={c.body} />
            <Path d="M33 16 L32 4 L22 10 Z" fill={c.body} />
            <Path d="M9.5 14 L10 8 L15.5 11 Z" fill={c.inner} />
            <Path d="M30.5 14 L30 8 L24.5 11 Z" fill={c.inner} />
          </>
        )}
        {c.ear === 'long' && (
          <>
            <Ellipse cx="13" cy="7" rx="3.6" ry="8" fill={c.body} />
            <Ellipse cx="27" cy="7" rx="3.6" ry="8" fill={c.body} />
            <Ellipse cx="13" cy="7.5" rx="1.7" ry="5.2" fill={c.inner} />
            <Ellipse cx="27" cy="7.5" rx="1.7" ry="5.2" fill={c.inner} />
          </>
        )}

        {/* 얼굴 */}
        <Circle cx="20" cy="23" r="14" fill={c.body} />
        {/* 주둥이/배 부분 하이라이트 */}
        <Ellipse cx="20" cy="27.5" rx="8" ry="6" fill={c.inner} opacity={0.85} />

        {/* 눈 — 살짝 아래로 처진 점눈이 가장 귀엽게 읽힌다 */}
        <Circle cx="15" cy="21.5" r="1.9" fill={eye} />
        <Circle cx="25" cy="21.5" r="1.9" fill={eye} />
        {/* 눈 하이라이트 */}
        <Circle cx="15.7" cy="20.8" r="0.6" fill="#FFFFFF" />
        <Circle cx="25.7" cy="20.8" r="0.6" fill="#FFFFFF" />

        {/* 볼터치 */}
        <Ellipse cx="10.5" cy="25.5" rx="2.4" ry="1.6" fill="#FF8B8B" opacity={0.45} />
        <Ellipse cx="29.5" cy="25.5" rx="2.4" ry="1.6" fill="#FF8B8B" opacity={0.45} />

        {/* 입 — 작은 스마일 */}
        <Path d="M17.5 27.5 Q20 30 22.5 27.5" stroke={eye} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </G>
    </Svg>
  );
}
