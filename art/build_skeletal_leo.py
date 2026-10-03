"""Separate skeletal prototype: existing Leo surfaces fitted to the CC0 reference rig.
Run in factory-startup background Blender. Never edits the live/user scene.
This is a binding study, not finished character topology or final skin weights.
"""
import bpy, sys, math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(sys.argv[sys.argv.index('--') + 1])
CHARACTER = sys.argv[sys.argv.index('--') + 2] if len(sys.argv) > sys.argv.index('--') + 2 else 'leonardo'
if CHARACTER not in {'leonardo','raphael'}: raise ValueError('Unknown fighter')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.name = CHARACTER.title() + ' - Skeletal Motion Study'
with bpy.data.libraries.load(str(ROOT/'art'/(CHARACTER+'.blend')), link=False) as (src, dst):
    dst.objects = src.objects
leo_objects = [o for o in dst.objects if o]
for o in leo_objects: bpy.context.collection.objects.link(o)
bpy.context.view_layer.update()
original_matrices = {o: o.matrix_world.copy() for o in leo_objects}
parts = {o.name: o for o in leo_objects if o.type == 'EMPTY'}
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/motions/quaternius/AnimationLibrary_Godot_Standard.gltf'))
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
arm.name = CHARACTER.title()+'Skeleton'
arm.animation_data_clear()
# Bake a uniform reference scale into rest bones and translation curves.
SCALE = 1.65
arm.data.transform(Matrix.Scale(SCALE, 4))
keep = {'Idle_Loop','Sword_Idle','Sword_Attack','Sword_Attack_RM','Crouch_Idle_Loop','Crouch_Fwd_Loop','Roll','Roll_RM','Walk_Loop','Punch_Jab','Punch_Cross','Hit_Chest','Jump_Start','Jump_Loop','Jump_Land','Death01'}
actions = []
for action in list(bpy.data.actions):
    if action.name not in keep:
        bpy.data.actions.remove(action)
        continue
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    if curve.data_path.endswith('.location'):
                        for key in curve.keyframe_points:
                            key.co.y *= SCALE
                            key.handle_left.y *= SCALE
                            key.handle_right.y *= SCALE
    actions.append(action)
for o in list(bpy.context.scene.objects):
    if o not in leo_objects and o != arm: bpy.data.objects.remove(o, do_unlink=True)
mapping = {'Body':'DEF-hips','Head':'DEF-head',
 'LeftArm':'DEF-upper_arm.R','RightArm':'DEF-upper_arm.L',
 'LeftForearm':'DEF-forearm.R','RightForearm':'DEF-forearm.L',
 'LeftLeg':'DEF-thigh.R','RightLeg':'DEF-thigh.L',
 'LeftShin':'DEF-shin.R','RightShin':'DEF-shin.L',
 'LeftFoot':'DEF-foot.R','RightFoot':'DEF-foot.L'}
next_part = {'LeftArm':'LeftForearm','RightArm':'RightForearm','LeftForearm':None,'RightForearm':None,
 'LeftLeg':'LeftShin','RightLeg':'RightShin','LeftShin':'LeftFoot','RightShin':'RightFoot'}
transforms = {}
for name, bone_name in mapping.items():
    pivot = original_matrices[parts[name]].translation
    bone = arm.data.bones[bone_name]
    rotation = Matrix.Identity(4); scale = 1.0
    if name in next_part:
        if next_part[name]: end = original_matrices[parts[next_part[name]]].translation
        else:
            side = 1 if name.startswith('Right') else -1
            end = original_matrices[parts[name]] @ Vector((-side*.03,-.145,-.45))
        source_axis = end - pivot
        target_axis = bone.tail_local - bone.head_local
        rotation = source_axis.rotation_difference(target_axis).to_matrix().to_4x4()
        scale = target_axis.length / source_axis.length
    elif name == 'Head': scale = .85
    elif name == 'Body':
        # Retain broad shell; slimmer torso fits the reference shoulder span.
        rotation = Matrix.Diagonal((.8, 1.0, 1.0, 1.0))
    transforms[name] = Matrix.Translation(bone.head_local) @ rotation @ Matrix.Scale(scale,4) @ Matrix.Translation(-pivot)

def ancestor(obj):
    p = obj.parent
    weapon = None
    while p:
        if p.name.startswith('WeaponGrip'): weapon = p
        if p.name in mapping: return p.name, weapon
        p = p.parent
    raise RuntimeError('Unmapped mesh '+obj.name)

meshes = []
for obj in leo_objects:
    if obj.type != 'MESH': continue
    part, grip = ancestor(obj)
    matrix = transforms[part] @ original_matrices[obj]
    if grip:
        # Attach the full sword rigidly to the wrist. Orient its blade in front
        # of the closed hand rather than retaining the old pivot's upward tilt.
        side = 'R' if part.startswith('Left') else 'L'
        hand = arm.data.bones['DEF-hand.'+side]
        grip_matrix = original_matrices[grip]
        local = grip_matrix.inverted() @ original_matrices[obj]
        grip_rotation = Matrix.Rotation(math.pi/2, 4, 'X')
        matrix = Matrix.Translation(hand.head_local + Vector((0,-.035,0))) @ grip_rotation @ local
        bone_name = hand.name
    else: bone_name = mapping[part]
    obj.data = obj.data.copy(); obj.data.transform(matrix)
    obj.parent = None; obj.matrix_world = Matrix.Identity(4)
    obj.vertex_groups.clear()
    def weight(name, index, value):
        group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
        group.add([index], value, 'REPLACE')
    for v in obj.data.vertices:
        if part == 'Body' and not grip:
            if any(k in obj.name.lower() for k in ['shell','scute','leather']):
                weight('DEF-spine.002',v.index,1)
            else:
                segments = ['DEF-hips','DEF-spine.001','DEF-spine.002','DEF-spine.003']
                heights = [arm.data.bones[n].head_local.z for n in segments]
                z=v.co.z
                if z<=heights[0]: weight(segments[0],v.index,1)
                elif z>=heights[-1]: weight(segments[-1],v.index,1)
                else:
                    for i in range(len(heights)-1):
                        if heights[i]<=z<heights[i+1]:
                            t=(z-heights[i])/(heights[i+1]-heights[i]); weight(segments[i],v.index,1-t); weight(segments[i+1],v.index,t); break
        else: weight(bone_name,v.index,1)
    obj.parent=arm
    modifier=obj.modifiers.new('Skeletal deformation','ARMATURE'); modifier.object=arm
    meshes.append(obj)
for o in leo_objects:
    if o.type != 'MESH': bpy.data.objects.remove(o,do_unlink=True)
arm.animation_data_create()
for action in actions:
    track=arm.animation_data.nla_tracks.new(); track.name=action.name
    strip=track.strips.new(action.name,0,action)
    strip.action_slot=action.slots[0]
    track.mute=True
arm.animation_data.action=next(a for a in actions if a.name=='Sword_Idle')
arm.animation_data.action_slot=arm.animation_data.action.slots[0]
scene=bpy.context.scene; scene.render.fps=30; scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art'/(CHARACTER+'-skeletal.blend')))
arm.animation_data.action=None
# Unmute tracks for exporter; export NLA strips as independent clips.
for track in arm.animation_data.nla_tracks: track.mute=False
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True)
for obj in meshes: obj.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models'/(CHARACTER+'-skeletal.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_cameras=False,export_lights=False)
print('SKELETAL_FIGHTER_EXPORTED',CHARACTER,len(arm.data.bones),'bones',len(meshes),'meshes',len(actions),'clips',flush=True)
