import { PropertyBinding } from 'three';

export function inspectRig(root) {
  const bones = new Set(); let skins = 0, vertices = 0;
  root.traverse(node => {
    if (node.isBone) bones.add(node.name);
    if (node.isSkinnedMesh) { skins++; vertices += node.geometry.attributes.position.count; }
  });
  return { bones: [...bones], skins, vertices };
}

export function compatibleClip(root, clip) {
  const missing = [];
  for (const track of clip.tracks) {
    const path = PropertyBinding.parseTrackName(track.name);
    const node = PropertyBinding.findNode(root, path.nodeName);
    if (!node || (path.objectName === 'bones' && !node.skeleton?.bones.some(b => b.name === path.objectIndex))) missing.push(track.name);
  }
  return { valid: clip.duration > 0 && clip.tracks.length > 0 && !missing.length, missing };
}

// Remove only horizontal translation of root / hips, preserving vertical motion.
// Never modify the source clip; exports retain the original animations.
export function inPlaceClip(clip, root) {
  const result = clip.clone();
  for (const track of result.tracks) {
    const path = PropertyBinding.parseTrackName(track.name);
    const node = PropertyBinding.findNode(root, path.nodeName);
    if (path.propertyName !== 'position' || !node || track.getValueSize() !== 3) continue;
    if (node.isBone && node.parent?.isBone) continue;
    for (let i = 0; i < track.values.length; i += 3) {
      track.values[i] = track.values[0]; track.values[i + 2] = track.values[2];
    }
  }
  return result;
}
