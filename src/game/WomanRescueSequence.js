import * as THREE from 'three';
import { CarInterior } from './CarInterior.js';
import forestScene3 from '../environment/forestShots/forestScene3.js';
import forestScene4 from '../environment/forestShots/forestScene4.js';
import forestScene5 from '../environment/forestShots/forestScene5.js';

const forestCrash = new URL('../../assets/backgrounds/forest/forest_crash_clean.jpg', import.meta.url).href;
const forestBlood = new URL('../../assets/backgrounds/forest/forest_blood_clean.jpg', import.meta.url).href;

// Reuse the authored HD forest plates in reverse order for the rescue trip.
// These are the SAME environments Bryan crossed on the way in, so the return
// now preserves visual continuity without stretching tiny 320x180 rescue JPGs.
const RESCUE_BACKDROPS = [
  { key: 'rescue-opening-current', url: null, keepCurrent: true },
  { key: 'rescue-deep-hd', url: forestScene5, fallbackKey: 'scene5' },
  { key: 'rescue-mid-hd', url: forestScene4, fallbackKey: 'scene4' },
  { key: 'rescue-path-hd', url: forestScene3, fallbackKey: 'scene3' },
  { key: 'rescue-blood-hd', url: forestBlood, fallbackKey: 'scene2' },
  { key: 'rescue-crash-hd', url: forestCrash, fallbackKey: 'scene1' },
  { key: 'rescue-crash-hd', url: forestCrash, fallbackKey: 'scene1' },
];

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
    this.sceneFog = level.scene.fog.far;
    // The rescue travels from the deep forest all the way back to the sedan.
    // Keep live actors/car out of the fog wall while cinematic backplates fill
    // the far distance.
    level.scene.fog.far = Math.max(this.sceneFog, 78);
    this.ensureCarVisual();
    // Shot 0 must keep the exact CAM_FOREST_BODY backplate/camera already on
    // screen while Bryan lifts the live injured-woman NPC. Rescue backdrops
    // start only once they begin walking away in shot 1.
    this.backdropInitialized = false;
    game.input.keys.clear(); game.dialogueManager.setHint('');
  }

  ensureCarVisual() {
    const car = this.level.car;
    if (!car) return;
    car.visible = true;

    const detailed = car.userData?.detailedVisual;
    if (detailed) {
      detailed.visible = true;
      detailed.traverse(object => {
        if (object.isMesh || object.isLine || object.isPoints) object.visible = true;
      });
      car.traverse(object => {
        if (object.userData?.proceduralCarVisual) object.visible = false;
      });
    } else {
      // GLB can still be decoding when the rescue starts. Keep the procedural
      // sedan visible until Vehicle.js swaps it for the detailed model.
      car.traverse(object => {
        if (object.userData?.proceduralCarVisual) object.visible = true;
      });
    }
  }

  hideEnvironmentForBackdrop() {
    this.hiddenEnvironment = new Map();
    const roots = [
      this.game.player.group,
      this.game.bryanVisual?.group,
      this.level.woman,
      this.level.car,
      this.level.hinge,
      this.interior.group,
      this.interior.passengerDoor,
    ].filter(Boolean);

    const belongsToLiveRoot = object => roots.some(root => {
      for (let node = object; node; node = node.parent) {
        if (node === root) return true;
      }
      return false;
    });

    this.level.scene.traverse(object => {
      if (
        !object.visible ||
        object === this.backdrop ||
        object.isPoints ||
        !(object.isMesh || object.isLine || object.isSprite) ||
        belongsToLiveRoot(object)
      ) {
        return;
      }

      this.hiddenEnvironment.set(object.uuid, object.visible);
      object.visible = false;
    });
  }

  restoreEnvironment() {
    if (!this.hiddenEnvironment?.size) return;
    this.level.scene.traverse(object => {
      if (!object?.uuid || !this.hiddenEnvironment.has(object.uuid)) return;
      object.visible = this.hiddenEnvironment.get(object.uuid);
    });
    this.hiddenEnvironment.clear();
  }

  setupBackdrop() {
    // Use the scene background for rescue plates instead of a camera-child plane.
    // This is the most reliable full-screen path in Three.js and guarantees the
    // image fills the entire frame behind the live Bryan, woman, car and snow.
    this.originalSceneBackground = this.level.scene.background;
    this.backdropTextures = new Map();
    this.backdropEnvironmentHidden = false;

    // If an authored forest plate is already decoded, keep it visible while the
    // rescue-only image loads so there is never a black/empty frame.
    const currentForestTexture =
      this.level.backdrop?.cache?.get('scene6-clean')
      ?? this.level.backdrop?.material?.map
      ?? null;
    this.initialRescueBackdropTexture = currentForestTexture?.image
      ? currentForestTexture
      : null;
    if (this.initialRescueBackdropTexture) {
      this.level.scene.background = this.initialRescueBackdropTexture;
      this.activeBackdropTexture = this.initialRescueBackdropTexture;
      this.hideEnvironmentForBackdrop();
      this.backdropEnvironmentHidden = true;
    }

    const loader = new THREE.TextureLoader();
    const requested = new Set();

    RESCUE_BACKDROPS.forEach(({ key, url }) => {
      if (!url || requested.has(key)) return;
      requested.add(key);

      loader.load(
        url,
        loaded => {
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.wrapS = THREE.ClampToEdgeWrapping;
          loaded.wrapT = THREE.ClampToEdgeWrapping;
          loaded.magFilter = THREE.LinearFilter;
          loaded.minFilter = THREE.LinearMipmapLinearFilter;
          loaded.generateMipmaps = true;
          loaded.needsUpdate = true;
          this.backdropTextures.set(key, loaded);

          const active = RESCUE_BACKDROPS[
            Math.min(this.shot, RESCUE_BACKDROPS.length - 1)
          ];
          if (active?.key === key) this.updateBackdrop();
        },
        undefined,
        error => console.warn('Rescue backdrop failed to load:', key, url, error),
      );
    });

    this.updateBackdrop();
  }

  updateBackdrop() {
    const config = RESCUE_BACKDROPS[
      Math.min(this.shot, RESCUE_BACKDROPS.length - 1)
    ];
    if (!config) return;

    const generated = this.backdropTextures?.get(config.key);
    const fallback = config.fallbackKey
      ? this.level.backdrop?.cache?.get(config.fallbackKey)
      : null;
    const texture = config.keepCurrent
      ? this.initialRescueBackdropTexture
      : generated?.image
        ? generated
        : fallback?.image
          ? fallback
          : this.activeBackdropTexture?.image
            ? this.activeBackdropTexture
            : null;

    // Keep the last valid plate until the requested one is decoded.
    if (!texture) return;

    if (!this.backdropEnvironmentHidden) {
      this.hideEnvironmentForBackdrop();
      this.backdropEnvironmentHidden = true;
    }

    if (this.level.scene.background !== texture) {
      this.level.scene.background = texture;
      this.activeBackdropTexture = texture;
    }
  }

  cleanupBackdrop() {
    if (this.level.scene.fog) this.level.scene.fog.far = this.sceneFog;

    if (!this.backdropInitialized) return;

    this.restoreEnvironment();
    this.backdropEnvironmentHidden = false;
    this.level.scene.background = this.originalSceneBackground ?? null;
    this.backdropTextures?.forEach(texture => texture.dispose?.());
    this.backdropTextures?.clear();
    this.backdropTextures = null;
    this.activeBackdropTexture = null;
    this.initialRescueBackdropTexture = null;
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

    if (this.shot > 0) {
      if (!this.backdropInitialized) {
        this.level.backdrop?.disable();
        this.setupBackdrop();
        this.backdropInitialized = true;
      }
      this.updateBackdrop();
    }

    this.ensureCarVisual();
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
    this.game.bryanVisual.update(dt); this.level.updateStorm?.(dt, p.position);
    if (this.time >= duration) {
      this.time = 0; this.shot++;
      if (this.shot === this.durations.length) {
        this.level.hinge.rotation.y = 0;
        this.ensureCarVisual();
        this.interior.seatBryan();
        this.fade.remove();
        this.cleanupBackdrop();
        this.onComplete(this.interior); return;
      }
    }
  }
}
