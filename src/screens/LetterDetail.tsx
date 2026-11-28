// 야화 — 편지 세부 (리뉴얼 1120 · spec-dating §3.7 · §6)
// 채팅이 아니라 "편지 한 통 + 답장 한 통 → 서로의 연락처 공개".
// · A 받은 편지(연결 전): 보낸 사람 줄(프로필 링크) + 편지지 + 안내 한 줄 + 아래 고정 [답장 쓰기 · 값 칩] [거절하기]
//     일반편지는 답장 전에 리프 확인 시트, 특별편지(=서버 kind 'invite')는 무료라 바로 답장 쓰기로. 가격은 useLeafPricing(리프 정책 v2).
// · B 보낸 편지(연결 전): 보낸 사람 줄(읽음 여부) + 편지지 + [특별편지로 바꾸기](확인 시트) + 안내 두 줄
// · C 연결됨: 서로의 연락처(복사) + 주고받은 편지 두 통(먼저 쓴 편지가 위, 내 편지는 오른쪽 하늘색)
// 받은 편지를 처음 열면 읽음 처리(1회, readLetter). 상단 안전 영역은 부모(SafeAreaView edges top)가 처리한다.
// 편지에 '마음이 간 곳'(0190)이 붙어 있으면 편지지 맨 위(연결 뒤에는 그 편지 말풍선 안)에 보인다.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radius } from '../tokens';
import { previewActions, previewSelectors, usePreview } from '../lib/previewStore';
import { copyText } from '../lib/clipboard';
import { HIDE_IOS_CURRENCY } from '../lib/flags';
import { type LetterRow } from '../lib/api';
import { useLeafPricing } from '../lib/leafPricing';
import {
  letterState, useMyLetters, useReadLetterMutation, useDeclineLetterMutation, useUpgradeLetterMutation, showLetterError,
  useLetterMarks, useLetterMarksSupported,
} from '../lib/letters';
import { MarkQuotes } from '../components/letters/marks';
import {
  ContactTile, CostChip, LeafConfirmSheet, LetterAvatar, LetterDeclineSheet, LetterPaper, LetterPersonRow, LockNote, Ruled,
  fmtPhone, letterDate, letterDaysLeft, letterTime,
} from '../components/letters/ui';
import { useNow } from '../lib/useNow';
import { keepAll } from '../components/affinity/ui';
import { BackButton, BreathingDots, Button, DockArea, Icon, LeafIcon, TopBar, useDockBottom, usePress } from '../ui';

type Contacts = { kakao: string | null; phone: string | null };

export function LetterDetail({ letterId, onBack, onOpenProfile, onReply }: {
  letterId: string;
  onBack: () => void;
  onOpenProfile?: (userId: string) => void;
  onReply: (letter: LetterRow) => void;   // 답장 쓰기 → 부모가 LetterCompose(mode='reply')를 연다
}) {
  const q = useMyLetters();
  const letter = q.data?.find((l) => l.id === letterId) ?? null;
  const me = usePreview(previewSelectors.myProfile);
  const pricing = useLeafPricing();
  const P = pricing.prices;
  const readMut = useReadLetterMutation();
  const declineMut = useDeclineLetterMutation();
  const upgradeMut = useUpgradeLetterMutation();
  const [sheet, setSheet] = useState<'' | 'reply' | 'upgrade' | 'decline'>('');
  const now = useNow(60_000);
  const dockBottom = useDockBottom();
  const readOnce = useRef(false);
  const refetchedOnce = useRef(false);
  // 마음이 간 곳 — 서버에 기능이 있을 때만 읽는다
  const marks = useLetterMarks(letterId, useLetterMarksSupported()).data ?? [];

  // 푸시 등으로 바로 들어왔는데 캐시에 없으면 한 번 새로 받아온 뒤 판단한다
  useEffect(() => {
    if (q.isSuccess && !letter && !refetchedOnce.current) {
      refetchedOnce.current = true;
      q.refetch();
    }
  }, [q.isSuccess, letter, q]);

  // 받은 편지를 처음 열면 읽음 — 보관 기간이 '읽은 날부터 7일'로 바뀐다
  useEffect(() => {
    if (!letter || readOnce.current) return;
    if (letter.direction === 'in' && !letter.read_at) {
      readOnce.current = true;
      readMut.mutate(letter.id);
    }
  }, [letter, readMut]);

  async function copy(value: string) {
    const ok = await copyText(value);
    previewActions.showToast(ok ? '복사했어요.' : '복사하지 못했어요. 연락처를 길게 눌러 복사해주세요.');
  }

  function upgrade(l: LetterRow) {
    if (upgradeMut.isPending) return;
    upgradeMut.mutate(l.id, {
      onSuccess: () => { setSheet(''); previewActions.showToast('특별편지로 바꿨어요. 상대는 무료로 답장할 수 있어요.'); },
      onError: (e) => {
        setSheet('');
        showLetterError(e, '특별편지로 바꾸지 못했어요. 잠시 후 다시 시도해주세요.', () => previewActions.openPaywall(P.upgrade, `특별편지로 바꾸려면 ${P.upgrade}리프가 필요해요.`));
      },
    });
  }

  function decline(l: LetterRow) {
    if (declineMut.isPending) return;
    declineMut.mutate(l.id, {
      onSuccess: () => { setSheet(''); previewActions.showToast('편지를 정중히 거절했어요'); onBack(); },
      onError: (e) => { setSheet(''); showLetterError(e, '거절하지 못했어요. 잠시 후 다시 시도해주세요.'); },
    });
  }

  if (!letter) {
    const loading = q.isLoading || q.isFetching;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar onBack={onBack} />
        <View style={{ paddingTop: 56, alignItems: 'center', paddingHorizontal: layout.gutter }}>
          {loading
            ? <BreathingDots />
            : <Text style={{ fontSize: 14, lineHeight: 22.4, color: colors.mute, textAlign: 'center' }}>
                {q.isError ? '편지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.' : '보관 기간이 지난 편지예요.'}
              </Text>}
        </View>
      </View>
    );
  }

  const st = letterState(letter);
  const connected = st === 'connected';
  const out = letter.direction === 'out';
  const special = letter.kind === 'invite';   // 화면 이름은 '특별편지'(서버 값은 그대로 invite)
  const name = letter.other_nickname ?? '상대';
  const myName = me?.nickname || '나';
  const openProfile = onOpenProfile ? () => onOpenProfile(letter.other_id) : undefined;

  // ── C. 연결된 편지 ──
  if (connected) {
    const mine: Contacts = { kakao: letter.my_kakao, phone: letter.my_phone };
    const theirs: Contacts = { kakao: letter.their_kakao, phone: letter.their_phone };
    // 먼저 쓴 편지가 위(보낸 편지는 내 것, 받은 편지는 상대 것이 먼저)
    const exchanged = [
      { me: out, body: letter.body, at: letter.created_at, first: true },
      { me: !out, body: letter.reply_body, at: letter.replied_at, first: false },
    ].filter((x) => !!x.body);
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ marginTop: layout.topPad, height: layout.headerH, paddingHorizontal: layout.gutter, flexDirection: 'row', alignItems: 'center' }}>
          <BackButton onPress={onBack} />
          <Pressable
            onPress={openProfile}
            disabled={!openProfile}
            accessibilityRole="button"
            accessibilityLabel={`${name}님과 나눈 편지, 프로필 보기`}
            style={({ pressed }) => ({ flex: 1, minWidth: 0, height: 44, marginLeft: 4, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.6 : 1 })}
          >
            <LetterAvatar photo={letter.other_photo} size={32} />
            <Text numberOfLines={1} accessibilityRole="header" style={{ flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text }}>{name}님과 나눈 편지</Text>
          </Pressable>
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingHorizontal: layout.gutter, paddingBottom: 24 + dockBottom, gap: 12 }}>
          <View style={{ paddingTop: 8, paddingHorizontal: 4, paddingBottom: 4, gap: 4, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, lineHeight: 26, fontWeight: '700', color: colors.text, textAlign: 'center' }}>서로의 연락처가 열렸어요</Text>
            <Text style={{ fontSize: 13, lineHeight: 20, color: colors.mute, textAlign: 'center' }}>편지 너머의 이야기를 시작해보세요</Text>
          </View>
          <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingTop: 3, paddingRight: 7, paddingBottom: 7, paddingLeft: 15 }}>
            <ContactBlock who={`${name}님`} contacts={theirs} onCopy={copy} first />
            <ContactBlock who="나" contacts={mine} onCopy={copy} />
          </View>
          <Text style={{ marginTop: 12, fontSize: 12, lineHeight: 12, fontWeight: '500', color: colors.mute, textAlign: 'center' }}>{letterDate(exchanged[0]?.at)}</Text>
          {exchanged.map((x) => (
            <View
              key={x.me ? 'me' : 'them'}
              style={[
                { width: '84%', paddingTop: 17, paddingHorizontal: 17, paddingBottom: 15, gap: 10, borderWidth: 1, borderRadius: 20 },  // 시안은 안쪽 1px 선(18 18 16) — 테두리 1만큼 덜어 낸다
                x.me
                  ? { alignSelf: 'flex-end', backgroundColor: colors.accentSubtle, borderColor: colors.selected, borderBottomRightRadius: 6 }
                  : { alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.line, borderBottomLeftRadius: 6 },
              ]}
            >
              <Text style={{ fontSize: 13, lineHeight: 13, fontWeight: '500', color: colors.mute }}>{x.me ? name : myName}님에게</Text>
              {x.first && marks.length > 0 && <MarkQuotes compact marks={marks} who={x.me ? `${name}님` : '당신'} />}
              <Ruled lh={28} minLines={1}>
                <Text selectable allowFontScaling={false} style={[keepAll, { fontSize: 15, lineHeight: 28, color: colors.text }]}>{x.body}</Text>
              </Ruled>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <Text style={styles.small}>{letterTime(x.at)}</Text>
                <Text style={styles.small}>{x.me ? myName : name} 드림</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── A · B 공통: 보낸 사람 줄 + 편지지 ──
  const days = letterDaysLeft(letter.expires_at, now);
  const freeReply = special;  // 특별편지 답장은 0리프
  const canUpgrade = out && !special && !letter.declined_at;
  const sentContacts = [letter.my_kakao ? `카카오톡 ${letter.my_kakao}` : '', letter.my_phone ? fmtPhone(letter.my_phone) : ''].filter(Boolean).join(' · ');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar onBack={onBack} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: out ? 24 + dockBottom : 56 }}>
        {out ? (
          <LetterPersonRow
            photo={letter.other_photo}
            title={`${name}님에게 보낸 편지`}
            sub={letter.read_at ? '읽음 · 답장을 기다리고 있어요' : `${letterDate(letter.created_at)} · 답장을 기다리고 있어요`}
            onPress={openProfile}
            style={{ marginTop: 8, marginBottom: 12 }}
          />
        ) : (
          <LetterPersonRow
            photo={letter.other_photo}
            title={`${name}님이 보낸 편지`}
            sub={`${letterDate(letter.created_at)} · ${days > 0 ? `${days}일 뒤 사라져요` : '곧 사라져요'}`}
            subTone={days <= 3 ? 'love' : undefined}
            onPress={openProfile}
            style={{ marginTop: 8, marginBottom: 12 }}
          />
        )}
        <LetterPaper
          to={out ? `${name}님에게` : '당신에게'}
          body={letter.body}
          date={letterDate(letter.created_at)}
          sign={out ? `${myName} 드림` : `${name} 드림`}
          top={marks.length ? <MarkQuotes marks={marks} who={out ? `${name}님` : '당신'} from={out ? undefined : name} /> : undefined}
        />

        {out ? (
          <>
            {canUpgrade && <UpgradeCard cost={P.upgrade} onPress={() => setSheet('upgrade')} />}
            <LockNote text="답장이 오면 서로의 연락처가 공개돼요" style={{ marginTop: canUpgrade ? 0 : 16 }} />
            {!letter.read_at && <Text style={[styles.keep, { marginTop: 6 }]}>읽지 않으면 3일 뒤 쓴 리프가 돌아와요</Text>}
            {/* 내가 함께 보낸 연락처(우리 기능) — 답장이 오면 상대에게 공개된다 */}
            {!!sentContacts && <Text selectable style={[styles.keep, { marginTop: 6 }]}>함께 보낸 연락처 · {sentContacts}</Text>}
          </>
        ) : (
          <LockNote text="답장을 나누면 서로의 연락처가 공개돼요" style={{ marginTop: 16 }} />
        )}
      </ScrollView>

      {/* 받은 편지 — 아래 고정 [답장 쓰기 · 값 칩] [거절하기] */}
      {!out && (
        <DockArea fade top={0} style={{ paddingBottom: Math.max(20, dockBottom - 10) }}>
          <Button
            size="dock"
            onPress={() => (freeReply ? onReply(letter) : setSheet('reply'))}
            accessibilityLabel={freeReply ? '답장 쓰기, 무료' : `답장 쓰기, ${P.reply}리프`}
          >
            <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.btnPrimaryFg }}>답장 쓰기</Text>
            <CostChip cost={P.reply} free={freeReply} />
          </Button>
          <GhostButton label="거절하기" onPress={() => setSheet('decline')} style={{ marginTop: 8 }} />
        </DockArea>
      )}

      {/* 일반 편지 답장 — 리프 확인 */}
      <LeafConfirmSheet
        open={sheet === 'reply'}
        onClose={() => setSheet('')}
        title="답장을 쓸까요?"
        desc="답장을 보내면 서로의 연락처가 공개돼요. 쓴 리프는 돌려받지 않아요."
        cost={P.reply}
        was={pricing.normal.reply}
        event={pricing.event}
        afterLabel="답장 후 남는 리프"
        confirmLabel="답장 쓰기"
        onConfirm={() => { setSheet(''); onReply(letter); }}
        shortReason={`답장에는 ${P.reply}리프가 필요해요.`}
      />
      {/* 특별편지로 바꾸기 — 잘못 눌러 리프가 나가지 않게 확인을 거친다 */}
      <LeafConfirmSheet
        open={sheet === 'upgrade'}
        onClose={() => setSheet('')}
        title="특별편지로 바꿀까요?"
        desc="상대가 무료로 답장할 수 있어요."
        cost={P.upgrade}
        was={pricing.normal.upgrade}
        event={pricing.event}
        afterLabel="바꾼 뒤 남는 리프"
        confirmLabel="바꾸기"
        onConfirm={() => upgrade(letter)}
        loading={upgradeMut.isPending}
        shortReason={`특별편지로 바꾸려면 ${P.upgrade}리프가 필요해요.`}
      />
      <LetterDeclineSheet open={sheet === 'decline'} onClose={() => setSheet('')} letter={letter} onConfirm={() => decline(letter)} loading={declineMut.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 12, lineHeight: 12, color: colors.mute },
  keep: { fontSize: 11, lineHeight: 16.5, color: colors.mute, textAlign: 'center' },
});

// 특별편지로 바꾸기(Action Card) — 회색 카드 · 최소 64 · 안쪽 12 12 12 16 · 제목 15/22 600 → 잎 13 + "추가 N리프" 13 → 꺾쇠 20. 위 16 · 아래 12
function UpgradeCard({ cost, onPress }: { cost: number; onPress: () => void }) {
  const press = usePress(0.98);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel="특별편지로 바꾸기" style={{ marginTop: 32, marginBottom: 12 }}>
      <Animated.View style={[{ minHeight: 64, paddingVertical: 12, paddingLeft: 16, paddingRight: 12, borderRadius: radius.card, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }, press.scaleStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.muted, opacity: press.p }]} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.text }}>특별편지로 바꾸기</Text>
          {HIDE_IOS_CURRENCY ? (
            <Text style={{ fontSize: 13, lineHeight: 22.75, color: colors.sub }}>상대가 리프 없이 답장할 수 있어요</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <LeafIcon size={13} color={colors.mute} />
              <Text style={{ fontSize: 13, lineHeight: 22.75, color: colors.sub }}>{`추가 ${cost}리프`}</Text>
            </View>
          )}
        </View>
        <Icon name="chevron-right" size={20} color={colors.subtle} />
      </Animated.View>
    </Pressable>
  );
}

// 거절하기(.lt-ghost) — 54 · 모서리 14 · #E3E7EA · #505C65 15/600. 누르면 97%
function GhostButton({ label, onPress, style }: { label: string; onPress: () => void; style?: object }) {
  const press = usePress(0.97);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" style={style}>
      <Animated.View style={[{ height: layout.dockBtnH, borderRadius: radius.cta, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, press.scaleStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.control, opacity: press.p }]} />
        <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.textSecondary }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// 서로의 연락처 한 묶음 — 이름(13/18 500 회색, 위 14) + 줄(높이 60): 색 타일 40 → 12 → 이름 13/18 · 값 17/24 600 → 복사 44
function ContactBlock({ who, contacts, onCopy, first }: { who: string; contacts: Contacts; onCopy: (v: string) => void; first?: boolean }) {
  const rows = [
    { kind: 'kakao' as const, label: '카카오톡 ID', value: contacts.kakao ?? '' },
    { kind: 'phone' as const, label: '휴대전화 번호', value: contacts.phone ? fmtPhone(contacts.phone) : '' },
  ].filter((r) => !!r.value);
  if (!rows.length) return null;
  return (
    <View>
      {/* 두 번째 묶음 위 구분선 — 위 6 · 오른쪽 8 비움(시안 .lth-who.is-me) */}
      {!first && <View style={{ marginTop: 5, marginRight: 8, height: 1, backgroundColor: colors.line }} />}
      <Text style={{ paddingTop: 14, paddingBottom: 2, fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.mute }}>{who}</Text>
      {rows.map((r) => (
        <View key={r.kind} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ContactTile kind={r.kind} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.mute }}>{r.label}</Text>
            <Text selectable style={{ fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.text }}>{r.value}</Text>
          </View>
          <Pressable onPress={() => onCopy(r.value)} accessibilityRole="button" accessibilityLabel={`${r.label} 복사`} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
            <Icon name="copy" size={20} color={colors.btnPrimaryBg} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
