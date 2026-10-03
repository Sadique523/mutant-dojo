// Bake ACCAD's captured joint motion onto the game's deform rig.
// Run with: node tools/retarget-kicks.mjs
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BVHLoader} from 'three/addons/loaders/BVHLoader.js';
import {footSurfaceSamples,lowestFootSurface} from '../src/skeletal-grounding.js';
globalThis.ProgressEvent??=class{constructor(t,v){Object.assign(this,v);}};
const b=await readFile('public/models/leonardo-skeletal.glb'),size=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+size)),offset=20+size;
delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
j.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(offset+8,offset+8+b.readUInt32LE(offset)).toString('base64');
const asset=await new GLTFLoader().parseAsync(JSON.stringify(j),'');
const root=asset.scene,find=n=>root.getObjectByName(T.PropertyBinding.sanitizeNodeName(n)),pos=n=>n.getWorldPosition(new T.Vector3());
let skin;root.traverse(n=>{if(n.isSkinnedMesh)skin=n;});skin.skeleton.pose();root.updateMatrixWorld(true);
const bones=skin.skeleton.bones,rest=new Map(bones.map(n=>[n,{p:n.position.clone(),q:n.quaternion.clone(),w:n.getWorldQuaternion(new T.Quaternion())}]));
const soles=footSurfaceSamples(root);
const map=[['DEF-hips','Hips','ToSpine','DEF-spine.001'],['DEF-spine.001','ToSpine','Spine','DEF-spine.002'],['DEF-spine.002','Spine','Spine1','DEF-spine.003'],['DEF-spine.003','Spine1','Neck','DEF-neck'],['DEF-neck','Neck','Head','DEF-head']];
for(const [s,p]of [['L','Left'],['R','Right']])map.push([`DEF-shoulder.${s}`,p+'Shoulder',p+'Arm',`DEF-upper_arm.${s}`],[`DEF-upper_arm.${s}`,p+'Arm',p+'ForeArm',`DEF-forearm.${s}`],[`DEF-forearm.${s}`,p+'ForeArm',p+'Hand',`DEF-hand.${s}`],[`DEF-thigh.${s}`,p+'UpLeg',p+'Leg',`DEF-shin.${s}`],[`DEF-shin.${s}`,p+'Leg',p+'Foot',`DEF-foot.${s}`],[`DEF-foot.${s}`,p+'Foot',p+'ToeBase',`DEF-toe.${s}`]);
const clips=[],metadata={};
const frame=(axis,forward)=>{
  const up=axis.clone().normalize(),z=forward.clone().addScaledVector(up,-forward.dot(up));
  if(z.lengthSq()<.0001)z.set(1,0,0).addScaledVector(up,-up.x);
  z.normalize();const x=up.clone().cross(z).normalize();z.crossVectors(x,up);
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,up,z));
};
for(const [file,name,start,end,peak,kicking]of [['Male2_G2_FrontKick.bvh','Combat_FrontKick',7,49,24,'RightFoot'],['Male2_G4_SpinningBackKick.bvh','Combat_SpinKick',11,69,38,'LeftFoot']]){
  skin.skeleton.pose();root.updateMatrixWorld(true);
  const donor=new BVHLoader().parse(await readFile('art/vendor/accad/bvh/'+file,'utf8')),source=donor.skeleton.bones[0],sb=Object.fromEntries(donor.skeleton.bones.map(n=>[n.name,n]));
  const mixer=new T.AnimationMixer(source),action=mixer.clipAction(donor.clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const sample=f=>{action.time=f/30;mixer.update(0);source.updateMatrixWorld(true);};sample(peak);
  const forward=pos(sb[kicking]).sub(pos(sb.Hips));forward.y=0;forward.normalize();
  const alignment=new T.Quaternion().setFromUnitVectors(forward,new T.Vector3(0,0,1));
  const unit=pos(find('DEF-thigh.L')).distanceTo(pos(find('DEF-foot.L')))/(sb.LeftLeg.position.length()+sb.LeftFoot.position.length());
  const corrections=map.map(([tn,sn,sc,tc])=>{
    const t=find(tn),targetAxis=pos(find(tc)).sub(pos(t)).normalize();
    const reference=tn.includes('foot.')?new T.Vector3(0,1,0):new T.Vector3(0,0,1);
    return {t,s:sb[sn],child:sb[sc],q:frame(targetAxis,reference).invert().multiply(rest.get(t).w)};
  });
  sample(start);const initial=pos(sb.Hips);sample(end);const final=pos(sb.Hips);
  const times=[],data=new Map(bones.map(n=>[n,{p:[],q:[]}]));
  // Keep the existing closed fingers rather than importing the BVH's empty hands.
  const fingers=new T.AnimationMixer(root),grip=fingers.clipAction(asset.animations.find(c=>c.name==='Sword_Idle'));grip.play();fingers.update(0);
  const fingerPose=new Map(bones.filter(n=>/DEF-(f_|thumb)/.test(n.name)).map(n=>[n,n.quaternion.clone()]));fingers.stopAllAction();
  for(let f=start;f<=end;f++){
    sample(f);const p=(f-start)/(end-start);times.push((f-start)/30);
    for(const n of bones){n.position.copy(rest.get(n).p);n.quaternion.copy(fingerPose.get(n)??rest.get(n).q);}root.updateMatrixWorld(true);
    const up=pos(sb.Spine1).sub(pos(sb.Hips)).normalize();
    const right=pos(sb.LeftArm).sub(pos(sb.RightArm)).normalize();
    const facing=right.clone().cross(up).normalize();
    for(const {t,s,child,q}of corrections){
      // ACCAD's BVH has unusual channel/rest axes, including a dummy pelvis
      // joint. Use anatomical frames, not raw Euler channel orientations.
      const axis=t.name==='DEF-hips'?up:pos(child).sub(pos(s));
      let reference=facing;
      if(t.name.includes('foot'))reference=new T.Vector3(0,1,0);
      if(/DEF-(thigh|shin)/.test(t.name)){
        const side=t.name.endsWith('L')?'Left':'Right',hip=pos(sb[side+'UpLeg']),ankle=pos(sb[side+'Foot']);
        const line=ankle.sub(hip).normalize(),knee=pos(sb[side+'Leg']).sub(hip);
        const bend=knee.clone().addScaledVector(line,-knee.dot(line));
        if(bend.length()>.5)reference=bend.normalize();
      }
      const goal=alignment.clone().multiply(frame(axis,reference)).multiply(q);
      t.quaternion.copy(t.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(goal));root.updateMatrixWorld(true);
    }
    const hips=find('DEF-hips'),translation=pos(sb.Hips).sub(initial.clone().lerp(final,p));translation.y=0;translation.applyQuaternion(alignment).multiplyScalar(unit);
    hips.position.add(translation);root.updateMatrixWorld(true);
    // Proportion correction: place the lowest captured foot on the stage without
    // replacing the capture's joint rotations with a procedural kick.
    const ground=lowestFootSurface(soles);hips.position.y+=.003-ground;root.updateMatrixWorld(true);
    for(const n of bones){data.get(n).p.push(...n.position.toArray());data.get(n).q.push(...n.quaternion.toArray());}
  }
  const tracks=[];for(const [n,d]of data){tracks.push(new T.QuaternionKeyframeTrack(n.name+'.quaternion',times,d.q));if(n.name==='DEF-hips')tracks.push(new T.VectorKeyframeTrack(n.name+'.position',times,d.p));}
  clips.push(T.AnimationClip.toJSON(new T.AnimationClip(name,-1,tracks)));
  metadata[name]={source:file,startFrame:start,endFrame:end,sourceFps:30,contact:[(peak-start-2)/(end-start),(peak-start+2)/(end-start)]};
  mixer.stopAllAction();
}
await mkdir('src/motions',{recursive:true});await writeFile('src/motions/accad-kicks.json',JSON.stringify({clips,metadata}));
console.log(metadata);
