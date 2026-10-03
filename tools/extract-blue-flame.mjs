import {readFile,writeFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AnimationClip} from 'three';
globalThis.ProgressEvent??=class{};
const b=await readFile('public/motions/accad/leonardo-blue-flame.glb'),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n)),o=20+n;
delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
j.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(o+8,o+8+b.readUInt32LE(o)).toString('base64');
const asset=await new GLTFLoader().parseAsync(JSON.stringify(j),'');
if(asset.animations.length!==1)throw Error('Expected one authored action');
const clip=asset.animations[0];clip.name='Combat_BlueFlameSpin';
// Scale tracks are constant and must not override the game rig's scale.
clip.tracks=clip.tracks.filter(t=>!t.name.endsWith('.scale'));
await writeFile('src/motions/blue-flame-spin.json',JSON.stringify(AnimationClip.toJSON(clip)));
console.log(clip.name,clip.duration,clip.tracks.length);
