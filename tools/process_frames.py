import sys, glob, os
import numpy as np
from PIL import Image, ImageFilter

SRC = 'frames'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out_frames'
GAMMA = float(sys.argv[2]) if len(sys.argv) > 2 else 0.50
HALO = float(sys.argv[3]) if len(sys.argv) > 3 else 0.55   # halo strength 0..1
SCALE_H = int(sys.argv[4]) if len(sys.argv) > 4 else 640   # output height
LIMIT = int(sys.argv[5]) if len(sys.argv) > 5 else 0

# union bbox (measured) + padding for the soft edge halo
X0, Y0, X1, Y1 = 314, 39, 990, 719
PAD = 10
box = (X0 - PAD, max(0, Y0 - PAD), X1 + PAD + 1, 720)   # bottom stays on frame edge (chest bleeds off)

def tone(rgb):
    lum = (0.2126*rgb[...,0] + 0.7152*rgb[...,1] + 0.0722*rgb[...,2]) / 255.0
    y = np.power(lum, GAMMA)
    # gentle S-curve to keep blacks rich in hair, lift in face
    y = y*y*(3-2*y)*0.28 + y*0.72
    y = np.clip((y - 0.035) / (0.985 - 0.035), 0, 1)
    return y

os.makedirs(OUT, exist_ok=True)
files = sorted(glob.glob(f'{SRC}/*.png'))
if LIMIT: files = files[:LIMIT]
for i, f in enumerate(files):
    im = Image.open(f).convert('RGBA').crop(box)
    a = np.array(im).astype(np.float32)
    alpha = a[...,3] / 255.0
    alpha = np.clip((alpha - 0.16) / 0.84, 0, 1)            # crush the faint speckle fringe left by background removal
    alpha = alpha*alpha*(3-2*alpha)*0.35 + alpha*0.65      # keep edges soft but not dotty
    y = tone(a[...,:3])
    # soft white cut-out edge: blurred alpha, composited UNDER the subject
    halo_a = np.array(Image.fromarray((alpha*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.6))).astype(np.float32)/255.0
    halo_a = np.clip(halo_a*1.5, 0, 1) * HALO
    # premultiplied composite: subject over white halo
    out_a = alpha + halo_a*(1-alpha)
    out_c = (y*alpha + 1.0*halo_a*(1-alpha)) / np.maximum(out_a, 1e-4)
    g = (np.clip(out_c,0,1)*255).astype(np.uint8)
    rgba = np.dstack([g, g, g, (np.clip(out_a,0,1)*255).astype(np.uint8)])
    img = Image.fromarray(rgba, 'RGBA')
    w = round(img.width * SCALE_H / img.height)
    img = img.resize((w, SCALE_H), Image.LANCZOS)
    img.save(f'{OUT}/f{i:03d}.webp', 'WEBP', quality=84, alpha_quality=92, method=5)
print('done', len(files), 'frames', img.size)
