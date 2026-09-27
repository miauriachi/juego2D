import * as THREE from 'three';
import { DEBUG_MODE, SHOW_CEILING } from '../config/constants.js';
import { applyHospitalArtPass } from '../environment/HospitalArtPass.js';

export class HospitalIntro {
  constructor(scene, player, cameraManager, collisionSystem) {
    this.scene = scene;
    this.player = player;
    this.cameraManager = cameraManager;
    this.collisionSystem = collisionSystem;
    // Shared resources for the active hospital's visual details.
    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.wheelGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
    this.materials = {
      metal: new THREE.MeshStandardMaterial({ color: 0x8e9d99, roughness: 0.67, metalness: 0.45 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x303b39, roughness: 0.85 }),
      vinyl: new THREE.MeshStandardMaterial({ color: 0x49665d, roughness: 0.88 }),
      enamel: new THREE.MeshStandardMaterial({ color: 0xb4c0b3, roughness: 0.86 }),
      linen: new THREE.MeshStandardMaterial({ color: 0xc5c9b9, roughness: 1 }),
      paper: new THREE.MeshStandardMaterial({ color: 0xd9d3b8, roughness: 1 }),
      red: new THREE.MeshStandardMaterial({ color: 0x853e34, roughness: 0.84 }),
      glow: new THREE.MeshStandardMaterial({ color: 0xd4e5da, emissive: 0xb5d2cd, emissiveIntensity: 1.3 }),
    };
    this.debugGroup = new THREE.Group();
    this.ceilingGroup = new THREE.Group();
    this.scene.add(this.debugGroup);
    this.scene.add(this.ceilingGroup);
  }

  createLabelSprite(text, color = '#d4dfcd') {
    // A physical, depth-tested placard, rather than a billboard visible through walls.
    const map = this.createCanvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#263f38';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#8e9e89';
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = color;
      ctx.font = 'bold 54px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2, w - 40);
    }, 512, 128);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.45),
      new THREE.MeshStandardMaterial({ map, roughness: 0.9, side: THREE.DoubleSide })
    );
    sign.name = 'sign:' + text;
    return sign;
  }

  createCanvasTexture(paint, width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  createBox(size, position, material, parent = this.scene) {
    const mesh = new THREE.Mesh(this.boxGeometry, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  createWheel(parent, x, y, z, radius = 0.09, width = 0.06) {
    const wheel = new THREE.Mesh(this.wheelGeometry, this.materials.dark);
    wheel.scale.set(radius, width, radius);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    parent.add(wheel);
  }

  createWallMaterial(length, height = 3.2) {
    if (!this.wallTexture) {
      this.wallTexture = this.createCanvasTexture((ctx, w, h) => {
        ctx.fillStyle = '#c5cec1';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#657f70';
        ctx.fillRect(0, h * 0.62, w, h * 0.38);
        ctx.fillStyle = '#3e554b';
        ctx.fillRect(0, h * 0.615, w, h * 0.022);
        ctx.fillStyle = '#35423d';
        ctx.fillRect(0, h * 0.95, w, h * 0.05);
        for (let i = 0; i < 1200; i++) {
          const x = (i * 71.17) % w, y = (i * 43.73) % h;
          ctx.fillStyle = i % 3 ? 'rgba(35,47,36,0.045)' : 'rgba(222,223,198,0.16)';
          ctx.fillRect(x, y, 1 + i % 7, 1 + i % 3);
        }
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = 'rgba(39,53,40,0.065)';
          ctx.fillRect((i * 43) % w, h * 0.64, 2 + i % 4, 15 + i * 5);
        }
      }, 256, 512);
    }
    const map = this.wallTexture.clone();
    map.wrapS = THREE.RepeatWrapping;
    map.repeat.set(length / 2, height / 3.2);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.96 });
  }

  createChair(position, rotationY = 0) {
    const group = new THREE.Group();
    group.name = 'waiting-chair';
    this.createBox([0.52, 0.09, 0.5], [0, 0.47, 0], this.materials.vinyl, group);
    this.createBox([0.52, 0.42, 0.07], [0, 0.73, -0.22], this.materials.vinyl, group);
    for (const x of [-0.22, 0.22]) {
      for (const z of [-0.2, 0.2]) {
        this.createBox([0.035, 0.44, 0.035], [x, 0.22, z], this.materials.metal, group);
      }
    }
    group.position.set(position.x, 0, position.z);
    group.rotation.y = rotationY;
    return group;
  }

  createSmallTable(position, rotationY = 0) {
    const group = new THREE.Group();
    this.createBox([1.05, 0.07, 0.65], [0, 0.58, 0], this.materials.enamel, group);
    for (const x of [-0.43, 0.43]) {
      for (const z of [-0.24, 0.24]) {
        this.createBox([0.04, 0.55, 0.04], [x, 0.275, z], this.materials.dark, group);
      }
    }
    group.position.set(position.x, 0, position.z);
    group.rotation.y = rotationY;
    return group;
  }

  createMedicalBed(position, rotationY = 0) {
    const group = new THREE.Group();
    group.name = 'medical-stretcher';
    this.createBox([2.05, 0.1, 0.75], [0, 0.63, 0], this.materials.metal, group);
    this.createBox([1.95, 0.14, 0.7], [0, 0.75, 0], this.materials.linen, group);
    this.createBox([0.42, 0.09, 0.5], [-0.65, 0.86, 0], this.materials.paper, group);
    for (const x of [-0.8, 0.8]) {
      this.createBox([0.045, 0.48, 0.6], [x, 0.37, 0], this.materials.metal, group);
      for (const z of [-0.3, 0.3]) this.createWheel(group, x, 0.1, z, 0.1);
    }
    for (const z of [-0.38, 0.38]) {
      this.createBox([1.6, 0.035, 0.035], [0, 0.98, z], this.materials.metal, group);
      for (const x of [-0.75, 0.75]) {
        this.createBox([0.025, 0.3, 0.025], [x, 0.82, z], this.materials.metal, group);
      }
    }
    group.position.set(position.x, 0, position.z);
    group.rotation.y = rotationY;
    return group;
  }

  createWheelchair(position, rotationY = 0) {
    const group = new THREE.Group();
    group.name = 'wheelchair';
    this.createBox([0.46, 0.065, 0.44], [0, 0.5, 0], this.materials.vinyl, group);
    this.createBox([0.46, 0.43, 0.065], [0, 0.74, -0.21], this.materials.vinyl, group);
    for (const x of [-0.29, 0.29]) {
      this.createWheel(group, x, 0.3, -0.13, 0.3, 0.045);
      this.createWheel(group, x, 0.075, 0.3, 0.075, 0.035);
      this.createBox([0.025, 0.62, 0.025], [x, 0.55, -0.22], this.materials.metal, group);
      this.createBox([0.04, 0.04, 0.4], [x, 0.71, 0], this.materials.dark, group);
    }
    this.createBox([0.4, 0.04, 0.22], [0, 0.17, 0.38], this.materials.metal, group);
    group.position.set(position.x, 0, position.z);
    group.rotation.y = rotationY;
    return group;
  }

  createMedicalCart(position, rotationY = 0) {
    const group = new THREE.Group();
    group.name = 'medical-cart';
    this.createBox([0.68, 0.52, 0.43], [0, 0.47, 0], this.materials.enamel, group);
    this.createBox([0.75, 0.045, 0.5], [0, 0.86, 0], this.materials.metal, group);
    for (const x of [-0.3, 0.3]) {
      for (const z of [-0.19, 0.19]) {
        this.createBox([0.025, 0.72, 0.025], [x, 0.45, z], this.materials.metal, group);
        this.createWheel(group, x, 0.08, z, 0.08);
      }
    }
    this.createBox([0.26, 0.07, 0.18], [0.08, 0.92, 0], this.materials.paper, group);
    this.createBox([0.19, 0.02, 0.025], [0, 0.58, 0.23], this.materials.dark, group);
    group.position.set(position.x, 0, position.z);
    group.rotation.y = rotationY;
    return group;
  }

  createCabinet(position, rotationY = 0) {
    const group = new THREE.Group();
    group.name = 'metal-cabinet';
    this.createBox([0.9, 1.8, 0.42], [0, 0.9, 0], this.materials.enamel, group);
    for (const x of [-0.22, 0.22]) {
      this.createBox([0.41, 1.54, 0.025], [x, 0.97, 0.225], this.materials.metal, group);
      this.createBox([0.025, 0.14, 0.03], [x * 0.3, 1.05, 0.25], this.materials.dark, group);
    }
    const label = this.createLabelSprite('MATERIAL CLÍNICO');
    label.scale.setScalar(0.35);
    label.position.set(0, 1.62, 0.243);
    group.add(label);
    group.position.set(position.x, 0, position.z);
    group.rotation.y = rotationY;
    return group;
  }

  createTrashBin(position, rotationY = 0) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.5, 20),
      new THREE.MeshStandardMaterial({ color: 0x4a5458, roughness: 0.9, metalness: 0.1 })
    );
    body.position.y = 0.25;
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.06, 20),
      new THREE.MeshStandardMaterial({ color: 0x5c666e, roughness: 0.8, metalness: 0.18 })
    );
    lid.position.y = 0.53;
    group.add(body, lid);
    group.position.set(position.x, 0, position.z);
    group.rotation.y = rotationY;
    return group;
  }

  createDispenser(position, rotationY = 0) {
    const group = new THREE.Group();
    group.name = 'water-dispenser';
    this.createBox([0.38, 0.88, 0.36], [0, 0.44, 0], this.materials.enamel, group);
    this.createBox([0.28, 0.22, 0.02], [0, 0.62, 0.19], this.materials.dark, group);
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.15, 0.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x6c929a, roughness: 0.35, metalness: 0.15 })
    );
    bottle.position.y = 1.08;
    group.add(bottle);
    this.createBox([0.04, 0.045, 0.07], [0, 0.68, 0.23], this.materials.metal, group);
    group.position.set(position.x, 0, position.z);
    group.rotation.y = rotationY;
    return group;
  }

  createExtinguisher(position, rotationY = 0) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.55, 18),
      this.materials.red
    );
    body.position.y = 0.4;
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.08, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x4d5a62, roughness: 0.7, metalness: 0.2 })
    );
    handle.position.set(0.09, 0.7, 0);
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x7e8b91, roughness: 0.7, metalness: 0.2 })
    );
    nozzle.rotation.z = Math.PI / 2;
    nozzle.position.set(0.25, 0.58, 0);
    group.add(body, handle, nozzle);
    group.position.set(position.x, 0, position.z);
    group.rotation.y = rotationY;
    return group;
  }

  createDoorFrame(position, rotationY = 0, number = '') {
    const group = new THREE.Group();
    group.name = 'false-door';
    for (const x of [-0.64, 0.64]) {
      this.createBox([0.09, 2.25, 0.14], [x, 1.125, 0], this.materials.dark, group);
    }
    this.createBox([1.37, 0.09, 0.14], [0, 2.25, 0], this.materials.dark, group);
    this.createBox([1.18, 2.15, 0.06], [0, 1.075, 0], this.materials.enamel, group);
    this.createBox([1.08, 0.27, 0.02], [0, 0.23, 0.043], this.materials.metal, group);
    this.createBox([0.23, 0.035, 0.07], [0.4, 1.03, 0.085], this.materials.dark, group);
    if (number) {
      const label = this.createLabelSprite(number);
      label.scale.setScalar(0.3);
      label.position.set(0, 1.65, 0.048);
      group.add(label);
    }
    group.position.set(position.x, 0, position.z);
    group.rotation.y = rotationY;
    return group;
  }

  build() {
    this.buildFloor();
    this.buildWalls();
    this.buildCeiling();
    this.buildReceptionDesk();
    this.buildAdmissionDetails();
    this.buildWaitingArea();
    this.buildHallwayVisuals();
    this.buildMedicalProps();
    this.buildOverheadDetails();
    applyHospitalArtPass(this);
    this.buildDebugVisuals();
  }

  buildFloor() {
    const map = this.createCanvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#505c55';
      ctx.fillRect(0, 0, w, h);
      const tile = w / 8;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const shade = 145 + ((row * 13 + col * 7) % 19);
          ctx.fillStyle = `rgb(${shade},${shade + 5},${shade - 4})`;
          ctx.fillRect(col * tile + 2, row * tile + 2, tile - 4, tile - 4);
          ctx.strokeStyle = 'rgba(220,226,205,0.15)';
          ctx.strokeRect(col * tile + 3, row * tile + 3, tile - 6, tile - 6);
        }
      }
      for (let i = 0; i < 14000; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(38,47,37,0.06)' : 'rgba(220,219,195,0.1)';
        ctx.fillRect((i * 73.13) % w, (i * 37.71) % h, 1 + i % 3, 1);
      }
      for (let i = 0; i < 18; i++) {
        const x = (i * 137) % w, y = (i * 211) % h;
        ctx.strokeStyle = 'rgba(46,52,41,0.20)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y + 11);
        ctx.lineTo(x + 5, y + 19); ctx.stroke();
      }
    }, 1024, 1024);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    // Eight 50 cm tiles per 4 m repeat: exact square tiles over the 24 x 16 m floor.
    map.repeat.set(6, 4);
    const floorBase = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.25, 16),
      new THREE.MeshStandardMaterial({ color: 0x59645b, roughness: 1 })
    );
    floorBase.position.y = -0.125;
    floorBase.receiveShadow = true;
    this.scene.add(floorBase);
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 16),
      new THREE.MeshStandardMaterial({ map, roughness: 0.88, metalness: 0.03 })
    );
    surface.name = 'tiled-floor';
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.002;
    surface.receiveShadow = true;
    this.scene.add(surface);
  }

  buildCeiling() {
    this.ceilingGroup.clear();

    if (!SHOW_CEILING) {
      this.ceilingGroup.visible = false;
      return;
    }

    this.ceilingGroup.visible = true;
    const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xc4c9c5, roughness: 0.9, metalness: 0.08 });
    const ceilingSections = [
      { size: [10.5, 0.12, 5.4], pos: [-5.8, 3.2, 0] },
      { size: [10.5, 0.12, 5.4], pos: [5.8, 3.2, 0] },
      { size: [22, 0.12, 3.4], pos: [0, 3.2, -6.1] },
      { size: [22, 0.12, 3.4], pos: [0, 3.2, 6.1] },
      { size: [3.6, 0.12, 5.1], pos: [-10.6, 3.2, -2.2] },
      { size: [3.6, 0.12, 5.1], pos: [10.6, 3.2, -2.2] },
    ];

    ceilingSections.forEach(({ size, pos }) => {
      const section = new THREE.Mesh(new THREE.BoxGeometry(...size), ceilingMaterial);
      section.position.set(...pos);
      section.receiveShadow = true;
      this.ceilingGroup.add(section);
    });
  }

  buildWalls() {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xa7b3a8, roughness: 0.96, metalness: 0.06 });
    const lowerWallMaterial = new THREE.MeshStandardMaterial({ color: 0x7f8d82, roughness: 0.96, metalness: 0.06 });
    const wallThickness = 0.25;
    const wallHeight = 3.2;

    const wallDefinitions = [
      { size: [wallThickness, wallHeight, 16], pos: [-12, wallHeight / 2, 0], material: wallMaterial },
      { size: [wallThickness, wallHeight, 16], pos: [12, wallHeight / 2, 0], material: wallMaterial },
      { size: [9.2, wallHeight, wallThickness], pos: [-4.4, wallHeight / 2, -8], material: lowerWallMaterial },
      { size: [6.6, wallHeight, wallThickness], pos: [9.7, wallHeight / 2, -8], material: lowerWallMaterial },
      { size: [8.2, wallHeight, wallThickness], pos: [-10.3, wallHeight / 2, 8], material: lowerWallMaterial },
      { size: [8.2, wallHeight, wallThickness], pos: [10.3, wallHeight / 2, 8], material: lowerWallMaterial },
    ];

    wallDefinitions.forEach(({ size, pos }) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(...size), this.createWallMaterial(Math.max(size[0], size[2])));
      wall.position.set(...pos);
      wall.receiveShadow = true;
      this.scene.add(wall);

      // Register each wall segment separately, preserving the existing door gaps.
      this.collisionSystem.addCollider({
        minX: pos[0] - size[0] / 2,
        maxX: pos[0] + size[0] / 2,
        minZ: pos[2] - size[2] / 2,
        maxZ: pos[2] + size[2] / 2,
      });


    });

    const receptionWall = new THREE.Mesh(
      new THREE.BoxGeometry(7, 2.8, 0.2),
      this.createWallMaterial(7, 2.8)
    );
    receptionWall.position.set(-6, 1.4, 2.7);
    this.scene.add(receptionWall);
    this.collisionSystem.addCollider({ minX: -9.5, maxX: -2.5, minZ: 2.6, maxZ: 2.8 });
  }

  buildReceptionDesk() {
    const woodMap = this.createCanvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#625849'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 240; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(26,30,22,0.12)' : 'rgba(182,162,112,0.13)';
        ctx.fillRect((i * 47) % w, 0, 1 + i % 4, h);
      }
      for (let i = 0; i < 45; i++) {
        ctx.fillStyle = 'rgba(194,184,143,0.24)';
        ctx.fillRect((i * 71) % w, h - (i * 13) % 60, 2 + i % 13, 2);
      }
    });
    const wood = new THREE.MeshStandardMaterial({ map: woodMap, roughness: 0.92 });
    const topMaterial = new THREE.MeshStandardMaterial({ color: 0x515b50, roughness: 0.72 });
    const deskBase = this.createBox([6.2, 1.05, 0.8], [-6, 0.52, 1], wood);
    deskBase.name = 'reception-desk';
    this.createBox([6.4, 0.16, 1.1], [-6, 1.06, 1], topMaterial);
    // The countertop footprint also covers the narrower desk base.
    this.collisionSystem.addCollider({ minX: -9.2, maxX: -2.8, minZ: 0.45, maxZ: 1.55 });
    this.createBox([2.2, 1.2, 0.95], [-8.6, 0.6, 1.1], wood);
    this.collisionSystem.addCollider({ minX: -9.7, maxX: -7.5, minZ: 0.625, maxZ: 1.575 });
    this.createBox([6.15, 0.1, 0.015], [-6, 0.12, 0.593], this.materials.dark);

    // Compact beige CRT, supported by its base, with a dim green screen.
    this.createBox([0.32, 0.07, 0.26], [-5.3, 1.175, 1.07], this.materials.enamel);
    this.createBox([0.48, 0.38, 0.4], [-5.3, 1.4, 1.08], this.materials.enamel);
    const screen = this.createCanvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#132e29'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#6b9b7c'; ctx.font = '18px monospace';
      ctx.fillText('HOSPITAL / ADMISION', 18, 35);
      ctx.fillText('REGISTRO  0081', 18, 73);
      for (let i = 0; i < 4; i++) ctx.fillRect(18, 105 + i * 23, 100 + i * 16, 3);
    }, 256, 256);
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.27),
      new THREE.MeshStandardMaterial({ map: screen, emissiveMap: screen, emissive: 0xffffff, emissiveIntensity: 0.35 }));
    screenMesh.position.set(-5.3, 1.41, 1.285);
    this.scene.add(screenMesh);
    const keyMap = this.createCanvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#b1b3a0'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#565e53';
      for (let row = 0; row < 4; row++) for (let col = 0; col < 12; col++) {
        ctx.fillRect(8 + col * 20, 6 + row * 13, 16, 9);
      }
    }, 256, 64);
    this.createBox([0.46, 0.03, 0.16], [-5.3, 1.16, 1.40],
      new THREE.MeshStandardMaterial({ map: keyMap, roughness: 0.86 }));
    this.createBox([0.22, 0.065, 0.18], [-3.5, 1.18, 0.83], this.materials.dark);
    this.createBox([0.27, 0.055, 0.065], [-3.5, 1.24, 0.85], this.materials.dark);
    for (let i = 0; i < 3; i++) {
      const paper = this.createBox([0.21, 0.008, 0.297], [-6.7 + i * 0.04, 1.15 + i * 0.008, 0.88], this.materials.paper);
      paper.rotation.y = i * 0.12;
    }
    for (const x of [-9.1, -8.35]) {
      this.createBox([0.66, 1.35, 0.42], [x, 0.675, 2.28], this.materials.enamel);
      for (let row = 0; row < 3; row++) {
        this.createBox([0.59, 0.38, 0.025], [x, 0.25 + row * 0.42, 2.055], this.materials.metal);
        this.createBox([0.16, 0.025, 0.04], [x, 0.32 + row * 0.42, 2.026], this.materials.dark);
      }
    }
    const counterSign = this.createLabelSprite('RECEPCIÓN');
    counterSign.position.set(-6.1, 2.22, 2.811);
    this.scene.add(counterSign);
    const insideSign = this.createLabelSprite('RECEPCIÓN');
    insideSign.position.set(-6.1, 2.22, 2.589);
    insideSign.rotation.y = Math.PI;
    this.scene.add(insideSign);
  }

  buildWaitingArea() {
    // Keep the entrance and the central route to the hallway visually clear.
    const chairs = [
      { x: -11, z: 4.1, rotation: Math.PI / 2 },
      { x: -11, z: 5.3, rotation: Math.PI / 2 },
      { x: -11, z: 6.5, rotation: Math.PI / 2 },
      { x: -9.5, z: 7, rotation: Math.PI },
      { x: -8.3, z: 7, rotation: Math.PI },
      { x: -7.1, z: 7, rotation: Math.PI },
    ];
    chairs.forEach(({ x, z, rotation }) => this.scene.add(this.createChair({ x, z }, rotation)));
    this.scene.add(this.createSmallTable({ x: -9.2, z: 5.2 }));
    const magazineMap = this.createCanvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#b3b39a'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#39574f'; ctx.fillRect(12, 12, w - 24, 70);
      ctx.fillStyle = '#d4d5b8'; ctx.font = 'bold 27px Arial'; ctx.fillText('SALUD', 25, 58);
      ctx.fillStyle = '#788e7d'; ctx.fillRect(20, 105, w - 40, 105);
      ctx.fillStyle = '#5c6254';
      for (let i = 0; i < 6; i++) ctx.fillRect(20, 230 + i * 12, w - 55, 3);
    }, 256, 352);
    const magazineMat = new THREE.MeshStandardMaterial({ map: magazineMap, roughness: 1 });
    const magazine = this.createBox([0.21, 0.015, 0.29], [-9.38, 0.623, 5.18], magazineMat);
    magazine.rotation.y = -0.15;
    this.createBox([0.21, 0.008, 0.297], [-9.02, 0.62, 5.26], this.materials.paper);
    this.scene.add(this.createTrashBin({ x: -6.65, z: 7.1 }));
  }

  buildAdmissionDetails() {
    // Keep the clerk's face and the central service position clear.
    const noticeMap = this.createCanvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#554b3c'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const x = 20 + (i % 3) * 155, y = 20 + Math.floor(i / 3) * 235;
        ctx.fillStyle = i % 2 ? '#b7c5b7' : '#d0c7a7'; ctx.fillRect(x, y, 130, 205);
        ctx.fillStyle = '#495950'; ctx.font = 'bold 15px Arial'; ctx.fillText(i % 2 ? 'TURNOS' : 'AVISO', x + 12, y + 26);
        for (let n = 0; n < 7; n++) ctx.fillRect(x + 12, y + 52 + n * 16, 90 - n % 3 * 12, 3);
      }
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.05),
      new THREE.MeshStandardMaterial({ map: noticeMap, roughness: 1 }));
    board.position.set(-3.65, 1.95, 2.585); board.rotation.y = Math.PI; this.scene.add(board);
    const deskSign = this.createLabelSprite('ADMISIÓN · INFORMES');
    deskSign.scale.setScalar(0.57); deskSign.position.set(-6.1, 0.73, 0.583);
    deskSign.rotation.y = Math.PI; this.scene.add(deskSign);
    for (const x of [-8.9, -7.2, -4.5, -3.1]) {
      this.createBox([0.025, 0.72, 0.026], [x, 0.6, 0.578], this.materials.dark);
    }
    // Stacked document trays and folders use the existing countertop footprint.
    for (let i = 0; i < 3; i++) {
      this.createBox([0.36, 0.025, 0.28], [-7.5, 1.17 + i * 0.085, 1], this.materials.dark);
      this.createBox([0.28, 0.018, 0.23], [-7.5, 1.19 + i * 0.085, 1], this.materials.paper);
    }
    this.createBox([0.10, 0.12, 0.10], [-6.35, 1.20, 1.22], this.materials.vinyl);
    for (let i = 0; i < 3; i++) this.createBox([0.009, 0.17, 0.009], [-6.38 + i * 0.025, 1.29, 1.22], this.materials.dark);
    const form = this.createCanvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#d2cbb6'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#46564c';
      ctx.font = 'bold 22px Arial'; ctx.fillText('ADMISIÓN', 18, 35);
      for (let n = 0; n < 9; n++) ctx.fillRect(18, 65 + n * 22, w - 36, 2);
    }, 256, 320);
    const clipboard = this.createBox([0.24, 0.015, 0.33], [-5.95, 1.155, 0.8], this.materials.dark);
    const formMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), new THREE.MeshStandardMaterial({ map: form, roughness: 1 }));
    formMesh.rotation.x = -Math.PI / 2; formMesh.position.set(clipboard.position.x, 1.165, 0.8); this.scene.add(formMesh);
    // Frame the waiting room edge rather than scatter props in navigation paths.
    this.scene.add(this.createSmallTable({ x: -10.9, z: 0.7 }));
    for (let i = 0; i < 4; i++) this.createBox([0.22, 0.045, 0.3], [-10.9, 0.64 + i * 0.045, 0.7], i % 2 ? this.materials.paper : this.materials.vinyl);
  }

  buildHallwayVisuals() {
    // Finish the south wall around the existing interactive doorway, not across it.
    for (const x of [-3.875, 3.875]) {
      this.createBox([4.65, 3.2, 0.25], [x, 1.6, 8], this.createWallMaterial(4.65));
      this.collisionSystem.addCollider({ minX: x - 2.325, maxX: x + 2.325, minZ: 7.875, maxZ: 8.125 });
    }
    this.createBox([3.1, 0.7, 0.25], [0, 2.85, 8], this.createWallMaterial(3.1, 0.7));
    this.createBox([3.2, 0.025, 1.8], [0, 0.018, 6.75], this.materials.dark);
    // Closed double exit; the existing interaction system performs the outdoor transition.
    const exit = new THREE.Group(); exit.name = 'hospital-exit-door';
    for (const x of [-1.5, 1.5]) this.createBox([0.10, 2.45, 0.18], [x, 1.225, 0], this.materials.dark, exit);
    this.createBox([3.1, 0.1, 0.18], [0, 2.45, 0], this.materials.dark, exit);
    this.entranceHinges = [];
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group(); hinge.position.x = side * 1.45; exit.add(hinge);
      const x = -side * 0.72;
      this.createBox([1.38, 2.30, 0.08], [x, 1.15, 0], this.materials.vinyl, hinge);
      this.createBox([1.04, 0.88, 0.015], [x, 1.65, -0.05], this.materials.dark, hinge);
      this.createBox([0.8, 0.04, 0.06], [x, 1.03, -0.085], this.materials.metal, hinge);
      this.entranceHinges.push(hinge);
    }
    exit.position.set(0, 0, 7.95); this.scene.add(exit);
    this.collisionSystem.addCollider({ minX: -1.55, maxX: 1.55, minZ: 7.90, maxZ: 8.04 });
    // This double door is now an interaction portal to a real playable room.
    const door = new THREE.Group(); door.name = 'urgencias-access';
    for (const side of [-1, 1]) {
      this.createBox([0.10, 2.45, 0.18], [side * 1.24, 1.225, 0], this.materials.dark, door);
      this.createBox([1.15, 2.3, 0.08], [side * 0.59, 1.15, 0], this.materials.vinyl, door);
      this.createBox([0.47, 0.55, 0.02], [side * 0.59, 1.68, 0.055], this.materials.dark, door);
      this.createBox([0.65, 0.045, 0.10], [side * 0.59, 1.02, 0.10], this.materials.metal, door);
      this.createBox([1.09, 0.29, 0.025], [side * 0.59, 0.22, 0.055], this.materials.metal, door);
    }
    this.createBox([2.58, 0.10, 0.18], [0, 2.45, 0], this.materials.dark, door);
    door.position.set(3.3, 0, -7.95); this.scene.add(door);
    // Close the old unfinished opening around the interactive door, preserving
    // all existing wall/counter footprints and keeping the NPC corridor clear.
    for (const x of [1.1, 5.5]) {
      this.createBox([1.8, 3.2, 0.25], [x, 1.6, -8], this.createWallMaterial(1.8));
      this.collisionSystem.addCollider({ minX: x - 0.9, maxX: x + 0.9, minZ: -8.125, maxZ: -7.875 });
    }
    this.collisionSystem.addCollider({ minX: 2, maxX: 4.6, minZ: -8, maxZ: -7.91 });
    // False doors sit on solid wall segments, never across the real perimeter gaps.
    this.scene.add(
      this.createDoorFrame({ x: -7.4, z: -7.8 }, 0, '101'),
      this.createDoorFrame({ x: -4.5, z: -7.8 }, 0, '102'),
      this.createDoorFrame({ x: 8.6, z: -7.8 }, 0, '103'),
      this.createDoorFrame({ x: -11.79, z: -3.7 }, Math.PI / 2, 'PERSONAL'),
      this.createDoorFrame({ x: 11.79, z: -4.9 }, -Math.PI / 2, '104')
    );
    const signs = [
      { text: '← RECEPCIÓN', position: [-1.1, 2.45, -7.858], rotation: 0 },
      { text: 'URGENCIAS', position: [3.3, 2.7, -7.86], rotation: 0 },
      { text: 'PERSONAL', position: [-11.85, 2.65, -3.7], rotation: Math.PI / 2 },
      { text: 'SALIDA →', position: [0, 2.65, 7.86], rotation: Math.PI },
    ];
    signs.forEach(({ text, position, rotation }) => {
      const sign = this.createLabelSprite(text);
      sign.position.set(...position);
      sign.rotation.y = rotation;
      this.scene.add(sign);
    });
    // Small suspension rods only; no panels or jambs in the walkable gaps.
    for (const [x, z] of [[3.3, -7.86], [0, 7.86]]) {
      for (const offset of [-0.65, 0.65]) {
        this.createBox([0.015, 0.22, 0.015], [x + offset, 3.02, z], this.materials.dark);
      }
    }
  }

  buildMedicalProps() {
    this.scene.add(this.createMedicalBed({ x: -1.8, z: -6.5 }, 0.08));
    this.scene.add(this.createWheelchair({ x: 6.9, z: -6.8 }, -0.5));
    this.scene.add(this.createMedicalCart({ x: 10.8, z: -1.3 }, -Math.PI / 2));
    this.scene.add(this.createCabinet({ x: -11.4, z: -1.3 }, Math.PI / 2));
    this.scene.add(this.createDispenser({ x: -11.45, z: 2.8 }, Math.PI / 2));
    this.scene.add(this.createExtinguisher({ x: 11.55, z: 2.8 }, -Math.PI / 2));
    const fireSign = this.createLabelSprite('EXTINTOR', '#e4c8ab');
    fireSign.scale.setScalar(0.4);
    fireSign.position.set(11.85, 1.55, 2.8);
    fireSign.rotation.y = -Math.PI / 2;
    this.scene.add(fireSign);
  }

  buildOverheadDetails() {
    // Thin fixtures leave the open ceiling and all fixed-camera sightlines intact.
    for (const [x, z] of [[-6, 0], [-9, 5.2], [2.5, -5.5], [8.5, -5.5]]) {
      this.createBox([1.3, 0.06, 0.22], [x, 3.08, z], this.materials.dark);
      for (const offset of [-0.055, 0.055]) {
        this.createBox([1.18, 0.025, 0.025], [x, 3.035, z + offset], this.materials.glow);
      }
    }
    this.createBox([0.045, 0.045, 12], [-11.68, 2.94, 0], this.materials.metal);
    this.createBox([0.045, 0.045, 12], [-11.55, 2.94, 0], this.materials.metal);
  }

  buildDebugVisuals() {
    this.debugGroup.visible = DEBUG_MODE;
    if (!DEBUG_MODE) return;
    // Display the actual registered footprints; camera zones remain owned by CameraManager.
    const material = new THREE.MeshBasicMaterial({ color: 0xffb35c, wireframe: true });
    this.collisionSystem.colliders.forEach(({ minX, maxX, minZ, maxZ }) => {
      const box = new THREE.Mesh(this.boxGeometry, material);
      box.scale.set(maxX - minX, 1.2, maxZ - minZ);
      box.position.set((minX + maxX) / 2, 0.6, (minZ + maxZ) / 2);
      box.name = 'collider-debug';
      this.debugGroup.add(box);
    });
  }

}
