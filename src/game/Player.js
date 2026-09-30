import * as THREE from 'three';
import { createBryan } from '../characters/CharacterFactory.js';
import {
  PLAYER_SPEED,
  PLAYER_RUN_MULTIPLIER,
  PLAYER_TURN_SPEED,
} from '../config/constants.js';

export class Player {
  constructor(position = new THREE.Vector3(0, 0, 0)) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.position = this.group.position;
    this.previousPosition = this.position.clone();

    this.model = createBryan();

    this.group.add(this.model);
    this.velocity = new THREE.Vector3();
    this.rotationY = 0;
  }

  animate(dt, blocked = false) {
    const speed = blocked || dt <= 0 ? 0 : this.position.distanceTo(this.previousPosition) / dt;
    this.model.animate(dt, speed, speed > PLAYER_SPEED + 0.1);
  }

  update(input, dt) {
    this.previousPosition.copy(this.position);

    const forward = input.isPressed('KeyW');
    const backward = input.isPressed('KeyS');
    const turnLeft = input.isPressed('KeyA');
    const turnRight = input.isPressed('KeyD');
    const running = input.isPressed('ShiftLeft') || input.isPressed('ShiftRight');

    let turnDirection = 0;
    if (turnLeft) turnDirection -= 1;
    if (turnRight) turnDirection += 1;

    if (turnDirection !== 0) {
      this.rotationY += turnDirection * PLAYER_TURN_SPEED * dt;
    }

    this.group.rotation.y = this.rotationY;

    const movementDirection = Number(forward) - Number(backward);
    const actualSpeed = PLAYER_SPEED * (running ? PLAYER_RUN_MULTIPLIER : 1);

    if (movementDirection !== 0) {
      const direction = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
      direction.multiplyScalar(movementDirection * actualSpeed * dt);
      this.velocity.copy(direction);
      this.group.position.add(this.velocity);
    } else {
      this.velocity.set(0, 0, 0);
    }
  }
}
