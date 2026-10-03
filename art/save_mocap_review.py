"""Create a separate editable Blender file without touching the open scene."""
import bpy, pathlib, sys
root = pathlib.Path(sys.argv[sys.argv.index('--') + 1])
bpy.ops.import_scene.gltf(filepath=str(root/'public/motions/accad/leonardo-kicks.glb'))
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
track = next(t for t in arm.animation_data.nla_tracks if 'Combat_FrontKick' in t.name)
for t in arm.animation_data.nla_tracks: t.mute = t != track
bpy.context.scene.frame_set(int(track.strips[0].frame_start + 17))
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/leonardo-mocap-kicks.blend'))
print('EDITABLE_MOCAP_SAVED',len(arm.data.bones),len(arm.animation_data.nla_tracks),flush=True)
