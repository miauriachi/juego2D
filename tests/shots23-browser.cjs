const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',r=>r.fulfill({path:require('node:path').join(__dirname,'../node_modules/three',r.request().url().split('three@0.160.0/')[1]),contentType:'text/javascript'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.text().includes('[prerender calibration]'))console.log(m.text());if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text());});
 await page.goto('http://127.0.0.1:8765/');await page.evaluate(async()=>{
  const {Game}=await import('/src/game/Game.js');document.getElementById('game-root').replaceChildren();window.game=new Game(document.getElementById('game-root'));await game.ready;
  const THREE=await import('three');const {SceneNpcAnchors}=await import('/src/game/SceneNpcAnchors.js');
  const {receptionWideConfig:before}=await import('/artifacts/before_latest_calibration/ReceptionWideConfig.js');
  window.baselineNPCs=new SceneNpcAnchors(new THREE.Scene(),game.npcManager,[before]);
  for(let i=0;i<60;i++)game.openingSequence.update(.05);game.clock.getDelta=()=>.05;
  window.frames=[];const render=game.renderer.render.bind(game.renderer);
  game.renderer.render=(scene,camera)=>{if(game.area==='reception')frames.push({id:game.cameraManager.activeZone.id,key:game.prerenderBackdrop.currentKey,plate:game.prerenderBackdrop.plane.visible,floor:game.scene.getObjectByName('tiled-floor').visible});render(scene,camera);};
  window.walk=(angle,count,key='KeyW',stop)=>{game.player.rotationY=angle;game.player.group.rotation.y=angle;game.input.keys.add(key);for(let i=0;i<count;i++){game.update();if(stop&&game.cameraManager.activeZone.id===stop)break;}game.input.keys.clear();};
  window.showRoom=(id,pos)=>{game.enterPrerenderRoom(id,'cam-entrance');if(pos){game.player.position.set(...pos);game.player.previousPosition.copy(game.player.position);}game.input.keys.clear();game.update();};
 });
 await page.screenshot({path:'artifacts/shots23-entrance-regression.png'});
 await page.evaluate(()=>walk(0,40,'KeyW','cam05'));
 assert.deepEqual(await page.evaluate(()=>game.player.position.toArray()),[0,0,1.069168]);
 await page.screenshot({path:'artifacts/shots23-reception.png'});
 const calibration=await page.evaluate(async()=>{
  const THREE=await import('three'),old=new THREE.PerspectiveCamera(36,1024/559,.1,1000);old.position.set(0,1.3,6.5);old.lookAt(0,.85,-2.8);old.updateMatrixWorld();const c=game.cameraRig.camera;c.updateMatrixWorld();
  const height=(camera,z)=>new THREE.Vector3(0,1.78,z).project(camera).y-new THREE.Vector3(0,0,z).project(camera).y;
  const box=new THREE.Box3().setFromObject(game.bryanVisual.group);
  return {spawnRatio:height(c,1.069168)/height(old,1.8976),counterRatio:height(c,-1.17)/height(old,0),height:box.max.y-box.min.y,feet:box.min.y,scale:game.player.group.scale.toArray()};
 });
 assert(calibration.spawnRatio>.82&&calibration.spawnRatio<.87);assert(calibration.counterRatio>.82&&calibration.counterRatio<.87);assert(Math.abs(calibration.height-1.78)<1e-5);assert(Math.abs(calibration.feet)<1e-5);assert.deepEqual(calibration.scale,[1,1,1]);
 // Compare the actual seated mesh vertices against the approved previous shot.
 const patientProjection=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {SceneNpcAnchors}=await import('/src/game/SceneNpcAnchors.js');
  const {receptionWideConfig:before}=await import('/artifacts/before_latest_calibration/ReceptionWideConfig.js');
  const baseline=window.baselineNPCs;
  const old=baseline.visuals.find(v=>v.group.name.endsWith('seatedPatient')).group;
  const current=game.sceneNpcAnchors.visuals.find(v=>v.group.name==='shot-npc:cam05:seatedPatient').group;
  const camera=new THREE.PerspectiveCamera(before.camera.fov,before.aspect,.1,1000);
  camera.position.set(...before.camera.cameraPosition);camera.lookAt(...before.camera.lookAt);camera.updateMatrixWorld();
  old.updateMatrixWorld(true);current.updateMatrixWorld(true);
  function vertices(group,cam){const result=[];group.traverse(m=>{if(!m.isMesh)return;const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++)result.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld).project(cam));});return result;}
  const a=vertices(old,camera),b=vertices(current,game.cameraRig.camera);
  return {vertices:a.length,maxScreenError:Math.max(...a.map((v,i)=>Math.hypot(v.x-b[i].x,v.y-b[i].y)))};
 });
 assert(patientProjection.vertices>100);assert(patientProjection.maxScreenError<1e-6);
 const npcs=await page.evaluate(async()=>{
  const THREE=await import('three');return game.sceneNpcAnchors.visuals.filter(v=>v.zoneId!=='urgencias_prerender').map(v=>({name:v.group.name,visible:v.group.visible,feet:new THREE.Box3().setFromObject(v.group).min.y,position:v.group.position.toArray()}));
 });
 assert.equal(npcs.filter(n=>n.visible).length,2);assert(npcs.every(n=>Math.abs(n.feet)<1e-6));
 // Compare actual framebuffer pixels with the receptionist on/off. Lower counter
 // must be identical while her upper silhouette must contribute visible pixels.
 const occlusion=await page.evaluate(()=>{
  const r=game.renderer,gl=r.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,v=game.sceneNpcAnchors.visuals[0].group;
  function capture(){r.render(game.scene,game.cameraRig.camera);const p=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;}
  v.visible=true;const on=capture();v.visible=false;const off=capture();v.visible=true;r.render(game.scene,game.cameraRig.camera);
  const viewH=w/(1024/559),bottom=(h-viewH)/2;let changed=0,leaked=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4;if(on[i]===off[i]&&on[i+1]===off[i+1]&&on[i+2]===off[i+2])continue;
   changed++;const u=x/w,t=1-(y-bottom)/viewH;if(u>.64&&u<.94&&t>.60&&t<.90)leaked++;
  }return {changed,leaked};
 });
 assert(occlusion.changed>500);assert.equal(occlusion.leaked,0);
 await page.evaluate(()=>{game.input.justPressed.add('F8');game.update();});await page.screenshot({path:'artifacts/shots23-debug.png'});
 assert(await page.evaluate(()=>game.receptionWideView.debug.group.visible));await page.evaluate(()=>{game.input.justPressed.add('F8');game.update();});
 const doorway=[];
 for(const x of [-1.77,-1.55,-1.05,-.59,0,.59])doorway.push(await page.evaluate(x=>{showRoom('cam05',[x,0,-3.53]);walk(0,35);return {x,id:game.cameraManager.activeZone.id,z:game.player.position.z};},x));
 assert(doorway.every(p=>p.id==='cam05'&&p.z> -4.946));
 await page.evaluate(()=>{showRoom('cam05',[-1.298,0,-4.828]);game.player.rotationY=0;game.update();});await page.screenshot({path:'artifacts/shots23-open-door.png'});
 await page.evaluate(()=>walk(0,15,'KeyW','cam02'));
 assert.equal(await page.evaluate(()=>game.cameraManager.activeZone.id),'cam02');assert.deepEqual(await page.evaluate(()=>game.player.position.toArray()),[.3,0,3.16]);
 assert.equal(await page.evaluate(()=>game.sceneNpcAnchors.visuals.filter(v=>v.group.visible).length),1);
 await page.screenshot({path:'artifacts/shots23-corridor.png'});
 const corridorCalibration=await page.evaluate(async()=>{
  const THREE=await import('three'),old=new THREE.PerspectiveCamera(44,1024/559,.1,1000);
  old.position.set(.3,1.55,7);old.lookAt(.3,1,-5);old.updateMatrixWorld();
  const height=(camera,x,z,h)=>new THREE.Vector3(x,h,z).project(camera).y-new THREE.Vector3(x,0,z).project(camera).y;
  const c=game.cameraRig.camera;
  return {playerRatio:height(c,.3,3.16,1.78)/height(old,.3,2.2,1.78),patientRatio:height(c,2.02,1.88,1)/height(old,2.45,.6,1),scale:game.player.group.scale.toArray()};
 });
 assert(corridorCalibration.playerRatio>1.24&&corridorCalibration.playerRatio<1.28);
 assert(corridorCalibration.patientRatio>1.24&&corridorCalibration.patientRatio<1.28);
 assert.deepEqual(corridorCalibration.scale,[1,1,1]);
 const roundtrip=await page.evaluate(()=>{walk(0,15,'KeyS','cam05');const p=game.player.position.toArray();walk(0,1,'KeyS');return {id:game.cameraManager.activeZone.id,p,next:game.player.position.z};});
 assert.equal(roundtrip.id,'cam05');assert.deepEqual(roundtrip.p,[-1.298,0,-4.769]);assert(roundtrip.next>-4.769);
 for(const x of [-.9,0,.9]){
  const result=await page.evaluate(x=>{showRoom('cam05',[x,0,1.069168]);walk(0,20,'KeyS','cam-entrance');const p=game.player.position.toArray();walk(0,1,'KeyS');return {id:game.cameraManager.activeZone.id,p,after:game.player.position.z,npcs:game.sceneNpcAnchors.visuals.filter(v=>v.group.visible).length};},x);
  assert.equal(result.id,'cam-entrance');assert.equal(result.p[2],4.05);assert(result.after>4.05);assert.equal(result.npcs,0);
 }
 // NPC anchors remain static through simulation and never move the logical source.
 const staticNPC=await page.evaluate(()=>{showRoom('cam05');const before=game.sceneNpcAnchors.visuals.map(v=>v.group.matrixWorld.toArray());for(let i=0;i<100;i++)game.update();return {before,after:game.sceneNpcAnchors.visuals.map(v=>v.group.matrixWorld.toArray()),source:game.npcManager.npcs.find(n=>n.name==='Recepcionista').group.position.toArray()};});
 assert.deepEqual(staticNPC.before,staticNPC.after);assert.deepEqual(staticNPC.source,[-5.9,0,2.075]);
 // Original callbacks still work at the room's authored interaction anchors.
 const interaction=await page.evaluate(()=>{const a=game.receptionWide.config.interactionAnchors[0];showRoom('cam05',a.position);game.input.justPressed.add('KeyE');game.update();const started=game.dialogueManager.isOpen;for(let i=0;i<10&&game.dialogueManager.isOpen;i++){game.input.justPressed.add('KeyE');game.update();}return {started,unlocked:game.urgenciasUnlocked};});
 assert.deepEqual(interaction,{started:true,unlocked:true});
 for(const [width,height] of [[800,1000],[1920,800]])for(const id of ['cam05','cam02']){
  await page.setViewportSize({width,height});await page.evaluate(id=>{showRoom(id);game.onResize();game.update();},id);
  assert(Math.abs(await page.evaluate(()=>game.cameraRig.camera.aspect)-1024/559)<1e-10);
  await page.screenshot({path:`artifacts/shots23-${id}-${width}.png`});
 }
 assert(await page.evaluate(()=>frames.every(f=>f.plate&&!f.floor&&(f.id!=='cam02'||f.key==='hospital-corridor'))));
 assert.deepEqual(errors,[]);
 for(const [file,hash] of Object.entries(JSON.parse(fs.readFileSync('artifacts/reception-protected-hashes.json'))))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,file);
 console.log(JSON.stringify({calibration,patientProjection,corridorCalibration,occlusion,npcs,doorway,roundtrip,interaction,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
