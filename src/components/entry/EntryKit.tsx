// 야화 — 진입·가입 화면 공용 조각 (시안 사이트 .entry-flow '시스템 적용' 실측, 1013)
// 머리줄(‹ · YAHWA) · 작은 머리말 · 31px 제목 · 회색 안내 · 52px 주 버튼 · 동의 줄 · 밑줄 입력 · 선택 칩.
// 색은 전부 colors.*를 렌더 때 읽는다(다크 모드). 시안 글자는 모두 자간 -0.24px(-0.015em)를 물려받는다.
import React from 'react';
import { View, Text, Pressable, TextInput, Platform, type TextInputProps, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, getThemeMode } from '../../tokens';
import { sendBg, sendInk, panelBorder } from '../ProtoModal';

export const LS = -0.24;

// 머리줄 — 시안 1027: 높이 62 · 아래 12 · 안 8/16, 왼쪽 ‹(44칸 · 29px·300), 가운데 YAHWA(20/27 700 · 자간 −0.5), 오른쪽 빈칸 30
export function EntryHeader({ onBack, backLabel = '뒤로' }: { onBack?: () => void; backLabel?: string }) {
  return (
    <View style={{ height: 62, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface }}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={{ left: 12, right: 8 }}
          style={({ pressed }) => ({ width: 44, height: 49.84, paddingHorizontal: 6, justifyContent: 'center', transform: [{ scale: pressed ? 0.985 : 1 }] })}
        >
          <Text style={{ fontSize: 29, lineHeight: 47.85, fontWeight: '300', color: colors.text, letterSpacing: LS }}>‹</Text>
        </Pressable>
      ) : (
        <View style={{ width: 44 }} />
      )}
      <Text style={{ fontSize: 20, lineHeight: 27, fontWeight: '700', color: colors.text, letterSpacing: -0.5 }}>YAHWA</Text>
      <View style={{ width: 30 }} />
    </View>
  );
}

// 본문 여백 — 시안 1027 .entry-content: 위아래 24 · 좌우 20
export const entryContentPad = { paddingTop: 24, paddingHorizontal: 20, paddingBottom: 24 } as const;

// 16px 줄(26.4) 안에 기준선을 맞춰 놓인 12px 글자(시안 inline small) — 줄 높이 19.8 글자를 5px 내려 26.4 칸에 둔다
export function InlineSmall({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ height: 26.4 }}>
      <Text style={{ marginTop: 5, fontSize: 12, lineHeight: 19.8, color: colors.sub, letterSpacing: LS }}>{children}</Text>
    </View>
  );
}

// 작은 머리말(.entry-eyebrow, 1027) — 본문 줄(16/26.4) 안의 13/700 회색 글자
export function EntryEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 16, lineHeight: 26.4, letterSpacing: LS }}>
      <Text style={{ fontSize: 13, lineHeight: 21.45, fontWeight: '700', color: colors.sub, letterSpacing: LS }}>{children}</Text>
    </Text>
  );
}

// 큰 제목 — 시안 1027: 28/40.6 · 700 · 자간 −0.7, 위 12 아래 16
export function EntryTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text accessibilityRole="header" style={[{ marginTop: 12, marginBottom: 16, fontSize: 28, lineHeight: 40.6, fontWeight: '700', color: colors.text, letterSpacing: -0.7 }, style]}>
      {children}
    </Text>
  );
}

// 제목 아래 회색 안내 — 시안 1027: 16/27.2 회색(아래 16)
export function EntryLead({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontSize: 16, lineHeight: 27.2, color: colors.sub, letterSpacing: LS }, style]}>{children}</Text>;
}

// 회색 메모(.entry-prototype-note / .entry-demo-label) — 시안 1027: 13/21.45
export function EntryNote({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontSize: 13, lineHeight: 21.45, color: colors.sub, letterSpacing: LS }, style]}>{children}</Text>;
}

// 오류 문구(.form-error) — 13px 빨강
export function FormError({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="alert" style={[{ fontSize: 13, lineHeight: 23.4, color: colors.danger, letterSpacing: LS }, style]}>{children}</Text>;
}

// 주 버튼(.send-button) — 시안 1027: 높이 52(안 14/18) · 둥글기 16 · #f1f2f3 바탕 · #42474d 16/23.2 700.
// 못 누르면 #f5f5f7 바탕 · 흐린 글자
export function EntryButton({ label, onPress, disabled, style }: {
  label: string; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          minHeight: 52, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          backgroundColor: disabled ? (getThemeMode() === 'dark' ? colors.bgSoft : '#f5f5f7') : sendBg(),
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 16, lineHeight: 23.2, fontWeight: '700', color: disabled ? colors.disabled : sendInk(), letterSpacing: LS }}>{label}</Text>
    </Pressable>
  );
}

// 하단 고정 줄(.entry-flow > footer) — 시안 1027: 위 12 · 좌우 20 · 아래 20 (안전영역은 바깥 SafeAreaView가 맡는다)
export function EntryFooter({ children }: { children: React.ReactNode }) {
  return <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: colors.surface }}>{children}</View>;
}

// 글자 버튼(.entry-text-button) — 시안 1027: 14/23.1 600 회색, 위아래 23
export function EntryTextButton({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [{ paddingVertical: 23, alignSelf: 'flex-start', transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}>
      <Text style={{ fontSize: 14, lineHeight: 23.1, fontWeight: '600', color: colors.sub, letterSpacing: LS }}>{label}</Text>
    </Pressable>
  );
}

// 카카오 로그인 버튼 — 크기·둥글기·간격은 시안 1027(.entry-login-options button: 높이 52 · 둥글기 16 · 좌우 17 · 아이콘 22 · 16/650),
// 색은 카카오 로그인 디자인 가이드(바탕 #FEE500 · 검정 말풍선 심볼 · 글자 검정 85%). 다크 모드에서도 같은 노랑.
export function KakaoButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="카카오로 시작하기"
      style={({ pressed }) => ({
        minHeight: 52, borderRadius: 16, paddingHorizontal: 17, backgroundColor: '#FEE500',
        flexDirection: 'row', alignItems: 'center', gap: 13,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path fill="#000000" d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.88 5.37 4.7 6.79l-.96 3.53c-.08.31.27.56.54.38l4.2-2.78c.5.05 1 .08 1.52.08 5.52 0 10-3.58 10-8S17.52 3 12 3Z" />
      </Svg>
      <Text style={{ fontSize: 16, lineHeight: 26.4, fontWeight: '650' as any, color: 'rgba(0,0,0,0.85)', letterSpacing: LS }}>{label}</Text>
    </Pressable>
  );
}

// 시안 브랜드 표식(Y) — 48 · 회색(시안 1027 .entry-brand)
export function YahwaMark({ size = 48 }: { size?: number }) {
  const c = colors.sub;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path d="M12 12l12 17 12-17M24 29v10" stroke={c} strokeWidth={2} strokeLinecap="round" />
      <Circle cx="24" cy="8" r="2" fill={c} />
    </Svg>
  );
}

// 동의 줄(.entry-consents button) — 시안 1027: 안 12 · 높이 52 · 둥글기 14 · 20px 원(체크 시 #42474d) · 15px 글자 · 오른쪽 12px 꼬리표.
// '모두 동의'(strong) 줄만 아래 1px 선 · 아래 8
export function ConsentRow({ checked, onToggle, label, strong, tag, onOpen, openLabel }: {
  checked: boolean; onToggle: () => void; label: string; strong?: boolean; tag?: string;
  onOpen?: () => void; openLabel?: string;
}) {
  return (
    // 오른쪽 20은 약관 보기 '›' 자리(줄 밖 여백) — 안드로이드는 부모 밖 터치를 받지 않아 칸을 넓혀 둔다
    <View style={{ marginRight: -20, paddingRight: 20 }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={tag ? `${tag} ${label}` : label}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, padding: 12, borderRadius: strong ? 0 : 14,
          ...(strong ? { marginBottom: 8, borderBottomWidth: 1, borderBottomColor: panelBorder() } : null),
          transform: [{ scale: pressed ? 0.985 : 1 }],
        })}
      >
        <View
          style={{
            width: 20, height: 20, borderRadius: 10, borderWidth: 1,
            borderColor: checked ? sendInk() : colors.line,
            backgroundColor: checked ? sendInk() : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 11, lineHeight: 18.15, color: checked ? colors.surface : colors.line, letterSpacing: LS }}>✓</Text>
        </View>
        <Text style={{ flexShrink: 1, fontSize: 15, lineHeight: 24.75, fontWeight: strong ? '700' : '400', color: colors.text, letterSpacing: LS }}>{label}</Text>
        {tag ? <Text style={{ marginLeft: 'auto', fontSize: 12, lineHeight: 19.8, color: colors.sub, letterSpacing: LS }}>{tag}</Text> : null}
      </Pressable>
      {onOpen ? (
        // 약관 원문 보기 — 시안 '›' 글자(회색). 꼬리표(필수·선택)가 시안 자리 그대로 있도록 줄 오른쪽 바깥 여백에 둔다
        <Pressable onPress={onOpen} accessibilityRole="link" accessibilityLabel={openLabel ?? `${label} 보기`} hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20, lineHeight: 32, color: colors.sub, letterSpacing: LS }}>›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// 입력 칸(.line-input) — 시안 1027: #f5f5f7 바탕 · 안 16 · 둥글기 16 · 16/26.4(빈칸 안내는 14px 회색) · 커서 파랑
export function LineInput({ unit, value, ...rest }: TextInputProps & { unit?: string }) {
  return (
    <View>
      <TextInput
        value={value}
        placeholderTextColor={colors.sub}
        selectionColor={colors.action}
        {...rest}
        style={[
          {
            minHeight: 60.39, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'transparent',
            backgroundColor: getThemeMode() === 'dark' ? colors.bgSoft : '#f5f5f7',
            fontSize: value ? 16 : 14, color: colors.text, letterSpacing: LS,
          },
          unit ? { paddingRight: 34 } : null,
          // 웹 전용 — 포커스 테두리 없음 · 커서 파랑(시안 caret-color: action)
          Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none', caretColor: colors.action } as any) : null,
        ]}
      />
      {unit ? (
        <Text pointerEvents="none" style={{ position: 'absolute', right: 16, bottom: 20, fontSize: 12, lineHeight: 19.8, color: colors.sub, letterSpacing: LS }}>{unit}</Text>
      ) : null}
    </View>
  );
}

// 입력 묶음 라벨(.entry-phone-label) — 시안 1027: 14/23.1 650 회색, 입력은 8 아래
export function FieldLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontSize: 14, lineHeight: 23.1, fontWeight: '650' as any, color: colors.sub, letterSpacing: LS }, style]}>{children}</Text>;
}

export function LineField({ label, style, ...input }: TextInputProps & { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <FieldLabel>{label}</FieldLabel>
      <View style={{ marginTop: 8 }}>
        <LineInput accessibilityLabel={label} {...input} />
      </View>
    </View>
  );
}

// 선택 칩(.pref-chips button) — 시안 1027: 높이 44 · 안 10/14 · 둥글기 14 · 옅은 테두리 · 14/600 회색, 고르면 #f1f2f3 바탕 · #42474d 700
export function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1,
        borderColor: selected ? sendBg() : panelBorder(), backgroundColor: selected ? sendBg() : colors.surface, justifyContent: 'center',
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <Text style={{ fontSize: 14, lineHeight: 23.1, fontWeight: selected ? '700' : '600', color: selected ? sendInk() : colors.sub, letterSpacing: LS }}>{label}</Text>
    </Pressable>
  );
}

// 생년월일 칸 하나 — 밑줄 입력 + 오른쪽 단위(년·월·일)
export function DobField({
  label, value, setValue, max, placeholder, flex,
}: {
  label: string; value: string; setValue: (v: string) => void;
  max: number; placeholder: string; flex: number;
}) {
  return (
    <View style={{ flex }}>
      <LineInput
        unit={label}
        value={value}
        onChangeText={(t) => setValue(t.replace(/[^0-9]/g, '').slice(0, max))}
        keyboardType="number-pad"
        maxLength={max}
        placeholder={placeholder}
        accessibilityLabel={`생년월일 ${label}`}
      />
    </View>
  );
}
