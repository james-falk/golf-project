import argparse
import sys
from pathlib import Path

import bpy


parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--ratio", type=float, default=0.38)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))

for obj in list(bpy.context.scene.objects):
    if obj.type == "MESH" and len(obj.data.vertices) <= 8:
        bpy.data.objects.remove(obj, do_unlink=True)

gold = bpy.data.materials.new("Jeff trophy gold")
gold.diffuse_color = (0.72, 0.36, 0.075, 1.0)
gold.metallic = 0.72
gold.roughness = 0.32

for obj in [item for item in bpy.context.scene.objects if item.type == "MESH"]:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new(name="Mobile decimation", type="DECIMATE")
    modifier.ratio = args.ratio
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.clear()
    obj.data.materials.append(gold)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True

output = Path(args.output).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    export_apply=True,
    export_materials="EXPORT",
)
print(f"Prepared {output}")
