import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Matrix4, Quaternion, Vector3, Box3 } from 'three';

for (const name of ['midnight-dojo', 'leonardo', 'raphael']) {
  const bytes = readFileSync(`public/models/${name}.glb`);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(bytes.readUInt32LE(4), 2, 'glTF version');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'Complete GLB');
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  for (const image of gltf.images ?? []) assert.ok(image.bufferView !== undefined, 'Textures must be embedded');
  if (name !== 'midnight-dojo') {
    for (const part of ['Body', 'Head', 'LeftArm', 'RightArm', 'LeftForearm', 'RightForearm', 'LeftLeg', 'RightLeg', 'LeftShin', 'RightShin', 'LeftFoot', 'RightFoot']) assert.ok(gltf.nodes.some(node => node.name === part), `Missing ${part}`);
    for (const side of ['Left', 'Right']) for (const [parent, child] of [['Arm', 'Forearm'], ['Leg', 'Shin'], ['Shin', 'Foot']]) {
      const parentNode = gltf.nodes.find(node => node.name === side + parent);
      assert.ok(parentNode.children?.includes(gltf.nodes.findIndex(node => node.name === side + child)), `Broken ${side} ${parent}/${child} hierarchy`);
    }
  }
  let triangles = 0;
  const bounds = new Box3();
  function visit(index, parent) {
    const node = gltf.nodes[index];
    const matrix = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]), new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new Vector3().fromArray(node.scale ?? [1, 1, 1]));
    matrix.premultiply(parent);
    if (node.mesh !== undefined) for (const primitive of gltf.meshes[node.mesh].primitives) {
      const position = gltf.accessors[primitive.attributes.POSITION];
      const indexAccessor = gltf.accessors[primitive.indices];
      triangles += (indexAccessor?.count ?? position.count) / 3;
      if (position.min && position.max) bounds.union(new Box3(new Vector3().fromArray(position.min), new Vector3().fromArray(position.max)).applyMatrix4(matrix));
    }
    for (const child of node.children ?? []) visit(child, matrix);
  }
  for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root, new Matrix4());
  const size = bounds.getSize(new Vector3());
  if (name !== 'midnight-dojo') {
    assert.ok(size.y > 2 && size.y < 3, 'Fighter scale must be in metres, Y-up');
    assert.ok(bounds.min.y > -.1, 'Fighter feet should be near ground');
  }
  console.log(`${name}: ${(bytes.length / 1048576).toFixed(2)} MiB, ${Math.round(triangles)} triangles, ${gltf.meshes.length} meshes, ${gltf.images?.length ?? 0} embedded textures; dimensions ${size.toArray().map(v => v.toFixed(2)).join(' × ')}`);
}
