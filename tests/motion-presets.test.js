import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { MOTION_PRESETS, LEO_REFERENCE_KICK } from '../src/motion-presets.js';
import { JOINTS, sampleClip, serializeAnimations, parseAnimations, applyAuthoredPose, capturePose } from '../src/animation-clips.js';
import { updateCharacterEffects } from '../src/character-effects.js';
import { createCharacter } from '../src/character.js';
import { jointObject, jointForObject } from '../src/viewport-selection.js';
test('all motion presets sample finite full joint poses and save into supported action slots', () => {
  assert.equal(MOTION_PRESETS.length, 22);
  for (const preset of MOTION_PRESETS) {
    for (let frame = 0; frame <= preset.clip.frames; frame++) {
      const pose = sampleClip(preset.clip, frame);
      for (const name of JOINTS) assert.ok(pose.joints[name], `${preset.id} ${name}`);
      assert.ok(Object.values(pose.joints).every(part => [...part.rotation, ...part.position].every(Number.isFinite)));
    }
    const library = { leonardo: { [preset.slot]: preset.clip }, raphael: {} };
    assert.deepEqual(parseAnimations(JSON.parse(serializeAnimations(library))).leonardo[preset.slot], preset.clip);
  }
});
function glbModel(name) {
  const bytes = readFileSync(`public/models/${name}.glb`), json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const nodes = json.nodes.map(node => {
    const object = new THREE.Group(); object.name = node.name;
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    return object;
  });
  json.nodes.forEach((node, index) => node.children?.forEach(child => nodes[index].add(nodes[child])));
  const scene = new THREE.Group(); json.scenes[json.scene ?? 0].nodes.forEach(index => scene.add(nodes[index]));
  return createCharacter({ scene });
}
test('both low-poly exports preserve all editable joints and accept transferred attack poses', () => {
  const preset = MOTION_PRESETS.find(preset => preset.id === 'straight-punch');
  for (const name of ['practice-scout', 'practice-brute', 'leonardo']) {
    const model = glbModel(name); for (const joint of JOINTS) assert.ok(model.parts[joint], `${name} ${joint}`);
    applyAuthoredPose(model, sampleClip(preset.clip, 15), { x: 0, y: 0, facing: 1 }, .85);
    model.root.updateMatrixWorld(true);
    const direction = new THREE.Vector3(0, -1, 0).applyQuaternion(model.parts.RightArm.object.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(direction.x > .999 && Math.abs(direction.y) < 1e-7, name);
  }
});
test('viewport picks the nearest joint or weapon without selecting mesh geometry', () => {
  const model = glbModel('leonardo');
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); model.parts.RightForearm.object.add(mesh);
  assert.equal(jointForObject(model, mesh), 'RightForearm');
  const weapon = jointObject(model, 'RightWeapon'), blade = new THREE.Group(); weapon.add(blade);
  assert.equal(jointForObject(model, blade), 'RightWeapon');
  assert.equal(jointObject(model, 'Root'), model.root);
  assert.equal(jointForObject(model, new THREE.Group()), null);
});

test('Leo reference kick preserves six images, chamber/extension/retraction and planted support', () => {
  assert.deepEqual(LEO_REFERENCE_KICK.references.map(reference => reference.frame), [10, 17, 23, 27, 38, 52]);
  for (const reference of LEO_REFERENCE_KICK.references) assert.ok(existsSync(`public${reference.image}`));
  assert.ok(sampleClip(LEO_REFERENCE_KICK.clip, 10).joints.LeftShin.rotation[0] > 1.5);
  assert.ok(sampleClip(LEO_REFERENCE_KICK.clip, 23).joints.LeftShin.rotation[0] < .1);
  assert.ok(sampleClip(LEO_REFERENCE_KICK.clip, 38).joints.LeftShin.rotation[0] > 1.5);
  const model = glbModel('leonardo'), foot = model.parts.RightFoot.object;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.3, .2, .45), new THREE.MeshBasicMaterial()); mesh.position.y = -.04; foot.add(mesh);
  for (const facing of [-1, 1]) {
    let anchor;
    for (let frame = 0; frame <= 60; frame++) {
      const fighter = { x: 0, y: 0, facing };
      applyAuthoredPose(model, sampleClip(LEO_REFERENCE_KICK.clip, frame), fighter, .85); model.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(foot), center = box.getCenter(new THREE.Vector3());
      assert.ok(Math.abs(box.min.y + .02) < 1e-7);
      anchor ??= center.clone(); assert.ok(Math.abs(center.x - anchor.x) < 1e-7 && Math.abs(center.z - anchor.z) < 1e-7);
      assert.equal(capturePose(model, .85, fighter).supportFoot, 'RightFoot');
    }
  }
});

test('kick arc survives export/import, appears at impact, and clears after recovery', () => {
  const library = parseAnimations(JSON.parse(serializeAnimations({ leonardo: { heavy: LEO_REFERENCE_KICK.clip }, raphael: {} })));
  assert.equal(sampleClip(library.leonardo.heavy, 27).effects[0].type, 'kickArc');
  assert.equal(sampleClip(library.leonardo.heavy, 38).effects, undefined);
  const model = glbModel('leonardo'), fighter = { x: 0, y: 0, facing: 1 };
  applyAuthoredPose(model, sampleClip(library.leonardo.heavy, 27), fighter, .85); updateCharacterEffects(model, fighter); assert.equal(model.effectGroup.visible, true);
  applyAuthoredPose(model, sampleClip(library.leonardo.heavy, 38), fighter, .85); updateCharacterEffects(model, fighter); assert.equal(model.effectGroup.visible, false);
});
