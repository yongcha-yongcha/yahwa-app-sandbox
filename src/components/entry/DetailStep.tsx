// 소개 2/4 — 상세 정보(spec-shell §4.9 · §5.4 a-6 · b-8 · b-12). 프로필 수정의 '기본 정보 고치기'도 같은 부품.
// 필수는 우리 규칙 그대로(직업 · 키 · MBTI · 학력 · 종교 · 흡연 + 사는 곳). 고르는 창은 공용 시트 + 진회색 칩, 키 · 사는 곳은 휠.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, fontSerif } from '../../tokens';
import { BottomSheet, Chip, FieldHelp, SelectField, Switch, TextField, WheelSheet } from '../../ui';
import { HEIGHTS, LABEL, OPTIONS, objJosa, phoneTyping, regionText, shownValue } from './profileOptions';
import { RegionWheel } from './RegionWheel';
import { NICKNAME_MAX } from '../../lib/nickname';

export type Details = {
  nickname: string; job: string; region: string; height: number | null; mbti: string; education: string;
  religion: string; smoking: string; drinking: string; politics: string; politicsPublic: boolean; kakao: string; phone: string;
};
// 필수 항목(대표 지시 1013) — 화면 순서대로
export const REQUIRED = ['job', 'region', 'height', 'mbti', 'education', 'religion', 'smoking'] as const;
export const missingRequired = (d: Details) => REQUIRED.filter((k) => !d[k]);

type Key = 'job' | 'region' | 'mbti' | 'education' | 'religion' | 'smoking' | 'drinking' | 'politics';

// show: 화면에 낼 칸(가입 때 이미 받은 닉네임 · 사는 곳 · 휴대폰은 비어 있을 때만 다시 묻는다)
export function DetailFields({ d, set, show, showMissing, nickError, phoneError, onLayoutField }: {
  d: Details;
  set: <K extends keyof Details>(k: K, v: Details[K]) => void;
  show: { nickname?: boolean; region?: boolean; phone?: boolean; kakao?: boolean };
  showMissing?: boolean;
  nickError?: string;
  phoneError?: string;
  onLayoutField?: (k: string, y: number) => void;
}) {
  const [sheet, setSheet] = useState<Key | 'height' | null>(null);
  const [shown, setShown] = useState<Key>('job');   // 닫히는 동안에도 내용을 그대로 둔다
  const open = (k: Key) => { if (k !== 'region') setShown(k); setSheet(k); };
  const miss = (k: keyof Details) => !!showMissing && !d[k];
  const at = (k: string) => (e: { nativeEvent: { layout: { y: number } } }) => onLayoutField?.(k, e.nativeEvent.layout.y);
  const select = (k: Key, label: string, value: string) => (
    <View onLayout={at(k)} style={{ marginTop: 22 }}>
      <SelectField label={label} value={value} open={sheet === k} onPress={() => open(k)} error={miss(k) ? `${LABEL[k]}${objJosa(LABEL[k])} 선택해 주세요.` : false} />
    </View>
  );
  // 사는 곳은 휠(RegionWheel)로 고르니 칩 시트 내용은 직전 항목 그대로 둔다(OPTIONS에 region이 없다)
  const sheetKey = sheet && sheet !== 'height' && sheet !== 'region' ? sheet : shown;
  return (
    <View>
      {show.nickname && (
        <View onLayout={at('nickname')} style={{ marginTop: 22 }}>
          <TextField label="닉네임" value={d.nickname} onChangeText={(t) => set('nickname', t.slice(0, NICKNAME_MAX))} maxLength={NICKNAME_MAX} placeholder={`2~${NICKNAME_MAX}자`} clearable help="인연과 커뮤니티에서 보이는 이름이에요." error={nickError || false} />
        </View>
      )}
      {select('job', '직업', d.job)}
      {show.region && select('region', '사는 곳', regionText(d.region))}
      <View onLayout={at('height')} style={{ marginTop: 22 }}>
        <SelectField label="키 (cm)" value={d.height ? `${d.height}cm` : ''} open={sheet === 'height'} onPress={() => setSheet('height')} error={miss('height') ? '키를 선택해 주세요.' : false} />
      </View>
      {select('mbti', 'MBTI', d.mbti)}
      {select('education', '학력', d.education)}
      {select('religion', '종교', d.religion)}
      {select('smoking', '흡연', d.smoking)}
      {select('drinking', '음주 · 선택', shownValue(d.drinking))}
      {select('politics', '정치 성향 · 선택', d.politics)}
      <View style={{ marginTop: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.text }}>정치 성향을 프로필에 보여 주기</Text>
        <Switch value={d.politicsPublic} onChange={(v) => set('politicsPublic', v)} accessibilityLabel="정치 성향 공개" />
      </View>
      {show.phone && (
        <View onLayout={at('phone')} style={{ marginTop: 10 }}>
          <TextField label="휴대폰 번호" value={d.phone} onChangeText={(t) => set('phone', phoneTyping(t))} keyboardType="number-pad" placeholder="010-0000-0000" maxLength={13} clearable help="매장 포인트 연결과 편지 연락처에 쓰여요. 다른 회원에게 공개되지 않아요." error={phoneError || false} />
        </View>
      )}
      {show.kakao && (
        <View style={{ marginTop: 22 }}>
          <TextField label="카톡 ID · 선택" value={d.kakao} onChangeText={(t) => set('kakao', t)} placeholder="카톡 ID를 입력해 주세요" autoCapitalize="none" maxLength={30} clearable />
          <FieldHelp>편지를 보낼 때 함께 보낼 연락처로 고를 수 있어요. 서로 답장을 보내면 연락처가 공개돼요.</FieldHelp>
        </View>
      )}

      {/* 선택 시트 — 칩을 누르면 바로 고르고 닫힌다 */}
      <BottomSheet open={!!sheet && sheet !== 'height' && sheet !== 'region'} onClose={() => setSheet(null)}>
        <Text accessibilityRole="header" style={{ fontFamily: fontSerif, fontSize: 20, lineHeight: 28, color: colors.text }}>{LABEL[sheetKey]}</Text>
        <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 19.5, color: colors.mute }}>당신의 일상에 가까운 항목을 골라주세요.</Text>
        <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {OPTIONS[sheetKey].map((o) => (
            <Chip key={o} label={shownValue(o)} selected={d[sheetKey] === o} onPress={() => { set(sheetKey, o); setSheet(null); }} />
          ))}
        </View>
      </BottomSheet>
      <RegionWheel open={sheet === 'region'} value={d.region} onClose={() => setSheet(null)} onPick={(r) => { set('region', r); setSheet(null); }} />
      <WheelSheet
        open={sheet === 'height'}
        onClose={() => setSheet(null)}
        title="키"
        caption="가까운 값으로 골라 주세요."
        columns={[{ current: d.height ?? 170, values: HEIGHTS.map((h) => ({ value: h, label: `${h}cm` })) }]}
        onDone={([v]) => { set('height', Number(v)); setSheet(null); }}
      />
    </View>
  );
}
