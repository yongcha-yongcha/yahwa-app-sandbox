// 야화 — 편지함 줄 목록 (리뉴얼 1120 · spec-dating §3.6)
// 줄(.hl-row): 높이 84(위아래 16) · 아래 1px 선 · 사진 48 → 12 → [이름 15/21 600 / 아래 6 / 둘째 줄 13/19 한 줄] → 오른쪽 [D-n 12 / 점 6 장미].
// 둘째 줄: 받은 편지 안 읽음 = 굵게 + 점 / 읽음 = 보통 / 보낸 편지 = 연한 회색 / 서로 연결됨 = 장미 "서로 연결됨 · 연락처 공개".
// D-n은 서버 보관 기한(expires_at)까지 남은 날 그대로. 정렬은 sortLetters(받은 특별편지 맨 위).
import React, { useCallback, useMemo } from 'react';
import { FlatList, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout } from '../tokens';
import { letterState, sortLetters, useMyLetters } from '../lib/letters';
import type { LetterRow } from '../lib/api';
import { useNow } from '../lib/useNow';
import { BreathingDots, Dot } from '../ui';
import { LetterAvatar, letterDaysLeft, letterFirstLine } from './letters/ui';

export function LetterList({ onOpen, contentContainerStyle, header }: {
  onOpen: (letter: LetterRow) => void; contentContainerStyle?: StyleProp<ViewStyle>; header?: React.ReactElement;
}) {
  const q = useMyLetters();
  const letters = useMemo(() => sortLetters(q.data ?? []), [q.data]);
  const now = useNow(60_000);   // 화면을 켜 둔 동안에도 D-n이 멈추지 않게
  const renderItem = useCallback(({ item }: { item: LetterRow }) => <LetterListRow letter={item} now={now} onOpen={onOpen} />, [now, onOpen]);
  return (
    <FlatList
      data={letters}
      keyExtractor={(l) => l.id}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={header}
      contentContainerStyle={contentContainerStyle}
      ListEmptyComponent={q.isLoading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}><BreathingDots /></View>
      ) : (
        <Text style={{ paddingVertical: 40, paddingHorizontal: 15, fontSize: 16, lineHeight: 19, color: colors.mute, textAlign: 'center' }}>아직 도착한 편지가 없어요.</Text>
      )}
    />
  );
}

const LetterListRow = React.memo(function LetterListRow({ letter, now, onOpen }: { letter: LetterRow; now: number; onOpen: (l: LetterRow) => void }) {
  const st = letterState(letter);
  const name = letter.other_nickname ?? '상대';
  const connected = st === 'connected';
  const unread = st === 'in_unread';
  const out = letter.direction === 'out';
  const days = letterDaysLeft(letter.expires_at, now);
  const d = days > 0 ? `D-${days}` : '';
  return (
    <Pressable
      onPress={() => onOpen(letter)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${connected ? '서로 연결됨' : unread ? '새 편지' : out ? '보낸 편지' : '받은 편지'}${d ? `, ${d}` : ''}`}
      style={({ pressed }) => ({ minHeight: 84, marginHorizontal: layout.gutter, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.6 : 1 })}
    >
      <LetterAvatar photo={letter.other_photo} size={48} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>{name}</Text>
        {connected ? (
          <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 13, lineHeight: 19, color: colors.love }}>
            <Text style={{ fontWeight: '700' }}>서로 연결됨</Text> · 연락처 공개
          </Text>
        ) : (
          <Text
            numberOfLines={1}
            style={{ marginTop: 6, fontSize: 13, lineHeight: 19, fontWeight: unread ? '600' : '400', color: unread ? colors.inverseStrong : out ? colors.mute : colors.textSecondary }}
          >
            {letterFirstLine(letter.body)}
          </Text>
        )}
      </View>
      <View style={{ alignSelf: 'stretch', minWidth: 28, paddingTop: 3, paddingBottom: 6, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, lineHeight: 12, color: colors.mute, fontVariant: ['tabular-nums'] }}>{d}</Text>
        {unread && <Dot size={6} color={colors.love} label="안 읽음" />}
      </View>
    </Pressable>
  );
});
