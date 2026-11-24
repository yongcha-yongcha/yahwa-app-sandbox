// 야화 — 모임 프로필 열람 (인연 프로필과 완전 분리, 2026-08-21)
// 모임 참여자/호스트 프로필 클릭 시: 대표사진 + 닉네임 + 나이 + 지역만.
// 인연 프로필 미완성이어도 항상 열린다(get_group_profile RPC — 가입만 하면 OK).
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { NavBar } from '../components/atoms';
import { supabase } from '../lib/supabase';
import { thumbUrl } from '../lib/img';
import { FollowButton, FollowerCount } from '../components/FollowButton';

type GroupProfile = {
  user_id: string; nickname: string | null; age: number | null;
  gender: 'M' | 'F' | null; region: string | null; photo: string | null; created_at: string;
};

export function GroupProfileView({ userId, onBack }: { userId: string; onBack?: () => void }) {
  const q = useQuery({
    queryKey: ['group-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_group_profile' as never, { target_id: userId } as never);
      if (error) throw error;
      const rows = data as unknown as GroupProfile[];
      return rows?.[0] ?? null;
    },
    staleTime: 30_000,
  });
  const p = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <NavBar
        title="프로필"
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
      ) : !p ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 13.5, color: colors.sub, fontWeight: '600' }}>프로필을 찾을 수 없어요</Text>
          <Text style={{ marginTop: 6, fontSize: 11, color: colors.mute }}>탈퇴했거나 잘못된 링크일 수 있어요</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
          <View style={{ width: 140, height: 140, borderRadius: 70, overflow: 'hidden', backgroundColor: colors.bgSoft, marginTop: 16 }}>
            {p.photo ? (
              <Image source={{ uri: thumbUrl(p.photo, 400) ?? p.photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <LinearGradient colors={['#D96A61', '#bf3127']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.user size={48} color="rgba(255,255,255,0.9)" />
              </LinearGradient>
            )}
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 18 }}>
            {p.nickname ?? '닉네임 없음'}
          </Text>
          <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <FollowButton hostId={userId} />
            <FollowerCount hostId={userId} />
          </View>
          {(p.age || p.region) && (
            <Text style={{ fontSize: 12.5, color: colors.sub, marginTop: 6 }}>
              {[p.age ? `${p.age}세` : null, p.gender === 'F' ? '여성' : p.gender === 'M' ? '남성' : null, p.region]
                .filter(Boolean).join(' · ')}
            </Text>
          )}
          <View
            style={{
              marginTop: 26, padding: 14, borderRadius: radius.md,
              backgroundColor: colors.bgSoft, alignSelf: 'stretch',
            }}
          >
            <Text style={{ fontSize: 11, color: colors.sub, lineHeight: 16, textAlign: 'center' }}>
              모임에서 보이는 기본 프로필이에요.{'\n'}함께 모임에서 만나 자연스럽게 알아가 보세요.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
