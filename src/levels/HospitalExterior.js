import * as THREE from 'three';
import { HospitalIntro } from './HospitalIntro.js';
import { createCar } from '../game/Vehicle.js';
import { DEBUG_MODE } from '../config/constants.js';
import { exteriorConfig } from '../game/ExteriorConfig.js';

export class HospitalExterior extends HospitalIntro {
  build() {
    this.scene.background = new THREE.Color(0x05090d);
    this.scene.fog = null;

    // Use the user's clean parking-lot plate as the actual scene background.
    // scene.background is deliberate here: it cannot be hidden by world geometry
    // or the prerender-plane visibility rules that caused the previous black screen.
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

    // Keep Bryan out of the parked car itself while he walks from the
    // Emergency doors to the marked foreground parking space.
    this.collisionSystem.addCollider({
      minX: exteriorConfig.car.position[0] - 0.46,
      maxX: exteriorConfig.car.position[0] + 0.46,
      minZ: exteriorConfig.car.position[2] - 0.88,
      maxZ: exteriorConfig.car.position[2] + 0.88,
    });

    // Actor/car lighting only. The hospital and parking lot are baked into the plate.
    this.scene.add(new THREE.HemisphereLight(0xb9cad8, 0x17202a, 0.9));
    const moon = new THREE.DirectionalLight(0xbfd2e7, 1.1);
    moon.position.set(-4, 8, 4);
    this.scene.add(moon);
    const lamp = new THREE.PointLight(0xffd8a3, 10, 7, 2);
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

  update() {}
}
