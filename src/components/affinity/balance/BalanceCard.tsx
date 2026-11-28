// 오늘의 밸런스 카드 — 인연 홈 카드 줄의 두 번째 칸(1번 인연 다음).
// 앞면은 표지(하트 캐릭터가 A · B 카드를 든 그림), [열어보기]를 누르면 옆으로 뒤집히며 오늘의 질문이 나온다.
// 뒷면에서는 카드를 바로 눌러 고른다(따로 고르기 버튼 없음). 고르면 '골랐어요' 도장과 비율이 나온다.
// 웹 시연판 전용: 시안 HTML · CSS를 그대로 그려 카드 폭에 맞춰 늘리거나 줄인다(앱 본 구현은 RN으로 다시 그린다).
import React, { useEffect, useMemo } from 'react';
import { Platform, Text, View } from 'react-native';
import { BALANCE_Q, PIC, scaleIcon, type BalanceSide } from './content';
import { injectBalanceCss } from './styles';
import type { BalanceLook } from './state';

const BASE_W = 330;
const pctOf = (k: BalanceSide) => (k === 'a' ? BALANCE_Q.pctA : 100 - BALANCE_Q.pctA);
const RIBBON = '<svg class="ribbon" viewBox="0 0 410 120" preserveAspectRatio="none"><path d="M0 70C70 20 130 110 205 62S340 10 410 60" fill="none" stroke="#E4DDF2" stroke-width="26" stroke-linecap="round" opacity=".9"/></svg>';

function coverHtml(look: BalanceLook, date: string): string {
  return `<div class="rays"></div>${RIBBON}
    <div class="top"><span class="tag">${scaleIcon('')}둘 중 하나만 골라요</span></div>
    <p class="ttl"><span>오늘의</span><em>밸런스</em></p>
    <p class="sub">하루 한 판 · 같은 쪽을 고른 한 사람을 소개해요</p>
    <div class="hero"><span class="float-shadow"></span><img class="float" src="/demo/balance/heart-${look.char}.png" width="270" height="270" alt="양손에 A · B 카드를 든 하트 캐릭터" draggable="false"></div>
    <div class="foot2"><span><i></i>${date} 질문이 도착했어요</span></div>`;
}

function backHtml(look: BalanceLook, p: BalanceSide | '', date: string): string {
  const Q = BALANCE_Q;
  const pic = (k: BalanceSide, s: number) => PIC[k]?.(s) ?? '';
  const res = (k: BalanceSide) => (p ? `<span class="pct">${pctOf(k)}%</span>` : '');
  const stamp = (k: BalanceSide) => (p === k ? '<span class="stamp2">골랐어요</span>' : '');
  const tip = (ask: string) => `<span class="tip2">${p ? '같은 쪽 사람을 찾았어요' : ask}</span>`;
  const cls = `bk ${look.back}${p ? ' p' + p : ''}`;
  const lbl = `<p class="lbl">${scaleIcon(p)}오늘의 밸런스 · ${date}</p>`;
  const sides: BalanceSide[] = ['a', 'b'];
  if (look.back === 'picnic') {
    return `<div class="${cls}">
      <div class="memo">${lbl}<p class="qq">${Q.text}</p></div>
      ${sides.map((k) => `<div class="pk ${k}" data-pick="${k}" role="button" aria-label="${Q[k].label} 고르기">${stamp(k)}<span class="ix tl">${k.toUpperCase()}<small>${k === 'a' ? '♠' : '♥'}</small></span><span class="ix br">${k.toUpperCase()}<small>${k === 'a' ? '♠' : '♥'}</small></span>${pic(k, 72)}<span class="ans">${Q[k].label}</span><span class="sb2">${Q[k].sub}</span>${res(k)}</div>`).join('')}
      <span class="chip"><span>VS</span></span>
      ${tip('마음에 드는 카드를 한 장 뽑아요')}</div>`;
  }
  if (look.back === 'mobile') {
    const stars = [[40, 120], [300, 96], [180, 34], [260, 300], [30, 330], [150, 420], [296, 430], [90, 70], [220, 140]].map(([x, y]) => `<i class="star" style="left:${x}px;top:${y}px"></i>`).join('');
    return `<div class="${cls}">${stars}<i class="moon"></i>
      ${lbl}<p class="qq">${Q.text}</p><i class="rod"></i>
      ${sides.map((k) => `<div class="pk ${k} sway" data-pick="${k}" role="button" aria-label="${Q[k].label} 고르기"><i class="str"></i><svg class="knot" viewBox="0 0 12 12"><path d="M6 0l1.6 4.4L12 6l-4.4 1.6L6 12l-1.6-4.4L0 6l4.4-1.6z" fill="#fff"/></svg><div class="face2">${stamp(k)}<span class="mk3">${k.toUpperCase()}</span>${pic(k, 70)}<span class="ans">${Q[k].label}</span><span class="sb2">${Q[k].sub}</span>${res(k)}</div></div>`).join('')}
      <span class="vs3">vs</span>
      ${tip('마음이 가는 쪽을 눌러요')}</div>`;
  }
  // 오락기
  return `<div class="${cls}">
    <div class="marq"><span class="st">★</span>오늘의 밸런스<span class="st">★</span><span class="dt">${date}</span></div>
    <div class="scr"><p class="q"><em>Q.</em> ${Q.text}</p>
      ${sides.map((k) => `<div class="pan ${k}" data-pick="${k}" role="button" aria-label="${Q[k].label} 고르기">${pic(k, 60)}<b>${Q[k].label}</b><small>${Q[k].sub}</small>${p ? `<div class="pbar">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(pctOf(k) / 10) ? 'on' : ''}"></i>`).join('')}</div><span class="pct">${pctOf(k)}%</span>` : ''}</div>`).join('')}
      <span class="vs">VS</span></div>
    <div class="ctrl"><span class="btn a" data-pick="a" role="button" aria-label="${Q.a.label} 고르기">A</span><span class="btn b" data-pick="b" role="button" aria-label="${Q.b.label} 고르기">B</span><p class="hint">${p ? '같은 쪽 사람을 찾았어요' : '화면이나 버튼을 눌러 골라요'}</p></div></div>`;
}

export function BalanceCard({ w, h, look, opened, pick, date, onPress, onPick }: {
  w: number; h: number;
  look: BalanceLook;
  opened: boolean;                 // 표지를 열었는지(뒤집힌 상태)
  pick: BalanceSide | '';          // 오늘 고른 답
  date: string;                    // '11월 28일'
  onPress: () => void;             // 카드 아무 데나 누름(옆 카드면 넘어오기 · 표지면 열기)
  onPick: (side: BalanceSide) => void;
}) {
  useEffect(() => { injectBalanceCss(); }, []);
  const front = useMemo(() => ({ __html: coverHtml(look, date) }), [look, date]);
  const back = useMemo(() => ({ __html: backHtml(look, pick, date) }), [look, pick, date]);

  if (Platform.OS !== 'web') {
    return (
      <View style={{ width: w, height: h, borderRadius: 22, backgroundColor: '#F6E9EC', alignItems: 'center', justifyContent: 'center' }}>
        <Text>오늘의 밸런스(웹 시연판에서 볼 수 있어요)</Text>
      </View>
    );
  }
  const k = w / BASE_W;
  const onClick = (e: any) => {
    const el = (e.target as HTMLElement).closest?.('[data-pick]') as HTMLElement | null;
    if (opened && !pick && el) { onPick(el.dataset.pick as BalanceSide); return; }
    onPress();
  };
  return (
    <div style={{ position: 'relative', width: w, height: h, borderRadius: 22, overflow: 'hidden', cursor: 'pointer' }} onClick={onClick}>
      <div className={`ybal${opened ? ' open' : ''}`} style={{ height: h / k, transform: `scale(${k})` }}>
        <div className="flipper"><div className="in">
          <div className={`face front cover ${look.title}`} dangerouslySetInnerHTML={front} />
          <div className="face back" dangerouslySetInnerHTML={back} />
        </div></div>
      </div>
    </div>
  );
}
