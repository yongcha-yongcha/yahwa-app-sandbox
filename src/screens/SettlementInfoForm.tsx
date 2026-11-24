// 야화 — 호스트 정산 정보 등록/수정. 모임 참가비(토스 결제) 정산을 위해
// 계좌·주민등록번호·이메일을 계정당 1건 등록해두면 이후 모든 모임에 재사용된다.
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, ActivityIndicator } from 'react-native';
import { colors, radius } from '../tokens';
import { KeyboardAware } from '../components/KeyboardAware';
import { Icons } from '../icons';
import { Btn, NavBar } from '../components/atoms';
import { previewActions } from '../lib/previewStore';
import { useMySettlementInfo, useUpsertSettlementInfoMutation } from '../lib/hooks';
import type { HostSettlementInfo } from '../lib/hooks';

type EntityType = HostSettlementInfo['entity_type'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.sub, marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={colors.mute}
      style={{
        height: 48, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md,
        paddingHorizontal: 14, fontSize: 13.5, color: colors.text,
      }}
      {...props}
    />
  );
}

function TypePick({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.line,
        backgroundColor: active ? colors.primarySoft : colors.surface,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: active ? colors.primary : colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function SettlementInfoForm({ onDone, onBack }: { onDone?: () => void; onBack?: () => void }) {
  const infoQuery = useMySettlementInfo();
  const upsertMut = useUpsertSettlementInfoMutation();

  const [entityType, setEntityType] = useState<EntityType>('individual');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [regFront, setRegFront] = useState('');
  const [regBack, setRegBack] = useState('');
  const [bizRegNumber, setBizRegNumber] = useState('');
  const [bizName, setBizName] = useState('');
  const [email, setEmail] = useState('');

  // 기존 등록 정보가 있으면 채워서 수정 모드로.
  useEffect(() => {
    const d = infoQuery.data;
    if (!d) return;
    setEntityType(d.entity_type);
    setAccountHolder(d.account_holder);
    setBankName(d.bank_name);
    setAccountNumber(d.account_number);
    setRegFront(d.resident_reg_front);
    setRegBack(d.resident_reg_back);
    setBizRegNumber(d.business_reg_number ?? '');
    setBizName(d.business_name ?? '');
    setEmail(d.email);
  }, [infoQuery.data]);

  const isBusiness = entityType === 'business';
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    !!accountHolder.trim() && !!bankName.trim() && !!accountNumber.trim() &&
    regFront.length === 6 && regBack.length === 7 && emailValid &&
    (!isBusiness || (!!bizRegNumber.trim() && !!bizName.trim()));

  async function submit() {
    if (!canSubmit) return;
    try {
      await upsertMut.mutateAsync({
        entity_type: entityType,
        account_holder: accountHolder.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        resident_reg_front: regFront,
        resident_reg_back: regBack,
        business_reg_number: isBusiness ? bizRegNumber.trim() : null,
        business_name: isBusiness ? bizName.trim() : null,
        email: email.trim(),
      });
      previewActions.showToast('정산 정보를 저장했어요');
      onDone?.();
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '저장에 실패했어요', 2600);
    }
  }

  return (
    <KeyboardAware scroll style={{ flex: 1, backgroundColor: colors.bgSoft }}>
      <NavBar
        title="정산 정보 등록"
        left={
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            <Icons.chevLeft size={22} color={colors.text} />
          </Pressable>
        }
      />
      {infoQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
          <Text style={{ fontSize: 11.5, color: colors.sub, lineHeight: 18 }}>
            모임 참가비 정산(계좌 이체)과 계산서 발행·지출 증빙에 사용돼요. 한 번 등록하면 이후 모든 모임에 그대로 적용돼요.
          </Text>

          <Field label="정산 종류">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TypePick label="개인" active={entityType === 'individual'} onPress={() => setEntityType('individual')} />
              <TypePick label="사업자" active={entityType === 'business'} onPress={() => setEntityType('business')} />
            </View>
          </Field>

          {isBusiness && (
            <>
              <Field label="사업자등록번호">
                <Input value={bizRegNumber} onChangeText={(t) => setBizRegNumber(t.replace(/[^0-9]/g, '').slice(0, 10))}
                  placeholder="10자리 숫자" keyboardType="number-pad" maxLength={10} />
              </Field>
              <Field label="상호명">
                <Input value={bizName} onChangeText={setBizName} placeholder="사업자등록증상 상호명" />
              </Field>
            </>
          )}

          <Field label="예금주명">
            <Input value={accountHolder} onChangeText={setAccountHolder} placeholder="예금주 이름" />
          </Field>
          <Field label="은행">
            <Input value={bankName} onChangeText={setBankName} placeholder="예) 국민은행" />
          </Field>
          <Field label="계좌번호">
            <Input value={accountNumber} onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, ''))}
              placeholder="'-' 없이 숫자만" keyboardType="number-pad" />
          </Field>

          <Field label="주민등록번호">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Input value={regFront} onChangeText={(t) => setRegFront(t.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="앞 6자리" keyboardType="number-pad" maxLength={6} />
              </View>
              <Text style={{ fontSize: 14.5, color: colors.mute }}>—</Text>
              <View style={{ flex: 1 }}>
                <Input value={regBack} onChangeText={(t) => setRegBack(t.replace(/[^0-9]/g, '').slice(0, 7))}
                  placeholder="뒤 7자리" keyboardType="number-pad" maxLength={7} secureTextEntry />
              </View>
            </View>
            <Text style={{ marginTop: 8, fontSize: 10, color: colors.mute }}>
              계산서 발행 및 지출 증빙 목적으로만 사용되며, 안전하게 보관돼요.
            </Text>
          </Field>

          <Field label="이메일">
            <Input value={email} onChangeText={setEmail} placeholder="매월 정산내역을 받을 이메일"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </Field>

          <View style={{ marginTop: 28 }}>
            <Btn kind="primary" full size="lg" disabled={!canSubmit || upsertMut.isPending} onPress={submit}>
              {upsertMut.isPending ? '저장 중…' : '정산 정보 저장'}
            </Btn>
          </View>
        </ScrollView>
      )}
    </KeyboardAware>
  );
}
