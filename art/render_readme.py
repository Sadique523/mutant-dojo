"""Render honest asset previews for documentation, separate from browser screenshots."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]);dest=root/'docs/images';dest.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
try:scene.render.engine='CYCLES'
except TypeError:pass
scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=788;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
def clear():
    for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
def studio(target,camera_pos,ortho=None):
    world=bpy.data.worlds.new('Documentation studio');world.use_nodes=True;scene.world=world
    bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.018,.028,.045,1);bg.inputs['Strength'].default_value=.4
    for name,power,pos,color in [('Key',1700,(3,-6,7),(1,.83,.66)),('Fill',1100,(-4,-4,4),(.5,.7,1)),('Rim',1400,(1,4,5),(.3,1,.7))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=5;data.color=color
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=camera_pos);camera=bpy.context.object;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    if ortho:camera.data.type='ORTHO';camera.data.ortho_scale=ortho
    else:camera.data.lens=36/(2*math.tan(math.radians(38)/2)*(1400/788))
    scene.camera=camera
materials={}
for character in ['leonardo','raphael']:
    with bpy.data.libraries.load(str(root/'art'/(character+'.blend')),link=False)as(src,dst):dst.materials=src.materials
    materials.update({m.name:m for m in dst.materials if m})
poses={c:json.loads((root/'art'/(c+'-game-pose-review.json')).read_text()) for c in ['leonardo','raphael']}
def fighter(character,pose,x=0,flip=False):
    for o in poses[character][pose]:
        vertices=[((-v[0] if flip else v[0])+x,-v[1] if flip else v[1],v[2]) for v in o['vertices']]
        mesh=bpy.data.meshes.new(o['name']);idx=o['indices'];mesh.from_pydata(vertices,[],[idx[i:i+3] for i in range(0,len(idx),3)]);mesh.update()
        obj=bpy.data.objects.new(o['name'],mesh);scene.collection.objects.link(obj)
        if o['material']in materials:mesh.materials.append(materials[o['material']])
        for p in mesh.polygons:p.use_smooth=True
def render(name):scene.render.filepath=str(dest/name);bpy.ops.render.render(write_still=True)
clear();bpy.ops.import_scene.gltf(filepath=str(root/'public/models/midnight-dojo.glb'))
fighter('leonardo','idle',-3);fighter('raphael','idle',3,True)
studio((0,0,1.35),(0,-13.8,3.4));render('dojo.png')
clear();fighter('leonardo','idle');studio((0,0,1.4),(4,-6,2.2),6.2)
mat=bpy.data.materials.new('Rig overlay');mat.use_nodes=True
shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');shader.inputs['Base Color'].default_value=(.04,.7,1,1);shader.inputs['Emission Color'].default_value=(.04,.7,1,1);shader.inputs['Emission Strength'].default_value=2
offset=(scene.camera.location-Vector((0,0,1.4))).normalized()*2
for bone in json.loads((root/'art/leonardo-game-rig-review.json').read_text()):
    a=Vector(bone['a'])+offset;b=Vector(bone['b'])+offset
    curve=bpy.data.curves.new(bone['name'],'CURVE');curve.dimensions='3D';curve.bevel_depth=.012;curve.bevel_resolution=2
    spline=curve.splines.new('POLY');spline.points.add(1);spline.points[0].co=(*a,1);spline.points[1].co=(*b,1)
    obj=bpy.data.objects.new(bone['name'],curve);scene.collection.objects.link(obj);curve.materials.append(mat)
render('rig.png')
clear();fighter('leonardo','special-turn',-1.8);fighter('leonardo','spinKick',1.8)
studio((0,0,1.45),(0,-9,1.45),9.5);render('motion.png')
print('README_PREVIEWS_COMPLETE',flush=True)
