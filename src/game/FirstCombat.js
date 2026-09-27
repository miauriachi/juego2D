import * as THREE from 'three';
import { shortestAngleDifference } from './NPCAvoidance.js';

export function createHandgun() {
  const gun = new THREE.Group(); gun.name = 'POLICE_HANDGUN';
  const material = new THREE.MeshLambertMaterial({ color: 0x58616a });
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (const [scale, position] of [[[0.065, 0.08, 0.23], [0, 0, -0.07]], [[0.06, 0.13, 0.07], [0, -0.085, 0.005]]]) {
    const mesh = new THREE.Mesh(box, material); mesh.scale.fromArray(scale); mesh.position.fromArray(position); gun.add(mesh);
  }
  return gun;
}

// A single local encounter. Player/Vehicle input and movement remain unchanged elsewhere.
export class FirstCombat {
  constructor(chapter) {
    this.chapter = chapter; this.game = chapter.game; this.player = this.game.player;
    this.woman = chapter.woman; this.collision = chapter.crash.collision;
    this.inventory = this.game.inventory ||= {};
    this.inventory.weapon = 'POLICE_HANDGUN'; this.inventory.ammo = 12;
    this.weapon = chapter.gun; this.player.group.add(this.weapon);
    this.weapon.position.set(0.23, 1.12, -0.5);
    this.flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), new THREE.MeshBasicMaterial({ color: 0xffdc9b }));
    this.flash.position.z = -0.24; this.flash.visible = false; this.weapon.add(this.flash);
    this.hud = document.createElement('aside'); this.hud.className = 'combat-hud'; this.hud.hidden = true;
    this.game.container.append(this.hud);
    this.mouseAim = false; this.mouseFire = false; this.enabled = false;
    this.onDown = e => { if (!this.enabled) return; if (e.button === 2) this.mouseAim = true; if (e.button === 0) this.mouseFire = true; };
    this.onUp = e => { if (e.button === 2) this.mouseAim = false; };
    this.onBlur = () => { this.mouseAim = this.mouseFire = false; this.game.input.keys.clear(); };
    this.onContext = e => { if (this.enabled) e.preventDefault(); };
    window.addEventListener('pointerdown', this.onDown); window.addEventListener('pointerup', this.onUp);
    window.addEventListener('blur', this.onBlur); this.game.renderer.domElement.addEventListener('contextmenu', this.onContext);
    this.cooldown = 0; this.flashTime = 0; this.time = 0; this.enemyTime = 0; this.health = 5;
    this.enemyState = 'INJURED'; this.playerHealth = 3; this.hurtCooldown = 0;
    this.spawn = this.woman.position.clone(); this.playerSpawn = this.player.position.clone();
  }
  setEnemyState(state) { this.enemyState = state; this.woman.userData.state = state; this.enemyTime = 0; }
  start() {
    this.enabled = true; this.hud.hidden = false; this.game.input.keys.clear(); this.game.input.clearFrameState();
    this.setEnemyState('APPROACHING');
  }
  damageCar(point, normal = new THREE.Vector3(0, 1, 0)) {
    if (this.chapter.carDamaged) return;
    this.chapter.carDamaged = true;
    this.chapter.damagePoint = point.clone();
    const mark = new THREE.Mesh(new THREE.CircleGeometry(0.055, 7), new THREE.MeshBasicMaterial({ color: 0x080b0e, side: THREE.DoubleSide }));
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    mark.position.copy(point).addScaledVector(normal, 0.005);
    this.chapter.scene.add(mark); this.chapter.bulletHole = mark;
    this.game.audio?.playCue('metal_hit');
  }
  discharge(direction) {
    if (this.inventory.ammo <= 0 || this.cooldown > 0) return false;
    this.inventory.ammo--; this.cooldown = 0.48; this.flashTime = 0.075;
    this.flash.visible = true; this.game.audio?.playCue('handgun_shot');
    this.player.group.updateMatrixWorld(true);
    const origin = this.weapon.localToWorld(new THREE.Vector3(0, 0, -0.24));
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    const car = this.chapter.drive.vehicle.group; car.updateMatrixWorld(true);
    const carMeshes = [];
    car.traverse(mesh => {
      if (!mesh.isMesh) return;
      for (let node = mesh; node; node = node.parent) if (!node.visible) return;
      carMeshes.push(mesh);
    });
    const surface = new THREE.Raycaster(origin, ray.direction, 0, 16).intersectObjects(carMeshes, false)[0];
    const carHit = surface?.point;
    const enemyBox = new THREE.Box3().setFromCenterAndSize(this.woman.position.clone().add(new THREE.Vector3(0, 0.85, 0)), new THREE.Vector3(0.7, 1.7, 0.65));
    const hit = this.enemyState !== 'DEAD' && this.enemyState !== 'DOWN' && ray.intersectBox(enemyBox, new THREE.Vector3());
    const carFirst = carHit && (!hit || origin.distanceTo(carHit) < origin.distanceTo(hit));
    if (carFirst) this.damageCar(carHit, surface.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(surface.object.matrixWorld)));
    else if (hit && origin.distanceTo(hit) <= 16) {
      this.health--; this.game.audio?.playCue('enemy_impact');
      if (this.health <= 0) this.setEnemyState('DEAD');
      else if (this.health === 3 && !this.fellOnce) { this.fellOnce = true; this.setEnemyState('DOWN'); }
      else this.setEnemyState('HIT');
    }
    const end = carFirst ? carHit : hit || origin.clone().addScaledVector(direction, 14);
    this.tracer?.geometry.dispose(); if (this.tracer) { this.tracer.material.dispose(); this.tracer.removeFromParent(); }
    this.tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin, end]), new THREE.LineBasicMaterial({ color: 0xcdb383, transparent: true, opacity: 0.45 }));
    this.chapter.scene.add(this.tracer); return true;
  }
  // One visible startled discharge during the encounter establishes the later engine damage.
  accidentalShot() {
    this.player.group.updateMatrixWorld(true);
    const origin = this.weapon.getWorldPosition(new THREE.Vector3());
    const direction = this.chapter.hoodPoint.clone().sub(origin).normalize();
    this.player.rotationY = Math.atan2(-direction.x, -direction.z); this.player.group.rotation.y = this.player.rotationY;
    this.weapon.rotation.x = Math.asin(direction.y);
    this.player.group.updateMatrixWorld(true);
    const muzzle = this.weapon.localToWorld(new THREE.Vector3(0, 0, -0.24));
    this.discharge(this.chapter.hoodPoint.clone().sub(muzzle).normalize());
  }
  retry() {
    this.inventory.ammo = 11; this.health = 5; this.playerHealth = 3; this.fellOnce = false;
    this.hurtCooldown = 0; this.cooldown = 0; this.failed = false; this.mouseFire = this.mouseAim = false;
    this.woman.position.copy(this.spawn); this.woman.rotation.x = 0; this.woman.pose = 'injured';
    this.player.position.copy(this.playerSpawn); this.player.previousPosition.copy(this.playerSpawn);
    this.setEnemyState('APPROACHING'); this.game.input.keys.clear(); this.game.input.clearFrameState();
  }
  update(dt) {
    this.time += dt; this.enemyTime += dt; this.cooldown = Math.max(0, this.cooldown - dt);
    this.flashTime -= dt; this.flash.visible = this.flashTime > 0;
    if (this.tracer) this.tracer.visible = this.flash.visible;
    if (!this.enabled) return;
    const p = this.player, input = this.game.input;
    if (this.failed) {
      this.hud.textContent = 'No puedes continuar. [E] Reintentar el encuentro';
      if (input.isJustPressed('KeyE')) this.retry(); return;
    }
    const aiming = this.mouseAim || input.isPressed('KeyQ');
    const fire = this.mouseFire || input.isJustPressed('Space'); this.mouseFire = false;
    this.hud.textContent = `PISTOLA  ${this.inventory.ammo} / 12 · ${this.playerHealth === 1 ? 'HERIDO · ' : ''}Ratón derecho / Q: apuntar · clic / Espacio: disparar`;
    p.previousPosition.copy(p.position);
    if (aiming) {
      const offset = this.woman.position.clone().sub(p.position).setY(0);
      const target = Math.atan2(-offset.x, -offset.z), delta = shortestAngleDifference(p.rotationY, target);
      const turn = Number(input.isPressed('KeyD')) - Number(input.isPressed('KeyA'));
      if (turn) p.rotationY += turn * dt * 1.5;
      else if (offset.length() <= 16 && Math.abs(delta) < Math.PI * 0.7 && this.enemyState !== 'DEAD')
        p.rotationY += THREE.MathUtils.clamp(delta, -2.8 * dt, 2.8 * dt);
      p.group.rotation.y = p.rotationY; p.velocity.set(0, 0, 0);
    } else p.update(input, dt);
    this.collision.resolve(p); p.animate(dt, aiming);
    this.weapon.position.set(0.23, aiming ? 1.26 : 0.87, aiming ? -0.52 : -0.24);
    this.weapon.rotation.x = aiming ? this.cooldown / 0.48 * 0.12 : -0.65;
    if (aiming && fire) this.discharge(new THREE.Vector3(-Math.sin(p.rotationY), 0, -Math.cos(p.rotationY)));
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    if (this.enemyState === 'APPROACHING') {
      const delta = p.position.clone().sub(this.woman.position).setY(0), distance = delta.length();
      this.woman.rotation.y = Math.atan2(-delta.x, -delta.z);
      const speed = 0.48 + Math.sin(this.time * 3.1) * 0.16;
      const previous = this.woman.position.clone();
      if (distance > 0.7) this.woman.position.addScaledVector(delta, Math.min(speed * dt, distance - 0.7) / distance);
      this.collision.resolve({ position: this.woman.position, previousPosition: previous });
      this.woman.animate(dt, speed); this.woman.head.rotation.x = 0.22; this.woman.torso.rotation.z = Math.sin(this.time * 1.7) * 0.05;
      if (distance < 0.95 && this.hurtCooldown === 0) { this.playerHealth--; this.hurtCooldown = 2.5; this.game.audio?.playCue('enemy_impact'); }
    } else if (this.enemyState === 'HIT') {
      this.woman.torso.rotation.x = -Math.sin(Math.min(1, this.enemyTime / 0.5) * Math.PI) * 0.28;
      if (this.enemyTime > 0.6) this.setEnemyState('APPROACHING');
    } else if (this.enemyState === 'DOWN' || this.enemyState === 'DEAD') {
      this.woman.pose = 'lying'; this.woman.animate(dt, 0);
      const fallen = THREE.MathUtils.smoothstep(this.enemyTime, 0, 0.65);
      const rise = this.enemyState === 'DOWN' ? 1 - THREE.MathUtils.smoothstep(this.enemyTime, 2.2, 3.4) : 1;
      this.woman.rotation.x = fallen * rise * Math.PI / 2; this.woman.position.y = 0.12 * fallen * rise;
      if (this.enemyState === 'DOWN' && this.enemyTime > 3.4) { this.woman.pose = 'injured'; this.woman.position.y = 0; this.setEnemyState('APPROACHING'); }
      if (this.enemyState === 'DEAD' && this.enemyTime > 3) { this.completed = true; this.dispose(); }
    }
    if (this.playerHealth <= 0 || (this.inventory.ammo === 0 && this.health > 0 && this.cooldown === 0)) this.failed = true;
  }
  dispose() {
    this.enabled = false; this.hud.hidden = true; this.mouseAim = this.mouseFire = false;
    window.removeEventListener('pointerdown', this.onDown); window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('blur', this.onBlur); this.game.renderer.domElement.removeEventListener('contextmenu', this.onContext);
    this.weapon.rotation.x = -0.65;
  }
}
