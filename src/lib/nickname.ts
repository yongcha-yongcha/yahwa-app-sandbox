// 야화 — 닉네임 검증 (가입 SignUp · 마이페이지 수정 공용)
// ProfileEdit의 규칙(2~10자)과 동일 + 비속어 필터.
import { censorText } from './profanity';

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 10;

// 규칙 위반 시 한국어 에러 메시지, 통과 시 null.
export function nicknameError(raw: string): string | null {
  const name = raw.trim();
  if (!name) return '닉네임을 입력해 주세요';
  if (name.length < NICKNAME_MIN || name.length > NICKNAME_MAX) {
    return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해 주세요`;
  }
  // 닉네임은 마스킹 대신 등록 거부 — ***닉네임이 노출되는 것 방지
  if (censorText(name).censored) return '닉네임에 사용할 수 없는 표현이 있어요';
  return null;
}
