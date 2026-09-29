import * as THREE from 'three';
import { PatrolAftermathSequence } from './PatrolAftermathSequence.js';
import { CollisionSystem } from './CollisionSystem.js';
import { POST_IMPACT as STATE } from './PostImpactState.js';

// Second accident, independently scripted. Never changes the original pedestrian-impact brake.
export class PoliceCrashSequence {
  constructor(drive) {
    Object.assign(this, { drive, game: drive.game, road: drive.road, police: drive.police, vehicle: drive.vehicle });
    this.time = 0; this.audioTime = 0; this.exitTime = null;
    this.start = this.police.group.position.clone(); this.startHeading = this.police.group.rotation.y;
    this.crashS = -this.start.z + 14; this.parkS = this.crashS - 6.5;
    this.target = new THREE.Vector3(this.road.centerX(this.crashS) - 10.5, 0, -this.crashS);
    this.clearAccidentArea(); this.drive.transition(STATE.POLICE_CRASH);
    this.drive.conversation.start([{ speaker: 'BRYAN', text: '¡Mierda!', duration: 2.5 }]);
    const snow = new THREE.MeshLambertMaterial({ color: 0x9eafbf });
    const lip = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), snow);
    lip.scale.set(1.6, 0.35, 2.3); lip.position.set(this.target.x + 2.5, 0, this.target.z + 4); this.road.scene.add(lip);
    const parking = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 8), new THREE.MeshLambertMaterial({ color: 0x9eafbd, transparent: true, opacity: 0.45 }));
    parking.rotation.x = -Math.PI / 2; parking.position.set(this.road.centerX(this.parkS) + 3.1, 0.025, -this.parkS); this.road.scene.add(parking);
    this.parkingPatch = parking;
  }
  clearAccidentArea() {
    // Remove only instanced scenery in the left-side landing/walking corridor.
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    this.road.scene.traverse(mesh => {
      if (!mesh.isInstancedMesh) return;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
        const s = -position.z, center = this.road.centerX(s);
        if (s > this.crashS - 14 && s < this.crashS + 65 && position.x > center - 16 && position.x < center + 8) {
          matrix.makeScale(0, 0, 0); mesh.setMatrixAt(i, matrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    });
  }
  setupOnFoot() {
    const g = this.game, v = this.vehicle, scene = this.road.scene;
    this.collision = new CollisionSystem();

    // Build the walkable aftermath area around the ACTUAL positions of both
    // vehicles. The old fixed rectangle could create an invisible wall between
    // Bryan and the overturned patrol.
    v.group.updateMatrixWorld(true);
    this.police.group.updateMatrixWorld(true);
    const carBox = new THREE.Box3().setFromObject(v.group);
    const patrolBox = new THREE.Box3().setFromObject(this.police.group);

    this.collision.bounds = {
      minX: Math.min(carBox.min.x, patrolBox.min.x) - 10,
      maxX: Math.max(carBox.max.x, patrolBox.max.x) + 10,
      minZ: Math.min(carBox.min.z, patrolBox.min.z) - 12,
      maxZ: Math.max(carBox.max.z, patrolBox.max.z) + 12,
    };

    for (const box of [carBox, patrolBox]) {
      this.collision.addCollider({
        minX: box.min.x,
        maxX: box.max.x,
        minZ: box.min.z,
        maxZ: box.max.z,
      });
    }

    // Spawn Bryan beside his sedan on the side nearest the patrol, regardless
    // of how the car ended up rotated when he parked.
    const carCenter = carBox.getCenter(new THREE.Vector3());
    const patrolCenter = patrolBox.getCenter(new THREE.Vector3());
    const towardPatrol = patrolCenter.clone().sub(carCenter).setY(0);

    if (towardPatrol.lengthSq() < 0.0001) {
      towardPatrol.set(-Math.sin(v.heading), 0, -Math.cos(v.heading));
    } else {
      towardPatrol.normalize();
    }

    const carHalf = carBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const edgeX = Math.abs(towardPatrol.x) > 0.0001
      ? carHalf.x / Math.abs(towardPatrol.x)
      : Infinity;
    const edgeZ = Math.abs(towardPatrol.z) > 0.0001
      ? carHalf.z / Math.abs(towardPatrol.z)
      : Infinity;
    const edgeDistance = Math.min(edgeX, edgeZ);

    this.exitPosition = carCenter
      .clone()
      .addScaledVector(towardPatrol, edgeDistance + 1.05);
    this.exitPosition.y = 0;

    this.drive.interior.unseatBryan(scene, this.exitPosition);

    // Face Bryan toward the wreck immediately after he gets out.
    const facePatrol = patrolCenter.clone().sub(this.exitPosition).setY(0);
    if (facePatrol.lengthSq() > 0.0001) {
      g.player.rotationY = Math.atan2(-facePatrol.x, -facePatrol.z);
      g.player.group.rotation.y = g.player.rotationY;
    }

    g.player.group.visible = false; this.exitTime = 0;
    this.exitCamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    this.exitCamera.position.copy(
      this.exitPosition.clone()
        .addScaledVector(towardPatrol, -5.5)
        .add(new THREE.Vector3(0, 3.2, 0)),
    );
    this.exitCamera.lookAt(this.exitPosition.clone().setY(0.8));
    this.wreckCamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    this.wreckCamera.position.copy(this.target).add(new THREE.Vector3(5, 3.5, 6)); this.wreckCamera.lookAt(this.target.clone().add(new THREE.Vector3(1, 0.8, 0)));
    this.drive.transition(STATE.INVESTIGATE_POLICE); g.container.classList.remove('driving-mode'); g.input.keys.clear();
    g.audio?.playCue('door_open'); this.parkingPatch.visible = false;
  }
  update(dt) {
    if (this.aftermath) { this.aftermath.update(dt); return; }
    const g = this.game, v = this.vehicle; this.time += dt; this.audioTime -= dt;
    if (this.time <= 6) {
      const t = Math.min(1, this.time / 6), leave = THREE.MathUtils.smoothstep(t, 0, 0.55), roll = THREE.MathUtils.smoothstep(t, 0.35, 1);
      this.police.group.position.lerpVectors(this.start, this.target, leave);
      this.police.group.position.z = THREE.MathUtils.lerp(this.start.z, this.target.z, t);
      this.police.group.position.y = Math.sin(roll * Math.PI) * 1.4 + roll;
      this.police.group.rotation.set(0, this.startHeading + leave * 0.75, roll * Math.PI * 1.5);
      if (t > 0.38 && !this.hit) { this.hit = true; g.audio?.impact(); this.road.vehicleCamera.shake = 0.4; }
    } else if (!this.landed) {
      this.landed = true; this.police.group.position.copy(this.target).setY(1);
      this.police.group.rotation.set(0, this.startHeading + 0.75, Math.PI * 1.5);
      this.police.group.updateMatrixWorld(true); this.police.group.position.y += 0.04 - new THREE.Box3().setFromObject(this.police.group).min.y;
      this.drive.transition(STATE.PARK_BEFORE_POLICE);
    }
    this.police.flash(dt, true); this.drive.conversation.update(dt);
    if (this.audioTime <= 0) {
      this.audioTime = 4.5; g.audio?.playCue('winter_wind'); g.audio?.playCue('engine');
      g.audio?.playCue('police_siren'); g.audio?.playCue('distant_branches');
    }
    let camera = this.road.camera;
    if (this.drive.state !== STATE.INVESTIGATE_POLICE) {
      v.update(g.input, dt, this.road); this.road.updateCamera(dt);
      const distance = this.parkS + v.position.z;
      const parked = this.landed && Math.abs(distance) <= 1.5 && Math.abs(v.speed) < 0.3 && v.velocity.length() < 0.4;
      g.objective.textContent = 'OBJETIVO: Detente y revisa la patrulla.';
      g.dialogueManager.setHint(parked ? '[E] Salir del auto' : distance >= 0 ? `Zona para detenerse: ${Math.ceil(distance)} m` : `Retrocede ${Math.ceil(-distance)} m hasta la zona segura`);
      if (parked && g.input.isJustPressed('KeyE')) { v.velocity.set(0, 0, 0); v.speed = 0; this.setupOnFoot(); }
    }
    if (this.drive.state === STATE.INVESTIGATE_POLICE) {
      const p = g.player;
      if (this.exitTime < 1.8) {
        this.exitTime += dt; g.forestSequence.level.hinge.rotation.y = -Math.sin(Math.min(1, this.exitTime / 1.8) * Math.PI);
        p.group.visible = this.exitTime > 0.6;
        if (this.exitTime >= 1.8) { g.audio?.playCue('door_close'); g.input.keys.clear(); }
      } else if (!this.inspectionReached) {
        p.update(g.input, dt); this.collision.resolve(p); p.animate(dt);
        this.police.group.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(this.police.group);
        if (bounds.distanceToPoint(p.position.clone().setY(0.7)) < 1.4) {
          this.inspectionReached = true; this.aftermath = new PatrolAftermathSequence(this);
          this.aftermath.update(0); return;
        }
      } else { p.previousPosition.copy(p.position); p.velocity.set(0, 0, 0); p.animate(dt, true); }
      camera = p.position.distanceTo(this.target) < 9 ? this.wreckCamera : this.exitCamera;
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      g.objective.textContent = 'OBJETIVO: Revisa la patrulla.'; g.dialogueManager.setHint('');
    }
    this.road.snowfall.update(dt, this.drive.state === STATE.INVESTIGATE_POLICE ? g.player.position : v.position);
    g.bryanVisual.update(); g.input.clearFrameState(); g.renderer.render(this.road.scene, camera);
  }
}
