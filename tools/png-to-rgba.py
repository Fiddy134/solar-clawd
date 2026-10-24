"""Decodes an 8-bit RGBA PNG and writes it, box-downscaled to size x size, as raw RGBA."""
import struct, sys, zlib

src, dst, size = sys.argv[1], sys.argv[2], int(sys.argv[3])
data = open(src, 'rb').read()
w, h, depth, kind = struct.unpack('>IIBB', data[16:26])
assert depth == 8 and kind == 6, 'expects 8-bit RGBA'
idat, at = b'', 8
while at < len(data):
    n = struct.unpack('>I', data[at:at + 4])[0]
    if data[at + 4:at + 8] == b'IDAT':
        idat += data[at + 8:at + 8 + n]
    at += 12 + n
raw, stride, rows, prev = zlib.decompress(idat), w * 4, [], bytearray(w * 4)
for y in range(h):
    f, line = raw[y * (stride + 1)], bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
    for i in range(stride):
        a = line[i - 4] if i >= 4 else 0
        b, c = prev[i], prev[i - 4] if i >= 4 else 0
        if f == 1: line[i] = (line[i] + a) & 255
        elif f == 2: line[i] = (line[i] + b) & 255
        elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
        elif f == 4:
            p = a + b - c
            pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
            line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
    rows.append(line)
    prev = line
k = w // size
out = bytearray()
for y in range(size):
    for x in range(size):
        acc = [0, 0, 0, 0]
        for dy in range(k):
            for dx in range(k):
                px = rows[y * k + dy][(x * k + dx) * 4:(x * k + dx) * 4 + 4]
                for j in range(4):
                    acc[j] += px[j]
        out += bytes(v // (k * k) for v in acc)
open(dst, 'wb').write(out)
