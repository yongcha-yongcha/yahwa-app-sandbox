// 야화 — 호감 친구. 나에게 호감도 3점 이상을 보낸 사람들의 프로필 목록.
import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { NavBar, MosaicImg } from '../components/atoms';
import { UnivBadge } from '../components/UnivBadge';
import { useAffinityReceived, useFriendProfiles } from '../lib/hooks';
import { ContactBlockAutoPrompt } from '../components/ContactBlockGate';

export function AffinityFriends({
  onBack,
  onOpenFriend,
}: {
  onBack?: () => void;
  onOpenFriend?: (userId: string) => void;
}) {
  const affQ = useAffinityReceived();
  const friendsQ = useFriendProfiles();

  const byId = new Map((friendsQ.data ?? []).map((p) => [p.user_id, p]));
  const items = (affQ.data ?? [])
    .map((a) => ({ score: a.score, created_at: a.created_at, profile: byId.get(a.rater_id) }))
    .filter((x) => !!x.profile);

  const loading = affQ.isLoading || friendsQ.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSoft }}>
      <NavBar
        title="호감 친구"
        left={
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            <Icons.chevLeft size={22} color={colors.text} />
          </Pressable>
        }
      />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Icons.heart size={36} color={colors.line} />
          <Text style={{ marginTop: 12, fontSize: 12.5, color: colors.sub, fontWeight: '600' }}>아직 받은 호감이 없어요</Text>
          <Text style={{ marginTop: 6, fontSize: 11, color: colors.mute, textAlign: 'center' }}>호감도 3점 이상을 받으면 여기에 표시돼요</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {items.map((x, i) => {
            const p = x.profile!;
            const meta = [p.gender === 'F' ? '여' : p.gender === 'M' ? '남' : '', p.age ? `${p.age}` : '', p.region ?? '']
              .filter(Boolean).join(' · ');
            return (
              <Pressable
                key={`${p.user_id}_${i}`}
                onPress={() => onOpenFriend?.(p.user_id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, marginBottom: 8,
                  borderWidth: 1, borderColor: colors.lineSoft,
                }}
              >
                <View style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.bgSoft }}>
                  {p.photos?.[0] ? (
                    <MosaicImg src={p.photos[0]} mosaic blurStrength={10} radiusVal={12} thumbWidth={160} />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Icons.user size={26} color={colors.line} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13.5, fontWeight: '800', color: colors.text }}>{p.nickname}</Text>
                    {!!p.univ_name && <UnivBadge name={p.univ_name} size="sm" />}
                  </View>
                  {!!meta && <Text style={{ fontSize: 11, color: colors.sub, marginTop: 2 }}>{meta}</Text>}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill }}>
                  <Icons.heart size={13} color={colors.primary} />
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.primary }}>{x.score}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* 지인 차단 — 공용 게이트(첫 진입 안내 + 재동기화). 오늘의 친구와 동일 동작 */}
      <ContactBlockAutoPrompt />
    </View>
  );
}
