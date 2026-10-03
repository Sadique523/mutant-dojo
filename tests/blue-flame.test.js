import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3} from 'three';
import {Combat} from '../src/simulation.js';
import {createSkeletalCharacter,poseSkeletalCharacter} from '../src/skeletal-character.js';
import {lowestFootSurface} from '../src/skeletal-grounding.js';

test('blue flame has three separate contacts, blocks, does not repeat on hold, and is Leo-only',()=>{
 for(const blocked of [false,true]){
  const hits=[],game=new Combat(e=>hits.push(e),{kickPlayers:[true,false]});game.fighters[0].x=-.7;game.fighters[1].x=.7;
  for(let i=0;i<180;i++)game.step(1/60,[{blueFlame:true},{block:blocked}]);
  assert.equal(hits.length,3);assert.ok(hits.every(e=>e.type==='blueFlame'));assert.equal(game.fighters[1].health,blocked?97:76);
 }
 const game=new Combat(()=>{},{kickPlayers:[true,false]});game.step(1/60,[{jump:true,blueFlame:true},{blueFlame:true}]);
 assert.equal(game.fighters[0].attack,null);assert.equal(game.fighters[1].attack,null);
});

test('Blender special holds the same extended leg through two rotations, then lands and clears flame',async()=>{
 globalThis.ProgressEvent??=class{};
 const b=await readFile('public/models/leonardo-skeletal.glb'),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n)),o=20+n;
 delete j.images;delete j.textures;for(const m of j.materials){delete m.pbrMetallicRoughness?.baseColorTexture;delete m.normalTexture;}
 j.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(o+8,o+8+b.readUInt32LE(o)).toString('base64');
 const asset=await new GLTFLoader().parseAsync(JSON.stringify(j),'');
 for(const facing of [-1,1]){
  const model=createSkeletalCharacter(asset),f={x:0,y:0,health:100,facing,speed:0,stun:0,attack:{type:'blueFlame',duration:.75,remaining:.75}};
  assert.ok(model.actions.get('Combat_BlueFlameSpin').getClip().duration<=.76,'fast special stays under one second');
  const knee=model.source.getObjectByName('DEF-shinR'),hips=model.source.getObjectByName('DEF-hips'),foot=model.source.getObjectByName('DEF-footR');
  f.attack={type:'spinKick',duration:1,remaining:.625,startup:.3,active:.15};poseSkeletalCharacter(model,f,.2);
  const donorLeg=model.source.getObjectByName('DEF-footL').getWorldPosition(new Vector3()).sub(model.source.getObjectByName('DEF-thighL').getWorldPosition(new Vector3()));
  const donorElevation=Math.atan2(donorLeg.y,Math.hypot(donorLeg.x,donorLeg.z));
  f.attack={type:'blueFlame',duration:.75,remaining:.75};
  let last,turn=0,heldKnee;
  for(let frame=0;frame<=45;frame++){
   f.attack.remaining=(45-frame)/60;poseSkeletalCharacter(model,f,1/60);
   const q=hips.quaternion.clone();if(frame>=12&&frame<=30){
    heldKnee??=knee.quaternion.clone();assert.ok(knee.quaternion.angleTo(heldKnee)<.003,'extended knee stays held instead of kicking again');
    if(last)turn+=q.angleTo(last);
    assert.ok(Math.abs(lowestFootSurface(model.soles)-.243)<.015,'airborne clearance is intentional and stable');
    assert.ok(foot.getWorldPosition(new Vector3()).y>1.1,'same kicking foot stays raised');
    const leg=foot.getWorldPosition(new Vector3()).sub(model.source.getObjectByName('DEF-thighR').getWorldPosition(new Vector3()));
    const elevation=Math.atan2(leg.y,Math.hypot(leg.x,leg.z));
    assert.ok(Math.abs(elevation-donorElevation)<.02,`held elevation ${elevation} matches spin ${donorElevation} at ${frame}`);
   }last=q;
   model.root.traverse(n=>assert.ok(n.matrixWorld.elements.every(Number.isFinite)));
  }
  assert.ok(turn>12,'two full spins');assert.ok(Math.abs(lowestFootSurface(model.soles)-.003)<.015,'lands on stage');
  f.attack=null;poseSkeletalCharacter(model,f,.2);
  assert.ok(model.source.children.filter(n=>n.isPoints).every(n=>!n.visible),'flame trail clears after special');
 }
});
