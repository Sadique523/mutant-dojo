import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Bone, AnimationClip, VectorKeyframeTrack, QuaternionKeyframeTrack, AnimationMixer, Vector3 } from 'three';
import { compatibleClip, inPlaceClip, inspectRig } from '../src/skeletal-clips.js';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function rig() { const root = new Group(), hips = new Bone(), hand = new Bone(); hips.name = 'Hips'; hand.name = 'Hand'; root.add(hips); hips.add(hand); return { root, hips, hand }; }
test('imported tracks bind to the rig and actually animate bones', () => {
  const { root, hand } = rig();
  const clip = new AnimationClip('Punch', 1, [new QuaternionKeyframeTrack('Hand.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, Math.sin(.5), Math.cos(.5)])]);
  assert.equal(compatibleClip(root, clip).valid, true);
  const mixer = new AnimationMixer(root); mixer.clipAction(clip).play(); mixer.update(.5);
  assert.ok(Math.abs(hand.quaternion.z - Math.sin(.25)) < 1e-5);
  assert.equal(compatibleClip(root, new AnimationClip('Wrong rig', 1, [new VectorKeyframeTrack('Missing.position', [0, 1], [0, 0, 0, 1, 0, 0])])).valid, false);
  assert.deepEqual(inspectRig(root).bones, ['Hips', 'Hand']);
});
test('in-place preview preserves vertical and child movement and original export data', () => {
  const { root } = rig();
  const original = new AnimationClip('Walk', 1, [new VectorKeyframeTrack('Hips.position', [0, 1], [1, 2, 3, 5, 4, 6]), new VectorKeyframeTrack('Hand.position', [0, 1], [0, 0, 0, 1, 2, 3])]);
  const preview = inPlaceClip(original, root);
  assert.deepEqual([...preview.tracks[0].values], [1, 2, 3, 1, 4, 3]);
  assert.deepEqual([...preview.tracks[1].values], [0, 0, 0, 1, 2, 3]);
  assert.deepEqual([...original.tracks[0].values], [1, 2, 3, 5, 4, 6]);
});

test('bundled Quaternius rig loads and all 46 clips bind and animate its actual bones', async () => {
  globalThis.ProgressEvent ??= class { constructor(type, values) { this.type = type; Object.assign(this, values); } };
  const directory = new URL('../public/motions/quaternius/', import.meta.url);
  const json = JSON.parse(await readFile(new URL('AnimationLibrary_Godot_Standard.gltf', directory), 'utf8'));
  const binary = await readFile(new URL('AnimationLibrary_Godot_Standard.bin', directory));
  assert.equal(binary.length, json.buffers[0].byteLength);
  json.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
  const asset = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  assert.equal(asset.animations.length, 46);
  assert.equal(inspectRig(asset.scene).bones.length, 53);
  assert.ok(inspectRig(asset.scene).skins > 0);
  for (const clip of asset.animations) {
    assert.equal(compatibleClip(asset.scene, clip).valid, true, clip.name);
    const mixer = new AnimationMixer(asset.scene); mixer.clipAction(clip).play(); mixer.update(clip.duration * .45);
    asset.scene.updateMatrixWorld(true);
    asset.scene.traverse(node => { if (node.isBone) assert.ok(node.matrixWorld.elements.every(Number.isFinite), clip.name); });
    mixer.stopAllAction(); mixer.uncacheRoot(asset.scene);
  }
  for (const name of ['Walk_Loop', 'Punch_Jab', 'Punch_Cross', 'Sword_Attack', 'Crouch_Idle_Loop']) assert.ok(asset.animations.some(c => c.name === name));
});

test('skeletal Leo exports normalized skin weights and approved clips deform actual vertices', async () => {
  const glb = await readFile(new URL('../public/models/leonardo-skeletal.glb', import.meta.url));
  const length = glb.readUInt32LE(12), json = JSON.parse(glb.subarray(20,20+length).toString());
  const offset = 20+length, binary = glb.subarray(offset+8,offset+8+glb.readUInt32LE(offset));
  // Node has no image decoder; material rendering is verified in Blender.
  delete json.images; delete json.textures; delete json.materials;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  json.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
  const asset = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  assert.equal(inspectRig(asset.scene).bones.length,53);
  assert.equal(asset.animations.length,16);
  const meshes=[]; asset.scene.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node);});
  assert.ok(meshes.length>0);
  for(const mesh of meshes){
    const weights=mesh.geometry.attributes.skinWeight;
    for(let i=0;i<weights.count;i++) assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);
  }
  for(const name of ['Sword_Attack','Crouch_Idle_Loop','Roll']){
    const clip=asset.animations.find(c=>c.name===name);assert.ok(compatibleClip(asset.scene,clip).valid,name);
    const mixer=new AnimationMixer(asset.scene);mixer.clipAction(clip).play();mixer.update(0);asset.scene.updateMatrixWorld(true);
    const points=()=>meshes.map(mesh=>{mesh.skeleton.update();return mesh.applyBoneTransform(0,new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,0));});
    const before=points();mixer.update(clip.duration*.48);asset.scene.updateMatrixWorld(true);const after=points();
    assert.ok(after.every(p=>[p.x,p.y,p.z].every(Number.isFinite)),name);
    assert.ok(after.some((p,i)=>p.distanceTo(before[i])>.05),`${name} must move skinned vertices`);
    mixer.stopAllAction();mixer.uncacheRoot(asset.scene);
  }
});
