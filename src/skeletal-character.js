import * as THREE from 'three';
import { inPlaceClip } from './skeletal-clips.js';
import { createKickClips, kickMetadata } from './skeletal-kicks.js';
import { footSurfaceSamples, lowestFootSurface } from './skeletal-grounding.js';
import { createBlueFlame } from './blue-flame.js';

export function roundEndPose(fighter) {
  return {...fighter,attack:null,roll:null,speed:0,blocking:false,crouching:false,stun:0,blockStun:false};
}
export function poseCombatCharacters(models, combat, dt) {
  models.forEach((model,i)=>poseSkeletalCharacter(model,
    combat.winner!==null?roundEndPose(combat.fighters[i]):combat.fighters[i],dt));
}

export function combatMotion(fighter, character = 'leonardo') {
  if (fighter.health <= 0) return { name: 'Death01', once: true };
  if (fighter.stun > 0 && !fighter.blockStun) return { name: 'Hit_Chest', once: true };
  if (fighter.roll) return { name: 'Roll', progress: 1-fighter.roll.remaining/fighter.roll.duration, contact: null, reverse: fighter.roll.direction !== fighter.facing };
  if (fighter.attack) {
    const a=fighter.attack;
    if(a.type==='blueFlame')return {name:'Combat_BlueFlameSpin',progress:1-a.remaining/a.duration};
    const kicks={kick:['Combat_FrontKick',kickMetadata.Combat_FrontKick.contact],spinKick:['Combat_SpinKick',kickMetadata.Combat_SpinKick.contact]};
    if(kicks[a.type])return {name:kicks[a.type][0],progress:1-a.remaining/a.duration,phase:{startup:a.startup/a.duration,active:(a.startup+a.active)/a.duration},contact:kicks[a.type][1]};
    return { name:a.type==='heavy'?(character==='raphael'?'Punch_Cross':'Sword_Attack'):'Punch_Jab', progress:1-a.remaining/a.duration,
      // Piecewise time mapping keeps the clip's extension/cut inside active frames.
      phase: { startup:a.startup/a.duration, active:(a.startup+a.active)/a.duration }, contact:a.type==='heavy'&&character!=='raphael'?[.38,.58]:[.32,.50] };
  }
  if (fighter.blocking || fighter.blockStun) return { name:'Combat_Guard' };
  if (fighter.y > 0) return { name: 'Jump_Loop' };
  if (fighter.crouching) return { name: Math.abs(fighter.speed)>.1?'Crouch_Fwd_Loop':'Crouch_Idle_Loop', reverse: fighter.speed*fighter.facing<0 };
  if (Math.abs(fighter.speed)>.1) return { name:'Walk_Loop', reverse:fighter.speed*fighter.facing<0 };
  return { name:'Combat_Idle' };
}
export function clipProgress(motion) {
  const p=THREE.MathUtils.clamp(motion.progress??0,0,1);
  if(!motion.phase) return p;
  const {startup,active}=motion.phase,[begin,end]=motion.contact;
  if(p<startup) return begin*p/startup;
  if(p<active) return begin+(end-begin)*(p-startup)/(active-startup);
  return end+(1-end)*(p-active)/(1-active);
}
function fightingClip(root, idle, blocking, swordIdle) {
  const armTrack = track => /DEF-(shoulder|upper_arm|forearm|hand|f_|thumb)/.test(track.name);
  const bodyClip=idle.clone();
  if(!blocking) bodyClip.tracks=bodyClip.tracks.filter(track=>!armTrack(track));
  const mixer=new THREE.AnimationMixer(root), base=mixer.clipAction(bodyClip);base.play();
  let arms;
  if(!blocking) {
    const armClip=swordIdle.clone();armClip.tracks=armClip.tracks.filter(armTrack);
    arms=mixer.clipAction(armClip);arms.play();
  }
  const find = name => root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
  const restHands = {};
  root.updateMatrixWorld(true);
  for(const side of ['L','R']) restHands[side]=find(`DEF-hand.${side}`).getWorldQuaternion(new THREE.Quaternion());
  const worldPosition = bone => bone.getWorldPosition(new THREE.Vector3());
  function worldRotation(bone,q) {
    root.updateMatrixWorld(true);
    const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(parent.invert().multiply(q));
    root.updateMatrixWorld(true);
  }
  function pointBone(name, childName, direction) {
    root.updateMatrixWorld(true);
    const bone=find(name), child=find(childName);
    if(!bone||!child) return;
    const q=bone.getWorldQuaternion(new THREE.Quaternion()), parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const axis=worldPosition(child).sub(worldPosition(bone)).normalize();
    const delta=new THREE.Quaternion().setFromUnitVectors(axis,direction.normalize());
    bone.quaternion.copy(parent.invert().multiply(delta).multiply(q));
  }
  const samples=new Map(),times=[],duration=blocking?idle.duration:swordIdle.duration;
  for(let frame=0;frame<=16;frame++) {
    const time=duration*frame/16;times.push(time);base.time=frame===16?0:idle.duration*frame/16;
    if(arms) arms.time=frame===16?0:time;
    mixer.update(0);root.updateMatrixWorld(true);
    const ankles={};
    for(const side of ['L','R']) {const foot=find(`DEF-foot.${side}`);ankles[side]={position:worldPosition(foot),rotation:foot.getWorldQuaternion(new THREE.Quaternion())};}
    const hips=find('DEF-hips');hips.position.y-=.10;root.updateMatrixWorld(true);
    for(const side of ['L','R']) {
      const sign=side==='L'?1:-1;
      const thigh=find(`DEF-thigh.${side}`),shin=find(`DEF-shin.${side}`),foot=find(`DEF-foot.${side}`);
      const hip=worldPosition(thigh), knee=worldPosition(shin),ankle=worldPosition(foot);
      const l1=hip.distanceTo(knee),l2=knee.distanceTo(ankle),target=ankles[side].position.clone();
      target.x=sign*.33;target.z+=side==='L'?.13:-.13;
      const axis=target.clone().sub(hip),distance=Math.min(axis.length(),l1+l2-.001);axis.normalize();
      const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
      const pole=new THREE.Vector3(0,0,1).addScaledVector(axis,-axis.z).normalize();
      const bend=hip.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
      pointBone(thigh.name,shin.name,bend.clone().sub(hip));
      pointBone(shin.name,foot.name,target.clone().sub(worldPosition(shin)));
      worldRotation(foot,ankles[side].rotation);
      if(!blocking) continue; // Retain the approved Sword_Idle arm, wrist and blade animation.
      pointBone(`DEF-upper_arm.${side}`,`DEF-forearm.${side}`,new THREE.Vector3(sign*.10,blocking?-.13:-.38,blocking?.32:.24));
      pointBone(`DEF-forearm.${side}`,`DEF-hand.${side}`,new THREE.Vector3(-sign*.07,blocking?.42:.12,blocking?.10:.38));
      // Raise blades for block; keep relaxed blades forward in the idle stance.
      const hand=find(`DEF-hand.${side}`);root.updateMatrixWorld(true);
      const q=hand.getWorldQuaternion(new THREE.Quaternion());
      const blade=new THREE.Vector3(0,0,1).applyQuaternion(q.clone().multiply(restHands[side].clone().invert()));
      const aim=new THREE.Vector3(sign*(blocking?.24:.12),blocking?1:.25,blocking?.12:1).normalize();
      worldRotation(hand,new THREE.Quaternion().setFromUnitVectors(blade,aim).multiply(q));
    }
    root.traverse(bone=>{if(bone.isBone){
      if(!samples.has(bone))samples.set(bone,{positions:[],quaternions:[]});
      const data=samples.get(bone);data.positions.push(...bone.position.toArray());data.quaternions.push(...bone.quaternion.toArray());
    }});
  }
  const tracks=[];
  for(const [bone,data]of samples){
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`,times,data.quaternions));
    tracks.push(new THREE.VectorKeyframeTrack(`${bone.name}.position`,times,data.positions));
  }
  mixer.stopAllAction();mixer.uncacheRoot(root);
  return new THREE.AnimationClip(blocking?'Combat_Guard':'Combat_Idle',duration,tracks);
}
export function gameplayClips(source, library) {
  const clips=new Map(library.map(c=>[c.name,inPlaceClip(c,source)]));
  const idle=fightingClip(source,clips.get('Idle_Loop'),false,clips.get('Sword_Idle'));
  return [idle,fightingClip(source,clips.get('Idle_Loop'),true,clips.get('Sword_Idle')),
    ...createKickClips(source,idle)];
}
export function createSkeletalCharacter(gltf) {
  const root=new THREE.Group();root.add(gltf.scene);
  const source=gltf.scene, clips=new Map(gltf.animations.map(c=>[c.name,inPlaceClip(c,source)]));
  for(const clip of gameplayClips(source,gltf.animations)) clips.set(clip.name,clip);
  const mixer=new THREE.AnimationMixer(source), actions=new Map();
  for(const [name,clip] of clips) actions.set(name,mixer.clipAction(clip));
  let name='leonardo';
  source.traverse(node=>{if(node.isMesh){node.castShadow=node.receiveShadow=true;node.frustumCulled=false;if([].concat(node.material).some(m=>m.name.includes('raphael')))name='raphael';}});
  return {root,source,mixer,actions,name,skeletal:true,current:null,currentKey:null,attack:null,roll:null,soles:footSurfaceSamples(source),kickGrounding:0,blueFlame:createBlueFlame(source)};
}
export function poseSkeletalCharacter(model,fighter,dt) {
  const motion=combatMotion(fighter,model.name), action=model.actions.get(motion.name)||model.actions.get('Sword_Idle');
  const key=motion.name+Boolean(motion.reverse);
  const restarted=(fighter.attack&&model.attack!==fighter.attack)||(fighter.roll&&model.roll!==fighter.roll);
  if(model.currentKey!==key||restarted) {
    const previous=model.current; action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    action.setLoop(motion.once||motion.progress!==undefined?THREE.LoopOnce:THREE.LoopRepeat,Infinity);action.clampWhenFinished=true;
    action.play();if(previous&&previous!==action)action.crossFadeFrom(previous,motion.progress!==undefined?.045:.10,false);
    model.current=action;model.currentKey=key;
  }
  model.attack=fighter.attack;model.roll=fighter.roll;
  action.paused=motion.progress!==undefined;
  action.timeScale=motion.reverse&&motion.name!=='Roll'?-1:1;
  if(motion.progress!==undefined)action.time=clipProgress(motion)*action.getClip().duration;
  model.mixer.update(dt);
  model.root.position.set(fighter.x,fighter.y,0);
  model.root.rotation.set(0,fighter.facing*Math.PI/2+(motion.name==='Roll'&&motion.reverse?Math.PI:0),0);
  model.root.updateMatrixWorld(true);
  // Keep contact through interpolation and the short blend back to guard.
  if(motion.name==='Combat_FrontKick'||motion.name==='Combat_SpinKick')model.kickGrounding=.12;
  else model.kickGrounding=Math.max(0,model.kickGrounding-dt);
  if(model.kickGrounding>0&&fighter.y===0&&motion.name!=='Combat_BlueFlameSpin'){
    const sole=lowestFootSurface(model.soles);
    if(Number.isFinite(sole)){model.root.position.y+=.003-sole;model.root.updateMatrixWorld(true);}
  }
  model.blueFlame.update(motion.name==='Combat_BlueFlameSpin'?motion.progress:null,action.time,dt);
}
