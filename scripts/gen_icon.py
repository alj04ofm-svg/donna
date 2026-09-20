#!/usr/bin/env python3
"""Generate assets/appicon.png as the same living-gradient orb used in-app
(app.css .orb), so the Dock/Finder icon matches the in-app identity instead
of being a generic unrelated mark."""
import math
from PIL import Image, ImageDraw, ImageFilter

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

def radial(cx, cy, r, inner, outer, canvas):
    cx, cy, r = cx * S, cy * S, r * S
    x0, y0 = int(cx - r), int(cy - r)
    x1, y1 = int(cx + r), int(cy + r)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(S, x1), min(S, y1)
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

base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
draw = ImageDraw.Draw(base)
pad = int(S * 0.06)
draw.ellipse([pad, pad, S - pad, S - pad], fill=(13, 14, 22, 255))

sphere = Image.new("RGBA", (S, S), (0, 0, 0, 0))
radial(0.5, 0.5, 0.47, (100, 130, 210, 255), (55, 60, 110, 255), sphere)
radial(0.68, 0.74, 0.34, (150, 110, 235, 235), (55, 60, 110, 0), sphere)
radial(0.34, 0.28, 0.30, (235, 240, 255, 245), (55, 60, 110, 0), sphere)

mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).ellipse([pad, pad, S - pad, S - pad], fill=255)
sphere.putalpha(Image.composite(sphere.split()[3], Image.new("L", (S, S), 0), mask))

glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse([pad - 40, pad - 40, S - pad + 40, S - pad + 40], fill=(90, 120, 220, 130))
glow = glow.filter(ImageFilter.GaussianBlur(46))

out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
out = Image.alpha_composite(out, glow)
out = Image.alpha_composite(out, sphere)

hi = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(hi).ellipse([S * 0.30, S * 0.24, S * 0.46, S * 0.38], fill=(255, 255, 255, 150))
hi = hi.filter(ImageFilter.GaussianBlur(18))
out = Image.alpha_composite(out, hi)

out.save("assets/appicon.png")
print("wrote assets/appicon.png", out.size)
