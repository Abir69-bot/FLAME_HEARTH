import * as THREE from "three";

/** Scenery only: Earth, Moon, Sun, stars. Their positions carry no data, and the page says so. */

/** Towards the visible Sun, top right of the scene: planets are lit from that side. */
export const SUN_DIR = new THREE.Vector3(0.93, 0.32, 0.12).normalize();

const NOISE = /* glsl */ `
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 11.0; a *= 0.5; } return s; }
`;

const SPHERE_VERTEX = /* glsl */ `
  varying vec3 vObj; varying vec3 vNormalW; varying vec3 vWorld;
  void main() {
    vObj = normalize(position);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const EARTH_FRAGMENT = /* glsl */ `
  uniform vec3 uSun; uniform float uTime;
  varying vec3 vObj; varying vec3 vNormalW; varying vec3 vWorld;
  ${NOISE}
  void main() {
    vec3 p = normalize(vObj);
    float c = fbm(p * 2.1 + vec3(3.1, 1.7, 8.2));
    float land = smoothstep(0.515, 0.54, c);
    float m = fbm(p * 7.0 + 9.0);
    vec3 ocean = mix(vec3(0.012, 0.05, 0.16), vec3(0.02, 0.15, 0.32), smoothstep(0.35, 0.55, c));
    vec3 ground = mix(vec3(0.09, 0.22, 0.07), vec3(0.42, 0.33, 0.17), smoothstep(0.38, 0.62, m));
    float ice = smoothstep(0.74, 0.9, abs(p.y) + (m - 0.5) * 0.3);
    vec3 col = mix(mix(ocean, ground, land), vec3(0.92), ice);
    vec3 cp = p + vec3(uTime * 0.004, 0.0, 0.0);
    float cloud = smoothstep(0.5, 0.74, fbm(cp * vec3(3.2, 6.0, 3.2) + 4.0));
    col = mix(col, vec3(0.97), cloud * 0.88);
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorld);
    float d = dot(N, uSun);
    float day = smoothstep(-0.08, 0.42, d);
    vec3 lit = col * (0.012 + day * 1.2);
    vec3 H = normalize(uSun + V);
    lit += vec3(0.9, 0.85, 0.7) * pow(max(dot(N, H), 0.0), 60.0) * (1.0 - land) * (1.0 - cloud) * day * 0.6;
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2);
    lit += vec3(0.28, 0.58, 1.0) * rim * smoothstep(-0.25, 0.45, d) * 1.1;
    gl_FragColor = vec4(lit, 1.0);
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform vec3 uSun; uniform vec3 uColor; uniform float uPower; uniform float uGain;
  varying vec3 vNormalW; varying vec3 vWorld;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorld);
    float rim = pow(max(dot(-N, V), 0.0), uPower);
    float lit = smoothstep(-0.35, 0.5, dot(N, uSun));
    gl_FragColor = vec4(uColor * rim * lit * uGain, rim * lit);
  }
`;

const MOON_FRAGMENT = /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vObj; varying vec3 vNormalW;
  ${NOISE}
  vec3 cell(vec3 p) { return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453); }
  // crater shape: dark floor and a bright rim around the nearest random centre
  float craters(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); float s = 0.0;
    for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 o = cell(i + g);
      float r = 0.18 + 0.28 * o.x;
      float dist = length(g + o - f) / r;
      if (dist < 1.25) s += smoothstep(1.25, 1.0, dist) * smoothstep(0.8, 1.0, dist) * 0.6 - smoothstep(1.0, 0.55, dist) * 0.5;
    }
    return s;
  }
  void main() {
    vec3 p = normalize(vObj);
    float maria = smoothstep(0.42, 0.6, fbm(p * 1.9 + 5.0));
    float grit = fbm(p * 14.0);
    float shade = mix(0.58, 0.28, maria) + (grit - 0.5) * 0.22;
    shade += craters(p * 5.0) * 0.16 + craters(p * 12.0 + 3.0) * 0.08;
    float d = dot(normalize(vNormalW), uSun);
    float day = smoothstep(-0.03, 0.55, d);
    vec3 col = vec3(shade) * vec3(1.0, 0.97, 0.92);
    gl_FragColor = vec4(col * (0.008 + day * 1.25), 1.0);
  }
`;

function glowTexture(stops: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, color] of stops) r.addColorStop(at, color);
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowSprite(stops: [number, string][], size: number, position: [number, number, number], opacity = 1): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(stops), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity, toneMapped: false }));
  s.scale.setScalar(size);
  s.position.set(...position);
  return s;
}

function stars(weak: boolean, pixelRatio: number): THREE.Points {
  const count = weak ? 1400 : 2600;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const palette = [new THREE.Color("#ffffff"), new THREE.Color("#cfe6ff"), new THREE.Color("#ffe3c9"), new THREE.Color("#ffd2a8")];
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // half the stars gather in a tilted band, like the Milky Way
    if (i % 2) v.set(THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(0.28), THREE.MathUtils.randFloatSpread(2)).applyAxisAngle(new THREE.Vector3(0.3, 0, 1).normalize(), 0.75);
    else v.randomDirection();
    v.normalize().multiplyScalar(170 + Math.random() * 40);
    pos.set([v.x, v.y, v.z], i * 3);
    const c = palette[Math.floor(Math.random() * palette.length)];
    const b = 0.35 + Math.random() ** 3 * 0.65;
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
    size[i] = (0.9 + Math.random() ** 4 * 2.6) * pixelRatio;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aColor; attribute float aSize; varying vec3 vC;
      void main() { vC = aColor; gl_PointSize = aSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vC; void main() { float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vC, a); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

export interface Backdrop {
  group: THREE.Group;
  tick: (t: number) => void;
}

export function makeBackdrop(weak: boolean, pixelRatio: number): Backdrop {
  const group = new THREE.Group();
  group.add(stars(weak, pixelRatio));

  // soft colour in the deep background
  group.add(glowSprite([[0, "rgba(120,70,190,0.30)"], [0.5, "rgba(70,50,150,0.10)"], [1, "rgba(0,0,0,0)"]], 170, [-60, 40, -150]));
  group.add(glowSprite([[0, "rgba(255,110,50,0.20)"], [0.55, "rgba(180,60,40,0.06)"], [1, "rgba(0,0,0,0)"]], 150, [75, -20, -150]));
  group.add(glowSprite([[0, "rgba(60,150,230,0.18)"], [0.6, "rgba(40,80,170,0.05)"], [1, "rgba(0,0,0,0)"]], 130, [10, 70, -160]));

  const segments = weak ? 48 : 72;
  const earthUniforms = { uSun: { value: SUN_DIR }, uTime: { value: 0 } };
  const earthRadius = 15;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(earthRadius, segments, segments), new THREE.ShaderMaterial({ uniforms: earthUniforms, vertexShader: SPHERE_VERTEX, fragmentShader: EARTH_FRAGMENT }));
  earth.position.set(-37, 12, -84);
  earth.rotation.set(0.35, 2.1, -0.25);
  group.add(earth);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.07, segments, segments),
    new THREE.ShaderMaterial({
      uniforms: { uSun: { value: SUN_DIR }, uColor: { value: new THREE.Color("#5aa8ff") }, uPower: { value: 2.6 }, uGain: { value: 1.5 } },
      vertexShader: SPHERE_VERTEX,
      fragmentShader: HALO_FRAGMENT,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.copy(earth.position);
  group.add(halo);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(6, segments, segments), new THREE.ShaderMaterial({ uniforms: { uSun: { value: SUN_DIR } }, vertexShader: SPHERE_VERTEX, fragmentShader: MOON_FRAGMENT }));
  moon.position.set(30, 13, -72);
  moon.rotation.y = 1.2;
  group.add(moon);

  group.add(glowSprite([[0, "rgba(255,250,235,1)"], [0.05, "rgba(255,236,200,0.85)"], [0.2, "rgba(255,190,120,0.2)"], [1, "rgba(0,0,0,0)"]], 40, [66, 25, -82]));

  return {
    group,
    tick: (t) => {
      earthUniforms.uTime.value = t;
      earth.rotation.y = 2.1 + t * 0.006;
      moon.rotation.y = 1.2 + t * 0.003;
    },
  };
}
