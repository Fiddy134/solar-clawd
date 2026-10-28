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
const vec3 VERDIGRIS = mix(mix(INK_GREEN, INK_BLUE, 0.35), INK_INDIGO, 0.45);
const vec3 BULL = mix(BRASS, WOOD, 0.55);
const vec3 BULB = vec3(1.0, 0.97, 0.9);
const vec3 LAMPLIGHT = mix(INK_YELLOW, CREAM, 0.4);

// A colour of the hall as its own lamps light it: its day colour by day,
// warmer by night under its lamps (the warmer the more of them are on) and
// only a little toward indigo, and darker by night again while only the
// cleaners' lamps are on.
vec3 indoor(vec3 day, float k, float nt, float lights) {
  vec3 c = mix(day, mix(mix(day, INK_ORANGE, 0.12 + 0.1 * lights), INK_INDIGO, 0.3 - 0.12 * lights), nt);
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


// Quote r's price and its day, each picked from the arrays by a constant
// index: the arrays are constants, so each pick is a literal, where an index
// worked out at run time would make the renderer build the whole array.
float priceOf(int r) {
  return r == 0 ? sky_QUOTE_PRICE[sky_BTC] : r == 1 ? sky_QUOTE_PRICE[sky_ETH] : r == 2 ? sky_QUOTE_PRICE[sky_NDX] : r == 3 ? sky_QUOTE_PRICE[sky_AAPL] : r == 4 ? sky_QUOTE_PRICE[sky_MSFT] : r == 5 ? sky_QUOTE_PRICE[sky_NVDA] : r == 6 ? sky_QUOTE_PRICE[sky_GOOGL] : r == 7 ? sky_QUOTE_PRICE[sky_AMZN] : r == 8 ? sky_QUOTE_PRICE[sky_META] : sky_QUOTE_PRICE[sky_TSLA];
}
float changeOf(int r) {
  return r == 0 ? sky_QUOTE_CHANGE[sky_BTC] : r == 1 ? sky_QUOTE_CHANGE[sky_ETH] : r == 2 ? sky_QUOTE_CHANGE[sky_NDX] : r == 3 ? sky_QUOTE_CHANGE[sky_AAPL] : r == 4 ? sky_QUOTE_CHANGE[sky_MSFT] : r == 5 ? sky_QUOTE_CHANGE[sky_NVDA] : r == 6 ? sky_QUOTE_CHANGE[sky_GOOGL] : r == 7 ? sky_QUOTE_CHANGE[sky_AMZN] : r == 8 ? sky_QUOTE_CHANGE[sky_META] : sky_QUOTE_CHANGE[sky_TSLA];
}

// Quote r's name, five letters packed six bits a letter, the first in the
// lowest bits, blanks after it.
uint nameOf(int r) {
  return r == 0 ? 613467979u : r == 1 ? 613488462u : r == 2 ? 613552983u : r == 3 ? 609587850u : r == 4 ? 611645206u : r == 5 ? 606656471u : r == 6 ? 356615696u : r == 7 ? 610153866u : r == 8 ? 606720918u : 606689053u;
}

// A number to print: its value, its width in columns, its decimals and
// the column of it wanted; c below 0 for none.
struct Num { float v; int w; int d; int c; };

// The code in column col of quote r: on the tape (twenty columns) its name,
// its price to five figures, an arrow up or down and its day in percent; on
// a screen (six) its price alone; dashes while its price is not known. A
// digit of a number is left to the caller, as -1 with the number in n, so
// that one sky_numberCode prints every number of a function.
int quoteCell(int r, int col, bool isTape, inout Num n) {
  float price = priceOf(r);
  float chg = changeOf(r);
  int decimals = price >= 10000.0 ? 0 : price >= 1000.0 ? 1 : price >= 100.0 ? 2 : 3;
  if (!isTape) {
    if (price <= 0.0) return col >= 2 && col <= 4 ? sky_GLYPH_MINUS : sky_GLYPH_SPACE;
    n = Num(price, 6, decimals, col);
    return -1;
  }
  if (col < 5) return int((nameOf(r) >> uint(6 * col)) & 63u);
  if (price <= 0.0) return (col >= 8 && col <= 11) || (col >= 15 && col <= 17) ? sky_GLYPH_MINUS : sky_GLYPH_SPACE;
  if (col == 13) return chg < 0.0 ? sky_GLYPH_DOWN : sky_GLYPH_UP;
  if (col == 19) return sky_GLYPH_PERCENT;
  bool isPrice = col >= 6 && col <= 11;
  if (!isPrice && (col < 14 || col > 18)) return sky_GLYPH_SPACE;
  n = Num(abs(chg), 5, abs(chg) >= 10.0 ? 1 : 2, col - 14);
  if (isPrice) n = Num(price, 6, decimals, col - 6);
  return -1;
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
  bool isCanton = q.x < 0.4 * size.x && q.y < 0.54 * size.y;
  int stripe = int(floor(q.y / size.y * 7.0));
  vec3 c = isCanton ? mix(NAVY, INK_BLUE, 0.4) : stripe % 2 == 0 ? RED : CREAM;
  return vec4(c, 1.0);
}

// The sidewalk outside the west wall, under the text's last columns: stone
// plates in calm, low tones, its curb a crisp line and the street beyond
// fading out in dots; its lamps by the curb; the flags on their poles; and
// Washington in verdigris on his stepped pedestal, a pigeon on his head.
// Each thing is a distance and the nearest wins, so the colour is chosen
// once and brought down once to the sky's lightness behind the text (by
// night tinted by the night sky, so the plates and their seams still show);
// only the lights are laid over it: the lanterns by night and the door's
// light on the plates.
vec3 sidewalk(vec3 sky, vec2 p, float u, float k, Hall h, float nt) {
  if (p.y < h.floorY - u || p.x < h.walk - 1.25 * u) return sky;
  float x = p.x - h.walk;
  vec2 v = vec2(x, p.y - h.floorY);
  vec2 at = mod(v, 2.0 * u) - u;
  uint hs = hashi(int(floor(v.x / (2.0 * u))) * 71 + int(floor(v.y / (2.0 * u))) * 313 + 3);
  vec3 col = mix(STONE, INK_VIOLET, 0.12 + 0.05 * float(hs & 3u)) * 0.78;
  if (u - max(abs(at.x), abs(at.y)) < 0.06 * u || x < 0.3 * u) col = mix(col, INK_INDIGO, 0.3);
  float a = smoothstep(h.floorY - u, h.floorY + 2.0 * u, p.y);
  if (x < 0.0) {
    col = INK_INDIGO * (x > -0.25 * u ? 0.8 : 0.55);
    if (x < -0.25 * u) a *= screen(p, 0.6 * (1.0 + (x + 0.25 * u) / u), pitch(u), 0.0);
  }
  // A lamp: its post and its lantern.
  float along = v.y / u;
  vec2 lq = p - vec2(h.walk + 1.2 * u, h.floorY + nearest(along + 2.0, vec3(6.0, 19.5, 31.0)) * u);
  vec2 lantern = lq + vec2(0.0, 2.45 * u);
  float glass = box(lantern, vec2(0.2, 0.26) * u);
  if (min(max(abs(lq.x) - 0.08 * u, max(lq.y, -2.2 * u - lq.y)), min(box(lq + vec2(0.0, 0.1 * u), vec2(0.22, 0.12) * u), glass - 0.07 * u)) < 0.0) col = NAVY * 0.8;
  // A flag on its pole out of the wall, hanging from it.
  vec2 root = vec2(h.left, h.floorY + nearest(along, vec3(2.5, 16.5, 27.5)) * u);
  vec4 f = smallFlag(vec2(p.x - h.left + 3.4 * u, p.y - root.y + 1.3 * (h.left - p.x) / 3.6), vec2(2.1, 1.4) * u, u);
  if (f.a > 0.0) col = mix(f.rgb, col, 0.2);
  if (segment(p, root, root + vec2(-3.6 * u, -1.3 * u)) < 0.06 * u) col = BRASS;
  // Washington: his pedestal on its step, his coat widening to its skirts,
  // his legs, his head, his arm out over the street, the fasces his other
  // hand rests on, lit from the left; and a pigeon on his head.
  vec2 sq = (p - vec2(h.left - 1.8 * u, h.floorY + 13.0 * u)) / 1.8;
  float ped = min(box(sq + vec2(0.0, 0.75 * u), vec2(0.8, 0.75) * u), box(sq + vec2(0.0, 0.12 * u), vec2(0.95, 0.12) * u));
  if (ped < 0.0) col = sq.y < -1.0 * u ? STONE : mix(STONE, INK_INDIGO, sq.y > -0.24 * u ? 0.15 : 0.3);
  vec2 b = sq + vec2(0.0, 1.3 * u);
  float body = box(b + vec2(0.0, 1.1 * u), vec2(0.3 * u + 0.12 * (b.y + 1.6 * u), 0.5 * u));
  body = min(body, box(vec2(abs(b.x) - 0.15 * u, b.y + 0.3 * u), vec2(0.08, 0.3) * u));
  body = min(body, length(b + vec2(0.0, 1.95 * u)) - 0.26 * u);
  body = min(body, segment(b, vec2(-0.25 * u, -1.5 * u), vec2(-0.8 * u, -1.15 * u)) - 0.09 * u);
  body = min(body, box(b + vec2(-0.55 * u, 0.4 * u), vec2(0.1, 0.42) * u));
  if (body < 0.0) col = b.x < -0.1 * u ? mix(VERDIGRIS, CREAM, 0.22) : VERDIGRIS;
  if (abs(body) < 0.04 * u || abs(ped) < 0.04 * u) col = mix(col, INK_INDIGO, 0.5);
  float bird = min(length((b - vec2(0.02 * u, -2.33 * u)) / vec2(1.5, 1.0)) - 0.13 * u, length(b - vec2(0.2 * u, -2.43 * u)) - 0.08 * u);
  if (bird < 0.0) col = length(b - vec2(0.23 * u, -2.45 * u)) * 1.8 < 0.9 ? INK_INDIGO : mix(CREAM, INK_INDIGO, 0.15);
  sky = mix(sky, sky_under(mix(tone(col, k), sky * 2.6 * mix(vec3(luminance(col)), col, 0.4), 0.8 * nt), sky), a);
  // The lights: the door's on the plates, and the lanterns by night.
  vec2 door = vec2(h.left, 0.5 * (h.doorTop + h.doorBot));
  float glow = 0.4 * exp(-length((p - door) / vec2(1.0, 1.3)) / (0.9 * u)) + 0.4 * exp(-length(lantern) / (0.8 * u));
  sky = mix(sky, INK_YELLOW, 0.85 * screen(p, nt * glow * step(0.0, x), pitch(u), 0.0));
  return glass < 0.0 ? (nt > 0.3 ? mix(INK_YELLOW, CREAM, 0.3) : sky_under(tone(NAVY, k), sky)) : sky;
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
// stripes falling in folds, its canton dotted with stars; lit by the room.
vec3 bigFlag(vec3 sky, vec2 p, float u, float k, Hall h, float nt, float lights) {
  vec2 q = p - vec2(h.inner + 0.5 * h.width - 2.8 * u, 9.1 * u);
  if (q.x < -0.4 * u || q.x > 6.0 * u || q.y < -0.4 * u || q.y > 5.1 * u) return sky;
  if (q.y < 0.0) return ink(sky, indoor(BRASS, k, nt, lights), min(box(q - vec2(2.8 * u, -0.15 * u), vec2(3.0, 0.08) * u), length(q - vec2(-0.2 * u, -0.15 * u)) - 0.15 * u), 1.0);
  float x = q.x;
  if (x < 0.0 || x > 5.6 * u || q.y > 4.8 * u) return sky;
  int stripe = int(floor(q.y / (4.8 * u) * 13.0));
  bool isCanton = x < 2.4 * u && stripe < 7;
  vec3 c = isCanton ? mix(NAVY, INK_BLUE, 0.35) : stripe % 2 == 0 ? RED : CREAM;
  if (isCanton && length(fract(vec2(x, q.y) / (0.4 * u)) - 0.5) < 0.2) c = CREAM;
  c = indoor(c, k, nt, lights) * (fract(x / (1.4 * u)) > 0.72 ? 0.86 : 1.0);
  return x < 0.06 * u || x > 5.54 * u ? mix(c, keyInk(k), 0.6) : c;
}

// New York's clock on the left pier, its hands at the hour there.
vec3 nyClock(vec3 sky, vec2 p, float u, float k, vec2 at) {
  vec2 q = p - at;
  float r = u;
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
// a sign. While nothing waits a fitting on the wall, its lamps smoked brass
// with brass rims and its sign dark slate; orange and glowing, the sign saying
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
  vec3 smoked = tone(mix(BRASS, INK_INDIGO, 0.6), k);
  vec3 rim = WAITING == 0 ? tone(BRASS, k) : keyInk(k);
  sky = ink(sky, smoked, max(abs(p.x - mid) - 0.3 * u, max(dome.y - p.y, p.y - plate.y)), 1.0);
  if (WAITING != 0) {
    sky = mix(sky, light, screen(p, pulse * exp(-max(0.0, d) / reach), pitch(u), 15.0));
    if (urgent) sky = mix(sky, light, screen(p, pulse * exp(-max(0.0, sides) / (0.8 * u)), pitch(u), 75.0));
    if (WAITING == 2) sky = mix(sky, light, screen(p, 0.6 * exp(-max(0.0, pd) / (0.7 * u)), pitch(u), 0.0));
  }
  sky = ink(sky, WAITING != 0 ? light : smoked, d, 1.0);
  sky = ink(sky, rim, abs(d) - 0.06 * u, 0.8);
  sky = ink(sky, tone(WAITING == 0 ? mix(NAVY, INK_INDIGO, 0.3) : INK_INDIGO, k) * (WAITING == 0 ? 0.62 : 0.55), pd, 1.0);
  sky = ink(sky, tone(BRASS, k), abs(pd) - 0.08 * u, 1.0);
  sky = ink(sky, urgent ? light : smoked, sides, 1.0);
  return ink(sky, rim, abs(sides) - 0.05 * u, 0.8);
}

// Post `which`'s stock: the seven by number, the coin desk bitcoin and ether
// by turns.
int postQuote(int which) { return which == 7 ? int(mod(floor(iTime / 10.0), 2.0)) : 3 + which; }

// The trading post nearest p, or at the front right the coin desk: a box
// seen from above and in front, `foot` the middle of its front edge on its
// row's front line; `which` 0 to 6 the posts by row and 7 the desk; its
// front's height, its top's depth and half its width. Only one can be near
// p: the post rows are four apart and a post reaches up less than two.
struct Post { float x; float foot; int which; float fh; float td; float hw; };

Post postAt(vec2 p, Hall h) {
  Post o;
  int row = 3 + 4 * int(clamp(floor((p.y - h.floorY - 4.3 * h.u) / (4.0 * h.row)), 0.0, 2.0));
  float f = (p.x - h.inner) / h.width * 6.0;
  float cc = row == 7 ? clamp(2.0 * floor((f + 1.0) / 2.0), 2.0, 4.0) : clamp(2.0 * floor(f / 2.0) + 1.0, 1.0, 5.0);
  o.x = h.inner + cc / 6.0 * h.width;
  o.which = row == 3 ? int(cc - 1.0) / 2 : row == 7 ? 2 + int(cc) / 2 : 5 + int(cc - 1.0) / 2;
  o.fh = 1.8 * h.u;
  o.td = (o.which == 7 ? 0.9 : 1.5) * h.u;
  o.hw = 2.75 * h.u;
  o.foot = h.floorY + float(row + 1) * h.row;
  return o;
}

// Which face of post o q (p less its foot) is on that no figure ever
// covers: 1 its band of screens, 2 its number plate, 0 neither. Everyone
// stands inside his own row and nobody behind a post, so these are drawn
// with the floor, their letters with the wall's, and post() leaves them be.
int postFace(vec2 q, Post o, float u) {
  if (abs(q.x) < o.hw - 0.2 * u && q.y > -o.fh + 0.1 * u && q.y < -0.18 * u) return 1;
  return o.which != 7 && box(q - vec2(-o.hw + u, -o.fh - 0.45 * u), vec2(0.85, 0.44) * u) < 0.0 ? 2 : 0;
}

// A post's screens and plate, drawn with the floor: the band tinted green or
// red by its stock's day, dark once the floor has closed (but for the late
// trader's post and the coin desk); a page of text scrolling up while Claude
// reads and marching bars while it is busy with something else, at any
// hour; the plate brass. Their letters come with the wall's.
vec3 postScreen(vec3 sky, vec2 p, float u, float k, Hall h, Market m, int tool) {
  if (p.x < h.inner || p.y < h.floorY + 4.2 * u || p.y > h.floorY + 24.4 * u) return sky;
  Post o = postAt(p, h);
  vec2 q = vec2(p.x - o.x, p.y - o.foot);
  int face = postFace(q, o, u);
  if (face == 0) return sky;
  if (face == 2) return box(q - vec2(-o.hw + u, -o.fh - 0.45 * u), vec2(0.85, 0.44) * u) > -0.06 * u ? keyInk(k) : tone(BRASS, k);
  bool isDesk = o.which == 7;
  float chg = changeOf(postQuote(o.which));
  bool isOn = isDesk || m.staffed || (o.which == 3 && m.late);
  float heat = isOn && priceOf(postQuote(o.which)) > 0.0 ? clamp(abs(chg) / 3.0, 0.25, 0.7) : 0.0;
  vec3 col = mix(tone(INK_INDIGO, k) * 0.5, tone(chg < 0.0 ? RED : INK_GREEN, k) * 0.7, heat);
  if (tool == sky_TOOL_OTHER && !isDesk) {
    bool isBar = fract((q.x - iTime * 1.5 * u) / (0.9 * u)) < 0.45 && abs(q.y + 0.5 * o.fh) < 0.25 * o.fh;
    col = isBar ? lift(mix(INK_BLUE, CREAM, 0.5), k) : tone(mix(INK_BLUE, INK_INDIGO, 0.5), k);
  } else if (tool == sky_TOOL_READ && !isDesk) {
    float ly = q.y + mod(iTime * 0.6 * u, 64.0 * 0.3 * u);
    float n = floor(ly / (0.3 * u));
    float reach = (0.45 + 0.5 * rand(int(mod(n, 64.0)) * 7 + o.which)) * 2.0 * (o.hw - 0.45 * u);
    bool isLine = fract(ly / (0.3 * u)) < 0.4 && q.x + o.hw - 0.45 * u < reach;
    col = isLine ? keyInk(k) : lift(mix(CREAM, INK_BLUE, 0.06), k);
  }
  return col;
}

// The trading post p may be over, or at the front right the coin desk, as a
// box seen from above and in front. Drawn after the people, so that it
// covers whoever stands behind it; nobody stands in front of it within its
// own height. On its top, seen from above, a deep counter of pale wood with
// rounded back corners, its number plate and a coffee steaming on it;
// monitors stand on its back edge, boxes with a dark top over a lit front.
// Its front is dark round its screens, a brass kick at its foot, and its
// shadow falls on the floor below it and to its right. The desk is lower,
// with two laptops. Its screens and its plate are the floor's (postFace).
vec3 post(vec3 sky, vec2 p, float u, float k, Hall h, Market m, float nt) {
  if (p.x < h.inner || p.y < h.floorY + 4.2 * u || p.y > h.floorY + 24.6 * u) return sky;
  Post o = postAt(p, h);
  bool isDesk = o.which == 7;
  float hw = o.hw;
  float fh = o.fh;
  vec2 q = vec2(p.x - o.x, p.y - o.foot);
  float top = -fh - o.td;
  if (q.x < -hw || q.x > hw + 0.4 * u || q.y > 0.5 * u || q.y < top - 0.4 * u || postFace(q, o, u) != 0) return sky;
  if (q.y > 0.0 || q.x > hw) return q.y > top + 0.5 * u && q.x > 0.4 * u - hw ? mix(sky, keyInk(k), 0.5 * screen(p, 0.55, pitch(u), 0.0)) : sky;
  float chg = changeOf(postQuote(o.which));
  bool isOn = isDesk || m.staffed || (o.which == 3 && m.late);
  uint hs = hashi(o.which * 41 + 7);
  // The monitors on the back of its top, or the desk's two laptops.
  float n = isDesk ? 1.4 : 1.7;
  vec2 mq = vec2(q.x - clamp(floor(q.x / (n * u) + 0.5), -1.0, 1.0) * n * u, q.y - top - (isDesk ? 0.0 : 0.05) * u);
  float frame = box(mq, (isDesk ? vec2(0.45, 0.25) : vec2(0.55, 0.4)) * u);
  if (frame < 0.0 && !(isDesk && abs(q.x) < 0.5 * u)) {
    if (frame > -0.07 * u) return keyInk(k);
    if (mq.y < (isDesk ? -0.1 : -0.15) * u) return indoor(mix(NAVY, INK_INDIGO, 0.5), k, nt, 1.0);
    vec3 glow = isDesk ? INK_GREEN : mix(INK_BLUE, INK_GREEN, step(0.5, float((hs >> 8) & 1u)));
    vec3 screenC = isOn ? lift(mix(glow, CREAM, 0.25), k) : tone(INK_INDIGO, k) * 0.6;
    if (isOn && abs(mq.y - 0.12 * u + 0.08 * u * sin(mq.x / (0.18 * u) + float(hs & 15u))) < 0.05 * u) screenC = lift(chg < 0.0 ? RED : INK_GREEN, k);
    return screenC;
  }
  if (q.y < top) return sky;
  vec3 col = indoor(isDesk ? mix(INK_VIOLET, INK_INDIGO, 0.45) : mix(NAVY, INK_INDIGO, 0.25), k, nt, 1.0);
  if (q.y < -fh) {
    // The top seen from above: a counter with rounded back corners, a
    // coffee on it.
    float r = min(0.6 * u, 0.5 * o.td);
    float d = box(vec2(q.x, min(q.y + fh + 0.5 * o.td, 0.0)), vec2(hw - r, 0.5 * o.td - r)) - r;
    if (d > 0.0) return sky;
    col = indoor(isDesk ? mix(INK_VIOLET, CREAM, 0.35) : mix(WOOD, CREAM, 0.55), k, nt, 1.0);
    float c2 = length(q - vec2((float(hs & 255u) / 255.0 - 0.5) * 2.4 * u, -fh - 0.3 * u));
    if (c2 < 0.2 * u && !isDesk) col = c2 < 0.12 * u ? tone(mix(WOOD, INK_INDIGO, 0.4), k) : lift(CREAM, k);
    if (d > -0.06 * u) col = keyInk(k);
  } else if (q.y > -0.18 * u) {
    col = tone(BRASS, k) * 0.8;
  }
  if (abs(q.x) > hw - 0.06 * u || abs(q.y + fh) < 0.06 * u) col = keyInk(k);
  sky = col;
  // Steam off the coffee, while the floor is in.
  vec2 cup = vec2(o.x + (float(hs & 255u) / 255.0 - 0.5) * 2.4 * u, o.foot - fh - 0.45 * u);
  return isOn && !isDesk ? mix(sky, lift(CREAM, k), 0.7 * steam(p, cup, 0.9 * u, 0.22 * u, 0.8, o.which)) : sky;
}

// Every letter of the wall and the posts, one sky_glyphWide for them all:
// NEW YORK STOCK EXCHANGE on the frieze; on each cube NYSE, a name and its
// price, the left one the Nasdaq-100 and the right one each quote in turn,
// the price green or red by its day; the ticker in the skirting, every quote
// sliding left; the halt lamp's word in the light's own colour; and each
// post's name and price on its screens, dim once it has closed, and its
// number on its plate.
vec3 wallWords(vec3 sky, vec2 p, float u, float k, Hall h, Market m, int tool) {
  float g = h.g;
  float gs = g + 1.0;
  Letter l = Letter(p, p, g, sky_GLYPH_SPACE, lift(mix(BRASS, CREAM, 0.35), k));
  Num n = Num(0.0, 1, 0, -1);
  float mid = h.inner + 0.5 * h.width;
  float tapeTop = h.base + 0.6 * u - 2.5 * g;
  float friezeTop = 0.5 * (h.frieze + h.wallTop) - 2.5 * g;
  float cubeTop = 13.3 * u;
  float xc = h.inner + (p.x < mid ? 1.0 : 5.0) / 6.0 * h.width;
  if (p.y >= friezeTop && p.y < friezeTop + 5.0 * g) {
    float x0 = mid - 3.0 * g * 23.0;
    int i = int(floor((p.x - x0) / (6.0 * g)));
    l.code = i < 0 || i > 22 ? sky_GLYPH_SPACE : i < 20 ? codeIn(WORD_FRIEZE, i) : codeIn(WORD_FRIEZE_END, i - 20);
    l.at = vec2(x0 + 6.0 * g * float(i), friezeTop);
  } else if (p.y >= tapeTop && p.y < tapeTop + 5.0 * g && p.x > h.inner) {
    float x = p.x - h.inner + mod(iTime * 5.0 * g, 1320.0 * g);
    int i = int(floor(x / (6.0 * g)));
    int col = i % 22;
    l.q = vec2(x, p.y);
    l.at = vec2(6.0 * g * float(i), tapeTop);
    l.code = col > 19 ? sky_GLYPH_SPACE : quoteCell((i / 22) % 10, col, true, n);
    l.color = lift(col == 13 ? (l.code == sky_GLYPH_DOWN ? mix(RED, CREAM, 0.2) : mix(INK_GREEN, CREAM, 0.25)) : INK_YELLOW, k);
  } else if (abs(p.x - xc) < 2.4 * u && p.y >= cubeTop && p.y < cubeTop + 17.0 * g) {
    int line = int(floor((p.y - cubeTop) / (6.0 * g)));
    int r = p.x < mid ? 2 : int(mod(floor(iTime / 12.0), 10.0));
    int len = line == 0 ? 4 : line == 2 ? 6 : r <= 2 ? 3 : r == 6 ? 5 : 4;
    float x0 = xc - 3.0 * g * float(len);
    int i = int(floor((p.x - x0) / (6.0 * g)));
    l.at = vec2(x0 + 6.0 * g * float(i), cubeTop + 6.0 * g * float(line));
    l.code = i < 0 || i >= len ? sky_GLYPH_SPACE : line == 0 ? codeIn(WORD_NYSE, i) : line == 1 ? int((nameOf(r) >> uint(6 * i)) & 63u) : quoteCell(r, i, false, n);
    float chg = changeOf(r);
    l.color = lift(line == 0 ? CREAM : line == 1 ? INK_YELLOW : mix(chg < 0.0 ? RED : INK_GREEN, CREAM, 0.3), k);
  } else if (WAITING != 0 && abs(p.y - 22.2 * u) < 2.5 * gs) {
    int len = WAITING == 2 ? 6 : 4;
    float x0 = mid - 3.0 * gs * float(len);
    int i = int(floor((p.x - x0) / (6.0 * gs)));
    l.cell = gs;
    l.at = vec2(x0 + 6.0 * gs * float(i), 22.2 * u - 2.5 * gs);
    l.code = i < 0 || i >= len ? sky_GLYPH_SPACE : codeIn(WAITING == 2 ? WORD_FILLED : WORD_HALT, i);
    l.color = WAITING == 2 ? BULB : INK_ORANGE;
  } else if (p.y > h.floorY + 4.2 * u && p.y < h.floorY + 24.4 * u && p.x > h.inner) {
    Post o = postAt(p, h);
    vec2 q = vec2(p.x - o.x, p.y - o.foot);
    int face = postFace(q, o, u);
    int r = postQuote(o.which);
    bool isOn = o.which == 7 || m.staffed || (o.which == 3 && m.late);
    if (face == 1 && (o.which == 7 || (tool != sky_TOOL_OTHER && tool != sky_TOOL_READ))) {
      float sy0 = -o.fh + 0.1 * u;
      float lineTop = o.foot + sy0 + 0.5 * (-0.18 * u - sy0 - 11.0 * g);
      int line = p.y < lineTop + 5.5 * g ? 0 : 1;
      int len = line == 1 ? 6 : r <= 2 ? 3 : r == 6 ? 5 : 4;
      float x0 = o.x - 3.0 * g * float(len);
      int i = int(floor((p.x - x0) / (6.0 * g)));
      l.at = vec2(x0 + 6.0 * g * float(i), lineTop + 6.0 * g * float(line));
      l.code = i < 0 || i >= len ? sky_GLYPH_SPACE : line == 0 ? int((nameOf(r) >> uint(6 * i)) & 63u) : quoteCell(r, i, false, n);
      l.color = !isOn ? mix(tone(INK_INDIGO, k) * 0.5, CREAM, 0.25) : lift(line == 0 ? INK_YELLOW : CREAM, k);
    } else if (face == 2) {
      int number = o.which < 3 ? (o.which == 2 ? 5 : 2 + o.which) : o.which < 5 ? 4 + o.which : 5 + o.which;
      float x0 = o.x - o.hw + u - (number < 10 ? 3.0 : 6.0) * g;
      int i = int(floor((p.x - x0) / (6.0 * g)));
      l.at = vec2(x0 + 6.0 * g * float(i), o.foot - o.fh - 0.45 * u - 2.5 * g);
      l.code = number < 10 ? (i == 0 ? number : sky_GLYPH_SPACE) : (i == 0 ? 1 : i == 1 ? number - 10 : sky_GLYPH_SPACE);
      l.color = keyInk(k);
    }
  }
  if (l.code < 0) l.code = sky_numberCode(n.v, n.w, n.d, n.c);
  return mix(sky, l.color, sky_glyphWide(l.q, l.at, l.cell, l.code));
}

// The floor's planks seen from above, a long board a cell: each board's hash
// picks its shade, the line of its grain and whether an order slip lies on
// it, more of them the busier the day; the joints wander from row to row,
// the long seams in the key plate and the end joints fainter; the floor
// darker toward the back wall, and darker again at the wall's foot.
vec3 planks(vec2 p, float u, float k, Hall h, Market m, float nt, float lights) {
  vec2 tile = vec2(6.0, 0.6) * u;
  vec2 v = (p - vec2(h.inner, h.floorY)) / tile;
  v.x += fract(floor(v.y) * 0.618);
  vec2 c = floor(v);
  vec2 at = (fract(v) - 0.5) * tile;
  uint hs = hashi(int(c.x) * 131 + int(c.y) * 977);
  float back = p.y - h.floorY;
  vec3 wood = indoor(mix(mix(CREAM, mix(INK_ORANGE, INK_YELLOW, 0.3), 0.32), INK_INDIGO, 0.04 + 0.03 * float(hs & 3u)), k, nt, lights);
  wood = mix(wood, mix(wood, mix(INK_ORANGE, INK_INDIGO, 0.3), 0.3), screen(p, 0.08 + 0.07 * float((hs >> 2) & 1u) + 0.25 * exp(-back / (6.0 * u)) + 0.3 * exp(-back / (0.5 * u)), pitch(u), 45.0));
  float seam = 0.5 * tile.y - abs(at.y) < 0.05 * u ? 0.25 : 0.5 * tile.x - abs(at.x) < 0.05 * u ? 0.12 : abs(at.y - (float((hs >> 6) & 7u) / 7.0 - 0.5) * 0.36 * u) < 0.5 ? 0.1 : 0.0;
  wood = mix(wood, keyInk(k), seam);
  if (float((hs >> 4) & 1023u) / 1023.0 < 0.01 + 0.04 * m.fill) wood = ink(wood, lift(CREAM, k), box(at - vec2(float(hs & 7u) - 3.5, 0.0) * 0.12 * u, ((hs & 1u) == 0u ? vec2(0.28, 0.17) : vec2(0.17, 0.25)) * u), 1.0);
  return wood;
}

// The hall's lamps by night on the floor, in warm dots: a pool under each
// ceiling lamp's bay, one before the screens of each post that is lit, and
// one round the banker's lamp on the pulpit.
vec3 floorLight(vec3 sky, vec2 p, float u, Hall h, Market m, float nt, float lights) {
  float third = h.width / 3.0;
  vec2 bay = (p - vec2(h.inner + (clamp(floor((p.x - h.inner) / third), 0.0, 2.0) + 0.5) * third, h.floorY + 3.0 * u)) / vec2(4.0 * u, 2.5 * u);
  float glow = 0.7 * (0.45 + 0.55 * lights) * max(0.0, 1.0 - dot(bay, bay));
  Post o = postAt(p, h);
  if (o.which == 7 || m.staffed || (o.which == 3 && m.late)) glow += 0.7 * exp(-length(vec2(max(abs(p.x - o.x) - o.hw + 0.5 * u, 0.0), p.y - o.foot - 0.6 * u)) / (1.5 * u));
  glow += 0.6 * max(0.0, 1.0 - length(p - vec2(h.inner + 0.68 * h.width - 2.2 * u, iResolution.y - 2.55 * u)) / (2.0 * u));
  return mix(sky, LAMPLIGHT, 0.45 * screen(p, nt * glow, pitch(u), 0.0));
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
  int tool = sky_tool();
  if (p.y >= h.floorY) {
    sky = postScreen(floorLight(planks(p, u, k, h, m, nt, lights), p, u, h, m, nt, lights), p, u, k, h, m, tool);
  } else {
    sky = backWall(sky, p, u, k, h, nt, lights);
    sky = hallLamps(sky, p, u, k, h, nt, lights);
    sky = nyClock(sky, p, u, k, vec2(h.inner + h.width / 3.0, 16.2 * u));
    sky = bell(sky, p, u, k, vec2(h.inner + 2.0 * h.width / 3.0, 15.4 * u), m.bell > 0.5);
    sky = bigFlag(sky, p, u, k, h, nt, lights);
    sky = cubes(sky, p, u, k, h, tool == sky_TOOL_WEB);
    sky = haltLamp(sky, p, u, k, h);
  }
  return wallWords(sky, p, u, k, h, m, tool);
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
struct Who { vec2 feet; float cell; int pose; int gear; vec3 coat; int look; float dim; int stride; bool outside; bool jacket; };

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
// outdoors; a trader's coat a jacket, its skirts over the top of his legs
// and its lapels a V round his shirt at his neck; his key plate a pixel or so off register
// down and to the right, and his shadow on the ground under his feet.
vec3 figure(vec3 sky, vec2 p, float u, Who w, float k, int beat) {
  float c = w.cell;
  vec2 origin = floor(w.feet - vec2(3.0 * c, 4.0 * c) + 0.5);
  if (p.x < origin.x - c || p.x > origin.x + 9.0 * c || p.y < origin.y - 2.0 * c || p.y > origin.y + 5.0 * c) return sky;
  vec2 lp = p - origin;
  int kind = figureCell(ivec2(floor(lp / c)), w.pose, w.gear, w.look, beat, w.stride);
  if (w.jacket) {
    float lapel = abs(lp.x - 3.0 * c) - 0.8 * (3.0 * c - lp.y);
    if (kind == 4 && lapel < 0.5) kind = lapel > -0.5 ? 2 : 6;
    if (lp.y >= 3.0 * c && lp.y < 3.45 * c && lp.x >= c && lp.x < 5.0 * c) kind = 4;
  }
  if (kind == 2) return mix(sky, keyInk(k), 0.97);
  if (kind != 0) {
    vec3 body = kind == 1 ? CORAL : kind == 3 ? mix(CORAL, INK_INDIGO, 0.22) : kind == 4 ? w.coat : kind == 5 ? mix(INK_INDIGO, CREAM, 0.12) : kind == 6 ? CREAM : kind == 7 ? mix(INK_INDIGO, CREAM, 0.4) : kind == 8 ? WOOD : mix(CREAM, INK_BLUE, 0.25);
    return mix(sky, w.outside ? nightInk(body, k) : mix(lift(body, k), keyInk(k), w.dim), 0.97);
  }
  // The key plate: his head, body and arms again, a pixel or so off.
  ivec2 s = ivec2(floor((p - vec2(max(1.0, floor(0.4 * c))) - origin) / c));
  bool isShadow = s.y >= 0 && s.y <= 2 && s.x >= (s.y == 2 ? 0 : 1) && s.x <= (s.y == 2 ? 5 : 4);
  if (isShadow || (s.y == 3 && (s.x == 1 || s.x == 4))) return mix(sky, keyInk(k), 0.55);
  vec2 sh = (p - w.feet - vec2(0.4 * c, -0.15 * c)) / vec2(2.6 * c, 0.7 * c);
  return dot(sh, sh) < 1.0 ? mix(sky, keyInk(k), 0.55 * screen(p, 0.6, pitch(u), 0.0)) : sky;
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
// where a post or a lane runs, right behind a post or in the front rows;
// most at the posts' fronts, fewer walking the aisles, as many as the hour
// fills.
float traderChance(Hall h, Market m, int row, float x) {
  if (row > 13 || row < 0) return 0.0;
  if (row != 7 && abs(x - laneOf(h, row)) < 1.9 * h.u) return 0.0;
  bool isPostRow = row == 3 || row == 7 || row == 11;
  if (isPostRow && postGap(h, row, x) < 3.6 * h.u) return 0.0;
  if ((row + 1) % 4 == 3 && postGap(h, row + 1, x) < 3.6 * h.u) return 0.0;
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
  Who w = Who(vec2(-1e4), h.c, POSE_STAND, GEAR_NONE, CORAL, 0, 0.0, -1, false, false);
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
  // of two rows apart, stepping out from behind the middle posts. Then the
  // traders in their lots. Whoever it is, one hash dresses him below.
  bool isOut = p.x < h.left;
  int row = int(floor((p.y - h.floorY) / h.row));
  float lane = isOut ? h.left - 3.4 * u : laneOf(h, row);
  float down = isOut || row > 7 ? 1.0 : -1.0;
  bool isWalker = false;
  uint hs = 0u;
  if (abs(p.x - lane) < (isOut ? 1.6 : 1.3) * u && (isOut || row != 7) && p.y > h.floorY) {
    float lh = (isOut ? 3.2 : 4.0) * u;
    float shift = down * mod(iTime * (isOut ? 0.7 : 0.8) * u, 512.0 * lh);
    float j = floor((p.y - h.floorY - shift) / lh);
    float fy = h.floorY + shift + (j + 1.0) * lh - 0.2 * u;
    hs = hashi(int(mod(j, 512.0)) * 19 + (isOut ? 1 : row < 7 ? 3 : 5));
    bool isOn = isOut ? fy > h.floorY + 1.8 * u : row < 7 ? fy > h.floorY + 1.2 * u && fy < h.floorY + 14.1 * u : fy > h.floorY + 18.0 * u && fy < h.front - 0.3 * u;
    isWalker = isOn && float(hs & 1023u) / 1023.0 < (isOut ? 0.5 : 0.75 * m.fill);
    w.feet = vec2(lane + (float((hs >> 10) & 3u) - 1.5) * 0.12 * u, fy);
  }
  float dir = (row / 4) % 2 == 0 ? 1.0 : -1.0;
  bool isAisle = row % 4 == 1;
  bool isMopping = isAisle && m.cleaning && (row == 5 || row == 9);
  bool isAgent = false;
  w.dim = m.staffed || isOut ? 0.0 : 0.25;
  if (!isWalker) {
    if (isOut || p.x < h.inner || p.y < h.floorY - 0.2 * u || p.y > h.front) return Who(vec2(-1e4), h.c, POSE_STAND, GEAR_NONE, CORAL, 0, 0.0, -1, false, false);
    float foot = h.floorY + float(row + 1) * h.row - 0.1 * u;
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
    float postSeven = h.inner + h.width / 3.0 - 1.9 * u;
    if (m.late && row == 8 && abs(p.x - postSeven) < 1.2 * u) {
      w.feet = vec2(postSeven, foot);
      w.pose = POSE_PHONE;
      w.jacket = true;
      w.coat = INK_BLUE;
      w.look = 1;
      return w;
    }
    float lot = h.width / 8.0;
    float shift = isAisle ? dir * mod(iTime * (isMopping ? 0.3 : 1.1) * u, 512.0 * lot) : 0.0;
    float off = row % 2 == 1 ? 0.5 * lot : 0.0;
    int col = int(floor((p.x - h.inner - off - shift) / lot));
    float cx = h.inner + off + shift + (float(col) + 0.5) * lot;
    hs = hashi(int(mod(float(col), 512.0)) * 31 + row * 977 + 11);
    isAgent = row == 12 && col >= 0 && col < agents;
    float chance = isMopping ? 0.16 : traderChance(h, m, row, cx);
    if ((!isAgent && float(hs & 1023u) / 1023.0 >= chance) || cx < h.inner + 0.9 * u) return Who(vec2(-1e4), h.c, POSE_STAND, GEAR_NONE, CORAL, 0, 0.0, -1, false, false);
    float phase = float((hs >> 8) & 255u);
    w.feet = vec2(cx, foot) + (isAisle || crowd == POSE_UP ? vec2(0.0) : vec2(0.35 * u * sin(0.4 * iTime + phase), -0.3 * u * (0.5 + 0.5 * sin(0.27 * iTime + 2.0 * phase))));
  }
  w.stride = isWalker || isAisle ? int(floor(iTime * 3.0 + float(hs & 3u))) % 2 : -1;
  w.outside = isOut;
  if (isMopping && !isWalker) {
    w.pose = POSE_MOP;
    w.gear = GEAR_CAP;
    w.coat = mix(INK_GREEN, INK_BLUE, 0.5);
    w.look = dir > 0.0 ? 1 : -1;
    return w;
  }
  w.jacket = !isOut;
  uint mv = hashi(int(hs & 4095u) + int(mod(floor(iTime / 4.0 + float(hs & 7u) * 0.37), 1000.0)) * 7);
  float r = float(mv & 255u) / 255.0;
  w.pose = crowd >= 0 && !isOut ? crowd : isWalker ? POSE_STAND : r < (m.fill > 0.8 ? 0.3 : 0.12) ? POSE_POINT : r < 0.4 ? POSE_PHONE : POSE_STAND;
  int pick = int((hs >> 20) % 7u);
  w.coat = isAgent ? INK_YELLOW : pick == 0 ? INK_BLUE : pick == 1 ? INK_GREEN : pick == 2 ? INK_VIOLET : pick == 3 ? RED : pick == 4 ? INK_PINK : pick == 5 ? mix(CREAM, INK_BLUE, 0.12) : NAVY;
  int kit = int((hs >> 24) & 7u);
  w.gear = isAgent || kit == 4 || (isOut && kit < 3) ? GEAR_CAP : isOut ? GEAR_NONE : kit == 2 || kit == 3 ? GEAR_HEADSET : kit < 2 ? GEAR_SHADES : GEAR_NONE;
  w.look = isWalker ? (down > 0.0 ? 0 : 2) : isAisle ? (dir > 0.0 ? 1 : -1) : int((mv >> 9) % 3u) - 1;
  return w;
}

// --- What stands in front of them -------------------------------------------------

// An order slip at d from its middle, turned by `spin` and narrowing as it
// turns over: its distance, below 0 inside.
float paperSlip(vec2 d, float spin, float u) {
  d = tumble(d, spin, 1.0);
  d.x /= max(0.3, abs(cos(0.7 * spin)));
  return box(d, vec2(0.28, 0.18) * u);
}

// The Jenga tower on the floor beside the pulpit, as tall as a trader is
// three times, its foot at `at`: eleven courses of pale wooden blocks, each
// block's seam in the key plate, every other course showing three ends and a
// few with the middle pulled; fallen (`fall` from 0 standing to 1 down),
// half its blocks lie in a heap where it stood and half have tumbled onto
// the floor beside the pulpit, in view.
vec3 jenga(vec3 sky, vec2 p, float u, float k, vec2 at, float fall) {
  float bh = max(1.0, floor(0.4 * u));
  float bw = 2.2 * u;
  if (abs(p.x - at.x) > 4.0 * u || p.y > at.y + 0.6 * u || p.y < at.y - 11.0 * bh - u) return sky;
  for (int j = 0; j < 11; j++) {
    uint hs = hashi(j * 17 + 5);
    float h01 = float(hs & 255u) / 255.0;
    vec2 stand = vec2(at.x, at.y - (float(j) + 0.5) * bh);
    vec2 rest = j % 2 == 0 ? vec2(at.x + (h01 - 0.5) * 2.0 * u, at.y - (0.5 + float((j / 2) % 2)) * bh) : vec2(at.x - 2.6 * u + h01 * 3.6 * u, at.y - (0.9 + 1.4 * float((hs >> 16) & 255u) / 255.0) * u);
    vec2 q = tumble(p - vec2(mix(stand.x, rest.x, fall), mix(stand.y, rest.y, fall * fall)), fall * (float((hs >> 8) & 255u) / 255.0 - 0.5) * 3.0, 1.0);
    float d = box(q, vec2(0.5 * bw, 0.5 * bh));
    if (d > 0.0) continue;
    bool isOdd = j % 2 == 1;
    if (fall < 0.5 && isOdd && (j == 3 || j == 7 || j == 9) && abs(q.x) < bw / 6.0) continue;
    return d > -1.0 || (isOdd && abs(abs(q.x) - bw / 6.0) < 0.6) ? keyInk(k) : lift(mix(WOOD, CREAM, 0.6), k);
  }
  return sky;
}

// The front strip: the context window as piles of paper along the floor from
// the west wall, one for each full tenth, the newest lit yellow while a
// tenth has just filled; while the conversation compacts the
// cleaner has mopped them into one heap, and just after the floor is bare.
// Then the resident's pulpit, a box with a top and a front, hiding his legs:
// his banker's lamp lit on it; the Jenga tower beside it (The Big Short's:
// it lies fallen while the Nasdaq-100 is down more than 2 %); and in
// December a Christmas tree at the front by the west wall.
vec3 frontStrip(vec3 sky, vec2 p, float u, float k, Hall h, float fall, int full, int state, float nt) {
  if (p.y < h.front - 2.0 * u || p.x < h.inner) return sky;
  float bottom = iResolution.y;
  // The paper: a pile of sheets for each full tenth, its front ruled with
  // their edges, or the one heap the cleaner has mopped them into.
  float sp = 1.25 * u;
  int i = int(floor((p.x - h.inner - 0.4 * u) / sp));
  uint hs = hashi(i * 23 + 7);
  float tall = (0.7 + 0.4 * float(hs & 255u) / 255.0) * u;
  vec2 q = p - vec2(h.inner + 0.4 * u + (float(i) + 0.5) * sp, bottom - 1.2 * u);
  vec2 hq = p - vec2(h.inner + 2.2 * u, bottom - 1.2 * u);
  bool isClearing = state == CONTEXT_CLEARING;
  float pile = isClearing ? max(length(hq / vec2(1.6, 1.0)) - (0.35 + 0.07 * float(full)) * u, hq.y) : i >= 0 && i < full && state != CONTEXT_CLEARED ? box(q + vec2(0.0, 0.5 * tall), vec2(0.45 * u, 0.5 * tall)) : 1e4;
  vec3 sheet = state == CONTEXT_GAINED && i == full - 1 ? mix(INK_YELLOW, CREAM, 0.4) : CREAM;
  if (pile < 0.0) sky = lift(pile > -0.05 * u ? INK_INDIGO : fract((isClearing ? hq.y : q.y) / (0.12 * u)) > 0.7 || q.y < 0.15 * u - tall ? mix(sheet, INK_INDIGO, 0.25) : sheet, k);
  sky = jenga(sky, p, u, k, vec2(h.inner + 0.89 * h.width, bottom - 0.7 * u), fall);
  // In December a Christmas tree by the west wall, as the exchange puts up
  // its own: three tiers on a wooden tub, its lights twinkling, a star on
  // top.
  if (MONTH == 12) {
    vec2 tq = p - vec2(h.inner + 1.5 * u, h.front + 3.8 * u);
    float t = (-tq.y - 0.4 * u) / (2.6 * u);
    float spread = (1.0 - t) * 1.1 * u * (0.55 + 0.45 * (1.0 - fract(3.0 * t)));
    vec2 lc = floor(tq / (0.45 * u));
    if (box(tq + vec2(0.0, 0.2 * u), vec2(0.35, 0.2) * u) < 0.0) sky = indoor(WOOD, k, nt, 1.0);
    if (t > 0.0 && t < 1.0 && abs(tq.x) < spread) sky = rand(int(lc.x) * 37 + int(lc.y) * 11 + int(floor(iTime * 1.5))) < 0.2 && length(fract(tq / (0.45 * u)) - 0.5) < 0.3 ? lift(int(abs(lc.x + lc.y)) % 2 == 0 ? INK_YELLOW : RED, k) : indoor(mix(INK_GREEN, INK_INDIGO, 0.35), k, nt, 1.0);
    if (length(tq + vec2(0.0, 3.05 * u)) < 0.22 * u) sky = lift(INK_YELLOW, k);
  }
  vec2 res = vec2(h.inner + 0.68 * h.width, bottom - 0.8 * u);
  q = p - res;
  if (abs(q.x) > 4.0 * u || q.y < -3.0 * u) return sky;
  // The pulpit: its top seen from above, its front in dark wood with a
  // brass rail and a brass seal, its edges in the key plate; its shadow on
  // the floor below it and to its right.
  float pfront = box(q + vec2(0.0, 0.65 * u), vec2(2.8, 0.65) * u);
  float ptop = box(q + vec2(0.0, 1.65 * u), vec2(2.8, 0.35) * u);
  float pulpit = min(pfront, ptop);
  if (box(q - vec2(0.4 * u, -0.5 * u), vec2(2.8, 1.0) * u) < 0.0) sky = mix(sky, keyInk(k), 0.5 * screen(p, 0.55, pitch(u), 0.0));
  vec3 c = ptop < 0.0 ? mix(WOOD, CREAM, 0.35) : abs(q.y + 1.15 * u) < 0.1 * u || length(q + vec2(0.0, 0.55 * u)) < 0.32 * u ? BRASS : mix(WOOD, INK_INDIGO, 0.2 + 0.3 * screen(p, 0.35, pitch(u), 75.0));
  if (pulpit < 0.0) sky = pulpit > -0.06 * u ? keyInk(k) : indoor(c, k, nt, 1.0);
  // The banker's lamp: a brass stem, its green shade, its light on the
  // pulpit's top.
  vec2 lq = q - vec2(-2.2 * u, -1.75 * u);
  if (ptop < 0.0) sky = mix(sky, lift(INK_YELLOW, k), screen(p, 0.75 * exp(-length(lq) / (0.5 * u)), pitch(u), 0.0));
  if (min(max(abs(lq.x) - 0.07 * u, max(lq.y, -lq.y - 0.8 * u)), box(lq, vec2(0.3, 0.06) * u)) < 0.0) sky = tone(BRASS, k);
  if (max(length((lq + vec2(0.0, 0.8 * u)) / vec2(0.6, 0.3)) - u, lq.y + 0.8 * u) < 0.0) sky = lift(INK_GREEN, k);
  return sky;
}

// While a command runs, BUY and SELL in bubbles over the traders of every
// other row, the same lots whoAt fills, but none hidden behind a post and
// none on the tape; three in four of them shouting. Those in front of a
// post rise over its counter, so that its screens' prices stay clear. One
// sky_glyph for every bubble.
vec3 shouts(vec3 sky, vec2 p, float u, float k, Hall h, Market m) {
  if (p.x < h.inner) return sky;
  float lot = h.width / 8.0;
  float base = h.floorY + h.row - 2.45 * u;
  float j = clamp(floor((p.y - base + 3.15 * u) / (2.0 * h.row)), 1.0, 6.0);
  float by = base + j * 2.0 * h.row;
  int row = 2 * int(j);
  int col = int(floor((p.x - h.inner) / lot));
  float cx = h.inner + (float(col) + 0.5) * lot;
  if (row % 4 == 0 && postGap(h, row - 1, cx) < 4.1 * u) by -= 2.3 * u;
  if (abs(p.y - by) > 1.0 * u) return sky;
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
// over the whole floor while it hums, none over a post's screens. One cell,
// one hash, one slip, the cells falling as one.
vec3 slips(vec3 sky, vec2 p, float u, float k, Hall h, float density, bool party, bool notes) {
  if (density <= 0.0 || p.x < h.inner || p.y < h.wallTop || p.y > h.front) return sky;
  float cs = 1.6 * u;
  vec2 q = vec2(p.x - h.inner, p.y - h.wallTop - mod(iTime * 1.3 * u, 64.0 * cs));
  vec2 cell = floor(q / cs);
  uint hs = hashi(int(mod(cell.y, 64.0)) * 97 + int(cell.x) * 13 + 5);
  Post o = postAt(p, h);
  if (float(hs & 1023u) / 1023.0 > density || postFace(vec2(p.x - o.x, p.y - o.foot), o, u) == 1) return sky;
  vec2 at = (cell + vec2(0.25 + 0.5 * float((hs >> 10) & 255u) / 255.0, 0.5)) * cs + vec2(0.25 * u * sin(iTime * 1.7 + float(hs & 63u)), 0.0);
  vec2 nq = q - at;
  float slip = notes ? min(length(nq / vec2(1.3, 1.0)) - 0.22 * u, min(max(abs(nq.x - 0.26 * u) - 0.05 * u, abs(nq.y + 0.4 * u) - 0.4 * u), segment(nq, vec2(0.26 * u, -0.84 * u), vec2(0.55 * u, -0.5 * u)) - 0.06 * u)) : paperSlip(nq, iTime * (1.2 + 0.25 * float((hs >> 18) & 7u)) + float(hs & 31u), u);
  int pick = int((hs >> 21) % 5u);
  vec3 color = !party ? CREAM : pick == 0 ? INK_PINK : pick == 1 ? INK_YELLOW : pick == 2 ? INK_BLUE : pick == 3 ? INK_GREEN : INK_VIOLET;
  sky = ink(sky, lift(color, k), slip, 0.95);
  return ink(sky, keyInk(k), abs(slip) - 0.03 * u, 0.45);
}

// The Charging Bull let loose on the floor, galloping along the aisle in
// front of the middle posts: in at the door and out at the right, then back
// again, facing the way he runs; his body, haunch and the hump of his
// shoulders, his head down with its horns, four legs striding and his tail
// lashed up, in gold-brown bronze, lit along his back and hump, darker
// under his belly, outlined in the key plate.
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
  vec3 bronze = lift(BULL, k);
  bronze = mix(bronze, mix(bronze, INK_INDIGO, 0.4), screen(p, 0.8 * smoothstep(-1.2, -0.5, q.y), pitch(u), 45.0));
  if (q.y < -1.6) bronze = mix(bronze, CREAM, 0.25);
  sky = ink(sky, bronze, shape, 1.0);
  return ink(sky, keyInk(k), abs(shape - 0.04 * u) - 0.05 * u, 0.9);
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
  float seed = 0.0;
  float t = 0.0;
  float runT = 0.0;
  // EVENT_COUNT is a constant: with no event up the compiler drops the
  // events' drawing altogether.
  bool humming = EVENT_COUNT > 0 && eventUp(0, seed, t);
  bool charging = EVENT_COUNT > 0 && eventUp(1, seed, runT);
  // A command, the bell and the events bring their own crowd onto an empty
  // floor: the hall shouts, cheers and hums with people in it.
  bool toppling = THEME_FORCE == 2;
  if (tool == sky_TOOL_COMMAND || m.bell > 0.5 || humming || charging || toppling) m.fill = max(m.fill, 0.75);
  int beat = int(floor(iTime * 2.0)) % 2;
  sky = figure(sky, p, u, whoAt(p, h, m, sky_agents(), crowdPose(m, tool, humming, charging || toppling), state, residentPose(m, tool, humming)), k, beat);
  sky = post(sky, p, u, k, h, m, nt);
  float age = mod(iTime, 60.0);
  float fall = THEME_FORCE == 2 ? (age < 50.0 ? smoothstep(0.0, 1.4, age) : 0.0) : sky_QUOTE_PRICE[sky_NDX] > 0.0 && sky_QUOTE_CHANGE[sky_NDX] < -2.0 ? 1.0 : 0.0;
  sky = frontStrip(sky, p, u, k, h, fall, contextFish(), state, nt);
  if (charging) sky = bull(sky, p, u, k, h, runT);
  if (tool == sky_TOOL_COMMAND) sky = shouts(sky, p, u, k, h, m);
  bool party = m.bell > 0.5 || (sky_QUOTE_PRICE[sky_BTC] > 0.0 && sky_QUOTE_CHANGE[sky_BTC] >= 5.0);
  float density = humming ? 0.3 : tool == sky_TOOL_EDIT ? 0.43 : party ? 0.4 : m.fill > 0.9 ? 0.03 : 0.0;
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
