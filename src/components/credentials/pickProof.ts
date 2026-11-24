// 인증 확인 자료 고르기 — 웹은 사진·PDF(10MB 이하), 앱은 사진첩 사진(공용 pickPhoto: 긴 변 1440 JPEG).
// 파일 이름은 화면에만 보여 주고, 서버에는 무작위 경로로 올린다(api.submitCredential).
import { Platform } from 'react-native';
import { pickPhoto } from '../../lib/photoUpload';

export type ProofFile = { bytes: ArrayBuffer | Blob; mime: string; name: string };

const MAX = 10 * 1024 * 1024;
const OK_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

function alertWeb(msg: string) {
  if (typeof window !== 'undefined') window.alert(msg);
}

function pickWeb(): Promise<ProofFile | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,application/pdf';
    let done = false;
    const finish = (v: ProofFile | null) => { if (!done) { done = true; resolve(v); } };
    input.addEventListener('cancel', () => finish(null));
    // 'cancel' 이벤트가 없는 브라우저 — 창 포커스가 돌아온 뒤 파일이 없으면 취소로 본다
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => { if (!input.files?.length) finish(null); }, 1200);
    };
    window.addEventListener('focus', onFocus);
    input.onchange = async () => {
      window.removeEventListener('focus', onFocus);
      const f = input.files?.[0];
      if (!f) { finish(null); return; }
      const mime = f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : '');
      if (!OK_MIME.includes(mime)) { alertWeb('사진(JPG·PNG) 또는 PDF 파일만 올릴 수 있어요.'); finish(null); return; }
      if (f.size > MAX) { alertWeb('10MB 이하 파일을 올려주세요.'); finish(null); return; }
      finish({ bytes: await f.arrayBuffer(), mime, name: f.name });
    };
    input.click();
  });
}

export async function pickProofFile(): Promise<ProofFile | null> {
  if (Platform.OS === 'web') return pickWeb();
  const p = await pickPhoto();
  if (!p) return null;
  let name = 'photo.jpg';
  try { name = decodeURIComponent(p.uri.split('/').pop() || name); } catch { /* 이름 표시용 */ }
  return { bytes: p.bytes, mime: p.mime, name };
}
