import argparse
from pathlib import Path

import trimesh
from PIL import Image


parser = argparse.ArgumentParser()
parser.add_argument("--mesh", required=True)
parser.add_argument("--texture", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()

mesh = trimesh.load(args.mesh, process=False, force="mesh")
if mesh.visual.uv is None:
    raise RuntimeError("The reconstructed Jeff mesh does not contain baked UV coordinates.")

material = trimesh.visual.material.PBRMaterial(
    name="Jeff baked gold",
    baseColorTexture=Image.open(args.texture).convert("RGBA"),
    metallicFactor=0.12,
    roughnessFactor=0.55,
)
mesh.visual = trimesh.visual.TextureVisuals(uv=mesh.visual.uv, material=material)

output = Path(args.output).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(trimesh.exchange.gltf.export_glb(trimesh.Scene(mesh)))
print(f"Packaged {output}")
