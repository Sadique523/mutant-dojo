import * as THREE from 'three';
// Hand-authored 3D blocking inspired by the supplied stills. Timing is provisional.
// Local X rotations bend forward/back; local Z rotations spread arms/legs.
const ready = { Body: [.08, 0, 0], LeftArm: [-.8, 0, .12], RightArm: [-.9, 0, -.12], LeftForearm: [-.55, 0, 0], RightForearm: [-.65, 0, 0], LeftLeg: [-.15, 0, -.08], RightLeg: [.08, 0, .08], LeftShin: [.25, 0, 0], RightShin: [.15, 0, 0], crouch: .06 };
const overhead = { ...ready, Body: [-.08, -.12, 0], RightArm: [-2.5, 0, -.18], RightForearm: [.35, 0, 0], LeftArm: [-1.0, 0, .2], LeftForearm: [-1.0, 0, 0], crouch: .12 };
const knee = { ...ready, Body: [.18, -.14, 0], LeftLeg: [-1.45, 0, -.10], LeftShin: [1.7, 0, 0], LeftFoot: [-.15, 0, 0], RightArm: [-1.8, 0, -.15], RightForearm: [.4, 0, 0], LeftArm: [-1.2, 0, .2], LeftForearm: [-.8, 0, 0], crouch: .08 };
const slash = { ...knee, Body: [.24, .32, 0], RightArm: [-.45, .15, -.25], RightForearm: [-.25, 0, 0], LeftArm: [-1.4, 0, .35] };
const kick = { ...ready, Body: [-.25, .1, 0], LeftLeg: [-1.95, 0, -.05], LeftShin: [.08, 0, 0], LeftFoot: [.15, 0, 0], RightLeg: [.02, 0, .06], RightShin: [.08, 0, 0], LeftArm: [-1.7, 0, .2], LeftForearm: [-.7, 0, 0], RightArm: [-1.1, 0, -.3], RightForearm: [-.8, 0, 0], crouch: 0 };
const air = { ...ready, Body: [-.1, 0, 0], LeftArm: [-1.7, 0, .25], RightArm: [-1.5, 0, -.35], LeftForearm: [-.6, 0, 0], RightForearm: [-.3, 0, 0], LeftLeg: [-.7, 0, -.12], LeftShin: [1.1, 0, 0], RightLeg: [-.25, 0, .2], RightShin: [.65, 0, 0], rootRoll: -1.1, rootLift: .9, crouch: 0 };
const ground = { ...ready, Body: [-.2, 0, 0], LeftArm: [-.6, 0, .5], RightArm: [-.6, 0, -.5], LeftForearm: [-1.0, 0, 0], RightForearm: [-1.0, 0, 0], LeftLeg: [-.65, 0, -.15], RightLeg: [-.5, 0, .2], LeftShin: [.3, 0, 0], RightShin: [.3, 0, 0], rootRoll: -1.45, rootLift: .52, crouch: 0 };
export const REFERENCE_MOTIONS = {
  'leo-ready': { label: 'Ready stance', frames: 90, contact: 45, images: ['ready.png'], note: 'Image 7: upright ready stance with a clear guard and separated feet.', keys: [[0, ready], [1, ready]] },
  'leo-overhead': { label: 'Overhead guard / cut', frames: 48, contact: 15, images: ['overhead.png'], note: 'Image 1: one sword raised overhead. The cut and recovery are proposed transitions.', keys: [[0, ready], [.32, overhead], [.42, overhead], [.60, slash], [1, ready]] },
  'leo-knee-slash': { label: 'Raised-knee slash', frames: 44, contact: 18, images: ['knee-slash-side.png', 'knee-slash-front.png'], note: 'Images 2 and 4: bent supporting silhouette, lifted knee, and a sweeping sword. Timing is provisional.', keys: [[0, ready], [.38, knee], [.52, slash], [.70, { ...slash, LeftLeg: [-.7, 0, -.08], LeftShin: [.9, 0, 0] }], [1, ready]] },
  'leo-high-kick': { label: 'High kick', frames: 42, contact: 20, images: ['high-kick.png'], note: 'Image 3: an extended high kick with the standing leg supporting the weight.', keys: [[0, ready], [.25, knee], [.48, kick], [.60, kick], [.78, knee], [1, ready]] },
  'leo-airborne': { label: 'Airborne sideways pose', frames: 54, contact: 27, images: ['airborne.png'], note: 'Image 5: airborne sideways silhouette. A still cannot establish whether this is an attack or a hit reaction.', keys: [[0, ready], [.2, { ...knee, rootLift: .2 }], [.50, air], [.65, air], [.9, { ...ready, crouch: .22 }], [1, ready]] },
  'leo-grounded': { label: 'Grounded / recovery study', frames: 72, contact: 30, images: ['grounded.png'], note: 'Image 6: grounded sideways pose. Treated as a pose and recovery study until the move is identified.', keys: [[0, ready], [.42, ground], [.62, ground], [.85, { ...ready, crouch: .32 }], [1, ready]] },
};
const poseKeys = [...new Set(Object.values(REFERENCE_MOTIONS).flatMap(motion => motion.keys.flatMap(([, pose]) => Object.keys(pose))))];
function complete(pose) {
  return Object.fromEntries(poseKeys.map(key => [key, pose[key] ?? (key === 'rootRoll' || key === 'rootLift' || key === 'crouch' ? 0 : [0, 0, 0])]));
}
export function sampleReference(id, progress) {
  const motion = REFERENCE_MOTIONS[id]; if (!motion) return null;
  const t = Math.max(0, Math.min(1, progress));
  if (t === 0) return complete(motion.keys[0][1]);
  if (t === 1) return complete(motion.keys[motion.keys.length - 1][1]);
  let index = motion.keys.findIndex(([frame]) => frame >= t);
  if (index < 0) index = motion.keys.length - 1;
  const [endTime, endPose] = motion.keys[index], [startTime, startPose] = motion.keys[Math.max(0, index - 1)];
  let blend = endTime === startTime ? 0 : (t - startTime) / (endTime - startTime);
  blend = blend * blend * (3 - 2 * blend);
  const a = complete(startPose), b = complete(endPose);
  return Object.fromEntries(poseKeys.map(key => [key, Array.isArray(a[key]) ? a[key].map((v, axis) => v + (b[key][axis] - v) * blend) : a[key] + (b[key] - a[key]) * blend]));
}
export function applyReference(model, id, progress, config) {
  const pose = sampleReference(id, progress); if (!pose) return;
  for (const [name, part] of Object.entries(model.parts)) {
    const rotation = pose[name];
    if (rotation) {
      const amount = config.reference?.poseIntensity ?? 1;
      part.object.rotation.set(part.rotation.x + rotation[0] * amount, part.rotation.y + rotation[1] * amount, part.rotation.z + rotation[2] * amount);
    }
  }
  const crouch = pose.crouch;
  for (const name of ['Body', 'LeftLeg', 'RightLeg']) if (model.parts[name]) model.parts[name].object.position.y -= crouch;
  model.root.rotation.z = pose.rootRoll;
  model.root.position.y += pose.rootLift;
  // Keep the existing guard tuning available on the reference poses.
  for (const name of ['LeftArm', 'RightArm']) if (model.parts[name]) model.parts[name].object.rotation.x -= config.pose.guard - .75;
  for (const name of ['LeftForearm', 'RightForearm']) if (model.parts[name]) model.parts[name].object.rotation.x += config.reference?.elbowOffset ?? 0;
  for (const name of ['LeftShin', 'RightShin']) if (model.parts[name]) model.parts[name].object.rotation.x += config.reference?.kneeOffset ?? 0;
  if (model.parts.Body) model.parts.Body.object.rotation.x += config.reference?.leanOffset ?? 0;
  // Keep the supporting foot planted while testing a knee raise or high kick.
  if (id !== 'leo-airborne' && id !== 'leo-grounded' && model.parts.RightFoot) {
    model.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model.parts.RightFoot.object);
    if (Number.isFinite(bounds.min.y)) model.root.position.y -= bounds.min.y + .02;
  }
}
