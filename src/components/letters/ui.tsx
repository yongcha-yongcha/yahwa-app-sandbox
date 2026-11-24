// 야화 — 편지 화면 공용 부품 (리뉴얼 1120 · spec-dating §3.6~§3.9)
// 편지지(LetterPaper) · 보낸 사람 줄(LetterPersonRow) · 값 칩(CostChip) · 연락처 타일 · 리프 확인 시트 · 거절 시트 · 보관 안내 시트.
// 상대 프로필(FriendDetail)의 받은 편지 카드도 여기 부품을 가져다 쓴다.
import React, { useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Image as ExpoImage } from 'expo-image';
import { colors, fontSerif, radius } from '../../tokens';
import { thumbUrl } from '../../lib/img';
import { rulePitch } from '../../lib/appFont';
import { keepAll } from '../affinity/ui';
import { HIDE_IOS_CURRENCY } from '../../lib/flags';
import { previewActions, previewSelectors, usePreview } from '../../lib/previewStore';
import type { LetterRow } from '../../lib/api';
import { BottomSheet, Button, ConfirmSheet, Icon, LeafCostCard, LeafIcon, SheetButtons, SheetHeader, usePress } from '../../ui';

const DAY = 86_400_000;
// 낱말 단위 줄바꿈만(줄 길이 고르기 없이 — 시안 word-break: keep-all)
const KEEP_WORDS = (Platform.OS === 'web' ? { wordBreak: 'keep-all' } : null) as any;

// ── 글자 도우미 ─────────────────────────────────────────────
// 전화번호는 서버에 숫자만 저장된다 — 보여줄 때만 010-0000-0000으로
export function fmtPhone(v: string): string {
  const d = v.replace(/[^0-9]/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return d.startsWith('02') ? `02-${d.slice(2, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return v;
}
// "11월 20일"
export function letterDate(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
// "오후 9:34"
export function letterTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}
// 남은 날 — 서버 보관 기한(expires_at)까지(올림). 지났으면 0
export function letterDaysLeft(expiresAt: string | null | undefined, now: number): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / DAY));
}
export const letterFirstLine = (body: string | null | undefined) => (body ?? '').replace(/\s+/g, ' ').trim();

// ── 아이콘 ──────────────────────────────────────────────────
// 자물쇠(시안 lt-lock, viewBox 24 선 1.8)
export function LockIcon({ size = 14, color = colors.mute }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </Svg>
  );
}
// 연락처 색 타일 — 카카오톡(노랑 + 갈색 말풍선) / 전화(주 버튼 파랑 + 흰 전화기). off면 35%
// 말풍선 갈색은 카카오 지정색이라 토큰이 아니라 여기서만 쓴다
const KAKAO_INK = '#3A1D1D';
export function ContactTile({ kind, size = 40, off }: { kind: 'kakao' | 'phone'; size?: number; off?: boolean }) {
  const ic = Math.round(size / 2);
  return (
    <View style={{ width: size, height: size, borderRadius: radius.field, backgroundColor: kind === 'kakao' ? colors.kakao : colors.btnPrimaryBg, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.35 : 1 }}>
      {kind === 'kakao' ? (
        <Svg width={ic} height={ic} viewBox="0 0 24 24">
          <Path fill={KAKAO_INK} d="M12 4C6.9 4 2.8 7.2 2.8 11.2c0 2.6 1.7 4.8 4.3 6.1l-.9 3.3c-.1.3.3.6.6.4l3.9-2.6c.4 0 .9.1 1.3.1 5.1 0 9.2-3.2 9.2-7.3S17.1 4 12 4Z" />
        </Svg>
      ) : (
        <Svg width={ic} height={ic} viewBox="0 0 24 24" fill="none" stroke={colors.inverse} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6.6 3.5h3l1.4 4-2 1.4a11 11 0 0 0 6.1 6.1l1.4-2 4 1.4v3a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
        </Svg>
      )}
    </View>
  );
}

// 동그란 사진 — 없으면 회색 원
export function LetterAvatar({ photo, size }: { photo?: string | null; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.muted }}>
      {!!photo && <ExpoImage source={{ uri: thumbUrl(photo, 200) ?? photo }} style={{ width: size, height: size }} contentFit="cover" contentPosition={{ left: '50%', top: '40%' }} cachePolicy="memory-disk" />}
    </View>
  );
}

// ── 줄 노트 — lh 간격마다 1px 선(글 뒤). 높이는 내용에 맞춰 늘고 최소 minLines 줄 ──
// input: 안에 든 것이 입력칸(TextInput)이면 true — 안드로이드에서 줄 간격 px 맞춤 방식이 다르다(rulePitch)
export function Ruled({ lh: lineH, minLines, input, lineColor = colors.line, style, children }: {
  lh: number; minLines: number; input?: boolean; lineColor?: string; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  const lh = rulePitch(lineH, input);
  const [h, setH] = useState(lh * minLines);
  const n = Math.max(minLines, Math.round(h / lh));
  return (
    <View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={[{ minHeight: lh * minLines }, style]}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: lh * (i + 1) - 1, height: 1, backgroundColor: lineColor }} />
      ))}
      {children}
    </View>
  );
}

// 줄 노트 위 글은 휴대폰 글자 크기를 따르지 않는다(allowFontScaling={false}) — 줄이면 글 줄 높이만 줄어 밑줄과 어긋난다
// ── 편지지(.letter-paper) — 흰 바탕 · 1px 선 · 모서리 4 20 4 4 · 안쪽 24 20.
// 받는 이(명조 15/27 회색) → 본문(명조 16/32, 위 16 · 아래 32, 줄 노트 최소 4줄) → 날짜 · 서명(오른쪽 12/19.2, 사이 6).
// children을 주면 본문 자리에 그대로 넣는다(편지 쓰기의 입력칸). focused: 쓰는 중 테두리. footerLeft: 아래 왼쪽(글자 수)
//  top: '받는 사람에게' 줄 바로 아래 · 본문 위에 놓는 것(편지 '마음이 간 곳')
export function LetterPaper({ to, body, date, sign, children, top, focused, footerLeft, bodyBottom = 32, style }: {
  to: string; body?: string; date: string; sign: string; children?: React.ReactNode; top?: React.ReactNode; focused?: boolean; footerLeft?: React.ReactNode; bodyBottom?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[paper.box, focused && { borderColor: FOCUS_LINE }, style]}>
      <Text style={paper.to}>{to}</Text>
      {top}
      {children ?? (
        <Ruled lh={32} minLines={4} style={{ marginTop: 16, marginBottom: bodyBottom }}>
          <Text selectable allowFontScaling={false} style={[keepAll, paper.body]}>{body}</Text>
        </Ruled>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>{footerLeft}</View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={paper.foot}>{date}</Text>
          <Text style={paper.foot}>{sign}</Text>
        </View>
      </View>
    </View>
  );
}
// 쓰는 중 테두리 — 주 버튼 파랑 45%
const FOCUS_LINE = 'rgba(55,115,152,0.45)';
export const paper = StyleSheet.create({
  box: {
    paddingVertical: 24, paddingHorizontal: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
    borderTopLeftRadius: 4, borderTopRightRadius: 20, borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
    boxShadow: '0px 5px 18px rgba(57,68,77,0.02)',
  },
  to: { fontFamily: fontSerif, fontSize: 15, lineHeight: 27, color: colors.mute },
  body: { fontFamily: fontSerif, fontSize: 16, lineHeight: 32, color: colors.text },
  foot: { fontSize: 12, lineHeight: 19.2, color: colors.mute },
});

// ── 보낸 사람 줄(.lt-from) — 안쪽 8 12 · 모서리 16. 사진 44 → 12 → 제목 15/21 600 / 아래 3 보조 13 → 오른쪽 "프로필 ›".
// onPress가 있으면 프로필 링크(누르면 0.98배 + 회색 바탕), 없으면 그냥 줄(편지 쓰기)
export function LetterPersonRow({ photo, title, sub, subTone, onPress, style }: {
  photo?: string | null; title: string; sub?: string; subTone?: 'love'; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const press = usePress(0.98, 160, 120);
  const inner = (
    <Animated.View style={[{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.card, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }, onPress ? press.scaleStyle : null]}>
      {!!onPress && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.muted, opacity: press.p }]} />}
      <LetterAvatar photo={photo} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>{title}</Text>
        {!!sub && <Text lineBreakStrategyIOS="hangul-word" style={[KEEP_WORDS, { marginTop: 3, fontSize: 13, lineHeight: 22.75, color: subTone === 'love' ? colors.love : colors.sub }]}>{sub}</Text>}
      </View>
      {!!onPress && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.mute }}>프로필</Text>
          <Icon name="chevron-right" size={16} color={colors.mute} />
        </View>
      )}
    </Animated.View>
  );
  if (!onPress) return <View style={style}>{inner}</View>;
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={`${title}, 프로필 보기`} style={style}>
      {inner}
    </Pressable>
  );
}

// 가운데 안내 한 줄 — 자물쇠 14 + 12/18 회색
export function LockNote({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, style]}>
      <LockIcon />
      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.mute }}>{text}</Text>
    </View>
  );
}

// 값 칩(.lt-price) — 버튼 안: 높이 24 · 좌우 9 · 모서리 12 · 흰 22% · 12/600. 무료면 "무료", 아니면 잎 14 + 숫자.
// iOS 통화 숨김이면 그리지 않는다
export function CostChip({ cost, free, color = colors.inverse, off }: { cost: number; free?: boolean; color?: string; off?: boolean }) {
  if (HIDE_IOS_CURRENCY) return null;
  const zero = free || cost <= 0;
  return (
    <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: off ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {!zero && <LeafIcon size={14} color={color} />}
      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color, fontVariant: ['tabular-nums'] }}>{zero ? '무료' : cost}</Text>
    </View>
  );
}

// ── 리프 확인 시트 — 제목 · 설명 · 리프 카드 · [취소] [실행]. 모자라면 "N리프가 더 필요해요" + [리프 충전하기]
// free: 무료(원가 취소선 + 0). event: 리프 카드에 '연말까지 오픈 특별가' 표. iOS 통화 숨김이면 리프 카드 없이 제목 · 설명 · 버튼만
export function LeafConfirmSheet({ open, onClose, title, desc, cost, free, event, confirmLabel, onConfirm, loading, shortReason, children }: {
  open: boolean; onClose: () => void; title: string; desc?: string; cost: number; free?: boolean; event?: boolean;
  confirmLabel: string; onConfirm: () => void; loading?: boolean; shortReason?: string; children?: React.ReactNode;
}) {
  const balance = usePreview(previewSelectors.leafBalance);
  const pay = free ? 0 : cost;
  const short = !HIDE_IOS_CURRENCY && balance < pay;
  return (
    <ConfirmSheet
      open={open}
      onClose={onClose}
      title={title}
      desc={desc}
      loading={loading}
      confirmLabel={short ? '리프 충전하기' : confirmLabel}
      onConfirm={short ? () => { onClose(); previewActions.openPaywall(pay, shortReason ?? `${pay}리프가 필요해요.`); } : onConfirm}
    >
      {children}
      {!HIDE_IOS_CURRENCY && <LeafCostCard cost={cost} free={free} event={event} balance={balance} style={{ marginTop: -4, marginBottom: short ? 8 : 20 }} />}
      {short && <Text style={{ marginBottom: 20, fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.loveStrong, textAlign: 'right' }}>{pay - balance}리프가 더 필요해요</Text>}
    </ConfirmSheet>
  );
}

// ── 편지 거절 시트(§3.9) — 제목 → 편지 상자(사진 40 + 보낸 이 · 날짜 + 첫 줄) → 안내 줄 → [취소] [정중히 거절하기]
export function LetterDeclineSheet({ open, onClose, letter, onConfirm, loading }: {
  open: boolean; onClose: () => void; letter: LetterRow | null; onConfirm: () => void; loading?: boolean;
}) {
  const name = letter?.other_nickname ?? '상대';
  return (
    <BottomSheet open={open} onClose={onClose} dismissable={!loading}>
      <View style={{ paddingTop: 4 }}><SheetHeader title={`${name}님의 편지를 정중히 거절할까요?`} /></View>
      <View style={{ marginTop: 4, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.card, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <LetterAvatar photo={letter?.other_photo} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16.8, fontWeight: '500', color: colors.mute }}>{name}님이 보낸 편지 · {letterDate(letter?.created_at)}</Text>
          <Text numberOfLines={1} style={{ fontFamily: fontSerif, fontSize: 14, lineHeight: 22.4, color: colors.text }}>{letterFirstLine(letter?.body)}</Text>
        </View>
      </View>
      <View style={{ marginTop: 16, marginBottom: 20, gap: 8 }}>
        {/* 셋째 줄("다시 추천되지 않아요")은 우리 규칙 */}
        {['편지 목록에서 사라지고, 다시 열어 볼 수 없어요.', '서로의 연락처는 공개되지 않아요.', '거절한 인연은 다시 추천되지 않아요.'].map((t) => <Bullet key={t} text={t} />)}
      </View>
      <SheetButtons onCancel={onClose} confirmLabel="정중히 거절하기" onConfirm={onConfirm} loading={loading} />
    </BottomSheet>
  );
}

// 안내 줄 — 회색 점 5 + 14/21.7
export function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ width: 5, height: 5, borderRadius: 2.5, marginTop: 9, backgroundColor: colors.mute }} />
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 21.7, color: colors.textSecondary }}>{text}</Text>
    </View>
  );
}

// ── 편지 보관 안내 시트(편지함 부제목 줄의 정보 아이콘) ──
export function LetterKeepSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      {/* 맞춤 추천 설명 시트(.cm-explain)와 같은 제목 18/25.2 */}
      <Text accessibilityRole="header" style={{ fontSize: 18, lineHeight: 25.2, fontWeight: '600', color: colors.text }}>편지 보관 안내</Text>
      <View style={{ marginTop: 16, marginBottom: 20, gap: 8 }}>
        <Bullet text="읽지 않은 편지는 3일이 지나면 사라져요." />
        <Bullet text="서로 연결된 편지는 7일이 지나면 사라져요." />
        <Bullet text="3일 동안 읽히지 않은 편지는 쓴 리프를 돌려드려요." />
      </View>
      <Button label="알겠어요" size="sheet" block onPress={onClose} />
    </BottomSheet>
  );
}
