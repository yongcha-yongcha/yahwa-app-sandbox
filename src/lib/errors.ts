// 야화 — 에러를 사용자가 이해하고 "어떻게 해야 하는지" 알 수 있는 한국어 안내로 변환.
// supabase/PostgREST/network 에러의 암호 같은 메시지를 행동 가능한 문구로 매핑.

export type FriendlyError = {
  title: string;   // Alert 제목
  message: string; // 원인 + 해결 방법
};

export function friendlyError(e: any, fallbackTitle = '문제가 발생했어요'): FriendlyError {
  const code = String(e?.code ?? e?.error_code ?? '');
  const msg = String(e?.message ?? e?.error_description ?? e ?? '');
  const low = msg.toLowerCase();

  // 인증/세션 만료
  if (code === '401' || code === 'PGRST301' || low.includes('jwt') || low.includes('not authenticated') || low.includes('로그인이 필요')) {
    return { title: '로그인이 필요해요', message: '세션이 만료됐어요. 마이 → 로그아웃 후 다시 로그인하면 정상 동작해요.' };
  }
  // RLS / 권한
  if (code === '42501' || low.includes('row-level security') || low.includes('violates row-level')) {
    return { title: '저장 권한 문제', message: '권한 문제로 저장하지 못했어요. 새로고침 후 다시 시도하고, 계속되면 다시 로그인해주세요.' };
  }
  // RPC 함수 미적용 — DB 마이그레이션 누락
  if (code === 'PGRST202' || low.includes('could not find the function')) {
    return {
      title: '서버 설정 준비 중',
      message: '게더링 채팅방 생성 기능이 아직 활성화되지 않았어요. 잠시 후 다시 시도하거나, 관리자에게 마이그레이션 0017 적용을 요청해주세요.',
    };
  }
  // 컬럼/테이블 불일치 (마이그레이션 미적용)
  if (code === 'PGRST204' || code === 'PGRST205' || low.includes('could not find') || low.includes('column')) {
    return { title: '앱 업데이트 필요', message: '서버 준비가 아직 안 됐어요. 페이지를 새로고침한 뒤 다시 시도해주세요.' };
  }
  // 중복
  if (code === '23505' || low.includes('duplicate') || low.includes('already')) {
    return { title: '이미 처리됐어요', message: '같은 항목이 이미 등록돼 있어요.' };
  }
  // FK 위반 (예: users 행 없음)
  if (code === '23503' || low.includes('foreign key')) {
    return { title: '계정 정보 확인 필요', message: '계정 정보가 완성되지 않았어요. 마이 → 프로필 편집에서 닉네임을 저장한 뒤 다시 시도해주세요.' };
  }
  // 네트워크
  if (low.includes('failed to fetch') || low.includes('network') || low.includes('load failed') || e?.name === 'TypeError') {
    return { title: '네트워크 오류', message: '인터넷 연결을 확인하고 다시 시도해주세요.' };
  }
  // 재귀 등 서버 정책 오류
  if (code === '42P17' || low.includes('recursion')) {
    return { title: '서버 설정 오류', message: '일시적인 서버 문제예요. 잠시 후 다시 시도해주세요.' };
  }
  return { title: fallbackTitle, message: msg || '잠시 후 다시 시도해주세요.' };
}
