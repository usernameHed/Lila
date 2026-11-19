import { useCallback, useEffect, useRef, useState } from 'react';

export const SPEEDS = [10, 30, 60] as const;

/**
 * Set before picking a match to replay: the next match loaded plays from 0:00, unless the previous replay had
 * ended and was paused (then the new one shows whole, at its end, like the one before).
 */
export const playNext = { current: false };

/**
 * Match clock for playback. Starts at the end (the whole journey shown), or plays from 0:00 when `playNext` asked
 * for it; Play from the end restarts at 0. Driven by requestAnimationFrame, so it stays smooth and stops when the
 * tab is hidden.
 */
export function usePlayback(duration: number, resetKey: unknown) {
  const [t, setT] = useState(duration);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(SPEEDS[1]);
  const last = useRef<number | null>(null);
  // The clock as it was before this match: did the previous replay end, paused?
  const before = useRef({ ended: true });

  useEffect(() => {
    if (playNext.current && duration > 0 && resetKey !== null) {
      playNext.current = false;
      if (!before.current.ended) {
        setT(0);
        setPlaying(true);
        return;
      }
    }
    setPlaying(false);
    setT(duration);
  }, [duration, resetKey]);

  // Remembered after each change, while a match is loaded (not during the load between two matches).
  useEffect(() => {
    if (duration > 0) before.current = { ended: !playing && t >= duration };
  }, [t, playing, duration]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    last.current = null;
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : now - last.current;
      last.current = now;
      setT((prev) => {
        const next = Math.min(duration, prev + dt * speed);
        if (next >= duration) setPlaying(false);
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, duration]);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p) setT((prev) => (prev >= duration ? 0 : prev));
      return !p;
    });
  }, [duration]);

  const pause = useCallback(() => setPlaying(false), []);

  const seek = useCallback((value: number) => setT(Math.max(0, Math.min(duration, value))), [duration]);

  return { t, playing, speed, setSpeed, toggle, pause, seek };
}
