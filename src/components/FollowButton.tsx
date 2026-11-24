// 야화 — 호스트 팔로우 버튼 (0131)
// 모임 상세의 호스트 카드와 모임 프로필에서 같은 버튼을 쓴다.
// 팔로우해 두면 그 호스트가 새 모임을 열 때 알림이 오고, 모임 홈에서 '팔로잉' 표시가 붙는다.
import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { useHostFollowStats, useToggleHostFollowMutation } from '../lib/hooks';
import { getCurrentUserId, requireAuth } from '../lib/previewStore';

export function FollowButton({ hostId, size = 'md' }: { hostId: string; size?: 'sm' | 'md' }) {
  const myUid = getCurrentUserId();
  const stats = useHostFollowStats(hostId);
  const toggle = useToggleHostFollowMutation();
  if (!hostId || hostId === myUid) return null;

  const following = !!stats.data?.following;
  const busy = toggle.isPending || stats.isLoading;
  const h = size === 'sm' ? 32 : 38;

  return (
    <Pressable
      onPress={(e) => {
        // 호스트 카드 전체가 프로필로 이동하는 Pressable이라 버블링을 막는다
        (e as unknown as { stopPropagation?: () => void }).stopPropagation?.();
        if (!requireAuth('팔로우는 로그인 후 가능해요')) return;
        if (busy) return;
        toggle.mutate({ hostId, follow: !following });
      }}
      hitSlop={6}
      style={({ pressed }) => ({
        height: h,
        paddingHorizontal: size === 'sm' ? 12 : 14,
        borderRadius: radius.pill ?? h / 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: following ? colors.line : colors.primary,
        backgroundColor: following ? colors.surface : colors.primary,
        opacity: pressed || busy ? 0.6 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" color={following ? colors.sub : '#fff'} />
      ) : (
        <>
          <Icons.bell size={size === 'sm' ? 13 : 14} color={following ? colors.sub : '#fff'} />
          <Text
            style={{
              fontSize: size === 'sm' ? 11 : 12,
              fontWeight: '700',
              color: following ? colors.sub : '#fff',
            }}
          >
            {following ? '팔로잉' : '팔로우'}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function FollowerCount({ hostId }: { hostId: string }) {
  const stats = useHostFollowStats(hostId);
  const n = stats.data?.followerCount ?? 0;
  if (!n) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icons.users size={12} color={colors.mute} />
      <Text style={{ fontSize: 11, color: colors.mute }}>팔로워 {n}</Text>
    </View>
  );
}
