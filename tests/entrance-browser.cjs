const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
 const context = await browser.newContext({viewport:{width:1280,height:800}});
 // Serve the identical pinned Three.js release locally to isolate tests from CDN outages.
 await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => {
  const file=route.request().url().split('three@0.160.0/')[1];
  return route.fulfill({path:require('node:path').join(__dirname,'../node_modules/three',file),contentType:'text/javascript'});
 });
 const page = await context.newPage();
 const errors=[];
 page.on('pageerror', e => errors.push(e.message));
 await page.goto('http://127.0.0.1:8765');
 await page.evaluate(async()=>{
  const {Game}=await import('/src/game/Game.js');
  document.getElementById('game-root').replaceChildren();
  window.game=new Game(document.getElementById('game-root'));
  window.renders=[];
  const render=game.renderer.render.bind(game.renderer);
  game.renderer.render=(scene,camera)=>{ renders.push({backdrop:game.prerenderBackdrop.plane.visible, mode:game.mode}); render(scene,camera); };
  for(let i=0;i<10;i++) game.update();
 });
 assert.equal(await page.evaluate(()=>renders.length),0,'no 3D render while loading');
 await page.evaluate(()=>game.ready);
 assert(await page.evaluate(()=>game.openingSequence.backdropReady && game.bryanVisual.loaded));
 await page.evaluate(()=>{ game.input.keys.add('KeyW'); for(let i=0;i<59;i++) game.openingSequence.update(.05); });
 assert.deepEqual(await page.evaluate(()=>game.player.position.toArray()),[0,0,6.4]);
 assert.equal(await page.evaluate(()=>renders.length),0);
 assert(await page.evaluate(()=>!game.player.group.visible && game.npcManager.npcs.every(n=>!n.group.visible)));
 await page.evaluate(()=>game.openingSequence.update(.05));
 assert(await page.evaluate(()=>renders.length===1 && renders[0].backdrop));
 assert.equal(await page.evaluate(()=>game.input.keys.size),0);
 assert.equal(await page.evaluate(()=>game.cameraManager.activeZone.id),'cam-entrance');
 const model=await page.evaluate(async()=>{
  const THREE=await import('three'); const b=new THREE.Box3().setFromObject(game.bryanVisual.group);
  return {height:b.max.y-b.min.y,feet:b.min.y,tilt:game.bryanVisual.group.rotation.x};
 });
 assert(Math.abs(model.height-1.78)<1e-5); assert(Math.abs(model.feet)<1e-5); assert.equal(model.tilt,0);
 await page.screenshot({path:'artifacts/entrance-spawn.png'});
 const result=await page.evaluate(()=>{
  const g=game,p=g.player;
  const reset=()=>{p.position.set(0,0,6.4);p.previousPosition.copy(p.position);g.cameraManager.setActiveZone(g.cameraManager.zones.find(z=>z.id==='cam-entrance'));};
  window.moveEntrance=(dx,dz)=>{p.previousPosition.copy(p.position);p.position.x+=dx;p.position.z+=dz;g.entranceNavigation.resolve(p);g.cameraManager.update(p);g.cameraManager.applyToCamera(g.cameraRig);g.updateEntranceViewport();g.prerenderBackdrop.update(g.cameraManager.activeZone.id);g.renderer.render(g.scene,g.cameraRig.camera);};
  const edges=[];
  for(const [dx,dz] of [[.1,0],[-.1,0],[0,.1]]) {
   reset(); for(let i=0;i<55;i++)moveEntrance(dx,dz);
   edges.push({position:p.position.toArray(),camera:g.cameraManager.activeZone.id});
  }
  reset();for(let i=0;i<29;i++)moveEntrance(0,-.1);
  const exit=g.cameraManager.activeZone.id;
  moveEntrance(0,.15); const overlap=g.cameraManager.activeZone.id;
  moveEntrance(0,.25); const returned=g.cameraManager.activeZone.id;
  reset(); moveEntrance(0,0);
  return {edges,exit,overlap,returned};
 });
 assert(result.edges.every(e=>e.camera==='cam-entrance'));
 assert.equal(result.exit,'cam05');assert.equal(result.overlap,'cam05');assert.equal(result.returned,'cam-entrance');
 for(const [name,dx,dz] of [['reception',.1,0],['doors',0,.1],['chairs',-.1,0],['interior',0,-.1]]) {
  await page.evaluate(({dx,dz})=>{game.player.position.set(0,0,6.4);game.cameraManager.setActiveZone(game.cameraManager.zones.find(z=>z.id==='cam-entrance'));for(let i=0;i<(dz<0?26:50);i++)moveEntrance(dx,dz);},{dx,dz});
  await page.screenshot({path:`artifacts/entrance-${name}.png`});
 }
 await page.evaluate(()=>{game.player.position.set(0,0,6.4);moveEntrance(0,0);});
 for(const [width,height] of [[800,1000],[1920,800]]) {
  await page.setViewportSize({width,height});
  await page.evaluate(()=>{game.onResize();game.prerenderBackdrop.update('cam-entrance');game.renderer.render(game.scene,game.cameraRig.camera);});
  const ratio=await page.evaluate(()=>game.cameraRig.camera.aspect);
  assert(Math.abs(ratio-1024/559)<1e-10);
  await page.screenshot({path:`artifacts/entrance-${width}x${height}.png`});
 }
 // Legacy progression remains reachable after crossing the entrance portal.
 const progression=await page.evaluate(()=>{
  const p=game.player;p.position.set(0,0,3.4);
  const step=(dx,dz)=>{p.previousPosition.copy(p.position);p.position.x+=dx;p.position.z+=dz;game.collisionSystem.resolve(p);};
  for(let i=0;i<40;i++)step(0,-.1);
  for(let i=0;i<59;i++)step(-.1,0);
  for(let i=0;i<10;i++)step(0,.1);
  return p.position.toArray();
 });
 assert(Math.abs(progression[0]+5.9)<.01);
 // Exercise Game's actual movement dispatch and input clearing, not just geometry.
 const integration=await page.evaluate(()=>{
  const g=game,p=g.player;
  p.position.set(0,0,6.4);p.previousPosition.copy(p.position);
  p.rotationY=0;p.group.rotation.y=0;
  g.cameraManager.setActiveZone(g.cameraManager.zones.find(z=>z.id==='cam-entrance'));
  g.clock.getDelta=()=>.05;g.input.keys.clear();
  for(let i=0;i<10;i++)g.update();
  const idle=p.position.toArray();
  g.input.keys.add('KeyW');for(let i=0;i<24;i++)g.update();g.input.keys.clear();
  return {idle,camera:g.cameraManager.activeZone.id,position:p.position.toArray(),scale:p.group.scale.toArray()};
 });
 assert.deepEqual(integration.idle,[0,0,6.4]);assert.equal(integration.camera,'cam05');
 assert(integration.position[2]<3.5);assert.deepEqual(integration.scale,[1,1,1]);
 assert.deepEqual(errors,[]);
 // Missing assets must leave a readable black loading screen, with no handoff.
 for(const asset of ['**/entrance.png','**/hospital_door_open.png']) {
  const failed=await context.newPage();
  await failed.route(asset,route=>route.abort());
  await failed.goto('http://127.0.0.1:8765');
  const state=await failed.evaluate(async()=>{
   const {Game}=await import('/src/game/Game.js');
   document.getElementById('game-root').replaceChildren();
   const g=new Game(document.getElementById('game-root'));await g.ready;
   for(let i=0;i<100;i++)g.openingSequence.update(.05);
   return {state:g.openingSequence.state,mode:g.mode,visible:g.player.group.visible,canvas:g.renderer.domElement.style.visibility};
  });
  assert.deepEqual(state,{state:'LOAD_ERROR',mode:'opening',visible:false,canvas:'hidden'});
  await failed.close();
 }
 // Real menu startup has its own render call: verify that path too.
 const menu=await context.newPage();
 await menu.goto('http://127.0.0.1:8765');
 await menu.evaluate(async()=>{
  window.submittedFrames=[];
  // Renderer.render is an instance function; wrap construction through MainMenu's callback.
  const {MainMenu}=await import('/src/game/MainMenu.js');const {Game}=await import('/src/game/Game.js');
  const root=document.createElement('div');document.body.append(root);
  window.testMenu=new MainMenu(root,(input,settings,audio)=>{
   const g=new Game(root,{input,settings,audio});const draw=g.renderer.render.bind(g.renderer);
   g.renderer.render=(scene,camera)=>{submittedFrames.push(g.prerenderBackdrop.plane.visible);draw(scene,camera);};return g;
  });
  testMenu.confirm();testMenu.update(1.2);
  await testMenu.game.ready;testMenu.update(.8);
  testMenu.game.clock.getDelta=()=>.05;
  for(let i=0;i<61;i++)testMenu.game.update();
 });
 assert(await menu.evaluate(()=>submittedFrames.length>0 && submittedFrames.every(Boolean)));
 await menu.close();
 console.log(JSON.stringify({model,cameraTests:result,progression,integration,browserErrors:errors,assetFailures:'2 passed',menuStartup:'passed',screenshots:'artifacts/entrance-*.png'},null,2));
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
