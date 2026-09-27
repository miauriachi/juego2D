import test from 'node:test';
import assert from 'node:assert/strict';
import { receptionWideConfig as config } from '../src/game/ReceptionWideConfig.js';
import { PrerenderRoom } from '../src/game/PrerenderRoom.js';
const room=new PrerenderRoom(config),nav=room.navigation;
function step(p,dx,dz){const player={previousPosition:{...p},position:{x:p.x+dx,y:0,z:p.z+dz}};nav.resolve(player);return {p:player.position,portal:room.crossedPortal(player)?.id};}
test('both scene anchors are on the visible walkable floor',()=>{
 for(const a of [config.spawnFromPrevious,config.spawnFromNext])assert(nav.allows(a.position[0],a.position[2]));
});
test('every traversable doorway lane triggers, including the formerly missed edge',()=>{
 for(const x of [-1.49,-1.47,-1.30,-1.12,-1.10]){
  let p={x,y:0,z:-4.5},crossed=false;
  for(let i=0;i<36;i++){const r=step(p,0,-.04);p=r.p;crossed ||=r.portal==='wards';}
  assert(crossed,`valid doorway lane ${x} did not trigger`);
 }
 assert.equal(room.crossedPortal({position:{x:-1.298,z:-5.6},previousPosition:{x:-1.298,z:-5.6},velocity:{z:-1}})?.id,'wards');
 assert.equal(room.crossedPortal({position:{x:-1.298,z:-5.6},previousPosition:{x:-1.298,z:-5.6},velocity:{z:1}}),undefined);
});
test('only the visible open leaf permits crossing; walls and jambs block every side approach',()=>{
 for(const x of [-1.77,-1.6,-1.55,-1.05,-.8732,-.59,0,.59]){
  let p={x,y:0,z:-3.53},crossed=false;
  assert(nav.allows(p.x,p.z),`test start ${x} must be valid`);
  for(let i=0;i<40;i++){const r=step(p,0,-.1);p=r.p;crossed ||= !!r.portal;}
  assert(!crossed,`side ${x} activated portal`);assert(p.z> -4.946,`side ${x} crossed solid wall`);
 }
 let p={x:-1.298,y:0,z:-3.53},crossed=false;
 for(let i=0;i<24;i++){const r=step(p,0,-.1);p=r.p;crossed ||=r.portal==='wards';}
 assert(crossed);assert(p.z< -5.359);
});
test('large steps and repeated contact cannot tunnel into furniture',()=>{
 for(const [dx,dz] of [[100,0],[-100,0],[30,-40],[-30,40]]){
  const {p}=step({x:0,y:0,z:1.069168},dx,dz);assert(nav.allows(p.x,p.z));
 }
 let p={x:0,y:0,z:1.069168},seed=42;
 for(let i=0;i<5000;i++){seed=(seed*1664525+1013904223)>>>0;const a=seed/2**32*2*Math.PI;p=step(p,Math.cos(a)*.23,Math.sin(a)*.23).p;assert(nav.allows(p.x,p.z));assert.equal(p.y,0);}
});
test('return remains an explicit wide region, separate from the collision polygon',()=>{
 for(const x of [-.7,0,.7])assert.equal(room.crossedPortal({position:{x,z:2.016},previousPosition:{x,z:1.898},velocity:{z:.1}})?.id,'entrance');
});

