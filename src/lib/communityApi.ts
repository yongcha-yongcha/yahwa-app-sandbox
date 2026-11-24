// 야화 — 커뮤니티 · 프로필 교환 v2 API (0171). 서버 함수가 없는(0171 적용 전) 서버에서는 오류를 그대로 던진다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getSessionUser } from './supabase';
import { censorText } from './profanity';

// ── 프로필 교환(시안 1015) ─────────────────────────────────────────────────────
// 교환 해제 — 교환한 둘 중 누구나. 해제하면 교환 목록·교환 열람에서 빠진다(보낸 마음·편지는 남는다).
export async function releaseProfileExchange(exchangeId: string): Promise<void> {
  const { error } = await supabase.rpc('release_profile_exchange' as never, { p_id: exchangeId } as never);
  if (error) throw error;
}

// 교환한(성사·해제) 사람 id — 오늘의 인연 추천에서 뺀다
export async function fetchExchangedUserIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('exchanged_user_ids' as never);
  if (error) return [];
  return ((data as unknown as string[]) ?? []);
}

// 교환한 프로필을 열 수 있는가(상대가 나를 차단했으면 처음 한 번만). 호출하면 첫 열람이 기록된다.
export async function canViewExchangedProfile(otherId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_view_exchanged_profile' as never, { p_other: otherId } as never);
  if (error) throw error;
  return !!data;
}

// ── 내 글·내 댓글 관리 ─────────────────────────────────────────────────────────
// 글 수정 — 본인 글만(0002 lounge_posts_update_self). 첫 줄이 제목(최대 40자).
export async function editLoungePost(postId: string, args: { body: string; attachments: string[]; audioUrl: string | null; audioDuration: number | null }): Promise<{ censored: boolean }> {
  const clean = censorText(args.body.trim());
  const title = Array.from(clean.text.split('\n')[0]).slice(0, 40).join('');
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('lounge_posts')
    .update({ title, body: clean.text, attachments: args.attachments, audio_url: args.audioUrl, audio_duration: args.audioDuration } as any)
    .eq('id', postId)
    .eq('author_id', user.id);
  if (error) throw error;
  return { censored: clean.censored };
}

export async function editLoungeComment(commentId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('edit_lounge_comment' as never, { p_id: commentId, p_body: censorText(body.trim()).text } as never);
  if (error) throw error;
}

// 삭제 — 흔적만 남긴다("삭제된 댓글입니다.")
export async function deleteLoungeComment(commentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_lounge_comment' as never, { p_id: commentId } as never);
  if (error) throw error;
}

// ── 커뮤니티 이용수칙 확인(0175) ─────────────────────────────────────────────────
// '확인했어요' 기록 — 서버(users.community_guide_ack_at, 0175)에 남기고 이 기기에도 함께 둔다.
const GUIDE_KEY = (uid: string) => `yahwa_community_guide_ack:${uid}`;

// 이 기기에서 확인한 적이 있는지(서버 기록은 me.community_guide_ack_at으로 따로 본다)
export async function isCommunityGuideAckedLocal(uid: string): Promise<boolean> {
  try { return (await AsyncStorage.getItem(GUIDE_KEY(uid))) === '1'; } catch { return false; }
}

export async function ackCommunityGuide(uid: string): Promise<void> {
  AsyncStorage.setItem(GUIDE_KEY(uid), '1').catch(() => {});
  await supabase.rpc('ack_community_guide' as never).then(() => undefined, () => undefined);
}
