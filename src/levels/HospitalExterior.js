import * as THREE from 'three';
import { HospitalIntro } from './HospitalIntro.js';
import { createCar } from '../game/Vehicle.js';
import { DEBUG_MODE, PLAYER_RADIUS } from '../config/constants.js';
import { WalkMesh } from '../game/WalkMesh.js';
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
    const footprint = new THREE.Box3().setFromObject(this.car);
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
    this.car.updateMatrixWorld(true);
    const corners = [[footprint.min.x,footprint.min.z],[footprint.max.x,footprint.min.z],
      [footprint.max.x,footprint.max.z],[footprint.min.x,footprint.max.z]].map(([x,z]) => {
      const p = this.car.localToWorld(new THREE.Vector3(x,0,z)); return [p.x,p.z];
    });
    this.navigation = new WalkMesh({ radius: PLAYER_RADIUS,
      polygon: [[b.minX,b.minZ],[b.maxX,b.minZ],[b.maxX,b.maxZ],[b.minX,b.maxZ]],
      obstacles: [{ id: 'parked-car', polygon: corners }] });
    const shadowMap = this.createCanvasTexture((ctx,w,h) => {
      const gradient=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
      gradient.addColorStop(0,'rgba(0,0,0,0.55)');gradient.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    },64,64);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.5,4.7),
      new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,toneMapped:false}));
    shadow.name='car-contact-shadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=.003;
    this.car.add(shadow);

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

  getCarInteractionPosition() {
    this.car.updateMatrixWorld(true);
    return this.car.localToWorld(new THREE.Vector3(...exteriorConfig.car.interaction.localPosition));
  }

  applyPlayerPresentation(player, camera) {
    // Off-axis perspective makes a world-vertical figure lean on this plate.
    // Shear only its rendered matrix about the grounded pivot, keeping the
    // projected head/feet X equal. Physics/heading/GLB remain untouched.
    player.group.updateMatrix();
    camera.updateMatrixWorld(true);
    const p = player.position.clone().applyMatrix4(camera.matrixWorldInverse);
    const up = new THREE.Vector3(0,1,0).transformDirection(camera.matrixWorldInverse);
    const shear = exteriorConfig.playerPresentation.screenVertical ? p.x * up.z / p.z : 0;
    const presentation = new THREE.Matrix4().makeShear(0,0,shear,0,0,0);
    const rotation = new THREE.Matrix4().makeRotationY(player.rotationY);
    const scale = exteriorConfig.playerPresentation.scale;
    player.group.matrix.makeTranslation(...player.position.toArray()).multiply(presentation)
      .multiply(rotation).scale(new THREE.Vector3(scale,scale,scale));
    player.group.matrixAutoUpdate = false;
    player.group.matrixWorldNeedsUpdate = true;
  }

  restorePlayerPresentation(player) {
    player.group.matrixAutoUpdate = true;
    player.group.updateMatrix();
    player.group.matrixWorldNeedsUpdate = true;
  }
}
