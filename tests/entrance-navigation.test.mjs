import assert from 'node:assert/strict';
import test from 'node:test';
import { WalkMesh } from '../src/game/WalkMesh.js';
import { ENTRANCE_NAVIGATION, ENTRANCE_SPAWN } from '../src/game/EntranceConfig.js';
const nav = new WalkMesh(ENTRANCE_NAVIGATION);
function move(p, dx, dz) {
  const player = { previousPosition: { ...p }, position: { x:p.x+dx, y:0, z:p.z+dz } };
  nav.resolve(player); return player.position;
}
test('spawn and straight portal route are walkable; floor Y stays zero', () => {
  let p = {x: ENTRANCE_SPAWN[0], y:0, z: ENTRANCE_SPAWN[2]};
  assert(nav.allows(p.x,p.z));
  for(let i=0;i<30;i++) { p=move(p,0,-.1); assert.equal(p.y,0); }
  assert(p.z<3.5, 'interior must remain reachable');
});
test('swept movement cannot tunnel through doors, reception or chairs', () => {
  for(const [dx,dz] of [[100,0],[-100,0],[0,100],[100,100],[-100,100]]) {
    const p=move({x:0,y:0,z:6.4},dx,dz);
    assert(nav.allows(p.x,p.z)); assert(p.z<=7.73+1e-8);
  }
});
test('sliding along obstacles keeps the radius clear over repeated motion', () => {
  let p={x:0,y:0,z:6.4};
  let seed=42;
  for(let i=0;i<5000;i++) {
    seed=(seed*1664525+1013904223)>>>0; const angle=seed/2**32*Math.PI*2;
    p=move(p,Math.sin(angle)*.23,Math.cos(angle)*.23);
    assert(nav.allows(p.x,p.z)); assert.equal(p.y,0);
  }
});
