import * as THREE from 'three';

export class HospitalProps {
  constructor() {
    this.materials = {
      wall: new THREE.MeshStandardMaterial({ color: 0x8d8f8e, roughness: 0.9, metalness: 0.12 }),
      wallDark: new THREE.MeshStandardMaterial({ color: 0x6c6d6d, roughness: 0.95, metalness: 0.1 }),
      floor: new THREE.MeshStandardMaterial({ color: 0x8d8b84, roughness: 0.92, metalness: 0.08 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x98a0a8, roughness: 0.6, metalness: 0.8 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x604b3c, roughness: 0.85, metalness: 0.08 }),
      fabric: new THREE.MeshStandardMaterial({ color: 0xc7c7c2, roughness: 1, metalness: 0.04 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x5f7e95, roughness: 0.8, metalness: 0.2 }),
      accent: new THREE.MeshStandardMaterial({ color: 0x91b7bf, roughness: 0.7, metalness: 0.3 }),
      door: new THREE.MeshStandardMaterial({ color: 0x6d7175, roughness: 0.9, metalness: 0.1 }),
      glow: new THREE.MeshStandardMaterial({ color: 0xdfeaf0, emissive: 0xa8d7ef, emissiveIntensity: 0.28 }),
    };
  }

  createReceptionDesk({ position = [0, 0, 2.8], width = 4.2, depth = 1.2, height = 0.95 }) {
    const group = new THREE.Group();

    const desk = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.wood);
    desk.position.set(position[0], height / 2, position[2]);
    desk.castShadow = true;
    desk.receiveShadow = true;
    group.add(desk);

    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(width + 0.15, 0.12, depth + 0.15), this.materials.metal);
    counterTop.position.set(position[0], height + 0.08, position[2]);
    group.add(counterTop);

    const drawer = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.7), this.materials.wood);
    drawer.position.set(position[0] - 0.8, 0.34, position[2] + 0.26);
    group.add(drawer);

    return group;
  }

  createWaitingChair({ position = [0, 0, 0], rotationY = 0 }) {
    const chair = new THREE.Group();
    chair.position.set(position[0], 0, position[2]);
    chair.rotation.y = rotationY;

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.8), this.materials.fabric);
    seat.position.y = 0.55;
    chair.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.12), this.materials.fabric);
    back.position.set(0, 0.9, -0.32);
    chair.add(back);

    const leg = new THREE.BoxGeometry(0.08, 0.55, 0.08);
    const legPositions = [
      [-0.3, 0.28, -0.3],
      [0.3, 0.28, -0.3],
      [-0.3, 0.28, 0.3],
      [0.3, 0.28, 0.3],
    ];

    legPositions.forEach(([x, y, z]) => {
      const mesh = new THREE.Mesh(leg, this.materials.metal);
      mesh.position.set(x, y, z);
      chair.add(mesh);
    });

    chair.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return chair;
  }

  createMedicalBed({ position = [0, 0, 0], rotationY = 0 }) {
    const bed = new THREE.Group();
    bed.position.set(position[0], 0, position[2]);
    bed.rotation.y = rotationY;

    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.52, 0.9), this.materials.fabric);
    mattress.position.y = 0.56;
    bed.add(mattress);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(2, 0.18, 1), this.materials.metal);
    frame.position.y = 0.22;
    bed.add(frame);

    const railGeo = new THREE.BoxGeometry(0.08, 0.8, 0.08);
    const railPositions = [
      [-0.9, 0.55, -0.38],
      [0.9, 0.55, -0.38],
      [-0.9, 0.55, 0.38],
      [0.9, 0.55, 0.38],
    ];

    railPositions.forEach(([x, y, z]) => {
      const rail = new THREE.Mesh(railGeo, this.materials.metal);
      rail.position.set(x, y, z);
      bed.add(rail);
    });

    return bed;
  }

  createMedicalCart({ position = [0, 0, 0], rotationY = 0 }) {
    const cart = new THREE.Group();
    cart.position.set(position[0], 0, position[2]);
    cart.rotation.y = rotationY;

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.7), this.materials.blue);
    body.position.y = 0.75;
    cart.add(body);

    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.5), this.materials.metal);
    tray.position.set(0, 1.2, 0);
    cart.add(tray);

    const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12);
    const wheelOffsets = [
      [-0.45, 0.12, -0.26],
      [0.45, 0.12, -0.26],
      [-0.45, 0.12, 0.26],
      [0.45, 0.12, 0.26],
    ];

    wheelOffsets.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, this.materials.metal);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      cart.add(wheel);
    });

    return cart;
  }

  createCabinet({ position = [0, 0, 0], width = 1.6, height = 2.1, depth = 0.9 }) {
    const cabinet = new THREE.Group();
    cabinet.position.set(position[0], 0, position[2]);

    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.wood);
    body.position.y = height / 2;
    cabinet.add(body);

    const doorGeo = new THREE.BoxGeometry(width * 0.42, height * 0.72, 0.08);
    const leftDoor = new THREE.Mesh(doorGeo, this.materials.door);
    leftDoor.position.set(-width * 0.18, height * 0.55, depth / 2 + 0.05);
    cabinet.add(leftDoor);

    const rightDoor = leftDoor.clone();
    rightDoor.position.x = width * 0.18;
    cabinet.add(rightDoor);

    return cabinet;
  }

  createDoor({ position = [0, 0, 0], rotationY = 0, width = 1.8, height = 2.7 }) {
    const door = new THREE.Group();
    door.position.set(position[0], 0, position[2]);
    door.rotation.y = rotationY;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.22, height + 0.2, 0.18), this.materials.door);
    frame.position.y = height / 2;
    door.add(frame);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(width - 0.18, height - 0.2, 0.1), this.materials.wood);
    panel.position.y = height / 2;
    door.add(panel);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12), this.materials.metal);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(width * 0.22, height / 2, 0.12);
    door.add(handle);

    return door;
  }

  createFluorescentLight({ position = [0, 0, 0], rotationY = 0, length = 3.2 }) {
    const light = new THREE.Group();
    light.position.set(position[0], position[1], position[2]);
    light.rotation.y = rotationY;

    const bar = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, 0.18), this.materials.glow);
    bar.position.y = 0.05;
    light.add(bar);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(length + 0.2, 0.12, 0.3), this.materials.metal);
    housing.position.y = -0.04;
    light.add(housing);

    return light;
  }

  createSign({ position = [0, 0, 0], rotationY = 0, text = 'RECEPCIÓN' }) {
    const sign = new THREE.Group();
    sign.position.set(position[0], position[1], position[2]);
    sign.rotation.y = rotationY;

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.5, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xe6edf1, roughness: 0.8, emissive: 0x8ab4c5, emissiveIntensity: 0.18 })
    );
    board.position.y = 0.1;
    sign.add(board);

    const label = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.22, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x2d3740, emissive: 0x9bb7c3, emissiveIntensity: 0.25 })
    );
    label.position.set(0, 0.08, 0.07);
    sign.add(label);

    return sign;
  }

  createPaperStack({ position = [0, 0, 0] }) {
    const group = new THREE.Group();
    group.position.set(position[0], 0, position[2]);

    const paper1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.45), new THREE.MeshStandardMaterial({ color: 0xdfe4db, roughness: 0.9 }));
    paper1.position.y = 0.02;
    group.add(paper1);

    const paper2 = paper1.clone();
    paper2.position.set(0.08, 0.04, 0.05);
    paper2.scale.set(0.94, 1, 0.88);
    group.add(paper2);

    return group;
  }

  createCrate({ position = [0, 0, 0], scale = 1 }) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.8 * scale),
      new THREE.MeshStandardMaterial({ color: 0x7b6b59, roughness: 0.9 })
    );
    crate.position.set(position[0], (0.8 * scale) / 2, position[2]);
    return crate;
  }
}
