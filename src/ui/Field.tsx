// 야화 UI 킷 — 입력칸 · 선택창 · 여러 줄 입력(spec-shell §2.2~2.4)
// 틀: 높이 54 · 모서리 12 · 흰 바탕 · 1px #CFD5DA. 포커스 1.5px #377398 · 오류 1.5px #CF5C65 — 테두리는 덧씌운 층이라 레이아웃이 안 움직인다.
// 꺼짐·읽기 전용: 회색 바탕 + 1px #E3E7EA. 라벨 12(위 22 · 아래 9), 도움말·오류 12/18(위 8).
import React, { useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius, type as typo } from '../tokens';
import { Icon } from './icons';

const WEB_NO_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } : null) as object | null;
type FrameState = 'default' | 'focus' | 'error' | 'off';

// 테두리 층 — 색·두께만 바뀐다(120ms는 웹 transition, 앱은 바로)
function Frame({ state, r = radius.field }: { state: FrameState; r?: number }) {
  const strong = state === 'focus' || state === 'error';
  return (
    <View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: r, borderWidth: strong ? 1.5 : 1, borderColor: state === 'focus' ? colors.focus : state === 'error' ? colors.errorLine : state === 'off' ? colors.line : colors.lineControl },
        Platform.OS === 'web' ? ({ transitionProperty: 'border-color, border-width', transitionDuration: '120ms', transitionTimingFunction: 'ease-out' } as object) : null,
      ]}
    />
  );
}

export function FieldLabel({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <Text style={[typo.fieldLabel, { marginTop: first ? 0 : 22, marginBottom: 9 }]}>{children}</Text>;
}
export function FieldHelp({ children, error }: { children?: React.ReactNode; error?: boolean }) {
  if (!children) return null;
  return <Text accessibilityLiveRegion={error ? 'polite' : undefined} style={[error ? typo.error : typo.help, { marginTop: 8, marginHorizontal: 2 }]}>{children}</Text>;
}

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  help?: string;
  error?: string | boolean;     // 문구면 아래에 보여 준다
  success?: boolean;            // 오른쪽에 체크 원
  disabled?: boolean;
  readOnly?: boolean;
  clearable?: boolean;          // 포커스 + 글자가 있으면 지우기 버튼
  right?: React.ReactNode;      // 오른쪽 끝 요소(단위 등)
  style?: StyleProp<ViewStyle>;
  inputRef?: React.Ref<TextInput>;
};

export function TextField({ label, help, error, success, disabled, readOnly, clearable, right, style, inputRef, onFocus, onBlur, value, onChangeText, ...rest }: TextFieldProps) {
  const [focus, setFocus] = useState(false);
  const own = useRef<TextInput>(null);
  const off = !!disabled || !!readOnly;
  const state: FrameState = off ? 'off' : error ? 'error' : focus ? 'focus' : 'default';
  const showClear = !!clearable && focus && !!value && !off;
  return (
    <View style={style}>
      {!!label && <FieldLabel first>{label}</FieldLabel>}
      <View style={{ height: 54, borderRadius: radius.field, backgroundColor: off ? colors.bgSoft : colors.surface, flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          ref={(n) => { (own as any).current = n; if (typeof inputRef === 'function') inputRef(n); else if (inputRef) (inputRef as any).current = n; }}
          value={value}
          onChangeText={onChangeText}
          editable={!off}
          placeholderTextColor={colors.sub}
          selectionColor={colors.focus}
          cursorColor={colors.focus}
          {...rest}
          onFocus={(e) => { setFocus(true); onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); onBlur?.(e); }}
          style={[{ flex: 1, height: 54, paddingLeft: 15, paddingRight: showClear || success ? 48 : 15, paddingVertical: 0, fontSize: 16, color: disabled ? colors.subtle : colors.text }, WEB_NO_OUTLINE]}
        />
        {right}
        {showClear && (
          <Pressable
            onPress={() => { onChangeText?.(''); own.current?.focus(); }}
            accessibilityRole="button"
            accessibilityLabel="지우기"
            style={{ position: 'absolute', right: 4, top: 0, width: 44, height: 54, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.fieldClear, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={14} color="#FFFFFF" />
            </View>
          </Pressable>
        )}
        {success && !showClear && (
          <View pointerEvents="none" style={{ position: 'absolute', right: 16, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.valid, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={12} color="#FFFFFF" />
          </View>
        )}
        <Frame state={state} />
      </View>
      <FieldHelp error={!!error}>{typeof error === 'string' ? error : help}</FieldHelp>
    </View>
  );
}

// 선택창 — 누르면 시트를 연다(값은 밖에서). open이면 포커스 테두리
export function SelectField({ label, value, placeholder = '선택해 주세요', onPress, open, error, disabled, help, style }: {
  label?: string; value?: string | null; placeholder?: string; onPress?: () => void; open?: boolean; error?: string | boolean; disabled?: boolean; help?: string; style?: StyleProp<ViewStyle>;
}) {
  const state: FrameState = disabled ? 'off' : error ? 'error' : open ? 'focus' : 'default';
  return (
    <View style={style}>
      {!!label && <FieldLabel first>{label}</FieldLabel>}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? ''} ${value || placeholder}`.trim()}
        style={{ height: 54, borderRadius: radius.field, backgroundColor: disabled ? colors.bgSoft : colors.surface, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}
      >
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, lineHeight: 21, color: value ? (disabled ? colors.subtle : colors.text) : colors.subtle }}>{value || placeholder}</Text>
        <Icon name="chevron-down" size={20} color={colors.mute} />
        <Frame state={state} />
      </Pressable>
      <FieldHelp error={!!error}>{typeof error === 'string' ? error : help}</FieldHelp>
    </View>
  );
}

// 여러 줄 입력(종이 한 겹) — 모서리 14 · 15/32 · 줄마다 아래 1px 하늘색 줄(ruled, 글과 함께 스크롤)
// soft: 회색 칸(자기소개 쓰기 · 시안 story-cards W1) — 모서리 16 · #F1F4F6 · 테두리 없음(쓰는 중 1.5 포커스 선) · 15/25.5 · 안쪽 16/18
const LINE = 32;
export function TextArea({ height = 192, ruled, soft, warn, style, onFocus, onBlur, maxLength = 300, ...rest }: Omit<TextInputProps, 'style'> & {
  height?: number; ruled?: boolean; soft?: boolean; warn?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const [focus, setFocus] = useState(false);
  const y = useRef(new Animated.Value(0)).current;
  const lines = Math.ceil(height / LINE) + 1;
  if (soft) {
    return (
      <View style={[{ height, borderRadius: 16, backgroundColor: colors.bgSoft, overflow: 'hidden' }, style]}>
        <TextInput
          multiline
          maxLength={maxLength}
          placeholderTextColor={colors.sub}
          selectionColor={colors.focus}
          cursorColor={colors.focus}
          textAlignVertical="top"
          {...rest}
          onFocus={(e) => { setFocus(true); onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); onBlur?.(e); }}
          style={[{ flex: 1, paddingVertical: 16, paddingHorizontal: 18, fontSize: 15, lineHeight: 25.5, color: colors.text }, WEB_NO_OUTLINE]}
        />
        {focus && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 16, borderWidth: 1.5, borderColor: colors.focus }} />}
      </View>
    );
  }
  return (
    <View style={[{ height, borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' }, style]}>
      {ruled && (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 14, right: 14, top: 4, transform: [{ translateY: y }] }}>
          {Array.from({ length: lines }).map((_, i) => <View key={i} style={{ height: LINE, borderBottomWidth: 1, borderBottomColor: colors.selected }} />)}
        </Animated.View>
      )}
      <TextInput
        multiline
        maxLength={maxLength}
        placeholderTextColor={colors.chevron}
        selectionColor={colors.focus}
        cursorColor={colors.focus}
        textAlignVertical="top"
        {...rest}
        onScroll={(e) => y.setValue(-(e.nativeEvent.contentOffset.y % LINE))}
        onFocus={(e) => { setFocus(true); onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); onBlur?.(e); }}
        style={[{ flex: 1, paddingVertical: 4, paddingHorizontal: 14, fontSize: 15, lineHeight: LINE, color: colors.text }, WEB_NO_OUTLINE]}
      />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 14, borderWidth: focus ? 1.5 : 1, borderColor: focus ? colors.focus : warn ? colors.errorLine : colors.line }} />
    </View>
  );
}
