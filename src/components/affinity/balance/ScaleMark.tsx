// 오늘의 밸런스 칩의 기울어진 저울(라벨 저울 P안) — 고른 쪽으로 기울고 그쪽 접시가 채워진다. 칩 문구로 A · B를 가른다
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { BALANCE_Q } from './content';

export function ScaleMark({ tilt, size = 16 }: { tilt: string; size?: number }) {
  const a = tilt === BALANCE_Q.a.chip;
  const r = a ? -14 : 14;
  const dy = 1.21;
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M8 2.5v11M5 13.5h6" stroke="#39444D" strokeWidth={1.5} strokeLinecap="round" fill="none" />
      <Path d="M2.5 5h11" stroke="#39444D" strokeWidth={1.5} strokeLinecap="round" transform={`rotate(${r} 8 5)`} fill="none" />
      <Path d="M1.2 9.2 3 5l1.8 4.2a1.8 1.8 0 0 1-3.6 0z" transform={`translate(.15 ${a ? dy : -dy})`} fill={a ? '#4E8AB0' : 'none'} stroke="#4E8AB0" strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M11.2 9.2 13 5l1.8 4.2a1.8 1.8 0 0 1-3.6 0z" transform={`translate(-.15 ${a ? -dy : dy})`} fill={a ? 'none' : '#C78693'} stroke="#C78693" strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  );
}

