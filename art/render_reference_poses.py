"""Render the same provisional joint poses used by the lab for visual QA."""
import bpy
import sys
import math
import json
from pathlib import Path
from mathutils import Vector, Quaternion

root=Path(sys.argv[sys.argv.index('--')+1])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.name='Leo - Tournament Fighters Pose Studies'
basis=Quaternion((1,0,0),-math.pi/2)
def source_rotation(value):
    x,y,z,w=value
    return basis.inverted() @ Quaternion((w,x,y,z)) @ basis
for pose in json.loads((root/'art'/'reference-poses.json').read_text()):
    before=set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(root/'public'/'models'/'leonardo.glb'))
    objects=set(scene.objects)-before
    top=next(obj for obj in objects if obj.parent is None)
    top.rotation_mode='QUATERNION'
    top.rotation_quaternion=source_rotation(pose['root'])
    top.location=(pose['x'],0,pose['lift'])
    for name,rotation in pose['rotations'].items():
        part=next((obj for obj in objects if obj.name.split('.')[0]==name),None)
        if part:
            part.rotation_mode='QUATERNION'
            part.rotation_quaternion=source_rotation(rotation)
    for name in ['Body','LeftLeg','RightLeg']:
        part=next(obj for obj in objects if obj.name.split('.')[0]==name)
        part.location.z-=pose['crouch']
    bpy.context.view_layer.update()
    foot=next(obj for obj in objects if obj.name.split('.')[0]=='RightFoot')
    minimum=min((obj.matrix_world@Vector(vertex)).z for obj in foot.children_recursive if obj.type=='MESH' for vertex in obj.bound_box)
    top.location.z-=minimum+.02
    text=bpy.data.curves.new(pose['label'],'FONT')
    text.body=pose['label'].upper()
    text.align_x='CENTER'
    text.size=.23
    label=bpy.data.objects.new(pose['label'],text)
    scene.collection.objects.link(label)
    label.location=(pose['x'],1,4.5)
    label.rotation_euler=(math.pi/2,0,0)

def material(name,color):
    mat=bpy.data.materials.new(name)
    node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value=(*color,1)
    node.inputs['Roughness'].default_value=.7
    return mat
bpy.ops.mesh.primitive_plane_add(size=200)
floor=bpy.context.object
floor.location.z=-.025
floor.data.materials.append(material('Studio floor',(.055,.075,.085)))
world=bpy.data.worlds.new('Studio atmosphere')
background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
background.inputs['Color'].default_value=(.05,.07,.085,1)
background.inputs['Strength'].default_value=.45
scene.world=world
def area(name,pos,color,energy,size):
    data=bpy.data.lights.new(name,'AREA')
    data.color=color
    data.energy=energy
    data.size=size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=pos
    obj.rotation_euler=(Vector((0,0,1.5))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Warm studio key',(1,-7,8),(1,.85,.65),2400,8)
area('Cool fill',(-7,-3,5),(.55,.7,1),1700,7)
area('Shell rim',(4,4,6),(.65,1,.8),1900,6)
bpy.ops.object.camera_add(location=(4,-16,7))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,2.1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.lens=43
scene.camera=camera
try:
    scene.render.engine='CYCLES'
except TypeError:
    pass
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1920
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.render.filepath=str(root/'art'/'leo-pose-review.png')
scene.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art'/'leo-pose-review.blend'))
bpy.ops.render.render(write_still=True)
print('POSE REVIEW COMPLETE',flush=True)
