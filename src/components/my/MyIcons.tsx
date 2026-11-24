// 야화 — 시안 사이트 아이콘(app_code.js F·pe) — MY 화면과 MY 모달 전용.
// 시안은 .yi에 stroke-width 1.4를 덮어쓴다(실측, MY 화면은 1015 개정으로 1.85 · 리프 2). 크기는 시안 실측 px 그대로 넘긴다.
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { LeafIcon } from '../../ui';

const D = {
  next: 'M9 5l7 7-7 7',
  back: 'M15 5l-7 7 7 7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-8 16-8 16 0',
  pen: 'M4 20l4-1L20 7l-3-3L5 16Z M14 7l3 3',
  lock: 'M6 10h12v11H6Z M8 10V7a4 4 0 0 1 8 0v3',
  mail: 'M3 5h18v14H3Z M3 6l9 7 9-7',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 10v7 M12 6v1',
  heart: 'M12 20.3 4.4 13a4.9 4.9 0 0 1 6.9-6.9l.7.7.7-.7a4.9 4.9 0 0 1 6.9 6.9Z',
  dating: 'M8 12a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2ZM16 12a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2ZM2.5 20c0-3.2 2.3-5.3 5.5-5.3 1.6 0 2.9.5 4 1.5 1.1-1 2.4-1.5 4-1.5 3.2 0 5.5 2.1 5.5 5.3',
  talk: 'M4 5h16v11H11l-5 4v-4H4Z M8 9h8 M8 12h5',
  bell: 'M5 17h14l-2-4V8a5 5 0 0 0-10 0v5Z M10 21h4',
  // 시안 1015 개정 MY 메뉴 아이콘
  badge: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M7.5 12l3 3 6-6',
  gear: 'M9.5 3h5l.6 2.4 2 .9 2.2-.7 2.5 4.3-1.7 1.7v2.3l1.7 1.7-2.5 4.3-2.2-.7-2 .9-.6 2.4h-5l-.6-2.4-2-.9-2.2.7L2.2 15.9l1.7-1.7v-2.3L2.2 10.2l2.5-4.3 2.2.7 2-.9Z M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z',
  contrast: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 2v20 M15 5v14 M18 8v8',
  map: 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2Z M9 3v16 M15 5v16',
} as const;

export type MyIconName = keyof typeof D | 'leaf';

// 리프 — 앱 공용 리프(LeafIcon · 피그마 Line/Nature/leaf)와 같은 모양(11-22 얇은 선 잎 → 통일)
export function LeafMark({ size = 40, color }: { size?: number; color: string }) {
  return <LeafIcon size={size} color={color} />;
}

export function MyIcon({ n, size = 20, color, stroke = 1.4 }: { n: MyIconName; size?: number; color: string; stroke?: number }) {
  if (n === 'leaf') return <LeafMark size={size} color={color} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d={D[n]} />
    </Svg>
  );
}

// 시안 .help-icon(1020) — 원 안 물음표(28 격자) · 기본 22px · 선 2.5
export function HelpIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={14} cy={14} r={12} />
      <Path d="M10.8 10a3.3 3.3 0 0 1 6.4 1c0 2.4-3.2 2.6-3.2 5" />
      <Circle cx={14} cy={20} r={1} fill={color} stroke="none" />
    </Svg>
  );
}
