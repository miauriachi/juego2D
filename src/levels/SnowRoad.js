import * as THREE from 'three';
import { Vehicle } from '../game/Vehicle.js';
import { Snowfall } from '../environment/Snowfall.js';
import { buildSnowForest } from '../environment/SnowForest.js';
import { ForestStreaming } from '../environment/ForestStreaming.js';
import { VehicleSnowEffects } from '../environment/VehicleSnowEffects.js';
import { VehicleCamera } from '../game/VehicleCamera.js';

// Snow forest route; cinematic variant keeps the alternative ending independent.
export class SnowRoad {
  constructor({ cinematic = false, settings = {}, length = 760 } = {}) {
    this.cinematic = cinematic; this.length = cinematic ? 180 : length; this.halfWidth = 4.7; this.bankWidth = 6.6;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x0c151a);
    this.scene.fog = new THREE.Fog(0x0d171c, 5, 31);
    this.vehicleCamera = new VehicleCamera(settings); this.camera = this.vehicleCamera.camera;
    this.vehicle = new Vehicle(); this.scene.add(this.vehicle.group);
    this.completed = false; this.driveEnabled = true; this.restartVersion = 0; this.stormTime = 0; this.stormGust = 0;
    this.build(); this.updateCamera();
  }

  centerX(s) { return 6 * Math.sin(s / 32) * Math.sin(s / 80); }
  tangentX(s) { return 6 / 32 * Math.cos(s / 32) * Math.sin(s / 80) + 6 / 80 * Math.sin(s / 32) * Math.cos(s / 80); }
  isIce(s) { return (s >= 38 && s <= 60) || (s >= 105 && s <= 132) || (s >= 280 && s <= 325) || (s >= 570 && s <= 650); }
  surfaceAt(x, z) { return Math.abs(x - this.centerX(-z)) > this.halfWidth ? 'DEEP_SNOW' : this.isIce(-z) ? 'ICE' : 'ROAD_SNOW'; }

  build() {
    const vertices = [], colors = [], indices = [];
    for (let s = -12; s <= this.length + 20; s += 2) {
      const c = new THREE.Color(this.isIce(s) ? 0x637f9b : 0x91a3b4);
      for (const side of [-1, 1]) {
        vertices.push(this.centerX(s) + side * this.halfWidth, 0.015, -s);
        colors.push(c.r, c.g, c.b);
      }
      const i = vertices.length / 3 - 2;
      if (i > 0) indices.push(i - 2, i - 1, i, i - 1, i + 1, i);
    }
    const road = new THREE.BufferGeometry();
    road.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    road.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    road.setIndex(indices); road.computeVertexNormals();
    this.scene.add(new THREE.Mesh(road, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    const snow = new THREE.MeshLambertMaterial({ color: 0x748795 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, this.length + 80), snow);
    ground.rotation.x = -Math.PI / 2; ground.position.z = -this.length / 2; this.scene.add(ground);
    const cube = new THREE.BoxGeometry(1, 1, 1), matrix = new THREE.Matrix4();
    const roadsideStep = 9;
    const instances = (Math.floor((this.length + 18) / roadsideStep) + 2) * 2;
    const posts = new THREE.InstancedMesh(cube, new THREE.MeshLambertMaterial({ color: 0x394b56 }), instances);
    const caps = new THREE.InstancedMesh(cube, new THREE.MeshBasicMaterial({ color: 0x8b8167 }), instances);
    const banks = new THREE.InstancedMesh(cube, snow, instances);
    let count = 0;
    for (let s = -8; s <= this.length + 4; s += roadsideStep) for (const side of [-1, 1]) {
      const x = this.centerX(s) + side * 6.7;
      matrix.compose(new THREE.Vector3(x, 0.38, -s), new THREE.Quaternion(), new THREE.Vector3(0.08, 0.76, 0.08)); posts.setMatrixAt(count, matrix);
      matrix.compose(new THREE.Vector3(x, 0.66, -s), new THREE.Quaternion(), new THREE.Vector3(0.11, 0.10, 0.11)); caps.setMatrixAt(count, matrix);
      matrix.compose(new THREE.Vector3(x + side * 0.28, 0.12, -s), new THREE.Quaternion(), new THREE.Vector3(0.58, 0.24, 3.3)); banks.setMatrixAt(count, matrix);
      count++;
    }
    this.scene.add(posts, caps, banks);

    // Irregular roadside snow banks make the corridor feel half-buried instead
    // of bordered by two clean geometric strips.
    const driftGeometry = new THREE.IcosahedronGeometry(1, 1);
    const driftMaterial = new THREE.MeshLambertMaterial({ color: 0x7f919d, fog: true });
    const driftCount = (Math.floor((this.length + 24) / 8) + 2) * 2;
    const drifts = new THREE.InstancedMesh(driftGeometry, driftMaterial, driftCount);
    let driftIndex = 0;
    for (let s = -10, slot = 0; s <= this.length + 12; s += 8, slot++) {
      for (const side of [-1, 1]) {
        const a = ((slot * 0.61803398875 + (side > 0 ? 0.21 : 0.67)) % 1);
        const b = ((slot * 0.41421356237 + (side > 0 ? 0.43 : 0.13)) % 1);
        const x = this.centerX(s) + side * (5.85 + a * 1.15);
        const z = -s + (b - 0.5) * 2.8;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), b * Math.PI);
        matrix.compose(
          new THREE.Vector3(x, 0.06 + b * 0.08, z),
          q,
          new THREE.Vector3(1.25 + a * 1.35, 0.32 + b * 0.28, 1.9 + a * 1.8),
        );
        drifts.setMatrixAt(driftIndex++, matrix);
      }
    }
    drifts.count = driftIndex;
    drifts.instanceMatrix.needsUpdate = true;
    drifts.name = 'roadside-snow-drifts';
    this.scene.add(drifts);

    const proceduralForest = buildSnowForest(this.scene, this);
    this.forest = new ForestStreaming(this.scene, this, proceduralForest);
    this.scene.add(new THREE.HemisphereLight(0xabc9eb, 0x1a2639, this.cinematic ? 0.65 : 0.16));
    const moon = new THREE.DirectionalLight(0xa1c3ef, this.cinematic ? 0.5 : 0.13); moon.position.set(-10, 20, 5); this.scene.add(moon);
    const headlights = new THREE.SpotLight(0xe3e0c8, 252, 46, 0.60, 0.68, 1.32);
    this.headlights = headlights;
    headlights.position.set(0, 1.0, -1.7); headlights.target.position.set(0, -0.05, -20);
    this.vehicle.group.add(headlights, headlights.target);
    this.snowfall = new Snowfall(this.scene, 5200, 38, {
      size: 0.15,
      opacity: 0.90,
      height: 16,
      windX: 4.6,
      windZ: 1.8,
      fallSpeed: 3.2,
      windVariance: 0.55,
      color: 0xdce7ef,
      renderOrder: 12,
    });
    this.snowfront = new Snowfall(this.scene, 1650, 20, {
      size: 0.34,
      opacity: 0.66,
      height: 11,
      windX: 6.4,
      windZ: 2.5,
      fallSpeed: 4.4,
      windVariance: 0.75,
      color: 0xffffff,
      streak: true,
      renderOrder: 18,
    });

    // Low drifting snow stays close to the vehicle and hides the exact road
    // edges during strong gusts, which makes the driving feel more hostile.
    this.groundSnow = new Snowfall(this.scene, 2400, 18, {
      size: 0.19,
      opacity: 0.54,
      height: 2.6,
      windX: 8.2,
      windZ: 3.6,
      fallSpeed: 0.65,
      windVariance: 0.95,
      color: 0xe8f0f5,
      streak: true,
      renderOrder: 20,
    });

    // Mid-height crosswind: this is the white curtain that periodically hides
    // trunks, road edges and distant shapes during the strongest gusts.
    this.crossSnow = new Snowfall(this.scene, 2200, 24, {
      size: 0.24,
      opacity: 0.52,
      height: 7.5,
      windX: 10.5,
      windZ: 5.0,
      fallSpeed: 2.1,
      windVariance: 1.10,
      color: 0xf5f8fa,
      streak: true,
      renderOrder: 21,
    });

    this.vehicleSnow = new VehicleSnowEffects(this.scene, this.vehicle);
  }

  update(dt, input) {
    if (input.isJustPressed('KeyR')) this.reset();
    this.stormTime += Math.max(0, dt);
    const gustA = 0.5 + 0.5 * Math.sin(this.stormTime * 0.36);
    const gustB = 0.5 + 0.5 * Math.sin(this.stormTime * 0.91 + 1.7);
    this.stormGust = THREE.MathUtils.clamp(gustA * 0.62 + gustB * 0.38, 0, 1);
    if (!this.completed && this.driveEnabled) {
      this.vehicle.update(input, dt, this);
      if (-this.vehicle.position.z >= this.length) {
        this.vehicle.position.z = -this.length;
        this.vehicle.velocity.set(0, 0, 0); this.vehicle.speed = 0; this.completed = true;
      }
    }
    this.updateWeather(dt, this.vehicle.position);
    this.updateCamera(dt);
  }

  updateWeather(dt, center = this.vehicle.position) {
    // Gusts vary visually but never change vehicle physics. Keeping this in one
    // method lets the exact same storm continue after Bryan exits the car.
    this.snowfall.windX = 4.8 + this.stormGust * 3.8;
    this.snowfall.windZ = 1.8 + this.stormGust * 1.6;
    this.snowfall.points.material.opacity = 0.78 + this.stormGust * 0.19;
    this.snowfront.windX = 7.0 + this.stormGust * 6.5;
    this.snowfront.windZ = 2.6 + this.stormGust * 2.8;
    this.snowfront.points.material.opacity = 0.52 + this.stormGust * 0.39;
    this.groundSnow.windX = 8.5 + this.stormGust * 8.0;
    this.groundSnow.windZ = 3.8 + this.stormGust * 3.3;
    this.groundSnow.points.material.opacity = 0.42 + this.stormGust * 0.43;
    this.crossSnow.windX = 10.0 + this.stormGust * 9.5;
    this.crossSnow.windZ = 4.5 + this.stormGust * 5.2;
    this.crossSnow.points.material.opacity = 0.36 + this.stormGust * 0.48;

    // Whiteout moments aggressively collapse the draw distance, hiding the
    // exact forest recycling in the same spirit as classic fog-heavy horror.
    this.scene.fog.far = THREE.MathUtils.lerp(31, 19, this.stormGust * 0.90);
    this.headlights.distance = THREE.MathUtils.lerp(44, 33, this.stormGust * 0.80);
    this.headlights.intensity = THREE.MathUtils.lerp(258, 286, this.stormGust * 0.65);

    this.snowfall.update(dt, center);
    this.snowfront?.update(dt, center);
    this.groundSnow?.update(dt, center);
    this.crossSnow?.update(dt, center);
    this.vehicleSnow?.update(dt, this.stormGust);
    this.forest?.update(dt, this.vehicle);
  }

  reset() {
    this.vehicle.reset(); this.completed = false; this.driveEnabled = true; this.restartVersion++;
    this.stormTime = 0; this.stormGust = 0;
    this.vehicleSnow?.reset();
    this.vehicleCamera.initialized = false; this.vehicleCamera.shake = 0;
  }

  updateCamera(dt = 0) { this.vehicleCamera.update(dt, this.vehicle, this); }

  get objectiveText() {
    return this.completed ? 'TRAMO NEVADO COMPLETADO'
      : 'OBJETIVO: Viaja rumbo a Raccoon City.';
  }

  get hintText() {
    if (this.completed) return '[R] Repetir tramo';
    const v = this.vehicle;
    return Math.round(Math.abs(v.speed) * 3.6) + ' km/h · W/S pedal · A/D volante · R reiniciar';
  }

  onResize() { this.vehicleCamera.onResize(); }
}