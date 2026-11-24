// 내 인증 상태 — 프로필 미리보기(프로필 편집 · MY '내 프로필 미리보기')에서 FullProfile에 그대로 넘긴다.
//   const v = useMyVerification();
//   <FullProfile p={{ ...data, basicVerified: v.basicVerified, credentials: v.credentials }} />
// basicVerified: 성별·생년월일 등록(onboarded = 서버 age_locked) + 전화번호 — get_friend_profiles(0157)와 같은 기준
// credentials : 승인된 인증만(다른 회원에게 보이는 것). all에는 검토 대기·반려도 들어 있다.
import { useQuery } from '@tanstack/react-query';
import { fetchMyCredentials, type CredentialKind, type MyCredential } from '../../lib/api';
import { usePreview, previewSelectors } from '../../lib/previewStore';

export const MY_CREDENTIALS_KEY = ['my-credentials'];

export function useMyVerification(enabled = true): {
  basicVerified: boolean;
  credentials: { kind: CredentialKind; label: string }[];
  all: MyCredential[];
  isLoading: boolean;
} {
  const profile = usePreview(previewSelectors.myProfile);
  const q = useQuery({ queryKey: MY_CREDENTIALS_KEY, queryFn: fetchMyCredentials, enabled, staleTime: 30_000 });
  const all = q.data ?? [];
  return {
    basicVerified: !!profile.onboarded && !!profile.phone,
    credentials: all.filter((c) => c.status === 'approved').map((c) => ({ kind: c.kind, label: c.label })),
    all,
    isLoading: q.isLoading,
  };
}
