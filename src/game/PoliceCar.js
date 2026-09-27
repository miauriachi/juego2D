import * as THREE from 'three';
import { createCar } from './Vehicle.js';

// Follows the player's recorded wheel track at a safe arc-length gap; no chase AI.
export class PoliceCar {
  constructor(scene) {
    this.group = createCar(); this.group.name = 'PoliceCar'; scene.add(this.group); this.group.visible = false;
    this.history = []; this.distance =  55; this.time = 0;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const stripe = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0xe1e6e8 }));
    stripe.scale.set(1.83, 0.22, 2.7); stripe.position.y = 0.7; this.group.add(stripe);
    this.lamps = [-1, 1].map((side, index) => {
      const color = index ? 0x236aff : 0xff233c;
      const material = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(box, material); mesh.scale.set(0.55, 0.15, 0.28); mesh.position.set(side * 0.36, 1.66, 0); this.group.add(mesh);
      const light = new THREE.PointLight(color, 0, 40, 1.3); light.position.copy(mesh.position); this.group.add(light);
      return { mesh, light };
    });
    const door = (x, z) => {
      const hinge = new THREE.Group(); hinge.position.set(x, 0.75, z); this.group.add(hinge);
      const panel = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0xd7dfe3 }));
      panel.scale.set(0.07, 0.64, 0.9); panel.position.z = 0.45; hinge.add(panel); return hinge;
    };
    this.driverDoor = door(-0.92, -0.85); this.rearDoor = door(0.92, 0.2);
    this.group.children.filter(o => o.isMesh && Math.abs(o.scale.x - 1.58) < 0.001 && Math.abs(o.scale.y - 0.66) < 0.001).forEach(o => { o.visible = false; });
    const glass = new THREE.MeshLambertMaterial({ color: 0x405b70, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    for (const x of [-0.79, 0.79]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.52), glass); pane.position.set(x, 1.15, 0.1); pane.rotation.y = Math.PI / 2; this.group.add(pane);
    }
    for (const z of [-0.94, 1.13]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.52), glass); pane.position.set(0, 1.15, z); this.group.add(pane);
    }
  }
  update(dt, vehicle, road, active) {
    if (!this.history.length) {
      const s = -vehicle.position.z;
      for (let gap = 100; gap > 0; gap -= 1) this.history.push(new THREE.Vector3(road.centerX(s - gap), 0, -(s - gap)));
    }
    if (this.history.at(-1).distanceTo(vehicle.position) > 0.3) this.history.push(vehicle.position.clone());
    if (this.history.length > 700) this.history.shift();
    if (!active) return;
    this.group.visible = true; this.distance = Math.max(11, this.distance - dt * 3);
    let remaining = this.distance, next = vehicle.position;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const point = this.history[i], length = point.distanceTo(next);
      if (length >= remaining) {
        this.group.position.copy(next).lerp(point, remaining / length);
        const direction = next.clone().sub(point); this.group.rotation.y = Math.atan2(-direction.x, -direction.z); break;
      }
      remaining -= length; next = point;
    }
    // Never intersect the player even after reversing or a tight turn.
    const separation = this.group.position.clone().sub(vehicle.position);
    if (separation.length() < 8) this.group.position.copy(vehicle.position).add(new THREE.Vector3(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading)).multiplyScalar(9));
    this.flash(dt);
  }
  flash(dt, damaged = false) {
    this.time += dt;
    this.lamps.forEach(({ mesh, light }, i) => {
      const on = (Math.floor(this.time * 7) + i) % 2 === 0 && (!damaged || Math.sin(this.time * 2.4) > -0.4);
      mesh.material.color.setHex(on ? i ? 0x236aff : 0xff233c : 0x20252c); light.intensity = on ? 70 : 0;
    });
  }
}
