import * as THREE from 'three';
import { TimedConversation } from './TimedConversation.js';
import { ENTRANCE_SPAWN } from './EntranceConfig.js';

// Classic survival-horror door-loading shot using the authored closed/open door plates.
// It deliberately keeps gameplay frozen until the entrance backplate is already loaded.
export class HospitalOpeningSequence {
  constructor(scene, player, level, audio, onComplete, container, backdropReadyPromise = Promise.resolve(true)) {
    Object.assign(this, { scene, player, level, audio, onComplete, container });

    this.state = 'DOOR_LOADING';
    this.time = 0;
    this.completed = false;
    this.backdropReady = false;
    this.phoneStarted = false;
    this.phoneFinished = false;
    this.followup = false;
    this.walked = 0;

    this.backdropReadyPromise = Promise.resolve(backdropReadyPromise);

    // Bryan does NOT walk in during the loading shot. He appears already inside,
    // facing into the hospital, once the pre-rendered lobby has replaced the door shot.
    this.spawnPosition = new THREE.Vector3(...ENTRANCE_SPAWN);
    this.lastPosition = this.spawnPosition.clone();

    this.phone = new TimedConversation(container);

    // During the classic door-loading shot the WebGL canvas must never be visible.
    // The transition is pure DOM; hiding the canvas guarantees the original 3D
    // entrance cannot flash underneath while assets are still becoming ready.
    this.canvas = container.querySelector('canvas');
    if (this.canvas) this.canvas.style.visibility = 'hidden';

    this.transition = this.createDoorTransition();
    this.blackout.style.opacity = '1';
    this.ready = Promise.all([
      this.backdropReadyPromise,
      this.preloadImage(this.closedDoor.src),
      this.preloadImage(this.openDoor.src),
    ]).then(results => {
      this.backdropReady = results.every(Boolean);
      if (!this.backdropReady) this.showLoadError();
      return this.backdropReady;
    }).catch(() => { this.showLoadError(); return false; });

    this.npcVisibility = new Map(scene.children.filter(child => child.name?.startsWith('npc:'))
      .map(child => [child, child.visible]));
    for (const [npc] of this.npcVisibility) npc.visible = false;

    player.group.visible = false;
    player.position.copy(this.spawnPosition);
    player.previousPosition.copy(player.position);
    player.velocity.set(0, 0, 0);
    player.rotationY = 0; // Faces -Z: into the hospital, with the entrance doors behind him.
    player.group.rotation.y = player.rotationY;
  }

  createDoorTransition() {
    const root = document.createElement('div');
    root.className = 'hospital-door-transition';
    root.dataset.role = 'hospital-door-transition';

    const closed = document.createElement('img');
    closed.className = 'hospital-door-transition__door hospital-door-transition__door--closed';
    closed.src = './assets/backgrounds/doors/hospital_door_closed.png';
    closed.alt = '';

    const open = document.createElement('img');
    open.className = 'hospital-door-transition__door hospital-door-transition__door--open';
    open.src = './assets/backgrounds/doors/hospital_door_open.png';
    open.alt = '';

    const blackout = document.createElement('div');
    blackout.className = 'hospital-door-transition__vignette';

    root.append(closed, open, blackout);
    this.container.appendChild(root);

    this.closedDoor = closed;
    this.openDoor = open;
    this.blackout = blackout;
    return root;
  }


  preloadImage(src) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => image.decode().then(() => resolve(image.naturalWidth > 0), () => resolve(false));
      image.onerror = () => resolve(false);
      image.src = src;
    });
  }

  showLoadError() {
    this.state = 'LOAD_ERROR';
    this.blackout.style.opacity = '1';
    const message = document.createElement('p');
    message.textContent = 'No se pudo cargar la entrada del hospital. Recarga la página para reintentar.';
    message.style.cssText = 'position:absolute;inset:45% 10% auto;color:white;text-align:center';
    this.transition.append(message);
  }

  startPhone() {
    if (this.phoneStarted) return;
    this.phoneStarted = true;
    this.phone.start([
      { speaker: 'BRYAN', text: 'Ok, amor... ¿pero estás segura?', duration: 3.5 },
      { speaker: 'BRYAN', text: 'Muchas veces esas cosas fallan.', duration: 3.4 },
    ]);
  }

  finishTransition() {
    if (this.completed) return;

    const p = this.player;
    p.position.copy(this.spawnPosition);
    p.previousPosition.copy(p.position);
    p.velocity.set(0, 0, 0);
    p.rotationY = 0;
    p.group.rotation.y = 0;
    p.group.visible = true;

    // Restore logical visibility before the backdrop captures the entrance policy.
    for (const [npc, visible] of this.npcVisibility) npc.visible = visible;
    this.npcVisibility.clear();
    // Synchronous handoff: Game prepares AND renders the composed entrance first.
    this.onComplete();
    this.completed = true;
    this.state = 'HOSPITAL_GAMEPLAY';
    this.lastPosition.copy(p.position);
    this.startPhone();

    // The first composed frame is already submitted before revealing WebGL.
    if (this.canvas) this.canvas.style.visibility = 'visible';
    this.transition.remove();
  }

  update(dt) {
    if (this.completed || !this.backdropReady) return;
    const previous = this.time;
    this.time += dt;
    const t = this.time;

    // No ghostly morph between two unrelated renders. We hide the cut in a very
    // short blackout, then push through the fully open-door plate.
    // The loading plate must cover the canvas from the very first frame.
    // Never fade it in: that was exposing one frame of the old 3D hospital.
    this.transition.style.opacity = '1';

    // Closed door settles on black.
    this.closedDoor.style.opacity = t < 1.28 ? '1' : '0';
    this.openDoor.style.opacity = t < 1.28 ? '0' : '1';

    // 1.12 -> 1.28 fade to black; swap the image while black; 1.28 -> 1.46 reveal open door.
    let black = 1 - THREE.MathUtils.smoothstep(t, 0.12, 0.32);
    if (t >= 1.12 && t < 1.28) black = THREE.MathUtils.smoothstep(t, 1.12, 1.28);
    else if (t >= 1.28 && t < 1.46) black = 1 - THREE.MathUtils.smoothstep(t, 1.28, 1.46);

    if (previous < 1.20 && t >= 1.20) this.audio?.playCue('door_open');

    // Push forward only after the open plate is fully visible.
    const push = THREE.MathUtils.smoothstep(t, 1.48, 2.70);
    this.openDoor.style.transform = `translate(-50%, -50%) scale(${1 + push * 0.42})`;
    this.closedDoor.style.transform = 'translate(-50%, -50%) scale(1)';

    // Final blackout covers the hand-off into the prerendered lobby.
    if (t >= 2.66) black = Math.max(black, THREE.MathUtils.smoothstep(t, 2.66, 2.94));
    this.blackout.style.opacity = String(black);

    // If the entrance image somehow loads slowly, stay black instead of revealing
    // the old 3D hospital for a frame.
    if (t >= 2.96 && this.backdropReady) this.finishTransition();
  }

  updateGameplay(dt, blocked) {
    if (!this.completed || this.phoneFinished) return;

    const distance = this.lastPosition.distanceTo(this.player.position);
    if (distance < 0.5) this.walked += distance;
    this.lastPosition.copy(this.player.position);

    if (blocked) {
      this.phone.element.hidden = true;
      return;
    }

    if (this.phoneStarted && !this.followup) {
      if (this.phone.active) this.phone.show();
      this.phone.update(dt);
      if (!this.phone.completed) return;
      this.phone.element.hidden = true;

      if (this.walked < 2.5) return;
      this.followup = true;
      this.phone.start([
        { speaker: 'BRYAN', text: 'Amor, estoy trabajando.', duration: 3 },
        { speaker: 'BRYAN', text: 'Te llamo más tarde, ¿sí?', duration: 3 },
      ]);
    }

    if (this.followup) {
      if (this.phone.active) this.phone.show();
      this.phone.update(dt);
      if (this.phone.completed) {
        this.phoneFinished = true;
        this.phone.element.remove();
      }
    }
  }

  onResize() {}
}
