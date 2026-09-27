// Pure X/Z navigation. No renderer, camera, model transforms or NPC ownership.
function inside(x, z, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[i], [bx, bz] = polygon[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) result = !result;
  }
  return result;
}

function edgeDistance(x, z, polygon) {
  let distance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, az] = polygon[i], [bx, bz] = polygon[(i + 1) % polygon.length];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return distance;
}

export class WalkMesh {
  constructor({ polygon, obstacles, radius, domain }) {
    Object.assign(this, { polygon, obstacles, radius, domain });
  }

  owns(position) {
    const d = this.domain;
    return position.x >= d.minX && position.x <= d.maxX && position.z >= d.minZ && position.z <= d.maxZ;
  }

  allows(x, z) {
    return inside(x, z, this.polygon) && edgeDistance(x, z, this.polygon) >= this.radius - 1e-8 &&
      this.obstacles.every(({ polygon }) => !inside(x, z, polygon) && edgeDistance(x, z, polygon) >= this.radius - 1e-8);
  }

  resolve(player) {
    const p = player.position, previous = player.previousPosition;
    const dx = p.x - previous.x, dz = p.z - previous.z;
    // Sweep in short steps so even a large timestep cannot jump over an obstacle.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (this.radius / 3)));
    let x = previous.x, z = previous.z;
    for (let step = 0; step < steps; step++) {
      const nx = x + dx / steps, nz = z + dz / steps;
      if (this.allows(nx, nz)) { x = nx; z = nz; }
      else if (this.allows(nx, z)) x = nx;
      else if (this.allows(x, nz)) z = nz;
    }
    p.x = x; p.y = 0; p.z = z;
  }
}
