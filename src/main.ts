import './style.css';
import { registerSW } from 'virtual:pwa-register';
import {
  applyImpulse,
  createWorld,
  resetScene,
  tickWorld,
} from './physics';
import {
  beginFlick,
  endFlick,
  moveFlick,
  type FlickSession,
} from './input';
import { createScene, pickBall, renderScene, resizeScene, syncScene } from './scene';
import { mountHud } from './ui/hud';

try {
  registerSW({ immediate: true });
} catch {
  /* PWA optional in local/dev */
}

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const hudHost = document.querySelector<HTMLElement>('#hud');
if (!canvas || !hudHost) {
  throw new Error('Prall Mini: missing #game or #hud');
}

const sim = createWorld();
const view = createScene(canvas);

const resetAll = (): void => {
  resetScene(sim);
  syncScene(view, sim);
};

mountHud(hudHost, {
  onReset: resetAll,
  onDebugReset: resetAll,
});

let session: FlickSession | null = null;
let lastTs = performance.now();
let paused = document.hidden;

const setPaused = (next: boolean): void => {
  paused = next;
  lastTs = performance.now();
};

document.addEventListener('visibilitychange', () => {
  setPaused(document.hidden);
});

window.addEventListener('resize', () => {
  resizeScene(view);
});

const onPointerDown = (event: PointerEvent): void => {
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  const onBall = pickBall(view, event.clientX, event.clientY);
  session = beginFlick(event.pointerId, event.clientX, event.clientY, event.timeStamp, onBall);
};

const onPointerMove = (event: PointerEvent): void => {
  event.preventDefault();
  if (!session || session.pointerId !== event.pointerId) return;
  moveFlick(session, event.clientX, event.clientY, event.timeStamp);
};

const onPointerUp = (event: PointerEvent): void => {
  event.preventDefault();
  if (!session || session.pointerId !== event.pointerId) return;
  const impulse = endFlick(session, event.clientX, event.clientY, event.timeStamp);
  session = null;
  if (impulse && !paused) {
    applyImpulse(sim, impulse);
  }
};

canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
canvas.addEventListener('pointermove', onPointerMove, { passive: false });
canvas.addEventListener('pointerup', onPointerUp, { passive: false });
canvas.addEventListener('pointercancel', onPointerUp, { passive: false });

canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
});

document.addEventListener(
  'touchmove',
  (event) => {
    event.preventDefault();
  },
  { passive: false },
);

const loop = (now: number): void => {
  const rawDt = now - lastTs;
  lastTs = now;
  tickWorld(sim, rawDt, paused);
  if (!paused) {
    syncScene(view, sim);
    renderScene(view);
  }
  requestAnimationFrame(loop);
};

syncScene(view, sim);
renderScene(view);
requestAnimationFrame(loop);
