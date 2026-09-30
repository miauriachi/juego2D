import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../node_modules/three/build/three.module.js';
import {urgenciasConfig as config} from '../src/game/UrgenciasConfig.js';
import {PrerenderRoom} from '../src/game/PrerenderRoom.js';
const room=new PrerenderRoom(config),nav=room.navigation;
const camera=new THREE.PerspectiveCamera(config.camera.fov,config.aspect,.1,1000);
camera.position.set(...config.camera.cameraPosition);camera.lookAt(...config.camera.lookAt);camera.updateMatrixWorld();
function floor(u,v){const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(2*u-1,1-2*v),camera);return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());}
test('painted furniture is excluded while treatment doors and central floor remain accessible',()=>{
 for(const uv of [[.125,.615],[.25,.59],[.335,.61],[.73,.635],[.8,.9],[.6,.86]]){
  const p=floor(...uv);assert(!nav.allows(p.x,p.z),`furniture ${uv}`);
 }
 for(const uv of [[.19,.86],[.4,.75],[.385,.64],[.445,.64],[.46,.68],[.13,.89]]){
  const p=floor(...uv);assert(nav.allows(p.x,p.z),`floor ${uv}`);
 }
 for(const a of [config.spawnFromCorridor,...config.interactionAnchors])assert(nav.allows(a.position[0],a.position[2]));
});
test('random and large movements cannot put Bryan onto furniture or above Y=0',()=>{
 let p={x:config.spawnFromCorridor.position[0],y:0,z:config.spawnFromCorridor.position[2]},seed=17;
 for(let i=0;i<5000;i++){
  seed=(seed*1664525+1013904223)>>>0;const a=seed/2**32*Math.PI*2,step=i%23===0?30:.2;
  const actor={previousPosition:{...p},position:{x:p.x+Math.cos(a)*step,y:0,z:p.z+Math.sin(a)*step}};
  nav.resolve(actor);p=actor.position;assert(nav.allows(p.x,p.z));assert.equal(p.y,0);
 }
});
test('closed door return is an explicit interaction, never an automatic wall crossing',()=>{
 const b=config.returnPortal.bounds,p={x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2};
 assert.equal(room.crossedPortal({position:p,previousPosition:{...p,z:p.z-.1},velocity:{z:1}}),undefined);
 assert.equal(config.returnPortal.targetZone,'cam02');assert.equal(config.returnPortal.targetAnchor,'spawnFromUrgenciasReturn');
});
