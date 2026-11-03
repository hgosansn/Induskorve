"""First reusable kit. Reuses trusted pilot geometry; no external dependencies."""
import argparse
import importlib.util
import json
import math
import re
import sys
import time
from pathlib import Path

import bpy
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

START = time.perf_counter()
spec = importlib.util.spec_from_file_location('pilot', Path(__file__).with_name('build_meshes.py'))
k = importlib.util.module_from_spec(spec)
spec.loader.exec_module(k)


def port(name, point, normal, radius=.3):
    return dict(id=name, point=list(point), normal=list(normal), service='extraction', radius=radius)


def duct(length):
    k.tube_path('rolled-duct', [(0, 0, 0), (length, 0, 0)], .3, .035)
    for x,axis in [(.035,(-1,0,0)),(length-.035,(1,0,0))]:
        k.flange('bolted-flange', (x, 0, 0), axis, .40, .135)
    if length > 1:
        k.flange('stiffening-band', (length/2, 0, 0), (1, 0, 0), .32, .055)
    return [port('in', (0, 0, 0), (-1, 0, 0)), port('out', (length, 0, 0), (1, 0, 0))]


def elbow():
    # Tangential quarter-circle sweep, not intersecting cylinder primitives.
    points=[(.7*math.sin(i*math.pi/24), 0, .7*(1-math.cos(i*math.pi/24))) for i in range(13)]
    k.tube_path('swept-hollow-elbow', points, .3, .035)
    k.flange('inlet', (.035, 0, 0), (-1, 0, 0), .40, .135)
    k.flange('outlet', (.7, 0, .665), (0, 0, 1), .40, .135)
    return [port('in', (0, 0, 0), (-1, 0, 0)), port('out', (.7, 0, .7), (0, 0, 1))]


def reducer():
    # Closed annular wall with an open bore at both ends.
    sides=24
    vertices=[]
    for z,r in [(0,.3),(.8,.2),(0,.265),(.8,.165)]:
        vertices.extend((r*math.cos(i*2*math.pi/sides),r*math.sin(i*2*math.pi/sides),z) for i in range(sides))
    faces=[]
    for i in range(sides):
        j=(i+1)%sides
        faces.extend([(i,j,sides+j,sides+i),(2*sides+j,2*sides+i,3*sides+i,3*sides+j),(i,2*sides+i,2*sides+j,j),(sides+i,sides+j,3*sides+j,3*sides+i)])
    k.mesh('rolled-conical-reducer',vertices,faces,'steel','hollow-reducer',0)
    k.flange('large-flange',(0,0,.035),(0,0,-1),.4,.135)
    k.flange('small-flange',(0,0,.765),(0,0,1),.30,.135)
    return [port('in',(0,0,0),(0,0,-1)),port('out',(0,0,.8),(0,0,1),.2)]


def saddle():
    k.duct_support('adjustable-stand',0,0,.6)
    k.beam('gusset',(-.15,0,.12),(0,0,.46),.055)
    return [dict(id='cradle',point=[0,0,.6],normal=[0,0,1],service='support')]


def frame():
    for x in [0,1.6]:
        for y in [0,1]:
            k.box('anchor-foot',(x-.12,y-.12,0),(.24,.24,.10),'concrete-shadow')
            k.box('steel-leg',(x-.045,y-.045,.1),(.09,.09,1.30))
    for y in [0,1]:
        k.box('top-rail',(-.1,y-.08,1.4),(1.8,.16,.1))
        k.beam('diagonal-brace',(0,y,.25),(1.6,y,1.34),.065)
    for x in [0,1.6]:
        k.box('cross-rail',(x-.08,0,1.4),(.16,1,.1))
    for y in [.25,.75]:
        k.box('cabinet-bearing-rail',(-.1,y-.05,1.4),(1.8,.1,.1))
    return [dict(id='deck',point=[.8,.5,1.5],normal=[0,0,1],service='support')]


def louver():
    for x in [0,1.1]: k.box('jamb',(x,0,0),(.08,.12,.9),'concrete-shadow')
    for z in [0,.82]: k.box('edge-rail',(.08,0,z),(1.02,.12,.08),'concrete-shadow')
    for i in range(6):
        obj=k.box('inclined-louver-blade',(.08,.02,.12+i*.115),(1.02,.15,.035),'steel',bevel=.003)
        obj.rotation_euler.x=math.radians(-22)
    return []


def cabinet():
    k.box('folded-cabinet',(0,0,0),(1.2,.7,1.7),'surface',bevel=.025)
    k.box('sealed-door',(.04,.7,.05),(1.12,.035,1.6),'steel',bevel=.008)
    for z in [.3,1.3]: k.box('hinge',(.04,.735,z),(.04,.035,.13),'concrete-shadow')
    k.box('door-handle',(.96,.74,.75),(.035,.045,.22),'concrete-light')
    k.box('role-stripe',(.12,.737,1.40),(.65,.006,.045),'production',bevel=0)
    for i in range(4): k.box('lower-door-vent',(.16,.74,.20+i*.07),(.65,.025,.022),'ink',bevel=0)
    return [dict(id='base',point=[.6,.35,0],normal=[0,0,-1],service='support')]


RECIPES=[('duct-long','Two-unit flanged duct',lambda:duct(2),'suspended'),
         ('duct-short','One-unit flanged duct',lambda:duct(1),'suspended'),
         ('duct-elbow','Swept rising elbow',elbow,'suspended'),
         ('duct-reducer','Vertical reducer',reducer,'suspended'),
         ('saddle-stand','Ground-mounted duct saddle',saddle,'ground'),
         ('equipment-frame','Open braced equipment frame',frame,'ground'),
         ('louver-panel','Inclined ventilation blades',louver,'wall'),
         ('service-cabinet','Sealed service cabinet',cabinet,'supported')]


def routed_duct(route):
    points=[Vector(p) for p in route['points']]
    radius=route['diameter']/2
    k.tube_path('sealed-routed-duct',points,radius,.025)
    for index,at,other in [(0,points[0],points[1]),(1,points[-1],points[-2])]:
        normal=(at-other).normalized()
        # Annular plate ends exactly on its mating plane.
        k.flange('end-flange',at-normal*.035,normal,radius+.05,.075)
    return [dict(id='in' if i==0 else 'out',point=list(at),normal=list((at-other).normalized()),service='extraction',radius=radius)
            for i,at,other in [(0,points[0],points[1]),(1,points[-1],points[-2])]]


def city_stand():
    k.box('anchored-foot',(0,0,0),(.34,.3,.12),'concrete-shadow')
    k.box('supported-post',(.1292,.084,.12),(.0816,.132,3.62),'steel')
    k.box('bearing-cap',(0,0,3.74),(.34,.3,.12),'steel')
    return [dict(id='bearing',point=[.17,.15,3.86],normal=[0,0,1],service='support')]


def city_grid():
    k.box('supported-base',(0,0,0),(1.7,1.4,.2),'surface')
    before=len(k.OBJECTS)
    cabinet()
    for obj in k.OBJECTS[before:]:
        obj.location.z*=.5
        obj.scale.z*=.5
        obj.location+=Vector((.25,.25,.2))
        if obj.name.startswith('role-stripe'):
            obj.data.materials.clear()
            obj.data.materials.append(k.MATERIALS['power'])
            obj['palette_token']='power'
    for i,x in enumerate([.35,.85,1.35]):
        k.cylinder('bushing-flange',(x,.7,1.05),(x,.7,1.12),.11,'steel',vertices=16)
        profile=[(1.12,.055),(1.16,.10),(1.21,.055),(1.26,.11),(1.31,.055),(1.36,.10),(1.41,.05)]
        k.lathe('ceramic-bushing',(x,.7,0),profile,'concrete-light',segments=16)
        k.cylinder('termination-pin',(x,.7,1.41),(x,.7,1.55),.035,'steel',vertices=12,bevel=.003)
        k.cylinder('cable-clamp',(x,.7,1.47),(x,.7,1.55),.065,'power',vertices=12,bevel=.004)
    return [dict(id='grid',point=[.85,.7,1.55],normal=[0,0,1],service='power')]


def side_louver():
    louver()
    rotation=Matrix.Rotation(-math.pi/2,4,'Z')
    for obj in k.OBJECTS:
        obj.matrix_world=rotation@obj.matrix_world
        obj.location.y+=1.18
    return []


def city_furnace():
    # Minimum-width body fits every existing furnace bay without deformation.
    k.box('cast-plinth',(0,0,0),(2.3,2.35,.23),'surface',bevel=.025)
    k.box('recessed-process-body',(.16,.16,.23),(1.98,2.02,3.10),'surface',bevel=.025)
    k.box('folded-top',(.1,.1,3.33),(2.1,2.15,.17),'steel',bevel=.025)
    k.box('top-infill',(.3,.3,3.48),(1.7,1.75,.02),'surface',bevel=.004)
    for x in [.13,1.96]:
        k.box('front-casing-rail',(x,2.16,.24),(.20,.17,3.08),'steel',bevel=.018)
        for z in [.4,1.7,3.15]:
            k.cylinder('casing-fastener',(x+.1,2.33,z),(x+.1,2.35,z),.035,'concrete-shadow',vertices=6,bevel=.002)
    k.box('refractory-frame',(.38,2.18,.63),(1.54,.10,1.02),'concrete-shadow',bevel=.025)
    k.box('recessed-dark-throat',(.48,2.281,.76),(1.34,.015,.73),'ink',bevel=0)
    k.box('upper-service-cover',(.42,2.185,1.85),(1.46,.09,1.25),'steel',bevel=.015)
    for x in [.5,1.8]:
        for z in [1.95,2.98]:
            k.cylinder('cover-bolt',(x,2.275,z),(x,2.30,z),.027,'concrete-shadow',vertices=6,bevel=.002)
    k.box('cover-seam',(1.14,2.277,1.91),(.018,.005,1.13),'ink',bevel=0)
    # Reuse the first kit's actual inclined-blade geometry on the side casing.
    before=len(k.OBJECTS)
    louver()
    rotation=Matrix.Rotation(-math.pi/2,4,'Z')
    for obj in k.OBJECTS[before:]:
        obj.matrix_world=rotation@obj.matrix_world
        obj.location.y+=1.18
        obj.location*=1.5
        obj.scale*=1.5
        obj.location+=Vector((1.995,.32,.68))
    for y in [.16,2.04]:
        k.box('side-casing-post',(2.12,y,.25),(.14,.14,3.07),'steel',bevel=.012)
    k.box('capture-nozzle',(0,.76,1.86),(.2,.28,.28),'steel',bevel=.008)
    k.flange('capture-flange',(.035,.9,2),(-1,0,0),.19,.075)
    # The mating duct owns shared bolt heads; the receiver stays inside its bay.
    for obj in list(k.OBJECTS):
        if obj.name.startswith('capture-flange-bolt'):
            k.OBJECTS.remove(obj)
            bpy.data.objects.remove(obj,do_unlink=True)
    return [port('in',(0,.9,2),(-1,0,0),.14)]


def city_plenum():
    k.box('ground-skid',(0,0,0),(1.4,.9,.14),'surface',bevel=.018)
    k.box('sealed-collection-casing',(.06,.06,.14),(1.28,.78,1.51),'steel',bevel=.025)
    k.box('folded-lid',(.04,.04,1.65),(1.32,.82,.10),'concrete-shadow',bevel=.012)
    k.box('cover-reveal',(.14,.84,.35),(1.12,.025,1.05),'ink',bevel=.012)
    k.box('removable-cleanout',(.19,.866,.4),(1.02,.025,.95),'surface',bevel=.008)
    for x in [.25,1.15]:
        for z in [.48,1.27]:
            k.cylinder('cover-fastener',(x,.89,z),(x,.90,z),.026,'concrete-light',vertices=6,bevel=.002)
    for y in [.25,.65]:
        k.tube_path('receiver',[(0,y,1.1),(.13,y,1.1)],.14,.025)
        k.flange('owned-flange',(.035,y,1.1),(-1,0,0),.19,.075)
    k.flange('owned-flange',(.45,.45,1.715),(0,0,1),.19,.075)
    # The adjoining route owns joint bolt heads; keep this casing in its bay.
    for obj in list(k.OBJECTS):
        if obj.name.startswith('owned-flange-bolt'):
            k.OBJECTS.remove(obj);bpy.data.objects.remove(obj,do_unlink=True)
    return [port('hall-in',(0,.25,1.1),(-1,0,0),.14),port('furnace-in',(0,.65,1.1),(-1,0,0),.14),port('out',(.45,.45,1.75),(0,0,1),.14)]


def city_terminal():
    k.box('anchored-boot',(0,0,0),(.6,.6,.12),'concrete-shadow',bevel=.015)
    k.box('logistics-pedestal',(.06,.06,.12),(.48,.48,1.06),'surface',bevel=.018)
    k.box('weather-cap',(.03,.03,1.18),(.54,.54,.12),'steel',bevel=.015)
    k.box('recessed-interface',(.13,.54,.78),(.34,.025,.25),'ink',bevel=.004)
    k.box('interface-label',(.16,.566,.94),(.28,.006,.035),'concrete-light',bevel=0)
    k.box('role-strip',(.16,.566,.84),(.21,.006,.055),'steel',bevel=0)
    for x in [.14,.42]:
        k.cylinder('base-anchor',(x,.3,.12),(x,.3,.145),.025,'steel',vertices=6,bevel=.002)
    return [dict(id='logistics',point=[.3,.3,1.3],normal=[0,0,1],service='logistics')]


def city_hatch():
    k.box('weather-curb',(0,0,0),(.7,1.1,.12),'surface',bevel=.012)
    k.box('gasket',(.045,.045,.12),(.61,1.01,.045),'ink',bevel=.006)
    k.box('sealed-hatch',(.035,.035,.165),(.63,1.03,.14),'steel',bevel=.014)
    for x in [.16,.5]: k.box('hinge',(x,.06,.29),(.07,.16,.04),'concrete-shadow',bevel=.008)
    k.box('latch',(.27,.78,.305),(.16,.08,.045),'concrete-light',bevel=.008)
    return []


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--out',required=True)
    parser.add_argument('--city-plans')
    parser.add_argument('--only')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    root=Path(args.out).resolve()
    root.mkdir(parents=True,exist_ok=False)
    raw=Path('src/app/palette.css').read_text()
    palette={name:tuple(int(color[i:i+2],16)/255 for i in (0,2,4)) for name,color in re.findall(r'--([\w-]+):\s*#([0-9a-fA-F]{6})',raw)}
    result=[]
    recipes=RECIPES
    if args.city_plans:
        plans=json.loads(Path(args.city_plans).read_text())
        recipes=[('route-'+r['id'],r['id'],lambda r=r:routed_duct(r),'suspended') for r in plans['routes']]
        recipes += [('city-saddle','Tall furnace duct saddle',city_stand,'ground'),
                    ('city-grid','Cabinet and ceramic termination',city_grid,'ground'),
                    ('louver-side','Side-mounted cooling louver',side_louver,'wall'),
                    ('city-furnace','Recessed furnace casing with cooling bank',city_furnace,'ground'),
                    ('city-plenum','Sealed cleanout collector',city_plenum,'ground'),
                    ('city-terminal','Logistics interface pedestal',city_terminal,'ground'),
                    ('city-hatch','Gasketed stair-core hatch',city_hatch,'supported')]
    if args.only:
        recipes=[r for r in recipes if r[0] in args.only.split(',')]
        if not recipes: raise ValueError('No matching recipe')
    for id,label,build,mount in recipes:
        began=time.perf_counter()
        out=root/id
        out.mkdir()
        k.reset(palette)
        ports=build()
        # Two bevel segments suffice for these small baked parts.
        for obj in k.OBJECTS:
            for mod in obj.modifiers:
                if mod.type=='BEVEL': mod.segments=2
        bpy.context.view_layer.update()
        deps=bpy.context.evaluated_depsgraph_get()
        pts=[]
        triangles=0
        for obj in k.OBJECTS:
            ev=obj.evaluated_get(deps)
            data=ev.to_mesh()
            data.calc_loop_triangles()
            triangles+=len(data.loop_triangles)
            pts.extend(ev.matrix_world@v.co for v in data.vertices)
            ev.to_mesh_clear()
        bounds=dict(min=[min(p[i] for p in pts) for i in range(3)],max=[max(p[i] for p in pts) for i in range(3)])
        assert all(math.isfinite(n) for p in pts for n in p)
        assert triangles>0
        if mount=='ground': assert abs(bounds['min'][2])<.00001
        generation=time.perf_counter()-began
        export_start=time.perf_counter()
        k.set_camera_and_lights()
        bpy.ops.wm.save_as_mainfile(filepath=str(out/'source.blend'),compress=True)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in k.OBJECTS: obj.select_set(True)
        bpy.context.view_layer.objects.active=k.OBJECTS[0]
        bpy.ops.export_scene.gltf(filepath=str(out/'master.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=False)
        export=time.perf_counter()-export_start
        render_start=time.perf_counter()
        # Canvas kit: x/y project to (2.25,1.125), z to -3 pixels.
        # Compensate only during raster export to match that exact projection.
        stretch=3/(math.sqrt(2)*2.25*math.cos(math.pi/6))
        for obj in k.OBJECTS:
            obj.location.z*=stretch
            obj.scale.z*=stretch
        for obj in list(bpy.data.objects):
            if obj.type in {'CAMERA','LIGHT'}: bpy.data.objects.remove(obj,do_unlink=True)
        bpy.context.view_layer.update()
        camera=k.set_camera_and_lights()
        scene=bpy.context.scene
        scene.render.resolution_x=512
        scene.render.resolution_y=512
        scene.cycles.samples=8
        bpy.context.view_layer.update()
        origin=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
        projection=[]
        for axis in [(1,0,0),(0,1,0),(0,0,stretch)]:
            p=world_to_camera_view(scene,scene.camera,Vector(axis))
            projection.append([(p.x-origin.x)*512,(origin.y-p.y)*512])
        # Pixels per horizontal projected kit unit -> city canvas conversion.
        pixels_per_unit=512/camera['orthoScale']
        city_scale=math.sqrt(2)*2.25/pixels_per_unit
        scene.render.filepath=str(out/'preview.png')
        bpy.ops.render.render(write_still=True)
        render=time.perf_counter()-render_start
        record=dict(id=id,label=label,mount=mount,ports=ports,bounds=bounds,triangles=triangles,
                    origin=[origin.x*512,(1-origin.y)*512],cityScale=city_scale,projection=projection,
                    timings=dict(generation=generation,sourceExport=export,render=render,total=time.perf_counter()-began))
        result.append(record)
        print('PART_COMPLETE '+json.dumps(record),flush=True)
        (root/'build.json').write_text(json.dumps(dict(parts=result,blender=bpy.app.version_string,seconds=time.perf_counter()-START),indent=2))


if __name__=='__main__': main()
