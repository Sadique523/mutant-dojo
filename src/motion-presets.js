import * as THREE from 'three';
import { JOINTS, validateClip } from './animation-clips.js';
const transform = (rotation = [0, 0, 0], position = [0, 0, 0]) => ({ rotation, position });
function pose(overrides = {}) {
  const joints = Object.fromEntries(['Root', ...JOINTS].map(name => [name, transform()]));
  Object.assign(joints, {
    Body: transform([0, 0, 0], [0, -.02, 0]),
    LeftArm: transform([-.45, 0, -.12]), RightArm: transform([-.65, 0, .12]),
    LeftForearm: transform([-1.5, 0, 0]), RightForearm: transform([-1.25, 0, 0]),
    LeftLeg: transform([-.18, 0, 0], [0, -.02, 0]), RightLeg: transform([-.18, 0, 0], [0, -.02, 0]),
    LeftShin: transform([.32, 0, 0]), RightShin: transform([.32, 0, 0]),
    LeftFoot: transform([-.14, 0, 0]), RightFoot: transform([-.14, 0, 0]),
    LeftWeapon: transform([Math.PI * .75, 0, 0], [.03, -.45, .145]),
    RightWeapon: transform([Math.PI * .75, 0, 0], [-.03, -.45, .145]),
  });
  for (const [name, value] of Object.entries(overrides)) joints[name] = Array.isArray(value) ? transform(value, joints[name]?.position ?? [0, 0, 0]) : value;
  return { joints };
}
const p = pose;
function forwardStrike(twist = .3) {
  const result = p({ Body: [0, twist, 0], LeftForearm: [-1.8, 0, 0], RightForearm: [0, 0, 0] });
  const parent = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, .85 + twist, 0));
  const world = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0, 'YXZ'));
  result.joints.RightArm.rotation = new THREE.Euler().setFromQuaternion(parent.clone().invert().multiply(world)).toArray().slice(0, 3);
  const grip = world.clone().invert().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)));
  result.joints.RightWeapon.rotation = new THREE.Euler().setFromQuaternion(grip).toArray().slice(0, 3);
  return result;
}
const crouch = p({ Body: transform([.12, 0, 0], [0, -.28, 0]), LeftLeg: transform([-.8, 0, 0], [0, -.28, 0]), RightLeg: transform([-.8, 0, 0], [0, -.28, 0]), LeftShin: [1.4, 0, 0], RightShin: [1.4, 0, 0], LeftFoot: [-.6, 0, 0], RightFoot: [-.6, 0, 0] });
const guard = p({ LeftArm: [-.35, 0, -.22], RightArm: [-.45, 0, .22], LeftForearm: [-1.9, 0, 0], RightForearm: [-1.8, 0, 0] });
const key = (frame, pose, easing = 'smooth') => ({ frame, pose, easing });
function motion(id, label, category, slot, frames, keys, note) {
  return { id, label, category, slot, note: note ?? 'Original procedural blocking. Apply it, then refine the key poses on your character.', clip: validateClip({ frames, enabled: true, keys }) };
}
function action(id, label, slot, contactPose, frames = 48, category = 'Attacks') {
  return motion(id, label, category, slot, frames, [key(0, p()), key(Math.round(frames * .22), p({ Body: [0, -.12, 0], RightForearm: [-1.65, 0, 0] })), key(Math.round(frames * .4), contactPose), key(Math.round(frames * .55), contactPose), key(frames, p())]);
}
const walkA = p({ LeftLeg: transform([-.32, 0, 0], [0, -.04, .13]), RightLeg: transform([.12, 0, 0], [0, .03, -.13]), LeftShin: [.35, 0, 0], RightShin: [.55, 0, 0], LeftFoot: [-.03, 0, 0], RightFoot: [-.67, 0, 0], Body: [0, .035, 0] });
const walkB = p({ RightLeg: transform([-.32, 0, 0], [0, -.04, .13]), LeftLeg: transform([.12, 0, 0], [0, .03, -.13]), RightShin: [.35, 0, 0], LeftShin: [.55, 0, 0], RightFoot: [-.03, 0, 0], LeftFoot: [-.67, 0, 0], Body: [0, -.035, 0] });
function leoKickPose(overrides = {}) {
  const result = p({ Root: [0, Math.PI / 2 - .85, 0], RightLeg: [-.08, 0, .035], RightShin: [.12, 0, 0], RightFoot: [-.04, 0, 0], LeftArm: [-1.05, 0, -.08], LeftForearm: [-.65, 0, 0], RightArm: [-.4, 0, .12], RightForearm: [-1.5, 0, 0], ...overrides });
  result.supportFoot = 'RightFoot'; return result;
}
const kickChamber = leoKickPose({ LeftLeg: [-1.35, 0, -.07], LeftShin: [1.75, 0, 0], LeftFoot: [-.3, 0, 0] });
const kickExtend = leoKickPose({ LeftLeg: [-1.58, 0, -.05], LeftShin: [.13, 0, 0], LeftFoot: [-.06, 0, 0], Body: [-.1, -.05, 0], RightArm: [-.3, 0, .28], RightForearm: [-.4, 0, 0] });
const kickHigh = leoKickPose({ LeftLeg: [-2.02, 0, -.04], LeftShin: [.06, 0, 0], LeftFoot: [.08, 0, 0], Body: [-.18, -.08, 0], LeftArm: [-1.15, 0, -.08], RightArm: [-.45, 0, .35], RightForearm: [-.5, 0, 0] });
const kickImpact = leoKickPose({ LeftLeg: [-1.7, 0, -.04], LeftShin: [.035, 0, 0], LeftFoot: [.04, 0, 0], Body: [-.2, .07, 0], LeftArm: [-1.3, 0, -.06], LeftForearm: [-.3, 0, 0], RightArm: [-.25, 0, .32], RightForearm: [-.35, 0, 0] });
const kickRetract = leoKickPose({ LeftLeg: [-1.15, 0, -.06], LeftShin: [1.55, 0, 0], LeftFoot: [-.2, 0, 0], Body: [-.08, 0, 0], RightArm: [-.3, 0, .25], RightForearm: [-.7, 0, 0] });
const kickGuard = leoKickPose({ LeftLeg: [-.2, 0, -.08], LeftShin: [.32, 0, 0], LeftFoot: [-.12, 0, 0], LeftArm: [-.65, 0, -.12], LeftForearm: [-1.2, 0, 0], RightArm: [-.45, 0, .1], RightForearm: [-1.7, 0, 0] });
export const LEO_REFERENCE_KICK = {
  ...motion('leo-six-frame-kick', 'Leo — six-frame kick', 'Leo references', 'heavy', 60, [key(0, kickGuard), key(10, kickChamber), key(17, kickExtend, 'linear'), key(23, kickHigh, 'linear'), key(27, kickImpact), key(38, kickRetract), key(52, kickGuard), key(60, kickGuard)], 'Six supplied poses reconstructed as editable 3D keys with a blue kick arc. Timing is provisional.'),
  references: [10, 17, 23, 27, 38, 52].map((frame, index) => ({ frame, image: `/references/leo/kick-sequence/keyframe-${index + 1}.png`, label: ['Chamber', 'Extend', 'High kick', 'Impact', 'Retract', 'Guard'][index] })),
};
LEO_REFERENCE_KICK.clip.effects = [{ type: 'kickArc', joint: 'LeftFoot', startFrame: 23, endFrame: 32 }];
export const MOTION_PRESETS = [
  LEO_REFERENCE_KICK,
  motion('guard-idle', 'Guarded idle', 'Stances', 'idle', 120, [key(0, p()), key(60, p({ Body: transform([0, .025, 0], [0, 0, 0]), Head: [.02, 0, 0] })), key(120, p())]),
  motion('boxer-bounce', 'Boxer bounce', 'Stances', 'idle', 48, [key(0, p()), key(12, p({ Root: transform([0, 0, 0], [0, .06, 0]) })), key(24, p()), key(36, p({ Root: transform([0, 0, 0], [0, .04, 0]) })), key(48, p())]),
  motion('forward-walk', 'Forward walk', 'Footwork', 'walk', 48, [key(0, walkA), key(12, p()), key(24, walkB), key(36, p()), key(48, walkA)]),
  motion('backward-walk', 'Backward walk', 'Footwork', 'backstep', 56, [key(0, walkB), key(14, p()), key(28, walkA), key(42, p()), key(56, walkB)]),
  motion('forward-dash', 'Forward dash', 'Footwork', 'walk', 30, [key(0, p()), key(8, p({ Body: [.2, 0, 0], LeftLeg: [-.6, 0, 0], RightLeg: [.35, 0, 0] })), key(17, p({ Body: [.2, 0, 0], RightLeg: [-.6, 0, 0], LeftLeg: [.35, 0, 0] })), key(30, p())]),
  motion('backdash', 'Backdash', 'Footwork', 'backstep', 32, [key(0, p()), key(10, p({ Body: [-.12, 0, 0], LeftLeg: [.3, 0, 0], RightLeg: [-.45, 0, 0] })), key(20, p({ Body: [-.12, 0, 0], RightLeg: [.3, 0, 0], LeftLeg: [-.45, 0, 0] })), key(32, p())]),
  action('straight-punch', 'Straight punch / thrust', 'strike', forwardStrike(), 30),
  motion('double-jab', 'Double jab', 'Attacks', 'strike', 54, [key(0, p()), key(12, forwardStrike(.15)), key(23, p()), key(34, forwardStrike(.3)), key(42, forwardStrike(.3)), key(54, p())], 'Two visual jabs. The current combat system still registers one contact per light attack.'),
  action('heavy-cross', 'Heavy cross', 'heavy', forwardStrike(.5), 52),
  action('uppercut', 'Uppercut', 'heavy', p({ RightArm: [-2.35, 0, .1], RightForearm: [-.9, 0, 0], Body: [-.12, .35, 0] }), 52),
  action('front-kick', 'Front kick', 'heavy', p({ LeftLeg: [-1.65, 0, 0], LeftShin: [.12, 0, 0], LeftFoot: [.1, 0, 0], Body: [-.1, -.15, 0] }), 54),
  action('roundhouse', 'Roundhouse kick', 'heavy', p({ LeftLeg: [-1.2, -.25, -.45], LeftShin: [.15, 0, 0], Body: [0, .55, 0] }), 60),
  action('low-kick', 'Low kick', 'strike', p({ LeftLeg: [-.8, .1, -.2], LeftShin: [.08, 0, 0], Body: [0, .25, 0] }), 42),
  motion('high-block', 'High block', 'Defense', 'block', 48, [key(0, guard), key(24, p({ ...guard.joints, Body: transform([.06, -.08, 0], [0, -.04, 0]) })), key(48, guard)]),
  motion('crouch-hold', 'Crouch', 'Defense', 'crouch', 60, [key(0, crouch), key(30, crouch), key(60, crouch)]),
  motion('crouch-block', 'Crouch block', 'Defense', 'block', 60, [key(0, p({ ...crouch.joints, LeftArm: [-.35, 0, -.22], RightArm: [-.45, 0, .22], LeftForearm: [-1.9, 0, 0], RightForearm: [-1.8, 0, 0] })), key(60, p({ ...crouch.joints, LeftArm: [-.35, 0, -.22], RightArm: [-.45, 0, .22], LeftForearm: [-1.9, 0, 0], RightForearm: [-1.8, 0, 0] }))]),
  motion('hop', 'Jump / tuck', 'Movement', 'jump', 48, [key(0, p()), key(12, p({ LeftLeg: [-.9, 0, 0], RightLeg: [-.55, 0, 0], LeftShin: [1.5, 0, 0], RightShin: [1.2, 0, 0] })), key(30, p({ LeftLeg: [-.4, 0, 0], RightLeg: [-.3, 0, 0] })), key(48, p())], 'Leg tuck only. Gameplay supplies jump height; this preset adds no extra root lift.'),
  motion('hit-recoil', 'Hit recoil', 'Reactions', 'hit', 36, [key(0, p({ Body: [-.25, -.1, -.15], Head: [-.15, 0, 0] })), key(12, p({ Body: [-.18, -.08, -.1] })), key(36, p())]),
  action('overhead-cut', 'Overhead cut', 'heavy', p({ RightArm: [-1.1, .3, -.15], RightForearm: [-.15, 0, 0], Body: [.18, .35, 0] }), 66, 'Specials'),
  motion('spin-slash', 'Spinning slash', 'Specials', 'heavy', 84, [key(0, p()), key(18, p({ Body: [0, -.25, 0], RightArm: [-1.2, 0, -.65] })), key(36, p({ Root: [0, Math.PI, 0], RightArm: [-1.55, 0, -.8], RightForearm: [-.1, 0, 0] }), 'linear'), key(60, p({ Root: [0, Math.PI * 2, 0], RightArm: [-1.55, 0, -.8], RightForearm: [-.1, 0, 0] })), key(84, p({ Root: [0, Math.PI * 2, 0] }))], 'Visual spinning attack. It uses the heavy-attack slot; no new special input or damage rules are added.'),
  action('shell-feint', 'Shell feint / counter', 'heavy', p({ Body: [.3, -.65, 0], Head: [.12, -.2, 0], LeftArm: [-.3, 0, -.4], RightArm: [-1.55, .3, -.1], RightForearm: [-.05, 0, 0] }), 72, 'Specials'),
];
