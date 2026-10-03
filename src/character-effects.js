import * as THREE from 'three';
export function updateCharacterEffects(model, fighter) {
  if (!model.effectGroup) {
    const group = new THREE.Group(); model.root.add(group); model.effectGroup = group;
    for (const [radius, width, color] of [[.34, .035, '#b4f5ff'], [.48, .015, '#309fff']]) {
      const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(radius, radius + width, 40, 1, -Math.PI * .6, Math.PI * 1.2), material); group.add(mesh);
    }
  }
  const effect = model.activeEffects?.find(effect => effect.type === 'kickArc'), group = model.effectGroup;
  group.visible = Boolean(effect); if (!effect) return;
  const foot = model.parts[effect.joint]?.object; if (!foot) { group.visible = false; return; }
  model.root.updateMatrixWorld(true);
  group.position.copy(model.root.worldToLocal(foot.getWorldPosition(new THREE.Vector3())));
  group.quaternion.copy(model.root.getWorldQuaternion(new THREE.Quaternion()).invert());
  group.scale.set(fighter.facing, 1, 1).multiplyScalar(.8 + effect.progress * .65);
  group.children.forEach(mesh => { mesh.material.opacity = Math.sin(Math.PI * Math.max(.08, effect.progress)); });
}
