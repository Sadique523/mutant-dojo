export function jointObject(model, name) {
  if (!model) return null;
  if (name === 'Root') return model.root;
  if (name.endsWith('Weapon')) return model.weaponRoots.find(object => object.parent === model.parts[`${name.replace('Weapon', '')}Forearm`]?.object) ?? null;
  return model.parts[name]?.object ?? null;
}
export function jointForObject(model, object) {
  const weapons = new Map(['Left', 'Right'].map(side => [jointObject(model, `${side}Weapon`), `${side}Weapon`]));
  const joints = new Map(Object.entries(model.parts).map(([name, part]) => [part.object, name]));
  for (let current = object; current; current = current.parent) {
    if (weapons.has(current)) return weapons.get(current);
    if (joints.has(current)) return joints.get(current);
    if (current === model.root) return 'Root';
  }
  return null;
}
