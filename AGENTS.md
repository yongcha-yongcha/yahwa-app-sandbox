# AI 작업 규칙 (야화 앱 시연판)

이 저장소는 야화 앱을 **목업 데이터만으로** 돌리는 시연판이에요. PM이 AI로 화면·콘텐츠를 실험하는 곳이에요.
답변·주석·화면 문구는 한국어(해요체)로 써 주세요.

## 절대 지킬 것
1. **실제 백엔드에 연결하지 않는다.** Supabase·결제(토스)·알림톡·푸시·태그히어 등 실제 서비스 주소나 키를 추가하지 않는다. `.env`를 만들지 않는다.
2. `src/lib/supabase.ts`는 목업 클라이언트(`src/demo/client.ts`)를 쓴다. 실제 `createClient`로 바꾸지 않는다.
3. `src/demo/networkGuard.ts`(운영 주소 차단)를 지우거나 우회하지 않는다.
4. 실제 사람 사진·개인정보를 넣지 않는다. 사진은 `public/demo/`의 가상 인물만 쓴다.

## 구조
- `src/demo/db.ts` — 브라우저 안 목업 DB(표 = 배열). localStorage에 저장. 시드가 바뀌면 자동으로 새로 시작.
- `src/demo/query.ts` — `supabase.from(...)` 흉내(select·insert·update·delete·필터·정렬).
- `src/demo/rpc/*.ts` — `supabase.rpc(이름)` 목업. 영역별(affinity·letters·community·my). 없는 이름은 `null`로 응답하고 시연도구 '요청 기록'에 '목업 없음'으로 표시된다.
- `src/demo/seed/*.ts` — 처음 목업 데이터. 콘텐츠를 바꾸려면 여기를 고친다.
- `src/demo/people.ts` — 목업 인물(닉네임·성별·나이·사진).
- `src/demo/functions.ts` — 서버 함수(`functions.invoke`)와 `/api/*` 응답 흉내.
- `src/demo/panel/` — 오른쪽 시연도구. 화면 목록은 `screens.ts`, 상황 버튼은 각 `rpc/*.ts`의 `scenarios`.
- `src/demo/bridge.ts` — 시연도구가 `app/index.tsx`의 화면 전환을 부르는 연결.

## 새 기능을 실험할 때
- 새 표가 필요하면 시드 파일에 `{ 표이름: [행, ...] }`으로 넣고 `supabase.from('표이름')`으로 읽으면 된다.
- 새 서버 함수가 필요하면 `src/demo/rpc/`의 알맞은 파일 `rpc` 객체에 함수를 추가한다(인자 객체를 받아 데이터를 돌려준다. 오류는 `throw new DemoError('메시지')`).
- 시연도구에서 바로 누를 상황 버튼은 그 파일의 `scenarios` 배열에 추가한다.
- 확인: `npx pnpm@10 start` → http://localhost:8081
