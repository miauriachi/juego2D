import * as THREE from 'three';

// Presentation attached to the real car; no vehicle forces or controller changes.
export class CarInterior {
  constructor(car, player, woman) {
    Object.assign(this, { car, player, woman }); this.group = new THREE.Group(); this.group.name = 'carInterior'; car.add(this.group);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const add = (size, pos, color, parent = this.group) => {
      const mesh = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color })); mesh.scale.set(...size); mesh.position.set(...pos); parent.add(mesh); return mesh;
    };
    // Replace only the opaque placeholder glass shell with individual windows.
    car.children.filter(o => o.isMesh && Math.abs(o.scale.x - 1.58) < 0.001 && Math.abs(o.scale.y - 0.66) < 0.001).forEach(o => { o.visible = false; });
    const glass = new THREE.MeshLambertMaterial({ color: 0xacc5d2, transparent: true, opacity: 0.11, depthWrite: false, side: THREE.DoubleSide });
    for (const z of [-0.94, 1.13]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.53), glass); pane.position.set(0, 1.14, z); this.group.add(pane);
    }
    for (const x of [-0.79, 0.79]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.53), glass); pane.rotation.y = Math.PI / 2; pane.position.set(x, 1.14, 0.1); this.group.add(pane);
    }
    for (const x of [-0.4, 0.4]) {
      add([0.56, 0.13, 0.6], [x, 0.56, 0.35], 0x24313a);
      add([0.56, 0.54, 0.14], [x, 0.88, 0.65], 0x24313a);
    }
    add([1.48, 0.16, 0.4], [0, 0.84, -0.66], 0x18242a);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.023, 6, 16), new THREE.MeshLambertMaterial({ color: 0x131c21 }));
    wheel.position.set(-0.4, 0.98, -0.39); wheel.rotation.x = -0.35; this.group.add(wheel); this.wheel = wheel;
    add([0.08, 0.1, 0.04], [0, 1.4, -0.58], 0x242b2e);
    add([0.40, 0.16, 0.05], [0, 1.34, -0.57], 0x17232c);
    this.mirrorTarget = new THREE.WebGLRenderTarget(256, 128);
    this.mirrorTarget.texture.repeat.x = -1; this.mirrorTarget.texture.offset.x = 1;
    const mirrorMaterial = new THREE.MeshBasicMaterial({ map: this.mirrorTarget.texture });
    this.mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.125), mirrorMaterial);
    this.mirror.position.set(0, 1.34, -0.539); this.group.add(this.mirror);
    this.mirrorCamera = new THREE.PerspectiveCamera( 45, 2, 0.15, 140);
    this.camera = new THREE.PerspectiveCamera(84, innerWidth / innerHeight, 0.035, 180);
    this.camera.name = 'CAM_INTERIOR_CAR';
    this.passengerDoor = new THREE.Group(); this.passengerDoor.position.set(0.91, 0.72, -0.8); car.add(this.passengerDoor);
    add([0.07, 0.72, 1.35], [0, 0, 0.67], 0x374e57, this.passengerDoor);
    this.light = new THREE.PointLight(0x8daac1, 0.9, 3, 2); this.light.position.set(0, 1.38, 0); this.group.add(this.light);
  }
  seatWoman() {
    this.car.add(this.woman); this.woman.name = 'passengerWoman'; this.woman.pose = 'seated';
    this.woman.userData.state = 'WOMAN_IN_CAR'; this.woman.position.set(0.39, 0.07, 0.12);
    this.woman.rotation.set(0, 0, 0); this.woman.scale.setScalar(0.87); this.woman.visible = true; this.woman.animate(0, 0);
  }
  seatBryan() {
    this.car.add(this.player.group); this.player.position.set(-0.39, -0.22, 0.14);
    this.player.group.rotation.set(0, 0, 0); this.player.group.scale.setScalar(0.87); this.player.group.visible = true;
    // Unrigged GLB stays intact; supplemental sleeves hold the wheel during the interior shot.
    if (this.driverArms) { this.driverArms.visible = true; return; }
    this.driverArms = new THREE.Group(); this.group.add(this.driverArms);
    const sleeve = new THREE.MeshLambertMaterial({ color: 0x263038 });
    for (const x of [-0.54, -0.25]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.4, 6), sleeve);
      arm.position.set(x, 1.0, -0.22); arm.rotation.x = Math.PI / 2; this.driverArms.add(arm);
    }
  }
  unseatBryan(scene, position) {
    scene.add(this.player.group); this.player.group.scale.setScalar(1); this.player.group.rotation.set(0, this.car.rotation.y, 0);
    this.player.rotationY = this.car.rotation.y; this.player.position.copy(position); this.player.position.y = 0;
    this.player.previousPosition.copy(this.player.position); this.player.velocity.set(0, 0, 0); this.player.group.visible = true;
    if (this.driverArms) this.driverArms.visible = false;
  }
  update(dt, agitation = 0) {
    this.time = (this.time || 0) + dt; this.woman.animate(dt, 0);
    this.woman.head.rotation.y = agitation * 0.9;
    this.woman.torso.scale.z = 1 + Math.sin(this.time * (3 + agitation * 3)) * 0.018;
    // Her left arm reaches deliberately toward the driver's face.
    this.car.updateMatrixWorld(true);
    const face = this.player.group.localToWorld(new THREE.Vector3(0, 1.64, -0.04));
    const direction = this.woman.body.worldToLocal(face).sub(this.woman.arms[0].position).normalize();
    const reach = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
    this.woman.arms[0].quaternion.slerp(reach, agitation);
    this.woman.forearms[0].rotation.x = 0.5 * (1 - agitation);
    this.player.group.rotation.z = agitation * 0.08;
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.car.updateMatrixWorld(true);
    this.camera.position.copy(this.car.localToWorld(new THREE.Vector3(0.08, 1.27, 1.06)));
    this.camera.lookAt(this.car.localToWorld(new THREE.Vector3(-0.04, 1.12, -0.45)));
    this.mirrorCamera.position.copy(this.car.localToWorld(new THREE.Vector3(0, 1.35, 2.3)));
    this.mirrorCamera.lookAt(this.car.localToWorld(new THREE.Vector3(0, 1.15, 45)));
  }
  renderMirror(renderer, scene) {
    const target = renderer.getRenderTarget(); this.mirror.visible = false;
    renderer.setRenderTarget(this.mirrorTarget); renderer.render(scene, this.mirrorCamera);
    renderer.setRenderTarget(target); this.mirror.visible = true;
  }
}
