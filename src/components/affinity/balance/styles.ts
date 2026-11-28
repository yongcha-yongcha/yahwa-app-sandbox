// 오늘의 밸런스 카드 스타일(웹 시연판 전용) — 시안(design-mockups/balance-game, 11-28)의 CSS를 그대로 옮겼다.
// 카드는 폭 330 기준으로 그리고, 실제 카드 폭에 맞춰 통째로 늘리거나 줄인다(BalanceCard).
// 글자색은 어두운 회색 한 가지(--n800). 움직임은 '움직임 줄이기'면 멈춘다.
export const BALANCE_CSS = `
.ybal{--n100:#E3E7EA;--n200:#CFD5DA;--n600:#69757E;--n700:#505C65;--n800:#39444D;--n900:#273037;
  --s50:#ECF5FC;--s100:#D6EAF8;--s200:#B7D7EC;--s300:#92C0DF;--s500:#4E8AB0;--s600:#377398;
  --r50:#FCF5F6;--r100:#F6E9EC;--r200:#EBD0D5;--r300:#DDAFB7;--r400:#C78693;--r500:#B26073;--r600:#994A5D;
  --ease-out:cubic-bezier(.23,1,.32,1);--ease-io:cubic-bezier(.77,0,.175,1);
  --sans:YahwaPretendard,-apple-system,sans-serif;--serif:"GowunBatang-Bold",serif;
  position:absolute;left:0;top:0;width:330px;transform-origin:0 0;font-family:var(--sans);color:var(--n800);word-break:keep-all;-webkit-user-select:none;user-select:none}
.ybal p{margin:0}
.ybal *{box-sizing:border-box}

/* 뒤집기 — 카드 한 장에 앞(표지) · 뒤(게임) */
.ybal .flipper{position:absolute;inset:0;perspective:1400px}
.ybal .in{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform 640ms var(--ease-io)}
.ybal.open .in{transform:rotateY(180deg)}
.ybal .face{position:absolute;inset:0;border-radius:22px;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.ybal .face.back{transform:rotateY(180deg)}

/* ── 표지 ── */
.ybal .cover{background:var(--r100)}
.ybal .rays{position:absolute;left:50%;top:268px;width:560px;height:560px;margin:-280px 0 0 -280px;border-radius:50%;
  background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.55) 0 7deg,rgba(255,255,255,0) 7deg 18deg);
  -webkit-mask:radial-gradient(closest-side,#000 30%,transparent 72%);mask:radial-gradient(closest-side,#000 30%,transparent 72%)}
.ybal .ribbon{position:absolute;left:-40px;right:-40px;top:230px;height:120px}
.ybal .top{position:absolute;left:0;right:0;top:22px;display:flex;justify-content:center}
.ybal .tag{display:flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:14px;background:#fff;box-shadow:inset 0 0 0 1.5px var(--n800);font:700 12px/1 var(--sans);color:var(--n800)}
.ybal .ttl{position:absolute;left:0;right:0;top:60px;display:flex;justify-content:center;align-items:center;text-align:center;color:var(--n800)}
.ybal .ttl span,.ybal .ttl em{font:inherit;letter-spacing:inherit;color:inherit;font-style:normal}
.ybal .t1 .ttl{font:900 40px/48px var(--sans);letter-spacing:-1.8px}
.ybal .t1 .ttl em{margin-left:8px}
.ybal .t2 .ttl{font:400 38px/48px var(--serif);letter-spacing:-1px;gap:12px}
.ybal .t2 .ttl::before,.ybal .t2 .ttl::after{content:"";width:22px;height:1.5px;background:var(--n800);opacity:.5}
.ybal .sub{position:absolute;left:0;right:0;top:112px;text-align:center;font:800 13px/18px var(--sans);letter-spacing:.2px;color:var(--n800)}
.ybal .hero{position:absolute;left:50%;top:150px;width:290px;height:250px;margin-left:-145px}
.ybal .hero .float{position:absolute;left:10px;top:-14px;width:270px;height:270px;object-fit:contain;animation:ybalFloat 3.2s ease-in-out infinite;-webkit-user-drag:none}
.ybal .hero .float-shadow{position:absolute;left:50%;top:236px;width:120px;height:14px;margin-left:-60px;border-radius:50%;background:rgba(57,68,77,.14);animation:ybalShadow 3.2s ease-in-out infinite}
@keyframes ybalFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes ybalShadow{0%,100%{transform:scaleX(1);opacity:1}50%{transform:scaleX(.78);opacity:.6}}
.ybal .foot2{position:absolute;left:0;right:0;bottom:22px;display:flex;justify-content:center}
.ybal .foot2 span{display:flex;align-items:center;gap:6px;height:30px;padding:0 14px;border-radius:15px;background:rgba(255,255,255,.8);font:600 12px/1 var(--sans);color:var(--n700)}
.ybal .foot2 i{width:6px;height:6px;border-radius:3px;background:var(--r500)}

/* ── 뒷면 공통 ── */
.ybal .bk{position:absolute;inset:0;overflow:hidden;color:var(--n800)}
.ybal .qq{position:absolute;left:20px;right:20px;text-align:center;font:900 26px/32px var(--sans);letter-spacing:-1px;color:var(--n800)}
.ybal .pk{position:absolute;cursor:pointer;transition:transform 420ms var(--ease-io),opacity 260ms var(--ease-out),filter 260ms}
.ybal .pk:active{filter:brightness(.97)}
.ybal .ans{display:block;font:900 26px/32px var(--sans);letter-spacing:-.8px;color:var(--n800)}
.ybal .sb2{display:block;margin-top:2px;font:600 12px/16px var(--sans);color:var(--n700)}
.ybal .pct{display:block;margin-top:8px;font:900 22px/26px var(--sans);font-variant-numeric:tabular-nums;color:var(--n800)}
.ybal .pic{display:block}
.ybal .stamp2{position:absolute;right:-10px;top:-12px;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;font:800 11px/14px var(--sans);color:var(--n800);background:#fff;transform:rotate(-14deg);box-shadow:inset 0 0 0 2px var(--n800),inset 0 0 0 5px #fff,inset 0 0 0 6.5px var(--n800);z-index:3;animation:ybalPress 260ms var(--ease-out) both}
@keyframes ybalPress{from{opacity:0;transform:rotate(-14deg) scale(1.35)}to{opacity:1;transform:rotate(-14deg) scale(1)}}
.ybal .tip2{position:absolute;font:700 12px/16px var(--sans);color:var(--n800);background:#fff;border-radius:12px;padding:7px 10px;box-shadow:inset 0 0 0 1.5px var(--n800);white-space:nowrap}
.ybal .bk.pa .pk.b,.ybal .bk.pb .pk.a{opacity:.45;filter:saturate(.4)}
.ybal .lbl{display:flex;align-items:center;gap:6px;font:700 12px/16px var(--sans);color:var(--n700)}

/* ── 피크닉 — 깅엄 천 위 테이프 메모 + 트럼프 카드 두 장, 포커칩 VS ── */
.ybal .picnic{background-color:#F8EEF1;background-image:linear-gradient(90deg,rgba(221,175,183,.35) 50%,transparent 50%),linear-gradient(rgba(221,175,183,.35) 50%,transparent 50%);background-size:36px 36px}
.ybal .picnic .memo{position:absolute;left:28px;right:28px;top:20px;height:96px;border-radius:6px;background:#fff;box-shadow:0 8px 16px -10px rgba(57,68,77,.35);transform:rotate(-1.5deg)}
.ybal .picnic .memo::before{content:"";position:absolute;left:50%;top:-10px;width:70px;height:20px;margin-left:-35px;background:rgba(214,234,248,.85);transform:rotate(3deg)}
.ybal .picnic .memo .lbl{position:absolute;left:0;right:0;top:16px;justify-content:center}
.ybal .picnic .memo .qq{top:40px;left:10px;right:10px}
.ybal .picnic .pk{top:150px;width:138px;height:206px;border-radius:14px;background:#fff;box-shadow:0 10px 18px -8px rgba(57,68,77,.35),0 0 0 1px rgba(57,68,77,.12);text-align:center;padding-top:30px}
.ybal .picnic .pk::after{content:"";position:absolute;inset:7px;border-radius:9px;box-shadow:inset 0 0 0 1px rgba(57,68,77,.15);pointer-events:none}
.ybal .picnic .pk.a{left:22px;transform:rotate(-7deg)}.ybal .picnic .pk.b{right:22px;transform:rotate(6deg)}
.ybal .picnic .ix{position:absolute;font:900 16px/16px var(--sans);text-align:center}
.ybal .picnic .ix small{display:block;font-size:10px;margin-top:1px}
.ybal .picnic .ix.tl{left:14px;top:12px}.ybal .picnic .ix.br{right:14px;bottom:12px;transform:rotate(180deg)}
.ybal .picnic .pk.a .ix{color:var(--s600)}.ybal .picnic .pk.b .ix{color:var(--r600)}
.ybal .picnic .pk .pic{margin:0 auto -2px}
.ybal .picnic .chip{position:absolute;left:50%;top:232px;width:58px;height:58px;margin-left:-29px;border-radius:50%;background:#fff;display:grid;place-items:center;z-index:2;
  box-shadow:0 4px 8px -2px rgba(57,68,77,.3),inset 0 0 0 5px #F3EDDE,inset 0 0 0 7px var(--n800);
  background-image:repeating-conic-gradient(var(--r300) 0 15deg,#fff 15deg 45deg);transition:opacity 200ms}
.ybal .picnic .chip span{width:38px;height:38px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 1.5px var(--n800);display:grid;place-items:center;font:900 14px/1 var(--sans);color:var(--n800)}
.ybal .picnic .tip2{left:50%;bottom:24px;transform:translateX(-50%)}
.ybal .picnic.pa .pk.a{transform:rotate(-2deg) translateY(-14px) scale(1.05)}
.ybal .picnic.pb .pk.b{transform:rotate(2deg) translateY(-14px) scale(1.05)}
.ybal .picnic.pa .pk.b{transform:rotate(14deg) translate(16px,22px)}.ybal .picnic.pb .pk.a{transform:rotate(-14deg) translate(-16px,22px)}
.ybal .picnic.pa .chip,.ybal .picnic.pb .chip{opacity:0}

/* ── 밤하늘 모빌 — 라벤더 밤하늘, 막대에 매달려 흔들리는 카드 두 장, 달 VS ── */
.ybal .mobile{background:#DCDDF2}
.ybal .mobile .star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff}
.ybal .mobile .moon{position:absolute;right:26px;top:22px;width:40px;height:40px;border-radius:50%;box-shadow:inset -10px 4px 0 0 #FFF7D6;transform:rotate(-18deg)}
.ybal .mobile .lbl{position:absolute;left:22px;top:24px}
.ybal .mobile .qq{top:50px;left:22px;right:70px;text-align:left;font:400 27px/36px var(--serif);letter-spacing:-.5px}
.ybal .mobile .pk{top:0;width:136px;height:300px;transform-origin:50% 0;text-align:center}
.ybal .mobile .pk.a{left:24px}.ybal .mobile .pk.b{right:24px}
.ybal .mobile .rod{position:absolute;left:38px;right:38px;top:110px;height:3px;border-radius:2px;background:var(--n700);opacity:.5}
.ybal .mobile .str{position:absolute;left:50%;top:112px;width:1.5px;height:18px;margin-left:-.75px;background:var(--n700);opacity:.55}
.ybal .mobile .knot{position:absolute;left:50%;top:124px;width:12px;height:12px;margin-left:-6px}
.ybal .mobile .face2{position:absolute;left:0;right:0;top:134px;height:166px;border-radius:22px;background:#fff;box-shadow:0 12px 22px -12px rgba(57,68,77,.45);padding-top:8px}
.ybal .mobile .pk.a .face2{box-shadow:inset 0 0 0 2px var(--s300),0 12px 22px -12px rgba(57,68,77,.45)}
.ybal .mobile .pk.b .face2{box-shadow:inset 0 0 0 2px var(--r300),0 12px 22px -12px rgba(57,68,77,.45)}
.ybal .mobile .mk3{position:absolute;left:12px;top:10px;font:400 18px/1 var(--serif);color:var(--n800)}
.ybal .mobile .pk .pic{margin:0 auto -6px}
.ybal .mobile .ans{font:400 26px/32px var(--serif)}
.ybal .mobile .sway{animation:ybalSway 3.6s ease-in-out infinite}
.ybal .mobile .pk.b.sway{animation-delay:-1.8s}
@keyframes ybalSway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
.ybal .mobile .vs3{position:absolute;left:50%;top:330px;width:52px;height:52px;margin-left:-26px;border-radius:50%;background:#FFF7D6;display:grid;place-items:center;font:400 16px/1 var(--serif);color:var(--n800);box-shadow:0 0 0 6px rgba(255,247,214,.45);transition:opacity 200ms}
.ybal .mobile .tip2{left:50%;bottom:22px;transform:translateX(-50%);background:rgba(255,255,255,.85);box-shadow:none}
.ybal .mobile.pa .pk.a,.ybal .mobile.pb .pk.b{animation:none;transform:translateY(16px) scale(1.04)}
.ybal .mobile.pa .pk.b{animation:none;transform:rotate(5deg)}.ybal .mobile.pb .pk.a{animation:none;transform:rotate(-5deg)}
.ybal .mobile.pa .vs3,.ybal .mobile.pb .vs3{opacity:0}

/* ── 오락기 — 간판 · 화면 속 두 패널 · A/B 버튼, 픽셀 VS · 칸칸이 차는 비율 ── */
.ybal .arcade{background:var(--s50);background-image:radial-gradient(var(--s200) 1px,transparent 1px);background-size:12px 12px}
.ybal .arcade .marq{position:absolute;left:16px;right:16px;top:14px;height:50px;border:2px solid var(--n800);border-radius:14px;background:var(--r200);box-shadow:0 3px 0 var(--n800);display:flex;align-items:center;justify-content:center;gap:8px;font:800 17px/1 var(--sans);letter-spacing:-.3px;color:var(--n900)}
.ybal .arcade .marq .st{color:#fff;-webkit-text-stroke:1.5px var(--n800);paint-order:stroke fill;font-size:16px}
.ybal .arcade .marq .dt{position:absolute;right:14px;font:500 11px/1 var(--sans);color:var(--n700)}
.ybal .arcade .scr{position:absolute;left:16px;right:16px;top:76px;height:296px;border:2px solid var(--n800);border-radius:18px;background:#fff;box-shadow:inset 0 0 0 6px var(--s100)}
.ybal .arcade .scr .q{position:absolute;left:0;right:0;top:20px;text-align:center;font:800 18px/24px var(--sans);color:var(--n900)}
.ybal .arcade .scr .q em{font-style:normal;color:var(--s500)}
.ybal .arcade .pan{position:absolute;top:60px;width:122px;height:208px;border:2px solid var(--n800);border-radius:6px;box-shadow:4px 4px 0 var(--n800);text-align:center;cursor:pointer;transition:background-color 200ms,opacity 200ms}
.ybal .arcade .pan.a{left:14px;background:var(--s50)}.ybal .arcade .pan.b{right:18px;background:var(--r50)}
.ybal .arcade .pan .pic{margin:18px auto 0}
.ybal .arcade .pan b{display:block;margin-top:10px;font:800 24px/30px var(--sans);color:var(--n900)}
.ybal .arcade .pan small{display:block;margin-top:2px;font:500 12px/16px var(--sans);color:var(--n600)}
.ybal .arcade .vs{position:absolute;left:50%;top:150px;width:46px;height:46px;margin-left:-23px;background:var(--n800);color:#fff;display:grid;place-items:center;font:900 16px/1 ui-monospace,Menlo,monospace;letter-spacing:-1px;z-index:3;transition:opacity 200ms;
  clip-path:polygon(0 8px,8px 8px,8px 0,calc(100% - 8px) 0,calc(100% - 8px) 8px,100% 8px,100% calc(100% - 8px),calc(100% - 8px) calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,8px calc(100% - 8px),0 calc(100% - 8px))}
.ybal .arcade .ctrl{position:absolute;left:16px;right:16px;top:388px;height:70px;border:2px solid var(--n800);border-radius:18px;background:var(--s200);display:flex;align-items:center;justify-content:center;gap:56px}
.ybal .arcade .btn{position:relative;width:46px;height:46px;border-radius:50%;border:2px solid var(--n800);box-shadow:0 5px 0 var(--n800);display:grid;place-items:center;font:900 17px/1 var(--sans);color:#fff;-webkit-text-stroke:1.5px var(--n800);paint-order:stroke fill;cursor:pointer;transition:transform 120ms,box-shadow 120ms}
.ybal .arcade .btn.a{background:var(--s300)}.ybal .arcade .btn.b{background:var(--r300)}
.ybal .arcade .ctrl .hint{position:absolute;bottom:-26px;left:0;right:0;text-align:center;font:500 12px/18px var(--sans);color:var(--n600)}
.ybal .arcade.pa .btn.a,.ybal .arcade.pb .btn.b{transform:translateY(5px);box-shadow:0 0 0 var(--n800)}
.ybal .arcade.pa .pan.a{background:var(--s200)}.ybal .arcade.pb .pan.b{background:var(--r200)}
.ybal .arcade.pa .pan.b,.ybal .arcade.pb .pan.a{opacity:.45}
.ybal .arcade.pa .vs,.ybal .arcade.pb .vs{opacity:0}
.ybal .arcade .pbar{display:flex;gap:2px;justify-content:center;margin-top:10px}
.ybal .arcade .pbar i{width:8px;height:12px;background:var(--n100)}
.ybal .arcade .a .pbar i.on{background:var(--s500)}.ybal .arcade .b .pbar i.on{background:var(--r400)}
.ybal .arcade .pct{margin-top:4px;font:800 13px/16px ui-monospace,Menlo,monospace}

@media (prefers-reduced-motion:reduce){
  .ybal .in{transition:none}
  .ybal .hero .float,.ybal .hero .float-shadow,.ybal .stamp2,.ybal .mobile .sway{animation:none!important}
  .ybal .pk{transition:opacity 160ms}
}
`;

let injected = false;
export function injectBalanceCss() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const el = document.createElement('style');
  el.id = 'yahwa-balance-css';
  el.textContent = BALANCE_CSS;
  document.head.appendChild(el);
}
