import { VERSION } from '../version';
import {
  beginHold,
  holdReachedDebugReset,
  type HoldWatch,
} from '../input';

export type HudHandle = {
  root: HTMLElement;
  versionEl: HTMLElement;
  resetBtn: HTMLButtonElement;
};

export function mountHud(
  host: HTMLElement,
  handlers: { onReset: () => void; onDebugReset: () => void },
): HudHandle {
  host.replaceChildren();

  const versionEl = document.createElement('div');
  versionEl.className = 'hud-version';
  versionEl.textContent = `v${VERSION}`;
  versionEl.setAttribute('aria-label', `Version ${VERSION}`);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'hud-reset';
  resetBtn.textContent = 'Reset';

  host.append(versionEl, resetBtn);

  resetBtn.addEventListener('click', (event) => {
    event.preventDefault();
    handlers.onReset();
  });

  let hold: HoldWatch | null = null;
  let holdTimer = 0;

  const clearHold = (): void => {
    hold = null;
    if (holdTimer) {
      window.clearTimeout(holdTimer);
      holdTimer = 0;
    }
  };

  versionEl.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    versionEl.setPointerCapture(event.pointerId);
    hold = beginHold(event.pointerId, performance.now());
    holdTimer = window.setTimeout(() => {
      if (hold && holdReachedDebugReset(hold, performance.now())) {
        handlers.onDebugReset();
      }
      clearHold();
    }, 3000);
  });

  versionEl.addEventListener('pointerup', clearHold);
  versionEl.addEventListener('pointercancel', clearHold);
  versionEl.addEventListener('lostpointercapture', clearHold);

  return { root: host, versionEl, resetBtn };
}
