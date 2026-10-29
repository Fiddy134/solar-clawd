#!/usr/bin/env python3
# The checkpoint's pictures in a Ghostty window or tab beside Claude Code's
# (a split gets the stage's whole margin and is too narrow): every PNG in a
# folder side by side, or one under the other where that draws them larger,
# in the order of their names, each with its name under it, and any .md or
# .txt in the folder printed below them. It watches the folder and draws
# again when a file there changes or the window is resized, so Claude puts
# the sketch and the frames there and they show at once. The pictures go
# through the Kitty graphics protocol, which Ghostty draws in a plain shell;
# inside Claude Code's own window its redraws would paint over them. Ctrl-C
# ends it and clears what it drew. --once draws one time and ends, which is
# also how the output can be looked at in a file.
#
#   python3 tools/preview/show.py [folder]       (.preview/checkpoint by default)
#   python3 tools/preview/show.py --once [folder]

import base64
import fcntl
import math
import os
import signal
import struct
import sys
import termios
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GAP = 2
CHUNK = 4096


def window():
    # The split's rows and columns, and its size in pixels where the terminal
    # tells it, from which a cell's shape follows. Without pixels a cell is
    # taken as twice as tall as it is wide.
    try:
        rows, cols, xpix, ypix = struct.unpack('HHHH', fcntl.ioctl(sys.stdout.fileno(), termios.TIOCGWINSZ, b'\0' * 8))
    except OSError:
        rows, cols, xpix, ypix = int(os.environ.get('LINES', 50)), int(os.environ.get('COLUMNS', 160)), 0, 0
    if xpix == 0 or ypix == 0:
        return rows, cols, 8.0, 16.0
    return rows, cols, xpix / cols, ypix / rows


def png_size(data):
    return struct.unpack('>II', data[16:24])


def is_whole(data):
    # A PNG still being written has no IEND chunk at its end yet.
    return data[:8] == b'\x89PNG\r\n\x1a\n' and data[-12:-8] == b'\0\0\0\0' and data[-8:-4] == b'IEND'


def kitty(data, cols, rows):
    # One picture transmitted and placed at the cursor in cols × rows cells,
    # the cursor left where it was (C=1) and the terminal's replies silenced.
    payload = base64.standard_b64encode(data).decode()
    out = []
    for i in range(0, len(payload), CHUNK):
        part = payload[i:i + CHUNK]
        more = 1 if i + CHUNK < len(payload) else 0
        keys = f'a=T,f=100,c={cols},r={rows},C=1,q=2,m={more}' if i == 0 else f'm={more}'
        out.append(f'\x1b_G{keys};{part}\x1b\\')
    return ''.join(out)


def files(folder):
    try:
        names = sorted(os.listdir(folder))
    except FileNotFoundError:
        return [], []
    pngs = [n for n in names if n.lower().endswith('.png')]
    texts = [n for n in names if n.lower().endswith(('.md', '.txt'))]
    return pngs, texts


def signature(folder):
    pngs, texts = files(folder)
    out = []
    for name in pngs + texts:
        try:
            stat = os.stat(os.path.join(folder, name))
            out.append((name, stat.st_mtime_ns, stat.st_size))
        except FileNotFoundError:
            pass
    return tuple(out), window()[:2]


def frame(folder):
    # The whole screen as one string, or None while a picture is half written.
    rows, cols, cell_w, cell_h = window()
    pngs, texts = files(folder)
    pictures = []
    for name in pngs:
        with open(os.path.join(folder, name), 'rb') as f:
            data = f.read()
        if not is_whole(data):
            return None
        pictures.append((name, data, png_size(data)))
    lines = []
    for name in texts:
        with open(os.path.join(folder, name), encoding='utf-8', errors='replace') as f:
            lines += f.read().rstrip('\n').split('\n') + ['']

    out = ['\x1b_Ga=d,d=A,q=2\x1b\\', '\x1b[2J\x1b[H']
    if not pictures and not lines:
        out.append(f'Nothing in {os.path.relpath(folder, ROOT)} yet.')
        return ''.join(out)

    height = 0
    if pictures:
        n = len(pictures)
        tallest = max(h / w for _, _, (w, h) in pictures)
        # The pictures take the split's height less a third for the text
        # when there is text, each with a line for its name under it.
        room = rows - (min(len(lines), rows // 3) if lines else 0)

        def fit(width, rows_each):
            # The widest picture within width columns and rows_each rows.
            width = min(width, math.floor(rows_each * cell_h / (cell_w * tallest)))
            return max(1, width), max(1, math.ceil(width * cell_w * tallest / cell_h))

        # Side by side, or one under the other where the split is narrow
        # enough that this draws them larger.
        across = fit((cols - GAP * (n - 1)) // n, room - 2)
        down = fit(cols, (room - 2 * n) // n)
        is_down = n > 1 and down[0] > across[0]
        width, tall = down if is_down else across
        for i, (name, data, (w, h)) in enumerate(pictures):
            x, y = (1, i * (tall + 2) + 1) if is_down else (i * (width + GAP) + 1, 1)
            rows_i = max(1, round(width * cell_w * (h / w) / cell_h))
            out.append(f'\x1b[{y};{x}H' + kitty(data, width, rows_i))
            out.append(f'\x1b[{y + tall};{x}H\x1b[2m{name[:width]}\x1b[0m')
        height = (n * (tall + 2) if is_down else tall + 2)

    for j, line in enumerate(lines[:max(0, rows - height - 1)]):
        out.append(f'\x1b[{height + j + 1};1H{line[:cols]}')
    return ''.join(out)


def main():
    args = sys.argv[1:]
    once = '--once' in args
    args = [a for a in args if a != '--once']
    folder = os.path.abspath(args[0]) if args else os.path.join(ROOT, '.preview', 'checkpoint')

    if once:
        sys.stdout.write(frame(folder) or '')
        sys.stdout.write('\n')
        return

    resized = [False]
    signal.signal(signal.SIGWINCH, lambda *_: resized.__setitem__(0, True))
    sys.stdout.write('\x1b[?25l')
    last = None
    try:
        while True:
            now = signature(folder)
            if now != last or resized[0]:
                drawn = frame(folder)
                if drawn is not None:
                    sys.stdout.write(drawn)
                    sys.stdout.flush()
                    last, resized[0] = now, False
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        sys.stdout.write('\x1b_Ga=d,d=A,q=2\x1b\\\x1b[2J\x1b[H\x1b[?25h')
        sys.stdout.flush()


if __name__ == '__main__':
    main()
