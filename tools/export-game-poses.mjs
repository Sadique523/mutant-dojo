// Export actual runtime-deformed vertices for offline Blender visual review.
import { readFile, writeFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3 } from 'three';
import { createSkeletalCharacter, poseSkeletalCharacter } from '../src/skeletal-character.js';
globalThis.ProgressEvent ??= class { constructor(type,values){Object.assign(this,values);} };
const character=process.argv[2]||'leonardo';
if(!['leonardo','raphael'].includes(character))throw new Error('Unknown fighter');
const b=await readFile(`public/models/${character}-skeletal.glb`),length=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+length)),offset=20+length;
delete json.images;delete json.textures;
for(const m of json.materials) {delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.pbrMetallicRoughness?.baseColorTexture;delete m.pbrMetallicRoughness?.metallicRoughnessTexture;}
json.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(offset+8,offset+8+b.readUInt32LE(offset)).toString('base64');
const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
const model=createSkeletalCharacter(asset),fighter={x:0,y:0,facing:1,health:100,stun:0,speed:0,blocking:false};
const output={};
for(const name of ['idle','block','kick','spin-windup','spinKick','death','special-kick','special-turn','special-spin','special-land']) {
  fighter.blocking=name==='block';fighter.health=name==='death'?0:100;
  fighter.attack=['kick','spin-windup','spinKick'].includes(name)?{type:name==='kick'?'kick':'spinKick',duration:1,remaining:name==='spin-windup'?.88:.625,startup:.3,active:.15}:null;
  if(name.startsWith('special-'))fighter.attack={type:'blueFlame',duration:.75,remaining:.75-({'special-kick':.2,'special-turn':.25,'special-spin':.35,'special-land':.75}[name])};
  poseSkeletalCharacter(model,fighter,name==='death'?5:.2);model.root.updateMatrixWorld(true);
  const objects=[];
  model.root.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible||mesh.material.isShaderMaterial)return;for(let p=mesh.parent;p;p=p.parent)if(!p.visible)return;mesh.skeleton?.update();
    const vertices=[],v=new Vector3();
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);vertices.push([v.x,-v.z,v.y].map(n=>Math.round(n*100000)/100000));}
    objects.push({name:mesh.name,material:mesh.material.name,vertices,indices:Array.from(mesh.geometry.index?.array??vertices.map((_,i)=>i))});
  });output[name]=objects;
}
await writeFile(`art/${character}-game-pose-review.json`,JSON.stringify(output));
console.log(`Exported ${character} runtime idle, block, kicks and death for Blender review.`);
