import { Vector3 } from 'three';

// Measure the visible soles, not the ankle/toe joint pivots.
export function footSurfaceSamples(root) {
  const samples=[];
  root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
    const vertices=[];
    for(let i=0;i<indices.count;i++){
      let footWeight=0;
      for(let j=0;j<4;j++)if(/DEF-(foot|toe)/.test(mesh.skeleton.bones[indices.getComponent(i,j)]?.name??''))footWeight+=weights.getComponent(i,j);
      if(footWeight>.5)vertices.push(i);
    }
    if(vertices.length)samples.push({mesh,vertices});
  });
  return samples;
}

export function lowestFootSurface(samples) {
  const vertex=new Vector3();let height=Infinity;
  for(const {mesh,vertices}of samples){
    mesh.skeleton.update();
    for(const i of vertices){mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);height=Math.min(height,vertex.y);}
  }
  return height;
}
