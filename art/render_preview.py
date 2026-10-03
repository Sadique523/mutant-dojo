"""Compose exported game assets in Blender for offline visual QA."""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

root = Path(sys.argv[sys.argv.index('--') + 1])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
for name in ['midnight-dojo', 'leonardo', 'raphael']:
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(root / 'public' / 'models' / (name+'.glb')))
    new = set(scene.objects) - before
    if name != 'midnight-dojo':
        top = next(obj for obj in new if obj.parent is None)
        top.location.x = -3 if name == 'leonardo' else 3
        top.rotation_mode='XYZ'
        top.rotation_euler.z = .85 if name == 'leonardo' else -.85
        for arm_name in ['LeftArm', 'RightArm']:
            arm = next((obj for obj in new if obj.name.split('.')[0] == arm_name), None)
            if arm:
                arm.rotation_mode='XYZ'
                arm.rotation_euler.x = -.65 if arm_name == 'LeftArm' else -.8

world = bpy.data.worlds.new('Midnight atmosphere')
world.use_nodes = True
background = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
background.inputs['Color'].default_value = (.025,.045,.09,1)
background.inputs['Strength'].default_value = .35
scene.world = world
def area(name, pos, color, energy, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.color = color
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Moon', (-6,5,12), (.35,.55,1), 1900, 8)
area('Warm key', (3,-6,7), (1,.72,.42), 1600, 7)
area('Jade rim', (0,5,4), (.12,1,.65), 900, 5)
for x in [-7,-4,4,7]:
    data=bpy.data.lights.new('Lantern light','POINT')
    data.color=(1,.32,.06)
    data.energy=90
    data.shadow_soft_size=.3
    obj=bpy.data.objects.new('Lantern light',data)
    scene.collection.objects.link(obj)
    obj.location=(x,-4.7,2.3)
bpy.ops.object.camera_add(location=(.5,-13.8,5.1))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.2))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.lens=36/(2*math.tan(math.radians(38)/2)*(1600/900))
scene.camera=camera
try:
    scene.render.engine='CYCLES'
except TypeError:
    pass
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1600
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.render.filepath=str(root/'art'/'midnight-preview.png')
scene.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art'/'midnight-preview.blend'))
bpy.ops.render.render(write_still=True)
print('PREVIEW COMPLETE')
