// 야화 — 팔로우한 호스트 목록 (0131)
// 팔로우해 둔 호스트가 지금 모집 중인 모임이 있으면 바로 눈에 띄게 보여준다.
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { NavBar } from '../components/atoms';
import { thumbUrl } from '../lib/img';
import { useMyFollowedHosts, useToggleHostFollowMutation } from '../lib/hooks';

export function FollowingHosts({ onBack, onOpenProfile }: { onBack?: () => void; onOpenProfile?: (userId: string) => void }) {
  const q = useMyFollowedHosts();
  const toggle = useToggleHostFollowMutation();
  const hosts = q.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar
        title="팔로우한 호스트"
        left={
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            <Icons.chevLeft size={22} color={colors.text} />
          </Pressable>
        }
      />
      {q.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11.5, color: colors.mute }}>불러오는 중…</Text>
        </View>
      ) : hosts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Icons.bell size={28} color={colors.line} />
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.sub, marginTop: 12 }}>아직 팔로우한 호스트가 없어요</Text>
          <Text style={{ fontSize: 11, color: colors.mute, marginTop: 6, textAlign: 'center', lineHeight: 17 }}>
            모임 상세에서 호스트를 팔로우해 두면{'\n'}새 모임을 열 때 바로 알려드려요
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {hosts.map((h) => (
            <Pressable
              key={h.host_id}
              onPress={() => onOpenProfile?.(h.host_id)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: colors.surface, borderRadius: 16,
                borderWidth: 1, borderColor: colors.lineSoft, padding: 12,
              }}
            >
              <View style={{ width: 52, height: 52, borderRadius: 26, overflow: 'hidden', backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                {h.photo ? (
                  <Image source={{ uri: thumbUrl(h.photo, 160) ?? h.photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <Icons.user size={22} color={colors.mute} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text }}>
                  {h.nickname ?? '닉네임 없음'}
                  <Text style={{ fontSize: 11, color: colors.mute, fontWeight: '600' }}>
                    {h.age ? ` · ${h.gender === 'F' ? '여' : '남'} ${h.age}` : ''}
                  </Text>
                </Text>
                <Text style={{ fontSize: 11, color: colors.mute, marginTop: 3 }}>
                  모임 {h.hosted_count}회 개설
                </Text>
                {h.open_count > 0 && (
                  <View style={{ alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, height: 20, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.primarySoft }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>모집 중인 모임 {h.open_count}개</Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={() => toggle.mutate({ hostId: h.host_id, follow: false })}
                hitSlop={6}
                style={{ paddingHorizontal: 12, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.sub }}>팔로잉</Text>
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
