import * as THREE from 'three';
import { Vehicle } from '../game/Vehicle.js';
import { Snowfall } from '../environment/Snowfall.js';
import { buildSnowForest } from '../environment/SnowForest.js';
import { VehicleCamera } from '../game/VehicleCamera.js';

// Snow forest route; cinematic variant keeps the alternative ending independent.
export class SnowRoad {
  constructor({ cinematic = false, settings = {}, length = 760 } = {}) {
    this.cinematic = cinematic; this.length = cinematic ? 180 : length; this.halfWidth = 4.7; this.bankWidth = 6.6;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x060c14);
    this.scene.fog = new THREE.Fog(0x060c14, 18, 65);
    this.vehicleCamera = new VehicleCamera(settings); this.camera = this.vehicleCamera.camera;
    this.vehicle = new Vehicle(); this.scene.add(this.vehicle.group);
    this.completed = false; this.driveEnabled = true; this.restartVersion = 0;
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
    const snow = new THREE.MeshLambertMaterial({ color: 0xb1c1ce });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, this.length + 80), snow);
    ground.rotation.x = -Math.PI / 2; ground.position.z = -this.length / 2; this.scene.add(ground);
    const cube = new THREE.BoxGeometry(1, 1, 1), matrix = new THREE.Matrix4();
    const instances = (Math.floor((this.length + 12) / 4) + 1) * 2;
    const posts = new THREE.InstancedMesh(cube, new THREE.MeshLambertMaterial({ color: 0x73828b }), instances);
    const caps = new THREE.InstancedMesh(cube, new THREE.MeshBasicMaterial({ color: 0x938b70 }), instances);
    const banks = new THREE.InstancedMesh(cube, snow, instances);
    let count = 0;
    for (let s = -8; s <= this.length + 4; s += 4) for (const side of [-1, 1]) {
      const x = this.centerX(s) + side * 6.7;
      matrix.compose(new THREE.Vector3(x, 0.55, -s), new THREE.Quaternion(), new THREE.Vector3(0.12, 1.1, 0.12)); posts.setMatrixAt(count, matrix);
      matrix.compose(new THREE.Vector3(x, 0.93, -s), new THREE.Quaternion(), new THREE.Vector3(0.15, 0.15, 0.15)); caps.setMatrixAt(count, matrix);
      matrix.compose(new THREE.Vector3(x + side * 0.35, 0.25, -s), new THREE.Quaternion(), new THREE.Vector3(0.8, 0.5, 4.1)); banks.setMatrixAt(count, matrix);
      count++;
    }
    this.scene.add(posts, caps, banks);
    this.forest = buildSnowForest(this.scene, this);
    this.scene.add(new THREE.HemisphereLight(0xabc9eb, 0x1a2639, this.cinematic ? 0.65 : 0.16));
    const moon = new THREE.DirectionalLight(0xa1c3ef, this.cinematic ? 0.5 : 0.13); moon.position.set(-10, 20, 5); this.scene.add(moon);
    const headlights = new THREE.SpotLight(0xe3e0c8, 220, 54, 0.55, 0.55, 1.3);
    this.headlights = headlights;
    headlights.position.set(0, 1.0, -1.7); headlights.target.position.set(0, 0, -18);
    this.vehicle.group.add(headlights, headlights.target);
    this.snowfall = new Snowfall(this.scene, 850, 28);
  }

  update(dt, input) {
    if (input.isJustPressed('KeyR')) this.reset();
    if (!this.completed && this.driveEnabled) {
      this.vehicle.update(input, dt, this);
      if (-this.vehicle.position.z >= this.length) {
        this.vehicle.position.z = -this.length;
        this.vehicle.velocity.set(0, 0, 0); this.vehicle.speed = 0; this.completed = true;
      }
    }
    this.snowfall.update(dt, this.vehicle.position);
    this.updateCamera(dt);
  }

  reset() {
    this.vehicle.reset(); this.completed = false; this.driveEnabled = true; this.restartVersion++;
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
