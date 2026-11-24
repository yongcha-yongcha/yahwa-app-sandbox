// 야화 — 모임 그룹 채팅방 (server chat_messages + realtime)
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomBarPad } from '../lib/layout';
import { KeyboardAware } from '../components/KeyboardAware';
import { useIosKeyboardShown } from '../components/community/keyboard';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { NavBar, Avatar, Btn } from '../components/atoms';
import { useChatMessages, useSendChatMessageMutation, useChatRoomsFull, useLeaveChatRoomMutation, markChatRoomSeen } from '../lib/hooks';
import { getCurrentUserId, previewActions } from '../lib/previewStore';
import { setActiveChatRoomId } from '../lib/push';

type Msg = { id: string; body: string; me: boolean; time: string; senderId: string };

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return ''; }
}

export function ChatRoom({
  roomId,
  onBack,
}: {
  roomId: string;
  onBack?: () => void;
}) {
  const myUid = getCurrentUserId();
  const roomsQ = useChatRoomsFull();
  const room = (roomsQ.data ?? []).find((r) => r.id === roomId);
  const msgsQ = useChatMessages(roomId);
  const sendMut = useSendChatMessageMutation(roomId);
  const leaveMut = useLeaveChatRoomMutation();
  const [input, setInput] = useState('');
  const insets = useSafeAreaInsets();
  const kbShown = useIosKeyboardShown();  // 키보드가 떠 있으면 입력 줄의 홈 인디케이터 여백을 뺀다

  // 보고 있는 방의 새 메시지는 로컬 알림 배너를 띄우지 않는다(useServerNotifs가 참조)
  // 들어올 때·나갈 때 모두 읽음 처리 — 하드웨어 뒤로가기·푸시 진입·앱 종료로 나가도 뱃지가 남지 않게
  useEffect(() => {
    setActiveChatRoomId(roomId);
    markChatRoomSeen(roomId);
    return () => { setActiveChatRoomId(null); markChatRoomSeen(roomId); };
  }, [roomId]);

  const msgs: Msg[] = useMemo(() =>
    (msgsQ.data ?? []).map((m) => ({
      id: m.id, body: m.body,
      me: m.sender_id === myUid,
      time: fmtTime(m.created_at),
      senderId: m.sender_id,
    })),
  [msgsQ.data, myUid]);

  async function handleSend() {
    const t = input.trim();
    if (!t || sendMut.isPending) return;
    setInput('');
    try {
      await sendMut.mutateAsync(t);
    } catch (e: any) {
      setInput(t);  // 실패 시 입력 복원
    }
  }

  if (!roomsQ.isLoading && !room) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 12.5, color: colors.sub }}>채팅방을 찾을 수 없어요</Text>
        <View style={{ marginTop: 16 }}>
          <Btn kind="line" size="md" onPress={onBack}>돌아가기</Btn>
        </View>
      </View>
    );
  }

  const peerName = room?._peerName ?? '';
  const isGather = room?.kind === 'gather';
  // 보낸 사람별 프로필 — 그룹방에서 모두 호스트 사진으로 보이던 문제
  const memberById = useMemo(() => {
    const map: Record<string, { nickname: string; photo: string | null }> = {};
    for (const p of room?._memberProfiles ?? []) map[p.id] = { nickname: p.nickname, photo: p.photo };
    return map;
  }, [room?._memberProfiles]);
  const peerPhoto = isGather
    ? undefined
    : (room?._memberProfiles ?? []).find((p) => p.id !== myUid)?.photo ?? undefined;
  const peerId = room?.kind === 'dm'
    ? room?.chat_members?.find((m) => m.user_id !== myUid)?.user_id
    : undefined;
  function onMore() {
    if (peerId) { previewActions.openReport({ kind: 'user', id: peerId, userId: peerId }); return; }
    confirmLeave();
  }

  // 채팅방 나가기 — chat_members에서 내 행만 지운다. 남은 멤버 대화는 이어진다.
  function confirmLeave() {
    if (leaveMut.isPending) return;
    const run = () => leaveMut.mutate(roomId, {
      onSuccess: () => { previewActions.showToast('채팅방에서 나왔어요', 2400); onBack?.(); },
      onError: () => previewActions.showToast('나가기에 실패했어요. 잠시 후 다시 시도해주세요', 2400),
    });
    const q = '채팅방에서 나갈까요?\n대화 목록에서 사라지고, 다시 들어오려면 모임에서 새로 열어야 해요.';
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm(q)) run();
      return;
    }
    Alert.alert('채팅방 나가기', q, [
      { text: '취소', style: 'cancel' },
      { text: '나가기', style: 'destructive', onPress: run },
    ]);
  }

  return (
    // 이미 위 안전 영역 아래(SafeAreaView top)에 놓인 화면이라 iOS 보정값은 0 — insets.top을 주면 키보드 위에 빈 틈이 생겼다
    <KeyboardAware style={{ flex: 1, backgroundColor: colors.bgSoft }}>
      <NavBar
        left={<Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}><Icons.chevLeft size={22} color={colors.text} /></Pressable>}
        title=""
        right={<Pressable onPress={onMore} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}><Icons.more size={20} color={colors.text} /></Pressable>}
      />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 76, right: 76, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {!isGather && peerPhoto != null && <Avatar size={28} locked={false} photo={peerPhoto} />}
        <Text style={{ fontSize: 15.5, fontWeight: '700', color: colors.text }}>{peerName}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 8 }}>
        <Text style={{ textAlign: 'center', fontSize: 10, color: colors.mute, marginVertical: 8 }}>
          {isGather ? '모임 매칭 채팅방' : '연결된 대화'}
        </Text>

        {msgs.length === 0 && !msgsQ.isLoading && (
          <View style={{ backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryLine, borderRadius: radius.lg, padding: 14, marginBottom: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.primaryDark }}>
              {isGather ? '채팅방이 열렸어요' : '꽃이 피었어요 🌸'}
            </Text>
            <Text style={{ fontSize: 11, color: colors.sub, marginTop: 4, lineHeight: 16, textAlign: 'center' }}>
              {isGather ? '참여가 확정되는 분들이 순서대로 들어와요.\n먼저 인사를 남겨보세요.' : `${peerName} 님과 매칭됐어요.`}
            </Text>
          </View>
        )}

        {msgs.map((m) => (m.me
          ? <MeBubble key={m.id} m={m} />
          : <OtherBubble key={m.id} m={m} sender={memberById[m.senderId]} showName={isGather} />))}

      </ScrollView>

      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: bottomBarPad(kbShown ? 0 : insets.bottom, 10),
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.lineSoft,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          placeholder={isGather ? '메시지 보내기' : `${peerName}에게 메시지 보내기`}
          placeholderTextColor={colors.mute}
          returnKeyType="send"
          editable={!sendMut.isPending}
          style={{
            flex: 1,
            height: 40,
            paddingHorizontal: 14,
            borderRadius: radius.pill,
            backgroundColor: colors.bgSoft,
            fontSize: 12.5,
            color: colors.text,
          }}
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || sendMut.isPending}
          style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
            opacity: input.trim() && !sendMut.isPending ? 1 : 0.5,
          }}
        >
          <Icons.send size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAware>
  );
}

function OtherBubble({ m, sender, showName }: { m: Msg; sender?: { nickname: string; photo: string | null }; showName?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
      <Avatar size={32} locked={false} photo={sender?.photo ?? undefined} />
      <View style={{ maxWidth: '70%' }}>
        {showName && (
          <Text style={{ fontSize: 10, color: colors.mute, marginBottom: 3 }}>{sender?.nickname ?? '참여자'}</Text>
        )}
        <View style={{ backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderTopLeftRadius: 4 }}>
          <Text style={{ fontSize: 12.5, color: colors.text, lineHeight: 18 }}>{m.body}</Text>
        </View>
        <Text style={{ fontSize: 9, color: colors.mute, marginTop: 3 }}>{m.time}</Text>
      </View>
    </View>
  );
}

function MeBubble({ m }: { m: Msg }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
      <View style={{ maxWidth: '70%', alignItems: 'flex-end' }}>
        <View style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderTopRightRadius: 4 }}>
          <Text style={{ fontSize: 12.5, color: '#fff', lineHeight: 18 }}>{m.body}</Text>
        </View>
        <Text style={{ fontSize: 9, color: colors.mute, marginTop: 3 }}>{m.time}</Text>
      </View>
    </View>
  );
}
