const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const output=process.env.EXTERIOR_OUTPUT||path.join(require('node:os').tmpdir(),'juego2D-exterior-evidence');fs.mkdirSync(output,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1536,height:864}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(process.env.THREE_MODULE_ROOT)await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',r=>r.fulfill({path:path.join(process.env.THREE_MODULE_ROOT,r.request().url().split('three@0.160.0/')[1]),contentType:'text/javascript'}));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8766');
 await page.evaluate(async()=>{
  const {Game}=await import('/src/game/Game.js');document.getElementById('game-root').replaceChildren();window.game=new Game(document.getElementById('game-root'));await game.ready;
  for(let i=0;i<60;i++)game.openingSequence.update(.05);game.clock.getDelta=()=>.05;
  game.openingSequence.phoneFinished=true;game.openingSequence.phone.element.hidden=true;
  game.raccoonDelivery.state='accepted';game.raccoonDelivery.ending='ACCEPTED';
  game.dialogueManager.isOpen=false;game.dialogueManager.panel.hidden=true;
  game.setupExterior();await game.exteriorLevel.backgroundReady;game.changeArea('exterior');game.update();
  window.step=()=>game.update();
  window.walkTo=async(x,z)=>{for(let i=0;i<300;i++){
   const p=game.player.position,dx=x-p.x,dz=z-p.z;if(Math.hypot(dx,dz)<.12)break;
   game.player.rotationY=Math.atan2(-dx,-dz);game.input.keys.add('KeyW');game.update();game.input.keys.clear();
  }game.update();return game.player.position.toArray();};
 });
 await page.screenshot({path:path.join(output,'exterior-spawn.png')});
 const calibration=await page.evaluate(async()=>{
  const T=await import('three'),c=game.cameraRig.camera;
  const foot=new T.Vector3(0,0,0).applyMatrix4(game.player.group.matrixWorld).project(c);
  const head=new T.Vector3(0,1.78,0).applyMatrix4(game.player.group.matrixWorld).project(c);
  return {spawn:game.player.position.toArray(),car:game.exteriorLevel.car.position.toArray(),verticalError:Math.abs(foot.x-head.x),foot:[(foot.x+1)/2,(1-foot.y)/2],carCorners:game.exteriorLevel.navigation.obstacles,
   background:game.scene.background.isTexture,aspect:c.aspect};
 });
 assert(calibration.verticalError<1e-6);assert(calibration.background);assert.equal(calibration.aspect,16/9);
 // The correction is local to the exterior and must not follow Bryan indoors.
 const restored=await page.evaluate(()=>{
  game.changeArea('reception');game.update();
  const result={auto:game.player.group.matrixAutoUpdate,scale:game.player.group.scale.toArray()};
  game.changeArea('exterior');game.update();return result;
 });
 assert.deepEqual(restored,{auto:true,scale:[1,1,1]});
 const approach=await page.evaluate(async()=>{
  const a=game.interactionManager.interactables.find(i=>i.id==='bryan-car').position;
  await walkTo(-4,5.8);await walkTo(-.5,6.3);await walkTo(2.1,6.2);await walkTo(a.x,a.z);
  return {position:game.player.position.toArray(),anchor:a.toArray(),hint:game.dialogueManager.hint.textContent,mode:game.mode};
 });
 assert(approach.hint.includes('Subir al auto'),JSON.stringify(approach));
 await page.screenshot({path:path.join(output,'exterior-car-interaction.png')});
 for(const [width,height] of [[800,1000],[1920,800]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{game.onResize();game.update();});
  assert.equal(await page.evaluate(()=>game.cameraRig.camera.aspect),16/9);
  await page.screenshot({path:path.join(output,`exterior-${width}.png`)});
 }
 await page.setViewportSize({width:1536,height:864});await page.evaluate(()=>{game.onResize();game.update();});
 const parked=await page.evaluate(()=>({p:game.exteriorLevel.car.position.toArray(),q:game.exteriorLevel.car.quaternion.toArray()}));
 await page.keyboard.press('KeyE');await page.evaluate(()=>step());
 assert.equal(await page.evaluate(()=>game.mode),'parkingDeparture');
 const boarding=await page.evaluate(()=>({p:game.exteriorLevel.car.position.toArray(),q:game.exteriorLevel.car.quaternion.toArray()}));
 assert.deepEqual(boarding,parked);
 const samples=[];
 for(const target of [1,2.5,4,5.5,7]){
  samples.push(await page.evaluate(target=>{while(game.parkingDeparture.time<target)game.update();return {time:game.parkingDeparture.time,position:game.exteriorLevel.car.position.toArray(),heading:game.exteriorLevel.car.rotation.y};},target));
  await page.screenshot({path:path.join(output,`exterior-departure-${target}.png`)});
 }
 console.log(JSON.stringify({calibration,approach,parked,boarding,samples,errors},null,2));
 fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({calibration,approach,parked,boarding,samples,errors},null,2));
 assert.deepEqual(errors,[]);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

