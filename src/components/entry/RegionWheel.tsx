// 사는 곳 휠 2단계 — 1단계 시·도('다음'), 2단계 시·군·구('선택 완료'). 세부가 없는 시·도(세종)는 1단계에서 끝난다.
// 가입(SignUp)과 프로필 수정(DetailStep)이 함께 쓴다. 저장값 규칙은 profileOptions.regionValue.
import React, { useEffect, useState } from 'react';
import { WheelSheet } from '../../ui';
import { SIDO, regionValue, sidoOf, subOf, subRegions } from './profileOptions';

export function RegionWheel({ open, value, onClose, onPick }: { open: boolean; value: string; onClose: () => void; onPick: (region: string) => void }) {
  const [step, setStep] = useState<'sido' | 'sub'>('sido');
  const [sido, setSido] = useState('');
  useEffect(() => { if (open) { setSido(sidoOf(value)); setStep('sido'); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const sub = step === 'sub';
  const subs = subRegions(sido);
  return (
    <WheelSheet
      open={open}
      stepKey={sub ? `sub-${sido}` : 'sido'}
      onClose={onClose}
      title="주로 생활하는 지역"
      caption={sub ? `${sido} · 시·군·구를 골라 주세요` : '시·도를 골라 주세요'}
      back={sub ? { label: '시·도 다시 선택', onPress: () => setStep('sido') } : undefined}
      columns={sub
        ? [{ current: sidoOf(value) === sido ? subOf(value) : subs[0], values: subs.map((s) => ({ value: s, label: s })) }]
        : [{ current: sido || SIDO[0], values: SIDO.map((s) => ({ value: s, label: s })) }]}
      doneLabel={sub ? '선택 완료' : '다음'}
      onDone={([v]) => {
        const picked = String(v);
        if (sub) { onPick(regionValue(sido, picked)); return; }
        if (!subRegions(picked).length) { onPick(picked); return; }
        setSido(picked);
        setStep('sub');
      }}
    />
  );
}
