// 야화 — 시안 사이트 모달(.review-modal) — 실측으로 맞춤(1013-B)
// · 옅은 딤 위 가운데 카드: 좌우 20 · 안쪽 24 · 모서리 20 · 최대 높이 85%(넘치면 카드 전체가 스크롤)
// · 제목 22/600 → 블록들 → '닫기'(13 회색, 위 18). 카드만 0.18초 동안 5px 올라오며 나타난다(딤은 바로).
// · 블록 사이 간격은 시안 CSS의 마진 겹침을 그대로 계산한다 — 블록 컴포넌트가 protoMargins = [위, 아래]를 갖는다.
//   (그래서 블록은 ProtoModal의 직계 자식(배열·Fragment 허용)으로 넣는다)
import { pressFx } from '../lib/press';
import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, TextInput, Animated, Easing, Platform, StyleSheet, useWindowDimensions,
  type TextStyle, type TextInputProps,
} from 'react-native';
import { colors, scrimColor, getThemeMode } from '../tokens';
import { MyIcon } from './my/MyIcons';
import { KeyboardAware } from './KeyboardAware';

type Margins = [number, number];
const LS = -0.24;  // 시안 전체 자간(-.015em × 16px, 계산값이 그대로 상속된다)
// 줄 높이는 시안 계산값을 1/64px 아래로 맞춘 값(25.2→25.19 등) — 웹은 줄 높이를 반올림하고 시안 줄 상자는 내림이라
// 그대로 쓰면 모달 높이·위치가 0.03px씩 달라져 글자가 1px 어긋나게 그려진다
// 시안 button:active scale(.985) — 눌렸을 때만 transform을 단다(scale(1)이 붙으면 웹에서 1px 어긋나게 그려짐)
const pressed985 = (pressed: boolean) => pressFx(pressed);

function flat(children: React.ReactNode): React.ReactElement[] {
  const out: React.ReactElement[] = [];
  React.Children.forEach(children, (c) => {
    if (!React.isValidElement(c)) return;
    if (c.type === React.Fragment) out.push(...flat((c.props as { children?: React.ReactNode }).children));
    else out.push(c);
  });
  return out;
}

export function ProtoModal({ open, title, onClose, children, closeLabel = '닫기' }: {
  open: boolean;
  title?: string;   // 없으면 제목 없이 내용부터(시안 충전·배지 관리처럼 내용이 제목을 갖는 모달)
  onClose: () => void;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const { height: winH } = useWindowDimensions();
  useEffect(() => {
    if (!open) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 180, easing: Easing.bezier(0, 0, 0.58, 1), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [open, anim]);

  // 블록 간격 — 앞 블록 아래 마진과 이 블록 위 마진 중 큰 값(제목 아래는 16, 제목이 없으면 0)
  let prev = title ? 16 : 0;
  const blocks = flat(children).map((el, i) => {
    const [t, b] = (el.type as { protoMargins?: Margins }).protoMargins ?? [0, 0];
    const gap = Math.max(prev, t);
    prev = b;
    return <View key={el.key ?? i} style={{ marginTop: gap }}>{el}</View>;
  });

  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* 키보드 회피 — 안드로이드도(edge-to-edge 모달은 adjustResize가 안 먹는다, KeyboardAware 참고) */}
      <KeyboardAware style={{ flex: 1 }}>
        {/* 딤 — 시안 1027: rgba(35,33,43,.36) + 웹은 5px 흐림 · 좌우 16. 다크는 공용 진한 딤 */}
        <View style={[{ flex: 1, backgroundColor: getThemeMode() === 'dark' ? scrimColor() : 'rgba(35,33,43,0.36)', padding: 16, alignItems: 'center', justifyContent: 'center' }, Platform.OS === 'web' ? ({ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' } as object) : null]}>
          {/* 웹 모달이 열리며 딤에 자동 포커스가 가도 화면 둘레에 포커스 테두리가 그려지지 않게 */}
          <Pressable style={[StyleSheet.absoluteFill, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} onPress={onClose} accessibilityLabel="닫기" />
          <Animated.View
            accessibilityViewIsModal
            style={{
              // 시안 1027 카드 — 테두리 1(#edecef) · 둥글기 24 · 그림자 0 18 60 · 높이는 화면 − 48까지
              width: '100%', maxWidth: 420, maxHeight: winH - 48, backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden',
              borderWidth: 1, borderColor: getThemeMode() === 'dark' ? colors.line : '#edecef', boxShadow: '0px 18px 60px rgba(36,30,48,0.12)',
              opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
            }}
          >
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 24 }} bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {!!title && <Text accessibilityRole="header" style={{ fontSize: 22, lineHeight: 30.8, fontWeight: '750' as any, color: colors.text, letterSpacing: -0.6 }}>{title}</Text>}
              {blocks}
              {/* 시안 1027 .modal-close — 바탕 없이(위 8 · 안 12 · 높이 44) · 13/18.2 650 회색 */}
              <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => ({ marginTop: Math.max(prev, 8), padding: 12, minHeight: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...pressed985(pressed) })}>
                <Text style={{ fontSize: 13, lineHeight: 18.2, fontWeight: '650' as any, color: colors.sub, letterSpacing: LS }}>{closeLabel}</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAware>
    </Modal>
  );
}

// 본문 단락(.review-modal p) — 14/25.2 회색, 위아래 14
// 시안 1020 본문 단락 — 16/27.2 · 500 · 프로필 글 회색(#64666c), 위아래 16
const pText = () => (getThemeMode() === 'dark' ? colors.sub : '#64666c');
// 시안 1027 — 16/28 · 500, 위 16 · 아래 24 · 낱말 단위 줄바꿈(keep-all)
export function ProtoP({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text lineBreakStrategyIOS="hangul-word" style={[{ fontSize: 16, lineHeight: 28, fontWeight: '500', color: pText(), letterSpacing: LS }, Platform.OS === 'web' ? ({ wordBreak: 'keep-all' } as object) : null, style]}>{children}</Text>;
}
ProtoP.protoMargins = [16, 24] as Margins;

// 작은 안내(.review-modal > small) — 시안은 16px 본문 줄(26.4) 안에 12px 인라인(줄 높이 19.8)으로 들어간다.
// 같은 구조(바깥 16/26.4 글 + 안쪽 12/19.8 글)로 그려 줄 간격·글자 위치를 그대로 맞춘다
export function ProtoSmall({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return (
    <Text style={{ fontSize: 16, lineHeight: 26.39, letterSpacing: LS }}>
      <Text style={[{ fontSize: 13, lineHeight: 20.8, color: colors.sub, letterSpacing: LS }, style]}>{children}</Text>
    </Text>
  );
}

// 주 버튼(.send-button, 시안 1020 개정) — 남색(ds-action) 바탕 · 흰 17/650 · 높이 52 · 위 16. 못 누르면 회색 바탕 · 회색 글자
// right가 있으면 글자는 왼쪽
export const onAction = () => (getThemeMode() === 'dark' ? colors.bg : '#ffffff');
// 시안 1027 주 버튼 바탕·글자(다크는 공용 회색 바탕·먹색)
export const sendBg = () => (getThemeMode() === 'dark' ? colors.bgSoft : '#f1f2f3');
export const sendInk = () => (getThemeMode() === 'dark' ? colors.text : '#42474d');
// 시안 1027 패널 테두리(--ds-panel-border)
export const panelBorder = () => (getThemeMode() === 'dark' ? colors.line : '#edecef');
export function ProtoButton({ label, onPress, right, icon, disabled }: {
  label: string;
  onPress: () => void;
  right?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      // 시안 1027 .send-button — 옅은 회색(#f1f2f3) 바탕 · 16/23.2 700 #42474d · 높이 52(안 14/18) · 둥글기 16
      style={({ pressed }) => ({
        minHeight: 52, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: sendBg(), ...pressed985(pressed && !disabled),
      })}
    >
      {icon}
      <Text style={{ fontSize: 16, lineHeight: 23.2, fontWeight: '700', color: disabled ? colors.disabled : sendInk(), letterSpacing: LS }}>{label}</Text>
      {right != null && <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>{right}</View>}
    </Pressable>
  );
}
ProtoButton.protoMargins = [16, 0] as Margins;

// 버튼 오른쪽 리프 수량(.send-button > span) — 리프 17 + 14/600
export function ProtoLeafAmount({ n }: { n: number }) {
  return (
    <>
      <MyIcon n="leaf" size={17} color={colors.text} />
      <Text style={{ fontSize: 14, lineHeight: 19.6, fontWeight: '600', color: colors.text, letterSpacing: LS, fontVariant: ['tabular-nums'] }}>{n.toLocaleString()}</Text>
    </>
  );
}

// 목록 행(.person-row) — 아이콘 20 · 제목(16, 보조 줄이 있으면 550) · 보조 12 · 오른쪽 기본 꺾쇠 15. 아래 1px 선
export function ProtoRow({ icon, title, sub, right, onPress, dim, accessibilityLabel }: {
  icon?: React.ReactNode;
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;   // 생략하면(누를 수 있을 때) 꺾쇠, null이면 비움
  onPress?: () => void;
  dim?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        // 시안 1027 .person-row — 위아래 12 · 최소 높이 52 · 한 줄 제목 600
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 52,
        borderBottomWidth: 1, borderBottomColor: colors.line, opacity: dim ? 0.55 : 1, ...pressed985(pressed),
      })}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        {sub != null ? (
          <>
            <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '550' as any, color: colors.text, letterSpacing: LS }}>{title}</Text>
            <Text style={{ fontSize: 13, lineHeight: 20.8, color: colors.sub, letterSpacing: LS, marginTop: 5 }}>{sub}</Text>
          </>
        ) : (
          <Text style={{ fontSize: 16, lineHeight: 26.39, fontWeight: '600', color: colors.text, letterSpacing: LS }}>{title}</Text>
        )}
      </View>
      {right === undefined ? (onPress ? <MyIcon n="next" size={15} color={colors.sub} /> : null) : right}
    </Pressable>
  );
}

// 밑줄 입력칸(.line-input) — 높이 52 · 16px(iOS 웹 확대 방지) · 아래 1px 선
// 시안 입력칸 안내 글(::placeholder)은 14px 회색 — RN은 안내 글 크기를 따로 못 정해서, 비어 있을 때 14px 글자를 겹쳐 그린다
// (입력 글자는 16px 그대로 — iOS 웹 확대 방지)
const OUTER_KEYS = ['margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'flex', 'alignSelf', 'width'] as const;
export const ProtoInput = React.forwardRef<TextInput, TextInputProps>(function ProtoInput({ placeholder, style, ...props }, ref) {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, any>;
  const outer: Record<string, any> = {};
  const inner: Record<string, any> = {};
  Object.keys(flat).forEach((k) => { ((OUTER_KEYS as readonly string[]).includes(k) ? outer : inner)[k] = flat[k]; });
  return (
    <View style={outer}>
      <TextInput
        ref={ref}
        accessibilityLabel={props.accessibilityLabel ?? placeholder}
        {...props}
        style={[
          // 시안 1020 모달 입력칸 — 밑줄 없이 둥근 칸(안 12 · 둥글기 12 · 투명 테두리 1)
          // 시안 1027 모달 입력칸 — #f5f5f7 바탕 · 안 16 · 둥글기 16 · 투명 테두리 1
          { minHeight: 60.39, padding: 16, fontSize: 16, lineHeight: 26.39, color: colors.text, letterSpacing: LS, borderWidth: 1, borderColor: 'transparent', borderRadius: 16, backgroundColor: getThemeMode() === 'dark' ? colors.bgSoft : '#f5f5f7' },
          Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as object) : null,
          inner,
        ]}
      />
      {!props.value && !!placeholder && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 1, left: 0, right: 0, paddingHorizontal: (inner.paddingHorizontal ?? inner.padding ?? 16) + 1, justifyContent: 'center' }}>
          <Text numberOfLines={1} style={{ fontSize: 14, lineHeight: 23.1, color: colors.sub, letterSpacing: LS, textAlign: inner.textAlign ?? 'left' }}>{placeholder}</Text>
        </View>
      )}
    </View>
  );
});

// 미리보기 줄(.convert-preview, 1027) — 안 16 · 위 12 · 왼쪽 13px 이름 · 오른쪽 값
export function ProtoKV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16 }}>
      <Text style={{ fontSize: 13, lineHeight: 21.43, color: colors.text, letterSpacing: LS }}>{label}</Text>
      {children}
    </View>
  );
}

ProtoKV.protoMargins = [12, 0] as Margins;

// 기록 한 줄(.point-record) — 14/500 제목 + 12 회색 보조, 위아래 20 · 아래 1px 선
export function ProtoRecord({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text style={{ fontSize: 14, lineHeight: 23.1, fontWeight: '500', color: colors.text, letterSpacing: LS, marginBottom: 6 }}>{title}</Text>
      <Text style={{ fontSize: 12, lineHeight: 19.8, color: colors.sub, letterSpacing: LS }}>{sub}</Text>
    </View>
  );
}

// 밑줄 글자 링크(.review-link) — 12px 회색 밑줄, 위 14
export function ProtoLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={({ pressed }) => ({ alignSelf: 'flex-start', ...pressed985(pressed) })}>
      <Text style={{ fontSize: 12, lineHeight: 19.8, color: colors.sub, letterSpacing: LS, textDecorationLine: 'underline' }}>{label}</Text>
    </Pressable>
  );
}
ProtoLink.protoMargins = [14, 0] as Margins;
