// 야화 UI 킷 — 글자 도우미. 프리셋 값은 tokens.type(spec-shell §1.4).
// <T v="tabTitle">마음함</T> · <T v="body2" color={colors.sub}>…</T>. 명조 프리셋은 글꼴까지 들어 있다.
// 주의: 명조 Text 안에 끼운 Text는 명조를 물려받는다(고딕으로 바꾸려면 fontFamily: 'Pretendard').
import React from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';
import { type } from '../tokens';

export type TypeName = keyof typeof type;
// 한글은 낱말 단위로 줄을 바꾼다(시안 word-break: keep-all)
const KEEP_ALL = (Platform.OS === 'web' ? { wordBreak: 'keep-all' } : null) as TextStyle | null;

export function T({ v = 'body2', color, center, style, ...rest }: TextProps & { v?: TypeName; color?: string; center?: boolean }) {
  const serifTitle = type[v].fontFamily != null;
  return (
    <Text
      lineBreakStrategyIOS="hangul-word"
      accessibilityRole={serifTitle && !rest.accessibilityRole ? 'header' : rest.accessibilityRole}
      {...rest}
      style={[type[v], KEEP_ALL, color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
    />
  );
}
