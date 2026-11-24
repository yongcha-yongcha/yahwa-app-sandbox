// 야화 — 음성 남기기 시트(리뉴얼 1120, spec-rest §3.7). 글쓰기 종이의 마이크를 누르면 뜬다.
// 녹음 전: "0:00 / 1:30" → 흐린 소리 막대(높이 48 · 막대 3 · 사이 3) → 녹음 원 72(강조 파랑 + 흰 마이크 32)
// 녹음 중: "● 녹음 중"(빨간 점이 1초 주기로 35%까지 깜빡) → 흐르는 시간 → 오른쪽에서 새 막대가 들어옴 → 멈추기 원 72(회색 카드 + 빨간 네모 24)
// 들어 보기: 재생 줄 56 → [다시 녹음 · 넣기]. 최대 길이(MAX_AUDIO_SEC = 90초)가 되면 저절로 멈춘다.
// 녹음 모듈이 소리 크기를 주지 않아 막대는 흐르는 모양으로 그린다(§9.1). 녹음 파일은 [올리기] 때만 서버에 올린다.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { colors } from '../../tokens';
import { BottomSheet, SheetButtons, NATIVE, reduceMotion, usePress } from '../../ui';
import { startRecording, MAX_AUDIO_SEC, type ActiveRecording } from '../../lib/audioMessage';
import { getCurrentUserId } from '../../lib/previewStore';
import { CIcon } from './cIcons';
import { SiteAudio } from './SiteAudio';

export type Clip = { uri: string; duration: number; remote?: boolean };
const mss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const BARS = 40;
const FLAT = Array.from({ length: BARS }, () => 4);

export function RecordSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (clip: Clip) => void }) {
  const [stage, setStage] = useState<'idle' | 'rec' | 'review'>('idle');
  const [busy, setBusy] = useState(false);       // 녹음 준비 · 저장 중
  const [sec, setSec] = useState(0);
  const [bars, setBars] = useState<number[]>(FLAT);
  const [clip, setClip] = useState<Clip | null>(null);
  const [err, setErr] = useState('');
  const recRef = useRef<ActiveRecording | null>(null);
  const pendingStart = useRef(false);   // 마이크 허락을 기다리는 중
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);
  const recPress = usePress(0.94);
  const blink = useRef(new Animated.Value(1)).current;

  function discard() {
    pendingStart.current = false;
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
    const r = recRef.current;
    recRef.current = null;
    r?.stop().catch(() => {});
  }
  // 닫힘(언마운트) — 마이크가 켜진 채 남지 않게
  useEffect(() => { alive.current = true; return () => { alive.current = false; discard(); }; }, []);
  // 열 때마다 처음 단계부터, 닫으면 녹음을 버린다
  useEffect(() => {
    if (open) { setStage('idle'); setSec(0); setBars(FLAT); setClip(null); setErr(''); setBusy(false); } else discard();
  }, [open]);
  // 녹음 중 빨간 점 — 1초 주기로 35%까지
  useEffect(() => {
    if (stage !== 'rec' || reduceMotion()) { blink.setValue(1); return; }
    const a = Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 0.35, duration: 500, useNativeDriver: NATIVE }),
      Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: NATIVE }),
    ]));
    a.start();
    return () => a.stop();
  }, [stage, blink]);

  async function stop() {
    const r = recRef.current;
    if (!r) {   // 마이크 허락을 기다리는 중에 멈춤 — 녹음 없이 처음으로
      pendingStart.current = false;
      if (tick.current) { clearInterval(tick.current); tick.current = null; }
      setStage('idle'); setSec(0); setBars(FLAT);
      return;
    }
    recRef.current = null;
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
    setBusy(true);
    const out = await r.stop();
    if (!alive.current) return;
    setBusy(false);
    if (!out) { setStage('idle'); setErr('녹음하지 못했어요. 다시 시도해주세요.'); return; }
    if (out.durationSec < 1) { setStage('idle'); setSec(0); setBars(FLAT); setErr('1초 이상 녹음해주세요.'); return; }
    setClip({ uri: out.uri, duration: out.durationSec });
    setStage('review');
  }

  // 시안 11-21: 누르자마자 '녹음 중'으로 넘어가고, 마이크 허락은 뒤에서 기다린다. 허락되면 그때부터 실제 녹음(시간도 0부터 다시).
  // 막대는 실제 소리 크기(level)를 따라가고, 소리가 없으면 가만히 있다.
  async function start() {
    if (busy || stage === 'rec') return;
    setErr('');
    if (!getCurrentUserId()) { setErr('음성 녹음은 로그인 후 가능해요.'); return; }
    pendingStart.current = true;
    setSec(0); setBars(FLAT); setStage('rec');
    let t0 = Date.now();
    tick.current = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setSec(Math.min(s, MAX_AUDIO_SEC));
      const lv = recRef.current?.level() ?? 0;
      setBars((b) => [...b.slice(1), 4 + Math.round(lv * 26)]);
      if (recRef.current && s >= MAX_AUDIO_SEC) void stop();  // 최대 길이 — 자동 중지
    }, 120);
    const r = await startRecording();
    if (!alive.current || !pendingStart.current) { r?.stop().catch(() => {}); return; }
    pendingStart.current = false;
    if (!r) {
      if (tick.current) { clearInterval(tick.current); tick.current = null; }
      setStage('idle'); setSec(0); setBars(FLAT); setErr('마이크 권한을 확인해주세요.');
      return;
    }
    recRef.current = r;
    t0 = Date.now(); setSec(0); setBars(FLAT);
  }

  const rec = stage === 'rec';
  return (
    <BottomSheet open={open} onClose={onClose} dismissable={!busy}>
      <Text accessibilityRole="header" style={{ fontSize: 17, lineHeight: 23.8, fontWeight: '600', color: colors.text }}>음성 남기기</Text>
      {stage === 'review' && clip ? (
        <View style={{ paddingTop: 12, paddingBottom: 4, gap: 16 }}>
          <SiteAudio url={clip.uri} durationSec={clip.duration} />
          <SheetButtons cancelLabel="다시 녹음" onCancel={() => { setClip(null); setSec(0); setBars(FLAT); setStage('idle'); }} confirmLabel="넣기" onConfirm={() => { onDone(clip); onClose(); }} />
        </View>
      ) : (
        <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: 'center', gap: 16 }}>
          {rec && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.badge, opacity: blink }} />
              <Text style={{ fontSize: 13, lineHeight: 13, fontWeight: '500', color: colors.mute }}>녹음 중</Text>
            </View>
          )}
          <Text accessibilityLabel={`${Math.floor(sec)}초, 최대 ${MAX_AUDIO_SEC}초`} style={{ fontSize: 28, lineHeight: 28, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] }}>
            {mss(sec)}<Text style={{ fontSize: 14, fontWeight: '400', color: colors.mute }}>{`  / ${mss(MAX_AUDIO_SEC)}`}</Text>
          </Text>
          <View pointerEvents="none" style={{ alignSelf: 'stretch', height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, overflow: 'hidden' }}>
            {bars.map((h, i) => <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: rec ? colors.text : colors.chevron }} />)}
          </View>
          <Pressable
            onPress={rec ? stop : start}
            onPressIn={recPress.onPressIn}
            onPressOut={recPress.onPressOut}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={rec ? '녹음 멈추기' : '녹음 시작'}
          >
            <Animated.View style={[{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: rec ? colors.bgSoft : colors.accent }, recPress.scaleStyle]}>
              {rec ? <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: colors.badge }} /> : <CIcon name="mic" size={32} color={colors.inverse} />}
            </Animated.View>
          </Pressable>
          {!!err && <Text accessibilityRole="alert" style={{ fontSize: 12, lineHeight: 18, color: colors.danger }}>{err}</Text>}
        </View>
      )}
    </BottomSheet>
  );
}
