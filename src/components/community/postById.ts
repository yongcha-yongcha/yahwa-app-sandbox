// 야화 — 게시글 한 개 불러오기. 피드(최근 40개)에 없는 글(내가 쓴 예전 글·알림으로 연 글)도 상세를 열 수 있게.
// 피드(useLoungePosts)와 같은 모양(LoungePost)으로 바꾼다. 차단한 사람의 글은 볼 수 없다(null).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fetchBlockedIds } from '../../lib/api';
import { censorText } from '../../lib/profanity';
import type { LoungePost } from '../../data/mock';

function toPost(r: any): LoungePost {
  return {
    id: r.id, cat: r.cat, nick: r.anon_nickname, tag: '익명',
    title: censorText(r.title ?? '').text, body: censorText(r.body ?? '').text, likes: r.likes ?? 0,
    comments: r.lounge_comments?.[0]?.count ?? 0,
    author_gender: (r.author_gender ?? null) as 'M' | 'F' | null,
    authorId: r.author_id ?? undefined,
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    audioUrl: r.audio_url ?? null,
    audioDuration: r.audio_duration ?? null,
    time: new Date(r.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric' }),
    createdAt: r.created_at,
  };
}

// 커뮤니티 '내 글' 탭 — 내가 쓴 글(최근 100개). ['lounge'] 접두어: 글 등록·삭제·좋아요 때 함께 새로고침(배열이라 낙관적 반영도 안전)
export function useMyLoungePosts(uid: string | null, enabled: boolean) {
  return useQuery<LoungePost[]>({
    queryKey: ['lounge', 'mine', uid ?? ''],
    enabled: enabled && !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lounge_posts').select('*, lounge_comments(count)')
        .eq('author_id', uid!).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []).map(toPost);
    },
    staleTime: 15_000,
  });
}

export function usePostById(postId: string | undefined, enabled: boolean) {
  return useQuery<LoungePost | null>({
    // 'lounge' 접두어를 쓰지 않는다 — 좋아요 낙관적 반영이 ['lounge'] 데이터를 배열로 보고 map한다
    queryKey: ['lounge-post', postId ?? ''],
    enabled: enabled && !!postId,
    queryFn: async () => {
      const [{ data, error }, blocked] = await Promise.all([
        supabase.from('lounge_posts').select('*, lounge_comments(count)').eq('id', postId!).maybeSingle(),
        fetchBlockedIds(),
      ]);
      if (error) throw error;
      const r: any = data;
      if (!r || blocked.includes(r.author_id)) return null;
      return toPost(r);
    },
    staleTime: 15_000,
  });
}
