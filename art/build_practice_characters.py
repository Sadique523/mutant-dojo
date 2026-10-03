"""Original low-poly motion mannequins with the game's editable pivot hierarchy."""
import bpy, sys
from pathlib import Path
root = Path(sys.argv[sys.argv.index('--') + 1])

def build(name, bulky, color):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.name = name
    def material(label, rgb):
        mat = bpy.data.materials.new(label)
        mat.use_nodes = True
        node = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
        node.inputs['Base Color'].default_value = (*rgb, 1)
        node.inputs['Roughness'].default_value = .65
        return mat
    suit = material('Practice_suit_' + name, color)
    dark = material('Practice_joint_' + name, (.075,.11,.14))
    face = material('Practice_visor_' + name, (.9,.66,.28))
    def joint(name, position, parent=None):
        obj = bpy.data.objects.new(name, None)
        scene.collection.objects.link(obj)
        obj.parent = parent
        obj.location = position
        return obj
    def mesh(label, location, size, mat, parent):
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.object
        obj.name = label
        obj.parent = parent
        obj.location = location
        obj.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.data.materials.append(mat)
        bevel = obj.modifiers.new('Small silhouette bevel', 'BEVEL')
        bevel.width = .025
        bevel.segments = 1
        return obj
    top = joint('FighterRoot', (0,0,0))
    body = joint('Body', (0,0,1.28), top)
    width = 1.12 if bulky else .83
    mesh('Chest', (0,0,.43), (width,.45 if bulky else .33,.78), suit, body)
    mesh('Waist', (0,0,.06), (.62,.32,.2), dark, body)
    head = joint('Head', (0,-.015,1.07), body)
    mesh('Helmet', (0,0,0), (.52 if bulky else .43,.39,.43), suit, head)
    mesh('Visor', (0,-.205,.03), (.4,.035,.14), face, head)
    for side, prefix in [(-1,'Left'), (1,'Right')]:
        arm = joint(prefix+'Arm', (side*.56,0,.72), body)
        mesh('Upper_arm', (side*.1,0,-.28), (.28 if bulky else .21,.25,.48), suit, arm)
        forearm = joint(prefix+'Forearm', (side*.22,-.015,-.55), arm)
        mesh('Forearm', (0,-.04,-.2), (.25 if bulky else .18,.23,.38), suit, forearm)
        mesh('Fist', (-side*.03,-.145,-.45), (.25,.26,.22), face, forearm)
        leg = joint(prefix+'Leg', (side*.3,0,1.25), top)
        mesh('Thigh', (side*.04,0,-.3), (.33 if bulky else .24,.3,.51), suit, leg)
        shin = joint(prefix+'Shin', (side*.1,0,-.6), leg)
        mesh('Shin', (0,0,-.24), (.27 if bulky else .2,.25,.43), suit, shin)
        foot = joint(prefix+'Foot', (side*.02,0,-.51), shin)
        mesh('Boot', (0,-.1,-.065), (.31,.48,.15), dark, foot)
    scene.world.color = (.15,.15,.15)
    bpy.ops.wm.save_as_mainfile(filepath=str(root/'art'/(name+'.blend')))
    bpy.ops.export_scene.gltf(filepath=str(root/'public'/'models'/(name+'.glb')), export_format='GLB', export_apply=True)
    print('PRACTICE CHARACTER EXPORTED', name, flush=True)

build('practice-scout', False, (.16,.48,.48))
build('practice-brute', True, (.65,.23,.16))
print('PRACTICE BUILD COMPLETE', flush=True)
