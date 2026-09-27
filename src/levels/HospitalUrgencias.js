import * as THREE from 'three';
import { HospitalIntro } from './HospitalIntro.js';
import { NPCManager } from '../game/NPCManager.js';
import { DEBUG_MODE, PLAYER_RADIUS } from '../config/constants.js';
import { applyHospitalArtPass } from '../environment/HospitalArtPass.js';

// Authored 22 x 38 m emergency block. Furniture helpers remain shared with reception.
export class HospitalUrgencias extends HospitalIntro {
  build() {
    this.actorConfigs = [];
    this.collisionSystem.bounds = {
      minX: -11 + PLAYER_RADIUS, maxX: 11 - PLAYER_RADIUS,
      minZ: -32 + PLAYER_RADIUS, maxZ: 6 - PLAYER_RADIUS,
    };
    const map = this.createCanvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#495653'; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#929f98' : '#abb1a1';
        ctx.fillRect(x * 64 + 1, y * 64 + 1, 62, 62);
        ctx.fillStyle = 'rgba(37,45,39,.09)';
        ctx.fillRect(x * 64 + 9, y * 64 + 49, 34, 2);
      }
    });
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(5.5, 9.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 38),
      new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
    floor.name = 'tiled-floor-urgencias';
    floor.rotation.x = -Math.PI / 2; floor.position.z = -13;
    floor.receiveShadow = true; this.scene.add(floor);
    this.wall([22, 3.2, 0.2], [0, 1.6, -32]);
    this.wall([22, 3.2, 0.2], [0, 1.6, 6]);
    for (const side of [-1, 1]) this.wall([0.2, 3.2, 38], [side * 11, 1.6, -13]);
    this.scene.add(this.createDoorFrame({ x: 0, z: 5.85 }, Math.PI, 'RECEPCIÓN'));

    const names = ['OBSERVACIÓN 01', 'ESPERA', 'CUBÍCULO 02', 'CUBÍCULO 03', 'TRATAMIENTO', 'OBSERVACIÓN 04'];
    for (let row = 0; row < 3; row++) {
      const z = 1 - row * 10;
      for (const [i, side] of [-1, 1].entries()) {
        // Two segments leave a 2.4 m real doorway into each room.
        for (const offset of [-3.1, 3.1])
          this.wall([0.2, 3.2, 3.8], [side * 2.5, 1.6, z + offset]);
        this.wall([8.5, 3.2, 0.2], [side * 6.75, 1.6, z - 5]);
        for (const offset of [-1.2, 1.2])
          this.createBox([0.24, 2.35, 0.08], [side * 2.5, 1.175, z + offset], this.materials.dark);
        this.createBox([0.24, 0.1, 2.48], [side * 2.5, 2.38, z], this.materials.dark);
        this.sign(names[row * 2 + i], [side * 2.36, 2.65, z], -side * Math.PI / 2, 0.9);
        this.sign(names[row * 2 + i], [side * 6.75, 2.4, z - 4.88]);
        this.room(row, side, z);
        this.cameraManager.addZone({
          id: 'urg-room-' + row + '-' + i, name: names[row * 2 + i],
          cameraPosition: [side * 7.4, 7.2, z + 5.2], lookAt: [side * 6.5, 0.8, z + 0.2],
          minX: side < 0 ? -11 : 2.6, maxX: side < 0 ? -2.6 : 11,
          minZ: z - 5, maxZ: z + 5, priority: 2, color: 0x9aaabb,
        });
      }
      this.cameraManager.addZone({
        id: 'urg0' + (row + 1), name: 'URGENCIAS - PASILLO ' + (row + 1),
        cameraPosition: row === 0 ? [1.2, 6.7, z + 4.8] : [1.7, 5.8, z + 6.2],
        lookAt: row === 0 ? [0, 0.6, z + 0.5] : [-0.2, 0.8, z + 0.2],
        minX: -2.6, maxX: 2.6, minZ: z - 5, maxZ: z + 5,
        priority: 1, color: 0x78a7b6,
      });
      this.sign('CONTROL MÉDICO ↑', [0, 2.7, z - 3.5], 0, 0.8);
      // Floor guide is paint, not an obstacle.
      this.createBox([0.10, 0.004, 9.5], [1.5, 0.003, z], this.materials.vinyl);
    }
    this.station();
    this.actorConfigs.push(
      { name: 'Doctora de guardia', type: 'Doctor', walkSpeed: 1.25, initialWait: 2,
        waypoints: [{ x: -1.25, z: 1 }, { x: -1.25, z: -20 }] },
      { name: 'Enfermera de Urgencias', type: 'Nurse', walkSpeed: 1.2, phase: 1.4,
        waypoints: [{ x: 1.25, z: -20 }, { x: 1.25, z: -4 }] },
      { name: 'Paciente acompañado', type: 'PatientStanding', walkSpeed: 0.65, initialWait: 3,
        waypoints: [{ x: -7.8, z: -20.5 }, { x: -5.2, z: -20.5 }] },
      { name: 'Enfermero acompañante', type: 'Orderly', walkSpeed: 0.65, initialWait: 3,
        waypoints: [{ x: -7.8, z: -21.5 }, { x: -5.2, z: -21.5 }] },
      { name: 'Doctor responsable', type: 'ChiefDoctor', walkSpeed: 0, facing: Math.PI,
        waypoints: [{ x: 0, z: -27.4 }] },
    );
    this.npcManager = new NPCManager(this.scene, this.collisionSystem, this.actorConfigs);
    this.chiefDoctor = this.npcManager.npcs.find(npc => npc.type === 'ChiefDoctor');
    applyHospitalArtPass(this, true);
    this.cameraManager.setDebugVisibility(DEBUG_MODE);
    this.buildDebugVisuals();
    if (DEBUG_MODE) {
      const grid = new THREE.GridHelper(40, 40); grid.position.set(0, 0.015, -13); this.scene.add(grid);
    }
  }

  wall(size, position) {
    this.createBox(size, position, this.createWallMaterial(Math.max(size[0], size[2])));
    return this.obstacle(position[0], position[2], size[0], size[2]);
  }

  obstacle(x, z, width, depth) {
    this.collisionSystem.addCollider({
      minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2,
    });
    return this.collisionSystem.colliders[this.collisionSystem.colliders.length - 1];
  }

  sign(text, position, rotation = 0, scale = 1) {
    const sign = this.createLabelSprite(text);
    sign.position.set(...position); sign.rotation.y = rotation; sign.scale.setScalar(scale);
    this.scene.add(sign);
  }

  chair(x, z, occupied = false) {
    this.scene.add(this.createChair({ x, z }, Math.PI));
    const supportCollider = this.obstacle(x, z, 0.56, 0.56);
    if (occupied) this.actorConfigs.push({
      name: 'Paciente sentado ' + this.actorConfigs.length, type: 'PatientSitting',
      walkSpeed: 0, phase: this.actorConfigs.length * 1.7,
      waypoints: [{ x, z }], supportCollider,
    });
  }

  bed(x, z, occupied = true) {
    this.scene.add(this.createMedicalBed({ x, z }, Math.PI / 2));
    const supportCollider = this.obstacle(x, z, 0.85, 2.1);
    if (occupied) {
      this.actorConfigs.push({
        name: 'Paciente en camilla ' + this.actorConfigs.length, type: 'PatientLying',
        walkSpeed: 0, elevation: 1.0, facing: 0, phase: this.actorConfigs.length,
        waypoints: [{ x, z: z - 0.86 }], supportCollider,
      });
      this.createBox([0.65, 0.065, 0.66], [x, 1.11, z - 0.38], this.materials.linen);
    }
    // Bedside rail, IV pole and hanging bag, with no per-patient light.
    this.createBox([0.025, 1.9, 0.025], [x - 0.62, 0.95, z + 0.65], this.materials.metal);
    this.createBox([0.3, 0.025, 0.025], [x - 0.48, 1.88, z + 0.65], this.materials.metal);
    this.createBox([0.14, 0.23, 0.045], [x - 0.36, 1.71, z + 0.65], this.materials.enamel);
  }

  room(row, side, z) {
    const x = side * 7.7;
    if (row === 0 && side === 1) {
      for (const seatX of [5, 6.2, 7.4, 8.6]) this.chair(seatX, z + 3.8, seatX !== 7.4);
      this.scene.add(this.createSmallTable({ x: 7.5, z }));
      this.obstacle(7.5, z, 1.05, 0.65);
      for (let i = 0; i < 3; i++)
        this.createBox([0.22, 0.015, 0.3], [7.2 + i * 0.2, 0.63 + i * 0.01, z], this.materials.paper);
      this.scene.add(this.createDispenser({ x: 10.4, z: z + 2.4 }, -Math.PI / 2));
      this.obstacle(10.4, z + 2.4, 0.4, 0.4);
    } else if (row === 2 && side === -1) {
      this.bed(-9, z + 2.5, false);
      this.chair(-5, z + 3.5);
      this.scene.add(this.createWheelchair({ x: -8.7, z: z - 3.5 }));
      this.obstacle(-8.7, z - 3.5, 0.75, 0.85);
    } else {
      this.bed(x, z);
      this.chair(side * 5, z + 3.5, row === 1);
      if (row === 0) {
        this.actorConfigs.push({ name: 'Enfermera de observación', type: 'Nurse', walkSpeed: 0,
          facing: -Math.PI / 2, waypoints: [{ x: x - 1.4, z: z + 0.3 }] });
      }
      // Short privacy screen at the rear leaves the doorway and bed approach open.
      this.createBox([2.2, 1.65, 0.06], [x, 1.12, z - 2.5], this.materials.vinyl);
      for (const dx of [-1.05, 1.05])
        this.createBox([0.035, 2.05, 0.035], [x + dx, 1.025, z - 2.5], this.materials.metal);
      this.obstacle(x, z - 2.5, 2.2, 0.10);
    }
    const cabinetX = side * 10.35;
    this.scene.add(this.createCabinet({ x: cabinetX, z: z - 3.6 }, -side * Math.PI / 2));
    this.obstacle(cabinetX, z - 3.6, 0.5, 0.95);
    this.scene.add(this.createMedicalCart({ x: side * 4.4, z: z - 3.6 }));
    this.obstacle(side * 4.4, z - 3.6, 0.8, 0.55);
    this.fixture(side * 6.7, z);
  }

  fixture(x, z) {
    this.createBox([1.3, 0.045, 0.18], [x, 3.07, z], this.materials.enamel);
    this.createBox([1.15, 0.025, 0.12], [x, 3.035, z], this.materials.glow);
  }

  station() {
    this.sign('ESTACIÓN MÉDICA / PERSONAL', [0, 2.55, -31.88], 0, 1.4);
    this.createBox([4.4, 1.04, 0.85], [3.5, 0.52, -29.5], this.materials.vinyl);
    this.createBox([4.5, 0.09, 0.95], [3.5, 1.085, -29.5], this.materials.enamel);
    this.obstacle(3.5, -29.5, 4.5, 0.95);
    this.createBox([0.45, 0.36, 0.38], [4.3, 1.32, -29.5], this.materials.enamel);
    this.createBox([0.34, 0.24, 0.012], [4.3, 1.33, -29.70], this.materials.dark);
    for (let i = 0; i < 4; i++) this.createBox([0.22, 0.012, 0.3],
      [2.1 + i * 0.3, 1.14 + i * 0.006, -29.4], this.materials.paper);
    for (const x of [-8.5, -7.3]) {
      this.scene.add(this.createCabinet({ x, z: -31.5 })); this.obstacle(x, -31.5, 0.95, 0.5);
    }
    this.bed(-7, -27.2, true);
    this.chair(8.5, -30.5);
    for (const z of [2, -7, -17, -27]) this.fixture(0, z);
    this.cameraManager.addZone({
      id: 'urg04', name: 'URGENCIAS - ESTACIÓN MÉDICA',
      cameraPosition: [0, 10.4, -22.5], lookAt: [0, 0.6, -28.5],
      minX: -11, maxX: 11, minZ: -32, maxZ: -24,
      priority: 1, color: 0xa99ebc,
    });
    this.cameraManager.addZone({
      id: 'urg-doctor', name: 'URGENCIAS - DOCTOR RESPONSABLE',
      cameraPosition: [3.2, 2.9, -24.2], lookAt: [0, 1.1, -27.4],
      minX: -1.8, maxX: 1.8, minZ: -29, maxZ: -25.3,
      priority: 4, color: 0xd7ad7b,
    });
  }

  update(dt) { this.npcManager.update(dt); }
}
