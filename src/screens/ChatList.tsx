// 야화 — 모임 탭 '채팅' 서브탭 본문 (server chat_rooms + realtime)
// 모임 그룹 채팅 전용. 방은 매칭 완료 시점에 서버 트리거가 만든다(0118).
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { Avatar, useTabBarClearance } from '../components/atoms';
import { useChatRoomsFull, useChatSeen } from '../lib/hooks';
import type { ServerChatRoom } from '../lib/api';

function fmtRelTime(iso?: string): string {
  if (!iso) return '';
  try {
    const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return '방금';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
  } catch { return ''; }
}

export function GatherChatTab({ onOpenRoom }: { onOpenRoom?: (id: string) => void }) {
  const tabBarSpace = useTabBarClearance();
  const roomsQ = useChatRoomsFull();
  const { unreadByRoom } = useChatSeen();
  const rooms = roomsQ.data ?? [];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: tabBarSpace }}>
      {roomsQ.isLoading && (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 11.5, color: colors.mute }}>불러오는 중…</Text>
        </View>
      )}
      {!roomsQ.isLoading && rooms.length === 0 && (
        <View style={{ padding: 48, alignItems: 'center' }}>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.text }}>아직 채팅방이 없어요</Text>
          <Text style={{ fontSize: 11, color: colors.mute, marginTop: 6, lineHeight: 17, textAlign: 'center' }}>
            모임을 만들거나 참여 승인을 받으면{'\n'}바로 채팅방이 열려요.
          </Text>
        </View>
      )}
      {rooms.map((r) => (
        <Pressable key={r.id} onPress={() => onOpenRoom?.(r.id)}>
          <RoomRow r={r} unread={unreadByRoom[r.id] ?? 0} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

// 채팅방 썸네일 — 멤버 프로필을 최대 3장 겹쳐서. 한 명이면 그냥 원형 하나.
function MemberStack({ profiles }: { profiles: Array<{ id: string; nickname: string; photo: string | null }> }) {
  const shown = profiles.slice(0, 3);
  const extra = profiles.length - shown.length;
  if (shown.length <= 1) {
    return <Avatar size={50} locked={false} photo={shown[0]?.photo ?? undefined} />;
  }
  const size = shown.length === 2 ? 34 : 30;
  const overlap = size * 0.42;
  return (
    <View style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row' }}>
        {shown.map((p, i) => (
          <View
            key={p.id}
            style={{
              marginLeft: i === 0 ? 0 : -overlap,
              borderRadius: size / 2,
              borderWidth: 1.5,
              borderColor: colors.surface,
              zIndex: shown.length - i,
            }}
          >
            <Avatar size={size} locked={false} photo={p.photo ?? undefined} />
          </View>
        ))}
      </View>
      {extra > 0 && (
        <View style={{ position: 'absolute', right: -2, bottom: -2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.surface }}>
          <Text style={{ fontSize: 8.5, fontWeight: '800', color: colors.bg }}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

function RoomRow({ r, unread }: { r: ServerChatRoom; unread: number }) {
  const isGather = r.kind === 'gather';
  const last = r._last?.body ?? '(아직 메시지가 없어요)';
  const time = fmtRelTime(r._last?.created_at);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.lineSoft,
      }}
    >
      <MemberStack profiles={r._memberProfiles ?? []} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text }} numberOfLines={1}>
            {r._peerName ?? '대화방'}
          </Text>
          {isGather && r._ratio && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.bgSoft, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.sub }}>{r._ratio}</Text>
            </View>
          )}
          <Text style={{ fontSize: 11, color: colors.mute, marginLeft: 'auto' }}>{time}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          {r.locked && <Icons.lock size={11} color={colors.mute} />}
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: r.locked ? colors.mute : colors.sub, flex: 1 }}>
            {r.locked ? '아직 대화를 시작할 수 없어요' : last}
          </Text>
          {unread > 0 && (
            <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#fff' }}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
