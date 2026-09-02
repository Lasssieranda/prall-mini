import { describe, expect, it } from 'vitest';
import {
  MAX_IMPULSE,
  START_POSE,
  createWorld,
  getBallSnapshot,
  impulseFromPointerDelta,
  resetBall,
  tickWorld,
} from '../src/physics';
import { clampFrameDeltaMs, MAX_DT_MS, physicsStepSeconds } from '../src/loop';

describe('impulse clamp', () => {
  it('caps over-large pointer delta', () => {
    const impulse = impulseFromPointerDelta(20_000, -20_000);
    expect(impulse.magnitude).toBeLessThanOrEqual(MAX_IMPULSE + 1e-9);
    expect(Math.hypot(impulse.x, impulse.y, impulse.z)).toBeCloseTo(MAX_IMPULSE, 6);
    expect(impulse.tap).toBe(false);
  });

  it('maps a tap to a small forward nudge', () => {
    const impulse = impulseFromPointerDelta(0, 0);
    expect(impulse.tap).toBe(true);
    expect(impulse.z).toBeLessThan(0);
    expect(impulse.magnitude).toBeLessThan(MAX_IMPULSE);
  });
});

describe('reset state', () => {
  it('puts position and velocity back to start', () => {
    const sim = createWorld();
    sim.ball.position.set(3.2, -2.4, 4.1);
    sim.ball.velocity.set(9, 2, -4);
    sim.ball.angularVelocity.set(1.2, -0.4, 0.8);
    const after = resetBall(sim);
    expect(after.position.x).toBeCloseTo(START_POSE.position.x);
    expect(after.position.y).toBeCloseTo(START_POSE.position.y);
    expect(after.position.z).toBeCloseTo(START_POSE.position.z);
    expect(after.velocity.x).toBe(0);
    expect(after.velocity.y).toBe(0);
    expect(after.velocity.z).toBe(0);
    expect(after.angularVelocity.x).toBe(0);
    expect(after.angularVelocity.y).toBe(0);
    expect(after.angularVelocity.z).toBe(0);
  });
});

describe('dt clamp', () => {
  it('maps 200ms in to 50ms out', () => {
    expect(clampFrameDeltaMs(200)).toBe(50);
    expect(MAX_DT_MS).toBe(50);
  });
});

describe('pause', () => {
  it('paused tick does not move the ball and steps 0', () => {
    const sim = createWorld();
    sim.ball.velocity.set(2.5, 0.4, -3.1);
    const before = getBallSnapshot(sim);
    const stepped = tickWorld(sim, 16, true);
    const after = getBallSnapshot(sim);
    expect(stepped).toBe(0);
    expect(physicsStepSeconds(16, true)).toBe(0);
    expect(after.position.x).toBe(before.position.x);
    expect(after.position.y).toBe(before.position.y);
    expect(after.position.z).toBe(before.position.z);
    expect(after.velocity.x).toBe(before.velocity.x);
    expect(after.velocity.y).toBe(before.velocity.y);
    expect(after.velocity.z).toBe(before.velocity.z);
  });
});
