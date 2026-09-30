import * as THREE from 'three';
import { PLAYER_RADIUS } from '../config/constants.js';

// Local steering with persistent passing side; authored waypoints remain unchanged.
export class NPCAvoidance {
  constructor(collision, actors) { this.collision = collision; this.actors = actors; this.states = new WeakMap(); }
  clearSegment(a, b, radius, others) {
    const bounds = this.collision.bounds;
    if (b.x < bounds.minX || b.x > bounds.maxX || b.z < bounds.minZ || b.z > bounds.maxZ) return false;
    for (const wall of this.collision.colliders) {
      let enter = 0, exit = 1;
      for (const [axis, min, max] of [['x', wall.minX - radius, wall.maxX + radius], ['z', wall.minZ - radius, wall.maxZ + radius]]) {
        const delta = b[axis] - a[axis];
        if (Math.abs(delta) < 1e-8) { if (a[axis] < min || a[axis] > max) { exit = -1; break; } }
        else { const x = (min - a[axis]) / delta, y = (max - a[axis]) / delta; enter = Math.max(enter, Math.min(x, y)); exit = Math.min(exit, Math.max(x, y)); }
      }
      if (enter <= exit) return false;
    }
    const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
    for (const other of others) {
      const p = other.position, minimum = radius + other.radius + 0.035;
      const t = length2 ? THREE.MathUtils.clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / length2, 0, 1) : 0;
      const closest = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
      const old = Math.hypot(a.x - p.x, a.z - p.z), next = Math.hypot(b.x - p.x, b.z - p.z);
      if (closest < minimum && !(old < minimum && next > old + 1e-6 && t === 0)) return false;
    }
    return true;
  }
  move(npc, target, step, dt, npcs, player) {
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    dt = Math.min(dt, 0.05); step = Math.min(step, npc.walkSpeed * dt);
    let state = this.states.get(npc);
    if (!state) {
      state = { side: 1, hold: 0, wait: 0, path: [], direction: new THREE.Vector3() };
      this.states.set(npc, state);
    }
    const p = npc.group.position, radius = this.actors.radius(npc);
    const others = npcs.filter(o => o !== npc && this.actors.blocks(o))
      .map(o => ({ position: o.group.position, radius: this.actors.radius(o) }));
    if (player) others.push({ position: player.position, radius: PLAYER_RADIUS });
    npc.avoidanceDirection = state.direction;
    state.direction.set(0, 0, 0); state.hold = Math.max(0, state.hold - dt);
    if (state.target !== target) { state.target = target; state.path = []; state.wait = 0; }
    const waiting = () => { npc.steeringState = 'WAITING'; return 0; };
    if (step / dt < 0.05 && p.distanceTo(target) > 0.005) return waiting();
    // A person standing on the destination cannot be circumnavigated into that destination.
    const occupied = others.some(o => o.position.distanceTo(target) < radius + o.radius + 0.06);
    if (occupied && p.distanceTo(target) < 1.5) { state.path = []; return waiting(); }
    if (state.wait > 0) { state.wait -= dt; return waiting(); }
    while (state.path.length && p.distanceTo(state.path[0]) < 0.025) state.path.shift();
    let destination = state.path[0] || target;
    if (occupied) destination = p.clone().lerp(target, Math.max(0, 1 - 1.45 / p.distanceTo(target)));
    if (!this.clearSegment(p, destination, radius, others)) {
      // Never steer around a steering waypoint: stop, then plan from the authored route.
      if (state.path.length) { state.path = []; state.wait = 0.8; return waiting(); }
      const forward = target.clone().sub(p).setY(0).normalize();
      const left = new THREE.Vector3(forward.z, 0, -forward.x);
      const sides = state.hold > 0 ? [state.side] : [state.side, -state.side];
      let route = null;
      for (const side of sides) {
        for (const offset of [1, 1.5, 2.1]) {
          const a = p.clone().addScaledVector(left, side * offset);
          const b = a.clone().addScaledVector(forward, Math.min(2.5, p.distanceTo(target)));
          if (this.clearSegment(p, a, radius, others) && this.clearSegment(a, b, radius, others)
            && this.clearSegment(b, target, radius, others)) {
            route = [a, b]; state.side = side; state.hold = 1.2; break;
          }
        }
        if (route) break;
      }
      if (!route) { state.wait = 0.8; return waiting(); }
      state.path = route; destination = route[0];
    }
    npc.steeringState = state.path.length ? 'AVOIDING' : 'NORMAL';
    npc.sideChoice = state.side === 1 ? 'LEFT' : 'RIGHT';
    const direction = destination.clone().sub(p).setY(0), distance = direction.length();
    if (distance < 1e-8) return 0;
    direction.divideScalar(distance);
    const yaw = Math.atan2(-direction.x, -direction.z);
    const delta = shortestAngleDifference(npc.group.rotation.y, yaw);
    npc.group.rotation.y += THREE.MathUtils.clamp(delta, -3.2 * dt, 3.2 * dt);
    // A clear destination permits a turn in place; translation only follows facing.
    if (Math.abs(shortestAngleDifference(npc.group.rotation.y, yaw)) > 0.12) return 0;
    const moved = Math.min(step, distance);
    const next = p.clone().addScaledVector(direction, moved);
    if (!this.clearSegment(p, next, radius, others)) { state.wait = 0.8; return waiting(); }
    p.copy(next); state.direction.copy(direction); return moved;
  }
}

export function shortestAngleDifference(currentAngle, targetAngle) {
  return Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
}
