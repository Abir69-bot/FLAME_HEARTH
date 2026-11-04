import * as THREE from "three";

/** Small hand-built models that mark each mission. They are symbols placed at the mission's real conditions, not to scale. */

const metal = (color: string, roughness = 0.45, metalness = 0.55) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(r: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, rotX = 0, rotZ = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), mat);
  m.position.set(x, y, z);
  m.rotation.set(rotX, 0, rotZ);
  return m;
}

function sphere(r: number, mat: THREE.Material, x = 0, y = 0, z = 0, thetaEnd = Math.PI): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, thetaEnd), mat);
  m.position.set(x, y, z);
  return m;
}

function station(): THREE.Group {
  const g = new THREE.Group();
  const white = metal("#e6e8ee", 0.5, 0.35);
  const panel = new THREE.MeshStandardMaterial({ color: "#c98a2b", roughness: 0.3, metalness: 0.85, emissive: "#3a2206", side: THREE.DoubleSide });
  g.add(box(1.5, 0.05, 0.05, metal("#9aa3b2")));
  for (const x of [-0.72, -0.48, 0.48, 0.72]) for (const z of [-0.3, 0.3]) g.add(box(0.18, 0.012, 0.42, panel, x, 0, z));
  g.add(cyl(0.075, 0.62, white, 0, -0.1, 0, Math.PI / 2));
  g.add(cyl(0.065, 0.3, white, 0.16, -0.1, 0.14, 0, Math.PI / 2));
  g.add(cyl(0.065, 0.3, white, -0.16, -0.1, -0.14, 0, Math.PI / 2));
  g.add(sphere(0.085, white, 0, -0.1, 0.3));
  g.add(box(0.26, 0.01, 0.2, metal("#f2f2f2", 0.7, 0.1), 0.26, 0.1, 0));
  g.scale.setScalar(0.62);
  return g;
}

function moonBase(): THREE.Group {
  const g = new THREE.Group();
  const shell = metal("#d9dde6", 0.55, 0.3);
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.05, 28), metal("#6e6c68", 0.95, 0));
  g.add(ground);
  g.add(sphere(0.2, shell, -0.1, 0.02, 0, Math.PI / 2));
  g.add(sphere(0.13, shell, 0.2, 0.02, 0.12, Math.PI / 2));
  g.add(cyl(0.05, 0.2, shell, 0.06, 0.07, 0.05, 0, Math.PI / 2.6));
  g.add(cyl(0.008, 0.34, metal("#aab2c0"), -0.28, 0.18, -0.16));
  g.add(sphere(0.03, new THREE.MeshStandardMaterial({ color: "#ff7a2f", emissive: "#ff7a2f", emissiveIntensity: 2 }), -0.28, 0.36, -0.16));
  g.scale.setScalar(0.82);
  return g;
}

function rover(): THREE.Group {
  const g = new THREE.Group();
  const shell = metal("#eef0f5", 0.45, 0.4);
  const tyre = metal("#23262e", 0.9, 0.1);
  g.add(box(0.5, 0.11, 0.26, shell, 0, 0.09, 0));
  const cab = sphere(0.13, new THREE.MeshStandardMaterial({ color: "#7fd2ff", roughness: 0.1, metalness: 0.9, emissive: "#0b3048" }), 0.14, 0.14, 0, Math.PI / 2);
  g.add(cab);
  for (const x of [-0.18, 0, 0.18]) for (const z of [-0.15, 0.15]) g.add(cyl(0.055, 0.04, tyre, x, 0.05, z, Math.PI / 2));
  g.add(cyl(0.006, 0.2, metal("#aab2c0"), -0.18, 0.24, 0.06));
  g.add(box(0.13, 0.008, 0.09, new THREE.MeshStandardMaterial({ color: "#c98a2b", metalness: 0.85, roughness: 0.3, emissive: "#3a2206" }), -0.14, 0.15, -0.05));
  g.scale.setScalar(0.92);
  return g;
}

function spacesuit(): THREE.Group {
  const g = new THREE.Group();
  const suit = metal("#f1f2f5", 0.7, 0.05);
  g.add(sphere(0.095, suit, 0, 0.26, 0));
  g.add(sphere(0.07, new THREE.MeshStandardMaterial({ color: "#e0a92e", metalness: 1, roughness: 0.14, emissive: "#3a2806" }), 0, 0.26, 0.04));
  g.add(box(0.17, 0.2, 0.1, suit, 0, 0.09, 0));
  g.add(box(0.13, 0.17, 0.07, metal("#c3c8d3"), 0, 0.11, -0.08));
  g.add(cyl(0.032, 0.17, suit, -0.12, 0.08, 0, 0, 0.3));
  g.add(cyl(0.032, 0.17, suit, 0.12, 0.08, 0, 0, -0.3));
  g.add(cyl(0.04, 0.17, suit, -0.05, -0.09, 0));
  g.add(cyl(0.04, 0.17, suit, 0.05, -0.09, 0));
  g.scale.setScalar(1.1);
  return g;
}

function marker(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.16), metal("#e8ecf6")));
  return g;
}

const BUILDERS: Record<string, () => THREE.Group> = { iss: station, "lunar-base": moonBase, "lunar-rover": rover, spacesuit };

export function missionModel(id: string): THREE.Group {
  return (BUILDERS[id] ?? marker)();
}
