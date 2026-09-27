import { WalkMesh } from './WalkMesh.js';

// Room lifecycle and navigation. Camera selection consumes the returned portal;
// this class neither derives collision from camera zones nor changes visual scale.
export class PrerenderRoom {
  constructor(config) {
    this.config = config;
    this.active = false;
    this.navigation = new WalkMesh({ polygon: config.walkPolygon,
      obstacles: config.obstacles, radius: config.radius });
  }

  get portals() { return [...this.config.exitPortals, ...(this.config.returnPortal ? [this.config.returnPortal] : [])]; }

  place(player, anchor) {
    player.position.set(...anchor.position);
    player.previousPosition.copy(player.position);
    player.rotationY = anchor.rotationY;
    player.group.rotation.y = anchor.rotationY;
    player.velocity.set(0, 0, 0);
    player.animate(0, true);
  }

  enter(player, fromZone, anchorName = this.config.entryAnchors[fromZone] || 'spawnFromPrevious') {
    this.active = true;
    const anchor = this.config[anchorName];
    // Connected rooms share the inward -Z axis. Preserve W/S semantics even
    // when crossing backwards, rather than turning the actor at the camera cut.
    this.place(player, { ...anchor, rotationY: player.rotationY });
  }

  crossedPortal(player) {
    const p = player.position, previous = player.previousPosition;
    return this.portals.find(portal => {
      if (portal.trigger === 'interact') return false;
      const delta = p.z - previous.z;
      if (portal.bounds) {
        const b = portal.bounds;
        // An area trigger also works when arriving at the lower edge off-centre.
        const intent = Math.abs(delta) > 1e-8 ? delta : (player.velocity?.z ?? 0);
        return intent * portal.direction > 0 && p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;
      }
      if (delta * portal.direction <= 0) return false;
      const t = (portal.z - previous.z) / delta;
      if (t < 0 || t > 1) return false;
      const crossingX = previous.x + t * (p.x - previous.x);
      return crossingX >= portal.minX && crossingX <= portal.maxX;
    });
  }

  leave(player, portal) {
    this.active = false;
    // Both coordinate systems use -Z for inward travel. Preserve tank-control
    // heading, including backwards crossings, so a held key cannot bounce back.
    if (portal.target) this.place(player, { ...portal.target, rotationY: player.rotationY });
  }
}
