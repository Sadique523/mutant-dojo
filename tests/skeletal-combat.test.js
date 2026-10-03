import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Combat } from '../src/simulation.js';
import { combatMotion, clipProgress, createSkeletalCharacter, poseSkeletalCharacter, roundEndPose, poseCombatCharacters } from '../src/skeletal-character.js';
import { controllerInput } from '../src/controllers.js';
import { Vector3, PropertyBinding, AnimationMixer } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { lowestFootSurface } from '../src/skeletal-grounding.js';

test('roll is edge-triggered, bounded, interrupts on hit and does not grant invulnerability',()=>{
  const game=new Combat(()=>{}, {rollPlayers:[true,false]});
  game.step(1/60,[{roll:true,left:true},{}]);
  assert.equal(game.fighters[0].roll.direction,-1);
  assert.equal(game.fighters[0].blocking,false);
  for(let i=0;i<60;i++)game.step(1/60,[{roll:true,left:true,strike:true,jump:true},{}]);
  assert.equal(game.fighters[0].roll,null);assert.ok(game.fighters[0].x>=-6);
  game.reset();game.fighters[0].x=-.7;game.fighters[1].x=.7;
  game.step(1/60,[{roll:true},{strike:true}]);
  for(let i=0;i<10;i++)game.step(1/60,[{},{}]);
  assert.ok(game.fighters[0].health<100);assert.equal(game.fighters[0].roll,null);
  game.reset();assert.equal(game.fighters[0].roll,null);
  const pad={connected:true,axes:[],buttons:[{}, {pressed:true}]};assert.equal(controllerInput(pad).roll,true);
});

test('Raphael has a skinned rig, sai materials, cross attack and death that finishes and holds',async()=>{
  globalThis.ProgressEvent??=class{constructor(type,values){Object.assign(this,values);}};
  const b=await readFile(new URL('../public/models/raphael-skeletal.glb',import.meta.url)),size=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+size)),offset=20+size;
  delete json.images;delete json.textures;
  for(const m of json.materials){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.pbrMetallicRoughness?.baseColorTexture;delete m.pbrMetallicRoughness?.metallicRoughnessTexture;}
  json.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(offset+8,offset+8+b.readUInt32LE(offset)).toString('base64');
  const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
  assert.equal(json.skins[0].joints.length,53);assert.equal(asset.animations.length,16);
  const model=createSkeletalCharacter(asset);assert.equal(model.name,'raphael');
  const fighter={x:3,y:0,facing:-1,health:100,stun:0,speed:0,attack:{type:'heavy',duration:.75,remaining:.4,startup:17/60,active:8/60}};
  poseSkeletalCharacter(model,fighter,.1);assert.equal(model.current.getClip().name,'Punch_Cross');
  const won=roundEndPose(fighter);assert.equal(won.attack,null);assert.ok(fighter.attack);
  poseSkeletalCharacter(model,won,.2);assert.equal(model.current.getClip().name,'Combat_Idle');
  const finishedRound={fighters:[fighter],winner:0},idleTime=model.current.time;
  for(let i=0;i<30;i++){
    poseCombatCharacters([model],finishedRound,0);
    poseCombatCharacters([model],finishedRound,1/60);
    assert.equal(model.current.getClip().name,'Combat_Idle','completed-round updates must never restart the stored attack');
  }
  assert.ok(model.current.time>idleTime+.45,'winning idle keeps playing across physics/render updates');
  assert.ok(fighter.attack,'round-end presentation must not mutate simulation state');
  fighter.health=0;const lost=roundEndPose(fighter);
  poseSkeletalCharacter(model,lost,.1);assert.equal(model.current.getClip().name,'Death01');
  poseSkeletalCharacter(model,lost,model.current.getClip().duration+1);
  const end=model.current.time;assert.equal(end,model.current.getClip().duration);
  poseSkeletalCharacter(model,lost,.5);assert.equal(model.current.time,end);
  model.root.traverse(n=>assert.ok(n.matrixWorld.elements.every(Number.isFinite)));
});
test('attack animation aligns its extension window with simulation startup and active frames',()=>{
  const fighter={health:100,stun:0,attack:{type:'heavy',duration:.75,remaining:.75,startup:17/60,active:8/60}};
  let motion=combatMotion(fighter);assert.equal(motion.name,'Sword_Attack');assert.equal(clipProgress(motion),0);
  fighter.attack.remaining=.75-17/60;assert.ok(Math.abs(clipProgress(combatMotion(fighter))-.38)<1e-8);
  fighter.attack.remaining=.75-25/60;assert.ok(Math.abs(clipProgress(combatMotion(fighter))-.58)<1e-8);
  fighter.attack.remaining=0;assert.equal(clipProgress(combatMotion(fighter)),1);
});

test('Leo kicks connect once per press, can be blocked, respect range and stay grounded',()=>{
  for(const [type,damage]of [['kick',12],['spinKick',21]]){
    const hits=[],game=new Combat(event=>hits.push(event),{kickPlayers:[true,false]});
    game.fighters[0].x=-.7;game.fighters[1].x=.7;
    for(let i=0;i<100;i++)game.step(1/60,[{[type]:true},{}]);
    assert.equal(hits.length,1);assert.equal(hits[0].type,type);assert.equal(game.fighters[1].health,100-damage);
    game.reset();hits.length=0;game.fighters[0].x=-.7;game.fighters[1].x=.7;
    for(let i=0;i<100;i++)game.step(1/60,[{[type]:true},{block:true}]);
    assert.equal(game.fighters[1].health,99);assert.equal(hits[0].blocked,true);
    game.reset();hits.length=0;
    for(let i=0;i<100;i++)game.step(1/60,[{[type]:true},{}]);assert.equal(hits.length,0);
    game.reset();game.step(1/60,[{jump:true,[type]:true},{}]);assert.equal(game.fighters[0].attack,null);
    game.reset();game.step(1/60,[{},{[type]:true}]);assert.equal(game.fighters[1].attack,null);
  }
});
test('real skeletal Leo switches combat clips, faces the opponent, and freezes when paused',async()=>{
  globalThis.ProgressEvent??=class{constructor(type,values){Object.assign(this,values);}};
  const b=await readFile(new URL('../public/models/leonardo-skeletal.glb',import.meta.url)),size=b.readUInt32LE(12);
  const json=JSON.parse(b.subarray(20,20+size)),offset=20+size;
  delete json.images;delete json.textures;delete json.materials;for(const m of json.meshes)for(const p of m.primitives)delete p.material;
  json.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(offset+8,offset+8+b.readUInt32LE(offset)).toString('base64');
  const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
  const reference=clone(asset.scene);
  const model=createSkeletalCharacter(asset),game=new Combat(()=>{}, {rollPlayers:[true,false]}),f=game.fighters[0];
  poseSkeletalCharacter(model,f,1/60);assert.equal(model.current.getClip().name,'Combat_Idle');
  const time=model.current.time;poseSkeletalCharacter(model,f,0);assert.equal(model.current.time,time);
  f.speed=-3;poseSkeletalCharacter(model,f,1/60);assert.equal(model.current.getClip().name,'Walk_Loop');assert.equal(model.current.timeScale,-1);
  f.speed=0;f.crouching=true;poseSkeletalCharacter(model,f,1/60);assert.equal(model.current.getClip().name,'Crouch_Idle_Loop');
  f.crouching=false;poseSkeletalCharacter(model,f,.15);
  const leftHand=model.source.getObjectByName(PropertyBinding.sanitizeNodeName('DEF-hand.L'));
  const idleHeight=leftHand.getWorldPosition(new Vector3()).y;
  const foot=model.source.getObjectByName(PropertyBinding.sanitizeNodeName('DEF-foot.L'));const idleFoot=foot.getWorldPosition(new Vector3());
  f.blocking=true;poseSkeletalCharacter(model,f,.15);assert.equal(model.current.getClip().name,'Combat_Guard');
  assert.ok(leftHand.getWorldPosition(new Vector3()).y>idleHeight+.25,'block must visibly raise the hand');
  assert.ok(foot.getWorldPosition(new Vector3()).distanceTo(idleFoot)<.025,'guard must preserve planted foot position');
  f.blocking=false;f.attack={type:'heavy',duration:.75,remaining:.4,startup:17/60,active:8/60};poseSkeletalCharacter(model,f,1/60);
  assert.equal(model.current.getClip().name,'Sword_Attack');const attackTime=model.current.time;
  poseSkeletalCharacter(model,f,0);assert.equal(model.current.time,attackTime);
  f.attack=null;f.roll={duration:.7,remaining:.35,direction:1};f.facing=-1;poseSkeletalCharacter(model,f,1/60);
  assert.equal(model.current.getClip().name,'Roll');assert.equal(model.root.position.x,f.x);
  f.roll=null;f.health=0;poseSkeletalCharacter(model,f,.1);assert.equal(model.current.getClip().name,'Death01');
  const deadTime=model.current.time;poseSkeletalCharacter(model,f,.1);assert.ok(model.current.time>deadTime);
  model.root.traverse(n=>assert.ok(n.matrixWorld.elements.every(Number.isFinite)));
  // Preserve the user-approved sword-idle arm motion while standing taller.
  const sword=asset.animations.find(c=>c.name==='Sword_Idle'),referenceMixer=new AnimationMixer(reference);
  referenceMixer.clipAction(sword).play();referenceMixer.update(sword.duration*.25);reference.updateMatrixWorld(true);
  f.health=100;f.facing=1;model.mixer.stopAllAction();model.current=null;model.currentKey=null;
  poseSkeletalCharacter(model,f,model.actions.get('Combat_Idle').getClip().duration*.25);
  for(const side of ['L','R'])for(const limb of ['upper_arm','forearm','hand']){
    const name=PropertyBinding.sanitizeNodeName(`DEF-${limb}.${side}`);
    assert.ok(model.source.getObjectByName(name).quaternion.angleTo(reference.getObjectByName(name).quaternion)<.001,`${name} preserves original idle arm motion`);
  }
  assert.ok(model.source.getObjectByName('DEF-head').getWorldPosition(new Vector3()).y>reference.getObjectByName('DEF-head').getWorldPosition(new Vector3()).y+.1,'idle retains the taller torso');
  for(const facing of [-1,1])for(const type of ['kick','spinKick']){
    model.mixer.stopAllAction();model.current=null;model.currentKey=null;
    f.facing=facing;f.attack={type,duration:1,remaining:1,startup:.3,active:.15};
    poseSkeletalCharacter(model,f,0);
    const support=model.source.getObjectByName(PropertyBinding.sanitizeNodeName('DEF-foot.R'));
    const lead=model.source.getObjectByName(PropertyBinding.sanitizeNodeName('DEF-foot.L'));
    const hips=model.source.getObjectByName('DEF-hips');const anchor=support.getWorldPosition(new Vector3());
    let last=hips.quaternion.clone(),turn=0,maxHeight=0,forward=0;
    for(let i=1;i<=60;i++){
      f.attack.remaining=1-i/60;poseSkeletalCharacter(model,f,1/60);
      assert.ok(Math.abs(lowestFootSurface(model.soles)-.003)<.001,`${type} visible sole remains on the stage at frame ${i}`);
      // Captured kicks step and pivot: a fixed ankle would erase the performance.
      for(const bone of [lead,support]){const foot=bone.getWorldPosition(new Vector3());maxHeight=Math.max(maxHeight,foot.y);forward=Math.max(forward,(foot.x-f.x)*facing);}
      turn+=hips.quaternion.angleTo(last);last.copy(hips.quaternion);
      model.root.traverse(n=>assert.ok(n.matrixWorld.elements.every(Number.isFinite)));
    }
    assert.ok(maxHeight>1.3&&forward>1.0,`${type} extends toward the opponent in both facings`);
    if(type==='spinKick')assert.ok(turn>3,'captured spinning kick visibly turns the hips');
    f.attack=null;
    for(let i=0;i<6;i++){
      poseSkeletalCharacter(model,f,1/60);
      assert.ok(Math.abs(lowestFootSurface(model.soles)-.003)<.001,'kick recovery blend preserves visible ground contact');
    }
  }
});
