import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_MOTIONS, sampleReference } from '../src/reference-motions.js';
import { createCharacter, poseCharacter } from '../src/character.js';
import { defaults } from '../src/tuning.js';
import { stepTarget } from '../src/footwork.js';
import { punchProgress } from '../src/combat-poses.js';
import { attackSpec } from '../src/tuning.js';

test('all reference motions interpolate finite transforms and return to their starting pose', () => {
  for (const [id, motion] of Object.entries(REFERENCE_MOTIONS)) {
    for (let frame = 0; frame <= motion.frames; frame++) {
      const pose = sampleReference(id, frame / motion.frames);
      assert.ok(Object.values(pose).flat().every(Number.isFinite), `${id} frame ${frame}`);
    }
    assert.deepEqual(sampleReference(id, 0), sampleReference(id, 1), id);
  }
});
test('high kick extends the lead leg while the knee slash folds the knee', () => {
  const kick = sampleReference('leo-high-kick', .5), knee = sampleReference('leo-knee-slash', .38);
  assert.ok(kick.LeftLeg[0] < -1.8); assert.ok(kick.LeftShin[0] < .2);
  assert.ok(knee.LeftShin[0] > 1.5); assert.ok(knee.LeftLeg[0] < -1.3);
});
function fixture() {
  const scene = new THREE.Group();
  function group(name, parent, y) { const object = new THREE.Group(); object.name = name; object.position.y = y; parent.add(object); return object; }
  const body = group('Body', scene, 1.28); group('Head', body, 1.07);
  for (const side of ['Left', 'Right']) {
    const arm = group(`${side}Arm`, body, .72); const forearm = group(`${side}Forearm`, arm, -.55);
    const weapon = group(`WeaponGrip${side}`, forearm, -.45); weapon.rotation.x = Math.PI * .75;
    const leg = group(`${side}Leg`, scene, 1.25), shin = group(`${side}Shin`, leg, -.60), foot = group(`${side}Foot`, shin, -.51);
    const material = new THREE.MeshStandardMaterial(); material.name = 'Skin_leonardo';
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.3, .24, .5), material); mesh.position.y = -.04; foot.add(mesh);
  }
  return createCharacter({ scene });
}
const base = { x: 0, y: 0, facing: 1, speed: 0, health: 100, attack: null, blocking: false, stun: 0 };
test('high-kick reference keeps the supporting foot planted and resets on leaving the study', () => {
  const model = fixture(), config = defaults();
  poseCharacter(model, { ...base, reference: { id: 'leo-high-kick', progress: .5 } }, 0, config);
  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.parts.RightFoot.object);
  assert.ok(Math.abs(bounds.min.y + .02) < 1e-7);
  poseCharacter(model, { ...base, reference: { id: 'leo-airborne', progress: .5 } }, 0, config);
  assert.ok(Math.abs(model.root.rotation.z) > 1);
  poseCharacter(model, base, 0, config);
  assert.equal(model.root.rotation.z, 0); assert.equal(model.root.position.y, 0);
  assert.equal(model.parts.LeftShin.object.rotation.x, .32);
});

test('stance foot cancels root travel in both directions and swing clears the ground', () => {
  for (const speed of [-3.8, 3.8]) {
    const a = stepTarget(.02, speed, 13, 0), b = stepTarget(.05, speed, 13, 0);
    assert.ok(a.support && b.support);
    assert.ok(Math.abs((b.x - a.x) + speed * .03) < 1e-9);
    assert.ok(stepTarget(Math.PI * 2 / 13 * .75, speed, 13, 0).y > .08);
  }
});

test('guard plants both feet and repeated posing does not accumulate transforms', () => {
  const model = fixture(), config = defaults();
  poseCharacter(model, base, .1, config);
  const positions = ['LeftLeg', 'RightLeg'].map(name => model.parts[name].object.position.clone());
  poseCharacter(model, base, .1, config);
  for (const [index, side] of ['Left', 'Right'].entries()) {
    assert.ok(model.parts[`${side}Leg`].object.position.distanceTo(positions[index]) < 1e-9);
    model.root.updateMatrixWorld(true);
    assert.ok(Math.abs(new THREE.Box3().setFromObject(model.parts[`${side}Foot`].object).min.y + .02) < 1e-7);
  }
});

test('punch chambers before contact, extends at contact, and returns to guard', () => {
  const model = fixture(), config = defaults(), spec = attackSpec(config, 'strike');
  const attack = age => ({ ...spec, type: 'strike', remaining: spec.duration - age });
  assert.equal(punchProgress(attack(spec.startup - .001)).extension, 0);
  poseCharacter(model, { ...base, attack: attack(spec.startup + spec.active * .5) }, 0, config);
  assert.ok(Math.abs(model.parts.RightForearm.object.rotation.x) < .1);
  assert.ok(model.parts.LeftForearm.object.rotation.x < -1.5);
  poseCharacter(model, { ...base, attack: attack(spec.duration) }, 0, config);
  assert.ok(Math.abs(model.parts.RightForearm.object.rotation.x + 1.25) < 1e-8);
});

test('straight strike aims arm and visible blade horizontally at the opponent in both facings', () => {
  const model = fixture(), config = defaults(), spec = attackSpec(config, 'strike');
  const weapon = model.weaponRoots.find(object => object.parent === model.parts.RightForearm.object);
  for (const facing of [-1, 1]) {
    poseCharacter(model, { ...base, facing, attack: { ...spec, type: 'strike', remaining: spec.duration - spec.startup - spec.active * .5 } }, 0, config);
    model.root.updateMatrixWorld(true);
    const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(weapon.getWorldQuaternion(new THREE.Quaternion()));
    const arm = new THREE.Vector3(0, -1, 0).applyQuaternion(model.parts.RightArm.object.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(blade.x * facing > .999 && Math.abs(blade.y) < 1e-7);
    assert.ok(arm.x * facing > .999 && Math.abs(arm.y) < 1e-7);
    assert.equal(weapon.visible, true);
  }
  poseCharacter(model, base, 0, config);
  assert.ok(weapon.quaternion.angleTo(weapon.userData.restGripRotation) < 1e-7);
});

test('block keeps bent elbows during block stun and crouch lowers the body with planted feet', () => {
  const model = fixture(), config = defaults();
  poseCharacter(model, { ...base, blocking: true, stun: .05, blockStun: true }, 0, config);
  assert.equal(model.parts.RightForearm.object.rotation.x, -1.8);
  poseCharacter(model, { ...base, crouching: true }, 0, config);
  assert.ok(model.parts.Body.object.position.y < model.parts.Body.position.y - .4);
  model.root.updateMatrixWorld(true);
  for (const side of ['Left', 'Right']) assert.ok(Math.abs(new THREE.Box3().setFromObject(model.parts[`${side}Foot`].object).min.y + .02) < 1e-7);
  poseCharacter(model, base, 0, config);
  assert.equal(model.parts.Body.object.position.y, model.parts.Body.position.y);
});
