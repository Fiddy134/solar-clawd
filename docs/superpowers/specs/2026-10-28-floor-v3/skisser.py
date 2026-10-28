import random, sys

W, H, HZ = 1512, 982, 609
TEXT_END = 1112          # the 400 pt margin starts here
ROOM_X = 1040            # where the cutaway begins (under text up to TEXT_END)

def lerp(a, b, t): return a + (b - a) * t

def poly(pts, fill, extra=''):
    return f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="{fill}" {extra}/>'

def rect(x, y, w, h, fill, extra=''):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{fill}" {extra}/>'

def text(x, y, s, size, fill, extra=''):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size:.1f}" fill="{fill}" font-family="Menlo,monospace" {extra}>{s}</text>'

PAL = {
    'day': dict(sky0='#7FA6E6', sky1='#C8C4EC', tower='#9DB0D6', brick='#B0644C', sand='#D8C29A', brown='#8E5A4A',
                win='#5E6E9A', winlit='#5E6E9A', street='#B9AFA6', walk='#CFC6B8', nyse='#E6DCC4', shade='#B9AE96',
                wall='#EDE3CC', floor='#D9B98B', plank='#C4A272', post='#3E4660', canopy='#2C3247', haze=0.18),
    'eve': dict(sky0='#272A66', sky1='#C76D86', tower='#3A3F72', brick='#6E3A3A', sand='#7D6C60', brown='#53343A',
                win='#2E3158', winlit='#F2B95C', street='#4A4560', walk='#5A5470', nyse='#9C8F86', shade='#6F6466',
                wall='#E9C99A', floor='#C99A62', plank='#A97E4E', post='#2E3450', canopy='#232842', haze=0.30),
}

def sky(p, mood):
    out = [f'<defs><linearGradient id="sky{mood}" x1="0" y1="0" x2="0" y2="1">'
           f'<stop offset="0" stop-color="{p["sky0"]}"/><stop offset="1" stop-color="{p["sky1"]}"/></linearGradient></defs>',
           rect(0, 0, W, H, f'url(#sky{mood})')]
    if mood == 'day':
        out.append('<circle cx="330" cy="170" r="34" fill="#FFD27A"/><circle cx="330" cy="170" r="60" fill="#FFD27A" opacity="0.18"/>')
        for cx, cy in [(180, 110), (560, 220), (760, 90)]:
            out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="70" ry="16" fill="#F4E8F2" opacity="0.8"/>')
    else:
        out.append('<circle cx="300" cy="150" r="22" fill="#F3EBD2"/>')
        rnd = random.Random(3)
        for _ in range(60):
            out.append(f'<circle cx="{rnd.uniform(0, W)}" cy="{rnd.uniform(0, 380)}" r="1.1" fill="#F3EBD2" opacity="0.8"/>')
    return out

# The street runs from the bottom left toward a vanishing point by the
# exchange; its far side is a row of facades in perspective.
VP = (980, 600)
def ground(x): return lerp(800, VP[1], x / VP[0])
def top(x, k=0.0): return lerp(585, 592, x / VP[0]) - k * (ground(x) - lerp(585, 592, x / VP[0]))

def street(p, mood):
    out = []
    rnd = random.Random(7)
    # glass towers behind, hazed
    for x, w, t in [(0, 120, 470), (125, 95, 500), (230, 80, 525), (320, 70, 545), (400, 60, 560), (470, 50, 570), (530, 45, 578), (585, 40, 584)]:
        out.append(rect(x, t, w, 660 - t, p['tower'], 'opacity="0.75"'))
        for yy in range(int(t) + 8, 640, 14):
            for xx in range(int(x) + 6, int(x + w) - 6, 12):
                lit = mood == 'eve' and rnd.random() < 0.25
                out.append(rect(xx, yy, 5, 6, '#F2C46A' if lit else p['sky1'], f'opacity="{0.9 if lit else 0.25}"'))
    # far-side facades
    xs = [0, 150, 290, 410, 520, 620, 710, 790, 860]
    fills = [p['brick'], p['sand'], p['brown'], p['brick'], p['sand'], p['brick'], p['brown'], p['sand']]
    kicks = [0.15, 0.0, 0.25, 0.05, 0.2, 0.0, 0.1, 0.05]
    for i in range(len(xs) - 1):
        x0, x1 = xs[i], xs[i + 1]
        t0, t1 = top(x0, kicks[i]), top(x1, kicks[i])
        g0, g1 = ground(x0), ground(x1)
        out.append(poly([(x0, t0), (x1, t1), (x1, g1), (x0, g0)], fills[i]))
        out.append(f'<line x1="{x0}" y1="{t0:.1f}" x2="{x1}" y2="{t1:.1f}" stroke="#2A2440" stroke-width="2" opacity="0.5"/>')
        # windows on a bilinear grid; the ground floor left for the shop
        cols, rows = 3, 3
        for r in range(rows):
            for c in range(cols):
                u0, u1 = (c + 0.25) / cols, (c + 0.75) / cols
                v0, v1 = (r + 0.2) / (rows + 1.6), (r + 0.75) / (rows + 1.6)
                def at(u, v):
                    x = lerp(x0, x1, u)
                    return x, lerp(lerp(t0, t1, u), lerp(g0, g1, u), v)
                lit = mood == 'eve' and rnd.random() < 0.55
                out.append(poly([at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)], p['winlit'] if lit else p['win'],
                                'opacity="0.95"' if lit else 'opacity="0.7"'))
        # fire escape on the brick ones
        if fills[i] == p['brick']:
            for r in range(1, 3):
                v = r / 4.6
                a = (lerp(x0, x1, 0.55), lerp(lerp(t0, t1, 0.55), lerp(g0, g1, 0.55), v))
                b = (lerp(x0, x1, 0.95), lerp(lerp(t0, t1, 0.95), lerp(g0, g1, 0.95), v))
                out.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#1E1B2E" stroke-width="1.6"/>')
        # shopfront: a lit window and an awning
        sf = [(x0 + 6, lerp(t0, g0, 0.80)), (x1 - 6, lerp(t1, g1, 0.80)), (x1 - 6, g1 - 2), (x0 + 6, g0 - 2)]
        out.append(poly(sf, '#F6C770' if mood == 'eve' else '#7C88A8', 'opacity="0.9"'))
        aw = ['#2F5DA8', '#2E7A55', '#B23A3A', '#2F5DA8'][i % 4]
        out.append(poly([(x0 + 4, lerp(t0, g0, 0.76)), (x1 - 4, lerp(t1, g1, 0.76)), (x1 - 2, lerp(t1, g1, 0.83)), (x0 + 2, lerp(t0, g0, 0.83))], aw))
    # signs
    out.append(rect(330, 640, 16, 70, '#F4EEDF') + text(333, 655, 'P', 12, '#C0392B') + text(333, 668, 'I', 12, '#C0392B')
               + text(333, 681, 'Z', 12, '#C0392B') + text(333, 694, 'Z', 12, '#C0392B') + text(333, 707, 'A', 12, '#C0392B'))
    out.append(text(46, 724, 'TRADER\'S DELI', 12, '#F4EEDF', 'font-weight="bold"'))
    out.append(rect(180, 690, 82, 14, '#F0C419') + text(183, 701, 'CHECKS CASHED', 9, '#222'))
    # sidewalk and street
    out.append(poly([(0, 800), VP, (VP[0], VP[1] + 6), (0, 830)], p['walk']))
    out.append(poly([(0, 830), (VP[0], VP[1] + 6), (ROOM_X, 612), (ROOM_X, H), (0, H)], p['street']))
    for yy in range(640, H, 12):
        for xx in range(0, 960, 18):
            if yy > lerp(830, 606, xx / 980) + 4 and xx < lerp(1000, 760, (yy - 615) / (H - 615)):
                out.append(rect(xx + (yy // 12 % 2) * 9, yy, 7, 3, '#000', 'opacity="0.10"'))
    if mood == 'eve':
        for xx in [120, 300, 520, 700]:
            out.append(rect(xx, 820, 6, 150, '#F6C770', 'opacity="0.25"'))
    # taxis, a food cart, people, scaled by depth
    for x, s in [(380, 1.0), (640, 0.7), (810, 0.5)]:
        y = lerp(830, 606, x / 980) + 40 * s
        out.append(rect(x, y, 60 * s, 18 * s, '#F2C12E', f'rx="{4 * s}"') + rect(x + 14 * s, y - 9 * s, 30 * s, 10 * s, '#F2C12E', f'rx="{3 * s}"')
                   + f'<circle cx="{x + 12 * s}" cy="{y + 18 * s}" r="{5 * s}" fill="#222"/><circle cx="{x + 48 * s}" cy="{y + 18 * s}" r="{5 * s}" fill="#222"/>')
    out.append(rect(700, 700, 46, 34, '#D9D2C4') + rect(696, 690, 54, 10, '#B23A3A') + text(702, 722, 'COFFEE', 9, '#222'))
    if mood == 'eve':
        out.append('<ellipse cx="723" cy="680" rx="10" ry="18" fill="#FFF" opacity="0.25"/>')
    for x, s in [(90, 1.2), (250, 1.0), (470, 0.85), (600, 0.7), (760, 0.6), (880, 0.5), (920, 0.45)]:
        y = ground(x) + 4
        out.append(rect(x, y - 30 * s, 9 * s, 30 * s, '#2B2A44', f'rx="{4 * s}"') + f'<circle cx="{x + 4.5 * s}" cy="{y - 34 * s}" r="{4.5 * s}" fill="#2B2A44"/>')
    # string lights across the street, by evening
    if mood == 'eve':
        for x in [60, 230, 420, 610, 790]:
            ax, ay = x, top(x) + (ground(x) - top(x)) * 0.35
            bx, by = x - 260, 610 + (800 - x) * 0.05
            mx, my = (ax + bx) / 2, max(ay, by) + 50
            out.append(f'<path d="M{ax:.0f},{ay:.0f} Q{mx:.0f},{my:.0f} {bx:.0f},{by:.0f}" stroke="#2A2238" stroke-width="1" fill="none"/>')
            for k in range(1, 12):
                t = k / 12
                px = (1 - t) ** 2 * ax + 2 * (1 - t) * t * mx + t ** 2 * bx
                py = (1 - t) ** 2 * ay + 2 * (1 - t) * t * my + t ** 2 * by
                out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="2.4" fill="#FFD27A"/><circle cx="{px:.1f}" cy="{py:.1f}" r="6" fill="#FFD27A" opacity="0.25"/>')
    return out

def nyse(p, mood):
    out = []
    x0, x1, base = 770, 1040, 700
    out.append(rect(x0, 300, x1 - x0, base - 300, p['nyse']))
    out.append(poly([(x0 - 10, 312), ((x0 + x1) / 2, 262), (x1 + 10, 312)], p['nyse']))
    out.append(poly([(x0 + 20, 306), ((x0 + x1) / 2, 274), (x1 - 20, 306)], p['shade']))
    out.append(rect(x0 - 10, 312, x1 - x0 + 20, 26, p['shade']))
    out.append(text(x0 + 18, 330, 'NEW YORK STOCK EXCHANGE', 13, '#3B3346', 'font-weight="bold"'))
    for i in range(6):
        cx = lerp(x0 + 20, x1 - 40, i / 5)
        out.append(rect(cx, 345, 22, base - 360, p['wall'] if mood == 'day' else '#B9AA9C'))
        out.append(rect(cx + 7, 345, 3, base - 360, p['shade'], 'opacity="0.6"'))
    # the great flag between the middle columns
    fx, fy, fw, fh = 858, 360, 96, 170
    for k in range(13):
        out.append(rect(fx, fy + k * fh / 13, fw, fh / 13, '#B5323A' if k % 2 == 0 else '#F2ECE0'))
    out.append(rect(fx, fy, fw * 0.45, fh * 7 / 13, '#2D3B78'))
    # doors, lit
    for dx in [800, 905, 985]:
        out.append(rect(dx, 610, 30, 75, '#F6C770' if mood == 'eve' else '#5C4A3A'))
    out.append(rect(x0 - 20, base, x1 - x0 + 40, 10, p['shade']) + rect(x0 - 30, base + 10, x1 - x0 + 60, 10, p['nyse']))
    # Washington on his pedestal, in front of the steps
    out.append(rect(700, 700, 52, 80, p['shade']) + rect(694, 694, 64, 10, p['nyse']))
    out.append(rect(714, 610, 24, 84, '#3C3A3A', 'rx="6"') + '<circle cx="726" cy="602" r="10" fill="#3C3A3A"/>')
    out.append(rect(708, 640, 8, 40, '#3C3A3A', 'rx="3"'))
    # a haze over the entrance where the text runs
    out.append(poly([(x0 - 10, 312), ((x0 + x1) / 2, 262), (x1 + 10, 312), (x1, base + 20), (x0 - 30, base + 20)], p['sky1'], f'opacity="{p["haze"]}"'))
    return out

def entrance(p, mood):
    out = []
    rnd = random.Random(21)
    # far down the street, past the facades: hazed buildings at the vanishing point
    for x, w, t in [(860, 40, 560), (900, 30, 575), (930, 26, 585), (955, 30, 570), (985, 50, 545)]:
        out.append(rect(x, t, w, 615 - t, p['tower'], 'opacity="0.6"'))
    # the near sidewalk along the bottom, running into the exchange's doors
    out.append(poly([(0, 930), (ROOM_X, 892), (ROOM_X, H), (0, H)], p['walk']))
    out.append(f'<line x1="0" y1="930" x2="{ROOM_X}" y2="892" stroke="#2A2440" stroke-width="2" opacity="0.5"/>')
    # the exchange's own wall: sandstone, the whole height, at the cut
    out.append(rect(ROOM_X - 46, 0, 46, H, p['nyse']))
    for yy in range(0, H, 22):
        out.append(f'<line x1="{ROOM_X - 46}" y1="{yy}" x2="{ROOM_X}" y2="{yy}" stroke="{p["shade"]}" stroke-width="1"/>')
    # flags on poles out over the street
    for fy in [420, 560]:
        out.append(f'<line x1="{ROOM_X - 46}" y1="{fy}" x2="{ROOM_X - 150}" y2="{fy - 50}" stroke="#2A2440" stroke-width="2"/>')
        for k in range(7):
            out.append(rect(ROOM_X - 150, fy - 50 + k * 6, 60, 6, '#B5323A' if k % 2 == 0 else '#F2ECE0'))
        out.append(rect(ROOM_X - 150, fy - 50, 26, 24, '#2D3B78'))
    # a vertical NYSE sign on the wall
    out.append(rect(ROOM_X - 40, 640, 26, 120, '#20232C'))
    for i, ch in enumerate('NYSE'):
        out.append(text(ROOM_X - 34, 668 + i * 26, ch, 18, '#F2ECE0', 'font-weight="bold"'))
    # the canopy over the doors, and the sliding doors themselves: an opening
    # in the wall where the sidewalk becomes the hall's floor
    out.append(poly([(ROOM_X - 150, 800), (ROOM_X + 4, 788), (ROOM_X + 4, 806), (ROOM_X - 150, 818)], '#20232C'))
    out.append(text(ROOM_X - 132, 812, 'NEW YORK STOCK EXCHANGE', 9, '#F2ECE0'))
    lit = '#F6C770' if mood == 'eve' else '#D8E6F4'
    out.append(rect(ROOM_X - 46, 820, 56, 76, lit, 'opacity="0.85"'))
    out.append(rect(ROOM_X - 44, 822, 24, 72, '#9FB6CF', 'opacity="0.5"') + rect(ROOM_X - 16, 822, 24, 72, '#9FB6CF', 'opacity="0.5"'))
    out.append(f'<line x1="{ROOM_X - 18}" y1="820" x2="{ROOM_X - 18}" y2="896" stroke="#2A2440" stroke-width="2"/>')
    if mood == 'eve':
        out.append(poly([(ROOM_X - 46, 896), (ROOM_X + 10, 896), (ROOM_X - 60, 960), (ROOM_X - 170, 960)], '#F6C770', 'opacity="0.25"'))
    # Washington on his pedestal, by the curb
    out.append(rect(860, 860, 40, 60, p['shade']) + rect(855, 855, 50, 8, p['nyse']))
    out.append(rect(870, 790, 20, 66, '#3C3A3A', 'rx="5"') + '<circle cx="880" cy="783" r="8" fill="#3C3A3A"/>')
    # Clawds on the sidewalk, heading for the doors, one going in
    coats = ['#2F5DA8', '#B23A3A', '#2E7A55', '#E1B12C', '#6A4C93']
    for x in [120, 300, 470, 640, 780, 930]:
        y = lerp(930, 892, x / ROOM_X) + 34
        out.append(clawd(x, y, 1.9, rnd.choice(coats)))
    out.append(clawd(ROOM_X - 8, 905, 1.9, '#2E7A55'))
    return out

def clawd(x, y, s, coat):
    # Clawd in a trader's coat: the band's shape, scaled by depth
    return (rect(x - 9 * s, y - 14 * s, 18 * s, 10 * s, '#E07A5F') +
            rect(x - 12 * s, y - 10 * s, 3 * s, 4 * s, '#E07A5F') + rect(x + 9 * s, y - 10 * s, 3 * s, 4 * s, '#E07A5F') +
            rect(x - 5 * s, y - 12 * s, 2.4 * s, 2.6 * s, '#1F2350') + rect(x + 3 * s, y - 12 * s, 2.4 * s, 2.6 * s, '#1F2350') +
            rect(x - 9 * s, y - 5 * s, 18 * s, 4 * s, coat) +
            rect(x - 7 * s, y - 1 * s, 2.4 * s, 4 * s, '#1F2350') + rect(x + 4.6 * s, y - 1 * s, 2.4 * s, 4 * s, '#1F2350'))

def post(x, y, s, mood, n=None):
    out = []
    w = 120 * s
    # body, a screen band, the canopy with screens and an arm
    out.append(poly([(x - w / 2, y), (x + w / 2, y), (x + w / 2 - 10 * s, y - 50 * s), (x - w / 2 + 10 * s, y - 50 * s)], '#4A3A34'))
    for k in range(8):
        c = ['#5B8DEF', '#3DBB7E', '#E05A5A', '#5B8DEF'][k % 4]
        out.append(rect(x - w / 2 + 8 * s + k * 13 * s, y - 44 * s, 10 * s, 8 * s, c, 'opacity="0.9"'))
    out.append(rect(x - w / 2 + 14 * s, y - 120 * s, w - 28 * s, 60 * s, '#3A3F52'))
    out.append(rect(x - w / 2 + 6 * s, y - 150 * s, w - 12 * s, 32 * s, p_canopy[mood]))
    for k in range(5):
        out.append(rect(x - w / 2 + 14 * s + k * 19 * s, y - 144 * s, 15 * s, 10 * s, '#5B8DEF' if k % 2 else '#3DBB7E'))
    out.append(f'<line x1="{x + w / 2 - 14 * s:.1f}" y1="{y - 150 * s:.1f}" x2="{x + w / 2:.1f}" y2="{y - 185 * s:.1f}" stroke="#2A2E3E" stroke-width="{3 * s:.1f}"/>')
    out.append(rect(x + w / 2 - 6 * s, y - 198 * s, 22 * s, 15 * s, '#2A2E3E') + rect(x + w / 2 - 4 * s, y - 196 * s, 18 * s, 11 * s, '#5B8DEF'))
    if n:
        out.append(rect(x - 10 * s, y - 34 * s, 20 * s, 14 * s, '#C9A646') + text(x - 7 * s, y - 23 * s, str(n), 11 * s, '#2A2238', 'font-weight="bold"'))
    return out

p_canopy = {'day': '#2C3247', 'eve': '#232842'}

def room_high(p, mood):
    out = ['<clipPath id="room"><rect x="%d" y="0" width="%d" height="%d"/></clipPath>' % (ROOM_X, W - ROOM_X, H), '<g clip-path="url(#room)">']
    # the gilded coffered ceiling, receding toward the back wall
    out.append(rect(ROOM_X, 0, W - ROOM_X, 170, '#B88A3E' if mood == 'day' else '#8E6A3A'))
    for r, (y0, y1) in enumerate([(0, 52), (58, 100), (105, 138), (142, 166)]):
        n = 5 + r * 2
        for c in range(n):
            x0 = ROOM_X + 8 + c * (W - ROOM_X - 16) / n
            out.append(rect(x0 + 3, y0 + 3, (W - ROOM_X - 16) / n - 6, y1 - y0 - 6, '#D9B464' if mood == 'day' else '#B48A4E'))
            out.append(rect(x0 + 8, y0 + 8, (W - ROOM_X - 16) / n - 16, y1 - y0 - 16, '#E9CC86' if mood == 'day' else '#C9A060', 'opacity="0.8"'))
    out.append(rect(ROOM_X, 166, W - ROOM_X, 10, '#7A5A2E'))
    # back wall, tall arched windows onto the sky, the great flag, ticker
    out.append(rect(ROOM_X, 176, W - ROOM_X, 245, p['wall']))
    for wx in [1090, 1190, 1290, 1390]:
        out.append(f'<path d="M{wx},400 L{wx},250 A30,30 0 0 1 {wx + 60},250 L{wx + 60},400 Z" fill="{p["sky0"] if mood == "day" else "#2B2E6A"}"/>')
        out.append(f'<line x1="{wx + 30}" y1="222" x2="{wx + 30}" y2="400" stroke="{p["wall"]}" stroke-width="3"/>')
        out.append(f'<line x1="{wx}" y1="320" x2="{wx + 60}" y2="320" stroke="{p["wall"]}" stroke-width="3"/>')
    for k in range(13):
        out.append(rect(1250, 196 + k * 8, 70, 8, '#B5323A' if k % 2 == 0 else '#F2ECE0'))
    out.append(rect(1250, 196, 30, 56, '#2D3B78'))
    out.append(rect(ROOM_X, 405, W - ROOM_X, 16, '#1E2236'))
    for k in range(18):
        out.append(text(ROOM_X + 6 + k * 26, 417, ['▲', '▼'][k % 3 == 0], 10, '#3DBB7E' if k % 3 else '#E05A5A'))
    # the floor seen from the gallery, planks toward a point above
    out.append(rect(ROOM_X, 421, W - ROOM_X, H - 421, p['floor']))
    for k in range(-6, 22):
        bx = ROOM_X + k * 34
        out.append(f'<line x1="{bx}" y1="{H}" x2="{lerp(bx, 1290, 0.62):.1f}" y2="421" stroke="{p["plank"]}" stroke-width="1"/>')
    # NYSE cubes hanging from the ceiling, near ones bigger and lower
    for x, y, s in [(1150, 230, 0.6), (1420, 240, 0.6), (1300, 330, 0.85)]:
        out.append(f'<line x1="{x + 20 * s}" y1="170" x2="{x + 20 * s}" y2="{y}" stroke="#333" stroke-width="1"/>')
        out.append(f'<line x1="{x + 50 * s}" y1="170" x2="{x + 50 * s}" y2="{y}" stroke="#333" stroke-width="1"/>')
        out.append(rect(x, y, 70 * s, 40 * s, '#20232C') + text(x + 10 * s, y + 26 * s, 'NYSE', 16 * s, '#F2ECE0', 'font-weight="bold"'))
    rnd = random.Random(11)
    coats = ['#2F5DA8', '#B23A3A', '#2E7A55', '#E1B12C', '#6A4C93', '#1F2350']
    for (y, s, xs, nums) in [(470, 0.42, [1120, 1240, 1360, 1480], [7, 8, 9, 10]), (600, 0.65, [1080, 1260, 1440], [11, 12, 14]), (860, 1.05, [1160, 1470], [15, 16])]:
        for i, x in enumerate(xs):
            out += post(x, y, s, mood, nums[i])
        for _ in range(int(14 * (1.2 - s))):
            cx = rnd.uniform(ROOM_X + 20, W - 10)
            out.append(clawd(cx, y + rnd.uniform(18, 70) * s, 1.4 * s, rnd.choice(coats)))
    for _ in range(40):
        out.append(rect(rnd.uniform(ROOM_X, W), rnd.uniform(470, H), 5, 3, '#F6F1E4', 'opacity="0.9"'))
    out.append(rect(1250, 905, 120, 40, '#6B4A35') + rect(1300, 880, 6, 25, '#2E7A55') + poly([(1290, 880), (1316, 880), (1310, 870), (1296, 870)], '#3DBB7E'))
    out.append(clawd(1235, 935, 3.0, '#2F5DA8'))
    out.append(rect(1335, 358, 54, 18, '#2A2238') + text(1342, 371, 'HALT', 11, '#5A4D6A', 'font-weight="bold"'))
    if mood == 'eve':
        out.append(rect(ROOM_X, 0, W - ROOM_X, H, '#FFB35C', 'opacity="0.10"'))
    out.append('</g>')
    # the cut through the building, the whole height
    out.append(rect(ROOM_X - 8, 0, 10, H, '#2A2440'))
    return out

def room_eye(p, mood):
    out = ['<clipPath id="room2"><rect x="%d" y="160" width="%d" height="%d"/></clipPath>' % (ROOM_X, W - ROOM_X, H - 160), '<g clip-path="url(#room2)">']
    vp = (1290, 560)
    out.append(rect(ROOM_X, 160, W - ROOM_X, 420, p['wall']))
    for wx in [1080, 1230, 1380]:
        out.append(f'<path d="M{wx},540 L{wx},300 A45,45 0 0 1 {wx + 90},300 L{wx + 90},540 Z" fill="{p["sky0"] if mood == "day" else "#2B2E6A"}"/>')
        out.append(f'<line x1="{wx + 45}" y1="255" x2="{wx + 45}" y2="540" stroke="{p["wall"]}" stroke-width="4"/>')
        out.append(f'<line x1="{wx}" y1="420" x2="{wx + 90}" y2="420" stroke="{p["wall"]}" stroke-width="4"/>')
    for k in range(13):
        out.append(rect(1180, 180 + k * 10, 110, 10, '#B5323A' if k % 2 == 0 else '#F2ECE0'))
    out.append(rect(1180, 180, 48, 70, '#2D3B78'))
    out.append(poly([(ROOM_X, 560), (W, 560), (W, H), (ROOM_X, H)], p['floor']))
    for k in range(-10, 26):
        bx = ROOM_X + k * 40
        out.append(f'<line x1="{bx}" y1="{H}" x2="{lerp(bx, vp[0], 0.85):.1f}" y2="560" stroke="{p["plank"]}" stroke-width="1"/>')
    for x, y, s in [(1110, 220, 0.9), (1400, 230, 0.9)]:
        out.append(rect(x, y, 80 * s, 48 * s, '#20232C') + text(x + 10 * s, y + 31 * s, 'NYSE', 19 * s, '#F2ECE0', 'font-weight="bold"'))
    rnd = random.Random(5)
    coats = ['#2F5DA8', '#B23A3A', '#2E7A55', '#E1B12C', '#6A4C93', '#1F2350']
    for (y, s, xs, nums) in [(600, 0.6, [1130, 1330], [9, 10]), (700, 0.9, [1050, 1460], [11, 12]), (980, 1.6, [1220], [14])]:
        for _ in range(int(9 * (1.7 - s))):
            out.append(clawd(rnd.uniform(ROOM_X + 20, W - 10), y + rnd.uniform(-10, 30) * s, 2.0 * s, rnd.choice(coats)))
        for i, x in enumerate(xs):
            out += post(x, y, s, mood, nums[i])
    for _ in range(30):
        out.append(rect(rnd.uniform(ROOM_X, W), rnd.uniform(580, H), 6, 3, '#F6F1E4'))
    out.append(clawd(1420, 960, 3.6, '#2F5DA8'))
    out.append(rect(1290, 520, 64, 22, '#2A2238') + text(1298, 536, 'HALT', 14, '#5A4D6A', 'font-weight="bold"'))
    if mood == 'eve':
        out.append(rect(ROOM_X, 160, W - ROOM_X, H - 160, '#FFB35C', 'opacity="0.10"'))
    out.append('</g>')
    out.append(rect(ROOM_X - 8, 160, 10, H - 160, '#2A2440'))
    return out

LINES = [
    '⏺ Read docs/superpowers/HANDOFF.md', '  ⎿  Read 64 lines', '',
    '⏺ The floor theme draws its posts in three depth bands, far to near, and the crowd',
    '  between them hashed per cell on the floor plane; the resident keeps his desk at the front.', '',
    '⏺ Bash(tools/theme/run.sh lint themes/floor)',
    '  ⎿  floor: GLSL 61203 of 80000 characters / the stage 400 points wide / clean', '',
    '⏺ Update(themes/floor/theme.glsl)', '  ⎿  Updated themes/floor/theme.glsl with 42 additions and 9 removals',
    '     212 +  vec3 street(vec3 sky, vec2 p, float u) {', '     213 +    // Wall Street toward its vanishing point by the exchange', '',
    '| Scene      | Ratio | Verdict |', '|------------|-------|---------|', '| day-clear  | 0.84  | pass    |', '| night-lit  | 0.91  | pass    |', '',
    '⏺ The sheet is in .preview/theme-floor/; the bell at the open reads from across the hall, and the',
    '  string lights over Stone Street come on at dusk.',
]

def terminal(mood):
    out = []
    col = '#F4F2FA'
    for i, s in enumerate(LINES):
        out.append(text(22, 40 + i * 22, s.replace('&', '&amp;').replace('<', '&lt;'), 14.5, col,
                        'style="paint-order:stroke" stroke="#1F2350" stroke-opacity="0.25" stroke-width="2"'))
    # the band and the prompt, as in Vincent's screenshot
    out.append(text(760, 850, '14:02  workin\'', 15, col) + text(720, 872, 'Linköping · 13°C clear', 15, col))
    out.append(rect(965, 838, 30, 16, '#E07A5F') + rect(971, 842, 4, 4, '#1F2350') + rect(983, 842, 4, 4, '#1F2350'))
    out.append(f'<line x1="0" y1="900" x2="{TEXT_END}" y2="900" stroke="{col}" stroke-opacity="0.6"/>')
    out.append(text(22, 926, '&gt; ', 15, col) + rect(44, 912, 9, 18, col))
    out.append(f'<line x1="0" y1="944" x2="{TEXT_END}" y2="944" stroke="{col}" stroke-opacity="0.6"/>')
    # where the margin begins
    out.append(f'<line x1="{TEXT_END}" y1="0" x2="{TEXT_END}" y2="{H}" stroke="#FF5FA2" stroke-width="1.5" stroke-dasharray="6,6" opacity="0.8"/>')
    out.append(text(TEXT_END + 6, 18, 'marginalen börjar (400 pt)', 12, '#FF5FA2'))
    out.append(f'<line x1="{W / 2}" y1="0" x2="{W / 2}" y2="{H}" stroke="#FFFFFF" stroke-width="1" stroke-dasharray="2,8" opacity="0.6"/>')
    out.append(text(W / 2 + 6, 18, 'halva fönstret', 12, '#FFFFFF', 'opacity="0.8"'))
    return out

def scene(room, mood, with_text=True):
    p = PAL[mood]
    parts = sky(p, mood) + street(p, mood) + room(p, mood) + entrance(p, mood)
    if with_text:
        parts += terminal(mood)
    return f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:6px">' + ''.join(parts) + '</svg>'

cards = [
    ('a', 'A · Läktaren, dag', 'Golvet snett ovanifrån som på din första NYSE-bild: bakväggen med valvfönster och flaggan överst, posterna i tre rader bakåt, Clawdar mellan dem, huvud-Clawd vid sin lampa längst fram. Ute: Wall Street i gatuhöjd mot NYSE:s kolonner, Washington-statyn framför trappan.', scene(room_high, 'day')),
    ('b', 'A · Läktaren, kväll', 'Samma bild en kväll: ljusslingor över gatan (Stone Street), tända fönster och butiker, kullersten som glimmar, varmt ljus inne i salen och tända dörrar i entrén.', scene(room_high, 'eve')),
    #('c', 'B · Ögonhöjd, dag', 'Som din andra bild: man står på golvet. Färre men större poster, höga valvfönster, golvet i stark perspektivlinje mot bakväggen. Mer närhet till Clawdarna, mindre överblick.', scene(room_eye, 'day')),
]

html = ['<h2>Börsgolvet v3 – skiss A, version 3: gatan går in genom dörrarna</h2>',
        '<p class="subtitle">Grova kompositionsskisser, platta former, inte husstilen. Den rosa streckade linjen är där marginalen börjar (texten slutar), den vita prickade är halva fönstret. Klicka på den riktning som känns rätt; säg vad som ska ändras i terminalen.</p>',
        '<div class="options">']
for key, title, desc, svg in cards:
    html.append(f'<div class="option" data-choice="{key}" onclick="toggleSelect(this)" style="flex-direction:column;align-items:stretch">'
                f'<div style="display:flex;gap:12px;align-items:center"><div class="letter">{key.upper()}</div><div class="content"><h3>{title}</h3><p>{desc}</p></div></div>'
                f'<div style="margin-top:10px">{svg}</div></div>')
html.append('</div>')
open(sys.argv[1], 'w').write('\n'.join(html))

# --- Version 4: one camera for the whole block, a dollhouse cut ---------
BACK = 540            # where the ground meets the far facades and the back wall
CAM = (1000, 170)     # the one vanishing point every depth line runs to
CUT = 1040            # the wall between the street and the hall

def depth(y): return max(0.15, (y - CAM[1]) / (H - CAM[1]))

def toward(x, y_from, y_to):
    # where a depth line through (x, y_from) lies at y_to
    t = (y_to - CAM[1]) / (y_from - CAM[1])
    return CAM[0] + (x - CAM[0]) * t

def street4(p, mood):
    out = []
    rnd = random.Random(31)
    # glass towers behind the far facades
    for x, w, t in [(0, 110, 330), (120, 90, 360), (230, 120, 340), (370, 80, 370), (470, 100, 350), (600, 90, 375), (710, 120, 345), (850, 100, 365), (960, 70, 380)]:
        out.append(rect(x, t, w, BACK - t, p['tower'], 'opacity="0.7"'))
        for yy in range(t + 8, BACK - 100, 14):
            for xx in range(x + 6, x + w - 6, 12):
                lit = mood == 'eve' and rnd.random() < 0.25
                out.append(rect(xx, yy, 5, 6, '#F2C46A' if lit else p['sky1'], f'opacity="{0.9 if lit else 0.25}"'))
    # the far side of the street, facing us
    xs = [0, 130, 250, 360, 480, 590, 700, 820, 930, CUT - 40]
    fills = [p['brick'], p['sand'], p['brown'], p['brick'], p['sand'], p['brick'], p['brown'], p['sand'], p['brick']]
    tops = [400, 430, 385, 420, 440, 395, 425, 410, 435]
    signs = ["TRADER'S DELI", 'CHECKS CASHED', 'PIZZA', 'BAGELS', 'WESTERN UNION', 'DINER', 'SHOE SHINE', 'NEWS', 'BAR']
    for i in range(len(xs) - 1):
        x0, x1, t = xs[i], xs[i + 1], tops[i]
        out.append(rect(x0, t, x1 - x0, BACK - t, fills[i]))
        out.append(rect(x0, t - 6, x1 - x0, 6, '#2A2440', 'opacity="0.4"'))
        for r in range(3):
            for c in range(3):
                lit = mood == 'eve' and rnd.random() < 0.55
                out.append(rect(x0 + 12 + c * (x1 - x0 - 24) / 3, t + 12 + r * 26, (x1 - x0 - 24) / 3 - 10, 16,
                                p['winlit'] if lit else p['win'], 'opacity="0.9"'))
        if fills[i] == p['brick']:
            for r in range(3):
                out.append(f'<line x1="{x0 + (x1 - x0) * 0.5}" y1="{t + 32 + r * 26}" x2="{x1 - 8}" y2="{t + 32 + r * 26}" stroke="#1E1B2E" stroke-width="2"/>')
        out.append(rect(x0 + 6, BACK - 46, x1 - x0 - 12, 44, '#F6C770' if mood == 'eve' else '#7C88A8', 'opacity="0.9"'))
        aw = ['#2F5DA8', '#2E7A55', '#B23A3A', '#E1B12C'][i % 4]
        out.append(poly([(x0 + 4, BACK - 52), (x1 - 4, BACK - 52), (x1, BACK - 40), (x0, BACK - 40)], aw))
        out.append(text(x0 + 8, BACK - 56, signs[i], 9, '#F4EEDF', 'font-weight="bold"'))
    # the far sidewalk, the street, the near sidewalk: one ground plane
    out.append(rect(0, BACK, CUT, 40, p['walk']))
    out.append(rect(0, BACK + 40, CUT, 260, p['street']))
    out.append(rect(0, BACK + 300, CUT, H - BACK - 300, p['walk']))
    for y in [BACK + 40, BACK + 300]:
        out.append(f'<line x1="0" y1="{y}" x2="{CUT}" y2="{y}" stroke="#2A2440" stroke-width="2" opacity="0.5"/>')
    for x in range(-400, CUT + 400, 70):
        out.append(f'<line x1="{toward(x, H, BACK + 40):.1f}" y1="{BACK + 40}" x2="{toward(x, H, BACK + 300):.1f}" y2="{BACK + 300}" stroke="#000" stroke-width="1" opacity="0.06"/>')
    for x in range(0, CUT, 60):
        out.append(rect(x, BACK + 170, 30, 4, '#F2ECE0', 'opacity="0.5"'))
    if mood == 'eve':
        for x in range(30, CUT, 130):
            out.append(rect(x, BACK + 60, 10, 260, '#F6C770', 'opacity="0.18"'))
    # taxis and a cart, driving across, bigger nearer
    for x, y in [(140, BACK + 100), (520, BACK + 130), (780, BACK + 220)]:
        s = depth(y) * 1.6
        out.append(rect(x, y, 70 * s, 20 * s, '#F2C12E', f'rx="{4 * s}"') + rect(x + 16 * s, y - 11 * s, 36 * s, 12 * s, '#F2C12E', f'rx="{3 * s}"')
                   + f'<circle cx="{x + 14 * s}" cy="{y + 20 * s}" r="{5 * s}" fill="#222"/><circle cx="{x + 56 * s}" cy="{y + 20 * s}" r="{5 * s}" fill="#222"/>')
    out.append(rect(640, BACK + 2, 40, 30, '#D9D2C4') + rect(636, BACK - 6, 48, 9, '#B23A3A') + text(642, BACK + 22, 'COFFEE', 8, '#222'))
    # Washington on the far sidewalk, Federal Hall's side of the street
    out.append(rect(300, BACK - 4, 30, 40, p['shade']) + rect(306, BACK - 54, 18, 52, '#3C3A3A', 'rx="4"') + '<circle cx="315" cy="482" r="7" fill="#3C3A3A"/>')
    # string lights in swags between lamp posts along the far sidewalk, by evening
    posts = list(range(20, CUT - 20, 120))
    for x in posts:
        out.append(rect(x, BACK - 70, 3, 100, '#2A2238'))
    if mood == 'eve':
        for a, b in zip(posts, posts[1:]):
            for sag, yy in [(26, BACK - 70), (18, BACK - 40)]:
                mx, my = (a + b) / 2, yy + sag
                out.append(f'<path d="M{a},{yy} Q{mx},{my} {b},{yy}" stroke="#2A2238" stroke-width="1" fill="none"/>')
                for k in range(1, 8):
                    t = k / 8
                    px = (1 - t) ** 2 * a + 2 * (1 - t) * t * mx + t ** 2 * b
                    py = (1 - t) ** 2 * yy + 2 * (1 - t) * t * my + t ** 2 * yy
                    out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="2.2" fill="#FFD27A"/><circle cx="{px:.1f}" cy="{py:.1f}" r="6" fill="#FFD27A" opacity="0.22"/>')
    # Clawds on both sidewalks, the near ones walking to the doors
    coats = ['#2F5DA8', '#B23A3A', '#2E7A55', '#E1B12C', '#6A4C93']
    for x in [80, 420, 760]:
        out.append(clawd(x, BACK + 34, 1.6 * depth(BACK + 34), rnd.choice(coats)))
    for x in [100, 280, 470, 650, 830, 980]:
        out.append(clawd(x, 950, 2.2, rnd.choice(coats)))
    return out

def room4(p, mood):
    out = [f'<clipPath id="room4"><rect x="{CUT}" y="0" width="{W - CUT}" height="{H}"/></clipPath>', '<g clip-path="url(#room4)">']
    out.append(rect(CUT, 0, W - CUT, 300, '#B88A3E' if mood == 'day' else '#8E6A3A'))
    for r, (y0, y1) in enumerate([(0, 70), (76, 140), (146, 200), (206, 250), (256, 292)]):
        n = 4 + r * 2
        for c in range(n):
            x0 = CUT + 6 + c * (W - CUT - 12) / n
            out.append(rect(x0 + 3, y0 + 3, (W - CUT - 12) / n - 6, y1 - y0 - 6, '#D9B464' if mood == 'day' else '#B48A4E'))
    out.append(rect(CUT, 292, W - CUT, 10, '#7A5A2E'))
    out.append(rect(CUT, 302, W - CUT, BACK - 302, p['wall']))
    for wx in [1080, 1180, 1280, 1380]:
        out.append(f'<path d="M{wx},{BACK - 30} L{wx},365 A30,30 0 0 1 {wx + 60},365 L{wx + 60},{BACK - 30} Z" fill="{p["sky0"] if mood == "day" else "#2B2E6A"}"/>')
        out.append(f'<line x1="{wx + 30}" y1="335" x2="{wx + 30}" y2="{BACK - 30}" stroke="{p["wall"]}" stroke-width="3"/>')
    for k in range(13):
        out.append(rect(1250, 312 + k * 7, 66, 7, '#B5323A' if k % 2 == 0 else '#F2ECE0'))
    out.append(rect(1250, 312, 28, 49, '#2D3B78'))
    out.append(rect(CUT, BACK - 16, W - CUT, 16, '#1E2236'))
    for k in range(18):
        out.append(text(CUT + 6 + k * 26, BACK - 4, ['▲', '▼'][k % 3 == 0], 10, '#3DBB7E' if k % 3 else '#E05A5A'))
    out.append(rect(CUT, BACK, W - CUT, H - BACK, p['floor']))
    for x in range(CUT - 600, W + 600, 34):
        out.append(f'<line x1="{x}" y1="{H}" x2="{toward(x, H, BACK):.1f}" y2="{BACK}" stroke="{p["plank"]}" stroke-width="1"/>')
    for x, y, s in [(1120, 340, 0.55), (1420, 350, 0.55), (1290, 420, 0.8)]:
        out.append(f'<line x1="{x + 20 * s}" y1="300" x2="{x + 20 * s}" y2="{y}" stroke="#333" stroke-width="1"/><line x1="{x + 50 * s}" y1="300" x2="{x + 50 * s}" y2="{y}" stroke="#333" stroke-width="1"/>')
        out.append(rect(x, y, 70 * s, 40 * s, '#20232C') + text(x + 10 * s, y + 26 * s, 'NYSE', 16 * s, '#F2ECE0', 'font-weight="bold"'))
    rnd = random.Random(13)
    coats = ['#2F5DA8', '#B23A3A', '#2E7A55', '#E1B12C', '#6A4C93', '#1F2350']
    for (y, xs, nums) in [(600, [1110, 1230, 1350, 1470], [7, 8, 9, 10]), (720, [1090, 1270, 1450], [11, 12, 14]), (900, [1190, 1480], [15, 16])]:
        s = depth(y) * 1.3
        for _ in range(int(10 * (1.6 - s))):
            out.append(clawd(rnd.uniform(CUT + 20, W - 10), y + rnd.uniform(14, 60) * s, 1.4 * s, rnd.choice(coats)))
        for i, x in enumerate(xs):
            out += post(x, y, s, mood, nums[i])
    for _ in range(40):
        out.append(rect(rnd.uniform(CUT, W), rnd.uniform(BACK + 20, H), 5, 3, '#F6F1E4', 'opacity="0.9"'))
    out.append(rect(1300, 920, 120, 40, '#6B4A35') + rect(1350, 895, 6, 25, '#2E7A55') + poly([(1340, 895), (1366, 895), (1360, 885), (1346, 885)], '#3DBB7E'))
    out.append(clawd(1285, 955, 2.8, '#2F5DA8'))
    out.append(rect(1330, 455, 54, 18, '#2A2238') + text(1337, 468, 'HALT', 11, '#5A4D6A', 'font-weight="bold"'))
    # the near sidewalk carries on through the doorway as a mat
    out.append(rect(CUT, 880, 90, H - 880, '#8C7B66', 'opacity="0.5"'))
    out.append(clawd(CUT + 40, 950, 2.2, '#2E7A55'))
    if mood == 'eve':
        out.append(rect(CUT, 0, W - CUT, H, '#FFB35C', 'opacity="0.10"'))
    out.append('</g>')
    # the wall between, cut: solid down to the doorway, sliding doors in it
    out.append(rect(CUT - 10, 0, 14, 860, p['nyse']) + rect(CUT - 10, 0, 3, 860, '#2A2440', 'opacity="0.6"') + rect(CUT + 1, 0, 3, 860, '#2A2440', 'opacity="0.6"'))
    out.append(rect(CUT - 70, 120, 56, 22, '#20232C') + text(CUT - 64, 136, 'NYSE', 15, '#F2ECE0', 'font-weight="bold"'))
    for fy in [200, 300]:
        out.append(f'<line x1="{CUT - 10}" y1="{fy}" x2="{CUT - 100}" y2="{fy - 40}" stroke="#2A2440" stroke-width="2"/>')
        for k in range(7):
            out.append(rect(CUT - 100, fy - 40 + k * 6, 56, 6, '#B5323A' if k % 2 == 0 else '#F2ECE0'))
        out.append(rect(CUT - 100, fy - 40, 24, 24, '#2D3B78'))
    out.append(poly([(CUT - 130, 846), (CUT + 6, 846), (CUT + 6, 860), (CUT - 120, 864)], '#20232C') + text(CUT - 122, 858, 'NEW YORK STOCK EXCHANGE', 7, '#F2ECE0'))
    lit = '#F6C770' if mood == 'eve' else '#D8E6F4'
    out.append(rect(CUT - 10, 864, 14, H - 864, lit, 'opacity="0.6"'))
    out.append(rect(CUT - 30, 870, 20, 100, '#9FB6CF', 'opacity="0.55"') + rect(CUT + 4, 870, 20, 100, '#9FB6CF', 'opacity="0.55"'))
    return out

def scene4(mood, with_text=True):
    p = PAL[mood]
    parts = sky(p, mood) + street4(p, mood) + room4(p, mood)
    if with_text:
        parts += terminal(mood)
    return f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:6px">' + ''.join(parts) + '</svg>'

if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[2] == 'v4':
    html = ['<h2>Börsgolvet v3 – skiss A, version 4: en kamera, gatan parallell med salen</h2>',
            '<p class="subtitle">Ett dockskåp i genomskärning, sett snett ovanifrån: fasaderna på andra sidan gatan i samma djup som salens bakvägg, gatan i mitten, trottoaren längst fram som fortsätter genom dörrarna och blir golvet. Ett och samma markplan.</p>',
            '<div class="options">']
    for key, title, mood in [('d', 'Dag', 'day'), ('e', 'Kväll', 'eve')]:
        html.append(f'<div class="option" data-choice="{key}" onclick="toggleSelect(this)" style="flex-direction:column;align-items:stretch">'
                    f'<div style="display:flex;gap:12px;align-items:center"><div class="letter">{key.upper()}</div><div class="content"><h3>{title}</h3></div></div>'
                    f'<div style="margin-top:10px">{scene4(mood)}</div></div>')
    html.append('</div>')
    open(sys.argv[1], 'w').write('\n'.join(html))

# --- Version 5: three-quarter top-down, Stardew / Pokémon Ruby -----------
# No vanishing point: the ground is seen from above, every wall and thing
# front-on with its top showing; nearer is lower, and lower draws on top.
G = 520               # the far facades' foot: the ground begins here
T = 24                # one tile

def tilefloor(x0, y0, x1, y1, base, line, op=0.35):
    out = [rect(x0, y0, x1 - x0, y1 - y0, base)]
    for y in range(y0, y1, T):
        out.append(f'<line x1="{x0}" y1="{y}" x2="{x1}" y2="{y}" stroke="{line}" stroke-width="1" opacity="{op}"/>')
        off = 0 if (y // T) % 2 else T // 2
        for x in range(x0 + off, x1, T * 2):
            out.append(f'<line x1="{x}" y1="{y}" x2="{x}" y2="{min(y + T, y1)}" stroke="{line}" stroke-width="1" opacity="{op}"/>')
    return out

def box(x, y, w, h, top_h, front, top, edge='#2A2440'):
    # a thing in three-quarter view: its top face above its front face; (x, y) is its front foot
    return (rect(x, y - h - top_h, w, top_h, top) + rect(x, y - h, w, h, front) +
            f'<rect x="{x}" y="{y - h - top_h}" width="{w}" height="{h + top_h}" fill="none" stroke="{edge}" stroke-width="1.5" opacity="0.6"/>')

def town5(p, mood):
    out = []
    rnd = random.Random(41)
    # far towers, low and hazed, above the row
    for x, w, t in [(0, 90, 400), (100, 70, 420), (190, 110, 395), (320, 80, 425), (420, 100, 405), (540, 70, 430), (630, 110, 400), (760, 80, 420), (860, 120, 410)]:
        out.append(rect(x, t, w, 460 - t, p['tower'], 'opacity="0.6"'))
    # the row of facades across the top of the street, front-on, roofs showing
    xs = [0, 120, 230, 330, 450, 560, 660, 780, 890, 1000]
    fills = [p['brick'], p['sand'], p['brown'], p['brick'], p['sand'], p['brick'], p['brown'], p['sand'], p['brick']]
    signs = ["DELI", 'CHECKS', 'PIZZA', 'BAGELS', 'W.UNION', 'DINER', 'SHINE', 'NEWS', 'BAR']
    for i in range(len(xs) - 1):
        x0, x1 = xs[i], xs[i + 1]
        t = 430 + (i * 17) % 30
        out.append(rect(x0, t - 10, x1 - x0, 10, '#4A3A4A'))                 # the roof's edge seen from above
        out.append(rect(x0, t, x1 - x0, G - t, fills[i]))
        for c in range(3):
            lit = mood == 'eve' and rnd.random() < 0.6
            out.append(rect(x0 + 10 + c * (x1 - x0 - 20) / 3, t + 10, (x1 - x0 - 20) / 3 - 8, 18, p['winlit'] if lit else p['win']))
        out.append(rect(x0 + 6, G - 34, x1 - x0 - 12, 32, '#F6C770' if mood == 'eve' else '#7C88A8'))
        aw = ['#2F5DA8', '#2E7A55', '#B23A3A', '#E1B12C'][i % 4]
        for k in range(0, x1 - x0 - 8, 12):
            out.append(rect(x0 + 4 + k, G - 42, 12, 10, aw if (k // 12) % 2 == 0 else '#F2ECE0'))
        out.append(text(x0 + 8, t + 44, signs[i], 9, '#F4EEDF', 'font-weight="bold"'))
    # the ground: sidewalk, a quiet street, a wide sidewalk where the text lives
    walk = '#8A879C' if mood == 'day' else p['walk']
    road = '#6E6C80' if mood == 'day' else p['street']
    out += tilefloor(0, G, CUT, G + 30, walk, '#2A2440', 0.25)
    out.append(rect(0, G + 30, CUT, 130, road))
    for x in range(0, CUT, 60):
        out.append(rect(x, G + 93, 30, 4, '#F2ECE0', 'opacity="0.45"'))
    out += tilefloor(0, G + 160, CUT, H, walk, '#2A2440', 0.15)
    out.append(rect(0, G + 160, CUT, 5, '#2A2440', 'opacity="0.4"'))
    # lamp posts and, by evening, lights strung between them
    lamps = list(range(40, CUT - 40, 140))
    for x in lamps:
        out.append(rect(x, G - 60, 4, 70, '#2A2238') + rect(x - 4, G - 66, 12, 8, '#F6C770' if mood == 'eve' else '#3A3F52'))
    if mood == 'eve':
        for a, b in zip(lamps, lamps[1:]):
            mx, my = (a + b) / 2, G - 40
            out.append(f'<path d="M{a},{G - 60} Q{mx},{my} {b},{G - 60}" stroke="#2A2238" stroke-width="1" fill="none"/>')
            for k in range(1, 8):
                t = k / 8
                px = (1 - t) ** 2 * a + 2 * (1 - t) * t * mx + t ** 2 * b
                py = (1 - t) ** 2 * (G - 60) + 2 * (1 - t) * t * my + t ** 2 * (G - 60)
                out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="2.2" fill="#FFD27A"/><circle cx="{px:.1f}" cy="{py:.1f}" r="6" fill="#FFD27A" opacity="0.22"/>')
    # taxis in three-quarter view: roof on top, side below
    for x, y in [(120, G + 75), (520, G + 130), (820, G + 75)]:
        out.append(box(x, y, 64, 16, 18, '#E0AE22', '#F2C12E') + rect(x + 22, y - 30, 20, 6, '#F4EEDF')
                   + rect(x + 6, y - 4, 10, 6, '#222') + rect(x + 48, y - 4, 10, 6, '#222'))
    # a coffee cart and Washington on the far sidewalk
    out.append(box(600, G + 26, 40, 20, 12, '#D9D2C4', '#B23A3A') + text(603, G + 20, 'COFFEE', 8, '#222'))
    out.append(box(300, G + 28, 28, 16, 8, p['shade'], p['nyse']) + rect(306, G - 34, 16, 34, '#3C3A3A', 'rx="3"') + '<circle cx="314" cy="480" r="6" fill="#3C3A3A"/>')
    # Clawds on the wide sidewalk and the far one, walking to the doors
    coats = ['#2F5DA8', '#B23A3A', '#2E7A55', '#E1B12C', '#6A4C93']
    for x, y in [(90, G + 22), (420, G + 24), (760, G + 22)]:
        out.append(clawd(x, y, 1.3, rnd.choice(coats)))
    for x, y in [(160, 780), (380, 860), (560, 760), (740, 830), (900, 790), (990, 812)]:
        out.append(clawd(x, y, 1.9, rnd.choice(coats)))
    return out

def hall5(p, mood):
    out = []
    # the exchange's own crown, front-on, above its back wall (the roof is lifted off)
    out.append(rect(CUT, 40, W - CUT, 20, p['shade']))
    out.append(poly([(CUT, 40), ((CUT + W) / 2, 6), (W, 40)], p['nyse']))
    out.append(rect(CUT, 60, W - CUT, 26, p['nyse']) + text(CUT + 60, 79, 'NEW YORK STOCK EXCHANGE', 14, '#3B3346', 'font-weight="bold"'))
    # the back wall's inside, arched windows onto the sky, the flag, the ticker
    out.append(rect(CUT, 86, W - CUT, 360, p['wall']))
    for wx in [1080, 1180, 1280, 1380]:
        out.append(f'<path d="M{wx},400 L{wx},170 A30,30 0 0 1 {wx + 60},170 L{wx + 60},400 Z" fill="{p["sky0"] if mood == "day" else "#2B2E6A"}"/>')
        out.append(f'<line x1="{wx + 30}" y1="140" x2="{wx + 30}" y2="400" stroke="{p["wall"]}" stroke-width="3"/>')
        out.append(f'<line x1="{wx}" y1="270" x2="{wx + 60}" y2="270" stroke="{p["wall"]}" stroke-width="3"/>')
    for k in range(13):
        out.append(rect(1246, 110 + k * 9, 74, 9, '#B5323A' if k % 2 == 0 else '#F2ECE0'))
    out.append(rect(1246, 110, 32, 63, '#2D3B78'))
    out.append(rect(CUT, 410, W - CUT, 18, '#1E2236'))
    for k in range(18):
        out.append(text(CUT + 6 + k * 26, 423, ['▲', '▼'][k % 3 == 0], 10, '#3DBB7E' if k % 3 else '#E05A5A'))
    out.append(rect(CUT, 428, W - CUT, 18, '#B9AE96'))                     # the wainscot's top
    # the floor from above, boards in a grid
    out += tilefloor(CUT, 446, W, H, p['floor'], p['plank'], 0.55)
    # hanging NYSE cubes, seen as the box they are
    for x, y in [(1110, 210), (1400, 220), (1255, 300)]:
        out.append(f'<line x1="{x + 14}" y1="86" x2="{x + 14}" y2="{y - 52}" stroke="#333"/><line x1="{x + 46}" y1="86" x2="{x + 46}" y2="{y - 52}" stroke="#333"/>')
        out.append(box(x, y, 60, 34, 12, '#20232C', '#3A3E4C') + text(x + 9, y - 10, 'NYSE', 15, '#F2ECE0', 'font-weight="bold"'))
    # posts in three-quarter view: a top with its monitors, a front with its screen band
    rnd = random.Random(17)
    coats = ['#2F5DA8', '#B23A3A', '#2E7A55', '#E1B12C', '#6A4C93', '#1F2350']
    things = []
    for y, xs in [(560, [1080, 1220, 1360]), (720, [1140, 1300, 1450]), (880, [1080, 1230, 1380])]:
        for x in xs:
            things.append((y, 'post', x))
    for _ in range(26):
        things.append((rnd.uniform(470, 960), 'clawd', rnd.uniform(CUT + 16, W - 16)))
    things.append((955, 'resident', 1300))
    for y, kind, x in sorted(things):
        if kind == 'post':
            out.append(box(x, y, 92, 40, 30, '#4A3A34', '#3A3F52'))
            for k in range(6):
                out.append(rect(x + 6 + k * 14, y - 34, 10, 10, ['#5B8DEF', '#3DBB7E', '#E05A5A'][k % 3]))
            for k in range(3):
                out.append(rect(x + 8 + k * 28, y - 64, 22, 14, '#2A2E3E') + rect(x + 10 + k * 28, y - 62, 18, 10, '#5B8DEF' if k % 2 else '#3DBB7E'))
            out.append(rect(x + 36, y - 18, 20, 12, '#C9A646'))
        elif kind == 'clawd':
            out.append(clawd(x, y, 1.6, rnd.choice(coats)))
        else:
            out.append(box(x, y - 2, 96, 22, 18, '#6B4A35', '#8A6446') + rect(x + 62, y - 62, 5, 22, '#2E7A55') + rect(x + 54, y - 68, 22, 8, '#3DBB7E'))
            out.append(clawd(x - 26, y + 6, 2.6, '#2F5DA8'))
    for _ in range(36):
        out.append(rect(rnd.uniform(CUT, W), rnd.uniform(460, H), 5, 3, '#F6F1E4', 'opacity="0.9"'))
    out.append(rect(1328, 380, 56, 20, '#2A2238') + text(1336, 395, 'HALT', 12, '#5A4D6A', 'font-weight="bold"'))
    if mood == 'eve':
        out.append(rect(CUT, 0, W - CUT, H, '#FFB35C', 'opacity="0.10"'))
    # the west wall, its top a strip seen from above, a doorway onto the sidewalk
    wall = p['nyse']
    out.append(rect(CUT - 14, 40, 14, 720, '#2A2440') + rect(CUT - 12, 40, 10, 720, wall))
    out.append(rect(CUT - 14, 860, 14, H - 860, '#2A2440') + rect(CUT - 12, 860, 10, H - 860, wall))
    lit = '#F6C770' if mood == 'eve' else '#D8E6F4'
    out.append(rect(CUT - 14, 760, 14, 100, lit, 'opacity="0.7"'))
    out.append(rect(CUT - 60, 740, 46, 16, '#20232C') + text(CUT - 56, 752, 'NYSE', 11, '#F2ECE0', 'font-weight="bold"'))
    for fy in [520, 600]:
        out.append(f'<line x1="{CUT - 14}" y1="{fy}" x2="{CUT - 90}" y2="{fy - 30}" stroke="#2A2440" stroke-width="2"/>')
        for k in range(7):
            out.append(rect(CUT - 90, fy - 30 + k * 5, 46, 5, '#B5323A' if k % 2 == 0 else '#F2ECE0'))
        out.append(rect(CUT - 90, fy - 30, 20, 20, '#2D3B78'))
    out.append(clawd(CUT - 4, 830, 1.9, '#2E7A55'))
    return out

def scene5(mood, with_text=True):
    p = PAL[mood]
    parts = sky(p, mood) + town5(p, mood) + hall5(p, mood)
    if with_text:
        parts += terminal(mood)
    return f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:6px">' + ''.join(parts) + '</svg>'

if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[2] == 'v5':
    html = ['<h2>Börsgolvet v3 – skiss A, version 5: snett uppifrån som Stardew Valley och Pokémon Ruby</h2>',
            '<p class="subtitle">Ingen flyktpunkt. Marken ses uppifrån, husfasader och saker rakt framifrån med toppen synlig, det som är närmare står lägre och ritas över. Texten ligger över en lugn, bred trottoar; husraden står ovanför, himlen överst. Salen är huset med taket lyft av: bakväggen överst, golvet under, västra väggen med dörren mot trottoaren.</p>',
            '<div class="options">']
    for key, title, mood in [('f', 'Dag', 'day'), ('g', 'Kväll', 'eve')]:
        html.append(f'<div class="option" data-choice="{key}" onclick="toggleSelect(this)" style="flex-direction:column;align-items:stretch">'
                    f'<div style="display:flex;gap:12px;align-items:center"><div class="letter">{key.upper()}</div><div class="content"><h3>{title}</h3></div></div>'
                    f'<div style="margin-top:10px">{scene5(mood)}</div></div>')
    html.append('</div>')
    open(sys.argv[1], 'w').write('\n'.join(html))

# --- Version 6: Wall Street runs straight up the left half ---------------
END = 430             # where the street meets the cross street at its far end
LEFT = 120            # the left sidewalk's inner edge
RIGHT = 990           # the right sidewalk's inner edge, along the exchange

def town6(p, mood):
    out = []
    rnd = random.Random(51)
    walk = '#8A879C' if mood == 'day' else p['walk']
    road = '#77748A' if mood == 'day' else p['street']
    # far towers low behind the street's end, hazed
    for x, w, t in [(0, 90, 330), (100, 80, 350), (520, 110, 320), (650, 90, 345), (760, 120, 330), (900, 100, 350)]:
        out.append(rect(x, t, w, END - t, p['tower'], 'opacity="0.55"'))
    # Trinity Church at the street's end, its spire into the sky
    cx = 400
    out.append(rect(cx - 60, 300, 120, END - 300, '#8C7B6E' if mood == 'day' else '#5C4E52'))
    out.append(rect(cx - 22, 190, 44, 110, '#8C7B6E' if mood == 'day' else '#5C4E52'))
    out.append(poly([(cx - 22, 190), (cx, 90), (cx + 22, 190)], '#7A6A60' if mood == 'day' else '#4E4248'))
    out.append(f'<path d="M{cx - 18},{END} L{cx - 18},{END - 50} A18,18 0 0 1 {cx + 18},{END - 50} L{cx + 18},{END} Z" fill="{"#F6C770" if mood == "eve" else "#4A3A4A"}"/>')
    out.append(f'<circle cx="{cx}" cy="230" r="10" fill="#E9D9A6"/>')
    # the cross street's facades either side of the church, front-on
    for x0, x1, f in [(LEFT, cx - 70, p['sand']), (cx + 70, 640, p['brick']), (640, RIGHT, p['sand'])]:
        out.append(rect(x0, 360, x1 - x0, END - 360, f) + rect(x0, 352, x1 - x0, 8, '#4A3A4A'))
        for xx in range(x0 + 10, x1 - 20, 34):
            lit = mood == 'eve' and rnd.random() < 0.6
            out.append(rect(xx, 372, 22, 16, p['winlit'] if lit else p['win']) + rect(xx, 400, 22, 16, p['winlit'] if lit and rnd.random() < 0.7 else p['win']))
    # the street itself, straight up the half: calm stone, a few markings
    out.append(rect(LEFT, END, RIGHT - LEFT, H - END, road))
    for y in range(END, H, 28):
        off = 0 if (y // 28) % 2 else 20
        for x in range(LEFT + off, RIGHT, 40):
            out.append(rect(x, y, 38, 26, '#000', 'opacity="0.035"'))
    for y in range(END + 20, H, 70):
        out.append(rect((LEFT + RIGHT) / 2 - 2, y, 4, 34, '#F2ECE0', 'opacity="0.35"'))
    # sidewalks either side
    out += tilefloor(0, END, LEFT, H, walk, '#2A2440', 0.25)
    out += tilefloor(RIGHT, END, CUT - 14, H, walk, '#2A2440', 0.25)
    out.append(rect(LEFT - 4, END, 4, H - END, '#2A2440', 'opacity="0.4"') + rect(RIGHT, END, 4, H - END, '#2A2440', 'opacity="0.4"'))
    # the buildings along the left edge, each its roof and its front facing us
    for i, y in enumerate(range(END + 40, H + 120, 130)):
        f = [p['brick'], p['sand'], p['brown']][i % 3]
        out.append(rect(0, y - 110, 70, 36, '#4A3A4A'))                       # roof
        out.append(rect(0, y - 74, 70, 74, f))
        lit = mood == 'eve'
        out.append(rect(8, y - 64, 20, 16, p['winlit'] if lit else p['win']) + rect(40, y - 64, 20, 16, p['win']))
        out.append(rect(6, y - 30, 58, 28, '#F6C770' if lit else '#7C88A8'))
        aw = ['#2F5DA8', '#2E7A55', '#B23A3A'][i % 3]
        for k in range(0, 60, 10):
            out.append(rect(4 + k, y - 38, 10, 8, aw if (k // 10) % 2 == 0 else '#F2ECE0'))
    # lamps along both curbs; by evening, lights strung across the street
    lamp_ys = list(range(END + 60, H, 150))
    for y in lamp_ys:
        for x in (LEFT - 14, RIGHT + 8):
            out.append(rect(x, y - 40, 4, 40, '#2A2238') + rect(x - 4, y - 46, 12, 8, '#F6C770' if mood == 'eve' else '#3A3F52'))
    if mood == 'eve':
        for y in lamp_ys:
            a, b, yy = LEFT - 12, RIGHT + 10, y - 44
            mx, my = (a + b) / 2, yy + 22
            out.append(f'<path d="M{a},{yy} Q{mx},{my} {b},{yy}" stroke="#2A2238" stroke-width="1" fill="none" opacity="0.6"/>')
            for k in range(1, 18):
                t = k / 18
                px = (1 - t) ** 2 * a + 2 * (1 - t) * t * mx + t ** 2 * b
                py = (1 - t) ** 2 * yy + 2 * (1 - t) * t * my + t ** 2 * yy
                out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="2" fill="#FFD27A" opacity="0.8"/><circle cx="{px:.1f}" cy="{py:.1f}" r="5" fill="#FFD27A" opacity="0.15"/>')
    # a taxi driving up, one down, seen from above and behind
    for x, y in [(330, 640), (700, 840)]:
        out.append(box(x, y, 40, 14, 44, '#E0AE22', '#F2C12E') + rect(x + 10, y - 50, 20, 8, '#F4EEDF') + rect(x + 4, y - 4, 8, 5, '#B23A3A') + rect(x + 28, y - 4, 8, 5, '#B23A3A'))
    # Washington on the right sidewalk, a coffee cart on the left
    out.append(box(RIGHT + 4, 560, 26, 14, 8, p['shade'], p['nyse']) + rect(RIGHT + 9, 506, 16, 34, '#3C3A3A', 'rx="3"') + f'<circle cx="{RIGHT + 17}" cy="500" r="6" fill="#3C3A3A"/>')
    out.append(box(78, 760, 36, 18, 12, '#D9D2C4', '#B23A3A'))
    # Clawds on the sidewalks and crossing, heading for the doors
    coats = ['#2F5DA8', '#B23A3A', '#2E7A55', '#E1B12C', '#6A4C93']
    for x, y in [(95, 520), (100, 900), (1010, 640), (1012, 960), (560, 720), (860, 600)]:
        out.append(clawd(x, y, 1.6, rnd.choice(coats)))
    return out

def scene6(mood, with_text=True):
    p = PAL[mood]
    parts = sky(p, mood) + town6(p, mood) + hall5(p, mood)
    if with_text:
        parts += terminal(mood)
    return f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:6px">' + ''.join(parts) + '</svg>'

if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[2] == 'v6':
    html = ['<h2>Börsgolvet v3 – skiss A, version 6: Wall Street går rakt upp</h2>',
            '<p class="subtitle">Samma vinkel snett uppifrån. Vänstra halvan är gatan, som går rakt upp mot Trinity Church i dess ände och himlen; texten skrivs på gatan. NYSE:s vägg med dörren är gatans högra sida, en smal husrad dess vänstra.</p>',
            '<div class="options">']
    for key, title, mood in [('h', 'Dag', 'day'), ('i', 'Kväll', 'eve')]:
        html.append(f'<div class="option" data-choice="{key}" onclick="toggleSelect(this)" style="flex-direction:column;align-items:stretch">'
                    f'<div style="display:flex;gap:12px;align-items:center"><div class="letter">{key.upper()}</div><div class="content"><h3>{title}</h3></div></div>'
                    f'<div style="margin-top:10px">{scene6(mood)}</div></div>')
    html.append('</div>')
    open(sys.argv[1], 'w').write('\n'.join(html))

# --- Version 7: only the exchange, the sky left as it is ------------------
def walk7(p, mood):
    out = []
    walk = '#8A879C' if mood == 'day' else p['walk']
    x0 = CUT - 70
    out += tilefloor(x0, 446, CUT - 14, H, walk, '#2A2440', 0.25)
    out.append(rect(x0 - 4, 446, 4, H - 446, '#2A2440', 'opacity="0.4"'))
    out.append(rect(x0, 446, CUT - 14 - x0, 6, '#2A2440', 'opacity="0.3"'))
    for y in [520, 700, 900]:
        out.append(rect(x0 + 6, y - 44, 4, 44, '#2A2238') + rect(x0 + 2, y - 50, 12, 8, '#F6C770' if mood == 'eve' else '#3A3F52'))
        if mood == 'eve':
            out.append(f'<circle cx="{x0 + 8}" cy="{y - 46}" r="18" fill="#FFD27A" opacity="0.15"/>')
    out.append(box(x0 + 22, 600, 26, 14, 8, p['shade'], p['nyse']) + rect(x0 + 27, 546, 16, 34, '#3C3A3A', 'rx="3"') + f'<circle cx="{x0 + 35}" cy="540" r="6" fill="#3C3A3A"/>')
    out.append(clawd(x0 + 30, 960, 1.6, '#B23A3A') + clawd(x0 + 40, 760, 1.6, '#E1B12C'))
    return out

def scene7(mood, with_text=True):
    global CUT
    keep = CUT
    CUT = 1100
    p = PAL[mood]
    parts = sky(p, mood) + walk7(p, mood) + hall5(p, mood)
    CUT = keep
    if with_text:
        parts += terminal(mood)
    return f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:6px">' + ''.join(parts) + '</svg>'

if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[2] == 'v7':
    html = ['<h2>Börsgolvet v3 – skiss A, version 7: bara börsen, himlen får vara</h2>',
            '<p class="subtitle">Vänstra halvan är himlen som i dag, lugn för texten. Till höger NYSE snett uppifrån med taket lyft, och en smal trottoar längs dess västra vägg med dörren, statyn och lyktorna.</p>',
            '<div class="options">']
    for key, title, mood in [('j', 'Dag', 'day'), ('k', 'Kväll', 'eve')]:
        html.append(f'<div class="option" data-choice="{key}" onclick="toggleSelect(this)" style="flex-direction:column;align-items:stretch">'
                    f'<div style="display:flex;gap:12px;align-items:center"><div class="letter">{key.upper()}</div><div class="content"><h3>{title}</h3></div></div>'
                    f'<div style="margin-top:10px">{scene7(mood)}</div></div>')
    html.append('</div>')
    open(sys.argv[1], 'w').write('\n'.join(html))
