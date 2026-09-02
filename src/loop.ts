/** Max frame delta: 1/20 s = 50 ms. */
export const MAX_DT_MS = 50;
export const MAX_DT_SECONDS = MAX_DT_MS / 1000;

export function clampFrameDeltaMs(dtMs: number): number {
  if (!Number.isFinite(dtMs) || dtMs < 0) return 0;
  return Math.min(dtMs, MAX_DT_MS);
}

/** Physics integration dt in seconds. Hidden/paused tabs step 0 (no catch-up). */
export function physicsStepSeconds(dtMs: number, paused: boolean): number {
  if (paused) return 0;
  return clampFrameDeltaMs(dtMs) / 1000;
}

export function isDocumentHidden(hidden: boolean): boolean {
  return hidden;
}
