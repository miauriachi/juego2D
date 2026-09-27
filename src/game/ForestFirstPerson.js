import * as THREE from 'three';

// Local forest view only. Keyboard turning always works; dragging adds mouse look.
export class ForestFirstPerson {
  constructor(player, canvas, settings) {
    Object.assign(this, { player, canvas, settings }); this.active = false; this.pitch = -0.14; this.time = 0;
    this.camera = new THREE.PerspectiveCamera(67, innerWidth / innerHeight, 0.06, 70);
    this.camera.name = 'FOREST_FIRST_PERSON_CAMERA';
    this.mouseMove = event => {
      if (!this.active || !(event.buttons & 1)) return;
      player.rotationY -= event.movementX * 0.0025;
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.002, -0.8, 0.65);
    };
    canvas.addEventListener('pointermove', this.mouseMove);
  }
  update(dt, moving) {
    this.time += dt;
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.player.position);
    this.camera.position.y += 1.67 + (this.settings.cameraMotion && moving ? Math.sin(this.time * 9) * 0.012 : 0);
    this.camera.rotation.set(this.pitch, this.player.rotationY, 0, 'YXZ');
  }
  dispose() { this.canvas.removeEventListener('pointermove', this.mouseMove); this.active = false; }
}
