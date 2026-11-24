// 야화 — 모임 프로필 편집 (MY 탭 전용, 2026-08-21 분리)
// 인연 프로필(사진 6장·소개 위저드)과 달리 모임에서 보이는 최소 정보만 다룬다:
// 대표사진 1장 + 닉네임 + 지역. 저장 경로는 동일(users 테이블) — 대표사진은
// 모임 대표사진은 users.group_photo — 인연 프로필(photos)과 완전히 독립(0124).
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../tokens';
import { KeyboardAware } from '../components/KeyboardAware';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomBarPad } from '../lib/layout';
import { Icons } from '../icons';
import { Btn, NavBar } from '../components/atoms';
import { previewActions, previewSelectors, usePreview, getCurrentUserId } from '../lib/previewStore';
import { updateUserProfileServer } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { pickAndUploadPhoto } from '../lib/photoUpload';
import { RegionPicker } from '../components/RegionPicker';
import { nicknameError, NICKNAME_MAX } from '../lib/nickname';

function notify(title: string, body?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(body ? `${title}\n${body}` : title);
  } else {
    Alert.alert(title, body);
  }
}

export function GroupProfileEdit({ onBack }: { onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const profile = usePreview(previewSelectors.myProfile);
  const [nickname, setNickname] = useState(profile.nickname);
  const [region, setRegion] = useState(profile.region);
  const [photo, setPhoto] = useState<string | null>(() => {
    const p = profile.groupPhoto ?? profile.photos?.[0] ?? profile.photo;
    return typeof p === 'string' ? p : null;
  });
  const [uploading, setUploading] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pickPhoto() {
    const uid = getCurrentUserId();
    if (!uid) { notify('로그인 필요', '사진 업로드는 로그인 후 가능해요'); return; }
    setUploading(true);
    try {
      const url = await pickAndUploadPhoto(uid);
      if (url) setPhoto(url);
    } catch (e: any) {
      notify('업로드 실패', e?.message ?? '잠시 후 다시 시도해주세요');
    } finally {
      setUploading(false);
    }
  }

  const nickErr = nicknameError(nickname);
  const canSave = !nickErr && !!nickname.trim() && !uploading && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    // 모임 대표사진만 바꾼다 — 인연 프로필 사진(photos)은 건드리지 않는다.
    const patch = {
      nickname: nickname.trim(),
      region: region?.trim() || undefined,
      ...(photo ? { groupPhoto: photo } : {}),
    };
    previewActions.updateMyProfile(patch as any);
    try {
      await updateUserProfileServer(patch as any);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['friend-profiles'] });
      previewActions.showToast('모임 프로필을 저장했어요', 1800);
      onBack?.();
    } catch (e: any) {
      notify('저장 실패', (e?.message ?? '잠시 후 다시 시도해주세요') + '\n(로컬에는 저장됐어요)');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAware style={{ flex: 1, backgroundColor: colors.bgSoft }}>
      <View style={{ flex: 1, backgroundColor: colors.bgSoft }}>
        <NavBar
          title="모임 프로필 편집"
          left={
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.chevLeft size={22} color={colors.text} />
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {/* 대표사진 */}
          <Text style={[st.label, { color: colors.sub }]}>대표사진</Text>
          <View style={{ alignItems: 'center', marginBottom: 6 }}>
            <Pressable onPress={pickPhoto} disabled={uploading} style={{ opacity: uploading ? 0.6 : 1 }}>
              <View style={{ width: 120, height: 120, borderRadius: 60, overflow: 'hidden', backgroundColor: colors.bgSoft, borderWidth: 2, borderColor: colors.line }}>
                {photo ? (
                  <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <LinearGradient colors={['#D96A61', '#bf3127']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <Icons.user size={40} color="rgba(255,255,255,0.9)" />
                  </LinearGradient>
                )}
              </View>
              <View
                style={{
                  position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17,
                  backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: colors.surface,
                }}
              >
                <Icons.image size={16} color="#fff" />
              </View>
            </Pressable>
            <Text style={{ fontSize: 11, color: colors.sub, marginTop: 10 }}>
              {uploading ? '업로드 중…' : '탭해서 사진을 바꿀 수 있어요'}
            </Text>
          </View>

          {/* 닉네임 */}
          <Text style={[st.label, { color: colors.sub, marginTop: 18 }]}>닉네임</Text>
          <TextInput
            value={nickname}
            onChangeText={(t) => setNickname(t.slice(0, NICKNAME_MAX))}
            maxLength={NICKNAME_MAX}
            placeholder="2~10자"
            placeholderTextColor={colors.mute}
            style={{
              height: 52, borderWidth: 1.5, borderColor: nickname ? colors.primary : colors.line,
              borderRadius: radius.md, paddingHorizontal: 14, fontSize: 14.5, fontWeight: '700',
              color: colors.text, backgroundColor: colors.surface,
            }}
          />
          {!!nickname.trim() && nickErr && (
            <Text style={{ marginTop: 8, fontSize: 11.5, color: colors.danger, fontWeight: '600' }}>{nickErr}</Text>
          )}

          {/* 지역 */}
          <Text style={[st.label, { color: colors.sub, marginTop: 18 }]}>지역</Text>
          <Pressable
            onPress={() => setRegionOpen(true)}
            style={{
              height: 52, borderWidth: 1.5, borderColor: region ? colors.primary : colors.line,
              borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.surface,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 13.5, fontWeight: region ? '700' : '500', color: region ? colors.text : colors.mute }}>
              {region || '지역을 선택해주세요'}
            </Text>
            <Icons.chev size={18} color={colors.mute} />
          </Pressable>

          {/* 모임에서 보이는 모습 미리보기 */}
          <Text style={[st.label, { color: colors.sub, marginTop: 26 }]}>모임에서 이렇게 보여요</Text>
          <View
            style={{
              backgroundColor: colors.surface, borderRadius: radius.card, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.bgSoft }}>
              {photo ? (
                <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <LinearGradient colors={['#D96A61', '#bf3127']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%' }} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '800', color: colors.text }}>
                  {nickname.trim() || '닉네임'}
                </Text>
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.primarySoft }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary }}>호스트</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: colors.sub, marginTop: 2 }}>
                모임 카드·참여자 목록에 표시되는 모습이에요
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 11, color: colors.mute, marginTop: 14, lineHeight: 16 }}>
            인연(소개팅) 프로필의 사진·소개는 인연 탭 &gt; 마이페이지에서 따로 관리해요.
            대표사진은 모임과 인연에서 함께 사용됩니다.
          </Text>
        </ScrollView>

        <RegionPicker visible={regionOpen} value={region} onSelect={setRegion} onClose={() => setRegionOpen(false)} />

        <View
          style={{
            // 홈 인디케이터·안드로이드 내비 바에 버튼이 깔리지 않게 — 안전영역이 없는 기기는 예전 28 그대로
            position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: Math.max(28, bottomBarPad(insets.bottom)),
            backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft,
          }}
        >
          <Btn kind="primary" full size="lg" disabled={!canSave} onPress={save}>
            {busy ? '저장 중…' : '저장하기'}
          </Btn>
        </View>
      </View>
    </KeyboardAware>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 11.5, fontWeight: '700', marginBottom: 10 },
});
