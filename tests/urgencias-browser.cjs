const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:1408,height:900}});
 await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',r=>r.fulfill({path:require('node:path').join(__dirname,'../node_modules/three',r.request().url().split('three@0.160.0/')[1]),contentType:'text/javascript'}));
 const page=await context.newPage(),errors=[],logs=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.text().startsWith('[PrerenderScene]'))logs.push(m.text());});
 await page.goto('http://127.0.0.1:8765/?debugPrerender=1');
 await page.evaluate(async()=>{
  const {Game}=await import('/src/game/Game.js');document.getElementById('game-root').replaceChildren();window.game=new Game(document.getElementById('game-root'));await game.ready;await game.urgenciasBackdropReady;
  for(let i=0;i<60;i++)game.openingSequence.update(.05);game.clock.getDelta=()=>.05;
  window.pressE=()=>{game.input.justPressed.add('KeyE');game.update();};
  window.closeDialogue=()=>{for(let i=0;i<30&&game.dialogueManager.isOpen;i++)pressE();};
  window.walkTo=(x,z,stop)=>{for(let i=0;i<250;i++){
   const p=game.player.position,dx=x-p.x,dz=z-p.z;if(Math.hypot(dx,dz)<.1)break;
   game.player.rotationY=Math.atan2(-dx,-dz);game.player.group.rotation.y=game.player.rotationY;
   game.input.keys.add('KeyW');game.update();game.input.keys.clear();
   if(stop&&game.cameraManager.activeZone.id===stop)break;
  }return {position:game.player.position.toArray(),scene:game.cameraManager.activeZone.id};};
  game.prerenderViews.forEach(v=>v.debug.enabled=false);closeDialogue();
  window.rendered=[];const render=game.renderer.render.bind(game.renderer);
  game.renderer.render=(scene,camera)=>{if(game.area==='urgencias'){
   let legacyVisible=0;scene.traverseVisible(o=>{
    if(!o.isMesh||o===game.urgenciasBackdrop.plane||o.userData.preserveForBackplate)return;
    for(let p=o;p;p=p.parent)if(p.name==='player')return;
    legacyVisible++;
   });
   rendered.push({id:game.cameraManager.activeZone.id,plate:game.urgenciasBackdrop.plane.visible,floor:scene.getObjectByName('tiled-floor-urgencias').visible,legacyVisible});
  }render(scene,camera);};
  walkTo(0,3,'cam05');closeDialogue();
  walkTo(.1,-1);walkTo(.5,-2.55);pressE();
 });
 assert(await page.evaluate(()=>game.dialogueManager.isOpen));
 await page.evaluate(()=>closeDialogue());
 const afterDialogue=await page.evaluate(()=>({open:game.dialogueManager.isOpen,input:game.playerInputEnabled,busy:game.receptionDelivery.isBusy,unlocked:game.urgenciasUnlocked}));
 assert.deepEqual(afterDialogue,{open:false,input:true,busy:false,unlocked:true});
 await page.screenshot({path:'artifacts/urgencias-reception.png'});
 const entry=await page.evaluate(()=>{walkTo(-1.49,-3.7);walkTo(-1.49,-4.5);return walkTo(-1.49,-5.8,'cam02');});
 assert.equal(entry.scene,'cam02');
 await page.evaluate(()=>{walkTo(.3,-2.5);walkTo(.74,-2.6);pressE();game.update();});
 assert.equal(await page.evaluate(()=>game.cameraManager.activeZone.id),'urgencias_prerender');
 await page.screenshot({path:'artifacts/urgencias-entry.png'});
 const grounding=await page.evaluate(async()=>{
  const THREE=await import('three');return game.sceneNpcAnchors.visuals.filter(v=>v.zoneId==='urgencias_prerender').map(v=>{
   v.group.updateMatrixWorld(true);return {name:v.anchor.sourceName,bottom:new THREE.Box3().setFromObject(v.group).min.y,support:v.anchor.supportHeight||0};
  });
 });
 assert(grounding.every(n=>Math.abs(n.bottom-n.support)<1e-6));
 const reached=await page.evaluate(()=>walkTo(-.42457,1.29685));
 assert(Math.hypot(reached.position[0]+.42457,reached.position[2]-1.29685)<.15);
 await page.screenshot({path:'artifacts/urgencias-doctor.png'});
 await page.evaluate(()=>pressE());assert(await page.evaluate(()=>game.dialogueManager.isOpen));
 await page.evaluate(()=>{closeDialogue();game.update();});
 const delivery=await page.evaluate(()=>({completed:game.urgenciasSequence.completed,state:game.receptionDelivery.state,playerKit:!!game.player.model.getObjectByName('medicalKit'),doctorKit:!!game.urgenciasLevel.chiefDoctor.model.getObjectByName('medicalKit'),visualKit:!!game.sceneNpcAnchors.visuals.find(v=>v.anchor.sourceName==='Doctor responsable').group.getObjectByName('medicalKit-shot')}));
 assert.deepEqual(delivery,{completed:true,state:'awaitingSignature',playerKit:false,doctorKit:true,visualKit:true});
 await page.screenshot({path:'artifacts/urgencias-delivered.png'});
 await page.evaluate(()=>{game.prerenderViews.get('urgencias_prerender').debug.enabled=true;game.update();});
 await page.screenshot({path:'artifacts/urgencias-debug.png'});
 await page.evaluate(()=>{game.prerenderViews.get('urgencias_prerender').debug.enabled=false;walkTo(-1.8,2.5);walkTo(-2.48426,2.96716);pressE();});
 assert.equal(await page.evaluate(()=>game.cameraManager.activeZone.id),'cam02');
 assert(await page.evaluate(()=>rendered.length>10&&rendered.every(f=>f.id==='urgencias_prerender'&&f.plate&&!f.floor&&f.legacyVisible===0)));
 // Re-entry preserves the delivered state; the closed corridor door still
 // requires E in its authored bounds and does not trigger from its side.
 await page.evaluate(()=>{walkTo(.74,-2.6);pressE();game.update();});
 assert.equal(await page.evaluate(()=>game.cameraManager.activeZone.id),'urgencias_prerender');
 assert(await page.evaluate(()=>game.urgenciasSequence.completed));
 for(const [width,height] of [[800,1000],[1920,800]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{game.onResize();game.update();});
  assert(Math.abs(await page.evaluate(()=>game.cameraRig.camera.aspect)-1024/559)<1e-10);
  await page.screenshot({path:`artifacts/urgencias-${width}.png`});
 }
 assert.deepEqual(errors,[]);assert(logs.some(l=>l.includes('urgencias_prerender')));
 fs.writeFileSync('artifacts/urgencias-verification.json',JSON.stringify({afterDialogue,entry,reached,delivery,grounding,errors,logs},null,2));
 console.log(JSON.stringify({afterDialogue,entry,reached,delivery,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
