import * as THREE from 'three';
import { POST_IMPACT as STATE } from './PostImpactState.js';

// Distant exterior only. Ends the playable prologue after the original title composition.
export class HouseTitleSequence {
  constructor(chapter) {
    Object.assign(this, { chapter, game: chapter.game, crash: chapter.crash, drive: chapter.drive, scene: chapter.scene });
    const road = this.crash.road;
    this.time = 0; this.completed = false; this.state = STATE.SPOT_HOUSE;
    this.drive.transition(this.state);
    this.housePosition = new THREE.Vector3(road.centerX(this.crash.crashS + 58) + 6, 0, -this.crash.crashS - 58);
    const distantSnow = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshLambertMaterial({ color: 0xb1c1ce }));
    distantSnow.rotation.x = -Math.PI / 2; distantSnow.position.set(0, -0.02, -this.crash.crashS - 30); this.scene.add(distantSnow);
    const house = new THREE.Group(); house.position.copy(this.housePosition); house.name = 'distant-house'; this.scene.add(house);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const body = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x303033 }));
    body.scale.set(6, 4, 4); body.position.y = 2; house.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.7, 2, 4), new THREE.MeshLambertMaterial({ color: 0x677583 }));
    roof.rotation.y = Math.PI / 4; roof.position.y = 4.8; house.add(roof);
    const glow = new THREE.MeshBasicMaterial({ color: 0xffbc68, fog: false });
    for (const x of [-1.6, 1.6]) {
      const window = new THREE.Mesh(box, glow); window.scale.set(0.85, 1.05, 0.025); window.position.set(x, 2.25, 2.02); house.add(window);
      const bar = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x221b13 }));
      bar.scale.set(0.05, 1.05, 0.035); bar.position.copy(window.position).add(new THREE.Vector3(0, 0, 0.02)); house.add(bar);
    }
    const light = new THREE.PointLight(0xffb55c, 18, 9, 2); light.position.set(0, 2.2, 3); house.add(light);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 180);
    this.camera.position.copy(this.game.player.position).add(new THREE.Vector3(-3, 2.1, 4)); this.camera.lookAt(this.housePosition.clone().setY(2));
    this.drive.conversation.start([{ text: '', duration: 2 }, { speaker: 'BRYAN', text: '...Hay una casa.', duration: 3.5 }]);
    this.crash.collision.bounds.minZ = -this.crash.crashS - 24;
    this.triggerS = this.crash.crashS + 14;
    this.overlay = document.createElement('section'); this.overlay.className = 'chapter-title'; this.overlay.hidden = true;
    this.overlay.innerHTML = '<h1><span>RESIDENT</span> EVIL</h1><h2>NOCHE CERO</h2><p>FAN GAME</p>';
    this.game.container.append(this.overlay);
    this.fade = document.createElement('div'); this.fade.className = 'screen-fade'; this.fade.style.opacity = '0'; this.game.container.append(this.fade);
    this.game.input.keys.clear();
  }
  update(dt) {
    const g = this.game, p = g.player, road = this.crash.road;
    if (this.completed) { g.input.clearFrameState(); return; }
    this.time += dt; this.drive.conversation.update(dt); this.drive.police.flash(dt, true);
    g.dialogueManager.setHint('');
    if (this.state === STATE.SPOT_HOUSE) {
      p.previousPosition.copy(p.position); p.animate(dt, true);
      if (!this.drive.conversation.active) {
        this.state = STATE.WALK_TO_HOUSE; this.drive.transition(this.state); this.time = 0;
        this.camera.position.set(road.centerX(this.crash.crashS) - 9, 7, -this.crash.crashS + 15);
        this.camera.lookAt(road.centerX(this.crash.crashS + 6), 0.6, -this.crash.crashS - 6);
      }
    } else if (this.state === STATE.WALK_TO_HOUSE) {
      g.objective.textContent = 'OBJETIVO: Busca ayuda en la casa.';
      p.update(g.input, dt); this.crash.collision.resolve(p); p.animate(dt);
      // A second authored fixed view keeps Bryan visible along the short approach.
      if (-p.position.z > this.crash.crashS + 3) {
        this.camera.position.set(road.centerX(this.crash.crashS + 10) - 7, 5, -this.crash.crashS + 1);
        this.camera.lookAt(road.centerX(this.crash.crashS + 14), 0.9, -this.crash.crashS - 14);
      }
      if (-p.position.z >= this.triggerS && Math.abs(p.position.x - road.centerX(-p.position.z)) < 4.5) {
        this.state = STATE.TITLE_REVEAL; this.drive.transition(this.state); this.time = 0;
        this.start = p.position.clone(); this.end = new THREE.Vector3(road.centerX(this.crash.crashS + 38), 0, -this.crash.crashS - 38);
        this.low = this.start.clone().add(new THREE.Vector3(0, 1.8, 4));
        this.high = new THREE.Vector3(road.centerX(this.crash.crashS) + 4, 30, -this.crash.parkS + 34);
        this.overlay.hidden = false; this.overlay.style.opacity = '0'; g.objective.hidden = true;
        this.stopMusic = g.audio?.playCue('title_theme'); g.input.keys.clear();
        road.scene.fog.far = 135; road.scene.fog.near = 42;
      }
    } else if (this.state === STATE.TITLE_REVEAL) {
      const progress = THREE.MathUtils.smoothstep(this.time, 0, 18);
      p.previousPosition.copy(p.position); p.position.lerpVectors(this.start, this.end, Math.min(1, this.time / 22));
      const direction = this.end.clone().sub(this.start);
      p.rotationY = Math.atan2(-direction.x, -direction.z); p.group.rotation.y = p.rotationY; p.animate(dt);
      this.camera.position.lerpVectors(this.low, this.high, progress);
      this.camera.lookAt(p.position.clone().lerp(this.housePosition, progress * 0.2).setY(1));
      this.overlay.style.opacity = String(THREE.MathUtils.smoothstep(this.time, 5, 11));
      this.fade.style.opacity = String(THREE.MathUtils.smoothstep(this.time, 19, 23));
      if (this.time >= 24) {
        this.completed = true; this.stopMusic?.(); this.overlay.hidden = true;
        this.game.prologueCompleted = true; this.game.nextChapter = 'HOUSE';
        g.input.keys.clear();
      }
    }
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    road.snowfall.update(dt, p.position); g.bryanVisual.update(); g.input.clearFrameState(); g.renderer.render(this.scene, this.camera);
  }
}
