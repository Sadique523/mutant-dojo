"""Author Leo's approved held-leg, two-turn special as an editable Blender action."""
import bpy, math, pathlib, sys
from mathutils import Vector, Matrix, Quaternion
root=pathlib.Path(sys.argv[sys.argv.index('--')+1]); scene=bpy.context.scene; scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(root/'public/motions/accad/leonardo-kicks.glb'))
arm=next(o for o in scene.objects if o.type=='ARMATURE'); bones=arm.pose.bones
tracks=list(arm.animation_data.nla_tracks)
front=next(t for t in tracks if t.name=='Combat_FrontKick'); idle=next(t for t in tracks if t.name=='Sword_Idle')
spin=next(t for t in tracks if t.name=='Combat_SpinKick')
START,ACTIVE,END=12,18,45
def pose(track,time):
    arm.animation_data.action=None
    for t in tracks:t.mute=t!=track
    scene.frame_set(int(time*60),subframe=time*60%1);bpy.context.view_layer.update()
    return {b.name:b.matrix_basis.copy() for b in bones}
grip=pose(idle,.2)
frames={f:pose(front,17*min(f/START,1)/30) for f in range(START+1)}
held=pose(front,17/30)
pose(spin,27/30)
donor_hip=bones['DEF-thigh.L'].head.copy();donor_knee=bones['DEF-shin.L'].head.copy();donor_ankle=bones['DEF-foot.L'].head.copy()
donor_reach=donor_ankle-donor_hip
kick_elevation=math.atan2(donor_reach.z,math.hypot(donor_reach.x,donor_reach.y))
kick_extension=donor_reach.length/((donor_knee-donor_hip).length+(donor_ankle-donor_knee).length)
recover={f:pose(front,(17+25*(f-START-ACTIVE)/(END-START-ACTIVE))/30) for f in range(START+ACTIVE+1,END+1)}
# Borrow the approved single-spin kick's turn acceleration, torso, head and
# arm follow-through. Keep the new special's held leg, rather than substituting
# the donor's kick/retraction. Two nine-frame turns replace two 24-frame turns.
spin_poses=[];heading=[]
for f in range(ACTIVE//2+1):
    spin_poses.append(pose(spin,.4+1.05*f/(ACTIVE//2)))
    direction=bones['DEF-hips'].matrix.to_quaternion()@Vector((1,0,0))
    heading.append(math.atan2(direction.y,direction.x))
travel=[0.]
for a,b in zip(heading,heading[1:]):
    delta=(b-a+math.pi)%(2*math.pi)-math.pi
    travel.append(travel[-1]+abs(delta))
turn_curve=[t/travel[-1] for t in travel]
for t in tracks:t.mute=True
action=bpy.data.actions.new('Combat_BlueFlameSpin'); arm.animation_data.action=action
def restore(values):
    for b in bones:b.matrix_basis=values[b.name]
    # Retain the approved compact sword-idle guard, including closed fingers.
    for b in bones:
        if any(s in b.name for s in ('shoulder','upper_arm','forearm','hand','f_','thumb')):b.matrix_basis=grip[b.name]
    bpy.context.view_layer.update()
def point(bone,child,target):
    b=bones[bone]; delta=(bones[child].head-b.head).rotation_difference(target-b.head)
    b.matrix=Matrix.LocRotScale(b.head,delta@b.matrix.to_quaternion(),Vector((1,1,1)));bpy.context.view_layer.update()
def tuck():
    thigh=bones['DEF-thigh.L']; shin=bones['DEF-shin.L']; foot=bones['DEF-foot.L']
    hip=thigh.head.copy(); l1=(shin.head-hip).length;l2=(foot.head-shin.head).length
    target=hip+Vector((-.08,.24,-.65));axis=(target-hip).normalized();d=(target-hip).length
    along=(l1*l1-l2*l2+d*d)/(2*d);pole=Vector((0,-1,0));pole=(pole-axis*pole.dot(axis)).normalized()
    knee=hip+axis*along+pole*math.sqrt(max(0,l1*l1-along*along))
    point(thigh.name,shin.name,knee);point(shin.name,foot.name,target)

# Match the approved spin kick's contact elevation and knee extension on the
# special's right leg. Use joint geometry, not opposite-side local quaternions.
restore(held)
thigh=bones['DEF-thigh.R'];shin=bones['DEF-shin.R'];foot=bones['DEF-foot.R']
hip=thigh.head.copy();l1=(shin.head-hip).length;l2=(foot.head-shin.head).length
direction=foot.head-hip;direction.z=0;direction.normalize()
direction=direction*math.cos(kick_elevation)+Vector((0,0,math.sin(kick_elevation)))
distance=min(l1+l2-.001,(l1+l2)*kick_extension)
target=hip+direction*distance
along=(l1*l1-l2*l2+distance*distance)/(2*distance)
pole=(Vector((0,0,1))-direction*direction.z).normalized()
knee=hip+direction*along+pole*math.sqrt(max(0,l1*l1-along*along))
foot_rotation=foot.matrix.to_quaternion()
point(thigh.name,shin.name,knee);point(shin.name,foot.name,target)
foot.matrix=Matrix.LocRotScale(foot.head,foot_rotation,Vector((1,1,1)));bpy.context.view_layer.update()
raised={b.name:b.matrix_basis.copy() for b in bones}
for name in ('DEF-thigh.R','DEF-shin.R','DEF-foot.R'):held[name]=raised[name]
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
foot_meshes=[o for o in scene.objects if o.type=='MESH' and any(g.name.startswith(('DEF-foot','DEF-toe')) for g in o.vertex_groups)]
for f in range(END+1):
    scene.frame_set(f)
    restore(frames[f] if f<START else held if f<=START+ACTIVE else recover[f])
    if f<START or START+ACTIVE<f<START+ACTIVE+6:
        weight=smooth(f/START) if f<START else 1-smooth((f-START-ACTIVE)/6)
        for name in ('DEF-thigh.R','DEF-shin.R','DEF-foot.R'):
            a=bones[name].matrix_basis.copy();target=held[name]
            bones[name].matrix_basis=Matrix.LocRotScale(a.to_translation().lerp(target.to_translation(),weight),a.to_quaternion().slerp(target.to_quaternion(),weight),Vector((1,1,1)))
    yaw=0.
    if f>=START:
        age=min(ACTIVE,f-START);cycle=min(1,age//(ACTIVE//2));phase=age-cycle*(ACTIVE//2)
        yaw=2*math.pi*(cycle+turn_curve[phase])
        if f<=START+ACTIVE:
            strength=math.sin(math.pi*phase/(ACTIVE//2))**2
            for b in bones:
                if any(s in b.name for s in ('spine.','neck','head','upper_arm','forearm')):
                    reference=spin_poses[0][b.name].to_quaternion();sample=spin_poses[phase][b.name].to_quaternion()
                    delta=sample@reference.inverted()
                    b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion().slerp(delta,strength)@b.matrix_basis.to_quaternion()
    # Ease back into the existing guard instead of ending in the capture's
    # different stance and relying entirely on a runtime crossfade.
    if f>=END-9:
        blend=smooth((f-END+9)/9)
        for b in bones:
            a=b.matrix_basis.copy();target=grip[b.name]
            b.matrix_basis=Matrix.LocRotScale(a.to_translation().lerp(target.to_translation(),blend),a.to_quaternion().slerp(target.to_quaternion(),blend),Vector((1,1,1)))
    lift=smooth((f-4)/(START-4))*(1-smooth((f-START-ACTIVE)/11))
    if lift>0:
        original={b.name:b.matrix_basis.copy() for b in bones};tuck();folded={b.name:b.matrix_basis.copy() for b in bones}
        for name in ('DEF-thigh.L','DEF-shin.L','DEF-foot.L'):
            a=original[name];p=a.to_translation().lerp(folded[name].to_translation(),lift);q=a.to_quaternion().slerp(folded[name].to_quaternion(),lift)
            bones[name].matrix_basis=Matrix.LocRotScale(p,q,Vector((1,1,1)))
    bpy.context.view_layer.update()
    hips=bones['DEF-hips'];pivot=hips.head.copy()
    hips.matrix=Matrix.Translation(pivot)@Matrix.Rotation(yaw,4,'Z')@Matrix.Translation(-pivot)@hips.matrix
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get();ground=min((o.matrix_world@v.co).z for o in foot_meshes for v in o.evaluated_get(deps).data.vertices)
    m=hips.matrix.copy();m.translation.z+=.003+.24*lift-ground;hips.matrix=m;bpy.context.view_layer.update()
    for b in bones:
        b.rotation_mode='QUATERNION';b.keyframe_insert('rotation_quaternion',frame=f,group=b.name);b.keyframe_insert('location',frame=f,group=b.name)
if action.slots:arm.animation_data.action_slot=action.slots[0]
for layer in action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for curve in bag.fcurves:
                for key in curve.keyframe_points:key.interpolation='LINEAR'
scene.frame_start=0;scene.frame_end=END;scene.frame_set(START)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/leonardo-blue-flame.blend'))
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True)
for o in scene.objects:
    if o.type=='MESH':o.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(root/'public/motions/accad/leonardo-blue-flame.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_cameras=False,export_lights=False)
print('BLUE_FLAME_AUTHORED',len(bones),END/60,'kick elevation',math.degrees(kick_elevation),'extension',kick_extension,'turn curve',turn_curve,flush=True)
