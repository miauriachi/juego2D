import { PLAYER_RADIUS, WORLD_BOUNDS } from '../config/constants.js';

export class CollisionSystem {
  constructor() {
    this.bounds = WORLD_BOUNDS;
    this.colliders = [];
  }

  addCollider({ minX, maxX, minZ, maxZ }) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
  }

  resolve(player) {
    const position = player?.position ?? player?.group?.position ?? player?.mesh?.position ?? player?.object?.position;
    if (!position) return;

    position.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, position.x));
    position.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, position.z));

    const playerHalfX = PLAYER_RADIUS;
    const playerHalfZ = PLAYER_RADIUS;

    for (const collider of this.colliders) {
      const intersectsX = position.x + playerHalfX > collider.minX && position.x - playerHalfX < collider.maxX;
      const intersectsZ = position.z + playerHalfZ > collider.minZ && position.z - playerHalfZ < collider.maxZ;

      if (!intersectsX || !intersectsZ) continue;

      const deltaLeft = Math.abs(position.x + playerHalfX - collider.minX);
      const deltaRight = Math.abs(collider.maxX - (position.x - playerHalfX));
      const deltaTop = Math.abs(position.z + playerHalfZ - collider.minZ);
      const deltaBottom = Math.abs(collider.maxZ - (position.z - playerHalfZ));

      const smallest = Math.min(deltaLeft, deltaRight, deltaTop, deltaBottom);

      if (smallest === deltaLeft) position.x = collider.minX - playerHalfX;
      else if (smallest === deltaRight) position.x = collider.maxX + playerHalfX;
      else if (smallest === deltaTop) position.z = collider.minZ - playerHalfZ;
      else position.z = collider.maxZ + playerHalfZ;
    }

    // A narrow gap can make one correction push the player into another wall.
    // Reject that movement, allowing for floating-point error at contact edges.
    if (player.previousPosition && this.colliders.some((collider) =>
      position.x + playerHalfX > collider.minX + 1e-8 &&
      position.x - playerHalfX < collider.maxX - 1e-8 &&
      position.z + playerHalfZ > collider.minZ + 1e-8 &&
      position.z - playerHalfZ < collider.maxZ - 1e-8
    )) {
      position.copy(player.previousPosition);
    }

    position.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, position.x));
    position.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, position.z));
  }
}
