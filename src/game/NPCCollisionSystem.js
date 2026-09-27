import { PLAYER_RADIUS } from '../config/constants.js';

// Lightweight XZ circles, independent of the permanent scene colliders.
export class NPCCollisionSystem {
  radius(npc) { return npc.type === 'Receptionist' ? 0.36 : 0.30; }

  blocks(npc) { return npc.type !== 'PatientLying'; } // Beds already block their occupants.

  canMove(npc, previous, npcs, player) {
    const p = npc.group.position;
    const others = npcs.filter(other => other !== npc && this.blocks(other))
      .map(other => ({ position: other.group.position, radius: this.radius(other) }));
    if (player) others.push({ position: player.position, radius: PLAYER_RADIUS });
    return others.every(other => {
      const distance = Math.hypot(p.x - other.position.x, p.z - other.position.z);
      const oldDistance = Math.hypot(previous.x - other.position.x, previous.z - other.position.z);
      // Permit escape from existing contact, but never move deeper into it.
      return distance >= this.radius(npc) + other.radius + 0.04 || distance >= oldDistance - 1e-8;
    });
  }

  resolvePlayer(player, npcs, sceneCollisions) {
    const p = player.position;
    const actors = npcs.filter(npc => this.blocks(npc));
    for (let pass = 0; pass < 4; pass++) {
      for (const npc of actors) {
        const q = npc.group.position, minimum = PLAYER_RADIUS + this.radius(npc);
        let dx = p.x - q.x, dz = p.z - q.z;
        let distance = Math.hypot(dx, dz);
        if (distance >= minimum) continue;
        if (distance < 1e-8) {
          dx = player.previousPosition.x - q.x; dz = player.previousPosition.z - q.z;
          distance = Math.hypot(dx, dz);
          if (distance < 1e-8) { dx = 1; dz = 0; distance = 1; }
        }
        p.x = q.x + dx / distance * (minimum + 0.001);
        p.z = q.z + dz / distance * (minimum + 0.001);
      }
      sceneCollisions.resolve(player);
    }
    // A crowded wall contact must not push Bryan through geometry or another actor.
    if (actors.some(npc => Math.hypot(p.x - npc.group.position.x, p.z - npc.group.position.z)
      < PLAYER_RADIUS + this.radius(npc) - 1e-6)) {
      p.copy(player.previousPosition);
      sceneCollisions.resolve(player);
    }
  }
}
