import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CAR_MODEL_URL = new URL('../../assets/models/car/bryan_sedan.glb', import.meta.url).href;
const CAR_TARGET_LENGTH = 4.60;

const box = new THREE.BoxGeometry(1, 1, 1);
const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12);
const materials = Object.fromEntries(Object.entries({
  paint: 0x374e57, glass: 0x182b3a, tire: 0x182024, trim: 0x8d969a, snow: 0xb5c6ce,
}).map(([key, color]) => [key, new THREE.MeshLambertMaterial({ color })]));

export const ROAD_SURFACES = {
  ROAD_SNOW: { grip: 0.78, drag: 0.12, acceleration: 3.3, braking: 6.2, maxSpeed: 16 },
  DEEP_SNOW: { grip: 0.32, drag: 0.8, acceleration: 2.2, braking: 4.2, maxSpeed: 6.5 },
  ICE: { grip: 0.18, drag: 0.075, acceleration: 2.1, braking: 3.1, maxSpeed: 16 },
};

export function createCar() {
  const car = new THREE.Group(); car.name = 'Bryan-car';
  const add = (size, position, material) => {
    const mesh = new THREE.Mesh(box, material); mesh.scale.set(...size); mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.proceduralCarVisual = true;
    car.add(mesh); return mesh;
  };
  add([1.8, 0.5, 4.1], [0, 0.62, 0], materials.paint);
  add([1.58, 0.66, 2.0], [0, 1.12, 0.1], materials.glass);
  add([1.65, 0.08, 1.85], [0, 1.47, 0.15], materials.paint);
  add([1.4, 0.035, 1.6], [0, 1.52, 0.2], materials.snow);
  add([1.65, 0.04, 0.7], [0, 0.90, -1.55], materials.snow);
  for (const x of [-0.79, 0.79]) for (const z of [-0.91, 0.95])
    add([0.045, 0.67, 0.06], [x, 1.12, z], materials.paint);
  for (const z of [-2.08, 2.08]) add([1.82, 0.13, 0.09], [0, 0.49, z], materials.trim);
  const headlight = new THREE.MeshBasicMaterial({ color: 0xe1dec1 });
  const taillight = new THREE.MeshBasicMaterial({ color: 0xaa3934 });
  for (const x of [-0.59, 0.59]) {
    add([0.4, 0.16, 0.025], [x, 0.71, -2.063], headlight);
    add([0.34, 0.15, 0.025], [x, 0.71, 2.063], taillight);
  }
  car.userData.wheels = [];
  for (const x of [-0.89, 0.89]) for (const z of [-1.34, 1.34]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.35, z); car.add(pivot);
    const tire = new THREE.Mesh(wheel, materials.tire); tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    tire.userData.proceduralCarVisual = true;
    pivot.add(tire);
    car.userData.wheels.push({ pivot, tire, front: z < 0 });
  }
  loadDetailedCarVisual(car);
  return car;
}

function loadDetailedCarVisual(car) {
  const loader = new GLTFLoader();

  loader.load(
    CAR_MODEL_URL,
    gltf => {
      const visual = gltf.scene;
      visual.name = 'Bryan-car-meshy-model';

      // Meshy authored the sedan along X, front toward -X. Rotate it so the
      // vehicle front matches the game's -Z forward axis.
      visual.rotation.y = -Math.PI / 2;
      visual.updateMatrixWorld(true);

      let bounds = new THREE.Box3().setFromObject(visual);
      const size = bounds.getSize(new THREE.Vector3());
      const sourceLength = Math.max(size.x, size.z);
      if (sourceLength > 0.001) {
        visual.scale.setScalar(CAR_TARGET_LENGTH / sourceLength);
      }

      visual.updateMatrixWorld(true);
      bounds = new THREE.Box3().setFromObject(visual);
      const center = bounds.getCenter(new THREE.Vector3());

      // Center the body over the existing physics origin and put the tires on
      // y=0. The wrapper below keeps this grounded when we enlarge the sedan
      // only for the post-crash fixed-camera shots.
      visual.position.x -= center.x;
      visual.position.z -= center.z;
      visual.position.y -= bounds.min.y;

      visual.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (!object.geometry.getAttribute('normal')) {
          object.geometry.computeVertexNormals();
        }
        const mats = Array.isArray(object.material)
          ? object.material
          : [object.material];
        mats.filter(Boolean).forEach(material => {
          if ('metalness' in material) material.metalness = 0.24;
          if ('roughness' in material) material.roughness = 0.58;
          material.needsUpdate = true;
        });
      });

      const holder = new THREE.Group();
      holder.name = 'Bryan-car-meshy-visual';
      holder.add(visual);
      holder.scale.setScalar(car.userData.aftermathVisualScale ?? 1);

      car.add(holder);
      car.userData.detailedVisual = holder;

      // Keep the old block car only as a loading/error fallback.
      car.traverse(object => {
        if (object.userData?.proceduralCarVisual) object.visible = false;
      });
    },
    undefined,
    error => {
      console.warn('Bryan sedan GLB failed to load; using fallback car.', error);
    },
  );
}

// Planar arcade dynamics. Persistent world velocity produces recoverable lateral slip.
export class Vehicle {
  constructor() {
    this.group = createCar(); this.position = this.group.position;
    this.velocity = new THREE.Vector3(); this.reset();
  }

  reset() {
    this.position.set(0, 0, -2); this.velocity.set(0, 0, 0);
    this.heading = 0; this.yawRate = 0; this.steering = 0;
    this.speed = 0; this.slip = 0; this.collisions = 0; this.impactRemaining = 0;
    this.acceleration = 3.3; this.braking = 6.2;
    this.traction = 0.78; this.snowGrip = 0.78; this.lateralVelocity = 0;
    this.weightTransfer = 0; this.pitch = 0; this.surface = 'ROAD_SNOW';
    this.group.rotation.set(0, 0, 0);
  }

  update(input, dt, road) {
    if (dt <= 0) return;
    // Small fixed upper step also protects against fast driving into a boundary.
    const steps = Math.ceil(dt / 0.016), step = dt / steps;
    for (let i = 0; i < steps; i++) this.step(input, step, road);
    this.group.rotation.set(this.pitch, this.heading, this.weightTransfer);
    for (const { pivot, tire, front } of this.group.userData.wheels) {
      pivot.rotation.y = front ? this.steering * 0.34 : 0;
      tire.rotation.x -= this.speed * dt / 0.34;
    }
  }

  step(input, dt, road) {
    this.impactRemaining = Math.max(0, this.impactRemaining - dt);
    const accelerate = input.isPressed('KeyW'), brake = input.isPressed('KeyS');
    const turn = Number(input.isPressed('KeyA')) - Number(input.isPressed('KeyD'));
    this.steering = THREE.MathUtils.damp(this.steering, turn, 2.8, dt);
    const forward = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const right = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    let longitudinal = this.velocity.dot(forward), lateral = this.velocity.dot(right);
    const s = -this.position.z, offset = this.position.x - road.centerX(s);
    this.surface = road.surfaceAt ? road.surfaceAt(this.position.x, this.position.z)
      : Math.abs(offset) > road.halfWidth ? 'DEEP_SNOW' : road.isIce(s) ? 'ICE' : 'ROAD_SNOW';
    const surface = ROAD_SURFACES[this.surface];
    this.onIce = this.surface === 'ICE'; this.snowGrip = surface.grip;
    this.acceleration = surface.acceleration; this.braking = surface.braking;
    const stress = THREE.MathUtils.clamp((Math.abs(this.steering) * Math.abs(longitudinal) - 6) / 10, 0, 0.72);
    const counterSteering = this.steering * this.yawRate < -0.025;
    const targetGrip = surface.grip * (1 - stress) + (counterSteering ? 0.12 : 0);
    // Grip breaks quickly, but takes seconds to recover after releasing or correcting a slide.
    this.traction = THREE.MathUtils.damp(this.traction, targetGrip, targetGrip < this.traction ? 3.5 : 0.65, dt);
    lateral *= Math.exp(-this.traction * 4 * dt);
    const force = brake ? (longitudinal > 0.3 ? -this.braking : -1.8) : accelerate ? this.acceleration : 0;
    const oldSpeed = longitudinal;
    longitudinal += force * dt;
    longitudinal *= Math.exp(-surface.drag * dt);
    // Deep snow slows progressively rather than instantly clamping a fast car.
    if (longitudinal > surface.maxSpeed) longitudinal = THREE.MathUtils.damp(longitudinal, surface.maxSpeed, 1.8, dt);
    longitudinal = THREE.MathUtils.clamp(longitudinal, -3, 16);
    const targetYaw = this.steering * longitudinal * 0.052;
    this.yawRate = THREE.MathUtils.damp(this.yawRate, targetYaw, this.onIce ? 1.45 : 2.4, dt);
    this.heading += this.yawRate * dt;
    this.weightTransfer = THREE.MathUtils.damp(this.weightTransfer,
      THREE.MathUtils.clamp(-this.yawRate * longitudinal * 0.007, -0.065, 0.065), 3, dt);
    this.pitch = THREE.MathUtils.damp(this.pitch, THREE.MathUtils.clamp((oldSpeed - longitudinal) / dt * 0.006, -0.025, 0.04), 3, dt);
    this.velocity.copy(forward).multiplyScalar(longitudinal).addScaledVector(right, lateral);
    this.position.addScaledVector(this.velocity, dt);
    // Vehicle footprint against snow banks, accounting for its orientation on curves.
    const nextS = -this.position.z;
    const roadHeading = -Math.atan(road.tangentX(nextS));
    const angle = this.heading - roadHeading;
    const radius = Math.abs(Math.sin(angle)) * 2.1 + Math.abs(Math.cos(angle)) * 0.95;
    const limit = road.bankWidth - radius;
    const center = road.centerX(nextS), lateralOffset = this.position.x - center;
    if (Math.abs(lateralOffset) > limit) {
      this.position.x = center + Math.sign(lateralOffset) * limit;
      this.velocity.x *= -0.15; this.velocity.z *= 0.40;
      if (this.impactRemaining === 0) this.collisions++;
      this.impactRemaining = 0.8;
    }
    if (this.position.z > 0) { this.position.z = 0; this.velocity.z = Math.min(0, this.velocity.z); }
    this.speed = this.velocity.dot(forward); this.slip = this.velocity.dot(right);
    this.lateralVelocity = this.slip;
  }
}
