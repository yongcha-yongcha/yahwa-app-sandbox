// 야화 — 생년월일 입력 (19세 게이트). 가입 직후 1회만.
// 화면은 시안 사이트 '본인 확인'(.entry-flow.identity) 실측(1013).
import React, { useState } from 'react';
import { View, Alert, ScrollView } from 'react-native';
import { colors } from '../tokens';
import { KeyboardAware } from '../components/KeyboardAware';
import {
  EntryHeader, EntryEyebrow, EntryTitle, EntryLead, EntryButton, EntryFooter, FormError, FieldLabel, DobField, entryContentPad,
} from '../components/entry/EntryKit';
import { setBirthDate, signupAgeError } from '../lib/auth';

export function BirthDate({ onDone }: { onDone: () => void }) {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [busy, setBusy] = useState(false);

  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const valid =
    Number.isInteger(y) && y >= 1900 && y <= new Date().getFullYear() &&
    Number.isInteger(m) && m >= 1 && m <= 12 &&
    Number.isInteger(d) && d >= 1 && d <= 31;
  const ageErr = valid ? signupAgeError(y, m, d) : null;
  const adult = valid && !ageErr;

  async function submit() {
    if (!valid) return;
    if (!adult) {
      Alert.alert('가입 불가', ageErr ?? '가입할 수 없는 나이예요');
      return;
    }
    setBusy(true);
    try {
      await setBirthDate(y, m, d);
      onDone();
    } catch (e: any) {
      Alert.alert('등록 실패', e?.message || '다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAware scroll style={{ flex: 1, backgroundColor: colors.surface }}>
      <EntryHeader />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={entryContentPad} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <EntryEyebrow>본인 확인</EntryEyebrow>
        <EntryTitle>생년월일을{'\n'}입력해 주세요.</EntryTitle>
        <EntryLead>
          만 19세~39세만 야화를 이용할 수 있어요.{'\n'}한 번 입력하면 수정할 수 없어요.
        </EntryLead>

        <FieldLabel style={{ marginTop: 28 }}>생년월일</FieldLabel>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
          <DobField label="년" value={year} setValue={setYear} max={4} placeholder="2000" flex={1.4} />
          <DobField label="월" value={month} setValue={setMonth} max={2} placeholder="01" flex={1} />
          <DobField label="일" value={day} setValue={setDay} max={2} placeholder="01" flex={1} />
        </View>
        {valid && !adult && <FormError style={{ marginTop: 13 }}>{ageErr}</FormError>}
      </ScrollView>
      <EntryFooter>
        <EntryButton label={busy ? '등록 중…' : '시작하기'} disabled={!valid || busy} onPress={submit} />
      </EntryFooter>
    </KeyboardAware>
  );
}
