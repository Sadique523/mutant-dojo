import bpy,sys,json
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1])
character=sys.argv[sys.argv.index('--')+2] if len(sys.argv)>sys.argv.index('--')+2 else 'leonardo'
if character not in {'leonardo','raphael'}:raise ValueError('Unknown fighter')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
with bpy.data.libraries.load(str(root/'art'/(character+'.blend')),link=False)as(src,dst):dst.materials=src.materials
materials={m.name:m for m in dst.materials if m}
scene=bpy.context.scene
world=bpy.data.worlds.new('Review');world.use_nodes=True;scene.world=world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.03,.05,.065,1);bg.inputs['Strength'].default_value=.4
for name,position,energy,color in [('Key',(2,-4,5),1000,(1,.8,.6)),('Fill',(-3,-3,3),650,(.5,.7,1)),('Rim',(1,3,4),900,(.5,1,.7))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.color=color;data.size=4
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector((0,0,1.35))-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-8,1.35));camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.35))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=4;scene.camera=camera
try:scene.render.engine='CYCLES'
except TypeError:pass
scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=720;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
for name,objects in json.loads((root/'art'/(character+'-game-pose-review.json')).read_text()).items():
    if '--special-only' in sys.argv and not name.startswith('special-'):continue
    made=[]
    for obj in objects:
        mesh=bpy.data.meshes.new(obj['name']);idx=obj['indices'];mesh.from_pydata(obj['vertices'],[],[idx[i:i+3]for i in range(0,len(idx),3)]);mesh.update()
        item=bpy.data.objects.new(obj['name'],mesh);scene.collection.objects.link(item);made.append(item)
        if obj['material']in materials:mesh.materials.append(materials[obj['material']])
        for p in mesh.polygons:p.use_smooth=True
    scene.render.filepath=str(root/'art'/(character+'-game-'+name+'-review.png'));bpy.ops.render.render(write_still=True)
    for item in made:bpy.data.objects.remove(item,do_unlink=True)
print('GAME_POSE_REVIEW_COMPLETE',flush=True)
