import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


parser = argparse.ArgumentParser()
parser.add_argument("--model", required=True)
parser.add_argument("--output-dir", required=True)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(args.model).resolve()))

meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
vertices = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
minimum = Vector(tuple(min(vertex[axis] for vertex in vertices) for axis in range(3)))
maximum = Vector(tuple(max(vertex[axis] for vertex in vertices) for axis in range(3)))
center = (minimum + maximum) / 2
size = maximum - minimum

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = True

camera_data = bpy.data.cameras.new("Preview camera")
camera = bpy.data.objects.new("Preview camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.lens = 58

for name, offset, energy, color in (
    ("Warm key", Vector((3.5, -4.5, 4.0)), 950, (1.0, 0.78, 0.48)),
    ("Cool fill", Vector((-4.0, 1.5, 2.5)), 700, (0.42, 0.62, 0.55)),
):
    light_data = bpy.data.lights.new(name=name, type="AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = 4.5
    light_data.color = color
    light = bpy.data.objects.new(name, light_data)
    scene.collection.objects.link(light)
    light.location = center + offset
    light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()

output_dir = Path(args.output_dir).resolve()
output_dir.mkdir(parents=True, exist_ok=True)
radius = max(size.x, size.y, size.z) * 2.35
for index, degrees in enumerate((0, 60, 120, 180, 240, 300)):
    angle = math.radians(degrees)
    camera.location = center + Vector((math.sin(angle) * radius, -math.cos(angle) * radius, size.z * 0.08))
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(output_dir / f"jeff-{index:02d}.png")
    bpy.ops.render.render(write_still=True)
