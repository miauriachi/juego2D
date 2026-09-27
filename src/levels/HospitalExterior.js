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
      minX: exteriorConfig.car.position[0] - 0.52,
      maxX: exteriorConfig.car.position[0] + 0.52,
      minZ: exteriorConfig.car.position[2] - 0.92,
      maxZ: exteriorConfig.car.position[2] + 0.92,
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
    this.car.updateMatrixWorld(true);
    return this.car.localToWorld(new THREE.Vector3(...exteriorConfig.car.interaction.localPosition));
  }

  // Correct only the rendered Bryan GLB. His physics group and movement heading
  // remain untouched. The correction is solved from the current fixed camera so
  // his projected head/feet line is vertical against the hospital door jambs.
  applyPlayerPresentation(player, camera, bryanVisual) {
    const visual = bryanVisual?.group;
    if (!visual || !camera || !player.group.visible) return;

    visual.rotation.x = 0;
    visual.rotation.z = 0;
    visual.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    const footLocal = new THREE.Vector3(0, 0.02, 0);
    const headLocal = new THREE.Vector3(0, 1.76, 0);
    const projectedDx = angle => {
      visual.rotation.z = angle;
      visual.updateMatrixWorld(true);
      const foot = footLocal.clone().applyMatrix4(visual.matrixWorld).project(camera);
      const head = headLocal.clone().applyMatrix4(visual.matrixWorld).project(camera);
      return head.x - foot.x;
    };

    if (!exteriorConfig.playerPresentation.screenVertical) return;
    const epsilon = 0.018;
    const d0 = projectedDx(0);
    const d1 = projectedDx(epsilon);
    const derivative = (d1 - d0) / epsilon;

    let correction = Math.abs(derivative) > 1e-6 ? -d0 / derivative : 0;
    correction = THREE.MathUtils.clamp(
      correction,
      -exteriorConfig.playerPresentation.maxRollCorrection,
      exteriorConfig.playerPresentation.maxRollCorrection,
    );

    // One Newton refinement makes the projected line effectively vertical.
    let d = projectedDx(correction);
    const dNext = projectedDx(correction + epsilon);
    const slope = (dNext - d) / epsilon;
    if (Math.abs(slope) > 1e-6) correction -= d / slope;

    visual.rotation.z = THREE.MathUtils.clamp(
      correction,
      -exteriorConfig.playerPresentation.maxRollCorrection,
      exteriorConfig.playerPresentation.maxRollCorrection,
    );
    visual.updateMatrixWorld(true);
  }

  restorePlayerPresentation(bryanVisual) {
    const visual = bryanVisual?.group;
    if (!visual) return;
    visual.rotation.x = 0;
    visual.rotation.z = 0;
    visual.updateMatrixWorld(true);
  }
}
