import * as THREE from 'three';
import { HospitalIntro } from './HospitalIntro.js';
import { createCar } from '../game/Vehicle.js';
import { Snowfall } from '../environment/Snowfall.js';
import { DEBUG_MODE, PLAYER_RADIUS } from '../config/constants.js';

export class HospitalExterior extends HospitalIntro {
  build() {
    this.scene.background = new THREE.Color(0x101925);
    this.scene.fog = new THREE.Fog(0x101925, 18, 48);
    this.collisionSystem.bounds = {
      minX: -12 + PLAYER_RADIUS, maxX: 12 - PLAYER_RADIUS,
      minZ: -10 + PLAYER_RADIUS, maxZ: 14 - PLAYER_RADIUS,
    };
    const snow = new THREE.MeshLambertMaterial({ color: 0xa3b6c8 });
    const stone = new THREE.MeshLambertMaterial({ color: 0x566979 });
    this.createBox([26, 0.2, 26], [0, -0.1, 2], snow);
    const obstacle = (size, pos, mat) => {
      this.createBox(size, pos, mat);
      this.collisionSystem.addCollider({ minX: pos[0] - size[0] / 2, maxX: pos[0] + size[0] / 2,
        minZ: pos[2] - size[2] / 2, maxZ: pos[2] + size[2] / 2 });
    };
    obstacle([24, 4.2, 0.5], [0, 2.1, -10], stone);
    obstacle([0.2, 0.45, 24], [-12, 0.225, 2], snow);
    // A visible driveway gap accommodates the scripted departure.
    obstacle([0.2, 0.45, 5], [12, 0.225, -7.5], snow);
    obstacle([0.2, 0.45, 13], [12, 0.225, 7.5], snow);
    this.createBox([16, 0.15, 6], [20, -0.075, -2], snow);
    obstacle([24, 0.45, 0.2], [0, 0.225, 14], snow);
    for (const x of [-1.5, 1.5]) this.createBox([0.14, 2.5, 0.25], [x, 1.25, -9.68], this.materials.dark);
    this.createBox([3.15, 0.14, 0.25], [0, 2.5, -9.68], this.materials.dark);
    for (const x of [-0.72, 0.72]) {
      this.createBox([1.36, 2.36, 0.06], [x, 1.18, -9.69], this.materials.vinyl);
      this.createBox([0.95, 1.0, 0.015], [x, 1.62, -9.65], this.materials.dark);
      this.createBox([0.6, 0.04, 0.06], [x, 1.02, -9.60], this.materials.metal);
    }
    const sign = this.createLabelSprite('HOSPITAL / ACCESO');
    sign.position.set(0, 3.12, -9.70); sign.scale.setScalar(1.7); this.scene.add(sign);
    this.createBox([4.3, 0.16, 1.8], [0, 3.65, -9], snow);
    for (const x of [-9, -6, 6, 9]) {
      this.createBox([1.7, 1.1, 0.04], [x, 2.25, -9.72], this.materials.dark);
    }
    // Parking paint stays flat; the central walking route remains clear.
    for (const x of [-9, -6, 3, 6, 9])
      this.createBox([0.065, 0.008, 5.0], [x, 0.01, 5], this.materials.paper);
    this.car = createCar(); this.car.position.set(5, 0, 5); this.scene.add(this.car);
    this.collisionSystem.addCollider({ minX: 4.05, maxX: 5.95, minZ: 2.85, maxZ: 7.15 });
    this.scene.add(new THREE.HemisphereLight(0xbad1ed, 0x1c2532, 0.85));
    const moon = new THREE.DirectionalLight(0xa8c5ed, 0.8); moon.position.set(-8, 15, 3); this.scene.add(moon);
    for (const [x, z] of [[-9.5, -5], [9.5, -5], [9.5, 10.5]]) {
      obstacle([0.13, 4.8, 0.13], [x, 2.4, z], this.materials.dark);
      this.createBox([0.5, 0.12, 0.5], [x, 4.8, z], this.materials.glow);
      const lamp = new THREE.PointLight(0xc8dcf1, 20, 12, 2); lamp.position.set(x, 4.5, z); this.scene.add(lamp);
    }
    this.cameraManager.addZone({
      id: 'ext01', name: 'EXTERIOR - HOSPITAL', cameraPosition: [14, 11, 5], lookAt: [0, 0.8, -5],
      minX: -12, maxX: 12, minZ: -10, maxZ: 0, priority: 1, color: 0x92b4d8,
    });
    this.cameraManager.addZone({
      id: 'ext02', name: 'EXTERIOR - ESTACIONAMIENTO', cameraPosition: [-14, 13, 19], lookAt: [0, 0.8, 6],
      minX: -12, maxX: 12, minZ: 0, maxZ: 14, priority: 2, color: 0xd1d8e3,
    });
    this.cameraManager.setDebugVisibility(DEBUG_MODE);
    const carZone = this.cameraManager.addZone({
      id: 'ext03', name: 'EXTERIOR - AUTO DE BRYAN',
      cameraPosition: [-2.5, 6.5, 11.5], lookAt: [5, 0.8, 5],
      minX: 1, maxX: 8, minZ: 1, maxZ: 9, priority: 3, color: 0xbbcdda,
    });
    carZone.setDebugVisible(DEBUG_MODE);
    this.buildDebugVisuals();
    if (DEBUG_MODE) this.scene.add(new THREE.GridHelper(26, 26));
    this.snowfall = new Snowfall(this.scene);
  }

  update(dt, player) { this.snowfall.update(dt, player.position); }
}
