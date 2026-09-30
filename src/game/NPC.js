import * as THREE from 'three';
import { CharacterFactory } from '../characters/CharacterFactory.js';

// Ambient actor: follows authored waypoints and animates a shared-resource model.
export class NPC {
  constructor({ name, waypoints, walkSpeed = 1.55, type = 'Doctor',
    initialWait = 0, facing = 0, phase = 0 }) {
    this.name = name;
    this.waypoints = waypoints.map(({ x, z }) => new THREE.Vector3(x, 0, z));
    this.walkSpeed = walkSpeed;
    this.type = type;
    this.paused = false;
    this.group = new THREE.Group();
    this.group.name = `npc:${name}`;
    this.group.position.copy(this.waypoints[0]);
    this.group.rotation.y = facing;
    this.model = CharacterFactory[`create${type}`]();
    this.model.elapsed = phase;
    this.group.add(this.model);
    this.direction = 1;
    this.targetIndex = this.waypoints.length > 1 ? 1 : 0;
    this.waitRemaining = initialWait;
    this.state = this.waypoints.length === 1 ? 'idle' : initialWait > 0 ? 'waiting' : 'walking';

  }

  update(dt, move = null) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.paused || this.walkSpeed === 0) { this.animate(dt, 0); return; }
    dt = Math.min(dt, 0.05);
    let remaining = dt;
    let moved = 0;
    // Consume time across waypoints/waits so arrival cannot overshoot or teleport.
    while (remaining > 0 && this.waypoints.length > 1) {
      if (this.waitRemaining > 0) {
        this.state = 'waiting';
        const waiting = Math.min(remaining, this.waitRemaining);
        this.waitRemaining -= waiting;
        remaining -= waiting;
        if (remaining <= 0) break;
      }
      const target = this.waypoints[this.targetIndex];
      const dx = target.x - this.group.position.x;
      const dz = target.z - this.group.position.z;
      const distance = Math.hypot(dx, dz);
      this.state = 'walking';
      if (distance > 1e-8) {
        const step = Math.min(this.walkSpeed * remaining, distance);
        if (move) moved += move(this, target, step, remaining);
        else {
          this.group.rotation.y = Math.atan2(-dx, -dz);
          this.group.position.x += dx / distance * step;
          this.group.position.z += dz / distance * step;
          moved += step;
        }
        remaining = Math.max(0, remaining - step / this.walkSpeed);
        if (this.group.position.distanceTo(target) > 0.005) break;
      }
      this.group.position.copy(target);
      if (this.targetIndex === 0 || this.targetIndex === this.waypoints.length - 1) {
        this.direction *= -1;
        this.waitRemaining = 2 + Math.random() * 3;
        this.state = 'waiting';
      }
      this.targetIndex += this.direction;
    }
    this.animate(dt, moved);
  }

  animate(dt, moved) {
    let headYaw = 0;
    if (this.lookTarget) {
      const dx = this.lookTarget.x - this.group.position.x;
      const dz = this.lookTarget.z - this.group.position.z;
      const angle = Math.atan2(-dx, -dz) - this.group.rotation.y;
      headYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(angle), Math.cos(angle)), -0.45, 0.45);
    }
    this.model.animate(dt, moved / dt, false, headYaw);
  }
}
