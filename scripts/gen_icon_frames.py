#!/usr/bin/env python3
"""Generate 8 animation frames (128x128) of the breathing orb for macOS Dock icon.
Each frame scales the sphere size and glow intensity based on a phase 0.0-1.0.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

SIZE = 128  # Dock icon size

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

def radial(cx, cy, r, inner, outer, canvas):
    """Draw a radial gradient sphere."""
    cx, cy, r = cx * SIZE, cy * SIZE, r * SIZE
    x0, y0 = int(cx - r), int(cy - r)
    x1, y1 = int(cx + r), int(cy + r)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(SIZE, x1), min(SIZE, y1)
    px = canvas.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            d = math.hypot(x - cx, y - cy) / r
            if d > 1:
                continue
            t = d
            col = lerp(inner, outer, t)
            a = int(col[3] * (1 - t * 0.15))
            ex = px[x, y]
            na = a + ex[3] * (255 - a) // 255
            if na == 0:
                continue
            nr = (col[0] * a + ex[0] * ex[3] * (255 - a) // 255) // na
            ng = (col[1] * a + ex[1] * ex[3] * (255 - a) // 255) // na
            nb = (col[2] * a + ex[2] * ex[3] * (255 - a) // 255) // na
            px[x, y] = (nr, ng, nb, na)

def generate_frame(phase):
    """
    Generate a single frame with a breathing animation.
    phase: 0.0-1.0, where 0.5 is maximum scale (exhale/biggest)
    """
    # Breathing scale: 92% at phase 0/1, 100% at phase 0.5
    scale = 0.92 + 0.08 * (1 - abs(phase * 2 - 1))  # Wave from 0.92 to 1.0

    # Glow opacity: brighter when bigger
    glow_opacity = int(100 + 60 * (1 - abs(phase * 2 - 1)))  # 100-160 range

    # Highlight opacity: more prominent when bigger
    hi_opacity = int(120 + 80 * (1 - abs(phase * 2 - 1)))  # 120-200 range

    base = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)
    pad = int(SIZE * 0.06)
    draw.ellipse([pad, pad, SIZE - pad, SIZE - pad], fill=(13, 14, 22, 255))

    sphere = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    # Scale the sphere radius by the breathing factor
    r_main = 0.47 * scale
    r_glow1 = 0.34 * scale
    r_glow2 = 0.30 * scale

    radial(0.5, 0.5, r_main, (100, 130, 210, 255), (55, 60, 110, 255), sphere)
    radial(0.68, 0.74, r_glow1, (150, 110, 235, int(235 * scale)), (55, 60, 110, 0), sphere)
    radial(0.34, 0.28, r_glow2, (235, 240, 255, int(245 * scale)), (55, 60, 110, 0), sphere)

    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).ellipse([pad, pad, SIZE - pad, SIZE - pad], fill=255)
    sphere.putalpha(Image.composite(sphere.split()[3], Image.new("L", (SIZE, SIZE), 0), mask))

    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    glow_pad = pad - int(5 * scale)
    ImageDraw.Draw(glow).ellipse([glow_pad, glow_pad, SIZE - glow_pad, SIZE - glow_pad],
                                   fill=(90, 120, 220, glow_opacity))
    glow = glow.filter(ImageFilter.GaussianBlur(6))

    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out = Image.alpha_composite(out, glow)
    out = Image.alpha_composite(out, sphere)

    hi = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    hi_x0 = SIZE * 0.30
    hi_y0 = SIZE * 0.24
    hi_x1 = SIZE * 0.46
    hi_y1 = SIZE * 0.38
    ImageDraw.Draw(hi).ellipse([hi_x0, hi_y0, hi_x1, hi_y1], fill=(255, 255, 255, hi_opacity))
    hi = hi.filter(ImageFilter.GaussianBlur(2))
    out = Image.alpha_composite(out, hi)

    return out

# Create output directory
output_dir = "assets/build/orb_frames"
os.makedirs(output_dir, exist_ok=True)

# Generate 8 frames
for i in range(8):
    phase = i / 8.0
    frame = generate_frame(phase)
    path = os.path.join(output_dir, f"frame{i}.png")
    frame.save(path)
    print(f"wrote {path} ({frame.size})")

print(f"generated 8 frames in {output_dir}")
