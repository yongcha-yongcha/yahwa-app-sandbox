// 야화 — 커뮤니티 댓글·답글 좋아요 (0169: lounge_comment_likes · toggle_lounge_comment_like · my_liked_lounge_comments)
// 수는 lounge_comments.likes(댓글 목록 select *에 함께 옴), 내가 누른 댓글은 글마다 따로 읽는다.
// 누르면 하트·수를 먼저 바꾸고(낙관적) 서버 결과로 맞춘다. 실패하면 되돌린다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../lib/previewStore';
import type { LoungeCommentRow } from '../../lib/hooks';

type Row = LoungeCommentRow & { likes?: number | null };

export function useLikedComments(postId: string | undefined) {
  const uid = getCurrentUserId();
  return useQuery<string[]>({
    queryKey: ['my-liked-lounge-comments', postId ?? '', uid ?? ''],
    enabled: !!postId && !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_liked_lounge_comments' as never, { p_post_id: postId } as never);
      if (error) return [];  // 0169 적용 전 서버 — 좋아요 기록 없이 보여 준다
      return ((data as unknown as string[]) ?? []);
    },
    staleTime: 60_000,
  });
}

export function useToggleCommentLike(postId: string | undefined) {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  const likedKey = ['my-liked-lounge-comments', postId ?? '', uid ?? ''];
  const listKey = ['lounge-comments', postId ?? ''];
  return useMutation<{ likes: number; liked: boolean }, Error, string, { liked?: string[]; list?: Row[] }>({
    mutationFn: async (commentId: string) => {
      const { data, error } = await supabase.rpc('toggle_lounge_comment_like' as never, { p_comment_id: commentId } as never);
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] as any) : (data as any);
      return { likes: Number(row?.likes ?? 0), liked: !!row?.liked };
    },
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: likedKey });
      const liked = qc.getQueryData<string[]>(likedKey);
      const list = qc.getQueryData<Row[]>(listKey);
      const was = (liked ?? []).includes(commentId);
      qc.setQueryData<string[]>(likedKey, (o) => (was ? (o ?? []).filter((x) => x !== commentId) : [...(o ?? []), commentId]));
      qc.setQueryData<Row[]>(listKey, (o) => o?.map((c) => (c.id === commentId ? { ...c, likes: Math.max(0, (c.likes ?? 0) + (was ? -1 : 1)) } : c)));
      return { liked, list };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.liked) qc.setQueryData(likedKey, ctx.liked);
      if (ctx?.list) qc.setQueryData(listKey, ctx.list);
    },
    onSuccess: (r, commentId) => {
      qc.setQueryData<Row[]>(listKey, (o) => o?.map((c) => (c.id === commentId ? { ...c, likes: r.likes } : c)));
      qc.setQueryData<string[]>(likedKey, (o) => {
        const s = new Set(o ?? []);
        if (r.liked) s.add(commentId); else s.delete(commentId);
        return [...s];
      });
    },
  });
}
