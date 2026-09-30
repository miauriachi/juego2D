import * as THREE from 'three';
import { PrerenderRoomDebug } from './PrerenderRoomDebug.js';
import { prerenderDebugEnabled } from './PrerenderDebugConfig.js';

// Presentation only: a ground contact cue and optional calibration overlay.
export class PrerenderRoomView {
  constructor(scene, config) {
    this.config = config;
    this.wasActive = false;
    this.logCalibration = prerenderDebugEnabled();
    this.debug = new PrerenderRoomDebug(scene, config);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0,0,0,0.38)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas),
        transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    this.shadow.name = `${config.id}-contact-shadow`;
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.visible = false;
    this.shadow.userData.preserveForBackplate = true;
    scene.add(this.shadow);
  }

  update(player, active, input, state = {}) {
    const stateKey = JSON.stringify(state);
    if (active && (!this.wasActive || this.lastState !== stateKey) && this.logCalibration) {
      console.info('[PrerenderScene]', JSON.stringify({
        sceneId: this.config.id,
        playerSpawn: player.position.toArray(),
        playerScale: player.group.scale.toArray(),
        npcAnchors: this.config.npcAnchors,
        camera: this.config.camera,
        ...state,
      }));
    }
    this.lastState = stateKey;
    this.wasActive = active;
    this.shadow.visible = active && player.group.visible;
    this.shadow.position.set(player.position.x, 0.003, player.position.z);
    this.shadow.rotation.z = -player.rotationY;
    this.debug.update(active, input);
  }
}
