import bpy, sys
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1])
bpy.ops.wm.open_mainfile(filepath=str(root/'art/leonardo-skeletal.blend'))
scene=bpy.context.scene
arm=next(o for o in scene.objects if o.type=='ARMATURE')
for track in arm.animation_data.nla_tracks: track.mute=True
world=bpy.data.worlds.new('Rig review studio'); world.use_nodes=True
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND'); bg.inputs['Color'].default_value=(.045,.065,.08,1); bg.inputs['Strength'].default_value=.4; scene.world=world
for name,pos,color,energy in [('Key',(3,-4,6),(1,.84,.64),1100),('Fill',(-4,-2,3),(.5,.72,1),650),('Rim',(1,4,4),(.5,1,.7),1000)]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.color=color; data.size=4
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=pos
    obj.rotation_euler=(Vector((0,0,1.3))-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200)
floor=bpy.context.object; floor.name='Review floor'; floor.location.z=-.06
mat=bpy.data.materials.new('Floor'); mat.use_nodes=True
next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'].default_value=(.045,.07,.08,1); floor.data.materials.append(mat)
bpy.ops.object.camera_add(location=(4,-6,3.1))
camera=bpy.context.object; camera.rotation_euler=(Vector((0,0,1.25))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=4.6; scene.camera=camera
try: scene.render.engine='CYCLES'
except TypeError: pass
scene.cycles.samples=12; scene.cycles.use_denoising=True
scene.render.resolution_x=640; scene.render.resolution_y=720; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for name,frame in [('Sword_Idle',0),('Sword_Attack',15),('Crouch_Idle_Loop',0),('Roll',17)]:
    arm.animation_data.action=bpy.data.actions[name]; arm.animation_data.action_slot=arm.animation_data.action.slots[0]; scene.frame_set(frame)
    scene.render.filepath=str(root/'art'/('skeletal-'+name+'.png')); bpy.ops.render.render(write_still=True)
print('SKELETAL_REVIEW_COMPLETE',flush=True)
