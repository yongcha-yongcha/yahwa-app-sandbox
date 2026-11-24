// 게시글 아래 댓글 입력 줄(리뉴얼 1120, 시안 .cx-bar · spec-rest §3.4) — 입력 중인 글자는 여기서만 들고 있는다.
// 예전엔 게시글 화면(LoungeDetail)이 들고 있어 한 글자 칠 때마다 본문·사진·댓글 전체가 다시 그려져 입력이 버벅였다(1109).
// 입력 알약: 높이 48(여러 줄이면 위로 늘어남, 글 높이 최대 112) · 모서리 22 · 안쪽 0 5 0 16.
//   쉬는 중 회색 카드 / 쓰는 중 흰 바탕 + 테두리 1.5 진회색. 글 16/25.6, 안내 "따뜻한 이야기를 남겨 주세요".
// 보내기 원 34: 꺼짐 #CFD5DA + 글자-연(투명도 45%) / 켜짐 강조 파랑 + 흰색.
// 답글 중 · 고치는 중 바: 알약 위 10 · 높이 32 · 모서리 10 · #E3E7EA · "@닉네임에게 답글" / "이야기 고치는 중" + "취소".
// 위쪽 24는 투명 → 흰색 띠(글이 입력 줄에 닿기 전에 사라진다).
// 음성 댓글(시안 .an-mic · .an-voice, 0188): 글 칸 오른쪽 마이크 36(아이콘 22, 고치는 중엔 없음) → 글쓰기와 같은 녹음 시트 →
//   알약 바로 위(답글 바 아래)에 재생 줄 + '지우기'(13/500 글자-연), 아래 8. 음성만 있어도 보낼 수 있다.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout } from '../../tokens';
import { Icon, useToastAnchor } from '../../ui';
import { useKeyboardHeight } from '../KeyboardAware';
import { audioAvailable } from '../../lib/audioMessage';
import { RecordSheet, type Clip } from './RecordSheet';
import { SiteAudio } from './SiteAudio';
import { CIcon } from './cIcons';

const webNoOutline = Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as any) : null;
const LINE = 25.6;
const PAD = (45 - LINE) / 2;  // 알약 안쪽 45에서 글 줄을 가운데에
// iOS 입력창은 줄 높이(25.6)에서 남는 몫을 글자 위에 다 몰아 둔다(RN이 Text에는 기준선을 가운데로 보정하지만 TextInput에는 안 한다).
// Pretendard 16 기본 줄 높이 19.1 → 글자가 (25.6 − 19.1) / 2 ≈ 3.25 아래로 쏠린다. 글 칸을 그만큼 위로 올려 맞춘다(안내 글도 같이).
const IOS_SHIFT = Platform.OS === 'ios' ? (LINE - 19.1) / 2 : 0;

export function CommentComposer({ inputRef, replyTo, onCancelReply, editing, onCancelEdit, pending, onSubmit }: {
  inputRef: React.RefObject<TextInput | null>;
  replyTo: { nick: string } | null;
  onCancelReply: () => void;
  editing?: { id: string; body: string } | null;   // 내 댓글 고치는 중 — 입력에 원문을 채운다
  onCancelEdit?: () => void;
  pending: boolean;
  // 등록(또는 수정)에 성공하면 true — 그때만 입력을 비운다. clip: 녹음한 음성(새 댓글만)
  onSubmit: (text: string, clip?: Clip | null) => Promise<boolean>;
}) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight() > 0;  // 키보드가 올라오면 아래 여백(홈 인디케이터 몫)을 줄인다
  const [comment, setComment] = useState('');
  const [inputH, setInputH] = useState(LINE);  // 입력칸 글자 높이(한 줄 ~ 최대 112)
  const [focused, setFocused] = useState(false);
  const [h, setH] = useState(0);
  useToastAnchor(h);
  const [clip, setClip] = useState<Clip | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const canAudio = audioAvailable();  // 녹음 모듈이 없는 구빌드에서는 마이크를 숨긴다
  const has = !!comment.trim() || (!editing && !!clip);

  // 고치기 시작 — 원문을 채우고 커서를 끝으로
  useEffect(() => {
    if (!editing) return;
    setComment(editing.body);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [editing?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!has || pending) return;
    if (await onSubmit(comment, editing ? null : clip)) { setComment(''); setInputH(LINE); setClip(null); }
  }
  function cancel() {
    if (editing) { setComment(''); setInputH(LINE); onCancelEdit?.(); } else onCancelReply();
  }

  const bar = editing ? 'edit' : replyTo ? 'reply' : null;
  return (
    <View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={{ paddingTop: 10, paddingHorizontal: layout.gutter, paddingBottom: kb ? 10 : Math.max(28, insets.bottom + 12), backgroundColor: colors.bg }}>
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', colors.bg]} style={{ position: 'absolute', left: 0, right: 0, top: -24, height: 24 }} />
      {bar && (
        <View style={{ height: 32, marginBottom: 10, paddingLeft: 12, borderRadius: 10, backgroundColor: colors.muted, flexDirection: 'row', alignItems: 'center' }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.textSecondary }}>
            {bar === 'edit' ? '이야기 고치는 중' : <><Text style={{ fontWeight: '600', color: colors.accent }}>@{replyTo!.nick}</Text>에게 답글</>}
          </Text>
          <Pressable onPress={cancel} accessibilityRole="button" accessibilityLabel={bar === 'edit' ? '고치기 취소' : '답글 취소'} hitSlop={6} style={{ height: 32, paddingHorizontal: 12, justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.mute }}>취소</Text>
          </Pressable>
        </View>
      )}
      {!editing && clip && (
        <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SiteAudio url={clip.uri} durationSec={clip.duration} style={{ flex: 1, minWidth: 0 }} />
          <Pressable onPress={() => setClip(null)} accessibilityRole="button" accessibilityLabel="음성 지우기" style={{ minHeight: 36, paddingHorizontal: 8, justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, lineHeight: 16, fontWeight: '500', color: colors.mute }}>지우기</Text>
          </Pressable>
        </View>
      )}
      <View style={{ minHeight: 48, borderRadius: 22, borderWidth: 1.5, borderColor: focused ? colors.inverseStrong : 'transparent', backgroundColor: focused ? colors.surface : colors.bgSoft, paddingLeft: 14.5, paddingRight: 3.5, flexDirection: 'row', alignItems: 'flex-end' }}>
        {/* 글 칸 — 앱은 글이 늘면 저절로 커지고, 웹은 내용 높이에 맞춘다(최대 112) */}
        <View style={{ flex: 1, minWidth: 0, paddingTop: PAD - IOS_SHIFT, paddingBottom: PAD + IOS_SHIFT }}>
          <TextInput
            ref={inputRef}
            value={comment}
            onChangeText={(t) => { setComment(t); if (!t) setInputH(LINE); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            accessibilityLabel={bar === 'edit' ? '이야기 고치기' : replyTo ? '답글 남기기' : '이야기 남기기'}
            placeholder="따뜻한 이야기를 남겨 주세요"
            placeholderTextColor={colors.sub}
            multiline
            numberOfLines={1}
            maxLength={2000}
            onContentSizeChange={Platform.OS === 'web' ? (e) => setInputH(Math.min(112, Math.max(LINE, e.nativeEvent.contentSize.height))) : undefined}
            cursorColor={colors.focus}
            selectionColor={colors.focus}
            style={[{
              minHeight: LINE, maxHeight: 112, padding: 0, paddingTop: 0, paddingBottom: 0,
              fontSize: 16, lineHeight: LINE, color: colors.text, textAlignVertical: 'center',
            }, Platform.OS === 'web' ? { height: inputH } : null, webNoOutline]}
          />
        </View>
        {canAudio && !editing && (
          <Pressable
            onPress={() => setRecOpen(true)}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel="음성 댓글"
            style={({ pressed }) => ({ width: 36, height: 36, marginLeft: 4, marginRight: 2, marginBottom: 4.5, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <CIcon name="mic" size={22} color={colors.textSecondary} />
          </Pressable>
        )}
        <Pressable
          onPress={submit}
          disabled={!has || pending}
          accessibilityRole="button"
          accessibilityLabel="보내기"
          accessibilityState={{ disabled: !has || pending }}
          hitSlop={5}
          style={{ width: 34, height: 34, marginLeft: canAudio && !editing ? 0 : 6, marginBottom: 5.5, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: has ? colors.accent : colors.control, opacity: has ? 1 : 0.45 }}
        >
          <Icon name="arrow-up" size={18} color={has ? colors.inverse : colors.mute} />
        </Pressable>
      </View>
      <RecordSheet open={recOpen} onClose={() => setRecOpen(false)} onDone={(c) => { setClip(c); setRecOpen(false); }} />
    </View>
  );
}
