/** Flame drawn entirely on the graphics card. uEarth 0 = microgravity, 1 = Earth. uMode 0 = spherical burner, 1 = droplet, 2 = jet. */

export const VERTEX = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uEarth, uMode, uLife, uSize, uHeat, uSoot, uCool, uDrop, uFiber, uFlow, uLen, uSpark;

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.02 + 7.0; a *= 0.5; } return s; }

vec3 blueOf() { return mix(vec3(0.10, 0.24, 0.95), vec3(0.42, 0.68, 1.0), uHeat); }
vec3 sootOf() { return mix(vec3(1.0, 0.34, 0.06), vec3(1.0, 0.66, 0.28), uHeat); }

// Without gravity, hot gas does not rise: a thin, still, round shell. Seen through its depth, a shell glows most at its rim.
vec3 sphereShell(vec2 q, float R, vec3 outer, vec3 inner, float soot) {
  float r = length(q);
  vec2 dir = q / max(r, 0.0001);
  float wob = noise(vec3(dir * 1.7, uTime * 0.13)) - 0.5;
  float Rw = R * (1.0 + 0.055 * wob);
  float w = 0.014 + 0.028 * R;
  float x = r / Rw;
  float rim = exp(-pow((r - Rw) / w, 2.0));
  float limb = x < 1.0 ? 0.11 / sqrt(max(1.0 - x * x, 0.05)) : 0.0;
  float sootR = Rw * (0.84 + 0.05 * (noise(vec3(dir * 3.0, uTime * 0.09)) - 0.5));
  float sootBand = exp(-pow((r - sootR) / (w * 1.5), 2.0));
  float mottled = 0.55 + 0.75 * fbm(vec3(q * 7.0, uTime * 0.1));
  vec3 c = outer * (rim * 1.25 + limb);
  c += inner * sootBand * soot * mottled * 1.15;
  c += mix(outer, inner, soot) * exp(-r * r / (Rw * Rw * 2.4)) * 0.075;
  return c;
}

// With gravity, hot gas rises and pulls the flame into a flickering teardrop.
// v runs 0 at the base to 1 at the tip; body > 0 is inside the flame.
float teardrop(vec2 q, float W, float H, float round_, float wobble, float speed, out float v) {
  v = clamp((q.y + 0.03) / H, 0.0, 1.0);
  float n = fbm(vec3(q.x * 2.7, q.y * 1.7 - uTime * speed, uTime * 0.33)) - 0.5;
  float n2 = noise(vec3(q.x * 6.5, q.y * 4.5 - uTime * speed * 1.6, uTime * 0.5)) - 0.5;
  float x = q.x + (n * wobble + n2 * wobble * 0.3) * v * (0.5 + v);
  // rounded at the base and tapered to the tip, so a flame never ends in a hard edge
  float width = W * pow(1.0 - v, round_) * sqrt(clamp((q.y + 0.03) / (H * 0.16), 0.0, 1.0));
  if (q.y > H) return -1.0;
  return 1.0 - abs(x) / max(width, 0.0005);
}

vec3 teardropColor(float body, float v, float soot) {
  float edge = smoothstep(0.0, 0.5, body);
  float hollow = mix(0.55 + 0.45 * smoothstep(0.75, 0.0, body), 1.0, smoothstep(0.1, 0.5, v));
  float hot = edge * hollow;
  vec3 warm = mix(vec3(1.0, 0.28, 0.05), vec3(1.0, 0.72, 0.28), smoothstep(0.2, 0.75, hot * (0.9 - v * 0.45)));
  vec3 c = warm * hot * mix(1.0, 1.9, soot) * smoothstep(1.0, 0.72, v);
  float base = smoothstep(0.22, 0.0, v);
  c = mix(c, blueOf() * (edge * 0.85 + 0.1 * smoothstep(0.0, 0.3, body)), base);
  return c;
}

vec3 sootSpecks(vec2 uv, float amount, float rise) {
  float n = noise(vec3(uv * 42.0 + vec2(0.0, -uTime * rise), uTime * 0.35));
  return vec3(1.0, 0.5, 0.15) * pow(n, 24.0) * amount * 3.0;
}

// metal sphere on its feed tube, lit by the flame
vec3 drawBurner(vec3 col, vec2 q, float R, vec3 light) {
  float tube = smoothstep(0.018, 0.012, abs(q.x)) * step(q.y, 0.0);
  col = mix(col, vec3(0.035, 0.04, 0.05) + light * 0.1 * smoothstep(0.018, 0.0, abs(q.x)), tube);
  float r = length(q);
  if (r < R) {
    vec3 n = vec3(q / R, sqrt(max(1.0 - dot(q, q) / (R * R), 0.0)));
    float rim = pow(1.0 - n.z, 2.0);
    vec3 surf = vec3(0.07, 0.08, 0.1) * (0.55 + 0.5 * n.y) + light * rim * 0.75 + light * 0.06;
    surf *= 0.82 + 0.26 * noise(vec3(q * 90.0, 1.0));
    col = mix(col, surf, smoothstep(R, R - 0.006, r));
  }
  return col;
}

vec3 drawDroplet(vec3 col, vec2 q, float R, vec3 light) {
  if (uFiber > 0.5) col = mix(col, vec3(0.2, 0.22, 0.26) + light * 0.25, smoothstep(0.004, 0.0015, abs(q.y)));
  float r = length(q);
  if (r < R) {
    float z = sqrt(max(1.0 - r * r / (R * R), 0.0));
    vec3 surf = vec3(0.02, 0.025, 0.035) + light * pow(1.0 - z, 2.5) * 0.9 + vec3(0.8) * smoothstep(0.86, 1.0, dot(normalize(vec3(q / R, z)), normalize(vec3(-0.5, 0.6, 0.62)))) * 0.45;
    col = mix(col, surf, smoothstep(R, R - 0.005, r));
  }
  return col;
}

void main() {
  float unit = min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / unit * 2.0;
  float vig = 1.0 - 0.32 * dot(uv * 0.65, uv * 0.65);
  vec3 col = vec3(0.012, 0.018, 0.034) * vig;

  // co-flowing air: faint streaks passing the flame
  if (uMode > 1.5 && uFlow > 0.0) {
    float lane = noise(vec3(uv.x * 26.0, 0.0, 2.0));
    float streak = smoothstep(0.62, 0.95, noise(vec3(uv.x * 26.0, uv.y * 1.3 - uTime * (0.4 + uFlow * 2.4), 1.0))) * lane;
    col += vec3(0.1, 0.17, 0.3) * streak * (0.06 + uFlow * 0.3);
  }

  vec3 light = vec3(0.0);
  vec3 flame = vec3(0.0);
  float life = uLife;

  if (uMode < 0.5) {
    // ------------------ ACME: gas fed through a porous sphere
    vec2 q = uv - vec2(0.0, uEarth > 0.5 ? -0.42 : -0.04);
    float R = uSize;
    float burner = 0.085;
    if (uEarth < 0.5) {
      flame = sphereShell(q, R, blueOf(), sootOf(), uSoot);
      light = mix(blueOf(), sootOf(), uSoot) * life;
    } else {
      float v;
      float puff = 1.0 + 0.09 * sin(uTime * 13.0) + 0.05 * sin(uTime * 7.3);
      float H = (0.55 + R * 1.3) * puff;
      float W = burner * 1.05 + R * 0.34;
      float body = teardrop(q + vec2(0.0, burner * 0.9), W, H, 0.6, 0.24, 2.6, v);
      flame = teardropColor(body, v, uSoot) * 1.2;
      flame += sootOf() * exp(-dot(q - vec2(0.0, H * 0.32), q - vec2(0.0, H * 0.32)) / (H * H * 0.42)) * 0.07;
      // a few glowing soot particles carried up from the tip, not scattered across the view
      float plume = exp(-q.x * q.x / (W * W * 1.1)) * smoothstep(H * 0.55, H * 0.95, q.y);
      flame += sootSpecks(uv, uSoot * life * plume, 0.9);
      light = sootOf() * life;
    }
    col += flame * life;
    // cool flames were recorded in microgravity only, so the Earth view never shows one
    float cool = uCool * (1.0 - uEarth) * (0.82 + 0.18 * noise(vec3(q * 3.0, uTime * 0.35)));
    if (cool > 0.001) {
      float r = length(q);
      vec3 pale = vec3(0.17, 0.2, 0.62);
      col += pale * cool * (exp(-pow((r - R * 0.92) / 0.05, 2.0)) * 0.9 + exp(-r * r / (R * R * 1.1)) * 0.2);
      light += pale * cool * 0.35;
    }
    col = drawBurner(col, q, burner, light);
  } else if (uMode < 1.5) {
    // ------------------ CFI: a fuel droplet burning in its own vapour
    vec2 q = uv - vec2(0.0, uEarth > 0.5 ? -0.42 : -0.02);
    float D = uDrop;
    float R = max(D * 5.2, 0.12);
    vec3 shell = mix(vec3(0.3, 0.42, 1.0), vec3(1.0, 0.56, 0.16), 0.72);
    if (uEarth < 0.5) {
      flame = sphereShell(q, R, shell, sootOf(), 0.32);
      light = shell * life;
    } else {
      float v;
      float puff = 1.0 + 0.08 * sin(uTime * 12.0);
      float H = (0.28 + D * 7.5) * puff;
      float body = teardrop(q + vec2(0.0, D * 1.5), D * 1.55 + 0.05, H, 0.6, 0.24, 2.7, v);
      flame = teardropColor(body, v, 0.55) * 1.25;
      light = sootOf() * life;
    }
    col += flame * life;
    if (uCool > 0.001 && uEarth < 0.5) {
      float r = length(q);
      vec3 pale = vec3(0.16, 0.2, 0.68);
      float coolR = R * 0.62;
      col += pale * uCool * (exp(-pow((r - coolR) / 0.045, 2.0)) * 0.85 + exp(-r * r / (coolR * coolR * 1.5)) * 0.18);
      light += pale * uCool * 0.3;
    }
    col = drawDroplet(col, q, D, light);
  } else {
    // ------------------ SPICE: a thin gas jet inside co-flowing air
    vec2 q = uv - vec2(0.0, -0.78);
    float v;
    float L = uLen * mix(0.92, 1.12, uEarth);
    if (uEarth < 0.5) {
      // no buoyancy to squeeze it: wide, round-tipped, nearly still
      float body = teardrop(q, L * 0.24 * (1.0 - uFlow * 0.25), L, 0.42, 0.035, 0.22, v);
      float edge = smoothstep(0.0, 0.42, body);
      float hollow = 0.45 + 0.55 * smoothstep(0.85, 0.05, body);
      // blue where gas burns clean near the nozzle, glowing orange soot above it: kept apart, not blended into tan
      float warm = smoothstep(0.1, 0.34, v);
      vec3 sootGlow = mix(vec3(0.95, 0.24, 0.03), vec3(1.0, 0.55, 0.14), smoothstep(0.25, 0.8, v));
      vec3 c = blueOf() * (1.0 - warm) * 0.85 + sootGlow * warm * (0.3 + uSoot * 0.85);
      flame = c * edge * hollow * smoothstep(1.0, 0.86, v);
      flame += sootGlow * smoothstep(0.35, 1.0, uSoot) * edge * smoothstep(0.5, 0.9, v) * 0.4 * (0.5 + fbm(vec3(q * 11.0, uTime * 0.12)));
      flame += sootSpecks(uv, uSoot * life * step(0.45, v), 0.08) * step(0.0, body + 0.5);
      light = c * life;
    } else {
      float flick = 1.0 + 0.06 * sin(uTime * 12.0) + 0.04 * sin(uTime * 19.0);
      float body = teardrop(q, L * 0.135 * (1.0 - uFlow * 0.2), L * flick, 0.62, 0.15, 2.8, v);
      flame = teardropColor(body, v, uSoot * 0.8 + 0.2) * 1.3;
      flame += sootSpecks(uv, uSoot * life * step(0.6, v), 1.2) * step(0.0, body + 0.6);
      light = sootOf() * life;
    }
    col += flame * life;
    // the halo the flame throws into the duct
    col += light * exp(-dot(q - vec2(0.0, L * 0.45), q - vec2(0.0, L * 0.45)) / (L * L * 0.5)) * 0.07;
    float tube = smoothstep(0.024, 0.018, abs(q.x)) * smoothstep(0.0, -0.005, q.y);
    col = mix(col, vec3(0.05, 0.055, 0.07) + light * 0.2 * smoothstep(0.024, 0.0, abs(q.x)), tube);
  }

  // igniter: a hot wire that swings in, then retracts
  if (uSpark > 0.001) {
    vec2 tip = uMode > 1.5 ? vec2(0.08, -0.74) : (uMode > 0.5 ? vec2(max(uDrop * 1.5, 0.08), uEarth > 0.5 ? -0.42 : -0.02) : vec2(0.15, uEarth > 0.5 ? -0.42 : -0.04));
    tip.x += (1.0 - uSpark) * 0.45;
    vec2 d = uv - tip;
    if (uv.x > tip.x) col = mix(col, vec3(0.1, 0.1, 0.12), smoothstep(0.007, 0.003, abs(d.y)));
    float flicker = 0.75 + 0.25 * sin(uTime * 60.0);
    col += vec3(1.0, 0.72, 0.42) * uSpark * flicker * (0.018 / (dot(d, d) * 7.0 + 0.012));
  }

  col = 1.0 - exp(-col * 1.55);
  col = pow(col, vec3(0.92));
  gl_FragColor = vec4(col, 1.0);
}
`;
