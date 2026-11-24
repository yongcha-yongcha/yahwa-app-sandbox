// 야화 — 리프 가격 표기(1014 대표 지시: 여성은 모든 유료 기능 무료 — 원가에 취소선 + 0).
// 잎 아이콘은 각 화면이 그린다. 여기는 숫자 부분만.
import React from 'react';
import { Text, type TextStyle } from 'react-native';
import { colors } from '../tokens';

// free면 '원가(취소선) 0', 아니면 원가만
export function PriceText({ cost, free, style }: { cost: number; free?: boolean; style?: TextStyle }) {
  const base: TextStyle = { fontSize: 14, lineHeight: 19.6, fontWeight: '600', color: colors.text, letterSpacing: -0.24, fontVariant: ['tabular-nums'], ...style };
  if (!free || cost <= 0) return <Text style={base}>{free ? 0 : cost}</Text>;
  return (
    <Text style={base}>
      <Text style={{ fontSize: Math.round((base.fontSize ?? 14) * 0.8), fontWeight: '400', opacity: 0.7, textDecorationLine: 'line-through' }}>{cost}</Text>
      {' 0'}
    </Text>
  );
}
