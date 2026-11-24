// 쿠폰함(지도) 전용 선 아이콘 — 킷 Icon에 없는 것만
import React from 'react';
import Svg, { Path } from 'react-native-svg';

type P = { size?: number; color: string; stroke?: number };

// 지도 확대(+) · 축소(−)
export function ZoomIcon({ minus, size = 16, color, stroke = 2.4 }: P & { minus?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round">
      <Path d={minus ? 'M5 12h14' : 'M5 12h14M12 5v14'} />
    </Svg>
  );
}
