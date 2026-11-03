"""Fresh-process source and mating-face checks, independent of sprite metadata."""
import json
import sys
import time
from pathlib import Path
import bpy
from mathutils import Vector

start=time.perf_counter()
root=Path(sys.argv[sys.argv.index('--')+1]).resolve()
build=json.loads((root/'build.json').read_text())
reports=[]
route_samples={}
for part in build['parts']:
    bpy.ops.wm.open_mainfile(filepath=str(root/part['id']/'source.blend'))
    meshes=[obj for obj in bpy.data.objects if obj.type=='MESH']
    deps=bpy.context.evaluated_depsgraph_get()
    triangles=0
    flange_points=[]
    world_points=[]
    for obj in meshes:
        ev=obj.evaluated_get(deps)
        data=ev.to_mesh()
        data.calc_loop_triangles()
        triangles+=len(data.loop_triangles)
        points=[ev.matrix_world@v.co for v in data.vertices]
        world_points.extend(points)
        if part['id'].startswith('route-'):
            samples=route_samples.setdefault(part['id'],[])
            samples.extend([list(p) for p in points])
            samples.extend([list(sum((ev.matrix_world@data.vertices[v].co for v in t.vertices),Vector())/3) for t in data.loop_triangles])
        if obj.get('asset_role')=='duct-flange':
            flange_points.append([ev.matrix_world@v.co for v in data.vertices])
        ev.to_mesh_clear()
    checks=dict(editableMeshes=bool(meshes),trianglesMatch=triangles==part['triangles'],cameraRetained=bpy.context.scene.camera is not None)
    checks['boundsMatch']=all(abs(min(p[i] for p in world_points)-part['bounds']['min'][i])<1e-5 and abs(max(p[i] for p in world_points)-part['bounds']['max'][i])<1e-5 for i in range(3))
    for port in part['ports']:
        if port['service']!='extraction':continue
        at=Vector(port['point']);normal=Vector(port['normal'])
        # Each mating plane must coincide with a real annular flange face,
        # not its centre plane. Mechanical bolt overlaps are not collision-tested.
        checks['matingFace:'+port['id']]=any(
            abs(max((p-at).dot(normal) for p in points))<.00001 and
            abs(min((p-at).dot(normal) for p in points)+.07)<.00001
            for points in flange_points)
    reports.append(dict(id=part['id'],checks=checks,passed=all(checks.values())))
report=dict(parts=reports,seconds=time.perf_counter()-start,passed=all(p['passed'] for p in reports))
(root/'source-verification.json').write_text(json.dumps(report,indent=2))
if route_samples:(root/'route-samples.json').write_text(json.dumps(route_samples,separators=(',',':')))
print('SOURCE_VERIFICATION '+json.dumps(report),flush=True)
if not report['passed']:raise RuntimeError('Source validation failed')
