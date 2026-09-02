import * as THREE from 'three';
import {
  BALL_RADIUS,
  BLOCK_SPECS,
  TABLE,
  type ToyWorld,
} from './physics';

const CANDY = {
  ball: '#ff6eb4',
  table: '#fff1dc',
  rim: '#ffc2e2',
  floor: '#3d2458',
  sky: '#ead8ff',
};

export type ToyScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ballMesh: THREE.Mesh;
  blockMeshes: THREE.Mesh[];
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  ballHitMesh: THREE.Mesh;
};

function candyMaterial(color: string, opts?: { roughness?: number; metalness?: number }): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.42,
    metalness: opts?.metalness ?? 0.08,
    emissive: new THREE.Color(color).multiplyScalar(0.12),
  });
}

export function createScene(canvas: HTMLCanvasElement): ToyScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(CANDY.sky, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CANDY.sky);
  scene.fog = new THREE.Fog(CANDY.sky, 16, 36);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / Math.max(window.innerHeight, 1),
    0.1,
    80,
  );
  camera.position.set(0, 10.6, 8.1);
  camera.lookAt(0, 0.1, -0.35);

  const hemi = new THREE.HemisphereLight(0xb8e0ff, 0xffd4e8, 0.95);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff5e8, 1.35);
  sun.position.set(-3.2, 14, 6.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 28;
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({
      color: CANDY.floor,
      roughness: 0.95,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.4;
  floor.receiveShadow = true;
  scene.add(floor);

  const table = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE.width, TABLE.thickness, TABLE.depth),
    candyMaterial(CANDY.table, { roughness: 0.55, metalness: 0.04 }),
  );
  table.position.set(0, TABLE.y, 0);
  table.castShadow = true;
  table.receiveShadow = true;
  scene.add(table);

  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE.width + 0.18, TABLE.thickness * 0.55, TABLE.depth + 0.18),
    candyMaterial(CANDY.rim, { roughness: 0.5 }),
  );
  rim.position.set(0, TABLE.y - TABLE.thickness * 0.28, 0);
  rim.castShadow = true;
  rim.receiveShadow = true;
  scene.add(rim);

  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 24),
    candyMaterial(CANDY.ball, { roughness: 0.32, metalness: 0.12 }),
  );
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  scene.add(ballMesh);

  const ballHitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS * 1.85, 16, 12),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  scene.add(ballHitMesh);

  const blockMeshes = BLOCK_SPECS.map((spec) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(spec.size.x, spec.size.y, spec.size.z),
      candyMaterial(spec.color, { roughness: 0.4 }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  });

  return {
    renderer,
    scene,
    camera,
    ballMesh,
    blockMeshes,
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    ballHitMesh,
  };
}

export function syncScene(view: ToyScene, sim: ToyWorld): void {
  view.ballMesh.position.set(sim.ball.position.x, sim.ball.position.y, sim.ball.position.z);
  view.ballMesh.quaternion.set(
    sim.ball.quaternion.x,
    sim.ball.quaternion.y,
    sim.ball.quaternion.z,
    sim.ball.quaternion.w,
  );
  view.ballHitMesh.position.copy(view.ballMesh.position);

  view.blockMeshes.forEach((mesh, i) => {
    const body = sim.blocks[i];
    if (!body) return;
    mesh.position.set(body.position.x, body.position.y, body.position.z);
    mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
  });
}

export function resizeScene(view: ToyScene): void {
  const w = window.innerWidth;
  const h = Math.max(window.innerHeight, 1);
  view.camera.aspect = w / h;
  view.camera.updateProjectionMatrix();
  view.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  view.renderer.setSize(w, h, false);
}

export function renderScene(view: ToyScene): void {
  view.renderer.render(view.scene, view.camera);
}

export function pickBall(view: ToyScene, clientX: number, clientY: number): boolean {
  const rect = view.renderer.domElement.getBoundingClientRect();
  view.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  view.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  view.raycaster.setFromCamera(view.pointer, view.camera);
  const hits = view.raycaster.intersectObject(view.ballHitMesh, false);
  return hits.length > 0;
}
