"""Deterministic editable mesh pilot. Run with trusted Blender, never system Python.

blender --background --factory-startup --python tools/asset-pilot/build_meshes.py --
  --out asset-studies/mesh-pilot/runs/<new-run> --palette src/app/palette.css
  [--candidate electrical-termination-A]
"""

import argparse
import hashlib
import json
import math
import re
import shutil
import sys
from pathlib import Path

import bpy
from mathutils import Vector

VERSION = "mesh-pilot-v4"
PALETTE = {}
MATERIALS = {}
OBJECTS = []
SOCKETS = []
JOINTS = []
GROUP = "base"


def srgb_linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def reset(palette):
    global PALETTE, MATERIALS, OBJECTS, SOCKETS, JOINTS, GROUP
    bpy.ops.wm.read_factory_settings(use_empty=True)
    PALETTE = palette
    MATERIALS = {}
    OBJECTS, SOCKETS, JOINTS = [], [], []
    GROUP = "base"
    for token in ["steel", "surface", "ink", "edge", "concrete", "concrete-light", "concrete-shadow", "power", "production"]:
        mat = bpy.data.materials.new(token)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        rgb = tuple(srgb_linear(c) for c in palette[token])
        bsdf.inputs["Base Color"].default_value = (*rgb, 1)
        bsdf.inputs["Metallic"].default_value = 0 if token.startswith("concrete") else 0.62
        bsdf.inputs["Roughness"].default_value = 0.30 if token == "concrete-light" else 0.38
        mat.diffuse_color = (*rgb, 1)
        MATERIALS[token] = mat


def register(obj, name, role, material, bevel=0):
    obj.name = name
    obj["asset_role"] = role
    obj["palette_token"] = material
    obj["module_group"] = GROUP
    obj.data.materials.append(MATERIALS[material])
    if bevel:
        mod = obj.modifiers.new("Fabrication edge radius", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.use_clamp_overlap = True
        mod.harden_normals = True
    OBJECTS.append(obj)
    return obj


def box(name, lo, size, material="steel", role="enclosure", bevel=0.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=tuple(a+b/2 for a,b in zip(lo,size)))
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return register(obj, name, role, material, bevel)


def cylinder(name, start, end, radius, material="steel", role="fitting", vertices=24, bevel=0.008):
    start, end = Vector(start), Vector(end)
    direction = end-start
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=(start+end)/2)
    obj = bpy.context.object
    obj.rotation_euler = direction.to_track_quat('Z','Y').to_euler()
    for poly in obj.data.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    return register(obj,name,role,material,bevel)


def beam(name, start, end, width=0.08, depth=None, material="steel", role="brace"):
    start,end=Vector(start),Vector(end)
    bpy.ops.mesh.primitive_cube_add(size=1,location=(start+end)/2)
    obj=bpy.context.object
    obj.dimensions=(width,depth or width,(end-start).length)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
    return register(obj,name,role,material,min(width*.12,.012))


def mesh(name, positions, faces, material, role, bevel=0.01):
    data=bpy.data.meshes.new(name)
    data.from_pydata(positions,[],faces)
    data.update()
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    return register(obj,name,role,material,bevel)


def lathe(name, center, profile, material, role="ceramic-insulator", axis="Z", segments=32):
    # Profile z/radius pairs; closed end caps are actual geometry.
    vertices=[]
    for height,radius in profile:
        for i in range(segments):
            angle=i*2*math.pi/segments
            x,y=radius*math.cos(angle),radius*math.sin(angle)
            local=(x,y,height) if axis=="Z" else (x,height,y)
            vertices.append(tuple(center[j]+local[j] for j in range(3)))
    faces=[]
    faces.append(tuple(reversed(range(segments))))
    for k in range(len(profile)-1):
        for i in range(segments):
            j=(i+1)%segments
            faces.append((k*segments+i,k*segments+j,(k+1)*segments+j,(k+1)*segments+i))
    faces.append(tuple((len(profile)-1)*segments+i for i in range(segments)))
    if axis=="Y":faces=[tuple(reversed(f)) for f in faces]
    obj=mesh(name,vertices,faces,material,role,0)
    for p in obj.data.polygons:
        p.use_smooth=len(p.vertices)==4
    return obj


def bolts(prefix, xs, ys, z, radius=.025):
    for i,x in enumerate(xs):
        for j,y in enumerate(ys):
            cylinder(f"{prefix}-{i}-{j}",(x,y,z),(x,y,z+.022),radius,"concrete-shadow","fastener",6,.002)


def socket(name, service, point, normal):
    SOCKETS.append({"id":name,"service":service,"point":list(point),"normal":list(normal)})


def joint(a,b,point,kind="bolted-contact"):
    JOINTS.append({"a":a.name,"b":b.name,"kind":kind,"point":list(point)})


def electrical_base():
    for i,x in enumerate([.17,1.43]):
        for j,y in enumerate([.18,1.12]):
            box(f"foot-{i}-{j}",(x-.11,y-.10,0),(.22,.20,.055),"concrete-shadow","mounting-foot",.009)
            bolts(f"anchor-{i}-{j}",[x-.06,x+.06],[y],.055,.018)
    a=box("skid-front",(.10,.97,.055),(1.40,.12,.11),"steel","base-rail")
    b=box("skid-back",(.10,.21,.055),(1.40,.12,.11),"steel","base-rail")
    for i,x in enumerate([.17,1.32]):
        box(f"skid-cross-{i}",(x,.25,.075),(.11,.78,.09),"surface","base-crossmember")
    return a,b


def electrical_a():
    front,back=electrical_base()
    cabinet=box("switchgear-case",(.29,.32,.165),(1.02,.40,.40),"surface","switchgear-enclosure",.025)
    door=box("service-door",(.33,.716,.205),(.94,.025,.31),"steel","service-panel",.008)
    box("door-gasket",(.355,.743,.23),(.89,.008,.25),"ink","panel-gasket",.002)
    box("service-cover",(.37,.752,.24),(.86,.012,.23),"steel","service-panel",.005)
    for i,x in enumerate([.39,1.18]):
        box(f"door-hinge-{i}",(x,.75,.27),(.035,.035,.13),"concrete-shadow","hinge",.004)
    box("identification-plate",(.68,.768,.39),(.22,.008,.035),"power","equipment-marker",.002)
    legs=[]
    for i,x in enumerate([.20,1.40]):
        leg=box(f"rack-post-{i}",(x-.055,.97,.165),(.11,.12,.525),"steel","structural-post",.012)
        legs.append(leg)
        joint(front,leg,(x,1.03,.165))
        beam(f"rack-brace-{i}",(x,.31,.18),(x,1.03,.64),.065,.065,"concrete-shadow")
    cross=box("termination-beam",(.145,.93,.69),(1.31,.20,.09),"steel","termination-crossbeam",.012)
    for leg in legs:
        joint(leg,cross,(leg.location.x,1.03,.69))
    profile=[(0,.057),(.035,.057),(.055,.103),(.078,.103),(.096,.055),(.12,.095),(.143,.095),(.161,.052),(.184,.088),(.207,.088),(.228,.049),(.27,.049)]
    for i,x in enumerate([.39,.80,1.21]):
        flange=cylinder(f"terminal-flange-{i}",(x,1.03,.78),(x,1.03,.803),.108,"concrete-shadow","mounting-flange",24,.004)
        ins=lathe(f"phase-insulator-{i}",(x,1.03,.803),profile,"concrete-light")
        joint(cross,flange,(x,1.03,.78))
        joint(flange,ins,(x,1.03,.803))
        stud=cylinder(f"terminal-stud-{i}",(x,1.03,1.073),(x,1.03,1.155),.028,"power","electrical-terminal",16,.004)
        joint(ins,stud,(x,1.03,1.073))
        lug=box(f"cable-lug-{i}",(x-.065,1.00,1.155),(.13,.06,.035),"power","cable-termination",.007)
        joint(stud,lug,(x,1.03,1.155))
        socket(f"power-{i+1}","power",(x,1.03,1.19),(0,0,1))
        bolts(f"flange-bolt-{i}",[x-.075,x+.075],[1.03],.803,.014)
        # Cable entries are actual closed elbows from the cabinet to the rack.
        beam(f"terminal-feed-vertical-{i}",(x,.63,.565),(x,.63,.75),.033,.033,"power","insulated-feed")
        beam(f"terminal-feed-horizontal-{i}",(x,.63,.75),(x,.93,.75),.033,.033,"power","insulated-feed")
    for i,x in enumerate([.43,.58,.73,.88,1.03,1.18]):
        box(f"cabinet-cooling-slot-{i}",(x,.319,.25),(.065,.012,.18),"ink","cooling-slot",.003)
    joint(cabinet,door,(.80,.72,.36),"panel-fastening")


def electrical_b():
    front,back=electrical_base()
    cabinet=box("integrated-terminal-case",(.20,.31,.165),(1.20,.66,.47),"surface","switchgear-enclosure",.025)
    face=box("terminal-panel",(.23,.91,.635),(1.14,.095,.45),"steel","feedthrough-panel",.015)
    joint(cabinet,face,(.80,.955,.635))
    box("rain-cap",(.17,.29,1.085),(1.26,.76,.075),"concrete-shadow","weather-cap",.015)
    for i,x in enumerate([.24,1.32]):
        box(f"panel-frame-{i}",(x,.83,.165),(.075,.10,.92),"steel","structural-post",.01)
    profile=[(0,.068),(.025,.068),(.045,.106),(.067,.106),(.084,.058),(.104,.099),(.128,.099),(.145,.054),(.166,.090),(.19,.090),(.215,.050),(.245,.050)]
    for i,x in enumerate([.43,.80,1.17]):
        flange=cylinder(f"feedthrough-flange-{i}",(x,1.005,.87),(x,1.027,.87),.115,"concrete-shadow","mounting-flange",24,.004)
        ins=lathe(f"horizontal-insulator-{i}",(x,1.027,.87),profile,"concrete-light",axis="Y")
        joint(face,flange,(x,1.005,.87))
        joint(flange,ins,(x,1.027,.87))
        stud=cylinder(f"horizontal-terminal-stud-{i}",(x,1.272,.87),(x,1.325,.87),.031,"power","electrical-terminal",16,.004)
        joint(ins,stud,(x,1.272,.87))
        lug=box(f"horizontal-lug-{i}",(x-.060,1.325,.84),(.12,.035,.06),"power","cable-termination",.005)
        joint(stud,lug,(x,1.325,.87))
        socket(f"power-{i+1}","power",(x,1.36,.87),(0,1,0))
    box("front-service-door",(.29,.966,.23),(1.02,.018,.32),"steel","service-panel",.008)
    box("service-door-marker",(.68,.985,.43),(.24,.012,.035),"power","equipment-marker",.002)
    for i,x in enumerate([.32,1.24]):
        box(f"service-hinge-{i}",(x,.985,.30),(.035,.025,.15),"concrete-shadow","hinge",.003)
    for i in range(7):
        box(f"side-vent-{i}",(1.403,.39+i*.065,.29),(.012,.037,.21),"ink","cooling-slot",.003)


def face_bolts(prefix, xs, y, zs, radius=.026):
    for i,x in enumerate(xs):
        for j,z in enumerate(zs):
            cylinder(f"{prefix}-{i}-{j}",(x,y,z),(x,y+.026,z),radius,"concrete-shadow","fastener",6,.002)


def rounded_path(points, radius=.25, steps=6):
    points=[Vector(p) for p in points]
    result=[points[0]]
    for i in range(1,len(points)-1):
        a,b,c=points[i-1:i+2]
        cut=min(radius,(b-a).length*.35,(c-b).length*.35)
        start=b-(b-a).normalized()*cut
        end=b+(c-b).normalized()*cut
        result.append(start)
        for step in range(1,steps+1):
            t=step/steps
            result.append((1-t)**2*start+2*(1-t)*t*b+t*t*end)
    result.append(points[-1])
    return result


def tube_path(name, points, radius=.18, wall=.026, material="steel"):
    path=rounded_path(points)
    vertices=[]
    sides=24
    for i,point in enumerate(path):
        tangent=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized()
        # A circular section is indifferent to rotation about its tangent.
        rotation=tangent.to_track_quat('Z','Y')
        for r in [radius,radius-wall]:
            for j in range(sides):
                v=rotation@Vector((r*math.cos(j*2*math.pi/sides),r*math.sin(j*2*math.pi/sides),0))
                vertices.append(tuple(point+v))
    faces=[]
    stride=2*sides
    for k in range(len(path)-1):
        for j in range(sides):
            n=(j+1)%sides
            faces.append((k*stride+j,k*stride+n,(k+1)*stride+n,(k+1)*stride+j))
            faces.append((k*stride+sides+n,k*stride+sides+j,(k+1)*stride+sides+j,(k+1)*stride+sides+n))
    for k in [0,len(path)-1]:
        for j in range(sides):
            n=(j+1)%sides
            face=(k*stride+j,k*stride+sides+j,k*stride+sides+n,k*stride+n)
            faces.append(tuple(reversed(face)) if k==len(path)-1 else face)
    obj=mesh(name,vertices,faces,material,"closed-wall-process-duct",0)
    for p in obj.data.polygons:p.use_smooth=True
    return obj


def flange(name, point, axis, radius=.25, wall=.065):
    # An annular flange is open through its centre, not a disc blocking airflow.
    direction=Vector(axis).normalized()
    center=Vector(point)
    rotation=direction.to_track_quat('Z','Y')
    vertices=[]
    sides=24
    for z,r in [(-.035,radius),(.035,radius),(-.035,radius-wall),(.035,radius-wall)]:
        for i in range(sides):
            angle=i*2*math.pi/sides
            vertices.append(tuple(center+rotation@Vector((r*math.cos(angle),r*math.sin(angle),z))))
    faces=[]
    for i in range(sides):
        j=(i+1)%sides
        faces.extend([(i,j,sides+j,sides+i),(2*sides+j,2*sides+i,3*sides+i,3*sides+j),(i,2*sides+i,2*sides+j,j),(sides+i,sides+j,3*sides+j,3*sides+i)])
    obj=mesh(name,vertices,faces,"concrete-shadow","duct-flange",.004)
    for i in range(8):
        angle=(i+.5)*2*math.pi/8
        at=center+rotation@Vector(((radius-.025)*math.cos(angle),(radius-.025)*math.sin(angle),.035))
        cylinder(f"{name}-bolt-{i}",at,at+direction*.025,.018,"steel","fastener",6,.002)
    return obj


def furnace_shell(prefix, x, y, width=2.2, depth=1.85, height=2.55):
    z=.18
    base=box(f"{prefix}-skid",(x-.12,y-.10,0),(width+.24,depth+.20,.18),"surface","equipment-skid",.025)
    left=box(f"{prefix}-left-wall",(x,y,z),(.17,depth,height),"steel","furnace-enclosure",.025)
    right=box(f"{prefix}-right-wall",(x+width-.17,y,z),(.17,depth,height),"steel","furnace-enclosure",.025)
    box(f"{prefix}-back-wall",(x+.17,y,z),(width-.34,.17,height),"surface","furnace-enclosure",.02)
    box(f"{prefix}-floor",(x+.17,y+.17,z),(width-.34,depth-.34,.17),"surface","furnace-floor",.015)
    lid=box(f"{prefix}-roof",(x,y,z+height-.16),(width,depth,.16),"steel","hood-mounting-roof",.02)
    front=y+depth
    opening_low=z+.42
    opening_high=z+1.10
    for i,lo,sz in [
        (0,(x,front-.16,z),(width,.16,.42)),
        (1,(x,front-.16,opening_high),(width,.16,height-1.10)),
        (2,(x,front-.16,opening_low),(.36,.16,.68)),
        (3,(x+width-.36,front-.16,opening_low),(.36,.16,.68)),
    ]:box(f"{prefix}-front-casing-{i}",lo,sz,"surface","furnace-enclosure",.02)
    mouth_width=width-.72
    for i,lo,sz in [
        (0,(x+.34,front-.28,opening_low-.045),(mouth_width+.04,.26,.095)),
        (1,(x+.34,front-.28,opening_high-.045),(mouth_width+.04,.26,.095)),
        (2,(x+.34,front-.28,opening_low),(.085,.26,.68)),
        (3,(x+width-.425,front-.28,opening_low),(.085,.26,.68)),
    ]:box(f"{prefix}-refractory-jamb-{i}",lo,sz,"concrete-light","refractory-lining",.012)
    # Recessed glowing chamber; walls and throat are real open-front geometry.
    heat=box(f"{prefix}-heat-chamber",(x+.44,front-.43,opening_low+.10),(width-.88,.05,.46),"production","hot-process-interior",.012)
    bsdf=MATERIALS['production'].node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Emission Color'].default_value=(*[srgb_linear(v) for v in PALETTE['production']],1)
    bsdf.inputs['Emission Strength'].default_value=1.5
    cover=box(f"{prefix}-upper-service-door",(x+.26,front+.004,z+1.35),(width-.52,.055,height-1.61),"steel","service-panel",.015)
    face_bolts(f"{prefix}-door-bolt",[x+.34,x+width-.34],front+.06,[z+1.45,z+height-.35])
    for side_x in [x+.04,x+width-.14]:
        box(f"{prefix}-front-rail-{side_x:.2f}",(side_x,front+.01,z+.12),(.10,.10,height-.24),"concrete-shadow","casing-rail",.012)
    for i in range(7):
        box(f"{prefix}-cooling-louver-{i}",(x+width+.008,y+.30,z+.48+i*.24),(.05,depth-.60,.055),"concrete-shadow","cooling-louver",.008)
    for i,yy in enumerate([y+.20,y+depth-.20]):
        box(f"{prefix}-side-grille-frame-{i}",(x+width+.01,yy,z+.38),(.07,.08,height-.65),"steel","grille-frame",.008)
    bolts(f"{prefix}-base-anchor",[x-.055,x+width+.055],[y+.14,y+depth-.14],.18,.034)
    joint(base,left,(x+.085,y+depth*.5,.18))
    joint(base,right,(x+width-.085,y+depth*.5,.18))
    joint(right,lid,(x+width-.085,y+depth*.5,z+height-.16))
    socket("power-entry","power",(x+.20,front+.11,z+.42),(0,1,0))
    # A physically modeled terminal cover carries the electrical socket.
    box(f"{prefix}-power-terminal",(x+.10,front+.02,z+.29),(.20,.09,.26),"surface","power-terminal",.012)
    return base,lid,heat


def hood(prefix, lo, size):
    x,y,z=lo;w,d,h=size
    pts=[(x,y,z),(x+w,y,z),(x+w,y+d,z),(x,y+d,z),
         (x+w*.20,y+d*.18,z+h),(x+w*.80,y+d*.18,z+h),(x+w*.80,y+d*.82,z+h),(x+w*.20,y+d*.82,z+h)]
    faces=[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]
    if h<0:faces=[tuple(reversed(f)) for f in faces]
    obj=mesh(prefix,pts,faces,"steel","capture-hood",.018)
    for i,(a,b) in enumerate([(pts[0],pts[4]),(pts[1],pts[5]),(pts[2],pts[6]),(pts[3],pts[7])]):
        beam(f"{prefix}-fold-seam-{i}",a,b,.035,.035,"concrete-shadow","folded-sheet-seam")
    return obj


def duct_support(prefix, x,y,top):
    foot=box(f"{prefix}-foot",(x-.22,y-.20,0),(.44,.40,.12),"concrete-shadow","mounting-foot",.015)
    post=box(f"{prefix}-post",(x-.075,y-.075,.12),(.15,.15,top-.22),"steel","duct-support-post",.012)
    cap=box(f"{prefix}-saddle",(x-.28,y-.18,top-.10),(.56,.36,.10),"steel","duct-support-saddle",.012)
    bolts(f"{prefix}-anchor",[x-.14,x+.14],[y-.12,y+.12],.12,.025)
    joint(foot,post,(x,y,.12))
    joint(post,cap,(x,y,top-.10))
    return cap


def furnace_a():
    base,lid,heat=furnace_shell("furnace",.25,3.65,2.20,1.85,2.55)
    capture=hood("capture-hood",(.25,3.65,2.73),(2.20,1.85,.55))
    joint(lid,capture,(1.35,4.5,2.73))
    # A closed, cleanable circular separator with a conical hopper and top discharge.
    cx,cy=3.65,1.40
    ring=cylinder("separator-base-ring",(cx,cy,.98),(cx,cy,1.10),.75,"concrete-shadow","vessel-support-ring",32,.01)
    for i,(dx,dy) in enumerate([(-.53,-.53),(.53,-.53),(-.53,.53),(.53,.53)]):
        box(f"vessel-foot-{i}",(cx+dx-.13,cy+dy-.13,0),(.26,.26,.10),"concrete-shadow","mounting-foot",.012)
        post=box(f"vessel-leg-{i}",(cx+dx-.06,cy+dy-.06,.10),(.12,.12,.88),"steel","vessel-support-leg",.012)
        joint(post,ring,(cx+dx,cy+dy,.98))
    body=lathe("separator-shell",(cx,cy,0),[(.44,.26),(.50,.30),(1.10,.70),(2.65,.70),(2.78,.68),(3.25,.28),(5.70,.22)],"steel","separation-vessel")
    joint(ring,body,(cx+.70,cy,1.10),"vessel-support")
    for i,zz in enumerate([1.10,2.65,3.25,4.35,5.67]):
        radius=.74 if zz<3 else .32 if zz<4 else .26
        flange(f"vessel-collar-{i}",(cx,cy,zz),(0,0,1),radius,.065)
    hatch=cylinder("vessel-cleanout-cover",(cx,cy+.69,1.78),(cx,cy+.76,1.78),.24,"concrete-shadow","cleanout-cover",24,.008)
    for i in range(8):
        angle=i*math.pi/4
        cylinder(f"cleanout-bolt-{i}",(cx+math.cos(angle)*.18,cy+.76,1.78+math.sin(angle)*.18),(cx+math.cos(angle)*.18,cy+.79,1.78+math.sin(angle)*.18),.02,"steel","fastener",6,.002)
    joint(body,hatch,(cx,cy+.70,1.78),"cleanout-fastening")
    discharge=tube_path("discharge-liner",[(cx,cy,5.65),(cx,cy,5.95)],.20,.027)
    joint(body,discharge,(cx,cy,5.68),"flanged-discharge")
    socket("exhaust-discharge","exhaust",(cx,cy,5.95),(0,0,1))
    # The duct is high enough to clear the furnace maintenance panels.
    start=(1.35,4.58,3.28)
    end=(cx,cy+.70,2.25)
    duct=tube_path("capture-to-separator-duct",[start,(1.35,4.58,3.65),(cx,4.58,3.65),(cx,2.38,3.65),(cx,2.38,2.25),end])
    flange("hood-duct-flange",start,(0,0,1),.26,.07)
    flange("separator-inlet-flange",end,(0,1,0),.26,.07)
    joint(capture,duct,start,"flanged-capture-outlet")
    joint(duct,body,end,"flanged-treatment-inlet")
    saddle=duct_support("capture-duct-stand",2.85,4.58,3.47)
    joint(saddle,duct,(2.85,4.58,3.47),"duct-saddle-contact")
    # A compact enclosed drive, attached to the separator neck, represents its air mover.
    motor=cylinder("extraction-drive-motor",(cx+.24,cy,3.28),(cx+.84,cy,3.28),.18,"surface","enclosed-extraction-drive",24,.01)
    for i in range(6):
        cylinder(f"drive-fin-{i}",(cx+.30+i*.075,cy,3.28),(cx+.325+i*.075,cy,3.28),.20,"steel","motor-cooling-fin",24,.003)
    joint(body,motor,(cx+.28,cy,3.28),"drive-coupling")
    # Handrail/ladder bolts are attached to the shell rather than floating above it.
    for i,xx in enumerate([cx-.19,cx+.19]):
        beam(f"flue-access-rail-{i}",(xx,cy+.29,3.32),(xx,cy+.24,5.56),.035,.035,"concrete-shadow","maintenance-ladder")
    for i in range(10):
        zz=3.40+i*.21
        yy=cy+.29-(zz-3.32)/2.24*.05
        beam(f"flue-access-rung-{i}",(cx-.19,yy,zz),(cx+.19,yy,zz),.025,.025,"steel","maintenance-ladder")


def furnace_b():
    base,lid,heat=furnace_shell("furnace",.20,3.70,2.45,1.85,2.10)
    capture=hood("wide-slot-capture-hood",(.20,3.70,2.28),(2.45,1.85,.42))
    joint(lid,capture,(1.42,4.5,2.28))
    # An alternate flat-panel cartridge collector replaces the cylindrical tower.
    skid=box("filter-skid",(3.10,.50,0),(1.75,2.65,.17),"surface","collector-skid",.025)
    cabinet=box("cartridge-filter-case",(3.25,.65,.62),(1.40,1.50,2.50),"steel","cartridge-filter-enclosure",.035)
    hopper=hood("filter-hopper",(3.25,.65,.62),(1.40,1.50,-.30))
    for i,x in enumerate([3.30,4.50]):
        post=box(f"filter-leg-{i}",(x,.76,.17),(.12,1.24,.45),"steel","collector-support-leg",.015)
        joint(skid,post,(x+.06,1.30,.17))
        joint(post,cabinet,(x+.06,1.30,.62))
    for i,x in enumerate([3.40,3.98]):
        panel=box(f"filter-service-panel-{i}",(x,2.15,.88),(.50,.055,1.80),"surface","cartridge-cleanout-panel",.015)
        face_bolts(f"filter-panel-bolt-{i}",[x+.08,x+.42],2.205,[1.02,2.50],.025)
        box(f"filter-panel-handle-{i}",(x+.21,2.21,1.72),(.08,.05,.22),"concrete-shadow","panel-handle",.008)
        joint(cabinet,panel,(x+.25,2.15,1.80),"cleanout-fastening")
    box("filter-top-cap",(3.19,.59,3.12),(1.52,1.62,.11),"concrete-shadow","weather-cap",.02)
    inlet=(3.25,1.30,2.55)
    start=(1.42,4.61,2.70)
    duct=tube_path("hood-to-cartridge-duct",[start,(1.42,4.61,3.25),(2.88,4.61,3.25),(2.88,1.30,3.25),(2.88,1.30,2.55),inlet])
    flange("wide-hood-flange",start,(0,0,1),.26,.07)
    flange("filter-inlet-flange",inlet,(1,0,0),.26,.07)
    joint(capture,duct,start,"flanged-capture-outlet")
    joint(duct,cabinet,inlet,"flanged-filter-inlet")
    saddle=duct_support("cartridge-duct-stand",2.88,3.05,3.07)
    joint(saddle,duct,(2.88,3.05,3.07),"duct-saddle-contact")
    # The cleaned side has a visible fan, downstream of the filter and upstream of the flue.
    fan=cylinder("clean-side-fan-volute",(3.56,2.65,1.15),(4.02,2.65,1.15),.46,"steel","clean-side-extraction-fan",32,.025)
    fanbase=box("fan-mounting-feet",(3.50,2.27,.17),(.60,.78,.52),"surface","fan-support",.015)
    joint(skid,fanbase,(3.80,2.65,.17))
    joint(fanbase,fan,(3.80,2.65,.69),"fan-casing-support")
    motor=cylinder("fan-drive-motor",(4.02,2.65,1.15),(4.55,2.65,1.15),.23,"surface","drive-motor",24,.015)
    joint(fan,motor,(4.02,2.65,1.15),"drive-coupling")
    for i in range(6):
        cylinder(f"fan-motor-fin-{i}",(4.08+i*.07,2.65,1.15),(4.10+i*.07,2.65,1.15),.255,"concrete-shadow","motor-cooling-fin",24,.003)
    clean_duct=tube_path("filter-to-fan-clean-duct",[(3.25,1.90,1.15),(3.0,1.90,1.15),(3.0,2.65,1.15),(3.56,2.65,1.15)],.17,.026)
    joint(cabinet,clean_duct,(3.25,1.90,1.15),"clean-side-outlet")
    joint(clean_duct,fan,(3.56,2.65,1.15),"fan-inlet")
    flue=tube_path("fan-discharge-flue",[(3.76,2.65,1.61),(3.76,2.65,1.98),(4.65,2.65,1.98),(4.65,2.65,5.0)],.18,.026)
    joint(fan,flue,(3.76,2.65,1.61),"fan-discharge")
    for i,zz in enumerate([2.05,3.30,4.94]):
        flange(f"flue-joint-{i}",(4.65,2.65,zz),(0,0,1),.23,.05)
    beam("flue-lateral-brace",(4.65,2.65,3.05),(4.60,2.14,3.05),.055,.055,"steel","flue-brace")
    socket("exhaust-discharge","exhaust",(4.65,2.65,5.0),(0,0,1))


def normalize_origin():
    bpy.context.view_layer.update()
    points=[obj.matrix_world@Vector(corner) for obj in OBJECTS for corner in obj.bound_box]
    offset=Vector(tuple(min(point[i] for point in points) for i in range(3)))
    for obj in OBJECTS:obj.location-=offset
    for record in SOCKETS:record['point']=[record['point'][i]-offset[i] for i in range(3)]
    for record in JOINTS:record['point']=[record['point'][i]-offset[i] for i in range(3)]
    bpy.context.view_layer.update()


def bore(obj, center, radius, depth):
    # Keep final bevel editable while applying a real opening to the source mesh.
    bevel_settings=[]
    for mod in list(obj.modifiers):
        if mod.type=='BEVEL':
            bevel_settings.append((mod.width,mod.segments))
            obj.modifiers.remove(mod)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=radius,depth=depth,location=center)
    cutter=bpy.context.object
    cutter.name='temporary-bore-cutter'
    mod=obj.modifiers.new('Physical insulated feedthrough bore','BOOLEAN')
    mod.operation='DIFFERENCE'
    mod.solver='EXACT'
    mod.object=cutter
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    for width,segments in bevel_settings:
        bevel=obj.modifiers.new('Fabrication edge radius','BEVEL')
        bevel.width=width
        bevel.segments=segments
        bevel.use_clamp_overlap=True
        bevel.harden_normals=True


def electrical_a_r1():
    electrical_a()
    # Replace feeds that previously stopped at the common metal beam. Each
    # phase now has a separate continuous core and a true dielectric passage.
    for obj in list(OBJECTS):
        if obj.name.startswith('terminal-feed-'):
            OBJECTS.remove(obj)
            bpy.data.objects.remove(obj,do_unlink=True)
    cross=bpy.data.objects['termination-beam']
    cabinet=bpy.data.objects['switchgear-case']
    for i,x in enumerate([.39,.80,1.21]):
        flange_obj=bpy.data.objects[f'terminal-flange-{i}']
        ceramic=bpy.data.objects[f'phase-insulator-{i}']
        stud=bpy.data.objects[f'terminal-stud-{i}']
        bore(cross,(x,1.03,.735),.060,.25)
        bore(flange_obj,(x,1.03,.79),.050,.10)
        bore(ceramic,(x,1.03,.94),.023,.34)
        bore(cabinet,(x,.63,.56),.050,.12)
        sleeve=tube_path(f'phase-dielectric-bushing-{i}',[(x,1.03,.61),(x,1.03,.84)],.043,.021,'concrete-light')
        sleeve['asset_role']='dielectric-sleeve'
        core=cylinder(f'phase-live-core-{i}',(x,1.03,.61),(x,1.03,1.073),.013,'power','live-conductor',20,.001)
        feed=cylinder(f'phase-live-feed-{i}',(x,1.03,.61),(x,.63,.61),.013,'power','live-conductor',20,.001)
        entry=cylinder(f'phase-live-cabinet-entry-{i}',(x,.63,.52),(x,.63,.61),.013,'power','live-conductor',20,.001)
        sheath=tube_path(f'phase-protected-cabinet-feed-{i}',[(x,1.03,.61),(x,.63,.61),(x,.63,.52)],.035,.013,'concrete-light')
        sheath['asset_role']='dielectric-feed-sheath'
        gland=flange(f'phase-cabinet-entry-gland-{i}',(x,.63,.585),(0,0,1),.075,.025)
        joint(stud,core,(x,1.03,1.073),'separate-live-phase')
        joint(core,feed,(x,1.03,.61),'separate-live-phase')
        joint(feed,entry,(x,.63,.61),'separate-live-phase')
        joint(sleeve,sheath,(x,1.03,.61),'dielectric-feed-continuity')
        joint(gland,cabinet,(x+.06,.63,.565),'sealed-feedthrough-mount')
    cover=bpy.data.objects['service-cover']
    conduit=tube_path('protected-deck-feeder',[(.52,.770,.34),(.52,1.20,.34),(.52,1.20,0)],.045,.012,'surface')
    panel_gland=flange('enclosure-exit-gland',(.52,.770,.34),(0,1,0),.090,.035)
    deck_gland=flange('deck-entry-gland',(.52,1.20,.035),(0,0,1),.095,.040)
    joint(cover,panel_gland,(.52,.770,.34),'sealed-enclosure-gland')
    joint(panel_gland,conduit,(.52,.770,.34),'protected-feeder')
    joint(conduit,deck_gland,(.52,1.20,.035),'sealed-deck-entry')
    socket('protected-deck-entry','power',(.52,1.20,0),(0,0,-1))
    for i,x in enumerate([.17,1.43]):
        for j,y in enumerate([.18,1.12]):
            foot=bpy.data.objects[f'foot-{i}-{j}']
            rail=bpy.data.objects['skid-back' if j==0 else 'skid-front']
            socket(f'roof-bearing-{i}-{j}','mount',(x,y,0),(0,0,-1))
            joint(foot,rail,(x,.25 if j==0 else 1.03,.055),'roof-foot-to-skid')
    normalize_origin()


def furnace_a_r1():
    global GROUP
    GROUP='furnace'
    base,lid,heat=furnace_shell('furnace',.13,4.50,2.50,2.20,2.80)
    capture=hood('capture-hood',(.13,4.50,2.98),(2.50,2.20,.52))
    joint(lid,capture,(1.38,5.60,2.98),'capture-hood-mount')
    GROUP='scrubber'
    cx,cy=1.40,1.25
    # Four individual bearing plates and welded skid members, not a whole-plot slab.
    feet=[]
    for i,x in enumerate([0,2.40]):
        for j,y in enumerate([0,2.20]):
            feet.append(box(f'separator-bearing-{i}-{j}',(x,y,0),(.40,.30,.10),'concrete-shadow','mounting-foot',.012))
            bolts(f'separator-anchor-{i}-{j}',[x+.10,x+.30],[y+.15],.10,.030)
    rear=box('separator-skid-rear',(.20,.12,.10),(2.40,.16,.12),'steel','base-crossmember',.015)
    front=box('separator-skid-front',(.20,2.20,.10),(2.40,.16,.12),'steel','base-crossmember',.015)
    rails=[]
    for i,x in enumerate([.50,2.06]):
        rail=box(f'separator-skid-rail-{i}',(x,.18,.22),(.24,2.10,.12),'steel','base-rail',.014)
        rails.append(rail)
        joint(rear,rail,(x+.12,.22,.22),'skid-weld')
        joint(front,rail,(x+.12,2.25,.22),'skid-weld')
    ring=cylinder('separator-support-ring',(cx,cy,1.20),(cx,cy,1.34),1.05,'concrete-shadow','vessel-support-ring',40,.012)
    for i,x in enumerate([.62,2.18]):
        for j,y in enumerate([.50,2.00]):
            leg=box(f'separator-leg-{i}-{j}',(x-.06,y-.06,.34),(.12,.12,.86),'steel','vessel-support-leg',.010)
            joint(rails[i],leg,(x,y,.34),'leg-to-skid')
            joint(leg,ring,(x,y,1.20),'vessel-ring-support')
    vessel=lathe('separator-shell',(cx,cy,0),[(.46,.30),(.54,.32),(1.34,.95),(3.65,.95),(4.25,.45),(10.35,.40)],'steel','separation-vessel',segments=40)
    joint(ring,vessel,(cx+.95,cy,1.34),'vessel-to-support-ring')
    for i,(zz,radius) in enumerate([(1.34,1.00),(3.65,1.00),(4.25,.50),(6.55,.45),(8.65,.45),(10.35,.45)]):
        flange(f'separator-shell-flange-{i}',(cx,cy,zz),(0,0,1),radius,.065)
    cover=cylinder('separator-front-cleanout',(cx,cy+.94,2.0),(cx,cy+1.01,2.0),.27,'concrete-shadow','cleanout-cover',32,.010)
    joint(vessel,cover,(cx,cy+.95,2.0),'cleanout-fastening')
    for i in range(8):
        a=i*math.pi/4
        cylinder(f'cleanout-fastener-{i}',(cx+math.cos(a)*.21,cy+1.01,2+math.sin(a)*.21),(cx+math.cos(a)*.21,cy+1.04,2+math.sin(a)*.21),.026,'steel','fastener',6,.003)
    top=tube_path('open-discharge-liner',[(cx,cy,10.30),(cx,cy,10.50)],.40,.035)
    joint(vessel,top,(cx+.40,cy,10.35),'lined-flue-discharge')
    # The socket is on the actual annular lip, with the opening centre explicit.
    socket('exhaust-discharge','exhaust',(cx+.382,cy,10.50),(0,0,1))
    SOCKETS[-1]['openingCenter']=[cx,cy,10.50]
    motor=cylinder('extraction-drive-motor',(cx-.65,cy,4.0),(cx-1.15,cy,4.0),.22,'surface','enclosed-extraction-drive',28,.014)
    joint(vessel,motor,(cx-.65,cy,4.0),'drive-coupling')
    for i in range(6):
        cylinder(f'extraction-drive-fin-{i}',(cx-.70-i*.065,cy,4.0),(cx-.723-i*.065,cy,4.0),.245,'steel','motor-cooling-fin',28,.004)
    # Ground-service cleanout replaces the inaccessible decorative upper ladder.
    drain=cylinder('ground-service-cleanout',(cx,cy,.40),(cx,cy,.46),.31,'concrete-shadow','ground-service-cleanout',32,.008)
    joint(vessel,drain,(cx,cy,.46),'ground-service-cleanout')
    GROUP='duct'
    start=(1.38,5.60,3.50)
    inlet=(cx,cy+.95,3.15)
    duct=tube_path('capture-to-separator-duct',[start,(1.38,5.60,3.95),(1.38,2.52,3.95),(1.38,2.52,3.15),inlet],.18,.026)
    flange('hood-exhaust-flange',start,(0,0,1),.26,.07)
    flange('separator-intake-flange',inlet,(0,1,0),.26,.07)
    joint(capture,duct,start,'flanged-capture-outlet')
    joint(duct,vessel,inlet,'flanged-treatment-inlet')
    saddle=duct_support('process-duct-stand',1.38,3.55,3.77)
    joint(saddle,duct,(1.38,3.55,3.77),'duct-saddle-contact')
    normalize_origin()


def set_camera_and_lights():
    depsgraph=bpy.context.evaluated_depsgraph_get()
    points=[]
    for obj in OBJECTS:
        evaluated=obj.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ Vector(p) for p in evaluated.bound_box)
    minimum=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    maximum=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center=(minimum+maximum)/2
    direction=Vector((1,1,math.sqrt(2)*math.tan(math.radians(30)))).normalized()
    bpy.ops.object.camera_add(location=center+direction*14)
    camera=bpy.context.object
    camera.name="City-facing orthographic camera"
    camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    inverse=camera.matrix_world.inverted()
    bpy.context.view_layer.update()
    inverse=camera.matrix_world.inverted()
    view=[inverse@p for p in points]
    span=max(max(p.x for p in view)-min(p.x for p in view),max(p.y for p in view)-min(p.y for p in view))
    camera.data.ortho_scale=span*1.19
    bpy.context.scene.camera=camera
    lights=[("Key",(-3,1,7),650,5), ("Fill",(4,4,5),450,4), ("Rim",(1,-4,6),800,4)]
    for name,offset,energy,size in lights:
        bpy.ops.object.light_add(type='AREA',location=center+Vector(offset))
        light=bpy.context.object
        light.name=name
        light.data.energy=energy
        light.data.shape='DISK'
        light.data.size=size
        light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    world=bpy.data.worlds.new("Studio world")
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(*[srgb_linear(v) for v in PALETTE['concrete-light']],1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.30
    bpy.context.scene.world=world
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1024
    scene.render.resolution_y=1024
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=True
    scene.view_settings.view_transform='Standard'
    scene.view_settings.look='None'
    scene.view_settings.exposure=0
    return {"type":"orthographic","location":list(camera.location),"rotationEuler":list(camera.rotation_euler),"target":list(center),"elevationDegrees":30,"orthoScale":camera.data.ortho_scale,"resolution":[1024,1024],"positiveXPositiveY":True}


def export_scene(asset_id,candidate_id,output):
    camera=set_camera_and_lights()
    bpy.context.view_layer.update()
    depsgraph=bpy.context.evaluated_depsgraph_get()
    objects=[]
    all_positions=[]
    signed_volumes={}
    for obj in OBJECTS:
        evaluated=obj.evaluated_get(depsgraph)
        data=evaluated.to_mesh()
        data.calc_loop_triangles()
        normal_matrix=evaluated.matrix_world.to_3x3().inverted().transposed()
        positions,normals,indices=[],[],[]
        signed_volume=0.0
        for tri in data.loop_triangles:
            world_tri=[evaluated.matrix_world@data.vertices[v].co for v in tri.vertices]
            signed_volume+=world_tri[0].dot(world_tri[1].cross(world_tri[2]))/6
            for vertex_index,loop_index in zip(tri.vertices,tri.loops):
                point=evaluated.matrix_world@data.vertices[vertex_index].co
                normal=(normal_matrix@data.corner_normals[loop_index].vector).normalized()
                positions.extend(round(float(n),7) for n in point)
                normals.extend(round(float(n),7) for n in normal)
                indices.append(len(indices))
                all_positions.append(tuple(point))
        objects.append({"id":obj.name,"role":obj['asset_role'],"group":obj.get('module_group','base'),"material":obj['palette_token'],"positions":positions,"normals":normals,"indices":indices})
        signed_volumes[obj.name]=signed_volume
        evaluated.to_mesh_clear()
    bounds={"min":[round(min(p[i] for p in all_positions),7) for i in range(3)],"max":[round(max(p[i] for p in all_positions),7) for i in range(3)]}
    scene_json={"schemaVersion":1,"assetId":asset_id,"candidateId":candidate_id,"units":"kit","bounds":bounds,"objects":objects,"sockets":SOCKETS,"joints":JOINTS,"camera":camera}
    (output/'scene.json').write_text(json.dumps(scene_json,separators=(',',':'))+'\n',encoding='utf8')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in OBJECTS:obj.select_set(True)
    bpy.context.view_layer.objects.active=OBJECTS[0]
    bpy.ops.wm.save_as_mainfile(filepath=str(output/'source.blend'),compress=False)
    bpy.ops.export_scene.gltf(filepath=str(output/'asset.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=False,export_extras=True)
    bpy.context.scene.render.filepath=str(output/'beauty.png')
    bpy.ops.render.render(write_still=True)
    emissives=[]
    for token,mat in MATERIALS.items():
        strength=mat.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength']
        if strength.default_value>0:
            emissives.append((token,strength,float(strength.default_value)))
            strength.default_value=0
    if emissives:
        bpy.context.scene.render.filepath=str(output/'idle.png')
        bpy.ops.render.render(write_still=True)
        for _,strength,value in emissives:strength.default_value=value
    else:
        shutil.copyfile(output/'beauty.png',output/'idle.png')
    filenames=['source.blend','asset.glb','scene.json','beauty.png','idle.png']
    files={name:{"sha256":hashlib.sha256((output/name).read_bytes()).hexdigest(),"bytes":(output/name).stat().st_size} for name in filenames}
    checks={"finiteVertices":all(math.isfinite(n) for p in all_positions for n in p),"unitNormals":all(abs(math.sqrt(sum(n*n for n in item['normals'][i:i+3]))-1)<1e-5 for item in objects for i in range(0,len(item['normals']),3)),"nonemptyMeshes":all(bool(o['indices']) for o in objects),"positiveBounds":all(bounds['max'][i]>bounds['min'][i] for i in range(3)),"positiveSignedMeshVolumes":all(v>0 for v in signed_volumes.values()),"nonPositiveVolumeObjectIds":[name for name,v in signed_volumes.items() if v<=0],"supportMinZ":bounds['min'][2]}
    revision=re.search(r'-r(\d+)$',candidate_id)
    manifest={"schemaVersion":1,"assetId":asset_id,"candidateId":candidate_id,"revisionRound":int(revision.group(1)) if revision else 0,"builderId":"mesh-builder","sourceVersion":VERSION,"builderSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"blenderVersion":bpy.app.version_string,"blenderBuildHash":bpy.app.build_hash.decode(),"gltfUpAxis":"Z","units":"kit","bounds":bounds,"sockets":SOCKETS,"joints":JOINTS,"objectCount":len(objects),"triangleCount":sum(len(o['indices'])//3 for o in objects),"camera":camera,"checks":checks,"files":files,"groups":{name:sum(obj.get('group')==name for obj in objects) for name in sorted({obj.get('group') for obj in objects})},"stateEvidence":{"idle":"Emission disabled only; geometry and physical role colors retained.","emissiveMaterials":[item[0] for item in emissives],"moduleOff":"Not applicable: this electrical rack is always-present hardware." if asset_id=='electrical-termination' else "Pending: fixed assembled prototype. Group labels support future masking but do not implement a valid city module graph."},"limitations":["Joint metadata and mechanical construction are illustrative, not electrical or ventilation engineering certification.","No structural loads, fluid dynamics or electrical clearance certification is implied."]}
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
    print('PILOT_CANDIDATE_COMPLETE '+str(output),flush=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--out',required=True)
    parser.add_argument('--palette',required=True)
    parser.add_argument('--candidate')
    parser.add_argument('--verify-reopen',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    if args.verify_reopen:
        directory=Path(args.out).resolve()/'candidates'/args.candidate
        manifest=json.loads((directory/'manifest.json').read_text(encoding='utf8'))
        meshes=[obj for obj in bpy.data.objects if obj.type=='MESH' and 'asset_role' in obj]
        depsgraph=bpy.context.evaluated_depsgraph_get()
        triangle_count=0
        vertex_count=0
        for obj in meshes:
            evaluated=obj.evaluated_get(depsgraph)
            data=evaluated.to_mesh()
            data.calc_loop_triangles()
            triangle_count+=len(data.loop_triangles)
            vertex_count+=len(data.vertices)
            evaluated.to_mesh_clear()
        emissive=[]
        for mat in bpy.data.materials:
            if mat.use_nodes:
                bsdf=mat.node_tree.nodes.get('Principled BSDF')
                if bsdf and bsdf.inputs['Emission Strength'].default_value>0:emissive.append(mat.name)
        checks={'sourceMatchesCandidate':Path(bpy.data.filepath).resolve()==(directory/'source.blend').resolve(),
                'objectCountMatchesManifest':len(meshes)==manifest['objectCount'],
                'evaluatedTrianglesMatchManifest':triangle_count==manifest['triangleCount'],
                'cameraPreserved':bpy.context.scene.camera is not None,
                'editableBevelSourcesPreserved':any(mod.type=='BEVEL' for obj in meshes for mod in obj.modifiers)}
        report={'schemaVersion':1,'assetId':manifest['assetId'],'candidateId':manifest['candidateId'],
                'freshProcess':True,'blenderVersion':bpy.app.version_string,'sourceSha256':hashlib.sha256((directory/'source.blend').read_bytes()).hexdigest(),
                'meshObjectCount':len(meshes),'evaluatedTriangleCount':triangle_count,'evaluatedVertexCount':vertex_count,
                'emissiveMaterials':emissive,'checks':checks,'passed':all(checks.values())}
        path=directory/'reopen-report.json'
        if path.exists():raise FileExistsError('Refusing to replace reopen evidence '+str(path))
        path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
        print('PILOT_REOPEN_VERIFIED '+str(path),flush=True)
        if not report['passed']:raise ValueError('Fresh reopen checks failed')
        return
    raw=Path(args.palette).read_text(encoding='utf8')
    palette={name:tuple(int(color[i:i+2],16)/255 for i in (0,2,4)) for name,color in re.findall(r'--([\w-]+):\s*#([0-9a-fA-F]{6})',raw)}
    root=Path(args.out).resolve()
    root.mkdir(parents=True,exist_ok=True)
    builders={'electrical-termination-A':electrical_a,'electrical-termination-B':electrical_b,'furnace-extraction-A':furnace_a,'furnace-extraction-B':furnace_b,
              'electrical-termination-A-r1':electrical_a_r1,'furnace-extraction-A-r1':furnace_a_r1}
    selected=[args.candidate] if args.candidate else list(builders)
    for key in selected:
        if key not in builders:raise ValueError('Unknown candidate '+key)
        asset_id='electrical-termination' if key.startswith('electrical-termination-') else 'furnace-extraction'
        candidate=key[len(asset_id)+1:]
        output=root/'candidates'/key
        if output.exists():raise FileExistsError('Refusing to overwrite candidate '+str(output))
        output.mkdir(parents=True)
        reset(palette)
        builders[key]()
        export_scene(asset_id,candidate,output)


if __name__=='__main__':main()
