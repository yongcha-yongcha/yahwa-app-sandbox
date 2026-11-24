// 시안 사이트(시스템 적용) 공용 대화상자·시트 — 프로필 편집과 인증 관리가 같이 쓴다.
// 값은 시안 실측(408×820): review-modal · editor-picker · send-button · modal-close · person-row · picker-options
import React, { useState } from 'react';
import { Modal, Pressable, View, Text, ScrollView, TextInput, Platform, useWindowDimensions, type PressableStateCallbackType, type TextInputProps } from 'react-native';
import { colors, scrimColor, getThemeMode } from '../../tokens';
import { pressFx as sharedPressFx } from '../../lib/press';
import { KeyboardAware, useKeyboardHeight } from '../KeyboardAware';

// 시안 본문 자간(-0.015em @16px = -0.24px). 시안은 이 값이 모든 글자에 상속된다.
export const LS = -0.24;
// 시안 공통 누름 효과 — 공용 값(lib/press, 1022: 투명도 0.8 · 0.985배 · 0.22초 되돌림)
export const pressFx = ({ pressed }: PressableStateCallbackType) => sharedPressFx(pressed);
// 웹 입력창 포커스 테두리 제거
export const noOutline = Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as any) : null;
// 입력창 — 시안 디자인 시스템처럼 포커스 때 2px 파란 테두리(3px 띄움). 웹만(앱은 기본 커서로 충분).
export function FocusInput({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  const ring = Platform.OS === 'web'
    ? (focused ? ({ outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.action, outlineOffset: 3 } as any) : noOutline)
    : null;
  return (
    <TextInput
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      style={[style, ring]}
    />
  );
}
// 바텀 시트 뒤 막(#252a3030) — 다크는 공용 막
const pickerScrim = () => (getThemeMode() === 'dark' ? scrimColor() : 'rgba(37,42,48,0.19)');

// ── 가운데 대화상자(review-modal) ───────────────────────────────────────────
export function ReviewModal({ title, onClose, children, label }: {
  title: string; onClose: () => void; children?: React.ReactNode; label?: string;
}) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      {/* 키보드 회피(닉네임 변경 등 입력) — 막은 바깥(KeyboardAware)에 깔아 키보드가 올라오는 동안에도 빈틈이 없게 */}
      <KeyboardAware style={{ flex: 1, backgroundColor: scrimColor() }}>
      <Pressable onPress={onClose} style={[{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }, noOutline]}>
        <Pressable
          accessibilityViewIsModal
          accessibilityLabel={label ?? title}
          onPress={(e) => e.stopPropagation()}
          style={[{ width: '100%', maxWidth: 520, maxHeight: '100%', backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden' }, noOutline]}
        >
          <ScrollView bounces={false} contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 22, lineHeight: 31.9, fontWeight: '600', color: colors.text, letterSpacing: LS, marginBottom: 16 }}>{title}</Text>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
      </KeyboardAware>
    </Modal>
  );
}

// 대화상자 본문 문단(p) — 첫 문단은 제목 바로 아래(16), 다음 문단부터 14 간격
export function ModalText({ children, first = true }: { children: React.ReactNode; first?: boolean }) {
  return <Text style={{ fontSize: 14, lineHeight: 25.2, color: colors.sub, letterSpacing: LS, marginTop: first ? 0 : 14 }}>{children}</Text>;
}

// 주 버튼(send-button) — 시안 1016: 연회색 바탕(ds-soft) · 진회색 글자 · 둥글기 12.
// 화면 아래 고정 버튼(compose-bottom)은 18/25.2(높이 57.2), 대화상자·시트 안은 17/23.8(높이 55.8)
export function SendButton({ label, onPress, disabled, style, children, accessibilityLabel, big }: {
  label?: string; onPress: () => void; disabled?: boolean; style?: any; children?: React.ReactNode; accessibilityLabel?: string; big?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={(s) => [{ minHeight: big ? 57.2 : 55.8, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.5 : 1 }, style, !disabled && pressFx(s)]}
    >
      {children ?? <Text style={{ fontSize: big ? 18 : 17, lineHeight: big ? 25.2 : 23.8, fontWeight: '600', color: colors.text, letterSpacing: LS }}>{label}</Text>}
    </Pressable>
  );
}

// 대화상자 아래 '닫기'(modal-close)
export function ModalClose({ label = '닫기', onPress }: { label?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={(s) => [{ paddingTop: 18, alignItems: 'center' }, pressFx(s)]}>
      <Text style={{ fontSize: 13, lineHeight: 21.45, color: colors.sub, letterSpacing: LS }}>{label}</Text>
    </Pressable>
  );
}

// 대화상자 안 선택 줄(person-row)
export function ModalRow({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={(s) => [{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line }, pressFx(s)]}>
      <Text style={{ fontSize: 16, lineHeight: 26.4, color: color ?? colors.text, letterSpacing: LS }}>{label}</Text>
    </Pressable>
  );
}

// ── 바텀 시트(editor-picker) — 시안처럼 좌우·아래 20 띄우고 위 모서리만 둥글게 ──────
export function EditorPicker({ title, onClose, children, label }: {
  title: string; onClose: () => void; children: React.ReactNode; label?: string;
}) {
  const { height } = useWindowDimensions();
  const kbH = useKeyboardHeight();  // 키보드가 올라오면 시트 최대 높이도 줄여 위(제목·검색칸)가 화면 밖으로 밀리지 않게
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      {/* 키보드 회피(지역 검색 등) — 막은 바깥(KeyboardAware)에 깐다 */}
      <KeyboardAware style={{ flex: 1, backgroundColor: pickerScrim() }}>
      <Pressable onPress={onClose} style={[{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'flex-end' }, noOutline]}>
        <Pressable
          accessibilityViewIsModal
          accessibilityLabel={label ?? title}
          onPress={(e) => e.stopPropagation()}
          style={[{
            width: '100%', maxWidth: 520, maxHeight: Math.max(0, height - 40 - kbH) * 0.78, backgroundColor: colors.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24,
            shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 12.5, shadowOffset: { width: 0, height: -4 }, elevation: 3,
          }, noOutline]}
        >
          <View style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 }}>
            <Text style={{ fontSize: 23, lineHeight: 37.95, fontWeight: '500', color: colors.text, letterSpacing: LS }}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="선택창 닫기" hitSlop={8} onPress={onClose} style={{ paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ fontSize: 24, lineHeight: 39.6, fontWeight: '300', color: colors.sub, letterSpacing: LS }}>×</Text>
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
      </KeyboardAware>
    </Modal>
  );
}

// 시트 검색창(picker-search) — 바탕 없이 글자만, 안내 글자는 14 · 입력 글자는 16
export function PickerSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <FocusInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.sub}
      accessibilityLabel={placeholder}
      autoCorrect={false}
      style={{ flexShrink: 0, height: 52.4, paddingHorizontal: 15, paddingVertical: 13, borderRadius: 10, backgroundColor: colors.surface, color: colors.text, fontSize: value ? 16 : 14, letterSpacing: LS, marginBottom: 12 }}
    />
  );
}

// 선택지 동그라미 — 고르면 와인색 바탕에 흰 체크
// lh: 체크 글자 줄 높이 — 시트 선택지 18.15(11px×1.65), 질문 고르기 17.6(11px×1.6)
export function CheckCircle({ on, lh = 18.15 }: { on: boolean; lh?: number }) {
  return (
    <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on && <Text style={{ fontSize: 11, lineHeight: lh, color: '#fff', letterSpacing: LS }}>✓</Text>}
    </View>
  );
}

// 시트 선택지 한 줄(picker-options button)
export function PickerOption({ label, chosen, disabled, onPress }: { label: string; chosen: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: chosen, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={(s) => [{ flexDirection: 'row', alignItems: 'center', gap: 15, minHeight: 44, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.line, opacity: disabled ? 0.35 : 1 }, pressFx(s)]}
    >
      <Text style={{ flex: 1, fontSize: 15, lineHeight: 24.75, color: chosen ? colors.primary : colors.text, letterSpacing: LS }}>{label}</Text>
      <CheckCircle on={chosen} />
    </Pressable>
  );
}

// 시트 아래 보조 버튼(picker-clear)
export function PickerTextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={(s) => [{ paddingVertical: 15, alignItems: 'center' }, pressFx(s)]}>
      <Text style={{ fontSize: 12, lineHeight: 19.8, color: colors.sub, letterSpacing: LS }}>{label}</Text>
    </Pressable>
  );
}
