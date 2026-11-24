// 야화 — 게더링 상세 (project/야화/screens-gather.jsx GatherDetail 픽셀 포트)
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator, Linking, useWindowDimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomBarPad } from '../lib/layout';
import { thumbUrl } from '../lib/img';
import { colors, radius, shadow } from '../tokens';
import { Icons } from '../icons';
import { Btn, NavBar, Avatar } from '../components/atoms';
import { GatherEdit } from './GatherEdit';
import { SlotDot } from '../components/SlotDot';
import { FollowButton, FollowerCount } from '../components/FollowButton';
import { UnivBadge } from '../components/UnivBadge';
import { GatherSlot } from '../data/mock';
import { previewActions, previewSelectors, usePreview, getCurrentUserId, requireAuth } from '../lib/previewStore';
import { useGatheringFull, useJoinGatheringPaidMutation, useDecideGatheringSlotMutation, useHostedCount } from '../lib/hooks';
import { adaptServerGather } from '../lib/api';
import { friendlyError } from '../lib/errors';
import { requestGatheringPayment } from '../lib/tosspay';
import { copyText } from '../lib/clipboard';
import { promptEnablePush } from '../lib/push';

export function GatherDetail({
  id = 'g1',
  onBack,
  onOpenProfile,
}: {
  id?: string;
  onBack?: () => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const gatherQ = useGatheringFull(id);
  // ⚠️ 조기 return보다 위 — 훅 순서 고정(아래 로딩/미발견 분기에서 return한다)
  const [editOpen, setEditOpen] = useState(false);
  const found = gatherQ.data ? adaptServerGather(gatherQ.data) : null;
  const insets = useSafeAreaInsets();
  const myProfile = usePreview(previewSelectors.myProfile);
  const bookmarked = usePreview(previewSelectors.isBookmarked(found?.id ?? ''));
  const liked = usePreview(previewSelectors.isLiked(found?.id ?? ''));
  const joinMut = useJoinGatheringPaidMutation();
  const myUid = getCurrentUserId();
  // 서버 슬롯에서 내 슬롯 + 상태(pending/approved/rejected)
  const mySlot = (gatherQ.data?.gathering_slots ?? []).find((s) => s.user_id === myUid);
  const myStatus = mySlot?.status ?? null;
  const decideMut = useDecideGatheringSlotMutation();
  const preHost = !!(gatherQ.data?.host_id && myUid && gatherQ.data.host_id === myUid);
  // 이 호스트가 만든 모임 수 (실데이터) — 조기 return보다 위(훅 순서 고정)
  const hostedQ = useHostedCount(found?.host.userId ?? gatherQ.data?.host_id);
  // 매칭 현황 아바타 그리드 — 4명/행 기준으로 카드 내부 폭에 맞춰 크기 계산
  const { width: winW } = useWindowDimensions();
  const slotSize = Math.max(52, Math.min(84, Math.floor((Math.min(winW, 560) - 32 - 36 - 3 * 12) / 4)));

  // 로딩 중에는 not-found 문구 대신 스피너 — 데이터 도착 전 "더 이상 볼 수 없어요" 깜빡임 방지
  if (gatherQ.isLoading || gatherQ.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgSoft }}>
        <NavBar
          title="모임"
          left={
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.chevLeft size={22} color={colors.text} />
            </Pressable>
          }
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!found) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgSoft }}>
        <NavBar
          title="모임"
          left={
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.chevLeft size={22} color={colors.text} />
            </Pressable>
          }
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 13.5, color: colors.sub, fontWeight: '600' }}>이 모임은 더 이상 볼 수 없어요</Text>
          <Text style={{ marginTop: 6, fontSize: 11, color: colors.mute }}>마감되었거나 삭제된 모임일 수 있어요</Text>
        </View>
      </View>
    );
  }

  const g = found;
  const raw = gatherQ.data;
  const isHost = !!(g.host.userId && myUid && g.host.userId === myUid);
  const joined = !!mySlot;

  // 0018 모임 확장 — raw 서버 데이터 사용
  const genderMode = raw?.gender_mode ?? null;
  const region = raw?.region ?? null;
  const socialKind = raw?.social_kind ?? null;
  const capacity = raw?.capacity ?? null;
  const slotRows = raw?.gathering_slots ?? [];
  const hostUserId = g.host.userId ?? raw?.host_id ?? '';

  // 성별 상관없음(any) 또는 성비 미설정+정원 지정 → 단일 카운터.
  const singleCount = genderMode === 'any' || (genderMode == null && capacity != null);
  const totalCap = capacity ?? g.slots.M.length + g.slots.F.length;
  const approvedCount = slotRows.filter((s) => s.status === 'approved' || s.role === 'host').length;

  // 서버 슬롯(g.slots = adaptServerGather)에는 이미 승인된 참여자(본인 포함)가 모두 담겨 있으므로 그대로 사용.
  // ⚠️ 과거엔 승인된 본인을 빈자리에 '또' 낙관적으로 채워, 이미 슬롯에 있는 본인이 중복 카운트되어
  //   인원이 +1 부풀려지는 버그가 있었다(웹=참여자 4명/마감, 모바일=호스트 3명 불일치의 원인). 제거.
  const effSlots = g.slots;
  const mEmpty = effSlots.M.filter((s) => !s.filled).length;
  const fEmpty = effSlots.F.filter((s) => !s.filled).length;
  const remaining = singleCount ? Math.max(0, totalCap - approvedCount) : mEmpty + fEmpty;

  // 모임 참여 — 리프/포인트 차감은 폐지, 오직 호스트가 설정한 참가비(원, 0원 가능) 기준.
  // 참가비 0원이면 결제 없이 바로 승인 대기 슬롯 생성, 0원 초과면 토스 결제 필수.
  const hostFee = g.fee ?? 0;
  async function submitJoin() {
    try {
      await joinMut.mutateAsync({
        gatheringId: g.id,
        gender: (myProfile.gender ?? 'M') as 'M' | 'F',
        photo: myProfile.groupPhoto ?? (typeof myProfile.photo === 'string' ? myProfile.photo : null),
        fee: 0,
      });
      Alert.alert('참여 신청 완료', '호스트가 승인하면 알림으로 알려드려요.\n앱 알림을 꼭 켜주세요!');
      void promptEnablePush('호스트가 승인하면 알림으로 알려드려요.');
    } catch (e: any) {
      const f = friendlyError(e, '모임 참여 실패');
      Alert.alert(f.title, f.message);
    }
  }
  async function doJoin() {
    // 참가비가 있으면 토스 결제(requestGatheringPayment).
    // 웹은 결제 성공 시 /pay-success로 전체 리다이렉트되므로 이 아래 코드는 실행되지 않음.
    // 네이티브는 시스템 브라우저로 결제창을 열고 즉시 리턴한다 — 결과는 결제 후 yahwa:// 딥링크로
    // 돌아온 /pay-success 화면이 처리·안내하므로 여기서는 완료 안내를 하지 않는다.
    if (hostFee > 0) {
      try {
        await requestGatheringPayment({
          gatheringId: g.id,
          amount: hostFee,
          gender: (myProfile.gender ?? 'M') as 'M' | 'F',
        });
      } catch (e: any) {
        const f = friendlyError(e, '결제에 실패했어요');
        Alert.alert(f.title, f.message);
      }
      return;
    }
    // 참가비 0원 — 결제 없이 바로 신청
    await submitJoin();
  }

  function handleJoin() {
    if (isHost) return;
    // 상태별 처리 — 이전엔 `joined`(=슬롯 존재)로 막아, 거절된 슬롯이 있으면 버튼은 보이는데
    // 눌러도 조용히 리턴돼 "아무 반응 없음" 버그였다. myStatus로 정확히 구분한다.
    if (myStatus === 'pending') { previewActions.showToast('이미 승인 대기 중이에요', 2000); return; }
    if (myStatus === 'approved') { previewActions.showToast('이미 참여가 확정됐어요', 2000); return; }
    if (!requireAuth('참여 신청은 로그인 후 가능해요')) return;
    // 성별 정원 사전 차단 — 결제까지 간 뒤 서버(0080)에서 거부되면 최악이므로 신청 진입 전에 막는다.
    // 점유 기준은 서버와 동일: 호스트 + 대기(pending) + 승인(approved). (rejected 제외)
    const myG = (myProfile.gender ?? 'M') as 'M' | 'F';
    const takenBy = (pred: (s: any) => boolean) =>
      slotRows.filter((s: any) => pred(s) && (s.role === 'host' || s.status === 'pending' || s.status === 'approved')).length;
    if (singleCount) {
      if (takenBy(() => true) >= totalCap) {
        Alert.alert('자리가 모두 찼어요', '이 모임은 정원이 가득 찼어요. 다른 모임을 찾아보세요.');
        return;
      }
    } else {
      const [mTot, fTot] = g.ratio.split(':').map((n) => parseInt(n, 10));
      const quota = myG === 'M' ? mTot : fTot;
      if (Number.isFinite(quota) && takenBy((s) => s.gender === myG) >= quota) {
        Alert.alert(
          myG === 'M' ? '남성 자리가 모두 찼어요' : '여성 자리가 모두 찼어요',
          '이 모임의 해당 성별 정원이 가득 찼어요. 다른 모임을 찾아보세요.',
        );
        return;
      }
    }
    // rejected(거절)면 joinGatheringPaid가 기존 슬롯 삭제 후 재신청한다.
    void doJoin();
  }

  const steps = [
    { n: '1', t: '참여 신청', d: hostFee > 0
      ? `참가비 ${hostFee.toLocaleString()}원 결제 후 호스트 승인 대기`
      : '무료로 신청 후 호스트 승인 대기' },
    { n: '2', t: '호스트 승인', d: '호스트가 신청을 확인하고 승인해요' },
    { n: '3', t: '매칭 확정', d: '인원이 다 모이면 자동으로 매칭돼요' },
    { n: '4', t: '모임 채팅', d: '승인되면 모임 > 채팅에서 바로 대화할 수 있어요' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSoft }}>
      <NavBar
        title={g.cat}
        left={
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8}
            onPress={onBack}
            style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icons.chevLeft size={22} color={colors.text} />
          </Pressable>
        }
        right={
          <Pressable
            onPress={() => previewActions.toggleBookmark(g.id)}
            style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icons.bookmark size={20} color={bookmarked ? colors.primary : colors.text} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* 호스트 업로드 이미지 — 상단 가로 스와이프 갤러리 (첫 장 = 대표) */}
        {(g.photos ?? []).length > 0 && (
          <View style={{ backgroundColor: '#000' }}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {(g.photos ?? []).map((uri, i) => (
                <View key={i} style={{ width: winW, aspectRatio: 16 / 10, backgroundColor: '#1a1a1f' }}>
                  <Image source={{ uri: thumbUrl(uri, 900) ?? uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" transition={120} />
                </View>
              ))}
            </ScrollView>
            {(g.photos ?? []).length > 1 && (
              <View style={{ position: 'absolute', bottom: 10, right: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.55)' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{(g.photos ?? []).length}장</Text>
              </View>
            )}
          </View>
        )}

        {/* Title section */}
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 20,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.lineSoft,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
            <Badge bg={colors.primarySoft} fg={colors.primary}>
              {g.cat}
            </Badge>
            <Badge bg={colors.bgSoft} fg={colors.text}>
              {/* 성비 무관 모임에 '2:2 매칭'이 뜨던 문제(0903) — 아래 '참여 멤버'와 같은 기준 */}
              {singleCount ? (totalCap === 2 ? '1:1 만남' : `${totalCap}명 모집`) : `${g.ratio} 매칭`}
            </Badge>
            {g.hot && (
              <Badge bg={colors.primary} fg="#fff">
                HOT
              </Badge>
            )}
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, lineHeight: 27, letterSpacing: -0.3 }}>
            {g.title}
          </Text>
          {socialKind === 'yahwa' && (
            <View
              style={{
                marginTop: 10,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: radius.md,
                backgroundColor: colors.primarySoft,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icons.leaf size={15} color={colors.primary} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primaryDark }}>
                야화에서 모이자 · 칵테일 1잔 모두에게 무료 제공
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icons.calendar size={14} color={colors.text} />
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.text }}>
                {g.when}{g.whenTime ? ` · ${g.whenTime}` : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icons.pin size={14} color={colors.sub} />
              <Text style={{ fontSize: 11.5, color: colors.sub }}>{region ?? g.place}</Text>
            </View>
          </View>
        </View>

        {/* 호스트 승인 패널 — 참여 신청 승인/거절. 호스트가 놓치지 않도록 참여 멤버 카드보다 위에 배치.
            조건은 preHost(RPC host_id 원천값)‖isHost(adapt 결과) 이중화 — 한쪽 계산이 어긋나도 패널은 뜬다. */}
        {(preHost || isHost) && (raw?.gathering_slots ?? []).some((s) => s.status === 'pending') && (
          <Card>
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.text, marginBottom: 12 }}>
              참여 신청 {(raw?.gathering_slots ?? []).filter((s) => s.status === 'pending').length}
            </Text>
            <View style={{ gap: 10 }}>
              {(raw?.gathering_slots ?? []).filter((s) => s.status === 'pending').map((s) => (
                <View key={s.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {/* 신청자 신원 — 탭하면 프로필 열기(누구인지 확인 후 승인) */}
                  <Pressable
                    onPress={() => onOpenProfile?.(s.user_id)}
                    disabled={!onOpenProfile}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, opacity: pressed ? 0.6 : 1 })}
                  >
                    <Avatar size={36} locked={false} photo={s.photo ?? undefined} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: colors.text }}>
                        {s.applicant?.nickname?.trim() || '참가자'}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.mute, marginTop: 1 }}>
                        {[s.gender === 'M' ? '남' : s.gender === 'F' ? '여' : null, s.applicant?.age ? `${s.applicant.age}세` : null]
                          .filter(Boolean).join(' · ') || '프로필 보기'}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={{ minWidth: 56 }}>
                      <Btn kind="primary" size="sm" full disabled={decideMut.isPending}
                        onPress={() => decideMut.mutate({ gatheringId: g.id, userId: s.user_id, approve: true })}>승인</Btn>
                    </View>
                    <View style={{ minWidth: 56 }}>
                      <Btn kind="line" size="sm" full disabled={decideMut.isPending}
                        onPress={() => decideMut.mutate({ gatheringId: g.id, userId: s.user_id, approve: false })}>거절</Btn>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Slot status card — 참가자 얼굴이 주인공. 호스트 포함 전원 아바타를 4명/행 그리드로 크게 */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.text }}>참여 멤버</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: remaining > 0 ? colors.primary : colors.success }}>
              {remaining > 0 ? `${remaining}자리 남음` : '마감'}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.sub, marginTop: 3, marginBottom: 14 }}>
            {singleCount
              ? `${totalCap === 2 ? '1:1 만남' : `모집 ${totalCap}명`} · 현재 ${Math.min(approvedCount, totalCap)}명 참여`
              : `${g.ratio} 매칭 · 현재 ${[...effSlots.M, ...effSlots.F].filter((s) => s.filled).length}명 참여`}
          </Text>
          {singleCount ? (
            <SlotGrid slots={effSlots.M} size={slotSize} />
          ) : (
            <View style={{ gap: 16 }}>
              <SlotGridLabeled slots={effSlots.M} label="남자" size={slotSize} />
              <SlotGridLabeled slots={effSlots.F} label="여자" size={slotSize} />
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
            <Icons.shield size={13} color={colors.mute} />
            <Text style={{ flex: 1, fontSize: 11, lineHeight: 15, color: colors.sub }}>
              {remaining > 0
                ? `${remaining}명만 더 모이면 자동 매칭 · 시간·장소 공개`
                : '매칭 완료! 곧 시간·장소가 공개돼요'}
            </Text>
          </View>
        </Card>

        {/* 매칭 완료 연락처·단톡 안내 카드 제거 (대표 지시 0830) — 모임 채팅이 생겨
            연락처를 노출하거나 단톡 초대를 안내할 이유가 없어졌다.
            서버 RPC(get_gathering_contacts, 0114)와 어드민 노출은 그대로 둔다. */}

        {/* 일정·장소 — 일시/지역/네이버 플레이스를 한 카드로 통합 */}
        <Card>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.sub, marginBottom: 12 }}>일정·장소</Text>
          <View style={{ gap: 14 }}>
            <InfoRow
              icon="calendar"
              title={`${g.when}${g.whenTime ? ` · ${g.whenTime}` : ''}`}
              subtitle="일정 변경 시 공지해드려요"
            />
            <InfoRow icon="pin" title={region ?? g.place} subtitle={g.placeDetail} />
            {!!raw?.place_name && (
              <Pressable
                onPress={() => { const u = raw?.place_url; if (u && /^https?:\/\//i.test(u)) Linking.openURL(u).catch(() => { /* ignore */ }); }}
                disabled={!raw?.place_url}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.md,
                    backgroundColor: colors.bgSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icons.map size={18} color={colors.sub} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.text }}>{raw.place_name}</Text>
                  <Text style={{ fontSize: 11, color: colors.mute, marginTop: 2 }}>
                    {raw.place_address ?? '네이버 플레이스에서 보기'}
                  </Text>
                </View>
                {!!raw?.place_url && <Icons.chev size={18} color={colors.mute} />}
              </Pressable>
            )}
          </View>
        </Card>

        {/* Fee card — 호스트가 설정한 참가비(원) 기준. 0원이면 무료 */}
        <Card>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.sub, marginBottom: 10 }}>참여 비용</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
              {hostFee > 0 ? `${hostFee.toLocaleString()}원` : '무료'}
            </Text>
          </View>
          <Text style={{ fontSize: 11.5, color: colors.sub, lineHeight: 18, marginTop: 6 }}>
            {hostFee > 0
              ? `${g.feeDesc ? `${g.feeDesc} · ` : ''}참가비 ${hostFee.toLocaleString()}원을 카드로 결제해요. 호스트 승인 후 확정됩니다.`
              : '무료로 참여 신청할 수 있어요. 호스트 승인 후 확정됩니다.'}
          </Text>
        </Card>

        {/* Host card — 탭 시 프로필 열기 */}
        <Card>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.sub, marginBottom: 12 }}>호스트</Text>
          <Pressable
            onPress={() => { if (hostUserId) onOpenProfile?.(hostUserId); }}
            disabled={!hostUserId || !onOpenProfile}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Avatar size={48} locked={!g.host.photo} photo={g.host.photo || undefined} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text }}>
                {g.host.nick}
                <Text style={{ fontSize: 11, color: colors.mute, fontWeight: '600' }}>
                  {' '}
                  · {g.host.gender === 'F' ? '여' : '남'} {g.host.age}
                </Text>
              </Text>
              {!!raw?.host?.univ_name && (
                <View style={{ marginTop: 4 }}>
                  <UnivBadge name={raw.host.univ_name} size="sm" />
                </View>
              )}
              {hostUserId ? (
                <View style={{ marginTop: 2 }}>
                  <FollowerCount hostId={hostUserId} />
                </View>
              ) : null}
              {(hostedQ.data ?? 0) > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Icons.shield size={12} color={colors.mute} />
                  <Text style={{ fontSize: 11, color: colors.mute }}>모임 호스트 {hostedQ.data}회</Text>
                </View>
              )}
            </View>
            {hostUserId ? <FollowButton hostId={hostUserId} size="sm" /> : null}
            {onOpenProfile && hostUserId ? <Icons.chev size={18} color={colors.mute} /> : null}
          </Pressable>
        </Card>

        {/* Intro */}
        <Card>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.sub, marginBottom: 8 }}>모임 소개</Text>
          <Text style={{ fontSize: 12.5, lineHeight: 20, color: colors.text }}>{g.desc}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {g.tags.map((t) => (
              <View
                key={t}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 5,
                  backgroundColor: colors.bgSoft,
                  borderRadius: radius.pill,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.sub }}>{t}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Process timeline */}
        <Card>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.sub, marginBottom: 12 }}>
            이렇게 진행돼요
          </Text>
          {steps.map((s, i, arr) => (
            <View key={s.n} style={{ flexDirection: 'row', gap: 12, paddingBottom: i < arr.length - 1 ? 14 : 0 }}>
              <View style={{ alignItems: 'center' }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.bgSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.sub, fontSize: 11, fontWeight: '800' }}>{s.n}</Text>
                </View>
                {i < arr.length - 1 && <View style={{ flex: 1, width: 1, backgroundColor: colors.line, marginTop: 2 }} />}
              </View>
              <View style={{ paddingTop: 2, flex: 1 }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.text }}>{s.t}</Text>
                <Text style={{ fontSize: 11, color: colors.mute, marginTop: 2 }}>{s.d}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Rules */}
        <Card>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.sub, marginBottom: 8 }}>참여 안내</Text>
          {[
            hostFee > 0
              ? `참여 신청 시 참가비 ${hostFee.toLocaleString()}원이 카드로 결제돼요`
              : '이 모임은 참여 신청이 무료예요',
            '호스트 승인 전까지는 참여가 확정되지 않아요',
            '승인 후 정확한 장소가 공개돼요',
            '노쇼 시 환불 불가 + 패널티',
          ].map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <Text style={{ fontSize: 11.5, color: colors.sub }}>•</Text>
              <Text style={{ flex: 1, fontSize: 11.5, color: colors.sub, lineHeight: 20 }}>{line}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>

      {/* Sticky CTA */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: bottomBarPad(insets.bottom, 12),
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.lineSoft,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => previewActions.toggleLike(g.id)}
          style={{
            width: 46,
            height: 46,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icons.heart size={20} color={liked ? colors.primary : colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          {isHost ? (
            <Btn kind="line" full size="lg" onPress={() => setEditOpen(true)}>
              모임 편집
            </Btn>
          ) : myStatus === 'pending' ? (
            <Btn kind="soft" full size="lg" disabled>
              승인 대기 중
            </Btn>
          ) : myStatus === 'approved' ? (
            <Btn kind="soft" full size="lg" disabled>
              참여 완료
            </Btn>
          ) : (
            <Btn kind="primary" full size="lg" onPress={handleJoin} disabled={joinMut.isPending}>
              {joinMut.isPending
                ? '신청 중…'
                : hostFee > 0
                  ? `${hostFee.toLocaleString()}원 결제하고 참여 신청`
                  : '무료로 참여 신청'}
            </Btn>
          )}
        </View>
      </View>

      <GatherEdit
        open={editOpen}
        gatheringId={gatherQ.data?.id ?? id}
        onClose={() => setEditOpen(false)}
      />
    </View>
  );
}

// 참가자 아바타 그리드 — 4명/행, 호스트 포함 실제 프로필 사진이 크게 보이는 게 핵심.
// 빈자리는 SlotDot의 점선 실루엣 그대로. 넓은 화면에서도 4명/행 유지(컨테이너 폭 고정).
function SlotGrid({ slots, size }: { slots: GatherSlot[]; size: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: size * 4 + 12 * 3 }}>
      {slots.map((s, i) => (
        <SlotDot key={i} s={s} size={size} />
      ))}
    </View>
  );
}

// 성비(split) 모드용 — 성별 라벨 + 남은 자리 수 + 아바타 그리드
function SlotGridLabeled({ slots, label, size }: { slots: GatherSlot[]; label: string; size: number }) {
  const empty = slots.filter((s) => !s.filled).length;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.text }}>{label}</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.sub }}>
          {empty > 0 ? `${empty}자리 남음` : '마감'}
        </Text>
      </View>
      <SlotGrid slots={slots} size={size} />
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={[
        {
          marginHorizontal: 16,
          marginTop: 14,
          paddingHorizontal: 18,
          paddingVertical: 16,
          backgroundColor: colors.surface,
          borderRadius: radius.card,
        },
        shadow.card as any,
      ]}
    >
      {children}
    </View>
  );
}

function Badge({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: bg, borderRadius: radius.pill }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: fg }}>{children}</Text>
    </View>
  );
}

function InfoRow({ icon, title, subtitle }: { icon: 'calendar' | 'pin'; title: string; subtitle: string }) {
  const Ic = Icons[icon];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.md,
          backgroundColor: colors.bgSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ic size={18} color={colors.sub} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.text }}>{title}</Text>
        <Text style={{ fontSize: 11, color: colors.mute, marginTop: 2 }}>{subtitle}</Text>
      </View>
    </View>
  );
}

