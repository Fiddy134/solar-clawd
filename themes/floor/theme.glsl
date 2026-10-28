// floor: the floor of the New York Stock Exchange seen from above, as in
// Stardew Valley, standing in the margin at the right while the sky at the
// left stays the text's. Under a gilded coffered ceiling, NEW YORK STOCK
// EXCHANGE on the frieze, tall arched windows onto the real sky, the big
// flag, two NYSE cubes on their wires, the halt lamp and a ticker in the
// skirting; on the planks the trading posts in rows, each with its stock's
// price on its screens, trader Clawds in coats milling and walking between
// them, the coin desk that never closes, and the resident at his pulpit at
// the front under a green banker's lamp. Outside the west wall, under the
// text's last columns, the sidewalk with its lamps, flags, Washington and the
// Clawds going in at the door.

// --- Where things are --------------------------------------------------------

// The hall and what stands in it, worked out once a call. The building fills
// the stage: its west wall, cut through, at the stage's left edge, with the
// door in it; the sidewalk outside it, under the last columns of the text.
// Up the screen is further into the hall: the back wall stands straight on
// above the floor's back edge, its ceiling above it.
struct Hall {
  float u;
  float left;     // the stage's left edge, the west wall's outer face
  float inner;    // the west wall's inner face, the hall's left edge
  float width;    // the hall's width, to the window's right edge
  float walk;     // the curb, the sidewalk's outer edge
  float frieze;   // the frieze's top, under the ceiling
  float wallTop;  // the back wall's top, under the frieze
  float base;     // the ticker band in the skirting
  float floorY;   // the floor's back edge, at the back wall's foot
  float row;      // a row of the floor, front to back
  float front;    // the front strip, where the resident keeps his pulpit
  float doorTop;  // the door in the west wall
  float doorBot;
  float g;        // a letter's cell
  float c;        // a trader's cell
  float rc;       // the resident's cell, a size larger
};

Hall hallOf(float u) {
  Hall h;
  h.u = u;
  h.left = iResolution.x - (STAGE_PX > 0.0 ? STAGE_PX : 0.3 * iResolution.x);
  h.inner = h.left + 1.1 * u;
  h.width = iResolution.x - h.inner;
  h.walk = h.left - 6.0 * u;
  h.frieze = 5.0 * u;
  h.wallTop = 6.6 * u;
  h.base = 24.0 * u;
  h.floorY = 25.2 * u;
  h.row = 2.0 * u;
  h.front = iResolution.y - 6.2 * u;
  h.doorTop = h.floorY + 20.6 * u;
  h.doorBot = h.floorY + 24.2 * u;
  h.g = max(2.0, floor(u / 8.0));
  h.c = max(1.0, floor(0.35 * u));
  h.rc = max(2.0, floor(0.6 * u));
  return h;
}

// The market as the floor lives it, by New York's clock: how full the floor
// is, whether its lamps and screens are on, whether the bell rings, whether
// a late trader is still at his post and whether the cleaners are in.
struct Market { float fill; bool staffed; float bell; bool late; bool cleaning; };

Market marketOf() {
  Market m;
  float ny = sky_NEW_YORK_HOUR;
  bool trading = sky_TRADING_DAY > 0.5;
  bool open = sky_MARKET_OPEN > 0.5;
  // Full while it trades; filling from half past six to the bell and
  // emptying in the hour after the close on a trading day; else empty.
  m.fill = open ? 1.0 : !trading ? 0.0 : ny >= 6.5 && ny < 9.5 ? mix(0.2, 0.55, (ny - 6.5) / 3.0) : ny >= 16.0 && ny < 17.0 ? 0.5 * (17.0 - ny) : 0.0;
  m.staffed = open || (trading && ny >= 6.0 && ny < 19.0);
  m.late = trading && !open && ny >= 16.0 && ny < 22.0;
  m.cleaning = m.fill < 0.2;
  // The opening bell at the open, the closing one in its last minutes;
  // while played, for half of every minute.
  bool rings = open && (ny < 9.6 || ny >= 15.9);
  m.bell = THEME_FORCE == 1 ? step(mod(iTime, 60.0), 30.0) : THEME_FORCE == 0 && rings ? 1.0 : 0.0;
  return m;
}

// Clawd's coral, and the hall's other inks, each printed from the seven.
const vec3 CORAL = mix(mix(INK_ORANGE, CREAM, 0.15), INK_INDIGO, 0.1);
const vec3 RED = mix(INK_PINK, INK_ORANGE, 0.45);
const vec3 BRASS = mix(INK_YELLOW, INK_ORANGE, 0.35);
const vec3 GILT = mix(mix(INK_YELLOW, INK_ORANGE, 0.45), CREAM, 0.2);
const vec3 WOOD = mix(INK_ORANGE, INK_INDIGO, 0.4);
const vec3 STONE = mix(CREAM, INK_INDIGO, 0.3);
const vec3 NAVY = mix(INK_INDIGO, INK_BLUE, 0.3);
const vec3 BRONZE = mix(INK_ORANGE, INK_INDIGO, 0.55);
const vec3 BULB = vec3(1.0, 0.97, 0.9);

// A colour of the hall as its own lamps light it: its day colour by day, a
// little warmer and toward indigo by night, and darker by night again while
// only the cleaners' lamps are on.
vec3 indoor(vec3 day, float k, float nt, float lights) {
  vec3 c = mix(day, mix(mix(day, INK_ORANGE, 0.1), INK_INDIGO, 0.3), nt);
  return tone(c * (1.0 - (1.0 - lights) * (0.08 + 0.5 * nt)), k);
}

// The code of character i, 0 to 19, of a line packed six bits a character.
int codeIn(uvec4 line, int i) {
  uint word = i < 5 ? line.x : i < 10 ? line.y : i < 15 ? line.z : line.w;
  return int((word >> uint(6 * (i % 5))) & 63u);
}

// Whether this theme's event `kind` (its place in the manifest's events,
// from 0) is up now, and then its seed and how far through it is, 0 to 1.
bool eventUp(int kind, out float seed, out float t) {
  for (int i = 0; i < 4; i++) {
    if (i >= EVENT_COUNT) break;
    if (EVENT_KIND[i] != 100 + kind) continue;
    seed = EVENT_SEED[i];
    t = fract(iTime / EVENT_SECONDS[i] + seed * 0.001);
    return true;
  }
  return false;
}

// The symbol of quote r: the two coins first, as they trade all night, then
// the index and its seven.
int symOf(int r) {
  return r == 0 ? sky_BTC : r == 1 ? sky_ETH : r == 2 ? sky_NDX : r == 3 ? sky_AAPL : r == 4 ? sky_MSFT : r == 5 ? sky_NVDA : r == 6 ? sky_GOOGL : r == 7 ? sky_AMZN : r == 8 ? sky_META : sky_TSLA;
}

// Quote r's name, five letters packed six bits a letter, the first in the
// lowest bits, blanks after it.
uint nameOf(int r) {
  return r == 0 ? 613467979u : r == 1 ? 613488462u : r == 2 ? 613552983u : r == 3 ? 609587850u : r == 4 ? 611645206u : r == 5 ? 606656471u : r == 6 ? 356615696u : r == 7 ? 610153866u : r == 8 ? 606720918u : 606689053u;
}

// The code in column col of quote r on the tape, twenty columns: its name,
// its price to five figures, an arrow up or down and its day in percent;
// dashes while its price is not known.
int quoteCode(int r, int col) {
  int sym = symOf(r);
  float price = sky_QUOTE_PRICE[sym];
  float chg = sky_QUOTE_CHANGE[sym];
  if (col < 5) return int((nameOf(r) >> uint(6 * col)) & 63u);
  if (price <= 0.0) return (col >= 8 && col <= 11) || (col >= 15 && col <= 17) ? sky_GLYPH_MINUS : sky_GLYPH_SPACE;
  if (col == 13) return chg < 0.0 ? sky_GLYPH_DOWN : sky_GLYPH_UP;
  if (col == 19) return sky_GLYPH_PERCENT;
  bool isPrice = col >= 6 && col <= 11;
  if (!isPrice && (col < 14 || col > 18)) return sky_GLYPH_SPACE;
  float v = isPrice ? price : abs(chg);
  int decimals = isPrice ? (price >= 10000.0 ? 0 : price >= 1000.0 ? 1 : price >= 100.0 ? 2 : 3) : (v >= 10.0 ? 1 : 2);
  return sky_numberCode(v, isPrice ? 6 : 5, decimals, isPrice ? col - 6 : col - 14);
}

// The code in column col of quote r's price as a screen shows it: six
// columns of price and an arrow; dashes while it is not known.
int priceCode(int r, int col) {
  int sym = symOf(r);
  float price = sky_QUOTE_PRICE[sym];
  if (col > 6 || col < 0) return sky_GLYPH_SPACE;
  if (price <= 0.0) return col >= 2 && col <= 4 ? sky_GLYPH_MINUS : sky_GLYPH_SPACE;
  if (col == 6) return sky_QUOTE_CHANGE[sym] < 0.0 ? sky_GLYPH_DOWN : sky_GLYPH_UP;
  return sky_numberCode(price, 6, price >= 10000.0 ? 0 : price >= 1000.0 ? 1 : price >= 100.0 ? 2 : 3, col);
}

// What a pixel of letters shows: the pixel and the character's top left in
// the letters' own frame, the cell, the code and the ink.
struct Letter { vec2 q; vec2 at; float cell; int code; vec3 color; };

const uvec4 WORD_FRIEZE = uvec4(579994519u, 479282904u, 609273373u, 172279886u);
const uvec4 WORD_FRIEZE_END = uvec4(613475351u, 613566756u, 613566756u, 613566756u);
const uvec4 WORD_NYSE = uvec4(607766679u, 613566756u, 613566756u, 613566756u);
const uvec4 WORD_HALT = uvec4(611668625u, 613566756u, 613566756u, 613566756u);
const uvec4 WORD_FILLED = uvec4(240473231u, 613566733u, 613566756u, 613566756u);
const uvec4 WORD_BUY = uvec4(613558155u, 613566756u, 613566756u, 613566756u);
const uvec4 WORD_SELL = uvec4(609571740u, 613566756u, 613566756u, 613566756u);

// --- The sidewalk ----------------------------------------------------------------

// Which of three places down the sidewalk, in units from the floor's back
// edge and in order, y is nearest.
float nearest(float y, vec3 at) {
  return abs(y - at.x) < abs(y - at.y) ? at.x : abs(y - at.y) < abs(y - at.z) ? at.y : at.z;
}

// A small flag of stripes and a blue canton at q from its top left, `size`
// its width and height, rippling: its ink, or a negative alpha off it.
vec4 smallFlag(vec2 q, vec2 size, float u) {
  q.y -= 0.08 * u * sin(q.x / (0.5 * u) - iTime * 2.0) * q.x / size.x;
  if (q.x < 0.0 || q.y < 0.0 || q.x > size.x || q.y > size.y) return vec4(0.0);
  bool isCanton = q.x < 0.42 * size.x && q.y < 0.54 * size.y;
  int stripe = int(floor(q.y / size.y * 7.0));
  vec3 c = isCanton ? mix(NAVY, INK_BLUE, 0.4) : stripe % 2 == 0 ? RED : CREAM;
  return vec4(c, 1.0);
}

// The sidewalk outside the west wall, under the text's last columns: stone
// plates in calm, low tones, never lighter than the sky behind them, its curb
// and the street beyond fading out; by night the door's light on it. Its
// lamps by the curb, lit at night; the flags on their poles; and Washington
// in bronze on his pedestal, a pigeon on his head.
vec3 sidewalk(vec3 sky, vec2 p, float u, float k, Hall h, float nt) {
  if (p.y < h.floorY - u || p.x < h.walk - 2.0 * u) return sky;
  float dark = 1.0 - 0.6 * nt;
  float fade = smoothstep(h.floorY - u, h.floorY + 2.0 * u, p.y);
  float x = p.x - h.walk;
  vec2 v = vec2(x, p.y - h.floorY);
  vec2 cell = floor(v / (2.0 * u));
  vec2 at = v - (cell + 0.5) * 2.0 * u;
  uint hs = hashi(int(cell.x) * 71 + int(cell.y) * 313 + 3);
  vec3 col = sky_under(mix(tone(mix(STONE, INK_VIOLET, 0.12 + 0.05 * float(hs & 3u)), k) * 0.78 * dark, sky, 0.25 * nt), sky);
  if (u - max(abs(at.x), abs(at.y)) < 0.06 * u) col = mix(col, keyInk(k), 0.3);
  if (x < 0.3 * u) col = sky_under(mix(tone(mix(STONE, INK_INDIGO, 0.35), k) * dark, sky, 0.25 * nt), sky);
  vec2 door = vec2(h.left, 0.5 * (h.doorTop + h.doorBot));
  col = mix(col, INK_YELLOW, screen(p, 0.4 * nt * exp(-length((p - door) / vec2(1.0, 1.3)) / (0.9 * u)), pitch(u), 0.0));
  sky = x < 0.0 ? mix(sky, sky_under(tone(INK_INDIGO, k) * 0.55 * dark, sky), 0.5 * fade * smoothstep(-2.0 * u, 0.0, x)) : mix(sky, col, fade);
  // The lamps by the curb: a post, its lantern lit by night.
  float along = (p.y - h.floorY) / u;
  vec2 lq = p - vec2(h.walk + 1.2 * u, h.floorY + nearest(along + 2.0, vec3(6.0, 19.5, 31.0)) * u);
  if (abs(lq.x) < 2.0 * u && lq.y < 0.3 * u && lq.y > -4.5 * u) {
    vec3 iron = sky_under(tone(NAVY, k) * 0.8 * dark, sky);
    vec2 lantern = vec2(0.0, -2.45 * u);
    if (nt > 0.3) sky = mix(sky, INK_YELLOW, screen(p, 0.45 * nt * exp(-length(lq - lantern) / (0.45 * u)), pitch(u), 0.0));
    sky = ink(sky, iron, min(max(abs(lq.x) - 0.08 * u, max(lq.y, -2.2 * u - lq.y)), box(lq + vec2(0.0, 0.1 * u), vec2(0.22, 0.12) * u)), 1.0);
    float glassD = box(lq - lantern, vec2(0.24, 0.3) * u);
    sky = ink(sky, iron, min(glassD - 0.06 * u, box(lq - lantern + vec2(0.0, 0.42 * u), vec2(0.3, 0.07) * u)), 1.0);
    sky = ink(sky, nt > 0.3 ? mix(INK_YELLOW, CREAM, 0.3) : sky_under(tone(mix(NAVY, INK_BLUE, 0.3), k) * dark, sky), glassD, 1.0);
  }
  // The flags on their poles out of the wall.
  vec2 root = vec2(h.left, h.floorY + nearest(along, vec3(2.5, 16.5, 27.5)) * u);
  vec2 tip = root + vec2(-3.6 * u, -1.3 * u);
  if (p.x > tip.x - 0.3 * u && p.y > tip.y - 0.4 * u && p.y < root.y + 1.6 * u) {
    float poleY = root.y - 1.3 * (h.left - p.x) / 3.6;
    vec4 f = smallFlag(vec2(p.x - h.left + 3.4 * u, p.y - poleY), vec2(2.1, 1.4) * u, u);
    if (f.a > 0.0) sky = mix(sky, mix(tone(f.rgb, k) * dark, sky, 0.2), 0.95);
    sky = ink(sky, sky_under(tone(BRASS, k) * dark, sky), segment(p, root, tip) - 0.06 * u, 1.0);
  }
  // Washington on his pedestal against the wall, his hand out over the
  // street, a pigeon on his head.
  vec2 sq = (p - vec2(h.left - 1.6 * u, h.floorY + 13.0 * u)) / 1.4;
  if (abs(sq.x) > 1.3 * u || sq.y > 0.1 * u || sq.y < -4.0 * u) return sky;
  vec3 stone = sky_under(tone(STONE, k) * 0.85 * dark, sky);
  float pedTop = box(sq + vec2(0.0, 1.25 * u), vec2(0.95, 0.25) * u);
  float pedFront = box(sq + vec2(0.0, 0.5 * u), vec2(0.95, 0.5) * u);
  sky = ink(sky, mix(stone, keyInk(k), 0.25), pedFront, 1.0);
  sky = ink(sky, stone, pedTop, 1.0);
  sky = ink(sky, keyInk(k), abs(min(pedTop, pedFront)) - 0.04 * u, 0.6);
  vec2 b = sq + vec2(0.0, 1.3 * u);
  // His coat widening to its skirts, his legs, his head, his arm out over
  // the street and the fasces his other hand rests on.
  float body = box(b + vec2(0.0, 1.1 * u), vec2(0.3 * u + 0.12 * (b.y + 1.6 * u), 0.5 * u));
  body = min(body, box(vec2(abs(b.x) - 0.15 * u, b.y + 0.3 * u), vec2(0.08, 0.3) * u));
  body = min(body, length(b + vec2(0.0, 1.95 * u)) - 0.26 * u);
  body = min(body, segment(b, vec2(-0.25 * u, -1.5 * u), vec2(-0.8 * u, -1.15 * u)) - 0.09 * u);
  body = min(body, box(b + vec2(-0.55 * u, 0.4 * u), vec2(0.1, 0.42) * u));
  vec3 bronze = sky_under(tone(BRONZE, k) * dark, sky);
  bronze = mix(bronze, mix(bronze, INK_INDIGO, 0.4), screen(p, 0.3 + 0.4 * step(0.0, b.x), pitch(u), 45.0));
  sky = ink(sky, bronze, body, 1.0);
  sky = ink(sky, keyInk(k), abs(body) - 0.03 * u, 0.5);
  float pigeon = min(length((b + vec2(-0.05 * u, 2.3 * u)) / vec2(1.4, 1.0)) - 0.13 * u, length(b + vec2(0.12 * u, 2.38 * u)) - 0.07 * u);
  return ink(sky, sky_under(tone(mix(STONE, INK_VIOLET, 0.3), k) * dark, sky), pigeon, 1.0);
}

// --- The building ----------------------------------------------------------------

// The west wall cut through, seen from above: its stone hatched as a
// section is, its faces in the key plate, and the door, a gap with a
// threshold, its jambs in the key plate.
vec3 westWall(vec2 p, float u, float k, Hall h, float nt) {
  vec3 stone = tone(STONE, k) * (1.0 - 0.35 * nt);
  bool isDoor = p.y > h.doorTop && p.y < h.doorBot;
  if (isDoor) {
    vec3 sill = tone(mix(STONE, CREAM, 0.4), k) * (1.0 - 0.2 * nt);
    return mix(sill, mix(sill, INK_INDIGO, 0.3), screen(p, 0.2, pitch(u), 60.0));
  }
  if (abs(p.y - h.doorTop) < 0.25 * u || abs(p.y - h.doorBot) < 0.25 * u) return keyInk(k);
  if (p.x - h.left < 0.08 * u || h.inner - p.x < 0.08 * u) return keyInk(k);
  return fract((p.x + p.y) / (0.4 * u)) < 0.2 ? mix(stone, keyInk(k), 0.55) : stone;
}

// The window i of the three in the back wall nearest p: its middle, and the
// distance to its outline, a round arch over straight sides.
float windowD(vec2 p, Hall h, out float xw) {
  float u = h.u;
  float i = clamp(floor((p.x - h.inner) / (h.width / 3.0)), 0.0, 2.0);
  xw = h.inner + (2.0 * i + 1.0) / 6.0 * h.width;
  vec2 q = vec2(p.x - xw, p.y - 10.1 * u);
  return q.y < 0.0 ? length(q) - 1.9 * u : max(abs(q.x) - 1.9 * u, q.y - 8.5 * u);
}

// Whether p is in a pane of the windows: inside the frame, off the mullion
// and the transom, and not behind the flag or a cube.
bool isPane(vec2 p, Hall h) {
  float u = h.u;
  if (p.x < h.inner || p.y < 8.0 * u || p.y > 18.6 * u) return false;
  float xw;
  if (windowD(p, h, xw) > -0.16 * u) return false;
  float dx = p.x - xw;
  if (abs(dx) < 0.07 * u || abs(p.y - 13.4 * u) < 0.07 * u) return false;
  if (abs(xw - h.inner - 0.5 * h.width) < u) return p.y < 8.95 * u || p.y > 13.95 * u;
  return p.y < 12.0 * u || p.y > 16.1 * u;
}

// The gilded coffered ceiling seen from inside, in rows down to the frieze:
// each coffer a recess screened darker toward its back, a rosette in it,
// the beams between them gilt with their edges in the key plate.
vec3 ceiling(vec2 p, float u, float k, Hall h, float nt, float lights) {
  float n = max(3.0, floor(h.width / (2.8 * u)));
  vec2 cs = vec2(h.width / n, 1.7 * u);
  vec2 q = vec2(p.x - h.inner, h.frieze - p.y);
  vec2 c = floor(q / cs);
  vec2 at = q - (c + 0.5) * cs;
  vec3 gilt = indoor(GILT, k, nt, lights);
  float beam = min(0.5 * cs.x - abs(at.x), 0.5 * cs.y - abs(at.y));
  if (beam < 0.05 * u) return mix(gilt, keyInk(k), 0.7);
  if (beam < 0.2 * u) return gilt;
  vec3 deep = indoor(mix(GILT, INK_INDIGO, 0.45), k, nt, lights);
  vec3 col = mix(gilt, deep, screen(p, 0.2 + 0.45 * clamp((beam - 0.2 * u) / (0.4 * u), 0.0, 1.0), pitch(u), 0.0));
  float rose = length(at) - 0.2 * u;
  if (rose < 0.0) return mix(gilt, CREAM, 0.25);
  return abs(rose) < 0.05 * u ? mix(col, keyInk(k), 0.5) : col;
}

// The back wall straight on, from the ceiling to the floor: the frieze, the
// stone wall a little darker toward its foot, gilt pilasters between its
// bays, the three arched windows left clear for the real sky (their frames,
// mullions and transoms brass), and the ticker band in the skirting.
vec3 backWall(vec3 sky, vec2 p, float u, float k, Hall h, float nt, float lights) {
  if (p.y < h.frieze) return ceiling(p, u, k, h, nt, lights);
  if (p.y < h.wallTop) {
    vec3 band = indoor(mix(NAVY, STONE, 0.35), k, nt, lights);
    bool isRule = p.y < h.frieze + 0.15 * u || p.y > h.wallTop - 0.15 * u;
    return isRule ? indoor(GILT, k, nt, lights) : band;
  }
  if (p.y > h.base) {
    bool isRule = p.y < h.base + 0.12 * u || p.y > h.floorY - 0.12 * u;
    return isRule ? indoor(BRASS, k, nt, lights) : tone(INK_INDIGO, k) * 0.5;
  }
  float xw;
  float win = windowD(p, h, xw);
  if (win < -0.16 * u && abs(p.x - xw) > 0.07 * u && abs(p.y - 13.4 * u) > 0.07 * u) return sky;
  if (win < 0.0) return indoor(BRASS, k, nt, lights);
  vec3 wall = indoor(mix(CREAM, INK_ORANGE, 0.12), k, nt, lights);
  vec3 col = mix(wall, mix(wall, INK_INDIGO, 0.3), screen(p, 0.08 + 0.3 * smoothstep(h.wallTop, h.base, p.y), pitch(u), 15.0));
  if (win < 0.14 * u) return keyInk(k);
  float bay = abs(fract((p.x - h.inner) / (h.width / 3.0) + 0.5) - 0.5) * h.width / 3.0;
  if (bay < 0.35 * u && p.x > h.inner + u) return bay < 0.06 * u ? keyInk(k) : indoor(GILT, k, nt, lights);
  if (abs(p.y - 23.4 * u) < 0.1 * u) return indoor(GILT, k, nt, lights);
  return col;
}

// The lamps hanging from the ceiling over each window's bay: a rod and a
// globe, lit by night, glowing warm in dots over the ceiling and the frieze;
// dimmer while only the cleaners' lamps are on.
vec3 hallLamps(vec3 sky, vec2 p, float u, float k, Hall h, float nt, float lights) {
  if (p.y > 9.5 * u || p.x < h.inner) return sky;
  float i = clamp(floor((p.x - h.inner) / (h.width / 3.0)), 0.0, 2.0);
  vec2 at = vec2(h.inner + (2.0 * i + 1.0) / 6.0 * h.width, 4.2 * u);
  vec2 q = p - at;
  if (abs(q.x) > 4.5 * u) return sky;
  float lit = smoothstep(0.15, 0.5, nt) * (0.45 + 0.55 * lights);
  if (lit > 0.0) sky = mix(sky, mix(INK_YELLOW, CREAM, 0.3), screen(p, 0.75 * lit * exp(-max(0.0, length(q) - 0.45 * u) / (0.8 * u)), pitch(u), 0.0));
  sky = ink(sky, keyInk(k), max(abs(q.x) - 0.05 * u, q.y + 0.3 * u), 1.0);
  float globe = length(q) - 0.45 * u;
  sky = ink(sky, lit > 0.0 ? mix(BULB, INK_YELLOW, 0.25) : tone(mix(BRASS, CREAM, 0.3), k), globe, 1.0);
  return ink(sky, keyInk(k), abs(globe) - 0.04 * u, 0.6);
}

// The big flag hanging from its rod in front of the middle window, its
// stripes rippling a little, its canton dotted with stars; lit by the room.
vec3 bigFlag(vec3 sky, vec2 p, float u, float k, Hall h, float nt, float lights) {
  vec2 q = p - vec2(h.inner + 0.5 * h.width - 2.8 * u, 9.1 * u);
  if (q.x < -0.4 * u || q.x > 6.0 * u || q.y < -0.4 * u || q.y > 5.1 * u) return sky;
  if (q.y < 0.0) return ink(sky, indoor(BRASS, k, nt, lights), min(box(q - vec2(2.8 * u, -0.15 * u), vec2(3.0, 0.08) * u), length(q - vec2(-0.2 * u, -0.15 * u)) - 0.15 * u), 1.0);
  float x = q.x - 0.12 * u * sin(q.y / (0.9 * u) + 0.8 * iTime) * q.y / (4.8 * u);
  if (x < 0.0 || x > 5.6 * u || q.y > 4.8 * u) return sky;
  int stripe = int(floor(q.y / (4.8 * u) * 13.0));
  bool isCanton = x < 2.4 * u && stripe < 7;
  vec3 c = isCanton ? mix(NAVY, INK_BLUE, 0.35) : stripe % 2 == 0 ? RED : CREAM;
  if (isCanton && length(fract(vec2(x, q.y) / (0.42 * u)) - 0.5) < 0.2) c = CREAM;
  c = indoor(c, k, nt, lights);
  c = mix(c, mix(c, INK_INDIGO, 0.3), screen(p, 0.35 * (0.5 + 0.5 * sin(x / (0.7 * u) + 1.3)), pitch(u), 75.0));
  return x < 0.06 * u || x > 5.54 * u ? mix(c, keyInk(k), 0.6) : c;
}

// New York's clock on the left pier, its hands at the hour there.
vec3 nyClock(vec3 sky, vec2 p, float u, float k, vec2 at) {
  vec2 q = p - at;
  float r = 1.2 * u;
  float d = length(q) - r;
  if (d > 0.25 * u) return sky;
  float ny = sky_NEW_YORK_HOUR;
  sky = ink(sky, lift(CREAM, k), d, 1.0);
  sky = ink(sky, tone(BRASS, k), abs(d) - 0.12 * u, 1.0);
  float tick = abs(fract(atan(q.x, -q.y) / (2.0 * PI) * 12.0 + 0.5) - 0.5);
  if (length(q) > 0.78 * r && length(q) < 0.92 * r && tick < 0.07) sky = mix(sky, keyInk(k), 0.9);
  float hourA = 2.0 * PI * mod(ny, 12.0) / 12.0;
  float minuteA = 2.0 * PI * fract(ny);
  float hands = min(segment(q, vec2(0.0), 0.5 * r * vec2(sin(hourA), -cos(hourA))) - 0.09 * u, segment(q, vec2(0.0), 0.8 * r * vec2(sin(minuteA), -cos(minuteA))) - 0.06 * u);
  return ink(sky, keyInk(k), hands, 1.0);
}

// The brass bell on its bracket on the right pier, swinging and ringing out
// while the market opens or closes.
vec3 bell(vec3 sky, vec2 p, float u, float k, vec2 at, bool rings) {
  vec2 q = p - at;
  if (abs(q.x) > 2.5 * u || abs(q.y) > 2.6 * u) return sky;
  sky = ink(sky, tone(NAVY, k), min(box(q + vec2(0.0, 1.2 * u), vec2(0.55 * u, 0.1 * u)), box(q + vec2(0.0, 1.05 * u), vec2(0.07 * u, 0.15 * u))), 1.0);
  float swing = rings ? 0.45 * sin(iTime * 9.0) : 0.0;
  vec2 v = q + vec2(0.0, 1.0 * u);
  vec2 b = tumble(v, swing, 1.0);
  float skirt = mix(0.55, 0.98, clamp((b.y - 0.55 * u) / (1.15 * u), 0.0, 1.0)) * u;
  float shape = min(length(b - vec2(0.0, 0.55 * u)) - 0.55 * u, max(abs(b.y - 1.15 * u) - 0.6 * u, abs(b.x) - skirt));
  shape = min(shape, max(abs(b.y - 1.72 * u) - 0.1 * u, abs(b.x) - 1.04 * u));
  vec3 brass = tone(BRASS, k);
  brass = mix(brass, mix(brass, INK_INDIGO, 0.35), screen(p, clamp(0.25 + b.x / (2.0 * u), 0.0, 1.0), pitch(u), 0.0));
  sky = ink(sky, tone(NAVY, k), length(b - vec2(0.0, 1.98 * u)) - 0.17 * u, 1.0);
  sky = ink(sky, brass, shape, 1.0);
  sky = ink(sky, keyInk(k), abs(shape - 0.03 * u) - 0.05 * u, 0.6);
  if (!rings) return sky;
  float d = length(q - vec2(0.0, 0.2 * u));
  float arcs = min(abs(d - 1.75 * u), abs(d - 2.25 * u)) - 0.07 * u;
  return abs(q.x) > 1.2 * abs(q.y - 0.2 * u) ? ink(sky, lift(CREAM, k), arcs, 0.9) : sky;
}

// The two NYSE cubes hanging on their wires in front of the outer windows,
// boxes seen from above and in front: a top lit from above, a dark front
// for their letters. While Claude is on the web, rings go out from them.
vec3 cubes(vec3 sky, vec2 p, float u, float k, Hall h, bool web) {
  float mid = h.inner + 0.5 * h.width;
  float xc = h.inner + (p.x < mid ? 1.0 : 5.0) / 6.0 * h.width;
  vec2 q = p - vec2(xc, 12.0 * u);
  if (web && abs(q.x) < 8.0 * u && abs(q.y - 2.0 * u) < 8.0 * u) {
    float d = length(q - vec2(0.0, 2.0 * u));
    if (d > 3.0 * u && d < 7.5 * u && fract((d - iTime * 1.8 * u) / (1.2 * u)) < 0.13) sky = mix(sky, lift(mix(INK_YELLOW, CREAM, 0.3), k), 0.9 - 0.7 * d / (7.5 * u));
  }
  if (abs(q.x) > 2.6 * u || q.y > 4.4 * u || p.y < h.frieze) return sky;
  if (q.y < 0.0) return abs(abs(q.x) - 2.0 * u) < max(1.0, 0.05 * u) ? mix(sky, keyInk(k), 0.8) : sky;
  if (abs(q.x) > 2.5 * u || q.y > 4.1 * u) return sky;
  if (q.y < 0.7 * u) return q.y > 0.62 * u || abs(q.x) > 2.42 * u ? keyInk(k) : lift(mix(INK_BLUE, CREAM, 0.55), k);
  if (abs(q.x) > 2.42 * u || q.y > 4.02 * u) return keyInk(k);
  return mix(tone(NAVY, k) * 0.7, tone(INK_BLUE, k) * 0.6, screen(p, 0.2, pitch(u), 15.0));
}

// The halt lamp on the back wall under the middle window: a round lamp over
// a sign. Dark while nothing waits; orange and glowing, the sign saying
// HALT, while Claude asks; white, the sign saying FILLED, once it is done;
// and once a question has waited, its glow larger and quicker and a lamp lit
// either side of the sign as well. Lit in every frame it is on: the pulse
// only changes how strongly.
vec3 haltLamp(vec3 sky, vec2 p, float u, float k, Hall h) {
  float mid = h.inner + 0.5 * h.width;
  vec2 dome = vec2(mid, 19.9 * u);
  vec2 plate = vec2(mid, 22.2 * u);
  if (abs(p.x - mid) > 10.0 * u || p.y < 10.5 * u || p.y > h.base) return sky;
  bool asks = WAITING == 1;
  bool urgent = asks && WAITING_URGENT > 0.5;
  vec3 light = asks ? INK_ORANGE : BULB;
  float pulse = urgent ? 0.82 + 0.18 * sin(iTime * 9.0) : 0.88 + 0.12 * sin(iTime * 2.5);
  float reach = (urgent ? 1.75 : asks ? 1.3 : 0.8) * u;
  float d = length(p - dome) - 1.05 * u;
  float sides = min(length(p - plate + vec2(4.35 * u, 0.0)), length(p - plate - vec2(4.35 * u, 0.0))) - 0.5 * u;
  float pd = box(p - plate, vec2(3.75 * u, 0.95 * u));
  sky = ink(sky, tone(NAVY, k), max(abs(p.x - mid) - 0.3 * u, max(dome.y - p.y, p.y - plate.y)), 1.0);
  if (WAITING != 0) {
    sky = mix(sky, light, screen(p, pulse * exp(-max(0.0, d) / reach), pitch(u), 15.0));
    if (urgent) sky = mix(sky, light, screen(p, pulse * exp(-max(0.0, sides) / (0.8 * u)), pitch(u), 75.0));
    if (WAITING == 2) sky = mix(sky, light, screen(p, 0.6 * exp(-max(0.0, pd) / (0.7 * u)), pitch(u), 0.0));
  }
  sky = ink(sky, WAITING != 0 ? light : tone(NAVY, k), d, 1.0);
  if (WAITING == 0) sky = ink(sky, tone(mix(NAVY, CREAM, 0.4), k), length(p - dome + vec2(0.35 * u)) - 0.18 * u, 1.0);
  sky = ink(sky, keyInk(k), abs(d) - 0.06 * u, 0.7);
  sky = ink(sky, tone(INK_INDIGO, k) * 0.55, pd, 1.0);
  sky = ink(sky, tone(BRASS, k), abs(pd) - 0.08 * u, 1.0);
  sky = ink(sky, urgent ? light : tone(NAVY, k), sides, 1.0);
  return ink(sky, keyInk(k), abs(sides) - 0.05 * u, 0.7);
}

// Every letter on the wall, one sky_glyphWide for them all: NEW YORK STOCK
// EXCHANGE on the frieze; on each cube NYSE, a name and its price, the left
// one the Nasdaq-100 and the right one each quote in turn, the price green
// or red by its day; the ticker in the skirting, every quote sliding left;
// and the halt lamp's word in the light's own colour.
vec3 wallWords(vec3 sky, vec2 p, float u, float k, Hall h) {
  float g = h.g;
  float gs = g + 1.0;
  Letter l = Letter(p, p, g, sky_GLYPH_SPACE, lift(mix(BRASS, CREAM, 0.35), k));
  float mid = h.inner + 0.5 * h.width;
  float tapeTop = h.base + 0.6 * u - 2.5 * g;
  float friezeTop = 0.5 * (h.frieze + h.wallTop) - 2.5 * g;
  float cubeTop = 13.3 * u;
  float xc = h.inner + (p.x < mid ? 1.0 : 5.0) / 6.0 * h.width;
  if (p.y >= friezeTop && p.y < friezeTop + 5.0 * g) {
    float x0 = mid - 69.0 * g;
    int i = int(floor((p.x - x0) / (6.0 * g)));
    l.code = i < 0 || i > 22 ? sky_GLYPH_SPACE : i < 20 ? codeIn(WORD_FRIEZE, i) : codeIn(WORD_FRIEZE_END, i - 20);
    l.at = vec2(x0 + 6.0 * g * float(i), friezeTop);
  } else if (p.y >= tapeTop && p.y < tapeTop + 5.0 * g && p.x > h.inner) {
    float x = p.x - h.inner + mod(iTime * 5.0 * g, 1320.0 * g);
    int i = int(floor(x / (6.0 * g)));
    int col = i % 22;
    l.q = vec2(x, p.y);
    l.at = vec2(6.0 * g * float(i), tapeTop);
    l.code = col > 19 ? sky_GLYPH_SPACE : quoteCode((i / 22) % 10, col);
    l.color = lift(col == 13 ? (l.code == sky_GLYPH_DOWN ? mix(RED, CREAM, 0.2) : mix(INK_GREEN, CREAM, 0.25)) : INK_YELLOW, k);
  } else if (abs(p.x - xc) < 2.4 * u && p.y >= cubeTop && p.y < cubeTop + 17.0 * g) {
    int line = int(floor((p.y - cubeTop) / (6.0 * g)));
    int r = p.x < mid ? 2 : int(mod(floor(iTime / 12.0), 10.0));
    int len = line == 0 ? 4 : line == 2 ? 6 : r <= 2 ? 3 : r == 6 ? 5 : 4;
    float x0 = xc - 3.0 * g * float(len);
    int i = int(floor((p.x - x0) / (6.0 * g)));
    l.at = vec2(x0 + 6.0 * g * float(i), cubeTop + 6.0 * g * float(line));
    l.code = i < 0 || i >= len ? sky_GLYPH_SPACE : line == 0 ? codeIn(WORD_NYSE, i) : line == 1 ? int((nameOf(r) >> uint(6 * i)) & 63u) : priceCode(r, i);
    float chg = sky_QUOTE_CHANGE[symOf(r)];
    l.color = lift(line == 0 ? CREAM : line == 1 ? INK_YELLOW : mix(chg < 0.0 ? RED : INK_GREEN, CREAM, 0.3), k);
  } else if (WAITING != 0 && abs(p.y - 22.2 * u) < 2.5 * gs) {
    int len = WAITING == 2 ? 6 : 4;
    float x0 = mid - 3.0 * gs * float(len);
    int i = int(floor((p.x - x0) / (6.0 * gs)));
    l.cell = gs;
    l.at = vec2(x0 + 6.0 * gs * float(i), 22.2 * u - 2.5 * gs);
    l.code = i < 0 || i >= len ? sky_GLYPH_SPACE : codeIn(WAITING == 2 ? WORD_FILLED : WORD_HALT, i);
    l.color = WAITING == 2 ? BULB : INK_ORANGE;
  }
  return mix(sky, l.color, sky_glyphWide(l.q, l.at, l.cell, l.code));
}

// The floor's planks seen from above, a board a cell: each board's hash picks
// its shade and whether an order slip lies on it, more of them the busier the
// day; the joints wander from row to row, the seams in the key plate, and a
// shadow along the back wall's foot.
vec3 planks(vec2 p, float u, float k, Hall h, Market m, float nt, float lights) {
  vec2 tile = vec2(3.2, 0.7) * u;
  vec2 v = (p - vec2(h.inner, h.floorY)) / tile;
  v.x += fract(floor(v.y) * 0.618);
  vec2 c = floor(v);
  vec2 at = (fract(v) - 0.5) * tile;
  uint hs = hashi(int(c.x) * 131 + int(c.y) * 977);
  vec3 wood = indoor(mix(mix(CREAM, mix(INK_ORANGE, INK_YELLOW, 0.3), 0.32), INK_INDIGO, 0.04 + 0.03 * float(hs & 3u)), k, nt, lights);
  wood = mix(wood, mix(wood, mix(INK_ORANGE, INK_INDIGO, 0.3), 0.3), screen(p, 0.08 + 0.07 * float((hs >> 2) & 1u) + 0.4 * exp(-(p.y - h.floorY) / (0.6 * u)), pitch(u), 45.0));
  if (min(0.5 * tile.y - abs(at.y), 0.5 * tile.x - abs(at.x)) < 0.05 * u) wood = mix(wood, keyInk(k), 0.25);
  if (float((hs >> 4) & 1023u) / 1023.0 < 0.01 + 0.04 * m.fill) wood = ink(wood, lift(CREAM, k), box(at - vec2(float(hs & 7u) - 3.5, 0.0) * 0.12 * u, ((hs & 1u) == 0u ? vec2(0.28, 0.17) : vec2(0.17, 0.25)) * u), 1.0);
  return wood;
}

// --- What the engine calls first --------------------------------------------------

// The sidewalk outside; the west wall with its door; the ceiling, the back
// wall and everything on it; and the floor.
vec3 scenery(vec3 sky, vec2 p, float u, float k) {
  Hall h = hallOf(u);
  if (p.x < h.walk - 2.0 * u) return sky;
  float nt = night();
  if (p.x < h.left) return sidewalk(sky, p, u, k, h, nt);
  if (p.x < h.inner) return westWall(p, u, k, h, nt);
  Market m = marketOf();
  float lights = m.staffed ? 1.0 : 0.45;
  if (p.y >= h.floorY) return planks(p, u, k, h, m, nt, lights);
  float mid = h.inner + 0.5 * h.width;
  sky = backWall(sky, p, u, k, h, nt, lights);
  sky = hallLamps(sky, p, u, k, h, nt, lights);
  sky = nyClock(sky, p, u, k, vec2(h.inner + h.width / 3.0, 16.2 * u));
  sky = bell(sky, p, u, k, vec2(h.inner + 2.0 * h.width / 3.0, 15.4 * u), m.bell > 0.5);
  sky = bigFlag(sky, p, u, k, h, nt, lights);
  sky = cubes(sky, p, u, k, h, sky_tool() == sky_TOOL_WEB);
  sky = haltLamp(sky, p, u, k, h);
  return wallWords(sky, p, u, k, h);
}

// --- The people -------------------------------------------------------------------

const int POSE_STAND = 0;
const int POSE_POINT = 1;   // one arm up, signalling an order
const int POSE_UP = 2;      // both arms up, shouting
const int POSE_PHONE = 3;   // a handset at his ear
const int POSE_THUMP = 4;   // a fist on his chest, one side then the other
const int POSE_SLEEP = 5;   // eyes shut
const int POSE_MOP = 6;     // both hands on a mop
const int POSE_READ = 7;    // the paper held open in front of him

const int GEAR_NONE = 0;
const int GEAR_SHADES = 1;
const int GEAR_HEADSET = 2;
const int GEAR_HOOD = 3;
const int GEAR_CAP = 4;
const int GEAR_BRICK = 5;   // Gekko's brick of a phone for a handset

// Who stands where p is: his feet, his cell, his pose and gear, his coat,
// which way he looks (-1 left, 0 ahead, 1 right, 2 away), how far toward
// indigo a dim room leaves him, his stride (-1 standing, 0 or 1 a step),
// and whether he is outdoors, under the night's plate.
struct Who { vec2 feet; float cell; int pose; int gear; vec3 coat; int look; float dim; int stride; bool outside; };

// Cell c of a figure, six across and four down from the top left of his
// head, the row over it and a mop beside him: 0 nothing, 1 coral, 2 an eye,
// 3 a leg, 4 his coat, 5 his gear in indigo, 6 a pale thing (a handset, the
// paper), 7 the paper's print, 8 a mop's handle, 9 its head.
int figureCell(ivec2 c, int pose, int gear, int look, int beat, int stride) {
  if (pose == POSE_MOP && c.x == 6 && c.y >= 0 && c.y <= 2) return 8;
  if (pose == POSE_MOP && c.y == 3 && (c.x == 6 || c.x == 7)) return 9;
  if (c.x < 0 || c.x > 5 || c.y < -1 || c.y > 3) return 0;
  bool isUp = pose == POSE_UP;
  bool isPoint = pose == POSE_POINT;
  bool isPhone = pose == POSE_PHONE;
  bool isSide = c.x == 0 || c.x == 5;
  if (c.y == -1) {
    if ((isUp && isSide) || (isPoint && c.x == 5)) return 1;
    if (isPhone && gear == GEAR_BRICK && c.x == 5) return 5;
    return (gear == GEAR_HOOD && !isSide) || (gear == GEAR_CAP && c.x > 0) ? 4 : 0;
  }
  if (c.y == 0) {
    if (!isSide || (isPoint && c.x == 5)) return 1;
    if (isPhone && gear == GEAR_BRICK && c.x == 5) return 6;
    return gear == GEAR_HEADSET ? 5 : gear == GEAR_HOOD ? 4 : 0;
  }
  if (c.y == 1) {
    if (pose == POSE_READ) return c.x == 1 || c.x == 2 ? 7 : 6;
    if (isSide) return isPhone && c.x == 5 ? 6 : gear == GEAR_HEADSET ? 5 : gear == GEAR_HOOD ? 4 : 0;
    if (pose == POSE_SLEEP) return c.x == 1 || c.x == 4 ? 3 : 1;
    if (look == 2) return 1;
    if (gear == GEAR_SHADES) return 5;
    return c.x == (look > 0 ? 2 : 1) || c.x == (look < 0 ? 3 : 4) ? 2 : 1;
  }
  if (c.y == 2) {
    if (pose == POSE_READ) return c.x == 3 || c.x == 4 ? 7 : 6;
    if (isUp) return isSide ? 0 : 4;
    if ((isPoint || isPhone) && c.x == 5) return 0;
    if (pose == POSE_THUMP && c.x == (beat == 0 ? 0 : 5)) return 0;
    if (pose == POSE_THUMP && c.x == (beat == 0 ? 1 : 4)) return 1;
    return 4;
  }
  if (stride < 0) return c.x == 1 || c.x == 4 ? 3 : 0;
  return c.x == (stride == 0 ? 0 : 1) || c.x == (stride == 0 ? 4 : 5) ? 3 : 0;
}

// A figure with his feet at w.feet, in cells of whole pixels: coral, his
// eyes indigo, his legs a deeper coral, his coat and gear; lit by the room
// indoors (under a weaker plate where it is dim) or under the night's plate
// outdoors; his key plate a pixel or so off register down and to the right.
vec3 figure(vec3 sky, vec2 p, Who w, float k, int beat) {
  float c = w.cell;
  vec2 origin = floor(w.feet - vec2(3.0 * c, 4.0 * c) + 0.5);
  if (p.x < origin.x - c || p.x > origin.x + 9.0 * c || p.y < origin.y - 2.0 * c || p.y > origin.y + 5.0 * c) return sky;
  int kind = figureCell(ivec2(floor((p - origin) / c)), w.pose, w.gear, w.look, beat, w.stride);
  if (kind == 2) return mix(sky, keyInk(k), 0.97);
  if (kind != 0) {
    vec3 body = kind == 1 ? CORAL : kind == 3 ? mix(CORAL, INK_INDIGO, 0.22) : kind == 4 ? w.coat : kind == 5 ? mix(INK_INDIGO, CREAM, 0.12) : kind == 6 ? CREAM : kind == 7 ? mix(INK_INDIGO, CREAM, 0.4) : kind == 8 ? WOOD : mix(CREAM, INK_BLUE, 0.25);
    return mix(sky, w.outside ? nightInk(body, k) : mix(lift(body, k), keyInk(k), w.dim), 0.97);
  }
  // The key plate: his head, body and arms again, a pixel or so off.
  ivec2 s = ivec2(floor((p - vec2(max(1.0, floor(0.4 * c))) - origin) / c));
  bool isShadow = s.y >= 0 && s.y <= 2 && s.x >= (s.y == 2 ? 0 : 1) && s.x <= (s.y == 2 ? 5 : 4);
  return isShadow || (s.y == 3 && (s.x == 1 || s.x == 4)) ? mix(sky, keyInk(k), 0.55) : sky;
}

// How far from the nearest post of post row `row` (3, 7 or 11) x is, the
// coin desk counted as one.
float postGap(Hall h, int row, float x) {
  float f = (x - h.inner) / h.width * 6.0;
  float c = row == 7 ? clamp(2.0 * floor((f + 1.0) / 2.0), 2.0, 4.0) : clamp(2.0 * floor(f / 2.0) + 1.0, 1.0, 5.0);
  return abs(f - c) * h.width / 6.0;
}

// The lane up and down the floor through row `row`: through the gaps
// between the posts, the back half's at two thirds of the hall's width and
// the front half's at a third; none through the middle posts' row.
float laneOf(Hall h, int row) { return h.inner + (row < 7 ? 4.0 : 2.0) / 6.0 * h.width; }

// How likely a lot of row `row` with its middle at x holds a trader: none
// where a post or a lane runs or in the front rows, most at the posts'
// fronts, fewer walking the aisles, as many as the hour fills.
float traderChance(Hall h, Market m, int row, float x) {
  if (row > 13 || row < 0) return 0.0;
  if (row != 7 && abs(x - laneOf(h, row)) < 1.9 * h.u) return 0.0;
  bool isPostRow = row == 3 || row == 7 || row == 11;
  if (isPostRow && postGap(h, row, x) < 3.6 * h.u) return 0.0;
  if (row % 4 == 1) return 0.4 * m.fill;
  if (row % 4 == 0 && row > 0 && postGap(h, row - 1, x) < 3.2 * h.u) return 0.95 * m.fill;
  return 0.5 * m.fill;
}

// Who stands where p is, or nobody, chosen by where p is so that the whole
// hall costs one figure. The resident behind his pulpit; the cleaner at the
// front left while the conversation compacts; whoever is in the door, going
// in or coming out, or now and then a messenger in his cap; the Clawds
// walking down the sidewalk toward us. On the floor, the rows run across it
// front to back, each in lots an eighth of the hall wide, and everyone stands
// inside his row, so p asks only its own: most mill about their lot; every
// fourth row is an aisle where they walk the floor's length, to the right in
// one and to the left in the next (the cleaners mopping along it when the
// floor is empty); and two lanes run up and down through the gaps between
// the posts, away from us in the back half and toward us in the front. The
// agents in their yellow coats stand along the front row from the west wall,
// the coin desk's two traders never leave it, and after the close a late
// trader stays on his phone at post 7. `crowd` is the pose the whole floor
// takes, or -1 for each his own.
Who whoAt(vec2 p, Hall h, Market m, int agents, int crowd, int state, int resPose) {
  float u = h.u;
  Who w = Who(vec2(-1e4), h.c, POSE_STAND, GEAR_NONE, CORAL, 0, 0.0, -1, false);
  vec2 res = vec2(h.inner + 0.68 * h.width, iResolution.y - 2.3 * u);
  if (abs(p.x - res.x) < 4.5 * h.rc && p.y > res.y - 7.0 * h.rc && p.y < res.y + h.rc) {
    w.feet = res;
    w.cell = h.rc;
    w.pose = resPose;
    w.gear = resPose == POSE_PHONE ? GEAR_BRICK : GEAR_NONE;
    w.look = resPose == POSE_STAND ? int(mod(floor(iTime / 6.0), 3.0)) - 1 : 0;
    return w;
  }
  if ((state == CONTEXT_CLEARING || state == CONTEXT_CLEARED) && p.x < h.inner + 7.0 * u && p.y > h.front) {
    w.feet = vec2(h.inner + 4.6 * u, iResolution.y - 1.3 * u);
    w.pose = POSE_MOP;
    w.gear = GEAR_CAP;
    w.coat = mix(INK_GREEN, INK_BLUE, 0.5);
    w.look = -1;
    return w;
  }
  float doorY = h.doorBot - 0.6 * u;
  if (abs(p.x - h.left) < 2.2 * u && p.y > doorY - 3.0 * u && p.y < doorY + u) {
    float pick = rand(int(mod(floor(iTime / 30.0), 1000.0)) * 7 + 3);
    bool isMessenger = pick < 0.35;
    w.feet = vec2(h.left + 0.3 * u, doorY);
    w.stride = int(floor(iTime * 3.0)) % 2;
    w.look = pick < 0.7 ? 1 : -1;
    w.gear = isMessenger ? GEAR_CAP : GEAR_NONE;
    w.coat = isMessenger ? WOOD : mix(INK_BLUE, CREAM, 0.2);
    w.pose = isMessenger ? POSE_POINT : POSE_STAND;
    return w;
  }
  // Walkers in lots along a lane, the lots sliding with the clock, each
  // lot's hash saying whether one walks in it: down the sidewalk toward us;
  // on the floor up the back half's lane and down the front half's, a lot
  // of two rows apart, stepping out from behind the middle posts.
  bool isOut = p.x < h.left;
  int row = int(floor((p.y - h.floorY) / h.row));
  float lane = isOut ? h.left - 3.4 * u : laneOf(h, row);
  float down = isOut || row > 7 ? 1.0 : -1.0;
  float lh = (isOut ? 3.2 : 4.0) * u;
  if (abs(p.x - lane) < (isOut ? 1.6 : 1.3) * u && (isOut || row != 7) && p.y > h.floorY) {
    float shift = down * mod(iTime * (isOut ? 0.7 : 0.8) * u, 512.0 * lh);
    float j = floor((p.y - h.floorY - shift) / lh);
    float fy = h.floorY + shift + (j + 1.0) * lh - 0.2 * u;
    uint hl = hashi(int(mod(j, 512.0)) * 19 + (isOut ? 1 : row < 7 ? 3 : 5));
    bool isOn = isOut ? fy > h.floorY + 1.8 * u : row < 7 ? fy > h.floorY + 1.2 * u && fy < h.floorY + 15.5 * u : fy > h.floorY + 18.0 * u && fy < h.front - 0.3 * u;
    if (!isOn || float(hl & 1023u) / 1023.0 >= (isOut ? 0.5 : 0.75 * m.fill)) return w;
    w.feet = vec2(lane + (float((hl >> 10) & 3u) - 1.5) * 0.12 * u, fy);
    w.stride = int(floor(iTime * 3.0 + float(hl & 1u))) % 2;
    w.look = down > 0.0 ? 0 : 2;
    w.pose = isOut || crowd < 0 ? POSE_STAND : crowd;
    int pick = int((hl >> 12) % 5u);
    w.coat = pick == 0 ? INK_BLUE : pick == 1 ? NAVY : pick == 2 ? INK_GREEN : pick == 3 ? RED : mix(CREAM, INK_ORANGE, 0.3);
    w.gear = (hl >> 14) % 3u == 0u ? (isOut ? GEAR_CAP : GEAR_HEADSET) : GEAR_NONE;
    w.outside = isOut;
    w.dim = m.staffed || isOut ? 0.0 : 0.25;
    return w;
  }
  if (isOut || p.x < h.inner || p.y < h.floorY - 0.2 * u || p.y > h.front) return w;
  float foot = h.floorY + float(row + 1) * h.row - 0.1 * u;
  w.dim = m.staffed ? 0.0 : 0.25;
  float desk = h.inner + 5.0 / 6.0 * h.width;
  if (row == 10 && abs(p.x - desk) < 2.6 * u) {
    bool isRight = p.x > desk;
    w.feet = vec2(desk + (isRight ? 1.4 : -1.4) * u, foot - 0.3 * u);
    w.gear = GEAR_HOOD;
    w.coat = isRight ? NAVY : INK_VIOLET;
    w.look = isRight ? -1 : 1;
    w.pose = crowd >= 0 ? crowd : POSE_STAND;
    w.dim = 0.1;
    return w;
  }
  float postSeven = h.inner + h.width / 3.0;
  if (m.late && row == 8 && abs(p.x - postSeven) < 1.4 * u) {
    w.feet = vec2(postSeven - 0.4 * u, foot);
    w.pose = POSE_PHONE;
    w.coat = INK_BLUE;
    w.look = 1;
    w.dim = 0.15;
    return w;
  }
  float lot = h.width / 8.0;
  bool isAisle = row % 4 == 1;
  bool isMopping = isAisle && m.cleaning && (row == 5 || row == 9);
  float dir = (row / 4) % 2 == 0 ? 1.0 : -1.0;
  float shift = isAisle ? dir * mod(iTime * (isMopping ? 0.3 : 1.1) * u, 512.0 * lot) : 0.0;
  float off = row % 2 == 1 ? 0.5 * lot : 0.0;
  int col = int(floor((p.x - h.inner - off - shift) / lot));
  float cx = h.inner + off + shift + (float(col) + 0.5) * lot;
  int colH = int(mod(float(col), 512.0));
  uint hs = hashi(colH * 31 + row * 977 + 11);
  bool isAgent = row == 12 && col >= 0 && col < agents;
  float chance = isMopping ? 0.16 : traderChance(h, m, row, cx);
  if ((!isAgent && float(hs & 1023u) / 1023.0 >= chance) || cx < h.inner + 0.9 * u) return w;
  w.feet = vec2(cx, foot);
  if (!isAisle && crowd != POSE_UP) {
    float phase = float((hs >> 8) & 255u);
    w.feet += vec2(0.35 * u * sin(0.4 * iTime + phase), -0.3 * u * (0.5 + 0.5 * sin(0.27 * iTime + 2.0 * phase)));
  }
  if (isAisle) w.stride = int(floor(iTime * 3.0 + float(hs & 3u))) % 2;
  if (isMopping) {
    w.pose = POSE_MOP;
    w.gear = GEAR_CAP;
    w.coat = mix(INK_GREEN, INK_BLUE, 0.5);
    w.look = dir > 0.0 ? 1 : -1;
    w.dim = 0.2;
    return w;
  }
  uint mv = hashi(colH * 13 + row * 101 + int(mod(floor(iTime / 4.0 + float(hs & 7u) * 0.37), 1000.0)) * 7);
  float r = float(mv & 255u) / 255.0;
  w.pose = crowd >= 0 ? crowd : r < (m.fill > 0.8 ? 0.3 : 0.12) ? POSE_POINT : r < 0.42 ? POSE_PHONE : POSE_STAND;
  int pick = int((hs >> 20) % 7u);
  w.coat = isAgent ? INK_YELLOW : pick == 0 ? INK_BLUE : pick == 1 ? INK_GREEN : pick == 2 ? INK_VIOLET : pick == 3 ? RED : pick == 4 ? INK_PINK : pick == 5 ? mix(CREAM, INK_BLUE, 0.12) : NAVY;
  int kit = int((hs >> 24) & 7u);
  w.gear = isAgent || kit == 4 ? GEAR_CAP : kit == 2 || kit == 3 ? GEAR_HEADSET : kit < 2 ? GEAR_SHADES : GEAR_NONE;
  w.look = isAisle ? (dir > 0.0 ? 1 : -1) : int((mv >> 9) % 3u) - 1;
  return w;
}

// Post `which`'s stock: the seven by number, the coin desk bitcoin and ether
// by turns.
int postQuote(int which) { return which == 7 ? int(mod(floor(iTime / 10.0), 2.0)) : 3 + which; }

// The trading post p may be over, or at the front right the coin desk, as a
// box seen from above and in front, its foot the middle of its front edge on
// its row's front line. Only one can be: the post rows are four apart and a
// post reaches up less than two. Drawn after the people, so that it covers
// whoever stands behind it, and nobody stands in front of it within its own
// height. On its top, seen from above, a counter round a dark well, its
// number on a brass plate, a coffee on it; monitors stand on its
// back edge. Its front is a band of screens with its stock's name and price,
// tinted green or red by its day, dim once the floor has closed (but for the
// late trader's post and the coin desk); a page of text while Claude reads
// and marching bars while it is busy with something else, at any hour. The desk is lower, with two laptops. One
// sky_glyphWide for its letters.
vec3 post(vec3 sky, vec2 p, float u, float k, Hall h, Market m, int tool, float nt) {
  if (p.x < h.inner || p.y < h.floorY + 4.2 * u || p.y > h.floorY + 24.4 * u) return sky;
  int row = 3 + 4 * int(clamp(floor((p.y - h.floorY - 4.3 * u) / (4.0 * h.row)), 0.0, 2.0));
  float f = (p.x - h.inner) / h.width * 6.0;
  float cc = row == 7 ? clamp(2.0 * floor((f + 1.0) / 2.0), 2.0, 4.0) : clamp(2.0 * floor(f / 2.0) + 1.0, 1.0, 5.0);
  float x = h.inner + cc / 6.0 * h.width;
  int which = row == 3 ? int(cc - 1.0) / 2 : row == 7 ? 2 + int(cc) / 2 : 5 + int(cc - 1.0) / 2;
  bool isDesk = which == 7;
  float fh = 1.8 * u;
  float td = (isDesk ? 0.8 : 1.3) * u;
  float hw = 2.75 * u;
  float foot = h.floorY + float(row + 1) * h.row;
  vec2 q = vec2(p.x - x, p.y - foot);
  if (abs(q.x) > hw + 0.3 * u || q.y > 0.3 * u || q.y < -fh - td - 0.7 * u) return sky;
  int r = postQuote(which);
  float chg = sky_QUOTE_CHANGE[symOf(r)];
  bool isOn = isDesk || m.staffed || (which == 3 && m.late);
  uint hs = hashi(which * 41 + 7);
  float top = -fh - td;
  vec2 cup = vec2((float(hs & 255u) / 255.0 - 0.5) * 2.4 * u, -fh - 0.25 * u);
  if (q.y > 0.0) return abs(q.x) < hw ? mix(sky, keyInk(k), 0.35) : sky;
  float g = h.g;
  Letter l = Letter(p, p, g, sky_GLYPH_SPACE, lift(CREAM, k));
  vec3 body = indoor(isDesk ? mix(INK_VIOLET, INK_INDIGO, 0.45) : mix(NAVY, INK_INDIGO, 0.25), k, nt, 1.0);
  if (q.y < top) {
    // The monitors standing on the back edge, or the desk's two laptops.
    float n = isDesk ? 1.4 : 1.7;
    float mx = q.x - clamp(floor(q.x / (n * u) + 0.5), -1.0, 1.0) * n * u;
    vec2 mq = vec2(mx, q.y - top + (isDesk ? 0.25 : 0.32) * u);
    float frame = box(mq, (isDesk ? vec2(0.45, 0.2) : vec2(0.55, 0.3)) * u);
    if (frame > 0.0 || (isDesk && abs(q.x) < 0.5 * u)) return sky;
    if (frame > -0.07 * u) return keyInk(k);
    vec3 glow = isDesk ? INK_GREEN : mix(INK_BLUE, INK_GREEN, step(0.5, float((hs >> 8) & 1u)));
    vec3 screenC = isOn ? lift(mix(glow, CREAM, 0.25), k) : tone(INK_INDIGO, k) * 0.6;
    if (isOn && abs(mq.y + 0.12 * u * sin(mq.x / (0.18 * u) + float(hs & 15u))) < 0.05 * u) screenC = lift(chg < 0.0 ? RED : INK_GREEN, k);
    return mix(sky, screenC, 0.97);
  }
  vec3 col;
  if (q.y < -fh) {
    // The top seen from above: a counter round a well, the number plate.
    vec2 tq = vec2(q.x, q.y + fh + 0.5 * td);
    float well = box(tq, vec2(hw - 0.5 * u, max(0.05 * u, 0.5 * td - 0.38 * u))) - 0.08 * u;
    vec3 counter = indoor(isDesk ? mix(INK_VIOLET, CREAM, 0.35) : mix(WOOD, CREAM, 0.3), k, nt, 1.0);
    col = well < 0.0 ? mix(body, keyInk(k), 0.4) : counter;
    if (abs(well) < 0.05 * u) col = mix(col, keyInk(k), 0.6);
    float c2 = length(q - cup);
    if (c2 < 0.2 * u && !isDesk) col = c2 < 0.12 * u ? tone(mix(WOOD, INK_INDIGO, 0.4), k) : lift(CREAM, k);
    vec2 plate = vec2(-hw + 1.0 * u, -fh - 0.45 * u);
    float pd = box(q - plate, vec2(0.85, 0.44) * u);
    if (!isDesk && pd < 0.0) {
      col = pd > -0.06 * u ? keyInk(k) : tone(BRASS, k);
      int number = which < 3 ? (which == 2 ? 5 : 2 + which) : which < 5 ? 4 + which : 5 + which;
      float x0 = x + plate.x - (number < 10 ? 3.0 : 6.0) * g;
      int i = int(floor((p.x - x0) / (6.0 * g)));
      l.at = vec2(x0 + 6.0 * g * float(i), foot + plate.y - 2.5 * g);
      l.code = number < 10 ? (i == 0 ? number : sky_GLYPH_SPACE) : (i == 0 ? 1 : i == 1 ? number - 10 : sky_GLYPH_SPACE);
      l.color = keyInk(k);
    }
    if (abs(q.x) > hw - 0.06 * u || q.y < top + 0.06 * u) col = keyInk(k);
  } else {
    // The front: a band of screens, a brass kick at its foot.
    col = body;
    float sy0 = -fh + 0.1 * u;
    if (abs(q.x) < hw - 0.2 * u && q.y > sy0 && q.y < -0.18 * u) {
      vec3 panel = tone(INK_INDIGO, k) * 0.5;
      bool isKnown = sky_QUOTE_PRICE[symOf(r)] > 0.0;
      float heat = isOn && isKnown ? clamp(abs(chg) / 3.0, 0.25, 0.7) : 0.0;
      col = mix(panel, tone(chg < 0.0 ? RED : INK_GREEN, k) * 0.7, heat);
      if (tool == sky_TOOL_OTHER && !isDesk) {
        bool isBar = fract((q.x - iTime * 1.5 * u) / (0.9 * u)) < 0.45 && abs(q.y + 0.5 * fh) < 0.25 * fh;
        col = isBar ? lift(mix(INK_BLUE, CREAM, 0.5), k) : tone(mix(INK_BLUE, INK_INDIGO, 0.5), k);
      } else if (tool == sky_TOOL_READ && !isDesk) {
        // A page of text scrolling up, every post's screen lit with it.
        float ly = q.y + mod(iTime * 0.6 * u, 64.0 * 0.3 * u);
        float n = floor(ly / (0.3 * u));
        float reach = (0.45 + 0.5 * rand(int(mod(n, 64.0)) * 7 + which)) * 2.0 * (hw - 0.45 * u);
        bool isLine = fract(ly / (0.3 * u)) < 0.4 && q.x + hw - 0.45 * u < reach;
        col = isLine ? keyInk(k) : lift(mix(CREAM, INK_BLUE, 0.06), k);
      } else {
        float lineTop = foot + sy0 + 0.5 * (-0.18 * u - sy0 - 11.0 * g);
        int line = p.y < lineTop + 5.5 * g ? 0 : 1;
        int len = line == 1 ? 6 : r <= 2 ? 3 : r == 6 ? 5 : 4;
        float x0 = x - 3.0 * g * float(len);
        int i = int(floor((p.x - x0) / (6.0 * g)));
        l.at = vec2(x0 + 6.0 * g * float(i), lineTop + 6.0 * g * float(line));
        l.code = i < 0 || i >= len ? sky_GLYPH_SPACE : line == 0 ? int((nameOf(r) >> uint(6 * i)) & 63u) : priceCode(r, i);
        l.color = !isOn && isKnown ? mix(panel, CREAM, 0.25) : lift(line == 0 ? INK_YELLOW : CREAM, k);
      }
    } else if (q.y > -0.18 * u) {
      col = tone(BRASS, k) * 0.8;
    }
    if (abs(q.x) > hw - 0.06 * u || q.y < -fh + 0.06 * u) col = keyInk(k);
  }
  col = mix(col, l.color, sky_glyphWide(l.q, l.at, l.cell, l.code));
  return abs(q.x) < hw ? col : sky;
}

// --- What stands in front of them -------------------------------------------------

// An order slip at d from its middle, turned by `spin` and narrowing as it
// turns over: its distance, below 0 inside.
float paperSlip(vec2 d, float spin, float u) {
  d = tumble(d, spin, 1.0);
  d.x /= max(0.3, abs(cos(0.7 * spin)));
  return box(d, vec2(0.28, 0.18) * u);
}

// The Jenga tower on the pulpit, its foot at `at`: eleven courses, every
// other one showing three ends and a few with the middle pulled; fallen
// (`fall` from 0 standing to 1 down), half its blocks lie in a heap where it
// stood and half have tumbled off onto the floor in front, at `floorY`.
vec3 jenga(vec3 sky, vec2 p, float u, float k, vec2 at, float floorY, float fall) {
  if (abs(p.x - at.x) > 2.6 * u || p.y > floorY + 0.2 * u || p.y < at.y - 3.4 * u) return sky;
  float bh = max(1.0, floor(0.2 * u));
  float bw = 0.8 * u;
  for (int j = 0; j < 11; j++) {
    uint hs = hashi(j * 17 + 5);
    float h01 = float(hs & 255u) / 255.0;
    vec2 stand = vec2(at.x, at.y - (float(j) + 0.5) * bh);
    vec2 rest = j % 2 == 0 ? vec2(at.x + (h01 - 0.5) * u, at.y - (0.5 + float((j / 2) % 2)) * bh) : vec2(at.x + (0.4 + 1.6 * h01) * u, floorY - (j % 3 == 0 ? 1.5 : 0.5) * bh);
    vec2 q = tumble(p - vec2(mix(stand.x, rest.x, fall), mix(stand.y, rest.y, fall * fall)), fall * (float((hs >> 8) & 255u) / 255.0 - 0.5) * 3.0, 1.0);
    if (box(q, vec2(0.5 * bw, 0.5 * bh)) > 0.0) continue;
    bool isOdd = j % 2 == 1;
    if (fall < 0.5 && isOdd && (j == 3 || j == 7 || j == 9) && abs(q.x) < bw / 6.0) continue;
    return mix(sky, isOdd && abs(abs(q.x) - bw / 6.0) < 0.6 ? keyInk(k) : lift(mix(BRASS, CREAM, 0.45), k), 0.97);
  }
  return sky;
}

// The front strip: the context window as piles of paper along the floor from
// the west wall, one for each full tenth, the newest lit yellow while a
// tenth has just filled; while the conversation compacts the
// cleaner has mopped them into one heap, and just after the floor is bare.
// Then the resident's pulpit, a box with a top and a front, hiding his legs:
// his banker's lamp lit on it, the Jenga tower at his side (The Big Short's:
// it lies fallen while the Nasdaq-100 is down more than 2 %) and, while he
// hums, notes rising over his head.
vec3 frontStrip(vec3 sky, vec2 p, float u, float k, Hall h, float fall, bool humming, int full, int state, float nt) {
  if (p.y < h.front - 2.0 * u || p.x < h.inner) return sky;
  float bottom = iResolution.y;
  vec3 paper = lift(CREAM, k);
  if (state == CONTEXT_CLEARING) {
    vec2 hq = p - vec2(h.inner + 2.2 * u, bottom - 1.2 * u);
    float heap = max(length(hq / vec2(1.6, 1.0)) - (0.35 + 0.07 * float(full)) * u, hq.y);
    sky = ink(sky, mix(paper, keyInk(k), step(0.75, fract(hq.y / (0.13 * u))) * 0.5), heap, 1.0);
    sky = ink(sky, keyInk(k), abs(heap) - 0.04 * u, 0.6);
  } else if (state != CONTEXT_CLEARED) {
    float sp = 1.25 * u;
    int i = int(floor((p.x - h.inner - 0.4 * u) / sp));
    if (i >= 0 && i < full) {
      uint hs = hashi(i * 23 + 7);
      float tall = (0.5 + 0.4 * float(hs & 255u) / 255.0) * u;
      bool isFresh = state == CONTEXT_GAINED && i == full - 1;
      vec2 q = p - vec2(h.inner + 0.4 * u + (float(i) + 0.5) * sp, bottom - 1.2 * u);
      vec3 sheet = isFresh ? lift(mix(INK_YELLOW, CREAM, 0.4), k) : paper;
      float pileFront = box(q + vec2(0.0, 0.5 * tall), vec2(0.45 * u, 0.5 * tall));
      float pileTop = box(q + vec2(0.0, tall + 0.2 * u), vec2(0.45 * u, 0.2 * u));
      sky = ink(sky, mix(sheet, keyInk(k), step(0.7, fract(q.y / (0.12 * u))) * 0.45), pileFront, 1.0);
      sky = ink(sky, sheet, pileTop, 1.0);
      sky = ink(sky, keyInk(k), abs(min(pileFront, pileTop)) - 0.04 * u, 0.6);
    }
  }
  vec2 res = vec2(h.inner + 0.68 * h.width, bottom - 0.8 * u);
  if (abs(p.x - res.x) > 4.0 * u) return sky;
  // The pulpit: its top seen from above, its front in dark wood with a brass
  // rail and a brass seal.
  vec2 q = p - res;
  float pfront = box(q + vec2(0.0, 0.65 * u), vec2(2.8, 0.65) * u);
  float ptop = box(q + vec2(0.0, 1.65 * u), vec2(2.8, 0.35) * u);
  vec3 wood = indoor(mix(WOOD, INK_INDIGO, 0.2), k, nt, 1.0);
  sky = ink(sky, mix(wood, mix(wood, INK_INDIGO, 0.4), screen(p, 0.35, pitch(u), 75.0)), pfront, 1.0);
  sky = ink(sky, tone(BRASS, k), max(pfront, abs(q.y + 1.15 * u) - 0.1 * u), 1.0);
  sky = ink(sky, tone(BRASS, k), length(q + vec2(0.0, 0.55 * u)) - 0.32 * u, 1.0);
  sky = ink(sky, indoor(mix(WOOD, CREAM, 0.35), k, nt, 1.0), ptop, 1.0);
  sky = ink(sky, keyInk(k), abs(min(pfront, ptop)) - 0.05 * u, 0.7);
  // The banker's lamp: a brass stem, its green shade, its light on the
  // pulpit's top.
  vec2 lq = q - vec2(-2.2 * u, -1.75 * u);
  if (abs(lq.x) < 1.3 * u && lq.y < 0.6 * u && lq.y > -1.4 * u) {
    if (ptop < 0.0) sky = mix(sky, lift(INK_YELLOW, k), screen(p, 0.75 * exp(-length(lq) / (0.5 * u)), pitch(u), 0.0));
    sky = ink(sky, tone(BRASS, k), min(max(abs(lq.x) - 0.07 * u, max(lq.y, -lq.y - 0.8 * u)), box(lq, vec2(0.3, 0.06) * u)), 1.0);
    sky = ink(sky, lift(INK_GREEN, k), max(length((lq + vec2(0.0, 0.8 * u)) / vec2(0.6, 0.3)) - u, lq.y + 0.8 * u), 1.0);
  }
  sky = jenga(sky, p, u, k, res + vec2(2.1 * u, -1.6 * u), bottom - 0.2 * u, fall);
  if (!humming) return sky;
  // The hum: three notes rising from over his head and drifting off to the
  // right, each a third of the way behind the last.
  for (int i = 0; i < 3; i++) {
    float f = fract(iTime * 0.4 + float(i) / 3.0);
    vec2 nq = p - vec2(res.x + (0.9 + 1.6 * f) * u, res.y - 1.5 * u - 4.5 * h.rc - 2.2 * f * u);
    float note = min(length(nq / vec2(1.3, 1.0)) - 0.22 * u, min(max(abs(nq.x - 0.26 * u) - 0.05 * u, abs(nq.y + 0.42 * u) - 0.42 * u), segment(nq, vec2(0.26 * u, -0.84 * u), vec2(0.55 * u, -0.5 * u)) - 0.06 * u));
    sky = ink(sky, lift(CREAM, k), note, 1.0);
    sky = ink(sky, keyInk(k), abs(note) - 0.04 * u, 0.6);
  }
  return sky;
}

// While a command runs, BUY and SELL in bubbles over the traders of every
// other row, the same lots whoAt fills, but none hidden behind a post; three
// in four of them shouting, over a post's screens too. One sky_glyph for
// every bubble.
vec3 shouts(vec3 sky, vec2 p, float u, float k, Hall h, Market m) {
  if (p.x < h.inner) return sky;
  float lot = h.width / 8.0;
  float base = h.floorY + h.row - 2.45 * u;
  float j = clamp(floor((p.y - base) / (2.0 * h.row) + 0.5), 0.0, 6.0);
  float by = base + j * 2.0 * h.row;
  if (abs(p.y - by) > 1.0 * u) return sky;
  int row = 2 * int(j);
  int col = int(floor((p.x - h.inner) / lot));
  float cx = h.inner + (float(col) + 0.5) * lot;
  uint hs = hashi(int(mod(float(col), 512.0)) * 31 + row * 977 + 11);
  bool isAgent = row == 12 && col < sky_agents();
  if ((!isAgent && float(hs & 1023u) / 1023.0 >= traderChance(h, m, row, cx)) || ((row + 1) % 4 == 3 && postGap(h, row + 1, cx) < 3.3 * u)) return sky;
  if (((hs >> 12) & 3u) == 0u || cx < h.inner + 0.9 * u || (row == 10 && abs(cx - h.inner - 5.0 / 6.0 * h.width) < 2.6 * u)) return sky;
  bool isSell = ((hs >> 14) & 1u) == 1u;
  vec2 bq = p - vec2(cx, by);
  float bubble = min(box(bq, vec2(1.1, 0.35) * u) - 0.12 * u, max(abs(bq.x + 0.25 * u - 0.5 * (bq.y - 0.47 * u)) - 0.1 * u, abs(bq.y - 0.6 * u) - 0.15 * u));
  if (bubble > 0.08 * u) return sky;
  if (bubble > 0.0) return mix(sky, keyInk(k), 0.9);
  float g = h.g;
  int len = isSell ? 4 : 3;
  float x0 = cx - 2.0 * g * float(len);
  int i = int(floor((p.x - x0) / (4.0 * g)));
  int code = i < 0 || i >= len ? sky_GLYPH_SPACE : codeIn(isSell ? WORD_SELL : WORD_BUY, i);
  vec3 c = lift(isSell ? RED : INK_GREEN, k);
  return mix(lift(CREAM, k), c, sky_glyph(p, vec2(x0 + 4.0 * g * float(i), by - 2.5 * g), g, code));
}

// Paper in the hall's air: a few order slips fluttering down while the floor
// trades, a storm of them while Claude edits, confetti in every ink while a
// bell rings or bitcoin is 5 % or more up on its day, and notes drifting
// over the whole floor while it hums. One cell, one hash, one slip, the
// cells falling as one.
vec3 slips(vec3 sky, vec2 p, float u, float k, Hall h, float density, bool party, bool notes) {
  if (density <= 0.0 || p.x < h.inner || p.y < h.wallTop || p.y > h.front) return sky;
  float cs = 1.6 * u;
  vec2 q = vec2(p.x - h.inner, p.y - h.wallTop - mod(iTime * 1.3 * u, 64.0 * cs));
  vec2 cell = floor(q / cs);
  uint hs = hashi(int(mod(cell.y, 64.0)) * 97 + int(cell.x) * 13 + 5);
  if (float(hs & 1023u) / 1023.0 > density) return sky;
  vec2 at = (cell + vec2(0.25 + 0.5 * float((hs >> 10) & 255u) / 255.0, 0.5)) * cs + vec2(0.25 * u * sin(iTime * 1.7 + float(hs & 63u)), 0.0);
  vec2 nq = q - at;
  float slip = notes ? min(length(nq / vec2(1.3, 1.0)) - 0.22 * u, min(max(abs(nq.x - 0.26 * u) - 0.05 * u, abs(nq.y + 0.42 * u) - 0.42 * u), segment(nq, vec2(0.26 * u, -0.84 * u), vec2(0.55 * u, -0.5 * u)) - 0.06 * u)) : paperSlip(nq, iTime * (1.2 + 0.25 * float((hs >> 18) & 7u)) + float(hs & 31u), u);
  int pick = int((hs >> 21) % 5u);
  vec3 color = !party ? CREAM : pick == 0 ? INK_PINK : pick == 1 ? INK_YELLOW : pick == 2 ? INK_BLUE : pick == 3 ? INK_GREEN : INK_VIOLET;
  sky = ink(sky, lift(color, k), slip, 0.95);
  return ink(sky, keyInk(k), abs(slip) - 0.03 * u, 0.45);
}

// The Charging Bull let loose on the floor, galloping along the aisle in
// front of the middle posts: in at the door and out at the right, then back
// again, facing the way he runs; his body, haunch and the hump of his
// shoulders, his head down with its horns, four legs striding and his tail
// lashed up, in bronze outlined in the key plate.
vec3 bull(vec3 sky, vec2 p, float u, float k, Hall h, float t) {
  float s = 1.25 * u;
  float run = 0.5 - 0.5 * cos(2.0 * PI * t);
  float dir = t < 0.5 ? 1.0 : -1.0;
  vec2 at = vec2(mix(h.left - 2.0 * s, iResolution.x + 3.0 * s, run), h.floorY + 9.6 * h.row);
  vec2 q = (p - at) / s;
  q.x *= dir;
  if (abs(q.x) > 2.7 || q.y < -2.3 || q.y > 0.2) return sky;
  float st = 0.25 * sin(iTime * 10.0);
  float body = 0.6 * (length((q - vec2(-0.1, -1.25)) / vec2(1.45, 0.6)) - 1.0);
  body = smin(body, length(q - vec2(-1.0, -1.35)) - 0.6, 0.2);
  body = smin(body, length(q - vec2(0.75, -1.45)) - 0.68, 0.2);
  body = smin(body, length(q - vec2(1.75, -0.95)) - 0.4, 0.25);
  float horns = min(limb(q, vec2(1.8, -1.25), vec2(2.3, -1.75), 0.1, 0.04), limb(q, vec2(1.55, -1.3), vec2(1.75, -1.9), 0.1, 0.04));
  float legs = min(min(limb(q, vec2(-1.15, -1.0), vec2(-1.35 - st, 0.0), 0.2, 0.11), limb(q, vec2(-0.75, -1.0), vec2(-0.55 + st, 0.0), 0.2, 0.11)), min(limb(q, vec2(0.75, -1.0), vec2(1.1 + st, -0.05), 0.2, 0.11), limb(q, vec2(1.05, -1.0), vec2(0.85 - st, 0.0), 0.2, 0.11)));
  float tail = limb(q, vec2(-1.55, -1.55), vec2(-2.05, -2.05), 0.07, 0.05);
  float shape = min(min(body, horns), min(legs, tail)) * s;
  vec3 bronze = lift(BRONZE, k);
  bronze = mix(bronze, mix(bronze, INK_INDIGO, 0.4), screen(p, smoothstep(-1.7, -0.6, q.y), pitch(u), 45.0));
  sky = ink(sky, bronze, shape, 1.0);
  return ink(sky, keyInk(k), abs(shape - 0.04 * u) - 0.05 * u, 0.6);
}

// What the resident is about, by precedence: the halt lamp first (he points
// up at it while Claude asks, both arms up once it is done), then the bell,
// the hum, sleep, the web on his brick of a phone, the paper while Claude
// reads, a command shouted, else watching the floor.
int residentPose(Market m, int tool, bool humming) {
  if (WAITING == 1) return POSE_POINT;
  if (WAITING == 2 || m.bell > 0.5) return POSE_UP;
  if (humming) return POSE_THUMP;
  if (CLAWD_ASLEEP > 0.5) return POSE_SLEEP;
  if (tool == sky_TOOL_WEB) return POSE_PHONE;
  if (tool == sky_TOOL_READ) return POSE_READ;
  return tool == sky_TOOL_COMMAND ? POSE_UP : POSE_STAND;
}

// The pose the whole floor takes, or -1 for each his own: arms up and
// shouting for a command, the bell or the bull; thumping their chests with
// the resident; reading the paper while Claude reads; on the phone for the
// web; pointing out orders while Claude edits.
int crowdPose(Market m, int tool, bool humming, bool charging) {
  if (tool == sky_TOOL_COMMAND || m.bell > 0.5 || charging) return POSE_UP;
  if (humming) return POSE_THUMP;
  if (tool == sky_TOOL_READ) return POSE_READ;
  if (tool == sky_TOOL_WEB) return POSE_PHONE;
  return tool == sky_TOOL_EDIT ? POSE_POINT : -1;
}

// The people of the floor and the posts among them, the others, what stands
// in front of them, the bull, the shouts and the paper in the air.
vec3 resident(vec3 sky, vec2 p, float u, float k) {
  Hall h = hallOf(u);
  if (p.x < h.walk - u || p.y < h.wallTop) return sky;
  Market m = marketOf();
  int tool = sky_tool();
  int state = contextState();
  float nt = night();
  float seed;
  float t;
  float runT;
  bool humming = eventUp(0, seed, t);
  bool charging = eventUp(1, seed, runT);
  // A command, the bell and the events bring their own crowd onto an empty
  // floor: the hall shouts, cheers and hums with people in it.
  if (tool == sky_TOOL_COMMAND || m.bell > 0.5 || humming || charging) m.fill = max(m.fill, 0.75);
  int beat = int(floor(iTime * 2.0)) % 2;
  sky = figure(sky, p, whoAt(p, h, m, sky_agents(), crowdPose(m, tool, humming, charging), state, residentPose(m, tool, humming)), k, beat);
  sky = post(sky, p, u, k, h, m, tool, nt);
  float age = mod(iTime, 60.0);
  float fall = THEME_FORCE == 2 ? (age < 50.0 ? smoothstep(0.0, 1.4, age) : 0.0) : sky_QUOTE_PRICE[sky_NDX] > 0.0 && sky_QUOTE_CHANGE[sky_NDX] < -2.0 ? 1.0 : 0.0;
  sky = frontStrip(sky, p, u, k, h, fall, humming, contextFish(), state, nt);
  if (charging) sky = bull(sky, p, u, k, h, runT);
  if (tool == sky_TOOL_COMMAND) sky = shouts(sky, p, u, k, h, m);
  bool party = m.bell > 0.5 || (sky_QUOTE_PRICE[sky_BTC] > 0.0 && sky_QUOTE_CHANGE[sky_BTC] >= 5.0);
  float density = humming ? 0.3 : tool == sky_TOOL_EDIT ? 0.42 : party ? 0.4 : m.fill > 0.9 ? 0.03 : 0.0;
  return slips(sky, p, u, k, h, density, party, humming);
}

// The chest thump (0) and the bull run (1) are drawn indoors by resident(),
// so nothing is drawn here.
vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind) {
  return sky;
}

// Open air outside the west wall and in the windows' panes; the wall, the
// hall and everything in it otherwise.
float themeWindow(vec2 p, float u) {
  Hall h = hallOf(u);
  if (p.x < h.left) return 1.0;
  return isPane(p, h) ? 1.0 : 0.0;
}
