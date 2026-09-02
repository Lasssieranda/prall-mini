import * as CANNON from 'cannon-es';
import { physicsStepSeconds } from './loop';

export const MAX_IMPULSE = 14;
export const IMPULSE_PIXEL_SCALE = 0.055;
export const TAP_PIXEL_THRESHOLD = 12;
export const FLICK_UP = 2.1;
export const TAP_NUDGE = { x: 0, y: 0.55, z: -2.4 };
export const FALL_RESET_DELAY_S = 1.2;
export const RESTITUTION = 0.88;
export const BALL_RADIUS = 0.38;
export const BALL_MASS = 1;
export const BLOCK_MASS = 0.65;

export const TABLE = {
  width: 5.4,
  depth: 8.2,
  thickness: 0.32,
  y: 0,
};

export const START_POSE = {
  position: { x: 0, y: TABLE.thickness / 2 + BALL_RADIUS + 0.02, z: 2.55 },
  velocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
};

export type Vec3Like = { x: number; y: number; z: number };

export type Impulse = Vec3Like & { magnitude: number; tap: boolean };

export type BodySnapshot = {
  position: Vec3Like;
  velocity: Vec3Like;
  angularVelocity: Vec3Like;
};

export type BlockSpec = {
  id: string;
  size: Vec3Like;
  position: Vec3Like;
  color: string;
};

export const BLOCK_SPECS: readonly BlockSpec[] = [
  {
    id: 'lemon',
    size: { x: 0.95, y: 0.72, z: 0.95 },
    position: { x: -1.35, y: TABLE.thickness / 2 + 0.36, z: -0.35 },
    color: '#ffe566',
  },
  {
    id: 'mint',
    size: { x: 1.15, y: 0.52, z: 0.72 },
    position: { x: 1.25, y: TABLE.thickness / 2 + 0.26, z: -1.7 },
    color: '#7dffc3',
  },
  {
    id: 'sky',
    size: { x: 0.72, y: 0.95, z: 0.72 },
    position: { x: 0.15, y: TABLE.thickness / 2 + 0.475, z: -3.15 },
    color: '#6ecbff',
  },
];

export function clampImpulse(x: number, y: number, z: number, max = MAX_IMPULSE): Impulse {
  const mag = Math.hypot(x, y, z);
  if (mag === 0 || mag <= max) {
    return { x, y, z, magnitude: mag, tap: false };
  }
  const s = max / mag;
  return { x: x * s, y: y * s, z: z * s, magnitude: max, tap: false };
}

/**
 * Screen pointer delta → impulse in the table plane (XZ) plus a little up (Y).
 * Screen +x → world +x; screen -y (swipe toward far end) → world -z (back of table).
 * Do not mirror Y against the camera.
 * Tap (tiny delta) = small nudge forward.
 */
export function impulseFromPointerDelta(dx: number, dy: number): Impulse {
  const dist = Math.hypot(dx, dy);
  if (dist < TAP_PIXEL_THRESHOLD) {
    const magnitude = Math.hypot(TAP_NUDGE.x, TAP_NUDGE.y, TAP_NUDGE.z);
    return { ...TAP_NUDGE, magnitude, tap: true };
  }
  const ix = dx * IMPULSE_PIXEL_SCALE; // horizontal unchanged
  const iz = dy * IMPULSE_PIXEL_SCALE; // swipe up (dy<0) → iz<0 → toward back of table
  const iy = FLICK_UP;
  return { ...clampImpulse(ix, iy, iz), tap: false };
}

export function isOffTable(position: Vec3Like): boolean {
  const halfW = TABLE.width / 2;
  const halfD = TABLE.depth / 2;
  if (position.y < -1.6) return true;
  const outside = Math.abs(position.x) > halfW + 0.15 || Math.abs(position.z) > halfD + 0.15;
  if (outside && position.y < TABLE.y) return true;
  return false;
}

export function snapshotFromStart(): BodySnapshot {
  return {
    position: { ...START_POSE.position },
    velocity: { ...START_POSE.velocity },
    angularVelocity: { ...START_POSE.angularVelocity },
  };
}

function copyVec(from: CANNON.Vec3): Vec3Like {
  return { x: from.x, y: from.y, z: from.z };
}

export type ToyWorld = {
  world: CANNON.World;
  ball: CANNON.Body;
  table: CANNON.Body;
  blocks: CANNON.Body[];
  fallElapsed: number;
  waitingReset: boolean;
};

function toyMaterial(): CANNON.Material {
  return new CANNON.Material('toy');
}

export function createWorld(): ToyWorld {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
  });
  world.allowSleep = true;
  world.broadphase = new CANNON.NaiveBroadphase();

  const mat = toyMaterial();
  const contact = new CANNON.ContactMaterial(mat, mat, {
    restitution: RESTITUTION,
    friction: 0.38,
    contactEquationStiffness: 1e7,
    contactEquationRelaxation: 3,
  });
  world.addContactMaterial(contact);
  world.defaultContactMaterial.restitution = RESTITUTION;
  world.defaultContactMaterial.friction = 0.38;

  const table = new CANNON.Body({
    mass: 0,
    material: mat,
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(
      new CANNON.Vec3(TABLE.width / 2, TABLE.thickness / 2, TABLE.depth / 2),
    ),
    position: new CANNON.Vec3(0, TABLE.y, 0),
  });
  world.addBody(table);

  const ball = new CANNON.Body({
    mass: BALL_MASS,
    material: mat,
    shape: new CANNON.Sphere(BALL_RADIUS),
    position: new CANNON.Vec3(
      START_POSE.position.x,
      START_POSE.position.y,
      START_POSE.position.z,
    ),
    linearDamping: 0.18,
    angularDamping: 0.22,
    allowSleep: true,
  });
  world.addBody(ball);

  const blocks: CANNON.Body[] = BLOCK_SPECS.map((spec) => {
    const body = new CANNON.Body({
      mass: BLOCK_MASS,
      material: mat,
      shape: new CANNON.Box(new CANNON.Vec3(spec.size.x / 2, spec.size.y / 2, spec.size.z / 2)),
      position: new CANNON.Vec3(spec.position.x, spec.position.y, spec.position.z),
      linearDamping: 0.28,
      angularDamping: 0.32,
      allowSleep: true,
    });
    world.addBody(body);
    return body;
  });

  return {
    world,
    ball,
    table,
    blocks,
    fallElapsed: 0,
    waitingReset: false,
  };
}

export function getBallSnapshot(sim: ToyWorld): BodySnapshot {
  return {
    position: copyVec(sim.ball.position),
    velocity: copyVec(sim.ball.velocity),
    angularVelocity: copyVec(sim.ball.angularVelocity),
  };
}

export function resetBall(sim: ToyWorld): BodySnapshot {
  sim.ball.position.set(START_POSE.position.x, START_POSE.position.y, START_POSE.position.z);
  sim.ball.velocity.set(0, 0, 0);
  sim.ball.angularVelocity.set(0, 0, 0);
  sim.ball.quaternion.set(0, 0, 0, 1);
  sim.ball.wakeUp();
  sim.fallElapsed = 0;
  sim.waitingReset = false;
  return getBallSnapshot(sim);
}

export function resetBlocks(sim: ToyWorld): void {
  sim.blocks.forEach((body, i) => {
    const spec = BLOCK_SPECS[i];
    if (!spec) return;
    body.position.set(spec.position.x, spec.position.y, spec.position.z);
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.quaternion.set(0, 0, 0, 1);
    body.wakeUp();
  });
}

export function resetScene(sim: ToyWorld): BodySnapshot {
  resetBlocks(sim);
  return resetBall(sim);
}

export function applyImpulse(sim: ToyWorld, impulse: Vec3Like): void {
  if (sim.waitingReset) return;
  sim.ball.wakeUp();
  sim.ball.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z));
}

/**
 * Advance physics. If paused, step is 0 and bodies do not move (no catch-up).
 * Returns the dt actually integrated, in seconds.
 */
export function tickWorld(sim: ToyWorld, dtMs: number, paused: boolean): number {
  const dt = physicsStepSeconds(dtMs, paused);
  if (dt <= 0) return 0;
  sim.world.step(dt);
  if (sim.waitingReset) {
    sim.fallElapsed += dt;
    if (sim.fallElapsed >= FALL_RESET_DELAY_S) {
      resetScene(sim);
    }
  } else if (isOffTable(sim.ball.position)) {
    sim.waitingReset = true;
    sim.fallElapsed = 0;
  }
  return dt;
}
