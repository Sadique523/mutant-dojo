import { writeFileSync } from 'node:fs';
import { Quaternion, Euler } from 'three';
import { REFERENCE_MOTIONS, sampleReference } from '../src/reference-motions.js';
const ids = ['leo-overhead', 'leo-knee-slash', 'leo-high-kick'];
const poses = ids.map((id, index) => {
  const motion = REFERENCE_MOTIONS[id], pose = sampleReference(id, motion.contact / motion.frames);
  const rotations = Object.fromEntries(Object.entries(pose).filter(([, value]) => Array.isArray(value)).map(([name, value]) => [name, new Quaternion().setFromEuler(new Euler(...value)).toArray()]));
  return { id, label: motion.label, x: (index - 1) * 3.5, rotations, crouch: pose.crouch, lift: pose.rootLift, root: new Quaternion().setFromEuler(new Euler(0, .85, pose.rootRoll)).toArray() };
});
writeFileSync('art/reference-poses.json', JSON.stringify(poses, null, 2));
console.log('Exported three reference poses for Blender visual review.');
