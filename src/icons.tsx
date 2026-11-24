// 야화 — Icons (ported from project/야화/icons.jsx) — Lucide-style, 24×24, stroke 2
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

// stroke — 선 굵기(기본 2). 리디자인(1010) 화면은 프로토타입처럼 얇은 1.5를 쓴다.
type IconProps = { size?: number; color?: string; stroke?: number };

const wrap =
  (paths: React.ReactNode, viewBox = '0 0 24 24') =>
  ({ size = 22, color = 'currentColor', stroke = 1.6 }: IconProps) =>
    (
      <Svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke={color === 'currentColor' ? '#212124' : color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths}
      </Svg>
    );

export const Icons = {
  // ── 리디자인(1010) 추가 아이콘 ──
  phone: wrap(<Path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" />),
  mic: wrap(<><Rect x="9" y="3" width="6" height="11" rx="3" /><Path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>),
  arrowUp: wrap(<Path d="M12 19V5M5 12l7-7 7 7" />),
  pencil: wrap(<Path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />),
  eye: wrap(<><Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><Circle cx="12" cy="12" r="3" /></>),
  hideMark: wrap(<Path d="m3 13 9-9 8 8-7 8H9ZM7 9l8 8M12 20h9" />),
  kakao: ({ size = 22, color = '#212124' }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M12 3C6 3 2 6.5 2 11c0 3 2 5.5 5 7l-1 4 5-3c6 .5 11-3 11-8 0-4.5-4-8-10-8Z" />
    </Svg>
  ),
  // 쉬어가기 — 초승달 (Lucide moon)
  moon: wrap(<Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />),

  // ── 프로토타입 v2(1013) 아이콘 — stroke 1.35~1.6 권장. heartP는 color만 바꿔 채움 여부를 정한다 ──
  dating: wrap(<Path d="M8 12a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2ZM16 12a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2ZM2.5 20c0-3.2 2.3-5.3 5.5-5.3 1.6 0 2.9.5 4 1.5 1.1-1 2.4-1.5 4-1.5 3.2 0 5.5 2.1 5.5 5.3" />),
  talk: wrap(<Path d="M4 5h16v11H11l-5 4v-4H4Z M8 9h8 M8 12h5" />),
  mapP: wrap(<Path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2Z M9 3v16 M15 5v16" />),
  heartP: ({ size = 22, color = '#212124', stroke = 1.6, filled = false }: IconProps & { filled?: boolean }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20.3 4.4 13a4.9 4.9 0 0 1 6.9-6.9l.7.7.7-.7a4.9 4.9 0 0 1 6.9 6.9Z" />
    </Svg>
  ),
  mailClosed: wrap(<Path d="M3 5h18v14H3Z M3 6l9 7 9-7" />),
  mailOpen: wrap(<Path d="M3 10l9-7 9 7v11H3Z M3 10l9 7 9-7 M6 12V7h12v5" />),
  letterTransit: wrap(<Path d="m8 5 12-2-4 12-3-5-5-5Zm5 5 7-7M3 10h4M2 14h6M6 18h5" />),
  letterArrived: wrap(<Path d="M3 9l9-6 9 6v12H3ZM3 9l9 7 9-7 M7 12V7h10v5 M8 19l4-3 4 3" />),
  letterMutual: wrap(<><Path d="M2 4h14v10H2ZM2 5l7 5 7-5M8 16v5h14V11h-4M8 16l7 4 7-7" /><Path d="m18 4 2 2 3-3" /></>),
  sliders: ({ size = 22, color = '#212124', stroke = 1.35, bg = '#fff' }: IconProps & { bg?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M3 12h18M3 18h18" />
      <Circle cx="8" cy="6" r="2" fill={bg} />
      <Circle cx="16" cy="12" r="2" fill={bg} />
      <Circle cx="9" cy="18" r="2" fill={bg} />
    </Svg>
  ),
  penP: wrap(<Path d="M4 20l4-1L20 7l-3-3L5 16Z M14 7l3 3" />),
  reply: wrap(<Path d="M10 4l-7 7 7 7 M3 11h9c6 0 8 4 8 8" />),
  up: wrap(<Path d="M12 21V3 M5 10l7-7 7 7" />),
  clock: wrap(<Path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 6v6l4 2" />),
  copy: wrap(<Path d="M8 8h13v13H8Z M16 8V3H3v13h5" />),
  leafP: wrap(<Path d="M20 3c-8-.2-15 3.1-15 10a7 7 0 0 0 12 4c3-3 3-9 3-14Z M4 21 16 8" />),
  // 시안 사이트 리프 — 잎 안을 16% 채우고 줄기(선 1.6). 헤더 잔액·리프 가격 표시용
  leafFilled: ({ size = 22, color = '#527760', stroke = 1.6 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 3C12 2.8 5 6.1 5 13a7 7 0 0 0 12 4c3-3 3-9 3-14Z" fill={color} fillOpacity={0.16} />
      <Path d="M4 21 16 8" />
    </Svg>
  ),
  ban: wrap(<Path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M5 5l14 14" />),
  // 인증 뱃지 — 리본 달린 배지 (Lucide badge-check 단순화)
  badge: wrap(
    <>
      <Circle cx={12} cy={9} r={6} />
      <Path d="m9 14.5-1.5 6L12 18l4.5 2.5-1.5-6" />
      <Path d="m9.5 9 1.8 1.8L14.8 7.3" />
    </>,
  ),
  home: wrap(
    <>
      <Path d="m3 11 9-8 9 8" />
      <Path d="M5 10v10h14V10" />
    </>,
  ),
  lounge: wrap(
    <>
      <Path d="M3 7h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <Path d="M8 3v4M16 3v4M3 11h18" />
    </>,
  ),
  map: wrap(
    <>
      <Path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
      <Path d="M9 4v16M15 6v16" />
    </>,
  ),
  chat: wrap(<Path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z" />),
  user: wrap(
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </>,
  ),
  search: wrap(
    <>
      <Circle cx="11" cy="11" r="7" />
      <Path d="m20 20-3.5-3.5" />
    </>,
  ),
  flag: wrap(
    <>
      <Path d="M5 21V4" />
      <Path d="M5 4h11l-2 4 2 4H5" />
    </>,
  ),
  block: wrap(
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M5.6 5.6l12.8 12.8" />
    </>,
  ),
  bell: wrap(
    <>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" />
      <Path d="M10 21a2 2 0 0 0 4 0" />
    </>,
  ),
  lock: wrap(
    <>
      <Rect x={4} y={11} width={16} height={9} rx={2} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>,
  ),
  unlock: wrap(
    <>
      <Rect x={4} y={11} width={16} height={9} rx={2} />
      <Path d="M8 11V7a4 4 0 0 1 8 0" />
    </>,
  ),
  more: ({ size = 22, color = '#212124' }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="6" r="1.5" fill={color} />
      <Circle cx="12" cy="12" r="1.5" fill={color} />
      <Circle cx="12" cy="18" r="1.5" fill={color} />
    </Svg>
  ),
  edit: wrap(<Path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />),
  chevDown: wrap(<Path d="m6 9 6 6 6-6" />),
  leaf: wrap(
    <>
      <Path d="M11 20a8 8 0 0 0 8-8V4h-8a8 8 0 0 0 0 16Z" />
      <Path d="M11 20c0-4 1-8 5-12" />
    </>,
  ),
  back: wrap(<Path d="M15 5 8 12l7 7" />),
  bookmark: wrap(<Path d="M6 3h12v18l-6-4-6 4V3Z" />),
  heart: wrap(<Path d="M12 21s-7-4.5-9-9.5C1.5 7 5 4 8 4c2 0 3 1 4 3 1-2 2-3 4-3 3 0 6.5 3 5 7.5-2 5-9 9.5-9 9.5Z" />),
  send: wrap(<Path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />),
  comment: wrap(<Path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z" />),
  shield: wrap(<Path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />),
  chev: wrap(<Path d="m9 6 6 6-6 6" />),
  check: wrap(<Path d="m5 12 5 5L20 7" />),
  // 톱니바퀴(1014 대표 지시 — 설정)
  setting: wrap(
    <>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>,
  ),
  card: wrap(
    <>
      <Rect x={3} y={6} width={18} height={13} rx={2} />
      <Path d="M3 10h18M7 15h3" />
    </>,
  ),
  history: wrap(
    <>
      <Path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <Path d="M3 3v5h5" />
      <Path d="M12 7v5l3 2" />
    </>,
  ),
  store: wrap(
    <>
      <Path d="M3 9 4 4h16l1 5" />
      <Path d="M3 9v11h18V9" />
      <Path d="M3 9c0 2 2 3 3 3s3-1 3-3M9 9c0 2 1 3 3 3s3-1 3-3M15 9c0 2 1 3 3 3s3-1 3-3" />
    </>,
  ),
  filter: wrap(<Path d="M3 5h18M6 12h12M10 19h4" />),
  calendar: wrap(
    <>
      <Rect x={3} y={5} width={18} height={16} rx={2} />
      <Path d="M3 10h18M8 3v4M16 3v4" />
    </>,
  ),
  pin: wrap(
    <>
      <Path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z" />
      <Circle cx={12} cy={9} r={2.5} />
    </>,
  ),
  share: wrap(
    <>
      <Circle cx={6} cy={12} r={3} />
      <Circle cx={18} cy={6} r={3} />
      <Circle cx={18} cy={18} r={3} />
      <Path d="m9 11 6-3M9 13l6 3" />
    </>,
  ),
  chevLeft: wrap(<Path d="m15 6-6 6 6 6" />),
  plus: wrap(<Path d="M12 5v14M5 12h14" />),
  minus: wrap(<Path d="M5 12h14" />),
  image: wrap(<><Path d="M3 5h18v14H3z" /><Path d="M3 15l5-5 4 4 3-3 6 6" /></>),
  close: wrap(<Path d="M18 6 6 18M6 6l12 12" />),
  info: wrap(
    <>
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 16v-5" />
      <Path d="M12 8h.01" />
    </>,
  ),
  // ── 프로필 상세 기본정보 (이모지 → 라인 아이콘 교체, 대표 지시 0826) ──
  // 직업 — Lucide briefcase
  briefcase: wrap(
    <>
      <Rect x={2} y={7} width={20} height={14} rx={2} />
      <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>,
  ),
  // 키 — Lucide ruler
  ruler: wrap(
    <>
      <Path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
      <Path d="m8.5 6.5-2 2" />
      <Path d="m11.5 9.5-2 2" />
      <Path d="m14.5 12.5-2 2" />
      <Path d="m17.5 15.5-2 2" />
    </>,
  ),
  // 종교 — 특정 종교를 가리키지 않는 중립 기호(Lucide compass). '무교'에도 어색하지 않다.
  compass: wrap(
    <>
      <Circle cx={12} cy={12} r={10} />
      <Path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" />
    </>,
  ),
  // 정치성향 — Lucide vote
  vote: wrap(
    <>
      <Path d="m9 12 2 2 4-4" />
      <Path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z" />
      <Path d="M22 19H2" />
    </>,
  ),
  // 흡연 — 금연 표시가 아니라 담배(값이 '흡연'일 때 뜻이 뒤집히지 않도록)
  cigarette: wrap(
    <>
      <Path d="M18 12H2v4h16" />
      <Path d="M22 12v4" />
      <Path d="M18 8c0-2.5-2-2.5-2-5" />
      <Path d="M22 8c0-2.5-2-2.5-2-5" />
    </>,
  ),
  // 음주 — Lucide martini
  martini: wrap(
    <>
      <Path d="M8 22h8" />
      <Path d="M12 11v11" />
      <Path d="m19 3-7 8-7-8Z" />
    </>,
  ),
  // 받은 메시지 빈 화면 — Lucide mail
  mail: wrap(
    <>
      <Rect x={2} y={4} width={20} height={16} rx={2} />
      <Path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>,
  ),
  // 학교 인증 — Lucide graduation-cap
  gradCap: wrap(
    <>
      <Path d="M22 10v6" />
      <Path d="M6 12.5V16c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-3.5" />
      <Path d="M12 3 2 8l10 5 10-5-10-5Z" />
    </>,
  ),
  // 모임 카테고리 — 자유만남(Lucide users)
  users: wrap(
    <>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
  ),
  // 운동 — Lucide dumbbell
  dumbbell: wrap(
    <>
      <Path d="M6.5 6.5v11" />
      <Path d="M17.5 6.5v11" />
      <Path d="M3 9.5v5" />
      <Path d="M21 9.5v5" />
      <Path d="M6.5 12h11" />
    </>,
  ),
  // 문화·취미 — Lucide palette
  palette: wrap(
    <>
      <Circle cx={13.5} cy={6.5} r={0.5} />
      <Circle cx={17.5} cy={10.5} r={0.5} />
      <Circle cx={8.5} cy={7.5} r={0.5} />
      <Circle cx={6.5} cy={12.5} r={0.5} />
      <Path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </>,
  ),
  // 전체 카테고리 — Lucide layout-grid
  grid: wrap(
    <>
      <Rect x={3} y={3} width={7} height={7} rx={1} />
      <Rect x={14} y={3} width={7} height={7} rx={1} />
      <Rect x={3} y={14} width={7} height={7} rx={1} />
      <Rect x={14} y={14} width={7} height={7} rx={1} />
    </>,
  ),
};
