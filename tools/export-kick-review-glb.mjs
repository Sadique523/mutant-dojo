// Preserve Leo's original materials and rig while adding editable baked clips.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const file=await readFile('public/models/leonardo-skeletal.glb'),length=file.readUInt32LE(12),json=JSON.parse(file.subarray(20,20+length)),offset=20+length;
const captured=JSON.parse(await readFile('src/motions/accad-kicks.json','utf8'));
const chunks=[file.subarray(offset+8,offset+8+file.readUInt32LE(offset))];let byteLength=chunks[0].length;
const add=(values,type)=>{
 const bytes=Buffer.from(new Float32Array(values).buffer),view=json.bufferViews.length;
 json.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:bytes.length});chunks.push(bytes);byteLength+=bytes.length;
 const accessor=json.accessors.length,components=type==='SCALAR'?1:type==='VEC3'?3:4;
 const a={bufferView:view,componentType:5126,count:values.length/components,type};
 if(type==='SCALAR'){a.min=[Math.min(...values)];a.max=[Math.max(...values)];}json.accessors.push(a);return accessor;
};
for(const clip of captured.clips){
 const samplers=[],channels=[];
 for(const track of clip.tracks){const dot=track.name.lastIndexOf('.'),name=track.name.slice(0,dot),property=track.name.slice(dot+1),node=json.nodes.findIndex(n=>n.name?.replace(/[\[\]\.:/]/g,'')===name);
  if(node<0)throw Error('Missing node '+name);
  const sampler=samplers.length;samplers.push({input:add(track.times,'SCALAR'),output:add(track.values,property==='quaternion'?'VEC4':'VEC3'),interpolation:'LINEAR'});
  channels.push({sampler,target:{node,path:property==='quaternion'?'rotation':'translation'}});
 }json.animations.push({name:clip.name,samplers,channels});
}
json.buffers[0].byteLength=byteLength;
const pad=(buffer,fill)=>Buffer.concat([buffer,Buffer.alloc((4-buffer.length%4)%4,fill)]),j=pad(Buffer.from(JSON.stringify(json)),32),bin=pad(Buffer.concat(chunks),0),out=Buffer.alloc(28+j.length+bin.length);
out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(j.length,12);out.writeUInt32LE(0x4e4f534a,16);j.copy(out,20);
out.writeUInt32LE(bin.length,20+j.length);out.writeUInt32LE(0x004e4942,24+j.length);bin.copy(out,28+j.length);
await mkdir('public/motions/accad',{recursive:true});await writeFile('public/motions/accad/leonardo-kicks.glb',out);console.log('Exported editable Leo rig and captured kicks.');
