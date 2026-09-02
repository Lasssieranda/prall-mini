import {
  TAP_PIXEL_THRESHOLD,
  impulseFromPointerDelta,
  type Impulse,
} from './physics';

export type PointerSample = {
  id: number;
  x: number;
  y: number;
  t: number;
};

export type FlickSession = {
  pointerId: number;
  start: PointerSample;
  last: PointerSample;
  onBall: boolean;
};

export function pointerDelta(
  start: PointerSample,
  end: PointerSample,
): { dx: number; dy: number; dtMs: number } {
  return {
    dx: end.x - start.x,
    dy: end.y - start.y,
    dtMs: end.t - start.t,
  };
}

export function isTapDelta(dx: number, dy: number, threshold = TAP_PIXEL_THRESHOLD): boolean {
  return Math.hypot(dx, dy) < threshold;
}

export function flickImpulseFromSession(session: FlickSession, end: PointerSample): Impulse {
  const { dx, dy } = pointerDelta(session.start, end);
  return impulseFromPointerDelta(dx, dy);
}

export function beginFlick(
  pointerId: number,
  x: number,
  y: number,
  t: number,
  onBall: boolean,
): FlickSession {
  const sample: PointerSample = { id: pointerId, x, y, t };
  return { pointerId, start: sample, last: sample, onBall };
}

export function moveFlick(session: FlickSession, x: number, y: number, t: number): void {
  session.last = { id: session.pointerId, x, y, t };
}

export function endFlick(session: FlickSession, x: number, y: number, t: number): Impulse | null {
  if (!session.onBall) return null;
  const end: PointerSample = { id: session.pointerId, x, y, t };
  return flickImpulseFromSession(session, end);
}

const HOLD_MS = 3000;

export type HoldWatch = {
  pointerId: number;
  startedAt: number;
};

export function beginHold(pointerId: number, now: number): HoldWatch {
  return { pointerId, startedAt: now };
}

export function holdElapsed(watch: HoldWatch, now: number): number {
  return now - watch.startedAt;
}

export function holdReachedDebugReset(watch: HoldWatch, now: number): boolean {
  return holdElapsed(watch, now) >= HOLD_MS;
}

export const DEBUG_HOLD_MS = HOLD_MS;
