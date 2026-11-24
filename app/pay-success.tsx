// 야화 — 토스 결제 success 콜백. URL params에서 결제 정보 추출 + 영수증 검증 + 리프 적립.
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { colors } from '../src/tokens';
import { Btn } from '../src/components/atoms';
import { Icons } from '../src/icons';
import { previewActions } from '../src/lib/previewStore';
import { supabase } from '../src/lib/supabase';
import { joinGatheringPaid } from '../src/lib/api';
import { IS_TOSS_TEST } from '../src/lib/tosspay';

const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW_MODE === '1';

// 토스가 successUrl에 붙이는 파라미터(amount·orderId·paymentKey)가 우리가 넣은 것과
// 겹치면 파서가 배열로 반환하므로, 항상 첫 값만 취해 안전하게 읽는다.
function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function PaySuccess() {
  const params = useLocalSearchParams<{
    paymentKey?: string; orderId?: string; amount?: string;
    leaf?: string; uid?: string;
    gather?: string; gender?: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [err, setErr] = useState<string>('');

  const leafN = Number(firstParam(params.leaf) ?? '0');
  const isGather = !!params.gather;

  useEffect(() => {
    (async () => {
      try {
        const paymentKey = firstParam(params.paymentKey);
        const orderId = firstParam(params.orderId);
        const amount = Number(firstParam(params.amount) ?? '0');
        const uid = firstParam(params.uid);
        // ── 모임 참가비 결제 → 슬롯(승인 대기) 생성 ──
        if (isGather) {
          const gather = firstParam(params.gather)!;
          const gender: 'M' | 'F' = firstParam(params.gender) === 'F' ? 'F' : 'M';
          // 테스트/프리뷰(데모) → 서버 검증 생략하고 클라이언트에서 슬롯 생성.
          // 운영(라이브 키) → Edge Function이 토스 confirm + 슬롯 생성(결제 우회 차단).
          if (PREVIEW || IS_TOSS_TEST) {
            await joinGatheringPaid({ gatheringId: gather, gender, fee: amount, orderId });
          } else {
            const { error } = await supabase.functions.invoke('tosspay-gather-confirm', {
              body: { paymentKey, orderId, gatheringId: gather, gender },
            });
            if (error) throw error;
          }
          setStatus('success');
          return;
        }
        if (!paymentKey || !orderId || !amount || !leafN) {
          throw new Error('결제 정보가 누락되었어요');
        }
        // PREVIEW 모드만 클라이언트 적립 (시연용).
        // 테스트 토스 키여도 서버 confirm(tosspay-confirm)이 테스트 결제를 확정하고 credit_leaf로
        // 실제 서버 잔액에 적립한다 — 로컬만 적립하면 다른 기기에서 0원으로 보이던 동기화 버그의 원인.
        if (PREVIEW) {
          previewActions.chargeLeaf(leafN);
          setStatus('success');
          return;
        }
        // 운영 — uid가 없거나 'preview'면(충전 시 세션 조회 실패) 지금 세션으로 확정한다. 세션도 없으면 적립하지 않고 실패로
        // (서버 confirm 전이라 결제는 확정되지 않는다 — 로컬에만 '충전 완료'를 띄우던 문제)
        let userId = uid && uid !== 'preview' ? uid : null;
        if (!userId) {
          const { data: { session } } = await supabase.auth.getSession();
          userId = session?.user?.id ?? null;
        }
        if (!userId) throw new Error('로그인 정보를 확인하지 못해 결제를 확정하지 않았어요. 다시 로그인한 뒤 충전해 주세요.');
        // Edge Function이 토스 confirm + credit_leaf (서버가 잔액의 단일 진실원천)
        const { error } = await supabase.functions.invoke('tosspay-confirm', {
          body: { paymentKey, orderId, amount, leafCount: leafN, userId },
        });
        if (error) throw error;
        // 서버 잔액을 즉시 로컬에 반영 — 'me' 재조회가 hydrate로 leafBalance를 덮어쓴다.
        await qc.invalidateQueries({ queryKey: ['me'] });
        setStatus('success');
      } catch (e: any) {
        setErr(e?.message ?? '결제 확인에 실패했어요');
        setStatus('error');
      }
    })();
  }, [params.paymentKey, params.orderId, params.amount, leafN, params.uid, params.gather, params.gender, isGather]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      {status === 'pending' && (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginTop: 14, fontSize: 12.5, color: colors.sub }}>결제 확인 중…</Text>
        </>
      )}
      {status === 'success' && (
        <>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icons.check size={36} color={colors.primary} />
          </View>
          <Text style={{ marginTop: 16, fontSize: 20, fontWeight: '800', color: colors.text }}>{isGather ? '참여 신청 완료' : '충전 완료'}</Text>
          <Text style={{ marginTop: 8, fontSize: 12.5, color: colors.sub }}>{isGather ? '결제가 완료됐어요. 호스트 승인을 기다려요.' : `리프 ${leafN}개가 적립되었어요`}</Text>
          <View style={{ marginTop: 24, width: '100%', maxWidth: 320 }}>
            <Btn kind="primary" full size="lg" onPress={() => router.replace('/')}>
              계속하기
            </Btn>
          </View>
        </>
      )}
      {status === 'error' && (
        <>
          <Icons.info size={36} color={colors.danger} stroke={1.5} />
          <Text style={{ marginTop: 14, fontSize: 16, fontWeight: '800', color: colors.text }}>결제 확인 실패</Text>
          <Text style={{ marginTop: 8, fontSize: 11.5, color: colors.sub, textAlign: 'center' }}>{err}</Text>
          <View style={{ marginTop: 24, width: '100%', maxWidth: 320 }}>
            <Btn kind="line" full size="lg" onPress={() => router.replace('/')}>
              홈으로
            </Btn>
          </View>
        </>
      )}
    </View>
  );
}
