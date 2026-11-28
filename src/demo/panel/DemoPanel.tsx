// 야화 시연도구 — PC 브라우저 오른쪽 패널.
// 앱 화면(가운데 기둥)과 따로, <html> 바로 아래에 붙여 그린다(앱의 body 기둥 밖).
// 하는 일: 화면 바로 옮기기 · 내 계정 상태 바꾸기 · 상황 만들기(편지 도착 등) · 목업 데이터 처음으로 · 요청 기록 보기.
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { meta, saveMeta, resetDb, getLog, onLog, onDbChange, me, updateRows, ME_ID, type LogItem } from '../db';
import { setSignedIn } from '../client';
import { demoGo, getDemoScreen, onDemoScreen, type DemoNavTarget } from '../bridge';
import { SCREEN_GROUPS, screenName } from './screens';
import type { Scenario } from '../scenario';
import { allScenarios, demoControls } from '../rpc';
import { queryClient } from '../../lib/query';
import { BACK_OPTIONS, CHAR_OPTIONS, TITLE_OPTIONS, requestBalanceFocus, setBalanceLook, useBalanceLook } from '../../components/affinity/balance/state';

function useDb() {
  return useSyncExternalStore(onDbChange, () => JSON.stringify([me()?.leaf_balance, me()?.points, me()?.gender, meta.signedIn, meta.timeOffsetMs]));
}
function useScreen() {
  const [s, set] = useState(getDemoScreen());
  useEffect(() => onDemoScreen(() => set({ ...getDemoScreen() })), []);
  return s;
}
function useLog(): LogItem[] {
  const [, tick] = useState(0);
  useEffect(() => onLog(() => tick((n) => n + 1)), []);
  return getLog();
}

// 목업 DB가 바뀐 뒤 앱 화면이 새 값을 읽게
function refreshApp() { queryClient.invalidateQueries(); }

function go(t: DemoNavTarget | null, setMsg: (s: string) => void) {
  if (!t) { setMsg('이 화면에 보여 줄 목업 데이터가 아직 없어요.'); return; }
  const run = () => { if (!demoGo(t)) setMsg('앱 화면이 아직 준비되지 않았어요. 잠시 뒤 다시 눌러 주세요.'); };
  if (!meta.signedIn) { setSignedIn(true); setTimeout(run, 600); } else run();
}

const KIND_LABEL: Record<string, string> = { rpc: '함수', select: '읽기', insert: '쓰기', update: '수정', delete: '삭제', upsert: '쓰기', auth: '로그인', storage: '사진', function: '서버함수', fetch: '서버주소' };

export function DemoPanel() {
  useDb();
  const screen = useScreen();
  const log = useLog();
  const [msg, setMsg] = useState('상황을 고르면 여기에 결과가 보여요.');
  const [open, setOpen] = useState<Record<string, boolean>>({ screens: true, balance: true, account: true, scenarios: true, log: false });
  const look = useBalanceLook();
  const u = me();
  const blocked = log.filter((l) => l.note?.startsWith('차단')).length;
  const missing = log.filter((l) => l.missing);

  const controls = demoControls();
  const groups = useMemo(() => {
    const m = new Map<string, Scenario[]>();
    (allScenarios() as Scenario[]).forEach((s) => { if (!m.has(s.group)) m.set(s.group, []); m.get(s.group)!.push(s); });
    return [...m.entries()];
  }, []);

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const runScenario = async (s: Scenario) => {
    try {
      if (!meta.signedIn) setSignedIn(true);
      const r = await s.run();
      setMsg(r || '완료했어요.');
      refreshApp();
      if (s.go) setTimeout(() => go(s.go!, setMsg), 250);
    } catch (e: any) { setMsg(e?.message ?? '실행하지 못했어요.'); }
  };
  const act = (fn: () => void, m: string, reload = false) => {
    try { fn(); setMsg(m); refreshApp(); if (reload) setTimeout(() => window.location.reload(), 300); }
    catch (e: any) { setMsg(e?.message ?? '실행하지 못했어요.'); }
  };

  return (
    <div className="ydp">
      <header className="ydp-head">
        <div className="ydp-title">야화 시연도구</div>
        <div className="ydp-safe">● 목업 데이터 · 운영 서버 연결 없음</div>
        <div className="ydp-now">지금 화면 <b>{screenName(screen.tab, screen.overlay, screen.entry)}</b></div>
      </header>

      <div className="ydp-foot ydp-foot-top">
        <button className="ydp-reset" onClick={() => { if (window.confirm('목업 데이터를 처음 상태로 되돌릴까요? 이 브라우저에서 쓴 글·편지·좋아요가 지워져요.')) { resetDb(); try { localStorage.removeItem('yahwa_welcome_seen'); } catch { /* noop */ } window.location.reload(); } }}>처음 상태로 되돌리기</button>
        <div className="ydp-note">쓴 글·댓글·좋아요·편지는 이 브라우저에만 저장돼요.</div>
      </div>
      <div className="ydp-msg" role="status">{msg}</div>

      <Section id="screens" title="화면 이동" open={open} toggle={toggle}>
        {SCREEN_GROUPS.map((g) => (
          <div key={g.title} className="ydp-group">
            <div className="ydp-sub">{g.title}</div>
            <div className="ydp-chips">
              {g.items.map((i) => (
                <button key={i.label} className="ydp-chip" onClick={() => go(i.target(), setMsg)}>{i.label}</button>
              ))}
            </div>
          </div>
        ))}
        <div className="ydp-group">
          <div className="ydp-sub">시작 화면</div>
          <div className="ydp-chips">
            <button className="ydp-chip" onClick={() => act(() => { try { localStorage.removeItem('yahwa_welcome_seen'); } catch { /* noop */ } setSignedIn(false); }, '처음 설치한 상태로 열어요.', true)}>웰컴(첫 실행)</button>
            <button className="ydp-chip" onClick={() => act(() => { try { localStorage.setItem('yahwa_welcome_seen', '1'); } catch { /* noop */ } setSignedIn(false); }, '로그아웃했어요. 둘러보기 상태예요.', true)}>로그아웃 상태</button>
            {controls.resetMeToNewUser && (
              <button className="ydp-chip" onClick={() => act(() => { controls.resetMeToNewUser(); setSignedIn(true); }, '방금 가입한 회원으로 바꿨어요. 가입 단계를 볼 수 있어요.', true)}>새 회원 가입 흐름</button>
            )}
          </div>
        </div>
      </Section>

      <Section id="balance" title="오늘의 밸런스" open={open} toggle={toggle}>
        <div className="ydp-note">인연 홈 두 번째 카드예요. 1번 인연에서 왼쪽으로 넘기면 나와요.</div>
        <div className="ydp-chips" style={{ marginTop: 8 }}>
          <button className="ydp-chip" onClick={() => { go({ tab: 'affinity' }, setMsg); setTimeout(requestBalanceFocus, 400); setMsg('밸런스 카드로 넘겼어요.'); }}>밸런스 카드로 가기</button>
          {controls.resetBalance && (
            <button className="ydp-chip" onClick={() => act(() => { controls.resetBalance(); setBalanceLook({}); }, '오늘 고른 답을 지웠어요. 표지부터 다시 볼 수 있어요.')}>다시 하기</button>
          )}
        </div>
        <Row label="제목">
          <Seg value={look.title} options={TITLE_OPTIONS} onChange={(v) => { setBalanceLook({ title: v as any }); setMsg('제목 스타일을 바꿨어요. 표지부터 보여요.'); }} />
        </Row>
        <Row label="표지 캐릭터">
          <Seg value={look.char} options={CHAR_OPTIONS} onChange={(v) => { setBalanceLook({ char: v as any }); setMsg('표지 캐릭터를 바꿨어요.'); }} />
        </Row>
        <Row label="뒷면">
          <Seg value={look.back} options={BACK_OPTIONS} onChange={(v) => { setBalanceLook({ back: v as any }); setMsg('뒷면 컨셉을 바꿨어요. [열어보기]를 누르면 보여요.'); }} />
        </Row>
      </Section>

      <Section id="account" title="내 계정" open={open} toggle={toggle}>
        <Row label="로그인">
          <Seg value={meta.signedIn ? 'on' : 'off'} options={[['on', '로그인'], ['off', '로그아웃']]}
            onChange={(v) => act(() => setSignedIn(v === 'on'), v === 'on' ? '로그인했어요.' : '로그아웃했어요.')} />
        </Row>
        <Row label="내 성별">
          <Seg value={u?.gender ?? 'M'} options={[['M', '남자'], ['F', '여자']]}
            onChange={(v) => act(() => (controls.setMyGender ? controls.setMyGender(v) : updateRows('users', (x) => x.id === ME_ID, { gender: v })), v === 'M' ? '남자 회원으로 봐요. 인연에 여성이 보여요.' : '여자 회원으로 봐요. 인연에 남성이 보여요.')} />
        </Row>
        <Row label={`리프 ${u?.leaf_balance ?? 0}`}>
          <div className="ydp-chips">
            {[0, 30, 300].map((n) => (
              <button key={n} className="ydp-chip" onClick={() => act(() => (controls.setMyLeaf ? controls.setMyLeaf(n) : updateRows('users', (x) => x.id === ME_ID, { leaf_balance: n })), `리프를 ${n}개로 맞췄어요.`)}>{n}</button>
            ))}
          </div>
        </Row>
        <Row label={`포인트 ${u?.points ?? 0}`}>
          <div className="ydp-chips">
            {[0, 5000].map((n) => (
              <button key={n} className="ydp-chip" onClick={() => act(() => updateRows('users', (x) => x.id === ME_ID, { points: n }), `포인트를 ${n}으로 맞췄어요.`)}>{n.toLocaleString()}</button>
            ))}
          </div>
        </Row>
        <Row label="시간">
          <div className="ydp-chips">
            <button className="ydp-chip" onClick={() => act(() => { meta.timeOffsetMs += 86400000; saveMeta(); }, `하루 뒤로 옮겼어요. (지금 +${Math.round(meta.timeOffsetMs / 86400000) + 1}일)`)}>+1일</button>
            <button className="ydp-chip" onClick={() => act(() => { meta.timeOffsetMs = 0; saveMeta(); }, '실제 시간으로 돌아왔어요.')}>지금으로</button>
          </div>
        </Row>
        {meta.timeOffsetMs > 0 && <div className="ydp-note">목업 데이터 시간이 {Math.round(meta.timeOffsetMs / 86400000)}일 앞서 있어요.</div>}
      </Section>

      <Section id="scenarios" title="상황 만들기" open={open} toggle={toggle}>
        {groups.length === 0 && <div className="ydp-note">아직 상황 버튼이 없어요.</div>}
        {groups.map(([g, list]) => (
          <div key={g} className="ydp-group">
            <div className="ydp-sub">{g}</div>
            {list.map((s) => (
              <button key={s.id} className="ydp-act" onClick={() => runScenario(s)}>
                <span>{s.label}</span>
                {s.hint && <small>{s.hint}</small>}
              </button>
            ))}
          </div>
        ))}
      </Section>

      <Section id="log" title={`요청 기록 · 운영 서버로 나간 요청 0건`} open={open} toggle={toggle}>
        <div className="ydp-note">앱이 보낸 요청을 이 브라우저 안의 목업이 대신 받아요. {blocked > 0 ? `운영 주소로 가려던 요청 ${blocked}건은 막았어요.` : ''}</div>
        {missing.length > 0 && <div className="ydp-warn">목업이 없는 함수 {new Set(missing.map((m) => m.name)).size}개: {[...new Set(missing.map((m) => m.name))].join(', ')}</div>}
        <ul className="ydp-log">
          {log.slice(0, 40).map((l, i) => (
            <li key={i} className={l.missing ? 'miss' : ''}>
              <span className="k">{KIND_LABEL[l.kind] ?? l.kind}</span>
              <span className="n">{l.name}</span>
              {l.note && <span className="t">{l.note}</span>}
            </li>
          ))}
        </ul>
      </Section>

    </div>
  );
}

function Section({ id, title, open, toggle, children }: { id: string; title: string; open: Record<string, boolean>; toggle: (k: string) => void; children: React.ReactNode }) {
  return (
    <section className="ydp-sec">
      <button className="ydp-sec-h" onClick={() => toggle(id)} aria-expanded={!!open[id]}>
        <span>{title}</span><span aria-hidden>{open[id] ? '−' : '+'}</span>
      </button>
      {open[id] && <div className="ydp-sec-b">{children}</div>}
    </section>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="ydp-row"><div className="ydp-row-l">{label}</div><div className="ydp-row-r">{children}</div></div>;
}
function Seg({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="ydp-seg">
      {options.map(([v, l]) => <button key={v} className={v === value ? 'on' : ''} onClick={() => v !== value && onChange(v)}>{l}</button>)}
    </div>
  );
}
