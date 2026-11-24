// 야화 — 지역 선택기 (모임 생성 플로우용). 시도/구 선택 + 검색.
import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { NavBar } from './atoms';

// 시/도별 대표 구·군. onSelect는 "시도/구" 형태로 콜백.
const REGIONS: { sido: string; gus: string[] }[] = [
  { sido: '서울', gus: ['강남', '강동', '강북', '강서', '관악', '광진', '구로', '금천', '노원', '도봉', '동대문', '동작', '마포', '서대문', '서초', '성동', '성북', '송파', '양천', '영등포', '용산', '은평', '종로', '중구', '중랑'] },
  { sido: '경기', gus: ['수원', '성남', '고양', '용인', '부천', '안산', '안양', '남양주', '화성', '평택', '의정부', '시흥', '파주', '김포', '광명', '광주', '군포', '하남', '오산', '이천', '안성', '의왕', '양주', '구리', '포천', '여주', '동두천', '과천', '가평', '연천', '양평'] },
  { sido: '인천', gus: ['중구', '동구', '미추홀', '연수', '남동', '부평', '계양', '서구', '강화', '옹진'] },
  { sido: '부산', gus: ['중구', '서구', '동구', '영도', '부산진', '동래', '남구', '북구', '해운대', '사하', '금정', '강서', '연제', '수영', '사상', '기장'] },
  { sido: '대구', gus: ['중구', '동구', '서구', '남구', '북구', '수성', '달서', '달성', '군위'] },
  { sido: '광주', gus: ['동구', '서구', '남구', '북구', '광산'] },
  { sido: '대전', gus: ['동구', '중구', '서구', '유성', '대덕'] },
  { sido: '울산', gus: ['중구', '남구', '동구', '북구', '울주'] },
  { sido: '세종', gus: ['세종'] },
  { sido: '강원', gus: ['춘천', '원주', '강릉', '동해', '태백', '속초', '삼척', '홍천', '횡성', '영월', '평창', '정선', '철원', '화천', '양구', '인제', '고성', '양양'] },
  { sido: '충북', gus: ['청주', '충주', '제천', '보은', '옥천', '영동', '증평', '진천', '괴산', '음성', '단양'] },
  { sido: '충남', gus: ['천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '금산', '부여', '서천', '청양', '홍성', '예산', '태안'] },
  { sido: '전북', gus: ['전주', '군산', '익산', '정읍', '남원', '김제', '완주', '진안', '무주', '장수', '임실', '순창', '고창', '부안'] },
  { sido: '전남', gus: ['목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성', '화순', '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도', '진도', '신안'] },
  { sido: '경북', gus: ['포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', '의성', '청송', '영양', '영덕', '청도', '고령', '성주', '칠곡', '예천', '봉화', '울진', '울릉'] },
  { sido: '경남', gus: ['창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '의령', '함안', '창녕', '고성', '남해', '하동', '산청', '함양', '거창', '합천'] },
  { sido: '제주', gus: ['제주', '서귀포'] },
  { sido: '온라인/기타', gus: ['온라인', '기타'] },
];

export function RegionPicker({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value?: string | null;
  onSelect: (region: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim();
    if (!q) return REGIONS;
    return REGIONS.map((g) => {
      // 시도명이 매칭되면 모든 구를 보여주고, 아니면 매칭되는 구만 필터.
      if (g.sido.includes(q)) return g;
      const gus = g.gus.filter((gu) => gu.includes(q));
      return { sido: g.sido, gus };
    }).filter((g) => g.gus.length > 0);
  }, [query]);

  function pick(sido: string, gu: string) {
    onSelect(`${sido}/${gu}`);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
        <NavBar
          title="지역 선택"
          left={
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onClose} hitSlop={8}>
              <Icons.chevLeft size={24} color={colors.text} />
            </Pressable>
          }
        />

        {/* 검색 */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 14,
              height: 44,
              backgroundColor: colors.bgSoft,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Icons.search size={18} color={colors.mute} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="시/도 또는 구 검색"
              placeholderTextColor={colors.mute}
              style={{ flex: 1, fontSize: 12.5, color: colors.text, paddingVertical: 0 }}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Icons.close size={18} color={colors.mute} />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {groups.length === 0 ? (
            <Text style={{ fontSize: 12.5, color: colors.sub, textAlign: 'center', paddingTop: 40 }}>
              검색 결과가 없어요
            </Text>
          ) : (
            groups.map((g) => (
              <View key={g.sido} style={{ marginTop: 18 }}>
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.text, marginBottom: 10 }}>
                  {g.sido}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {g.gus.map((gu) => {
                    const region = `${g.sido}/${gu}`;
                    const active = value === region;
                    return (
                      <Pressable
                        key={gu}
                        onPress={() => pick(g.sido, gu)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          backgroundColor: active ? colors.primarySoft : colors.surface,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.line,
                          borderRadius: radius.pill,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: active ? '800' : '600',
                            color: active ? colors.primary : colors.sub,
                          }}
                        >
                          {gu}
                        </Text>
                        {active && <Icons.check size={14} color={colors.primary} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
