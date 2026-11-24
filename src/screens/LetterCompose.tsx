// 야화 — 편지 쓰기 · 답장 쓰기 (리뉴얼 1120 · spec-dating §3.8)
// 받는 사람 줄 → 편지지(그 안에서 바로 쓴다 · 줄 노트 · 글자 수) → 내 연락처(카카오톡 ID · 전화번호 중 하나 이상) → 아래 고정 버튼.
// · 새 편지: [편지 보내기] → 가격 시트(일반편지 / 특별편지 = 서버 kind 'invite') → [보내기]
// · 답장(mode='reply'): [답장 보내기 · 값 칩] — 특별편지에 대한 답장은 무료.
// 가격은 서버 값(useLeafPricing, 리프 정책 v2 — 남/여 · 연말까지 이벤트가). 쓰던 편지(초안)는 앱이 켜져 있는 동안 남는다.
// · 새 편지에만 '마음이 간 곳'(받는 사람 프로필의 문장 · 사진 두 곳까지, 0190) — 서버에 기능이 있을 때만 버튼이 보인다.
// 상단 안전 영역은 부모(SafeAreaView edges top)가 처리한다. 전역 토스트가 위에 떠야 해서 RN Modal이 아니라 일반 화면이다.
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSerif, layout, radius } from '../tokens';
import { KeyboardAware, useKeyboardHeight } from '../components/KeyboardAware';
import { usePreview, previewSelectors, previewActions, getCurrentUserId } from '../lib/previewStore';
import { setLetterMarks, type LetterKind, type LetterMark } from '../lib/api';
import { LEAF_EVENT_LABEL, useLeafPricing } from '../lib/leafPricing';
import { HIDE_IOS_CURRENCY } from '../lib/flags';
import { loadMyContact, saveMyContact } from '../lib/myContact';
import { useSendLetterMutation, useReplyLetterMutation, showLetterError, useMyLetters, useLetterMarksSupported } from '../lib/letters';
import { useFriendProfile } from '../lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { MarkGuide, MarkPickRow, MarkQuotes, MarkSheet, markGuideSeen, markSourceOf } from '../components/letters/marks';
import { ContactTile, CostChip, LetterPaper, LetterPersonRow, Ruled, letterDate, letterDaysLeft, paper } from '../components/letters/ui';
import { showActionFeedback } from '../components/ActionFeedback';
import { PriceText } from '../components/PriceText';
import { keepAll } from '../components/affinity/ui';
import { BottomSheet, Button, DockArea, Icon, LeafIcon, SheetButtons, TopBar, useDockBottom, usePress } from '../ui';
import { EventBadge } from '../ui/LeafCost';

const PHONE_RE = /^\+?[0-9 ()-]{8,20}$/;
const MAX = 500;   // 편지지 한 장(시안). 예전에 쓴 긴 편지는 그대로 보인다
const MIN = 5;

type Draft = { useKakao: boolean; usePhone: boolean; kakao: string; phone: string; body: string; kind: LetterKind; marks: LetterMark[] };
const drafts = new Map<string, Draft>();  // 앱이 켜져 있는 동안만 기억(기기에 저장하지 않음)

// 쓰는 대로 하이픈(010-0000-0000). 국가번호(+) 등 다른 모양은 그대로 둔다
function typePhone(v: string): string {
  if (/[^0-9-]/.test(v)) return v;
  const d = v.replace(/-/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export function LetterCompose({ receiver, mode, letterId, invitedReply, onBack, onSent }: {
  receiver: { id: string; nickname: string; photo?: string | null };
  mode: 'new' | 'reply';
  letterId?: string;        // reply: 답장할 받은 편지
  invitedReply?: boolean;   // reply: 특별편지에 대한 답장이면 0리프
  onBack: () => void;
  onSent: () => void;
}) {
  const insets = useSafeAreaInsets();
  const myProfile = usePreview(previewSelectors.myProfile);
  const balance = usePreview(previewSelectors.leafBalance);
  const sendMut = useSendLetterMutation();
  const replyMut = useReplyLetterMutation();
  const isReply = mode === 'reply';
  const pending = sendMut.isPending || replyMut.isPending;
  const myUid = getCurrentUserId();

  // 쓰던 편지 — 리프 충전에 다녀와도(화면이 다시 열려도) 그대로 이어 쓴다(1014). 보내면 지운다.
  const draftKey = `${mode}:${receiver.id}:${letterId ?? ''}`;
  const draft = drafts.get(draftKey);
  // 연락처 처음 값 — 초안 → 지난번에 보낸 값(기기 저장) → 내 프로필 값. 카톡 ID가 있으면 카톡, 없으면 전화번호를 켠다
  const [useKakao, setUseKakao] = useState(draft?.useKakao ?? !!myProfile.kakaoId);
  const [usePhone, setUsePhone] = useState(draft?.usePhone ?? !myProfile.kakaoId);
  const [kakao, setKakao] = useState(draft?.kakao ?? myProfile.kakaoId ?? '');
  const [phone, setPhone] = useState(draft?.phone ?? typePhone(myProfile.phone ?? ''));
  const [body, setBody] = useState(draft?.body ?? '');
  const [kind, setKind] = useState<LetterKind>(draft?.kind ?? 'letter');
  const [marks, setMarks] = useState<LetterMark[]>(draft?.marks ?? []);
  const touched = useRef(!!draft);
  useEffect(() => {
    if (touched.current) return;
    let alive = true;
    loadMyContact(myUid).then((c) => {
      if (!alive || !c || touched.current) return;
      setUseKakao(c.useKakao); setUsePhone(c.usePhone); setKakao(c.kakao); setPhone(c.phone);
    });
    return () => { alive = false; };
  }, [myUid]);
  useEffect(() => {
    drafts.set(draftKey, { useKakao, usePhone, kakao, phone, body, kind, marks });
  }, [draftKey, useKakao, usePhone, kakao, phone, body, kind, marks]);

  const [priceOpen, setPriceOpen] = useState(false);
  // 마음이 간 곳 — 새 편지 · 서버 기능이 있고 · 받는 사람 프로필에 고를 사진 · 이야기가 있을 때만
  const qc = useQueryClient();
  const marksOn = useLetterMarksSupported() && !isReply;
  const receiverQ = useFriendProfile(marksOn ? receiver.id : null);
  const markSource = marksOn ? markSourceOf(receiverQ.data as any) : null;
  const [markOpen, setMarkOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  function openMarks() {
    // 처음 한 번은 사용법부터(이 기기 기준)
    markGuideSeen().then((seen) => { if (seen) setMarkOpen(true); else setGuideOpen(true); });
  }
  const [bodyFocus, setBodyFocus] = useState(false);
  const [phoneBad, setPhoneBad] = useState(false);
  const [inputH, setInputH] = useState(0);
  const dockBottom = useDockBottom();
  const kbUp = useKeyboardHeight() > 0;

  // 특별편지 답장은 무료(서버 reply_letter와 같은 기준)
  const pricing = useLeafPricing();
  const P = pricing.prices;
  const replyCost = invitedReply ? 0 : P.reply;
  const count = Array.from(body.replace(/\s/g, '')).length;   // 공백 빼고
  const ready = count >= MIN;

  // 서버 letter_validate와 같은 기준(서버가 최종 강제). 켜 두고 비운 줄은 안 보내는 것으로 본다
  const sendKakao = useKakao && !!kakao.trim();
  const sendPhone = usePhone && !!phone.trim();
  function validate(): boolean {
    if (!ready) return false;
    if (!sendKakao && !sendPhone) { previewActions.showToast('연락처를 하나 이상 적어주세요.'); return false; }
    if (sendPhone && !PHONE_RE.test(phone.trim())) { setPhoneBad(true); previewActions.showToast('전화번호를 확인해주세요.'); return false; }
    return true;
  }

  function submit() {
    if (pending || !validate()) return;
    if (!previewActions.requireCompleteProfile()) return;
    const contact = { body: body.trim(), kakao: sendKakao ? kakao.trim() : null, phone: sendPhone ? phone.trim() : null };
    const cost = isReply ? replyCost : P[kind];
    // 보내기 전에 잔액을 보고 모자라면 충전 안내(쓴 편지는 초안으로 남는다)
    const onShort = () => { setPriceOpen(false); previewActions.openPaywall(cost, `${isReply ? '답장' : kind === 'invite' ? '특별편지' : '일반편지'}에는 ${cost}리프가 필요해요.`); };
    if (balance < cost) { onShort(); return; }
    const done = (text: string) => {
      drafts.delete(draftKey);
      saveMyContact(myUid, { kakao, phone, useKakao, usePhone });
      setPriceOpen(false);
      showActionFeedback({ kind: 'letter', text });
      onSent();
    };
    if (isReply) {
      if (!letterId) return;
      replyMut.mutate({ id: letterId, ...contact }, {
        onSuccess: () => done('답장을 보냈어요'),
        onError: (e) => showLetterError(e, '답장을 보내지 못했어요. 잠시 후 다시 시도해주세요.', onShort),
      });
      return;
    }
    const sentMarks = markSource ? marks : [];
    sendMut.mutate({ receiverId: receiver.id, kind, ...contact }, {
      onSuccess: (letterId) => {
        // 편지는 이미 갔다 — 붙이기는 뒤에서(실패해도 편지는 그대로, 안내만)
        if (sentMarks.length && letterId) {
          setLetterMarks(letterId, sentMarks)
            .then(() => qc.invalidateQueries({ queryKey: ['letter-marks', letterId] }))
            .catch(() => previewActions.showToast('마음이 간 곳은 붙이지 못했어요. 편지는 잘 보냈어요.', 2600));
        }
        done(kind === 'invite' ? '특별편지를 보냈어요' : '편지를 보냈어요');
      },
      onError: (e) => { setPriceOpen(false); showLetterError(e, '편지를 보내지 못했어요. 잠시 후 다시 시도해주세요.', onShort); },
    });
  }

  const mark = () => { touched.current = true; };
  // 답장 — 받은 편지의 날짜 · 남은 날(편지함 목록 캐시에서 읽는다)
  const lettersQ = useMyLetters();
  const orig = isReply ? lettersQ.data?.find((l) => l.id === letterId) : undefined;
  const origDays = orig ? letterDaysLeft(orig.expires_at, Date.now()) : 0;
  return (
    <KeyboardAware iosOffset={insets.top} style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar onBack={onBack} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: 56 }}>
        <LetterPersonRow
          photo={receiver.photo}
          title={`${receiver.nickname}님에게 보내는 ${isReply ? '답장' : '편지'}`}
          sub={!isReply ? '읽지 않으면 3일 뒤 쓴 리프가 돌아와요'
            : orig ? `${letterDate(orig.created_at)} 받은 편지 · ${origDays > 0 ? `${origDays}일 뒤 사라져요` : '곧 사라져요'}` : '답장을 보내면 서로의 연락처가 공개돼요'}
          subTone={orig && origDays <= 3 ? 'love' : undefined}
          style={{ marginTop: 8, marginHorizontal: -12, marginBottom: 16 }}
        />
        {!!markSource && <MarkPickRow name={receiver.nickname} count={marks.length} onOpen={openMarks} onHelp={() => setGuideOpen(true)} />}
        <LetterPaper
          to={`${receiver.nickname}님에게`}
          date={letterDate(null)}
          sign={`${myProfile.nickname || '나'} 드림`}
          focused={bodyFocus}
          top={markSource && marks.length ? <MarkQuotes marks={marks} who={`${receiver.nickname}님`} onDetach={(i) => { mark(); setMarks((cur) => cur.filter((_, k) => k !== i)); }} /> : undefined}
          footerLeft={
            <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, lineHeight: 19.2, color: colors.mute }}>
              {ready ? `${Array.from(body).length} / ${MAX}` : <><Text style={{ fontWeight: '600', color: colors.accent }}>{MIN - count}자 더</Text> 쓰면 보낼 수 있어요</>}
            </Text>
          }
        >
          <Ruled lh={32} minLines={5} input style={{ marginTop: 16, marginBottom: 24 }}>
            <TextInput
              value={body}
              onChangeText={(v) => { mark(); setBody(v); }}
              onFocus={() => setBodyFocus(true)}
              onBlur={() => setBodyFocus(false)}
              onContentSizeChange={(e) => setInputH(e.nativeEvent.contentSize.height)}
              multiline
              scrollEnabled={false}
              maxLength={MAX}
              placeholder={isReply ? '편지를 읽고 든 마음을 들려주세요' : '전하고 싶은 이야기를 적어 보세요'}
              placeholderTextColor={colors.chevron}
              selectionColor={colors.focus}
              accessibilityLabel={isReply ? '답장 쓰기' : '편지 쓰기'}
              // 줄 노트 위 글 — 휴대폰 글자 크기를 줄여도 밑줄과 어긋나지 않게
              allowFontScaling={false}
              textAlignVertical="top"
              style={[
                keepAll,
                paper.body,
                { minHeight: 160, padding: 0, includeFontPadding: false },
                // 웹은 여러 줄 입력이 저절로 늘지 않는다 — 내용 높이(줄 단위)에 맞춘다
                Platform.OS === 'web' ? ({ height: Math.max(160, Math.ceil(inputH / 32) * 32), outlineStyle: 'none' } as object) : null,
              ]}
            />
          </Ruled>
        </LetterPaper>

        {/* 연락처 정지 경고(우리 규칙, spec-dating §5-b-22) — 종이 아래 18, '내 연락처' 제목 위 */}
        <Text style={{ marginTop: 18, fontSize: 12, lineHeight: 18, color: colors.mute }}>편지 글에는 연락처를 적지 말아 주세요. 계정이 정지될 수 있어요.</Text>
        {/* 내 연락처 — 켠 줄만 답장을 나눈 뒤 상대에게 공개된다 */}
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text accessibilityRole="header" style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.text }}>내 연락처</Text>
          <Text accessibilityLabel="필수" style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.errorLine }}>*</Text>
        </View>
        {/* 카드 선은 안쪽에 덧씌운다(시안 inset 1px) — 줄 높이가 선 때문에 밀리지 않게 */}
        <View style={{ marginTop: 8, borderRadius: radius.card, backgroundColor: colors.surface, paddingLeft: 16, paddingRight: 8, paddingVertical: 4 }}>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line }} />
          <ContactInputRow
            kind="kakao" on={useKakao} value={kakao}
            onToggle={() => { mark(); setUseKakao((v) => !v); }}
            onChange={(v) => { mark(); setUseKakao(true); setKakao(v); }}
          />
          <View style={{ height: 0 }}><View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -1, height: 1, backgroundColor: colors.line }} /></View>
          <ContactInputRow
            kind="phone" on={usePhone} value={phone} bad={phoneBad}
            onToggle={() => { mark(); setPhoneBad(false); setUsePhone((v) => !v); }}
            onChange={(v) => { mark(); setPhoneBad(false); setUsePhone(true); setPhone(typePhone(v)); }}
          />
        </View>
      </ScrollView>

      <DockArea fade top={0} style={kbUp ? undefined : { paddingBottom: Math.max(20, dockBottom - 10) }}>
        {isReply ? (
          <Button size="dock" disabled={!ready} loading={pending} onPress={submit} accessibilityLabel={replyCost ? `답장 보내기, ${replyCost}리프` : '답장 보내기, 무료'}>
            <Text style={{ fontSize: 14, lineHeight: 21, fontWeight: '500', color: ready ? colors.btnPrimaryFg : colors.btnDisabledFg }}>답장 보내기</Text>
            <CostChip cost={replyCost} free={replyCost === 0} color={ready ? colors.inverse : colors.btnDisabledFg} off={!ready} />
          </Button>
        ) : (
          <Button size="dock" disabled={!ready} onPress={() => { if (validate()) setPriceOpen(true); }} accessibilityLabel="편지 보내기">
            <Text style={{ fontSize: 14, lineHeight: 21, fontWeight: '500', color: ready ? colors.btnPrimaryFg : colors.btnDisabledFg }}>편지 보내기</Text>
          </Button>
        )}
      </DockArea>

      {/* 마음이 간 곳 — 사용법(처음 한 번 · ? 버튼) · 고르기 시트. '골라 보기'는 대화상자가 닫힌 뒤에 시트를 연다(iOS는 창 두 개를 한 번에 바꾸지 못한다) */}
      {!!markSource && (
        <>
          <MarkGuide open={guideOpen} name={receiver.nickname} onClose={() => setGuideOpen(false)} onGo={() => { setGuideOpen(false); setTimeout(() => setMarkOpen(true), 260); }} />
          <MarkSheet open={markOpen} source={markSource} initial={marks} onClose={() => setMarkOpen(false)} onApply={(m) => { mark(); setMarks(m); setMarkOpen(false); }} />
        </>
      )}

      {/* 편지 가격 시트 — 기본 = 편지. 고른 종류는 초안에 남는다 */}
      <BottomSheet open={priceOpen} onClose={() => setPriceOpen(false)} dismissable={!pending}>
        <Text accessibilityRole="header" style={{ marginTop: 4, fontSize: 19, lineHeight: 26.6, fontWeight: '700', color: colors.text }}>어떤 편지로 보낼까요?</Text>
        <Text style={{ marginTop: 4, marginBottom: 16, fontSize: 14, lineHeight: 21.7, color: colors.textSecondary }}>읽지 않으면 3일 뒤 쓴 리프가 돌아와요.</Text>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          <KindRow title="일반편지" desc="내 편지를 전해요" cost={P.letter} event={pricing.event} selected={kind === 'letter'} onPress={() => setKind('letter')} />
          <KindRow title="특별편지" benefits={['상대 무료답장 가능']} cost={P.invite} event={pricing.event} selected={kind === 'invite'} onPress={() => setKind('invite')} />
        </View>
        <PriceFoot balance={balance} cost={P[kind]} />
        <SheetButtons
          onCancel={() => setPriceOpen(false)}
          confirmLabel={!HIDE_IOS_CURRENCY && balance < P[kind] ? '리프 충전하기' : '보내기'}
          // 모자라면 부족 안내를 한 번 더 띄우지 않고 바로 충전 화면으로(편지 쓰기 위에 열려 충전 뒤 돌아온다 · 쓴 글과 종류는 초안에 남는다)
          onConfirm={!HIDE_IOS_CURRENCY && balance < P[kind] ? () => { setPriceOpen(false); previewActions.requestCharge(); } : submit}
          loading={pending}
        />
      </BottomSheet>
    </KeyboardAware>
  );
}

// 보유 줄 — 오른쪽 정렬 12/18 "보유 N리프 · 보내면 M리프 남아요". 모자라면 장미 600 "N리프 더 필요해요"
function PriceFoot({ balance, cost }: { balance: number; cost: number }) {
  if (HIDE_IOS_CURRENCY) return <View style={{ height: 20 }} />;
  const short = balance < cost;
  return (
    <Text style={[{ marginTop: 12, marginBottom: 20, fontSize: 12, lineHeight: 18, textAlign: 'right', fontVariant: ['tabular-nums'] }, short ? { fontWeight: '600', color: colors.loveStrong } : { color: colors.mute }]}>
      {short ? `${cost - balance}리프 더 필요해요` : `보유 ${balance.toLocaleString()}리프 · 보내면 ${(balance - cost).toLocaleString()}리프 남아요`}
    </Text>
  );
}

// 편지 종류 한 줄 — 최소 64 · 모서리 16 · 안쪽 12 16 · 선 1px #CFD5DA(고르면 1.5px #273037).
// 라디오 22 → 12 → 이름 15/22 600 + 설명 12/18(또는 체크 14 + 혜택 줄) → 오른쪽 잎 16 + 값 15/600 강조 파랑
// 이벤트 중이면 값 아래 '연말까지 오픈 특별가' 표(리프 정책 v2)
function KindRow({ title, desc, benefits, cost, free, event, selected, onPress }: {
  title: string; desc?: string; benefits?: string[]; cost: number; free?: boolean; event?: boolean; selected: boolean; onPress: () => void;
}) {
  const press = usePress(0.98);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={HIDE_IOS_CURRENCY ? title : free ? `${title}, 무료` : `${title}, ${cost}리프${event ? `, ${LEAF_EVENT_LABEL}` : ''}`}
    >
      <View style={{ minHeight: 64, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.card, flexDirection: 'row', alignItems: benefits ? 'flex-start' : 'center', gap: 12 }}>
        {/* 테두리는 덧씌운다 — 굵기가 바뀌어도 안쪽이 밀리지 않게 */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.card, borderWidth: selected ? 1.5 : 1, borderColor: selected ? colors.inverseStrong : colors.lineControl }} />
        <View style={[{ width: 22, height: 22, borderRadius: 11, marginTop: benefits ? 2 : 0, backgroundColor: colors.surface }, selected ? { borderWidth: 7, borderColor: colors.inverseStrong } : { borderWidth: 1.5, borderColor: colors.lineHover }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.text }}>{title}</Text>
          {!!desc && <Text style={{ fontSize: 12, lineHeight: 18, color: colors.sub }}>{desc}</Text>}
          {!!benefits && (
            <View style={{ marginTop: 4, gap: 2 }}>
              {benefits.map((b) => (
                <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="check" size={14} color={colors.btnPrimaryBg} />
                  <Text style={{ fontSize: 12, lineHeight: 18, color: colors.sub }}>{b}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {!HIDE_IOS_CURRENCY && (
          <View style={{ marginTop: benefits ? -1 : 0, alignItems: 'flex-end', gap: 4 }}>
            <View style={{ height: 22, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <LeafIcon size={16} />
              <PriceText cost={cost} free={free} style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.accent, letterSpacing: 0 }} />
            </View>
            {event && !free && <EventBadge style={{ alignSelf: 'flex-end' }} />}
          </View>
        )}
      </View>
    </Pressable>
  );
}

// 연락처 한 줄(시안 letter-contact C안, 11-21) — 위: 아이콘 32 · 이름표 15/600 · 체크(줄 전체가 체크).
// 켠 줄에만 아래 회색 칸(48 · 모서리 12 · #F1F4F6, 쓰는 중 1.5 포커스 선)이 열려 적는다 — "켰는데 비어 있음"이 빈 칸으로 보인다.
// 체크로 막 연 줄은 바로 적게 포커스, 화면에 처음 들어올 때 켜져 있던 줄은 포커스하지 않는다.
function ContactInputRow({ kind, on, value, bad, onToggle, onChange }: {
  kind: 'kakao' | 'phone'; on: boolean; value: string; bad?: boolean; onToggle: () => void; onChange: (v: string) => void;
}) {
  const [focus, setFocus] = useState(false);
  const [opened, setOpened] = useState(false);
  const label = kind === 'kakao' ? '카카오톡 ID' : '전화번호';
  return (
    <View>
      <Pressable
        onPress={() => { setOpened(!on); onToggle(); }}
        accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${label} 공개`}
        style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <ContactTile kind={kind} size={32} off={!on} />
        <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600', color: on ? colors.text : colors.mute }}>{label}</Text>
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View style={[{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, on ? { backgroundColor: colors.btnPrimaryBg } : { borderWidth: 1.5, borderColor: colors.lineHover }]}>
            {on && <Icon name="check" size={16} color={colors.inverse} />}
          </View>
        </View>
      </Pressable>
      {on && (
        <View style={{ marginRight: 8, marginBottom: 14, height: 48, borderRadius: radius.field, backgroundColor: colors.bgSoft, paddingHorizontal: 14, justifyContent: 'center' }}>
          <TextInput
            value={value}
            onChangeText={onChange}
            autoFocus={opened}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            placeholder={kind === 'phone' ? '010-0000-0000' : '카카오톡 ID를 적어 주세요'}
            placeholderTextColor={colors.mute}
            selectionColor={colors.focus}
            accessibilityLabel={label}
            keyboardType={kind === 'phone' ? 'phone-pad' : 'default'}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={kind === 'phone' ? 20 : 40}
            style={[
              { height: 46, padding: 0, fontSize: 15, lineHeight: 22, fontWeight: value ? '600' : '400', color: bad ? colors.danger : colors.text, includeFontPadding: false },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            ]}
          />
          {(focus || bad) && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.field, borderWidth: 1.5, borderColor: bad ? colors.errorLine : colors.focus }} />}
        </View>
      )}
    </View>
  );
}
