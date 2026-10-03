import * as T from 'three';

export function createBlueFlame(root) {
  const find=name=>root.getObjectByName(T.PropertyBinding.sanitizeNodeName(name));
  const shin=find('DEF-shin.R'),foot=find('DEF-foot.R');
  if(!shin||!foot)return {update(){}};
  const uniforms={time:{value:0},strength:{value:0}};
  const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
    vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 uv0;uniform float time;uniform float strength;
    void main(){float wave=sin(uv0.x*57.+uv0.y*13.-time*19.)*.5+sin(uv0.x*103.-time*27.)*.3;
      float tongues=smoothstep(.12,.75,1.-uv0.y+wave*.24);
      float glow=pow(max(0.,sin(uv0.y*3.14159)),.7)*tongues;
      vec3 color=mix(vec3(.015,.12,1.5),vec3(.18,1.5,2.5),glow);
      gl_FragColor=vec4(color,glow*strength*.6);}`});
  const flame=new T.Group();shin.add(flame);
  for(const [radius,y,scale]of [[.23,.25,1.8],[.19,.54,1.7]]){
    const shell=new T.Mesh(new T.SphereGeometry(radius,16,16),material);shell.position.y=y;shell.scale.y=scale;flame.add(shell);
  }
  const footFlame=new T.Mesh(new T.SphereGeometry(.29,16,16),material);footFlame.scale.set(1,1.45,1);foot.add(footFlame);
  const points=new Float32Array(48*3),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(points,3));
  const trail=new T.Points(geometry,new T.PointsMaterial({color:'#29aaff',size:.13,transparent:true,opacity:.6,depthWrite:false,blending:T.AdditiveBlending}));trail.frustumCulled=false;root.add(trail);
  const weapons=[];
  root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||!/(Weapon_steel|Leather)/.test(mesh.material?.name??''))return;
    const index=mesh.geometry.attributes.skinIndex,weight=mesh.geometry.attributes.skinWeight;
    if(index&&[0,Math.floor(index.count/2)].every(i=>/DEF-hand/.test(mesh.skeleton.bones[index.getX(i)]?.name??'')&&weight.getX(i)>.9))weapons.push(mesh);
  });
  const back=new T.Group(),spine=find('DEF-spine.002');
  if(spine){
    // Reuse the Blender sword geometry, transformed from the bind hand to the shell.
    root.updateMatrixWorld(true);
    for(const weapon of weapons){
      const index=weapon.geometry.attributes.skinIndex.getX(0),bone=weapon.skeleton.bones[index],sign=bone.name.endsWith('R')?-1:1;
      const inverse=weapon.skeleton.boneInverses[index],bind=inverse.clone().invert(),rotation=new T.Matrix4().extractRotation(bind);
      const geometry=weapon.geometry.clone();geometry.applyMatrix4(inverse.clone().multiply(weapon.bindMatrix));geometry.applyMatrix4(rotation);
      geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(sign*.35,-1,0).normalize()));
      const mesh=new T.Mesh(geometry,weapon.material);mesh.position.set(sign*.15,2.25,-.43);mesh.castShadow=true;back.add(mesh);
    }
    const matrix=spine.matrixWorld.clone().invert().multiply(root.matrixWorld);back.applyMatrix4(matrix);spine.add(back);
  }
  back.visible=false;
  let cursor=0,wasActive=false;
  return {update(progress,time,dt){
    const active=progress!==null;const power=active?T.MathUtils.smoothstep(progress,.14,.24)*(1-T.MathUtils.smoothstep(progress,.76,.91)):0;
    flame.visible=footFlame.visible=power>0;trail.visible=power>0;
    uniforms.time.value=time;uniforms.strength.value=power;
    for(const weapon of weapons)weapon.visible=!active;
    back.visible=active;
    if(active&&power>0){
      root.updateMatrixWorld(true);const p=root.worldToLocal(foot.getWorldPosition(new T.Vector3()));
      if(!wasActive){for(let i=0;i<48;i++)points.set(p.toArray(),i*3);cursor=0;}
      if(dt>0){points.set(p.toArray(),cursor*3);cursor=(cursor+1)%48;}
      geometry.attributes.position.needsUpdate=true;
    }
    wasActive=power>0;
  }};
}
