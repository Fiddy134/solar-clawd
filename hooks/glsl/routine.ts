// The sky shader's GLSL, part of hooks/shader.ts's BODY: the keeper's day,
// what he is doing at any moment, and him drawn at the lighthouse.
export const ROUTINE = `
// --- His day -----------------------------------------------------------------

// The day: fishing on the rocks, in through the door, a lap of the gallery
// looking out, and back down to the rocks.
Keeper keeperDay(float time, Lighthouse l) {
  float t = time - floor(time / DAY_LOOP) * DAY_LOOP;
  vec2 spot = fishingSpot(l);
  vec2 door = vec2(l.x, l.foot);
  Keeper kp = Keeper(spot, POSE_FISH, -1.0, 0.0, true, true, 0.0);
  if (t < 40.0) return kp;
  // Over to the door.
  if (t < 44.0) {
    kp.at = mix(spot, door, (t - 40.0) / 4.0);
    kp.pose = POSE_WALK;
    kp.facing = 1.0;
    return kp;
  }
  // The door opens, he steps in, and it shuts behind him.
  if (t < 46.0) {
    kp.at = door;
    kp.pose = POSE_STAND;
    kp.door = smoothstep(44.0, 44.6, t) * (1.0 - smoothstep(45.4, 46.0, t));
    kp.isOutside = false;
    kp.isShown = t < 45.3;
    return kp;
  }
  // Up the stairs inside, and again on the way down.
  if (t < 52.0 || (t >= 68.0 && t < 74.0)) {
    kp.at = door;
    kp.pose = POSE_STAND;
    kp.isOutside = false;
    kp.isShown = false;
    return kp;
  }
  // Out from behind the lantern, round to the front, a look out to sea one
  // way and the other, and on round behind it again: stepping round the
  // lantern room at the deck's ends, and out of sight only while it hides
  // all but half a cell of him.
  if (t < 68.0) {
    float lap = t - 52.0;
    float a = lap < 4.0 ? PI * (1.0 + lap / 4.0) : lap < 8.0 ? 2.0 * PI : PI * (2.0 + min(1.0, (lap - 8.0) / 5.0));
    kp.at = galleryAt(l, a);
    kp.pose = lap >= 4.0 && lap < 8.0 ? POSE_LOOK : lap < 13.0 ? POSE_WALK : POSE_STAND;
    kp.facing = lap >= 4.0 && lap < 8.0 ? (lap < 6.0 ? -1.0 : 1.0) : cos(a) >= 0.0 ? 1.0 : -1.0;
    kp.behind = smoothstep(0.3, -0.3, cos(a));
    kp.isShown = cos(a) >= 0.0 || abs(kp.at.x - l.x) >= 0.5 * keeperCell(l.s);
    return kp;
  }
  // Out of the door, the door shutting behind him.
  if (t < 76.0) {
    kp.at = door - vec2(0.3 * l.s * smoothstep(74.6, 76.0, t), 0.0);
    kp.pose = t < 75.2 ? POSE_STAND : POSE_WALK;
    kp.facing = -1.0;
    kp.door = smoothstep(74.0, 74.6, t) * (1.0 - smoothstep(75.4, 76.0, t));
    kp.isOutside = t >= 75.2;
    kp.isShown = t >= 74.6;
    return kp;
  }
  // A slow trudge back to his rod, and a look out to sea before he fishes.
  kp.at = mix(door - vec2(0.3 * l.s, 0.0), spot, min(1.0, (t - 76.0) / 10.0));
  kp.pose = t < 86.0 ? POSE_WALK : POSE_LOOK;
  return kp;
}

// What he is about at \`time\`, by precedence: at the lantern while it is
// lit, then a surf, then asleep, then the night (an aurora before a full
// moon before the stars), else his day.
int keeperMode(float time) {
  if (BEACON != 0) return MODE_LANTERN;
  if (surfTime(time) >= 0.0) return MODE_SURF;
  if (KEEPER_ASLEEP > 0.5) return MODE_HAMMOCK;
  float night = nightness(sceneNow().elevation);
  if (night <= 0.6) return MODE_DAY;
  if (AURORA * night > 0.3) return MODE_AURORA;
  return MOON_UP > 0.5 && MOON_ILLUMINATION > 0.95 ? MODE_MOON : MODE_STARS;
}

// The keeper at \`time\`, as his mode says.
Keeper keeperAt(float time, Lighthouse l) {
  int mode = keeperMode(time);
  if (mode == MODE_LANTERN) return keeperLantern(l);
  if (mode == MODE_SURF) return keeperSurf(surfTime(time), l);
  if (mode == MODE_HAMMOCK) return keeperHammock(l);
  if (mode == MODE_DAY) return keeperDay(time, l);
  return keeperNight(time, l, mode);
}

// The keeper and his door, near the lighthouse only: his rod propped on the
// rocks while he is away from it, his lantern by him fishing at night,
// his binoculars, and his hammock over him asleep.
vec3 keeper(vec3 sky, vec2 p, float u, float k) {
  Lighthouse l = lighthouse(u);
  float s = l.s;
  if (abs(p.x - l.x) > 4.0 * s || p.y < l.deck - 3.0 * s || p.y > l.foot + 1.0 * s) return sky;
  int mode = keeperMode(iTime);
  Keeper kp = keeperAt(iTime, l);
  sky = keeperDoor(sky, p, l, kp.door, k);
  if (kp.pose != POSE_FISH) {
    vec2 spot = fishingSpot(l);
    sky = keeperLine(sky, p, spot - vec2(0.45 * s, 0.0), spot - vec2(1.0 * s, 0.95 * s), keeperInk(WOOD, k), max(1.5, 0.3 * keeperCell(s)), 1.0);
  }
  sky = surf(sky, p, l, u, k);
  if (mode == MODE_MOON) sky = fishingLantern(sky, p, l, u, k);
  if (kp.isShown && !keeperIsHidden(p, kp, l)) sky = keeperSprite(sky, p, kp, vec2(0.0), k);
  if (kp.pose == POSE_GAZE) sky = binoculars(sky, p, kp, l, k);
  if (mode == MODE_HAMMOCK) sky = snore(hammock(sky, p, l, k), p, l, k);
  return sky;
}
`
