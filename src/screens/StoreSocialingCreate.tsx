// 야화 — 매장 모임 신청 ('야화에서 모이자'). 매장 정보를 고정해두고 store-tied 모임을 만들어 admin 승인 대기.
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../tokens';
import { KeyboardAware } from '../components/KeyboardAware';
import { Icons } from '../icons';
import { Btn, Chip, NavBar } from '../components/atoms';
import { DateTimePicker } from '../components/DateTimePicker';
import { previewSelectors, usePreview, requireAuth } from '../lib/previewStore';
import { useStores, useCreateGatheringMutation, useMySettlementInfo } from '../lib/hooks';
import { STORES } from '../data/mock';
import { friendlyError } from '../lib/errors';
import { bottomBarPad } from '../lib/layout';
import { SettlementPromptSheet } from '../components/SettlementPromptSheet';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

// ISO datetime → "6/5 (목) 19:30"
function isoToDisplay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEK[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CAP_OPTIONS: { label: string; capacity: number }[] = [
  { label: '2명', capacity: 2 },
  { label: '3명', capacity: 3 },
  { label: '4명', capacity: 4 },
  { label: '1:1', capacity: 2 },
];

export function StoreSocialingCreate({
  storeId,
  onBack,
  onDone,
  onOpenSettlementInfo,
}: {
  storeId: string;
  onBack?: () => void;
  onDone?: () => void;
  onOpenSettlementInfo?: () => void;
}) {
  const storesQ = useStores();
  const insets = useSafeAreaInsets();
  const myProfile = usePreview(previewSelectors.myProfile);
  const createMut = useCreateGatheringMutation();
  const settlementQ = useMySettlementInfo();
  const busy = createMut.isPending;
  const [showSettlementPrompt, setShowSettlementPrompt] = useState(false);

  const all = (storesQ.data as typeof STORES | undefined) ?? [];
  const store = all.find((x) => x.id === storeId);

  const [title, setTitle] = useState('');
  const [capIdx, setCapIdx] = useState(0);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [whenDisplay, setWhenDisplay] = useState('');
  const [fee, setFee] = useState('0');
  const [feeDesc, setFeeDesc] = useState('');
  const [desc, setDesc] = useState('');
  const [timeOpen, setTimeOpen] = useState(false);

  const feeNum = Math.max(0, parseInt(fee, 10) || 0);

  if (storesQ.isLoading && !store) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgSoft }}>
        <NavBar
          title="모임 신청"
          left={
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.chevLeft size={22} color={colors.text} />
            </Pressable>
          }
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 13.5, color: colors.sub, fontWeight: '600' }}>매장 정보를 찾을 수 없어요</Text>
        </View>
      </View>
    );
  }

  async function submit() {
    if (!requireAuth('모임 신청은 로그인 후 가능해요')) return;
    if (!title.trim()) {
      Alert.alert('입력 필요', '모임 제목을 입력해 주세요');
      return;
    }
    if (!startAt) {
      Alert.alert('입력 필요', '일시를 선택해 주세요');
      return;
    }
    if (feeNum > 0 && !feeDesc.trim()) {
      Alert.alert('입력 필요', '참가비 사용처를 입력해 주세요');
      return;
    }
    if (!myProfile.nickname.trim()) {
      Alert.alert('프로필 설정이 필요해요', '모임을 신청하려면 닉네임이 있어야 해요.\n마이 → 프로필 편집에서 닉네임을 저장한 뒤 다시 시도해주세요.');
      return;
    }
    const capacity = CAP_OPTIONS[capIdx].capacity;
    try {
      await createMut.mutateAsync({
        title: title.trim(),
        cat: store!.cat ?? '모임',
        cover: store!.imageUrls?.[0] ?? '',
        ratio: '2:2',
        whenText: whenDisplay,
        place: store!.name,
        description: desc.trim() || '야화에서 가볍게 모여요.',
        hostNick: myProfile.nickname,
        hostPhoto: myProfile.groupPhoto ?? (typeof myProfile.photo === 'string' ? myProfile.photo : null),
        gender: (myProfile.gender ?? 'M') as 'M' | 'F',
        genderMode: 'any',
        capacity,
        fee: feeNum,
        feeDesc: feeNum > 0 ? feeDesc.trim() : undefined,
        region: store!.region ?? undefined,
        socialKind: 'yahwa',
        startAt,
        storeId: store!.id,
        approved: false,
      });
      if (!settlementQ.data) {
        setShowSettlementPrompt(true);
      } else {
        Alert.alert('모임 신청 완료', '야화 승인 후 지도/모임에 노출돼요');
        onDone?.();
      }
    } catch (e: any) {
      const f = friendlyError(e, '모임 신청 실패');
      Alert.alert(f.title, f.message);
    }
  }

  return (
    <KeyboardAware scroll style={{ flex: 1, backgroundColor: colors.bgSoft }}>
      <View style={{ flex: 1, backgroundColor: colors.bgSoft }}>
        <NavBar
          title="모임 신청"
          left={
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.chevLeft size={22} color={colors.text} />
            </Pressable>
          }
        />
  
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
          {/* 매장 카드 (읽기 전용) */}
          <View
            style={{
              margin: 16,
              padding: 16,
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.line,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 }}>{store.name}</Text>
            <StoreLine icon="pin" text={store.address || store.region || '주소 미등록'} />
            {!!store.phone && <StoreLine icon="calendar" text={store.phone} />}
  
            {/* 혜택 강조 */}
            <View
              style={{
                marginTop: 14,
                padding: 12,
                backgroundColor: colors.primarySoft,
                borderRadius: radius.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icons.leaf size={16} color={colors.primary} />
              <Text style={{ flex: 1, fontSize: 11, lineHeight: 16, color: colors.primary, fontWeight: '700' }}>
                야화에서 모이자 · 칵테일 1잔 모두에게 무료 제공
              </Text>
            </View>
          </View>
  
          <View style={{ paddingHorizontal: 16 }}>
            <Field label="제목" value={title} onChange={setTitle} placeholder="예: 성수 칵테일바 가볍게 한 잔" />
  
            <Section label="모집 인원">
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CAP_OPTIONS.map((o, i) => (
                  <Chip key={o.label} active={capIdx === i} onPress={() => setCapIdx(i)}>
                    {o.label}
                  </Chip>
                ))}
              </View>
            </Section>
  
            <Section label="일시">
              <RowButton
                icon={<Icons.calendar size={18} color={startAt ? colors.primary : colors.mute} />}
                text={whenDisplay || '날짜·시간 선택'}
                placeholder={!startAt}
                onPress={() => setTimeOpen(true)}
              />
            </Section>
  
            <Section label="참가비 (선택)">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  value={fee}
                  onChangeText={setFee}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.mute}
                  style={inputStyle}
                />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.sub }}>원</Text>
              </View>
              {feeNum > 0 && (
                <View style={{ marginTop: 10 }}>
                  <TextInput
                    value={feeDesc}
                    onChangeText={setFeeDesc}
                    placeholder="참가비 사용처 (예: 공간 대여비, 운영비)"
                    placeholderTextColor={colors.mute}
                    multiline
                    style={[inputStyle, { minHeight: 72, textAlignVertical: 'top' }]}
                  />
                </View>
              )}
            </Section>
  
            <Field label="소개" value={desc} onChange={setDesc} placeholder="자유롭게 작성해주세요" multiline />
          </View>
        </ScrollView>
  
        {/* 하단 제출 버튼 */}
        <View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            paddingHorizontal: 16, paddingTop: 12,
            paddingBottom: bottomBarPad(insets.bottom, 16),
            backgroundColor: colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft,
          }}
        >
          <Btn kind="primary" full size="lg" disabled={busy} onPress={submit}>
            {busy ? '신청 중…' : '모임 신청하기'}
          </Btn>
        </View>
  
        <DateTimePicker
          visible={timeOpen}
          value={startAt}
          onConfirm={(iso) => {
            setStartAt(iso);
            setWhenDisplay(isoToDisplay(iso));
          }}
          onClose={() => setTimeOpen(false)}
        />
  
        <SettlementPromptSheet
          open={showSettlementPrompt}
          onClose={() => { setShowSettlementPrompt(false); onDone?.(); }}
          onRegisterNow={() => { setShowSettlementPrompt(false); onOpenSettlementInfo?.(); }}
        />
      </View>
    </KeyboardAware>
  );
}

const inputStyle = {
  flex: 1,
  fontSize: 12.5,
  color: colors.text,
  paddingVertical: 10,
  paddingHorizontal: 14,
  backgroundColor: colors.bgSoft,
  borderRadius: radius.md,
  minHeight: 44,
} as const;

function StoreLine({ icon, text }: { icon: keyof typeof Icons; text: string }) {
  const Ic = Icons[icon];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
      <Ic size={16} color={colors.primary} />
      <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.text }} numberOfLines={2}>{text}</Text>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.sub, marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  );
}

function RowButton({
  icon, text, placeholder, onPress,
}: {
  icon: React.ReactNode; text: string; placeholder?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        minHeight: 48,
        backgroundColor: colors.bgSoft,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      {icon}
      <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: placeholder ? colors.mute : colors.text }}>
        {text}
      </Text>
      <Icons.chev size={18} color={colors.mute} />
    </Pressable>
  );
}

function Field({
  label, value, onChange, placeholder, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.sub, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mute}
        multiline={multiline}
        style={{
          fontSize: 12.5,
          color: colors.text,
          paddingVertical: 10,
          paddingHorizontal: 14,
          backgroundColor: colors.bgSoft,
          borderRadius: radius.md,
          minHeight: multiline ? 80 : 44,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}
