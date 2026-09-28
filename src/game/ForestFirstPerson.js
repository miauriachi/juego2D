import * as THREE from 'three';

// Local forest view only. Keyboard turning always works; dragging adds mouse look.
export class ForestFirstPerson {
  constructor(player, canvas, settings) {
    Object.assign(this, { player, canvas, settings }); this.active = false; this.pitch = -0.14; this.time = 0;
    this.camera = new THREE.PerspectiveCamera(63, innerWidth / innerHeight, 0.06, 46);
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
    const motion = this.settings.cameraMotion !== false;
    const bob = motion && moving ? Math.sin(this.time * 8.2) * 0.020 : 0;
    const sway = motion && moving ? Math.sin(this.time * 4.1 + 0.8) * 0.007 : 0;
    const breath = motion ? Math.sin(this.time * 1.6) * 0.004 : 0;
    this.camera.position.y += 1.67 + bob + breath;
    this.camera.rotation.set(this.pitch + breath * 0.25, this.player.rotationY + sway, sway * 0.35, 'YXZ');
  }
  dispose() { this.canvas.removeEventListener('pointermove', this.mouseMove); this.active = false; }
}
