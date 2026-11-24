// 야화 — 내 연락처 기억(기기 저장, 계정별). 편지에 마지막으로 적어 보낸 카카오톡 ID · 전화번호를 다음 편지 쓰기의 처음 값으로 쓴다.
// 서버 저장(MY › 내 연락처)이 생기면 그 값으로 바꾼다(spec-dating §5-a-7).
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MyContact = { kakao: string; phone: string; useKakao: boolean; usePhone: boolean };
const key = (uid: string) => `yahwa_my_contact:${uid}`;

export async function loadMyContact(uid: string | null | undefined): Promise<MyContact | null> {
  if (!uid) return null;
  try {
    const v = await AsyncStorage.getItem(key(uid));
    return v ? (JSON.parse(v) as MyContact) : null;
  } catch { return null; }
}
export function saveMyContact(uid: string | null | undefined, c: MyContact): void {
  if (!uid) return;
  AsyncStorage.setItem(key(uid), JSON.stringify(c)).catch(() => {});
}
