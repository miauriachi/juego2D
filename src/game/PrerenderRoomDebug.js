import * as THREE from 'three';
import { prerenderDebugEnabled } from './PrerenderDebugConfig.js';

export class PrerenderRoomDebug {
  constructor(scene, config) {
    this.enabled = config.debug || prerenderDebugEnabled();
    this.group = new THREE.Group();
    this.group.name = `${config.id}-navigation-debug`;
    this.group.visible = false;
    const line = (points, color, closed = true) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => new THREE.Vector3(x, 0.025, z)));
      const material = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 });
      const mesh = closed ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
      mesh.userData.preserveForBackplate = true;
      mesh.renderOrder = 1000;
      this.group.add(mesh);
    };
    line(config.walkPolygon, 0x64ff84);
    config.obstacles.forEach(obstacle => line(obstacle.polygon, 0xff695a));
    for (const anchor of Object.values(config.npcAnchors || {})) {
      const [x, , z] = anchor.position;
      line([[x - 0.16, z - 0.16], [x + 0.16, z - 0.16],
        [x + 0.16, z + 0.16], [x - 0.16, z + 0.16]], 0xf08aff);
      line([[x, z], [x - Math.sin(anchor.rotationY) * 0.4,
        z - Math.cos(anchor.rotationY) * 0.4]], 0xf08aff, false);
    }
    for (const anchor of [config.spawnFromPrevious, config.spawnFromNext].filter(Boolean)) {
      const [x, , z] = anchor.position;
      line([[x - 0.18, z], [x + 0.18, z]], 0x65cfff, false);
      line([[x, z - 0.18], [x, z + 0.18]], 0x65cfff, false);
      line(Array.from({ length: 32 }, (_, i) => [x + Math.cos(i * Math.PI / 16) * config.radius,
        z + Math.sin(i * Math.PI / 16) * config.radius]), 0x65cfff);
    }
    [...config.exitPortals, ...(config.returnPortal ? [config.returnPortal] : [])].forEach(portal => {
      if (portal.bounds) {
        const b = portal.bounds;
        line([[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]], 0xffe66b);
      }
      line([[portal.minX, portal.z], [portal.maxX, portal.z]], 0xffe66b, false);
      const x = (portal.minX + portal.maxX) / 2, z = portal.z + portal.direction * 0.25;
      line([[x, portal.z], [x, z], [x - 0.1, z - portal.direction * 0.1],
        [x, z], [x + 0.1, z - portal.direction * 0.1]], 0xffe66b, false);
    });
    scene.add(this.group);
  }

  update(active, input) {
    if (active && input.isJustPressed('F8')) this.enabled = !this.enabled;
    this.group.visible = active && this.enabled;
  }
}
