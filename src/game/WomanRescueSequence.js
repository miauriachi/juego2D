import * as THREE from 'three';
import { CarInterior } from './CarInterior.js';

// Edited rescue: all transfers are shown; time elisions occur only under a short fade.
export class WomanRescueSequence {
  constructor(game, level, onComplete) {
    Object.assign(this, { game, level, onComplete }); this.time = 0; this.shot = 0;
    this.durations = [4, 6, 6, 5, 2, 3, 3];
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    this.interior = new CarInterior(level.car, game.player, level.woman);
    this.fade = document.createElement('div'); this.fade.style.cssText = 'position:absolute;inset:0;background:black;opacity:0;pointer-events:none;z-index:40'; game.container.append(this.fade);
    this.lyingPosition = level.woman.position.clone(); this.lyingQuaternion = level.woman.quaternion.clone();
    this.passengerSide = level.car.localToWorld(new THREE.Vector3(1.7, 0, 0.35)); this.passengerSide.y = 0;
    this.driverSide = level.car.localToWorld(new THREE.Vector3(-1.7, 0, 0.35)); this.driverSide.y = 0;
    this.sceneFog = level.scene.fog.far; level.scene.fog.far = 32;
    game.input.keys.clear(); game.dialogueManager.setHint('');
  }
  setCamera(position, target) { this.camera.position.copy(position); this.camera.lookAt(target); }
  supportedWalk(a, b, progress) {
    const p = this.game.player, woman = this.level.woman;
    p.position.lerpVectors(a, b, progress);
    const d = b.clone().sub(a); p.rotationY = Math.atan2(-d.x, -d.z); p.group.rotation.set(0, p.rotationY, 0);
    woman.position.copy(p.position).add(new THREE.Vector3(0.65, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotationY));
    woman.rotation.set(0.07, p.rotationY, 0.04); woman.pose = 'injured'; woman.animate(0.05, 0.8);
    woman.arms[0].rotation.z = -1.4; woman.arms[0].rotation.x = -0.2;
    woman.forearms[0].rotation.x = 0.7;
  }
  update(dt) {
    const p = this.game.player, woman = this.level.woman, points = this.level.layout.points;
    this.time += dt; const duration = this.durations[this.shot], t = Math.min(1, this.time / duration);
    this.fade.style.opacity = String(this.time < 0.2 ? 1 - this.time / 0.2 : this.time > duration - 0.2 ? (this.time - duration + 0.2) / 0.2 : 0);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    if (this.shot === 0) {
      const lift = THREE.MathUtils.smoothstep(t, 0.25, 0.9);
      p.position.copy(this.level.bodyPosition).add(new THREE.Vector3(-0.7, -0.3 * (1 - lift), 0));
      p.group.rotation.set(0.25 * (1 - lift), -Math.PI / 2, 0); p.group.scale.set(1, 0.82 + 0.18 * lift, 1);
      woman.position.copy(this.lyingPosition).lerp(this.level.bodyPosition, lift);
      woman.quaternion.copy(this.lyingQuaternion).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)), lift);
      woman.arms[0].rotation.z = -1.4 * lift;
      this.setCamera(this.level.bodyPosition.clone().add(new THREE.Vector3(-3, 2.3, 3)), this.level.bodyPosition.clone().setY(0.9));
    } else if (this.shot === 1 || this.shot === 2) {
      p.group.scale.setScalar(1);
      const a = this.shot === 1 ? points.at(-1) : points[7];
      const b = this.shot === 1 ? points.at(-2).clone().lerp(a, 0.5) : points[6].clone().lerp(a, 0.65);
      this.supportedWalk(a, b, t);
      const mid = a.clone().lerp(b, 0.5);
      const side = b.clone().sub(a).normalize(); side.set(-side.z, 0, side.x).multiplyScalar(4);
      this.setCamera(mid.clone().add(side).add(new THREE.Vector3(0, 3.2, 0)), mid.clone().setY(1));
    } else if (this.shot === 3) {
      const a = this.level.point(6, 0), b = this.passengerSide;
      this.supportedWalk(a, b, t);
      this.setCamera(this.level.car.position.clone().add(new THREE.Vector3(6, 3, 5)), this.level.car.position.clone().setY(1));
    } else if (this.shot === 4) {
      this.interior.passengerDoor.rotation.y = t * 1.15;
      this.setCamera(this.level.car.localToWorld(new THREE.Vector3(4, 2.3, 3)), this.passengerSide.clone().setY(1));
      if (!this.doorSound) { this.doorSound = true; this.game.audio?.playCue('door_open'); }
    } else if (this.shot === 5) {
      woman.pose = 'seated'; woman.animate(dt, 0);
      const seat = this.level.car.localToWorld(new THREE.Vector3(0.39, 0.07, 0.12));
      woman.position.lerpVectors(this.passengerSide, seat, Math.min(1, t * 1.6));
      woman.rotation.set(0, this.level.car.rotation.y, 0); woman.scale.setScalar(1 - 0.13 * t);
      this.interior.passengerDoor.rotation.y = 1.15 * (1 - THREE.MathUtils.smoothstep(t, 0.6, 1));
    } else {
      // Walk around the rear bumper before entering the driver's door.
      if (!this.seated) { this.seated = true; this.interior.seatWoman(); this.game.audio?.playCue('door_close'); }
      const route = [new THREE.Vector3(1.7, 0, 0.35), new THREE.Vector3(1.7, 0, 2.9), new THREE.Vector3(-1.7, 0, 2.9), new THREE.Vector3(-1.7, 0, 0.35)];
      const u = Math.min(2.999, t * 3), index = Math.floor(u);
      p.position.copy(this.level.car.localToWorld(route[index].clone().lerp(route[index + 1], u - index)));
      p.position.y = 0; p.group.visible = t < 0.94;
      this.level.hinge.rotation.y = -Math.sin(THREE.MathUtils.smoothstep(t, 0.7, 1) * Math.PI);
      this.setCamera(this.level.car.localToWorld(new THREE.Vector3(-5, 3, 5)), this.level.car.position.clone().setY(0.8));
    }
    this.game.bryanVisual.update(); this.level.snowfall.update(dt, p.position);
    if (this.time >= duration) {
      this.time = 0; this.shot++;
      if (this.shot === this.durations.length) {
        this.level.hinge.rotation.y = 0; this.interior.seatBryan(); this.fade.remove();
        this.onComplete(this.interior); return;
      }
    }
  }
}
