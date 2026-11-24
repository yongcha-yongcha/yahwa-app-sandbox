// 야화 — 날짜·시간 선택기 (모임 생성 플로우용). 순수 JS 커스텀 달력 + 시/분 선택.
// 네이티브 date 모듈 미사용 (웹 호환). Date 연산으로 직접 구현.
import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { Btn } from './atoms';
import { bottomBarPad } from '../lib/layout';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

// 자정 기준 날짜 비교용 (시간 무시).
function atMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// 로컬 시간대 기준 ISO 8601 문자열 (오프셋 포함).
function toLocalISO(d: Date): string {
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const oh = pad2(Math.floor(Math.abs(offMin) / 60));
  const om = pad2(Math.abs(offMin) % 60);
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00${sign}${oh}:${om}`
  );
}

export function DateTimePicker({
  visible,
  value,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  value?: string | null;
  onConfirm: (iso: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const todayMid = atMidnight(now);

  // 초기값: value 파싱 가능하면 사용, 아니면 오늘 + 현재 시각(5분 반올림).
  const initial = useMemo(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date();
    d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
    return d;
    // value/visible 변할 때 재계산은 아래 key 리마운트로 처리하지 않고 단순 초기값만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth()); // 0-based
  const [selDate, setSelDate] = useState<Date>(
    new Date(initial.getFullYear(), initial.getMonth(), initial.getDate()),
  );
  const [hour, setHour] = useState(initial.getHours());
  const [minute, setMinute] = useState(Math.round(initial.getMinutes() / 5) * 5 % 60);

  // 현재 보고 있는 달의 그리드 (앞쪽 빈칸 포함).
  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay(); // 0=일
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  // 이전 달 화살표 비활성: 현재 보는 달이 이번 달 이하이면 막음.
  const atOrBeforeThisMonth =
    viewYear < now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth <= now.getMonth());

  function confirm() {
    const d = new Date(
      selDate.getFullYear(),
      selDate.getMonth(),
      selDate.getDate(),
      hour,
      minute,
      0,
      0,
    );
    onConfirm(toLocalISO(d));
    onClose();
  }

  const selMid = atMidnight(selDate);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingTop: 14,
            maxHeight: '90%',
          }}
        >
          {/* 핸들 */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 6 }} />

          {/* 헤더 */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 18,
              paddingTop: 8,
              paddingBottom: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.lineSoft,
            }}
          >
            <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.text }}>일시 선택</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} hitSlop={8}>
              <Icons.close size={22} color={colors.sub} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14 }}>
            {/* 월 네비게이션 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="뒤로"
                onPress={prevMonth}
                disabled={atOrBeforeThisMonth}
                hitSlop={8}
                style={{ opacity: atOrBeforeThisMonth ? 0.3 : 1, padding: 4 }}
              >
                <Icons.chevLeft size={22} color={colors.text} />
              </Pressable>
              <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.text }}>
                {viewYear}년 {viewMonth + 1}월
              </Text>
              <Pressable onPress={nextMonth} hitSlop={8} style={{ padding: 4 }}>
                <Icons.chev size={22} color={colors.text} />
              </Pressable>
            </View>

            {/* 요일 헤더 */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {WEEK.map((w, i) => (
                <View key={w} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: i === 0 ? colors.danger : i === 6 ? colors.primary : colors.sub,
                    }}
                  >
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            {/* 날짜 그리드 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((day, idx) => {
                if (day === null) {
                  return <View key={`e${idx}`} style={{ width: `${100 / 7}%`, height: 44 }} />;
                }
                const cellDate = new Date(viewYear, viewMonth, day);
                const cellMid = atMidnight(cellDate);
                const isPast = cellMid < todayMid;
                const isSel = cellMid === selMid;
                const dow = cellDate.getDay();
                return (
                  <View key={`d${idx}`} style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Pressable
                      onPress={() => !isPast && setSelDate(cellDate)}
                      disabled={isPast}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSel ? colors.primary : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: isSel ? '800' : '600',
                          color: isSel
                            ? '#fff'
                            : isPast
                            ? colors.mute
                            : dow === 0
                            ? colors.danger
                            : dow === 6
                            ? colors.primary
                            : colors.text,
                        }}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* 시간 선택 */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.sub, marginTop: 18, marginBottom: 8 }}>시간</Text>

            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.mute, marginBottom: 6 }}>시</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
            >
              {HOURS.map((h) => {
                const active = h === hour;
                return (
                  <Pressable
                    key={h}
                    onPress={() => setHour(h)}
                    style={{
                      minWidth: 44,
                      paddingHorizontal: 12,
                      height: 40,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? colors.primarySoft : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.line,
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: active ? '800' : '600', color: active ? colors.primary : colors.text }}>
                      {pad2(h)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.mute, marginTop: 12, marginBottom: 6 }}>분</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
            >
              {MINUTES.map((m) => {
                const active = m === minute;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMinute(m)}
                    style={{
                      minWidth: 44,
                      paddingHorizontal: 12,
                      height: 40,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? colors.primarySoft : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.line,
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: active ? '800' : '600', color: active ? colors.primary : colors.text }}>
                      {pad2(m)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 선택 요약 */}
            <View
              style={{
                marginTop: 18,
                padding: 14,
                backgroundColor: colors.bgSoft,
                borderRadius: radius.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Icons.calendar size={18} color={colors.primary} />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.text }}>
                {selDate.getFullYear()}.{pad2(selDate.getMonth() + 1)}.{pad2(selDate.getDate())}
                {' '}({WEEK[selDate.getDay()]}) {pad2(hour)}:{pad2(minute)}
              </Text>
            </View>
          </ScrollView>

          {/* 확정 버튼 */}
          <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: bottomBarPad(insets.bottom), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft }}>
            <Btn kind="primary" full onPress={confirm}>
              선택 완료
            </Btn>
          </View>
        </View>
      </View>
    </Modal>
  );
}
