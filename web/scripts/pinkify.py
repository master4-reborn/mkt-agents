import sys, colorsys
from PIL import Image
src, dst, mode = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert('RGBA'); px = im.load(); w, h = im.size
def remap(r,g,b):
    H,L,S = colorsys.rgb_to_hls(r/255,g/255,b/255); hd = H*360
    if mode == 'food':   # keep desserts, only soften browns slightly
        return r,g,b
    if S < 0.22:         # greys, whites, beige stone -> pink-white, keep lightness but lift it
        L2 = min(0.97, 0.45 + L*0.55); return colorsys.hls_to_rgb(340/360, L2, 0.45)
    if hd < 15 or hd >= 330:  h2 = 345          # red -> rose
    elif hd < 50:  h2 = 352                        # orange/peach -> salmon pink
    elif hd < 75:  h2 = 44                         # yellow -> butter (keep)
    elif hd < 190: h2 = 162                        # green -> mint
    elif hd < 280: h2 = 268                        # blue -> lilac
    else:          h2 = 320                        # purple/magenta -> orchid
    L2 = min(0.9, 0.3 + L*0.75); S2 = min(0.85, S*0.9+0.1)
    return colorsys.hls_to_rgb(h2/360, L2, S2)
for y in range(h):
    for x in range(w):
        r,g,b,a = px[x,y]
        if a == 0: continue
        R,G,B = remap(r,g,b)
        if isinstance(R,float): R,G,B = int(R*255),int(G*255),int(B*255)
        px[x,y] = (R,G,B,a)
im.save(dst); print('wrote', dst)
