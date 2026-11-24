// 야화 시연판 — 결제. 토스 결제창을 열지 않고(키도 없음) 바로 '결제 성공' 화면으로 보낸다.
// 돈은 오가지 않는다. 리프는 목업 DB에서만 늘어난다(src/demo/functions.ts 'tosspay-confirm').
export type LeafProduct = { n: number; won: number; orderName: string };
export type PayMethod = 'card' | 'kakaopay' | 'tosspay';
export const TOSS_KEY = 'demo';
export const IS_TOSS_TEST = true;

function go(url: string) {
  if (typeof window !== 'undefined') window.location.href = url;
}

export async function requestLeafPayment(p: LeafProduct, userId: string, _method: PayMethod = 'card', _bridge = false) {
  const orderId = `demo_leaf_${p.n}_${Date.now()}`;
  go(`/pay-success?paymentKey=demo&orderId=${orderId}&amount=${p.won}&leaf=${p.n}&uid=${encodeURIComponent(userId)}`);
}

export async function requestGatheringPayment(args: { gatheringId: string; amount: number; gender: 'M' | 'F'; bridge?: boolean }): Promise<void> {
  const orderId = `demo_gather_${Date.now()}`;
  go(`/pay-success?paymentKey=demo&orderId=${orderId}&amount=${args.amount}&gather=${encodeURIComponent(args.gatheringId)}&gender=${args.gender}`);
}

export async function requestGatheringPaymentNative(args: { gatheringId: string; amount: number; gender: 'M' | 'F' }): Promise<void> {
  return requestGatheringPayment(args);
}
export async function requestLeafPaymentNative(p: LeafProduct, userId: string): Promise<void> {
  return requestLeafPayment(p, userId);
}
