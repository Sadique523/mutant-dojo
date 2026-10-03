import * as THREE from 'three';
import captured from './motions/accad-kicks.json' with { type: 'json' };
import special from './motions/blue-flame-spin.json' with { type: 'json' };

// Baked ACCAD motion capture; no generated kick poses at runtime.
export const kickMetadata = captured.metadata;
export function createKickClips() {
  return [...captured.clips,special].map(data => THREE.AnimationClip.parse(data));
}
