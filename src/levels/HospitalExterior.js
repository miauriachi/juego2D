import * as THREE from 'three';
import { HospitalIntro } from './HospitalIntro.js';
import { createCar } from '../game/Vehicle.js';
import { Snowfall } from '../environment/Snowfall.js';
import { DEBUG_MODE } from '../config/constants.js';
import { exteriorConfig } from '../game/ExteriorConfig.js';

export class HospitalExterior extends HospitalIntro {
  build() {
    this.scene.background = new THREE.Color(0x05090d);
    this.scene.fog = null;

    this.backgroundLoaded = false;
    this.backgroundError = null;
    this.backgroundReady = new Promise(resolve => {
      new THREE.TextureLoader().load(
        exteriorConfig.background.url,
        texture => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.magFilter = THREE.LinearFilter;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          this.scene.background = texture;
          this.backgroundLoaded = true;
          resolve(true);
        },
        undefined,
        error => {
          this.backgroundError = error;
          console.error('Exterior background failed to load', error);
          resolve(false);
        },
      );
    });

    const b = exteriorConfig.playerBounds;
    this.collisionSystem.bounds = {
      minX: b.minX,
      maxX: b.maxX,
      minZ: b.minZ,
      maxZ: b.maxZ,
    };

    this.car = createCar();
    this.car.position.set(...exteriorConfig.car.position);
    this.car.rotation.y = exteriorConfig.car.rotationY;
    this.car.scale.setScalar(exteriorConfig.car.scale);
    this.car.traverse(object => {
      if (object.isMesh) {
        object.userData.preserveForBackplate = true;
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    this.scene.add(this.car);

    // Conservative collider: enough to stop Bryan walking through the body,
    // but small enough that he can still reach the driver's-side interaction point.
    this.collisionSystem.addCollider({
      minX: exteriorConfig.car.position[0] - 0.56,
      maxX: exteriorConfig.car.position[0] + 0.56,
      minZ: exteriorConfig.car.position[2] - 1.00,
      maxZ: exteriorConfig.car.position[2] + 1.00,
    });

    // Dynamic snow is deliberately separate from the baked plate.
    this.snowfall = new Snowfall(this.scene, 520, 18);
    this.snowfall.points.material.size = 0.10;
    this.snowfall.points.material.opacity = 0.72;
    this.snowfall.points.renderOrder = 20;

    // Actor/car lighting only. The environment itself is baked into the plate.
    this.scene.add(new THREE.HemisphereLight(0xb9cad8, 0x17202a, 0.86));
    const moon = new THREE.DirectionalLight(0xbfd2e7, 0.95);
    moon.position.set(-4, 8, 4);
    this.scene.add(moon);
    const lamp = new THREE.PointLight(0xffd8a3, 8, 7, 2);
    lamp.position.set(0.35, 3.2, 0.7);
    this.scene.add(lamp);

    this.cameraManager.zones = [];
    const zone = this.cameraManager.addZone({
      id: exteriorConfig.id,
      name: 'EXTERIOR PRERENDER - HOSPITAL',
      ...exteriorConfig.camera,
      minX: -100,
      maxX: 100,
      minZ: -100,
      maxZ: 100,
      priority: 100,
      color: 0x93a9bc,
    });
    this.cameraManager.setActiveZone(zone);
    this.cameraManager.setDebugVisibility(DEBUG_MODE);

    this.buildDebugVisuals();
    if (DEBUG_MODE) {
      const grid = new THREE.GridHelper(10, 20);
      grid.position.y = 0.01;
      this.scene.add(grid);
    }
  }

  update(dt, center = this.player?.position ?? this.car.position) {
    if (this.snowfall && center) this.snowfall.update(dt, center);
  }

  getCarInteractionPosition() {
    return this.car.position.clone();
  }

  // Exterior-only visual correction.
  // Keep Bryan's actual world heading untouched and apply only a constant local
  // Z-axis roll to the rendered GLB. This prevents the old per-frame snapping.
  applyPlayerPresentation(player, camera, bryanVisual) {
    const visual = bryanVisual?.group;
    if (!visual || !player.group.visible) return;

    visual.rotation.x = 0;
    visual.rotation.y = 0;
    visual.rotation.z = exteriorConfig.playerPresentation.rollZ;
    player.group.scale.setScalar(exteriorConfig.playerPresentation.scale ?? 1);
    visual.updateMatrixWorld(true);
  }

  restorePlayerPresentation(bryanVisual) {
    const visual = bryanVisual?.group;
    if (!visual) return;
    const playerRoot = visual.parent?.parent ?? visual.parent;
    if (playerRoot?.scale) playerRoot.scale.set(1, 1, 1);
    visual.rotation.set(0, 0, 0);
    visual.updateMatrixWorld(true);
  }
}
