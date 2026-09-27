import test from 'node:test';
import assert from 'node:assert/strict';
import { corridorConfig as config } from '../src/game/CorridorConfig.js';
import { PrerenderRoom } from '../src/game/PrerenderRoom.js';
const room=new PrerenderRoom(config),nav=room.navigation;
function move(p,dx,dz){const player={previousPosition:{...p},position:{x:p.x+dx,y:0,z:p.z+dz}};nav.resolve(player);return player.position;}
test('corridor anchors, centre route and original door access are reachable',()=>{
 for(const a of [config.spawnFromPrevious,config.spawnFromNext])assert(nav.allows(a.position[0],a.position[2]));
 let p={x:.3,y:0,z:3.16};for(let i=0;i<80;i++)p=move(p,0,-.1);
 assert(p.z< -2.84);assert(nav.allows(p.x,p.z));
});
test('corridor obstacles and swept movement protect the painted furniture',()=>{
 for(const [x,z] of [[-1.14,3.8],[1.66,3],[1.5,.6],[-.74,-1.8],[.86,-3.48]])assert(!nav.allows(x,z));
 for(const [dx,dz] of [[100,0],[-100,0],[30,-40],[-30,40]])assert(nav.allows(...((p)=>[p.x,p.z])(move({x:.3,y:0,z:3.16},dx,dz))));
 let p={x:.3,y:0,z:3.16},seed=42;
 for(let i=0;i<5000;i++){seed=(seed*1664525+1013904223)>>>0;const a=seed/2**32*2*Math.PI;p=move(p,Math.cos(a)*.23,Math.sin(a)*.23);assert(nav.allows(p.x,p.z));assert.equal(p.y,0);}
});
test('return region activates off-centre and when already past its leading edge',()=>{
 for(const x of [-.3,.3,1])assert.equal(room.crossedPortal({position:{x,z:4},previousPosition:{x,z:4},velocity:{z:.1}})?.id,'reception');
 assert.equal(room.crossedPortal({position:{x:.3,z:4},previousPosition:{x:.3,z:4},velocity:{z:-.1}}),undefined);
});
