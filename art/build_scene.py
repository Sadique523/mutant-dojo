"""Reproducible Blender art build. Z-up source -> Y-up glTF runtime.

Run via npm run art. Each asset has its own .blend source and embedded GLB.
These are authored procedural base meshes, not finished production sculpts.
"""
import bpy
import math
import random
import argparse
import sys
from pathlib import Path
from mathutils import Vector

args = argparse.ArgumentParser()
args.add_argument('--output', required=True)
args.add_argument('--source', required=True)
args.add_argument('--fighters', action='store_true', help='Rebuild only characters; keep the existing arena')
options = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
OUT, SOURCE = Path(options.output), Path(options.source)
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
random.seed(27)

def fresh(name):
    # This script runs in a factory-startup background process, never in a user scene.
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.name = name

def texture(name, color, amplitude=.1, size=256):
    image = bpy.data.images.new(name, width=size, height=size)
    rng = random.Random(name)
    pixels = []
    for y in range(size):
        for x in range(size):
            variation = rng.uniform(-amplitude, amplitude)
            variation += math.sin(x*.13)*math.sin(y*.09)*amplitude*.3
            pixels.extend([max(.01, min(1, c+variation)) for c in color] + [1])
    image.pixels.foreach_set(pixels)
    image.pack()
    return image

def mat(name, color, rough=.55, metal=0, emission=0, textured=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    node = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = rough
    node.inputs['Metallic'].default_value = metal
    node.inputs['Emission Color'].default_value = (*color, 1)
    node.inputs['Emission Strength'].default_value = emission
    if textured:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = texture(name + '_surface', color, .045)
        m.node_tree.links.new(tex.outputs['Color'], node.inputs['Base Color'])
    m.diffuse_color = (*color, 1)
    return m

def finish(obj, name, material, parent=None):
    obj.name = name
    obj.data.materials.append(material)
    if parent:
        obj.parent = parent
    return obj

def cube(name, pos, scale, material, bevel=.03, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, material, parent)

def ellipsoid(name, pos, scale, material, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    for face in obj.data.polygons:
        face.use_smooth = True
    return finish(obj, name, material, parent)

def rod(name, a, b, radius, material, parent=None, vertices=16):
    delta = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=delta.length, location=(Vector(a)+Vector(b))/2)
    obj = bpy.context.object
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    for face in obj.data.polygons:
        face.use_smooth = True
    return finish(obj, name, material, parent)

def line(name, points, radius, material, parent=None):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for point, xyz in zip(spline.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    if parent:
        obj.parent = parent
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj

def empty(name, pos=(0,0,0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    obj.parent = parent
    return obj

def panel(name, outline, y, depth, material, parent=None, bevel=.035):
    """A shaped XZ armor/face panel, rather than an overlapping sphere."""
    count = len(outline)
    vertices = [(x,y-depth/2,z) for x,z in outline] + [(x,y+depth/2,z) for x,z in outline]
    faces = [tuple(reversed(range(count))),tuple(range(count,count*2))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Sculpted edge','BEVEL')
    mod.width=bevel
    mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # Simple planar UVs retain the authored surface variation in glTF.
    uv=obj.data.uv_layers.new(name='Surface UV')
    for face in obj.data.polygons:
        for index in face.loop_indices:
            point=obj.data.vertices[obj.data.loops[index].vertex_index].co
            uv.data[index].uv=(point.x+.5,point.z+.5)
    return finish(obj,name,material,parent)

def lettering(text, pos, size, material, rotation=(math.pi/2,0,0)):
    curve = bpy.data.curves.new('Sign lettering', 'FONT')
    curve.body = text
    curve.size = size
    curve.align_x = 'CENTER'
    curve.extrude = .008
    obj = bpy.data.objects.new('Sign_'+text, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = rotation
    obj.data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    return obj

def export(name, combine=False):
    if combine:
        # Merge by material and parent, preserving each animation pivot.
        groups = {}
        for obj in list(bpy.context.scene.objects):
            if obj.type == 'MESH' and len(obj.data.materials) == 1:
                key=(obj.parent.name if obj.parent else '', obj.data.materials[0].name)
                groups.setdefault(key, []).append(obj)
        for key, objects in groups.items():
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            if len(objects) > 1:
                bpy.ops.object.join()
            bpy.context.object.name = 'Surface_'+key[1]
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / (name+'.blend')))
    bpy.ops.export_scene.gltf(filepath=str(OUT / (name+'.glb')), export_format='GLB', export_yup=True, export_animations=False, export_cameras=False, export_lights=False)
    print('EXPORTED', name, 'objects', len(bpy.context.scene.objects), flush=True)

def fighter(name, mask_color, swords):
    fresh(name)
    skin = mat('Skin_'+name, (.23,.38,.13), .7, textured=True)
    skin_light = mat('Skin_highlight_'+name, (.31,.46,.18), .65, textured=True)
    shell = mat('Shell_'+name, (.09,.16,.065), .58, textured=True)
    plate = mat('Shell_scutes_'+name, (.18,.27,.09), .5, textured=True)
    belly = mat('Plastron_'+name, (.57,.43,.19), .6, textured=True)
    cloth = mat('Bandana_'+name, mask_color, .85, textured=True)
    leather = mat('Leather_'+name, (.13,.065,.03), .72, textured=True)
    wraps = mat('Linen_'+name, (.62,.57,.42), .9, textured=True)
    metal = mat('Weapon_steel_'+name, (.48,.56,.61), .23, .85)
    eye = mat('Eyes_'+name, (.88,.9,.73), .25)
    pupil = mat('Pupils_'+name, (.015,.02,.01), .3)
    root = empty('FighterRoot')
    body = empty('Body', (0,0,1.28), root)
    ellipsoid('Torso', (0,0,.45), (.56,.35,.67), skin, body)
    ellipsoid('Shell', (0,.29,.48), (.65,.27,.76), shell, body)
    # Overlapping scutes give the shell an actual segmented silhouette.
    for z in [-.05,.38,.78]:
        for x in [-.31,0,.31]:
            y = .47 - abs(x)*.13
            ellipsoid('Carapace_plate', (x,y,z), (.235,.10,.27), plate, body)
    for row,z in enumerate([.06,.37,.68]):
        width = [.40,.47,.51][row]
        for side in [-1,1]:
            shape=[(.025,z-.135),(width*.83,z-.15),(width,z+.04),(width*.86,z+.16),(.025,z+.15)]
            panel('Plastron_segment',[(side*x,zz) for x,zz in shape],-.355,.12,belly,body,.035)
    belt = cube('Belt', (0,0,-.02), (1.08,.74,.16), leather, .045, body)
    ellipsoid('Buckle', (0,-.405,-.02), (.11,.035,.11), metal, body)
    head = empty('Head', (0,-.04,1.07), body)
    ellipsoid('Skull', (0,0,0), (.36,.29,.31), skin_light, head)
    ellipsoid('Muzzle', (0,-.16,-.14), (.33,.20,.14), skin, head)
    # Eye band curves around the entire head; front strips frame inset eyes.
    ellipsoid('Mask', (0,0,.025), (.365,.295,.095), cloth, head)
    for side in [-1,1]:
        almond=[(.05,.045),(.26,.078),(.24,-.013),(.11,-.02)]
        panel('Focused_eye',[(side*x,z) for x,z in almond],-.288,.018,eye,head,.007)
        ellipsoid('Eye_pupil', (side*.14,-.309,.017), (.017,.008,.028), pupil, head)
        brow = panel('Angled_brow',[(side*x,z) for x,z in [(.035,.054),(.275,.09),(.265,.132),(.03,.103)]],-.298,.025,cloth,head,.009)
        ellipsoid('Nostril', (side*.10,-.344,-.085), (.018,.01,.012), pupil, head)
    line('Mouth', [(-.20,-.302,-.205),(0,-.350,-.218),(.20,-.302,-.205)], .006, leather, head)
    for side in [-1,1]:
        tail = cube('Bandana_tail', (side*.09,.48,-.015), (.105,.42,.045), cloth, .018, head)
        tail.rotation_euler.z = side*.23
        arm = empty('LeftArm' if side < 0 else 'RightArm', (side*.56,0,.72), body)
        ellipsoid('Deltoid', (side*.07,0,-.06), (.245,.25,.26), skin_light, arm)
        ellipsoid('Biceps', (side*.15,-.03,-.32), (.19,.21,.34), skin, arm)
        ellipsoid('Elbow_pad', (side*.22,-.015,-.55), (.245,.255,.115), leather, arm)
        forearm = empty('LeftForearm' if side < 0 else 'RightForearm', (side*.22,-.015,-.55), arm)
        ellipsoid('Forearm', (-side*.02,-.105,-.19), (.18,.20,.28), skin_light, forearm)
        for z in [-.77,-.83,-.89]:
            ellipsoid('Wrist_wrap', (-side*.03,-.125,z+.55), (.225,.236,.045), wraps, forearm)
        ellipsoid('Hand', (-side*.03,-.145,-.45), (.22,.22,.16), skin, forearm)
        for finger in [-1,0,1]:
            ellipsoid('Finger', (-side*.03+finger*.11,-.285,-.47), (.065,.10,.085), skin, forearm)
        weapon = empty('WeaponGrip', (-side*.03,-.145,-.45), forearm)
        weapon.rotation_euler.x = math.pi*.75
        if swords:
            rod('Katana_grip', (0,0,-.12), (0,0,.18), .042, leather, weapon)
            for z in [-.1,-.05,0,.05,.1,.15]:
                rod('Katana_wrap', (0,0,z),(0,0,z+.018),.046,wraps,weapon)
            cube('Katana_guard', (0,0,.22), (.23,.14,.025), metal, .01, weapon)
            panel('Katana_blade',[(-.033,.24),(.033,.24),(.026,1.35),(-.003,1.47),(-.033,1.31)],0,.025,metal,weapon,.005)
        else:
            rod('Sai_handle', (0,0,-.12), (0,0,.18), .035, leather, weapon)
            rod('Sai_center', (0,0,.18), (0,0,.72), .025, metal, weapon)
            for offset in [-.1,.1]:
                line('Sai_prong', [(0,0,.2),(offset,0,.30),(offset,0,.49)], .019, metal, weapon)
        leg = empty('LeftLeg' if side < 0 else 'RightLeg', (side*.30,0,1.25), root)
        ellipsoid('Thigh', (side*.07,0,-.28), (.25,.25,.42), skin, leg)
        shin = empty('LeftShin' if side < 0 else 'RightShin', (side*.10,0,-.60), leg)
        ellipsoid('Knee_pad', (0,-.19,0), (.22,.13,.17), leather, shin)
        ellipsoid('Shin', (side*.02,0,-.23), (.18,.21,.34), skin_light, shin)
        for z in [-1.0,-1.05,-1.10]:
            ellipsoid('Ankle_wrap', (side*.02,0,z+.60), (.205,.226,.037), wraps, shin)
        foot = empty('LeftFoot' if side < 0 else 'RightFoot', (side*.02,0,-.51), shin)
        ellipsoid('Foot', (0,-.13,-.04), (.235,.33,.12), skin, foot)
        for toe in [-1,1]:
            ellipsoid('Toe', (toe*.105,-.37,-.04), (.09,.12,.105), skin, foot)
    export(name, combine=True)

def environment():
    fresh('Midnight_Dojo')
    concrete = mat('Concrete', (.18,.22,.26), .82, textured=True)
    floor = mat('Wet_rooftop', (.10,.15,.18), .24, .18, textured=True)
    grout = mat('Mortar', (.045,.055,.065), .95)
    brick = [mat('Brick_'+str(i), (.16+i*.018,.065+i*.008,.045+i*.008), .9, textured=True) for i in range(4)]
    steel = mat('Blackened_steel', (.035,.06,.07), .38, .7)
    brass = mat('Worn_brass', (.36,.23,.085), .35, .75)
    wood = mat('Water_tower_wood', (.16,.095,.045), .85, textured=True)
    neon = mat('Jade_neon', (.08,.85,.58), .3, emission=4)
    warm = mat('Lantern_glass', (1,.32,.045), .4, emission=3)
    window = mat('Distant_windows', (.48,.62,.72), .5, emission=.7)
    dark_city = mat('City_silhouette', (.04,.07,.11), .9)
    paint = mat('Arena_paint', (.48,.38,.23), .6)
    cube('Building_base', (0,0,-1.4), (19,12,2.5), concrete, .08)
    cube('Rooftop', (0,0,-.10), (19,12,.20), floor, .02)
    # Individual slabs, uneven roughness, and inlaid combat boundary.
    for x in range(-8,9,2):
        for y in range(-4,5,2):
            cube('Slab', (x,y,.009), (1.975,1.975,.025), floor, .012)
    for y in [-2.6,2.6]:
        cube('Arena_border', (0,y,.035), (13,.055,.008), paint, .004)
    for x in [-6.5,6.5]:
        cube('Arena_border', (x,0,.035), (.055,5.2,.008), paint, .004)
    for r in [1.25,1.35]:
        line('Dojo_crest', [(r*math.cos(i*math.tau/80),r*math.sin(i*math.tau/80),.04) for i in range(81)], .016, paint)
    for i in range(35):
        x,y = random.uniform(-8,8),random.uniform(-4,4)
        line('Crack', [(x,y,.035),(x+.1,y+.16,.035),(x+.28,y+.24,.035)], .008, grout)
    # Low front and side parapets preserve the fighter silhouettes.
    for y in [-5.9,5.9]:
        cube('Parapet', (0,y,.38), (19,.3,.76), concrete)
        cube('Parapet_cap', (0,y,.79), (19,.45,.12), steel)
    for x in [-9.4,9.4]:
        cube('Parapet', (x,0,.38), (.3,12,.76), concrete)
    # Back wall: authored masonry, shutter, doorway, pipes, canopy, neon sign.
    cube('Back_wall', (0,5.4,2.15), (19,.4,4.3), grout)
    for row in range(14):
        for col in range(27):
            x = -9.05 + col*.69 + (row%2)*.345
            if abs(x)<2.1 and row<10:
                continue
            cube('Masonry', (x,5.15,.18+row*.3), (.66,.18,.27), random.choice(brick), .017)
    cube('Door_frame', (0,5.03,1.5), (4.3,.27,3.12), steel)
    cube('Shutter', (0,4.84,1.47), (3.9,.12,2.8), concrete)
    for z in range(18):
        cube('Shutter_rib', (0,4.75,.16+z*.15), (3.8,.05,.035), steel, .008)
    cube('Sign_backplate', (0,4.77,3.66), (5.4,.2,.82), steel)
    lettering('MUTANT DOJO', (0,4.63,3.46), .46, neon)
    cube('Canopy', (0,4.45,3.07), (4.8,1.6,.15), steel)
    for x in [-5.5,5.5]:
        line('Wall_pipe', [(x,4.78,.2),(x,4.78,3.6),(x+.6,4.78,3.9),(x+1,4.78,3.9)], .065, brass)
        for z in [.7,1.8,2.9]:
            cube('Pipe_bracket', (x,4.9,z), (.24,.26,.08), steel, .01)
    # Industrial ventilation prop and large timber water tower.
    cube('Vent_unit', (-7,3.3,.65), (2,1.4,1.3), concrete, .08)
    for x in range(12):
        cube('Vent_grille', (-7.8+x*.145,2.58,.65), (.04,.035,.9), steel, .004)
    for x in [6.3,7.7]:
        for y in [2.8,4.2]:
            rod('Tower_leg', (x,y,0),(x,y,3), .10, steel)
    rod('Water_tank', (7,3.5,2.8),(7,3.5,5.2), 1.14, wood, vertices=48)
    for z in [2.85,3.4,4.1,4.85,5.15]:
        line('Tank_band', [(7+1.155*math.cos(i*math.tau/64),3.5+1.155*math.sin(i*math.tau/64),z) for i in range(65)], .035, steel)
    for i in range(24):
        angle = i*math.tau/24
        rod('Tank_stave', (7+1.145*math.cos(angle),3.5+1.145*math.sin(angle),2.85),(7+1.145*math.cos(angle),3.5+1.145*math.sin(angle),5.15),.012, brass)
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=1.3, radius2=.1, depth=.7, location=(7,3.5,5.55))
    finish(bpy.context.object,'Tank_roof',steel)
    for x in [-7,-4,4,7]:
        rod('Lantern_post', (x,-4.7,0),(x,-4.7,2.5), .06, steel)
        cube('Lantern', (x,-4.7,2.3), (.32,.32,.48), warm)
        for z in [2.04,2.56]:
            cube('Lantern_cap', (x,-4.7,z), (.43,.43,.08), steel)
    # Sagging festoon cable across the back of the arena.
    line('Festoon_cable', [(x,3.4,3.5-.6*(1-(x/8)**2)) for x in range(-8,9)], .015, steel)
    for x in range(-8,9):
        z=3.5-.6*(1-(x/8)**2)
        rod('Bulb_socket',(x,3.4,z),(x,3.4,z-.10),.027,steel)
        ellipsoid('Festoon_bulb',(x,3.4,z-.16),(.055,.055,.085),warm)
    # Three skyline depth layers; windows are combined during export.
    for i in range(38):
        x = random.uniform(-36,36)
        y = random.uniform(11,35)
        width = random.uniform(1.8,4)
        height = random.uniform(4,18)
        cube('Skyline', (x,y,height/2-2), (width,random.uniform(2,4),height), dark_city, .02)
        if i<22:
            for col in range(3):
                for row in range(int(height/1.1)):
                    if random.random()<.4:
                        cube('City_window',(x-width*.3+col*width*.3,y-2.05,row*1.1-1),(.17,.02,.34),window,.002)
    export('midnight-dojo', combine=True)

if not options.fighters:
    print('BUILDING MIDNIGHT DOJO', flush=True)
    environment()
print('BUILDING LEONARDO', flush=True)
fighter('leonardo', (.035,.22,.56), True)
print('BUILDING RAPHAEL', flush=True)
fighter('raphael', (.55,.035,.025), False)
print('ART BUILD COMPLETE', flush=True)
