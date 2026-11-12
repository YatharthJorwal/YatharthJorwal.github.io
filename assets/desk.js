/* =====================================================================
   Yatharth Webs — the studio desk (3D homepage hero)

   Everything on the desk is built in code: no model files, no images.
   Each project in assets/projects.js that has an entry in SPOTS below
   gets an object on the desk. To add one: write a build function,
   add it to BUILD, give it a place in SPOTS and a position in TOUR.
   Right now that is 16 projects: 15 objects on the desk plus the
   terminal running on the monitor. (The chai, the lamp and the price
   tag are props, not projects.)

   The room wears the site's Graphite theme: graphite wall and desk,
   LEDs that drift through the accent gradient (see LEDS below), a warm
   lamp. The objects keep their own brand colours: they are the colour.

   Handy while editing:
     ?t=14.5   force the Delhi time of day (0–24) the lighting follows
     ?q=lite   force the low-end tier (also: mid, full)
     ?lite     skip 3D entirely (handled by the loader in index.html)
   ===================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const hero = document.getElementById('desk');
const canvas = document.getElementById('deskCanvas');
if (hero && canvas) start().catch(err => { console.error('[desk]', err); hero.dataset.state = 'static'; });

async function start() {

/* ---------- small helpers ---------- */
const V3 = THREE.Vector3, UP = new V3(0, 1, 0), TAU = Math.PI * 2;
const $ = (s, r = document) => r.querySelector(s);
const qs = new URLSearchParams(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (c, g, rate, dt) => c + (g - c) * (1 - Math.exp(-rate * dt));
const backOut = t => { const u = t - 1, c = 1.70158; return 1 + (c + 1) * u * u * u + c * u * u; };
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };   // older Safari
let seed = 11; const rnd =() => (seed = (seed * 16807) % 2147483647) / 2147483647;   // seeded: the desk looks the same on every visit

const ui = {
  copy: $('.desk-copy', hero), tip: $('#deskTip'), card: $('#deskCard'), term: $('#deskTerm'),
  bar: $('#deskBar'), hint: $('#deskHint'), clock: $('#deskClock')
};
const LIST = typeof PROJECTS !== 'undefined' ? PROJECTS : [];
const CAT = { shop: 'Live client site', mockup: 'Sample mockup', own: 'My own build' };

/* The labels on the objects are drawn onto canvases once, so the fonts have to be there first.
   fonts.ready alone is not enough: a web font only downloads once something on the page uses that weight. */
try {
  const faces = ['600 32px "Space Grotesk"', '700 32px "Space Grotesk"', '400 32px "JetBrains Mono"', '700 32px "JetBrains Mono"'];
  const load = async () => {
    await document.fonts.ready;
    for (let i = 0; i < 2; i++) {
      const got = await Promise.all(faces.map(f => document.fonts.load(f, 'Ag₹·')));
      if (i || got.every(a => a.length)) return;
      await new Promise(r => setTimeout(r, 300));   // the font stylesheet may still be on its way: one more try
    }
  };
  await Promise.race([load(), new Promise(r => setTimeout(r, 2000))]);
} catch (_) {}

/* ---------- quality tier ---------- */
const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 4;   // Safari and Firefox do not report memory: assume plenty, the frame-time watchdog still steps slow machines down
const tier = ['lite', 'mid', 'full'].includes(qs.get('q')) ? qs.get('q')
  : (mem <= 2 || cores <= 2) ? 'lite' : (coarse || mem <= 4 || cores <= 4) ? 'mid' : 'full';
let dpr = Math.min(devicePixelRatio || 1, tier === 'full' ? 2 : tier === 'mid' ? 1.5 : 1);

/* ---------- renderer + scene ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'lite', powerPreference: 'high-performance' });
renderer.setPixelRatio(dpr);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = tier !== 'lite';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const ANISO = Math.min(4, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080c);
{
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;   // soft studio reflections for the metals
  pm.dispose();
}

const FOV = 30, T15 = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const camera = new THREE.PerspectiveCamera(FOV, 1, .05, 40);

/* ---------- building blocks ---------- */
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: 0, ...o });
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...o });
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
}
const rbox = (w, h, d, r = .008, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
const cylG = (rt, rb, h, seg = 28, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
function tube(a, b, r, mat, seg = 12) {
  const d = new V3().subVectors(b, a), m = mesh(cylG(r, r, d.length(), seg), mat);
  m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(UP, d.normalize()); return m;
}
/* rounded rectangle slab lying flat: w along x, d along z, thickness t up from y=0 */
function plateGeo(w, d, r, t, bevel = 0) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); return g;
}
function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t;
}
function decal(w, h, map, mat = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: .75, ...mat }));
  m.receiveShadow = true; return m;
}
const DISPLAY = '"Space Grotesk","Segoe UI",system-ui,sans-serif';
const MONO = '"JetBrains Mono",ui-monospace,"Cascadia Mono",Consolas,Menlo,monospace';
const glowTex = tex(128, 128, g => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.28, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size); return s;
}
const gold = (c = 0xe2bd5a, r = .28) => std(c, { metalness: 1, roughness: r });
/* light you can see: unlit, additive, never writes depth (LED washes, glows, the lamp's beam) */
const lightMat = (o = {}) => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...o });

/* ---------- room ---------- */
/* the wall: graphite, with faint panel seams, falling away into the dark towards its edges */
const wallGeo = new THREE.PlaneGeometry(14, 7, 20, 10);
{
  const p = wallGeo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = lerp(1, .3, sstep(.5, 1.7, Math.hypot(p.getX(i) / 3.1, (p.getY(i) + 1.6 - .45) / 2.3)));
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  wallGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
const wallTex = tex(256, 256, (g, w, h) => {
  g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);          // seams
  g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 2, w, 1); g.fillRect(2, 0, 1, h);     // their lit edge
  g.fillStyle = '#fff'; g.fillRect(0, 0, 18, 3); g.fillRect(0, 0, 3, 18); g.fillRect(w - 16, 0, 16, 3); g.fillRect(0, h - 16, 3, 16);   // a small cross where four panels meet
});
wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(14 / .56, 7 / .56);
const wall = mesh(wallGeo, std(0x1c202b, { roughness: .9, map: wallTex, vertexColors: true }), 0, 1.6, -.62);
wall.castShadow = false; scene.add(wall);
const floor = mesh(new THREE.PlaneGeometry(14, 8), std(0x08090d, { roughness: 1 }), 0, -.78, 2);
floor.rotation.x = -Math.PI / 2; floor.castShadow = false; scene.add(floor);

/* the desk top: near-black walnut, a little glossy so it catches the lamp and the LEDs */
const woodTex = tex(1024, 512, (g, w, h) => {
  g.fillStyle = '#191b21'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 420; i++) {
    const y = rnd() * h, len = 120 + rnd() * 700, x = rnd() * w - 200, a = .03 + rnd() * .09;
    g.strokeStyle = rnd() < .55 ? `rgba(0,0,0,${a * 1.6})` : `rgba(150,160,190,${a * .42})`;
    g.lineWidth = .6 + rnd() * 2.6; g.beginPath(); g.moveTo(x, y);
    g.bezierCurveTo(x + len * .3, y + (rnd() - .5) * 8, x + len * .6, y + (rnd() - .5) * 8, x + len, y + (rnd() - .5) * 5); g.stroke();
  }
});
const DESK_W = 2.9, DESK_D = 1.16;
{
  const top = mesh(new THREE.BoxGeometry(DESK_W, .05, DESK_D), std(0xffffff, { map: woodTex, roughness: .36, metalness: .12 }), 0, -.025, 0);
  top.castShadow = false; scene.add(top);
  const edge = std(0x0b0d12, { roughness: .45, metalness: .4 });
  scene.add(mesh(new THREE.BoxGeometry(DESK_W + .004, .052, .004), edge, 0, -.025, DESK_D / 2));
  const leg = std(0x0c0e13, { roughness: .55, metalness: .5 });
  for (const s of [-1, 1]) scene.add(mesh(new THREE.BoxGeometry(.06, .74, DESK_D - .2), leg, s * (DESK_W / 2 - .12), -.42, 0));
}

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight(0x565f7c, 0x101116, .4); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1); sun.position.set(-2.4, 2.6, 2.2); sun.target.position.set(.2, 0, -.15);
sun.castShadow = tier === 'full';
sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
Object.assign(sun.shadow.camera, { left: -1.9, right: 1.9, top: 1.5, bottom: -1.2, near: .5, far: 8 });
scene.add(sun, sun.target);

const LAMP_AT = new V3(1.18, 0, -.4), LAMP_HEAD = new V3(-.27, .66, .1), LAMP_AIM = new V3(.2, 0, .08);
const lampLight = new THREE.SpotLight(0xffd9a3, 0, 5, .95, .7, 2);
lampLight.position.copy(LAMP_AT).add(LAMP_HEAD); lampLight.target.position.copy(LAMP_AIM);
lampLight.castShadow = tier !== 'lite';
lampLight.shadow.mapSize.set(tier === 'full' ? 1024 : 512, tier === 'full' ? 1024 : 512);
lampLight.shadow.bias = -.0006; lampLight.shadow.normalBias = .02; lampLight.shadow.camera.near = .1; lampLight.shadow.camera.far = 4;
scene.add(lampLight, lampLight.target);

const screenLight = new THREE.PointLight(0x8b9bff, .5, 2.2, 2); screenLight.position.set(.04, .36, .0); scene.add(screenLight);
const showLight = new THREE.PointLight(0xfff0dc, 0, 7, 2); scene.add(showLight);
const ledLight = new THREE.PointLight(0xa47bff, 0, 2.6, 2); ledLight.position.set(-.9, .5, -.3); scene.add(ledLight);   // what the wall panels throw onto the desk (no shadows: cheap)

/* window light falling across the wall: its colour and strength follow the real time in Delhi */
const panes = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.6), new THREE.MeshBasicMaterial({
  map: tex(512, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let pass = 0; pass < 16; pass++) {
      g.save(); g.translate(250 + (rnd() - .5) * 16, 250 + (rnd() - .5) * 16); g.transform(1, -.22, -.42, 1, 0, 0);
      g.fillStyle = 'rgba(255,255,255,.07)';
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) g.fillRect(-150 + i * 156, -200 + j * 136, 140, 122);
      g.restore();
    }
  }), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: .12
}));
panes.position.set(1.02, .82, -.615); scene.add(panes);

/* =====================================================================
   LEDS
   One slow gradient (indigo > violet > magenta: the site's accent) drifts
   along the back wall. The wash behind the desk, its reflection in the
   desk top, the strip on the desk's front edge, the hex panels and the
   glow behind the monitor all sample it, so the room changes colour as one.
   ===================================================================== */
const LED_STOPS = ['#6f86ff', '#a47bff', '#e07bff'], LED_COL = LED_STOPS.map(c => new THREE.Color(c));
const LED_SPAN = 3.4, LED_REPEAT = .55;   // the world width the gradient is laid across, and how much of the loop that width shows at once
const led = { u: 0, ripple: -1, next: 6 }, cLed = new THREE.Color();
const ledU = x => (x / LED_SPAN + .5) * LED_REPEAT + led.u;                       // world x -> position in the loop
function ledAt(u, out) { u = (((u % 1) + 1) % 1) * 3; const i = Math.min(2, u | 0); return out.copy(LED_COL[i]).lerp(LED_COL[(i + 1) % 3], u - i); }
const ledTex = tex(256, 4, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0);
  LED_STOPS.forEach((c, i) => gr.addColorStop(i / 3, c)); gr.addColorStop(1, LED_STOPS[0]);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
ledTex.wrapS = THREE.RepeatWrapping; ledTex.repeat.x = LED_REPEAT;
/* alpha maps (opaque greys): light that is strongest along the bottom edge, and a soft band with faded ends */
const riseTex = tex(128, 128, (g, w, h) => {
  const v = g.createLinearGradient(0, h, 0, 0);
  v.addColorStop(0, '#fff'); v.addColorStop(.16, '#b4b4b4'); v.addColorStop(.5, '#4a4a4a'); v.addColorStop(1, '#000');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'multiply';
  const s = g.createLinearGradient(0, 0, w, 0);
  s.addColorStop(0, '#000'); s.addColorStop(.15, '#fff'); s.addColorStop(.85, '#fff'); s.addColorStop(1, '#000');
  g.fillStyle = s; g.fillRect(0, 0, w, h);
});
const bandTex = tex(128, 64, (g, w, h) => {
  const v = g.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, '#000'); v.addColorStop(.3, '#4a4a4a'); v.addColorStop(.5, '#fff'); v.addColorStop(.7, '#4a4a4a'); v.addColorStop(1, '#000');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'multiply';
  const s = g.createLinearGradient(0, 0, w, 0);
  s.addColorStop(.09, '#000'); s.addColorStop(.22, '#fff'); s.addColorStop(.78, '#fff'); s.addColorStop(.91, '#000');
  g.fillStyle = s; g.fillRect(0, 0, w, h);
});
/* a strip of the gradient w wide, centred on x = 0, its colours lined up with everything else that samples it */
function ledPlane(w, h, mat) {
  const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, .5 + (uv.getX(i) - .5) * w / LED_SPAN);
  return new THREE.Mesh(geo, mat);
}
const wallGlow = (w, h, x, y, z = -.616) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lightMat({ map: glowTex, opacity: 0 })); m.position.set(x, y, z); scene.add(m); return m; };

/* an LED strip hidden behind the desk washes the wall; the glossy desk top picks it up */
const wash = ledPlane(LED_SPAN, .8, lightMat({ map: ledTex, alphaMap: riseTex }));
wash.position.set(0, .37, -.618); scene.add(wash);
const deskWash = ledPlane(DESK_W, .52, lightMat({ map: ledTex, alphaMap: riseTex, side: THREE.DoubleSide }));
deskWash.rotation.x = Math.PI / 2; deskWash.position.set(0, .0009, -DESK_D / 2 + .26); scene.add(deskWash);
/* a thin strip let into the desk's front edge, and its bloom */
const strip = ledPlane(DESK_W - .1, .009, new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false }));
strip.position.set(0, -.021, DESK_D / 2 + .0024); scene.add(strip);
const stripGlow = ledPlane(DESK_W - .1, .085, lightMat({ map: ledTex, alphaMap: bandTex }));
stripGlow.position.set(0, -.021, DESK_D / 2 + .004); scene.add(stripGlow);

/* hexagonal light panels on the wall, top left */
const HEX_R = .078, HEX_DX = Math.sqrt(3) * HEX_R + .008, HEX_DY = 1.5 * HEX_R + .007;
const HEX_CELLS = [[0, 0], [1, 0], [2, 0], [4, 0], [0, 1], [1, 1], [3, 1], [4, 1], [5, 1], [3, 2]];   // [column, row] counted from the top left: odd rows sit half a cell to the right
const hexGeo = new THREE.CircleGeometry(HEX_R, 6); hexGeo.rotateZ(Math.PI / 6);
const hexes = new THREE.InstancedMesh(hexGeo, new THREE.MeshBasicMaterial({ toneMapped: false, map: tex(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, '#fff'); r.addColorStop(.62, '#d2d2d2'); r.addColorStop(.86, '#9a9a9a'); r.addColorStop(1, '#6a6a6a');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
}) }), HEX_CELLS.length);
const hexAt = HEX_CELLS.map(([c, r], i) => {
  const x = -1.33 + (c + (r & 1 ? .5 : 0)) * HEX_DX, y = .575 - r * HEX_DY;
  hexes.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, -.612));
  return { x, y, ph: i * 2.4, du: ((i * .37) % 1 - .5) * .16, born: 1 + i * .11 };
});
scene.add(hexes);
const hexGlow = wallGlow(1.6, .85, -.92, .5, -.604);
if (tier === 'lite') hexGlow.visible = false;   // one less layer of blending on weak phones
const ripple = x => led.ripple < 0 ? 0 : Math.exp(-((x - 1.7 + led.ripple * 4.2) ** 2) * 12);   // how hard the ripple is hitting at world x
function ledTick(dt, t) {
  if (!reduce) {
    led.u = (led.u + dt * .014) % 1;
    /* now and then (and whenever the lamp is switched) a ripple of light runs along the wall, right to left */
    if (led.ripple >= 0) { led.ripple += dt; if (led.ripple > 1.1) led.ripple = -1; }
    else if (t > led.next) { led.ripple = 0; led.next = t + 8 + rnd() * 7; }
  }
  ledTex.offset.x = led.u;
  /* by day the washes fade back (the window wins); the panels themselves stay lit */
  const k = lerp(1, .58, sky.day), kHex = lerp(1, .86, sky.day);
  let lit = 0;
  for (let i = 0; i < hexAt.length; i++) {
    const h = hexAt[i], on = reduce ? 1 : sstep(h.born, h.born + .5, t);   // they come on one by one when the desk loads
    const b = on * (.86 + (reduce ? 0 : .13 * Math.sin(t * .8 + h.ph)) + .6 * ripple(h.x));
    lit += b; hexes.setColorAt(i, ledAt(ledU(h.x) + h.du, cLed).multiplyScalar(b * kHex));
  }
  hexes.instanceColor.needsUpdate = true; lit /= hexAt.length;
  ledAt(ledU(-.92), cLed); hexGlow.material.color.copy(cLed); hexGlow.material.opacity = .2 * lit * k;
  ledLight.color.copy(cLed); ledLight.intensity = .85 * lit * k;
  const mid = ripple(0), breathe = reduce ? 1 : 1 + .07 * Math.sin(t * .6);
  wash.material.opacity = (.5 + .3 * mid) * k * breathe; deskWash.material.opacity = (.2 + .14 * mid) * k * breathe;
  stripGlow.material.opacity = (.5 + .4 * mid) * k;
}

/* a pool of accent light on the desk under whatever the pointer is over */
const hoverGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lightMat({ map: glowTex, color: 0x8b9bff, opacity: 0 }));
hoverGlow.rotation.x = -Math.PI / 2; hoverGlow.position.y = .0044; hoverGlow.visible = false; scene.add(hoverGlow);

/* dim backdrop that slides in behind whatever you pick up */
const scrim = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshBasicMaterial({ color: 0x06070b, transparent: true, opacity: 0, depthWrite: false }));
scrim.visible = false; scene.add(scrim);

/* =====================================================================
   THE OBJECTS
   Each builder returns a Group sitting on y = 0. Optional extras:
     g.userData.tick(dt, t, item)  per-frame animation
     g.userData.after              things to add after the hit box is measured (glows)
   ===================================================================== */

/* Bhatti Pizza Co. — an open pizza box */
function buildPizza() {
  const g = new THREE.Group(), S = .3, red = std(0xc6301b, { roughness: .82 }), kraft = std(0xcaa678, { roughness: .92 });
  g.add(mesh(rbox(S, .034, S, .005), red, 0, .017, 0));
  g.add(mesh(new THREE.BoxGeometry(S - .02, .003, S - .02), kraft, 0, .0355, 0));
  const lid = new THREE.Group(); lid.position.set(0, .034, -S / 2); lid.rotation.x = -1.86;
  lid.add(mesh(rbox(S, .007, S, .003), red, 0, 0, S / 2));
  const logo = decal(S - .02, S - .02, tex(384, 384, (c, w, h) => {
    c.fillStyle = '#caa678'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#7a1410'; c.lineWidth = 10; c.beginPath(); c.arc(w / 2, h / 2 - 16, 96, 0, TAU); c.stroke();
    c.fillStyle = '#7a1410'; c.textAlign = 'center'; c.font = `700 150px ${DISPLAY}`; c.fillText('B', w / 2, h / 2 + 36);
    c.font = `700 30px ${DISPLAY}`; c.fillText('BHATTI PIZZA CO.', w / 2, h - 56);
    c.font = `600 20px ${DISPLAY}`; c.fillText('WOOD-FIRED · HAUZ KHAS', w / 2, h - 26);
  }), { roughness: .92 });
  logo.rotation.x = Math.PI / 2; logo.position.set(0, -.0042, S / 2); lid.add(logo);
  g.add(lid);
  const topMat = std(0xffffff, { roughness: .7, map: tex(512, 512, (c, w) => {
    const R = w / 2, circle = (x, y, r, f) => { c.fillStyle = f; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
    circle(R, R, R, '#d39447'); circle(R, R, R * .87, '#b3341b'); circle(R, R, R * .82, '#f1c453');
    for (let i = 0; i < 46; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * R * .78; circle(R + Math.cos(a) * d, R + Math.sin(a) * d, 10 + rnd() * 22, rnd() < .5 ? 'rgba(250,226,150,.55)' : 'rgba(226,160,52,.5)'); }
    for (let i = 0; i < 11; i++) { const a = i * 2.4 + .3, d = R * (.2 + .5 * ((i * .37) % 1)); const x = R + Math.cos(a) * d, y = R + Math.sin(a) * d; circle(x, y, 27, '#8f1f14'); circle(x, y, 22, '#b5301f'); circle(x - 6, y - 6, 4, 'rgba(255,200,170,.35)'); }
    c.fillStyle = '#2f7d32';
    for (let i = 0; i < 8; i++) { const a = i * 1.9 + 1, d = R * (.25 + .45 * ((i * .53) % 1)); c.save(); c.translate(R + Math.cos(a) * d, R + Math.sin(a) * d); c.rotate(a * 2); c.beginPath(); c.ellipse(0, 0, 16, 8, 0, 0, TAU); c.fill(); c.restore(); }
  }) });
  const crust = std(0xc98c44, { roughness: .85 }), cut = TAU / 8, a0 = .2;
  const pie = mesh(new THREE.CylinderGeometry(.128, .128, .012, 56, 1, false, a0 + cut, TAU - cut), [crust, topMat, crust], 0, .043, 0);
  const slice = mesh(new THREE.CylinderGeometry(.128, .128, .012, 10, 1, false, a0, cut), [crust, topMat, crust], Math.sin(a0 + cut / 2) * .034, .05, Math.cos(a0 + cut / 2) * .034);
  slice.rotation.x = -.16; g.add(pie, slice);
  return g;
}

/* Kaagaz Studio — notebooks and a pencil cup */
function buildStationery() {
  const g = new THREE.Group();
  const books = [[.2, .27, .018, 0xd8b48f, .05], [.19, .26, .015, 0x6b2f16, -.07], [.172, .238, .013, 0xf2e7d5, .12]];
  let y = 0;
  for (const [w, d, t, col, rot] of books) {
    const b = mesh(plateGeo(w, d, .012, t), std(col, { roughness: .85 }), -.03, y, 0); b.rotation.y = rot; g.add(b);
    const pages = mesh(new THREE.BoxGeometry(w - .012, t - .006, d - .008), std(0xfbf6ea, { roughness: .95 }), -.03 + .004, y + t / 2, 0); pages.rotation.y = rot; g.add(pages);
    y += t;
  }
  const label = decal(.09, .05, tex(256, 142, (c, w, h) => {
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#6b2f16'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#6b2f16'; c.textAlign = 'center'; c.font = `italic 700 62px Georgia,serif`; c.fillText('Kaagaz', w / 2, 92);
  }));
  label.rotation.set(-Math.PI / 2, 0, .12); label.position.set(-.03, y + .0008, .02); g.add(label);
  const band = mesh(new THREE.BoxGeometry(.012, .002, .24), std(0x6b2f16), .03, y + .001, 0); band.rotation.y = .12; g.add(band);
  const cup = new THREE.Group(); cup.position.set(.15, 0, -.07);
  cup.add(mesh(cylG(.042, .035, .1, 28, true), std(0xb9553a, { roughness: .7, side: THREE.DoubleSide }), 0, .05, 0));
  cup.add(mesh(cylG(.035, .035, .004, 28), std(0x8f3f2a), 0, .002, 0));
  [[0xffd23f, -.012, .004, .1, .12], [0x2eb9b9, .014, -.008, -.12, .06], [0xe5383b, .002, .016, .04, -.14], [0x0f1b3d, -.006, -.016, -.06, -.1], [0xf2e7d5, .018, .012, .15, .1]].forEach(([col, x, z, rz, rx], i) => {
    const p = new THREE.Group(); p.position.set(x, .012, z); p.rotation.set(rx, 0, rz);
    const len = .15 + (i % 3) * .012;
    p.add(mesh(cylG(.0052, .0052, len, 6), std(col, { roughness: .5 }), 0, len / 2, 0));
    p.add(mesh(new THREE.ConeGeometry(.0052, .016, 6), std(0xe8c9a0), 0, len + .008, 0));
    p.add(mesh(new THREE.ConeGeometry(.002, .006, 6), std(0x222222), 0, len + .0135, 0));
    cup.add(p);
  });
  g.add(cup);
  return g;
}

/* Manzil Tours & Travels — a folded route map with a toy SUV on it */
function buildMap() {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(.38, .26, 3, 1); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, fold = [.003, .021, .003, .021];
  for (let i = 0; i < pos.count; i++) pos.setY(i, fold[i % 4]);
  geo.computeVertexNormals();
  const paper = mesh(geo, std(0xffffff, { roughness: .92, side: THREE.DoubleSide, map: tex(760, 520, (c, w, h) => {
    c.fillStyle = '#f3ead6'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#cfe3c3'; [[120, 110, 90, 60], [600, 380, 120, 70], [420, 90, 70, 40]].forEach(([x, y, a, b]) => { c.beginPath(); c.ellipse(x, y, a, b, .3, 0, TAU); c.fill(); });
    c.strokeStyle = '#a9d0e8'; c.lineWidth = 26; c.lineCap = 'round'; c.beginPath(); c.moveTo(560, -20); c.bezierCurveTo(500, 160, 640, 300, 520, 560); c.stroke();
    c.strokeStyle = '#d9cdb3'; c.lineWidth = 5;
    for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(-20, 40 + i * 62 + (i % 2) * 14); c.lineTo(w + 20, 10 + i * 62); c.stroke(); c.beginPath(); c.moveTo(50 + i * 88, -10); c.lineTo(20 + i * 88, h + 10); c.stroke(); }
    const route = () => { c.beginPath(); c.moveTo(110, 420); c.bezierCurveTo(230, 400, 250, 250, 370, 250); c.bezierCurveTo(480, 250, 470, 130, 640, 110); };
    c.strokeStyle = '#10275a'; c.lineWidth = 20; route(); c.stroke(); c.strokeStyle = '#ffd23f'; c.lineWidth = 11; route(); c.stroke();
    c.fillStyle = '#10275a'; c.beginPath(); c.arc(110, 420, 15, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(110, 420, 6, 0, TAU); c.fill();
    c.fillStyle = '#10275a'; c.font = `700 34px ${DISPLAY}`; c.fillText('DELHI NCR', 40, 62); c.font = `600 20px ${DISPLAY}`; c.fillText('Manzil Tours & Travels', 40, 92);
    c.fillStyle = 'rgba(60,40,20,.08)'; c.fillRect(w / 3 - 3, 0, 6, h); c.fillRect(w * 2 / 3 - 3, 0, 6, h);
  }) }));
  g.add(paper);
  const suv = new THREE.Group(); suv.position.set(-.085, .014, .045); suv.rotation.y = .5;
  const blue = std(0x1e4aa8, { roughness: .35, metalness: .3 }), tyre = std(0x15161a, { roughness: .9 });
  suv.add(mesh(rbox(.13, .04, .062, .012), blue, 0, .042, 0));
  suv.add(mesh(rbox(.082, .034, .056, .012), std(0x0c1836, { roughness: .15, metalness: .5 }), -.01, .074, 0));
  suv.add(mesh(rbox(.03, .012, .016, .004), std(0xffd23f), -.01, .096, 0));
  for (const [x, z] of [[.042, .031], [.042, -.031], [-.042, .031], [-.042, -.031]]) { const w = mesh(cylG(.02, .02, .016, 18), tyre, x, .02, z); w.rotation.x = Math.PI / 2; suv.add(w); }
  g.add(suv);
  const pin = new THREE.Group(); pin.position.set(.13, .02, -.074);
  pin.add(mesh(new THREE.SphereGeometry(.015, 16, 12), std(0xe5383b, { roughness: .3 }), 0, .045, 0));
  const tip = mesh(new THREE.ConeGeometry(.008, .034, 12), std(0xe5383b, { roughness: .3 }), 0, .018, 0); tip.rotation.x = Math.PI; pin.add(tip);
  g.add(pin);
  g.userData.tick = (dt, t) => { pin.position.y = .02 + Math.abs(Math.sin(t * 2.2)) * .012; };
  return g;
}

/* The Tiger King — a framed miniature leaning on the wall */
function buildFrame() {
  const g = new THREE.Group(), W = .27, H = .35, lean = new THREE.Group();
  lean.add(mesh(rbox(W, H, .022, .006), std(0x4d1a0e, { roughness: .6 }), 0, H / 2, 0));
  lean.add(mesh(new THREE.BoxGeometry(W - .03, H - .03, .004), gold(0xc9a24a, .4), 0, H / 2, .0105));
  const art = decal(W - .046, H - .046, tex(448, 608, paintTiger)); art.position.set(0, H / 2, .0132); lean.add(art);
  lean.rotation.x = -.17; g.add(lean);
  return g;
}
function paintTiger(c, w, h) {
  const m = 26;
  c.fillStyle = '#7a2e14'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { c.fillStyle = i % 2 ? '#f0b84a' : '#3f8f7c'; const t = (i + .5) / 26; for (const [x, y] of [[t * w, m / 2], [t * w, h - m / 2], [m / 2, t * h], [w - m / 2, t * h]]) { c.beginPath(); c.arc(x, y, 4, 0, TAU); c.fill(); } }
  const sky = c.createLinearGradient(0, m, 0, h - m); sky.addColorStop(0, '#f8d47c'); sky.addColorStop(1, '#e89c36');
  c.fillStyle = sky; c.fillRect(m, m, w - 2 * m, h - 2 * m);
  c.fillStyle = '#c8321e'; c.beginPath(); c.arc(w * .73, 190, 28, 0, TAU); c.fill();
  c.fillStyle = '#3d7a4c'; c.beginPath(); c.moveTo(m, 420); c.bezierCurveTo(140, 370, 250, 440, w - m, 392); c.lineTo(w - m, h - m); c.lineTo(m, h - m); c.fill();
  c.fillStyle = '#2b5c39'; c.beginPath(); c.moveTo(m, 470); c.bezierCurveTo(160, 440, 300, 500, w - m, 452); c.lineTo(w - m, h - m); c.lineTo(m, h - m); c.fill();
  /* arch */
  c.fillStyle = '#7a2e14'; c.beginPath(); c.moveTo(m, m + 170); c.bezierCurveTo(m, m + 70, w / 2 - 70, m + 62, w / 2, m + 10);
  c.bezierCurveTo(w / 2 + 70, m + 62, w - m, m + 70, w - m, m + 170); c.lineTo(w - m, m); c.lineTo(m, m); c.fill();
  c.strokeStyle = '#f0b84a'; c.lineWidth = 3; c.beginPath(); c.moveTo(m + 5, m + 170); c.bezierCurveTo(m + 5, m + 78, w / 2 - 66, m + 68, w / 2, m + 18);
  c.bezierCurveTo(w / 2 + 66, m + 68, w - m - 5, m + 78, w - m - 5, m + 170); c.stroke();
  /* tiger */
  const cx = w / 2 + 8, cy = 372, O = '#e2711d', K = '#1d120c';
  c.lineCap = 'round';
  c.strokeStyle = O; c.lineWidth = 17; c.beginPath(); c.moveTo(cx + 92, cy - 6); c.bezierCurveTo(cx + 152, cy - 20, cx + 150, cy - 104, cx + 108, cy - 100); c.stroke();
  c.strokeStyle = K; c.lineWidth = 17; c.beginPath(); c.moveTo(cx + 116, cy - 102); c.lineTo(cx + 108, cy - 100); c.stroke();
  c.fillStyle = O; for (const x of [-72, -40, 44, 76]) { c.beginPath(); c.roundRect(cx + x - 12, cy + 16, 24, 70, 11); c.fill(); }
  c.fillStyle = '#f6e3c2'; for (const x of [-72, -40, 44, 76]) { c.beginPath(); c.roundRect(cx + x - 13, cy + 72, 26, 16, 8); c.fill(); }
  c.fillStyle = O; c.beginPath(); c.ellipse(cx, cy, 102, 48, 0, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.ellipse(cx, cy, 102, 48, 0, 0, TAU); c.clip();
  c.fillStyle = '#f6e3c2'; c.beginPath(); c.ellipse(cx, cy + 48, 90, 22, 0, 0, TAU); c.fill();
  c.strokeStyle = K; c.lineWidth = 9;
  for (let i = 0; i < 7; i++) { const x = cx - 56 + i * 25; c.beginPath(); c.moveTo(x, cy - 54); c.quadraticCurveTo(x + 14, cy - 20, x + 2, cy + 8); c.stroke(); }
  c.restore();
  const hx = cx - 98, hy = cy - 38;
  c.fillStyle = O; for (const s of [-1, 1]) { c.beginPath(); c.arc(hx + s * 30, hy - 34, 15, 0, TAU); c.fill(); }
  c.fillStyle = K; for (const s of [-1, 1]) { c.beginPath(); c.arc(hx + s * 30, hy - 34, 7, 0, TAU); c.fill(); }
  c.fillStyle = O; c.beginPath(); c.arc(hx, hy, 46, 0, TAU); c.fill();
  c.fillStyle = '#f6e3c2'; c.beginPath(); c.ellipse(hx, hy + 20, 27, 19, 0, 0, TAU); c.fill();
  c.strokeStyle = K; c.lineWidth = 6; for (const dx of [-14, 0, 14]) { c.beginPath(); c.moveTo(hx + dx, hy - 44); c.lineTo(hx + dx * .7, hy - 26); c.stroke(); }
  for (const s of [-1, 1]) { c.fillStyle = '#ffd23f'; c.beginPath(); c.ellipse(hx + s * 18, hy - 6, 9, 7, 0, 0, TAU); c.fill(); c.fillStyle = K; c.beginPath(); c.arc(hx + s * 18, hy - 6, 3.6, 0, TAU); c.fill(); }
  c.fillStyle = K; c.beginPath(); c.moveTo(hx - 8, hy + 8); c.lineTo(hx + 8, hy + 8); c.lineTo(hx, hy + 18); c.fill();
  c.lineWidth = 3; c.beginPath(); c.moveTo(hx, hy + 18); c.lineTo(hx, hy + 27); c.moveTo(hx - 12, hy + 30); c.quadraticCurveTo(hx, hy + 36, hx + 12, hy + 30); c.stroke();
  c.lineWidth = 1.6; for (const s of [-1, 1]) for (const dy of [-3, 3]) { c.beginPath(); c.moveTo(hx + s * 16, hy + 22); c.lineTo(hx + s * 50, hy + 20 + dy * 2); c.stroke(); }
  /* title */
  c.fillStyle = '#2a0f0a'; c.fillRect(m, h - m - 66, w - 2 * m, 66);
  c.fillStyle = '#f0b84a'; c.textAlign = 'center'; c.font = `700 30px ${DISPLAY}`; c.fillText('THE TIGER KING', w / 2, h - m - 24);
}

/* Auren Frame — matte spectacles */
function buildGlasses() {
  const g = new THREE.Group(), frame = std(0x17171b, { roughness: .6 }), au = gold(0xc9a45c, .3);
  const lens = new THREE.MeshStandardMaterial({ color: 0xa8bdd2, transparent: true, opacity: .26, roughness: .04, metalness: .3, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const rim = mesh(new THREE.TorusGeometry(.036, .0048, 10, 44), frame, s * .048, .048, 0); rim.scale.x = 1.13; g.add(rim);
    const l = new THREE.Mesh(new THREE.CircleGeometry(.036, 36), lens); l.position.copy(rim.position); l.scale.x = 1.13; g.add(l);
    g.add(mesh(rbox(.013, .011, .009, .002), au, s * .094, .055, -.003));
    g.add(tube(new V3(s * .096, .055, -.006), new V3(s * .1, .04, -.14), .0034, frame, 8));
    g.add(tube(new V3(s * .1, .04, -.14), new V3(s * .098, .012, -.162), .0034, frame, 8));
  }
  const bridge = mesh(new THREE.TorusGeometry(.0105, .0036, 8, 18, Math.PI), au, 0, .053, 0); g.add(bridge);
  g.rotation.x = -.06;
  const wrap = new THREE.Group(); wrap.add(g); return wrap;
}

/* EchoBridge — the companion ring floating over its charging puck */
function buildEchoRing() {
  const g = new THREE.Group(), teal = 0x5eead4;
  g.add(mesh(cylG(.058, .062, .018, 40), std(0x231552, { roughness: .35, metalness: .3 }), 0, .009, 0));
  const line = new THREE.Mesh(new THREE.TorusGeometry(.04, .0022, 8, 56), basic(teal)); line.rotation.x = Math.PI / 2; line.position.y = .0185; g.add(line);
  const ring = new THREE.Group(); ring.position.y = .092;
  ring.add(mesh(new THREE.TorusGeometry(.028, .0078, 18, 56), std(0x3a3160, { metalness: .95, roughness: .22 })));
  const inner = new THREE.Mesh(new THREE.TorusGeometry(.0218, .002, 8, 56), basic(teal)); ring.add(inner);
  g.add(ring);
  const halo = glow(teal, .2, .5); halo.position.y = .04;
  g.userData.after = [halo];
  g.userData.tick = (dt, t) => {
    ring.rotation.set(1.05 + Math.sin(t * .9) * .18, t * .8, 0); ring.position.y = .092 + Math.sin(t * 1.6) * .008;
    const p = .55 + .45 * Math.sin(t * 2.4); halo.material.opacity = .25 + .35 * p; inner.material.color.setHex(teal).multiplyScalar(.6 + .4 * p);
  };
  return g;
}

/* Detent — a 65% mechanical keyboard with a rotary knob; keys press as the terminal types */
const kb = { press() {} };
function buildKeyboard() {
  const g = new THREE.Group(), U = .0262, rows = [
    [...Array(14).fill(1)], [1.5, ...Array(12).fill(1), 1.5], [1.75, ...Array(11).fill(1), 2.25],
    [2.25, ...Array(10).fill(1), 1.75, 1], [1.25, 1.25, 1.25, 6.25, 1, 1, 1, 1, 1]
  ];
  const tilt = new THREE.Group(); tilt.rotation.x = .07;
  tilt.add(mesh(plateGeo(.425, .158, .014, .02, .003), std(0x1d2026, { roughness: .4, metalness: .5 }), 0, .003, 0));
  const keys = [];
  rows.forEach((row, r) => { let x = -7.5 * U; row.forEach((w, i) => {
    const edge = i === 0 || i === row.length - 1 || r === 4;
    keys.push({ x: x + w * U / 2, z: (r - 2) * U, w, col: (r === 0 && i === 0) || (r === 2 && i === row.length - 1) ? 0xf0a03c : (edge && w !== 6.25) ? 0x3b4049 : 0xece6d8 });
    x += w * U;
  }); });
  const inst = new THREE.InstancedMesh(rbox(.0232, .012, .0232, .0038, 2), std(0xffffff, { roughness: .55 }), keys.length);
  inst.castShadow = true; inst.receiveShadow = true;
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), press = new Float32Array(keys.length);
  const setKey = i => { const k = keys[i]; m4.makeScale((k.w * U - .003) / .0232, 1, 1); m4.setPosition(k.x, .0315 - press[i] * .0055, k.z); inst.setMatrixAt(i, m4); };
  keys.forEach((k, i) => { setKey(i); inst.setColorAt(i, col.setHex(k.col)); });
  tilt.add(inst);
  const knob = mesh(cylG(.0105, .0115, .017, 24), std(0xf0a03c, { metalness: .8, roughness: .3 }), 7 * U, .034, -2 * U); tilt.add(knob);
  g.add(tilt);
  let live = false;
  kb.press = i => { press[i === undefined ? (rnd() * keys.length) | 0 : i] = 1; live = true; };
  g.userData.tick = (dt, t, it) => {
    if (it && (it.hov > .5 || it.kGoal === 1) && rnd() < dt * 9) kb.press();
    knob.rotation.y = t * .6;
    if (!live) return; live = false;
    for (let i = 0; i < press.length; i++) if (press[i] > 0) { press[i] = Math.max(0, press[i] - dt * 7); setKey(i); live = true; }
    inst.instanceMatrix.needsUpdate = true;
  };
  return g;
}

/* iDeserve Nutrition — a tub and a shaker */
function buildTub() {
  const g = new THREE.Group(), black = std(0x121210, { roughness: .45 });
  const label = std(0xffffff, { roughness: .5, map: tex(1024, 320, (c, w, h) => {
    c.fillStyle = '#0d0d0b'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e3c04d'; c.fillRect(0, 22, w, 8); c.fillRect(0, h - 30, w, 8);
    c.textAlign = 'center'; c.font = `700 150px ${DISPLAY}`; c.fillText('iD', w / 2, 178);
    c.font = `700 34px ${DISPLAY}`; c.fillText('iDESERVE NUTRITION', w / 2, 232);
    c.fillStyle = '#b9b39a'; c.font = `600 22px ${DISPLAY}`; c.fillText('PERFORMANCE NUTRITION', w / 2, 266);
    c.fillStyle = '#e3c04d'; for (const x of [150, w - 150]) { c.beginPath(); c.arc(x, h / 2, 46, 0, TAU); c.fill(); }
    c.fillStyle = '#0d0d0b'; c.font = `700 44px ${DISPLAY}`; c.fillText('iD', 150, h / 2 + 16); c.fillText('iD', w - 150, h / 2 + 16);
  }) });
  const tub = mesh(cylG(.066, .066, .15, 48), [label, black, black], 0, .075, 0); tub.rotation.y = Math.PI; g.add(tub);
  g.add(mesh(cylG(.07, .07, .03, 48), std(0x1b1b18, { roughness: .3 }), 0, .165, 0));
  g.add(mesh(cylG(.058, .058, .004, 40), gold(0xe3c04d, .35), 0, .1815, 0));
  const sh = new THREE.Group(); sh.position.set(.125, 0, .05);
  const smoke = new THREE.MeshStandardMaterial({ color: 0x3a3626, transparent: true, opacity: .62, roughness: .15 });
  sh.add(mesh(cylG(.034, .029, .14, 32), smoke, 0, .07, 0));
  sh.add(mesh(cylG(.028, .026, .07, 32), std(0xe3c04d, { roughness: .5 }), 0, .04, 0));
  sh.add(mesh(cylG(.037, .037, .03, 32), black, 0, .155, 0));
  sh.add(mesh(cylG(.012, .014, .02, 16), black, .012, .18, 0));
  g.add(sh);
  return g;
}

/* Pagani Imola — a scale model on a plinth */
function buildCar() {
  const g = new THREE.Group(), paint = std(0x2448c9, { metalness: .78, roughness: .24 });
  g.add(mesh(plateGeo(.4, .19, .012, .016, .003), std(0x0c1022, { roughness: .25, metalness: .4 }), 0, .003, 0));
  g.add(mesh(new THREE.BoxGeometry(.07, .002, .018), gold(0xc7a04c, .4), .12, .0225, .075));
  const car = new THREE.Group(); car.position.y = .022;
  const s = new THREE.Shape();
  s.moveTo(-.155, .020); s.lineTo(.150, .020); s.quadraticCurveTo(.172, .024, .168, .038);
  s.quadraticCurveTo(.09, .054, 0, .060); s.quadraticCurveTo(-.09, .066, -.150, .068);
  s.lineTo(-.160, .052); s.quadraticCurveTo(-.164, .030, -.155, .020);
  const body = new THREE.ExtrudeGeometry(s, { depth: .092, bevelEnabled: true, bevelThickness: .012, bevelSize: .008, bevelSegments: 3, curveSegments: 12 });
  body.translate(0, 0, -.046); car.add(mesh(body, paint));
  const canopy = mesh(new THREE.SphereGeometry(1, 28, 18), std(0x0a0f20, { metalness: .7, roughness: .06 }), -.03, .06, 0); canopy.scale.set(.098, .03, .041); car.add(canopy);
  const tyre = std(0x121317, { roughness: .85 }), hub = std(0xcfd6e6, { metalness: 1, roughness: .25 });
  for (const [x, z] of [[.098, .052], [.098, -.052], [-.1, .052], [-.1, -.052]]) {
    const w = mesh(cylG(.027, .027, .024, 24), tyre, x, .027, z); w.rotation.x = Math.PI / 2; car.add(w);
    const h = mesh(cylG(.015, .015, .026, 16), hub, x, .027, z); h.rotation.x = Math.PI / 2; car.add(h);
  }
  car.add(mesh(rbox(.04, .005, .124, .002), std(0x8fb4ff, { metalness: .6, roughness: .3 }), -.15, .098, 0));
  for (const z of [-.036, .036]) car.add(mesh(new THREE.BoxGeometry(.008, .03, .005), std(0x0c1022), -.146, .082, z));
  for (const z of [-.034, .034]) car.add(new THREE.Mesh(new THREE.SphereGeometry(.006, 10, 8), basic(0xcfe0ff)).translateX(.163).translateY(.036).translateZ(z));
  car.add(mesh(new THREE.BoxGeometry(.2, .002, .014), std(0x8fb4ff, { metalness: .5, roughness: .3 }), .03, .0625, 0));
  g.add(car);
  return g;
}

/* Tech Finds — a phone in a custom case, on a stand */
function buildPhone() {
  const g = new THREE.Group(), lean = new THREE.Group(); lean.position.set(0, .012, .012); lean.rotation.x = -.3;
  const W = .088, H = .18;
  const body = mesh(plateGeo(W, H, .014, .011, .0015), std(0x101426, { roughness: .5 }), 0, H / 2, -.0055); body.rotation.x = Math.PI / 2; lean.add(body);
  const art = decal(W - .004, H - .004, tex(352, 720, (c, w, h) => {
    c.fillStyle = '#0f1220'; c.beginPath(); c.roundRect(0, 0, w, h, 52); c.fill();
    c.save(); c.beginPath(); c.roundRect(0, 0, w, h, 52); c.clip();
    c.strokeStyle = '#e0b45a'; c.lineWidth = 5;
    for (let i = -6; i < 14; i++) { c.globalAlpha = .22 + .5 * ((i + 6) % 3 === 0); c.beginPath(); c.moveTo(-40, i * 70); c.lineTo(w + 40, i * 70 + 260); c.stroke(); }
    c.globalAlpha = 1; c.fillStyle = '#262b4a'; c.beginPath(); c.arc(w / 2, h * .62, 96, 0, TAU); c.fill();
    c.strokeStyle = '#e0b45a'; c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h * .62, 96, 0, TAU); c.stroke();
    c.fillStyle = '#e0b45a'; c.textAlign = 'center'; c.font = `700 96px ${DISPLAY}`; c.fillText('TF', w / 2, h * .62 + 34);
    c.font = `700 24px ${DISPLAY}`; c.fillText('TECH FINDS', w / 2, h - 60);
    c.restore();
  }), { alphaTest: .5, roughness: .45 });
  art.position.set(0, H / 2, .0076); lean.add(art);
  lean.add(mesh(rbox(.04, .04, .006, .0028), std(0x1b2036, { roughness: .3, metalness: .5 }), -.018, H - .034, .009));
  for (const [x, y] of [[-.027, H - .025], [-.009, H - .025], [-.018, H - .044]]) { const l = mesh(cylG(.0065, .0065, .004, 16), std(0x05070d, { roughness: .05, metalness: .8 }), x, y, .0125); l.rotation.x = Math.PI / 2; lean.add(l); }
  g.add(lean);
  const stand = std(0xe0b45a, { metalness: .9, roughness: .35 });
  g.add(mesh(rbox(.075, .008, .085, .003), stand, 0, .004, -.02));
  g.add(mesh(rbox(.075, .016, .008, .003), stand, 0, .012, .022));
  const back = mesh(rbox(.05, .11, .006, .002), stand, 0, .058, -.03); back.rotation.x = -.3; g.add(back);
  return g;
}

/* Ginni Plus — a brass lever handle and a knob on a showroom sample board */
function buildHandle() {
  const g = new THREE.Group(), lean = new THREE.Group(); lean.rotation.x = -.2;
  const brass = gold(0xd4af37, .26);
  lean.add(mesh(rbox(.17, .24, .02, .006), std(0x3d2a12, { roughness: .55 }), 0, .12, 0));
  const z = r => { r.rotation.x = Math.PI / 2; return r; };
  lean.add(z(mesh(cylG(.03, .03, .008, 32), brass, -.03, .165, .014)));
  lean.add(z(mesh(cylG(.009, .009, .034, 16), brass, -.03, .165, .032)));
  lean.add(mesh(rbox(.125, .017, .015, .007), brass, .025, .165, .05));
  lean.add(z(mesh(cylG(.021, .021, .007, 28), brass, -.03, .07, .0135)));
  lean.add(z(mesh(cylG(.007, .007, .026, 14), brass, -.03, .07, .028)));
  const knob = mesh(new THREE.SphereGeometry(.021, 24, 16), brass, -.03, .07, .05); knob.scale.z = .72; lean.add(knob);
  const plate = decal(.07, .03, tex(256, 110, (c, w, h) => {
    c.fillStyle = '#d4af37'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c1206'; c.textAlign = 'center';
    c.font = `700 44px ${DISPLAY}`; c.fillText('GINNI PLUS', w / 2, 56); c.font = `600 20px ${DISPLAY}`; c.fillText('CHAWRI BAZAR · DELHI', w / 2, 88);
  }), { metalness: .7, roughness: .4 });
  plate.position.set(.035, .05, .0105); lean.add(plate);
  g.add(lean);
  const kick = mesh(rbox(.02, .2, .012, .004), std(0x2a1c0c), 0, .09, -.06); kick.rotation.x = .28; g.add(kick);
  return g;
}

/* Trishla Gold — a ring in an open box */
function buildRingBox() {
  const g = new THREE.Group(), S = .11, shell = std(0x16261f, { roughness: .5 }), satin = std(0xf3ead2, { roughness: .9 });
  g.add(mesh(rbox(S, .05, S, .01), shell, 0, .025, 0));
  g.add(mesh(rbox(S - .016, .012, S - .016, .005), satin, 0, .05, 0));
  g.add(mesh(new THREE.BoxGeometry(S + .002, .003, S + .002), gold(0xe8c766, .35), 0, .046, 0));
  const lid = new THREE.Group(); lid.position.set(0, .05, -S / 2); lid.rotation.x = -1.92;
  lid.add(mesh(rbox(S, .032, S, .01), shell, 0, .016, S / 2));
  const inside = decal(S - .02, S - .02, tex(256, 256, (c, w, h) => {
    c.fillStyle = '#f3ead2'; c.fillRect(0, 0, w, h); c.fillStyle = '#9a7a24'; c.textAlign = 'center';
    c.font = `700 46px ${DISPLAY}`; c.fillText('TRISHLA', w / 2, 122); c.font = `600 24px ${DISPLAY}`; c.fillText('GOLD & DIAMONDS', w / 2, 158);
  }), { roughness: .9 });
  inside.rotation.x = Math.PI / 2; inside.position.set(0, -.0006, S / 2); lid.add(inside);
  g.add(lid);
  const au = gold(0xe8c766, .2);
  g.add(mesh(new THREE.TorusGeometry(.021, .0044, 14, 48), au, 0, .074, .004));
  g.add(mesh(cylG(.007, .004, .007, 8), au, 0, .0975, .004));
  const stone = mesh(new THREE.OctahedronGeometry(.0095, 0), std(0xffffff, { roughness: 0, metalness: .1, flatShading: true, envMapIntensity: 3 }), 0, .106, .004); stone.scale.y = .8; g.add(stone);
  const spark = glow(0xffffff, .05, .8); spark.position.set(0, .108, .012);
  g.userData.after = [spark];
  g.userData.tick = (dt, t) => { stone.rotation.y = t * .9; spark.material.opacity = .25 + .6 * Math.pow(.5 + .5 * Math.sin(t * 3.1), 4); };
  return g;
}

/* Vedic Ratna — a cut stone turning over its cushion */
function buildGem() {
  const g = new THREE.Group();
  g.add(mesh(rbox(.13, .03, .13, .012), std(0x7a2e3a, { roughness: .95 }), 0, .015, 0));
  g.add(mesh(new THREE.BoxGeometry(.134, .004, .134), gold(0xc9a45c, .4), 0, .006, 0));
  const bezel = mesh(new THREE.TorusGeometry(.03, .004, 10, 40), gold(0xd9b96a, .3), 0, .034, 0); bezel.rotation.x = Math.PI / 2; g.add(bezel);
  const cutGeo = new THREE.LatheGeometry([[0, -.058], [.05, 0], [.05, .004], [.032, .025], [0, .025]].map(p => new THREE.Vector2(p[0], p[1])), 8);
  const cut = (color, emis) => std(color, { roughness: .06, metalness: .15, flatShading: true, emissive: emis, emissiveIntensity: .7, envMapIntensity: 2.4 });
  const stone = mesh(cutGeo, cut(0xc2163f, 0x4a0414), 0, .112, 0); g.add(stone);
  const small = [[0x1fa36c, 0x063a22, -.043, .043], [0x2d5be0, 0x081a55, .043, .043], [0xf0b429, 0x4a2c00, .043, -.043]].map(([c, e, x, z]) => { const m = mesh(cutGeo, cut(c, e), x, .046, z); m.scale.setScalar(.3); g.add(m); return m; });
  const spark = glow(0xffd9e2, .09, .7); spark.position.set(.02, .13, .03);
  g.userData.after = [spark];
  g.userData.tick = (dt, t) => {
    stone.rotation.y = t * .7; stone.position.y = .112 + Math.sin(t * 1.3) * .006; small.forEach((m, i) => m.rotation.y = -t * .5 + i);
    spark.material.opacity = .15 + .7 * Math.pow(.5 + .5 * Math.sin(t * 2.3), 6); spark.position.x = Math.sin(t * .7) * .03;
  };
  return g;
}

/* Isha Fashions — a fan of leather swatches */
function buildSwatches() {
  const g = new THREE.Group(), cols = [0x1b1716, 0x5a2a4a, 0x4a2a1a, 0xa8693a, 0xd9bfc4], geo = plateGeo(.21, .078, .014, .0042, .0008);
  cols.forEach((c, i) => {
    const p = new THREE.Group(); p.rotation.y = (i - 2) * .3; p.position.y = i * .0062;
    p.add(mesh(geo, std(c, { roughness: .5, metalness: .05 }), .085, 0, 0));
    const stitch = mesh(new THREE.BoxGeometry(.17, .0006, .0012), std(0xe9dcc4, { roughness: .9 }), .09, .0056, .03); p.add(stitch);
    g.add(p);
  });
  g.add(mesh(cylG(.008, .008, .036, 16), gold(0xc7a04c, .3), 0, .018, 0));
  g.add(mesh(cylG(.012, .012, .003, 16), gold(0xc7a04c, .3), 0, .0365, 0));
  return g;
}

/* Nitida — the Nitidus I electric toothbrush, standing on its charging puck.
   Modelled on the real product: a straight pearl handle with a mint base cap, a black power
   button two-thirds of the way up, a slim neck and an oblong head of white bristles, wordmark on the back.
   The button ring breathes and the battery dots chase while it charges; hover it or pick it up and the head hums. */
function buildBrush() {
  const g = new THREE.Group(), mint = 0xbff5e6, R = .019;
  const pearl = std(0xf4f6f4, { roughness: .22, metalness: .04, envMapIntensity: 1.5 });
  const gloss = std(0x08090b, { roughness: .08, metalness: .5, envMapIntensity: 1.8 });
  const steel = std(0xc9d2ce, { metalness: 1, roughness: .2 });
  const small = m => { m.castShadow = false; return m; };   // too small to be worth a shadow pass
  const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
  /* charging puck with a thin light line round it */
  g.add(mesh(lathe([[0, 0], [.036, 0], [.038, .003], [.036, .011], [.0215, .0125], [.0205, .017], [0, .017]]), std(0x0c0e12, { roughness: .32, metalness: .55 })));
  const line = new THREE.Mesh(new THREE.TorusGeometry(.0302, .0011, 6, 48), basic(mint)); line.rotation.x = Math.PI / 2; line.position.y = .0122; g.add(line);
  /* handle: mint base cap, a hairline gap, then one straight pearl shell with a rounded shoulder */
  const brush = new THREE.Group(); brush.position.y = .017; g.add(brush);
  const capH = .017, bodyTop = .188;
  brush.add(mesh(lathe([[0, 0], [R - .003, 0], [R, .003], [R, capH]]), std(0x8fd6c4, { metalness: .85, roughness: .24 })));
  brush.add(small(mesh(cylG(R - .0006, R - .0006, .0012, 32), gloss, 0, capH + .0006, 0)));
  brush.add(mesh(lathe([[R, capH + .0012], [R, bodyTop - .016], [R - .0012, bodyTop - .008], [R - .0045, bodyTop - .002], [.0098, bodyTop], [0, bodyTop]]), pearl));
  /* power button: gloss black disc, white power symbol, a breathing ring, three battery dots under it.
     wrap() bends each flat part onto the round handle so nothing pokes past its outline as it turns */
  const by = .128;
  const wrap = geo => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.sqrt(Math.max(0, R * R - p.getX(i) ** 2)) - R); geo.computeVertexNormals(); return geo; };
  const btnGeo = cylG(.0098, .0098, .0036, 28); btnGeo.rotateX(Math.PI / 2);
  brush.add(small(mesh(wrap(btnGeo), gloss, 0, by, R - .0006)));
  const icon = new THREE.Mesh(wrap(new THREE.PlaneGeometry(.0128, .0128, 8, 1)), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false, map: tex(128, 128, (c, w) => {
    c.strokeStyle = '#fff'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.arc(w / 2, w / 2 + 4, 30, -Math.PI / 2 + .62, -Math.PI / 2 - .62 + TAU); c.stroke();
    c.beginPath(); c.moveTo(w / 2, w / 2 - 34); c.lineTo(w / 2, w / 2 - 2); c.stroke();
  }) }));
  icon.position.set(0, by, R + .0014); brush.add(icon);
  const ring = new THREE.Mesh(wrap(new THREE.TorusGeometry(.0114, .0008, 6, 36)), basic(mint)); ring.position.set(0, by, R + .0004); brush.add(ring);
  const dots = [0, 1, 2].map(i => { const d = new THREE.Mesh(new THREE.CircleGeometry(.0012, 12), basic(mint)); d.position.set(0, by - .021 - i * .0062, R + .0003); brush.add(d); return d; });
  /* wordmark, running up the back of the handle */
  const word = new THREE.Mesh(new THREE.CylinderGeometry(R + .0003, R + .0003, .07, 12, 1, true, Math.PI - .31, .62), new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: .3, map: tex(88, 512, c => {
    c.translate(44, 256); c.rotate(-Math.PI / 2); c.fillStyle = '#7d8a85'; c.font = `700 60px ${DISPLAY}`; c.textAlign = 'center'; c.fillText('N I T I D A', 0, 21);
  }) }));
  word.position.y = .075; brush.add(word);
  /* collar, neck and head: the part that vibrates */
  const top = new THREE.Group(); top.position.y = bodyTop; brush.add(top);
  top.add(small(mesh(cylG(.0088, .0098, .005, 24), steel, 0, .0025, 0)));
  top.add(mesh(lathe([[.0078, .005], [.0062, .014], [.0048, .03], [.0044, .062]], 16), pearl));
  const headY = .062;
  top.add(mesh(rbox(.0165, .04, .0074, .0036), pearl, 0, headY + .016, 0));
  const tuftGeo = cylG(.0017, .0019, .0095, 6); tuftGeo.rotateX(Math.PI / 2);
  const cells = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) if (!((r === 0 || r === 7) && (c === 0 || c === 3))) cells.push([c, r]);
  const tufts = new THREE.InstancedMesh(tuftGeo, std(0xffffff, { roughness: .6 }), cells.length), m4 = new THREE.Matrix4(), col = new THREE.Color();
  cells.forEach(([c, r], i) => {
    const edge = c === 0 || c === 3 || r === 0 || r === 7, len = edge ? .88 : 1;
    m4.makeScale(1, 1, len); m4.setPosition((c - 1.5) * .0039, headY + .0015 + r * .0041, .0037 + .00475 * len);
    tufts.setMatrixAt(i, m4); tufts.setColorAt(i, col.setHex(edge ? 0xdff3ee : 0xffffff));
  });
  tufts.receiveShadow = true; top.add(tufts);
  /* light: a soft halo on the button and a pool under the puck */
  const halo = glow(mint, .05, .3); halo.position.set(0, .017 + by, R + .004);
  const pool = glow(mint, .16, .18); pool.position.set(0, .02, 0);
  g.userData.after = [halo, pool];
  let hum = 0;
  g.userData.tick = (dt, t, it) => {
    const on = !!it && (it.hov > .5 || it.kGoal === 1);
    hum = damp(hum, on ? 1 : 0, on ? 12 : 5, dt);
    const breath = reduce ? .7 : .5 + .5 * Math.sin(t * 1.6), lvl = lerp(.25 + .75 * breath, 1, hum);
    ring.material.color.setHex(mint).multiplyScalar(.2 + .8 * lvl);
    line.material.color.setHex(mint).multiplyScalar(.3 + .7 * (reduce ? .7 : .5 + .5 * Math.sin(t * 1.6 - 1.1)));
    const lead = Math.floor(t * 1.3) % 3;
    dots.forEach((d, i) => d.material.color.setHex(mint).multiplyScalar(on || reduce || i === lead ? 1 : .2));
    halo.material.opacity = .06 + .26 * lvl; pool.material.opacity = .08 + .14 * breath;
    const a = reduce ? 0 : hum;
    top.position.x = Math.sin(t * 173) * .0007 * a; top.rotation.y = Math.sin(t * 211) * .05 * a;
  };
  return g;
}

/* Not a project: the fuel */
function buildChai() {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0xdfeaf0, transparent: true, opacity: .22, roughness: .03, metalness: .1 });
  const gl = mesh(cylG(.037, .028, .092, 28, true), glass, 0, .046, 0); gl.material.side = THREE.DoubleSide; gl.castShadow = false; g.add(gl);
  g.add(mesh(cylG(.0345, .0268, .072, 28), std(0xb36a2e, { roughness: .35 }), 0, .038, 0));
  g.add(mesh(cylG(.029, .029, .005, 28), std(0xdfeaf0, { roughness: .1, transparent: true, opacity: .5 }), 0, .0025, 0));
  const steam = [];
  for (let i = 0; i < 5; i++) { const s = glow(0xffffff, .05, 0); s.material.blending = THREE.NormalBlending; s.userData.p = i / 5; steam.push(s); }
  g.userData.after = steam;
  g.userData.tick = dt => { for (const s of steam) {
    s.userData.p = (s.userData.p + dt * .22) % 1; const p = s.userData.p;
    s.position.set(Math.sin(p * 7 + s.id) * .012 * p, .085 + p * .16, 0); s.scale.setScalar(.03 + p * .07); s.material.opacity = Math.sin(p * Math.PI) * .2;
  } };
  return g;
}

/* ---------- fixed furniture: monitor, lamp, mouse ---------- */
/* terminal palette. t = accent, y = second accent (the keys are what SCRIPT below refers to) */
const TC = { bg: '#0d1017', bar: '#0a0c12', fg: '#dfe5f1', d: '#6f7a90', t: '#8b9bff', y: '#ff8a5c', ink: '#0a0b12' };
const TW = 1024, TH = 632, tcan = document.createElement('canvas'); tcan.width = TW; tcan.height = TH;
const tg = tcan.getContext('2d'), screenTex = new THREE.CanvasTexture(tcan); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = ANISO;
const MON = new V3(.04, 0, -.3), SCREEN_W = .68, SCREEN_H = .42, SCREEN_TILT = -.07;
let screenMesh, noteMesh;
const bias = [-.24, .24].map(dx => wallGlow(1.5, 1.05, MON.x + dx, .41));   // bias lighting behind the monitor: two glows, so it shows a slice of the LED gradient
if (tier === 'lite') { bias[0].position.x = MON.x; bias[1].visible = false; }
{
  const g = new THREE.Group(); g.position.copy(MON);
  const dark = std(0x0d0f15, { roughness: .4, metalness: .45 });
  g.add(mesh(plateGeo(.27, .17, .02, .012, .002), dark, 0, .002, 0));
  g.add(mesh(rbox(.046, .2, .02, .006), dark, 0, .11, -.035));
  const head = new THREE.Group(); head.position.set(0, .375, 0); head.rotation.x = SCREEN_TILT;
  head.add(mesh(rbox(.72, .46, .026, .012), dark));
  screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screenMesh.position.z = .0136; head.add(screenMesh);
  noteMesh = decal(.085, .085, tex(256, 256, (c, w, h) => {
    /* the price tag: a pale lilac sticky note */
    c.fillStyle = '#ddd7ff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(60,40,160,.13)'; c.fillRect(0, 0, w, 34);
    c.fillStyle = '#16182c'; c.textAlign = 'center'; c.font = `600 34px ${DISPLAY}`; c.fillText('from', w / 2, 92);
    c.fillStyle = '#3a2bbd'; c.font = `700 68px ${DISPLAY}`; c.fillText('₹1,500', w / 2, 160);
    c.fillStyle = '#16182c'; c.font = `600 28px ${DISPLAY}`; c.fillText('live in 5 days', w / 2, 212);
  }), { roughness: .9 });
  noteMesh.position.set(.322, -.196, .0142); noteMesh.rotation.z = -.07; noteMesh.castShadow = true; head.add(noteMesh);
  g.add(head); scene.add(g);
}
/* the lamp: gunmetal, warm inside. Click it to switch it. */
const lamp = { on: true, k: 0, heat: 0, t: 9, touched: false };
const BEAM_DIR = LAMP_AIM.clone().sub(LAMP_AT).sub(LAMP_HEAD).normalize();   // the way the lamp points
{
  const g = new THREE.Group(); g.position.copy(LAMP_AT);
  const gun = std(0x2c303b, { roughness: .34, metalness: .8 }), dark = std(0x12141a, { roughness: .45, metalness: .7 });
  g.add(mesh(cylG(.085, .095, .02, 40), gun, 0, .01, 0));
  lamp.ring = new THREE.Mesh(new THREE.TorusGeometry(.06, .0022, 5, 44), basic(0x8b9bff)); lamp.ring.rotation.x = Math.PI / 2; lamp.ring.position.y = .0203; g.add(lamp.ring);   // touch ring
  const A = new V3(0, .02, 0), B = new V3(.07, .43, -.02), C = LAMP_HEAD.clone();
  g.add(tube(A, B, .0085, dark), tube(B, C, .0085, dark), mesh(new THREE.SphereGeometry(.017, 16, 12), gun, B.x, B.y, B.z));
  const head = new THREE.Group(); head.position.copy(C);
  head.quaternion.setFromUnitVectors(new V3(0, -1, 0), BEAM_DIR);
  head.add(mesh(cylG(.03, .092, .125, 36, true), std(0x2c303b, { roughness: .34, metalness: .8, side: THREE.DoubleSide }), 0, -.03, 0));
  lamp.liner = new THREE.Mesh(cylG(.028, .0895, .122, 36, true), std(0xd8d2c6, { roughness: .8, side: THREE.BackSide, emissive: 0xffb45e, emissiveIntensity: 0 }));   // the inside of the shade lights up
  lamp.liner.position.y = -.03; head.add(lamp.liner);
  head.add(mesh(cylG(.03, .03, .03, 24), gun, 0, .045, 0));
  lamp.bulb = new THREE.Mesh(new THREE.SphereGeometry(.03, 16, 12), basic(0xfff1c9)); lamp.bulb.position.y = -.035; head.add(lamp.bulb);
  lamp.glow = glow(0xffd58a, .5, 0); lamp.glow.position.y = -.07; head.add(lamp.glow);
  lamp.hit = new THREE.Mesh(new THREE.BoxGeometry(.24, .26, .24)); lamp.hit.position.copy(C); g.add(lamp.hit);
  lamp.hit2 = new THREE.Mesh(new THREE.BoxGeometry(.2, .46, .2)); lamp.hit2.position.set(.03, .22, 0); g.add(lamp.hit2);
  g.add(head); scene.add(g);
  /* a faint beam you can see in the air: one soft wedge that swivels about the lamp's axis to face the camera */
  const geo = new THREE.PlaneGeometry(.8, .82); geo.translate(0, -.41, 0);
  lamp.beam = new THREE.Mesh(geo, lightMat({ color: 0xffc98a, opacity: 0, map: tex(128, 128, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const k = y / (h - 1), hw = lerp(9, 62, k), gr = c.createLinearGradient(w / 2 - hw, 0, w / 2 + hw, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(255,255,255,${Math.pow(1 - k, 1.6).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, y, w, 1);
    }
  }) }));
  lamp.beam.position.copy(LAMP_AT).add(LAMP_HEAD).addScaledVector(BEAM_DIR, .06); lamp.beam.visible = false; scene.add(lamp.beam);
}
{
  /* a wide desk mat under the keyboard and the mouse */
  const mat = mesh(plateGeo(.86, .3, .024, .003), std(0x050608, { roughness: .9 }), .19, 0, .27); mat.castShadow = false; scene.add(mat);
  const top = decal(.842, .282, tex(1024, 344, (c, w, h) => {
    c.fillStyle = '#0c0e14'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.055)'; for (let x = 30; x < w; x += 36) for (let y = 28; y < h; y += 36) c.fillRect(x, y, 2, 2);
    const gr = c.createLinearGradient(0, 0, w, 0); LED_STOPS.forEach((s, i) => gr.addColorStop(i / 2, s));
    c.globalAlpha = .5; c.strokeStyle = gr; c.lineWidth = 2; c.beginPath(); c.roundRect(12, 12, w - 24, h - 24, 18); c.stroke(); c.globalAlpha = 1;
    c.font = `600 21px ${MONO}`; c.fillStyle = 'rgba(182,191,208,.5)'; c.textAlign = 'right'; c.fillText('YATHARTH WEBS // DELHI', w - 36, h - 34);
    c.fillStyle = 'rgba(182,191,208,.28)'; c.textAlign = 'left'; c.fillText('28.61°N 77.21°E', 36, h - 34);
  }), { roughness: .84 });
  top.rotation.x = -Math.PI / 2; top.position.set(.19, .0036, .27); scene.add(top);
  const m = mesh(new THREE.SphereGeometry(1, 24, 16), std(0x1d2029, { roughness: .3, metalness: .3 }), .44, .0146, .27); m.scale.set(.03, .019, .05); m.rotation.y = -.15; scene.add(m);
  const wheel = new THREE.Mesh(new THREE.BoxGeometry(.0036, .003, .014), basic(0x8b9bff)); wheel.position.set(.443, .0322, .2502); wheel.rotation.y = -.15; scene.add(wheel);
}
/* dust drifting through the lamp light */
let dust = null;
if (tier !== 'lite' && !reduce) {
  const n = 70, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { p[i * 3] = .1 + rnd() * 1.1; p[i * 3 + 1] = .05 + rnd() * .65; p[i * 3 + 2] = -.4 + rnd() * .8; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, color: 0xdfe3f5, size: .012, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);
}

/* =====================================================================
   PLACING THINGS ON THE DESK
   ===================================================================== */
const BUILD = {
  bhatti: buildPizza, kaagaz: buildStationery, manzil: buildMap, tigerking: buildFrame, aurenframe: buildGlasses,
  echo: buildEchoRing, detent: buildKeyboard, ideserve: buildTub, pagani: buildCar, techfinds: buildPhone,
  ginniplus: buildHandle, trishla: buildRingBox, vedicratna: buildGem, isha: buildSwatches, nitida: buildBrush
};
/* x: left/right, z: back/front, yaw: turn on the desk, tilt: how far it leans towards you when picked up */
const SPOTS = {
  bhatti:     { x: -1.13, z: -.25, yaw: .2, tilt: .5 },
  tigerking:  { x: -.66, z: -.5, yaw: .1, tilt: -.3 },
  nitida:     { x: -.44, z: -.38, yaw: .3, tilt: -.3 },
  ideserve:   { x: .62, z: -.37, yaw: -.25, tilt: -.2 },
  manzil:     { x: -.78, z: 0, yaw: -.18, tilt: .75 },
  aurenframe: { x: -.4, z: .03, yaw: .32, tilt: -.2 },
  pagani:     { x: .66, z: -.06, yaw: .5, tilt: .1 },
  ginniplus:  { x: 1.0, z: -.2, yaw: -.3, tilt: -.25 },
  vedicratna: { x: 1.24, z: .07, yaw: .3, tilt: 0 },
  kaagaz:     { x: -1.1, z: .3, yaw: -.3, tilt: .45 },
  echo:       { x: -.66, z: .37, yaw: 0, tilt: 0 },
  detent:     { x: .03, z: .25, yaw: -.02, tilt: .55 },
  techfinds:  { x: .74, z: .34, yaw: -.3, tilt: -.25 },
  trishla:    { x: .97, z: .36, yaw: -.4, tilt: .05 },
  isha:       { x: 1.2, z: .4, yaw: .9, tilt: .8 }
};
const TOUR = ['ideserve', 'ginniplus', 'trishla', 'isha', 'detent', 'pagani', 'nitida', 'terminal', 'echo', 'tigerking', 'bhatti', 'kaagaz', 'manzil', 'aurenframe', 'vedicratna', 'techfinds'];

const HIT_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const items = [], hits = [], byId = {};
function place(model, spot, meta) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new V3()), s = box.getSize(new V3());
  const holder = new THREE.Group(), spin = new THREE.Group(), yaw = spot.yaw || 0;
  const rest = new V3(spot.x, 0, spot.z).add(c.clone().applyAxisAngle(UP, yaw));
  model.position.copy(c).negate(); spin.add(model); holder.add(spin); scene.add(holder);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(s.x + .03, s.y + .03, s.z + .03), HIT_MAT); spin.add(hit); hits.push(hit);
  (model.userData.after || []).forEach(o => model.add(o));
  const it = { ...meta, holder, spin, model, rest, show: rest.clone(), showD: 1, yaw0: yaw, yaw, yawVel: 0, pitch: 0, tilt: spot.tilt || 0, radius: s.length() / 2,
    k: 0, kGoal: 0, hov: 0, hop: 0, born: .35 + items.length * .075, tick: model.userData.tick };
  hit.userData.item = it; items.push(it); if (meta.id) byId[meta.id] = it;
  return it;
}
for (const id of Object.keys(SPOTS)) {
  const p = LIST.find(x => x.id === id); if (!p || !BUILD[id]) continue;
  place(BUILD[id](), SPOTS[id], { type: 'project', id, p });
}
place(buildChai(), { x: -.3, z: .33, tilt: -.1 }, { type: 'chai', id: 'chai' });

const monitor = { type: 'monitor', id: 'terminal', p: LIST.find(x => x.id === 'terminal') };
screenMesh.userData.item = monitor; hits.push(screenMesh); byId.terminal = monitor;
const lampItem = { type: 'lamp' }; for (const h of [lamp.hit, lamp.hit2]) { h.material = HIT_MAT; h.userData.item = lampItem; hits.push(h); }
noteMesh.userData.item = { type: 'note' }; hits.push(noteMesh);
const tour = TOUR.map(id => byId[id]).filter(it => it && it.p);

/* =====================================================================
   THE TERMINAL ON THE MONITOR (a looping demo; click the screen for the real one)
   ===================================================================== */
const term = { lines: [], typed: '', i: 0, wait: 1.2, ch: 0, blink: 0, cursor: true, dirty: true, hint: 0 };
const SCRIPT = [
  { type: 'help' },
  { out: [[['the real stuff', 'y']], [['  about  projects  pricing  skills']], [['games', 'y']], [['  snake  run  guess  roulette']]], wait: 2.2 },
  { type: 'sudo hire yatharth' },
  { out: [[['[sudo] password for visitor: ********', 'd']]], wait: .8 },
  { out: [[['Access granted.', 't'], [' Hiring process started...']]], wait: .6 },
  { out: [[['Message him: '], ['WhatsApp', 't'], [' or '], ['email', 't']]], wait: 2.8 },
  { type: 'uptime' },
  { out: [[['up 5 days, 0 shops without a website', 'd']]], wait: 2.6 },
  { type: 'clear' }, { clear: true, wait: .5 }
];
const PROMPT = [['visitor@webs:', 't'], ['~$ ', 't']];
const termPush = segs => { term.lines.push(segs); if (term.lines.length > 9) term.lines.shift(); term.dirty = true; };
termPush([['Yatharth Webs', 'y'], [' terminal. Type '], ['help', 't'], ['.']]);
function termTick(dt) {
  if (reduce) return;   // reduced motion: a still screen with a solid cursor
  term.blink += dt; if (term.blink > .5) { term.blink = 0; term.cursor = !term.cursor; term.dirty = true; }
  term.wait -= dt; if (term.wait > 0) return;
  const s = SCRIPT[term.i % SCRIPT.length];
  if (s.type) {
    if (term.ch < s.type.length) { term.typed += s.type[term.ch++]; term.wait = .06 + rnd() * .09; kb.press(); }
    else { termPush([...PROMPT, [term.typed]]); term.typed = ''; term.ch = 0; term.i++; term.wait = .3; }
  } else { if (s.clear) term.lines.length = 0; (s.out || []).forEach(termPush); term.i++; term.wait = s.wait || .5; }
  term.dirty = true;
}
const termRule = tg.createLinearGradient(0, 0, TW, 0); LED_STOPS.forEach((c, i) => termRule.addColorStop(i / 2, c));
function termDraw() {
  const g = tg; term.dirty = false;
  g.fillStyle = TC.bg; g.fillRect(0, 0, TW, TH); g.fillStyle = TC.bar; g.fillRect(0, 0, TW, 58);
  g.globalAlpha = .7; g.fillStyle = termRule; g.fillRect(0, 58, TW, 2);   // a hairline of the accent gradient under the title bar
  g.globalAlpha = .55; g.fillStyle = TC.d; for (const x of [34, 62, 90]) { g.beginPath(); g.arc(x, 29, 9, 0, TAU); g.fill(); } g.globalAlpha = 1;
  g.font = `22px ${MONO}`; g.textAlign = 'left'; g.fillText('yatharth@webs: ~', 122, 37);
  g.font = `33px ${MONO}`;
  const line = (segs, y) => { let x = 34; for (const [t, c] of segs) { g.fillStyle = TC[c] || TC.fg; g.fillText(t, x, y); x += g.measureText(t).width; } return x; };
  term.lines.forEach((l, i) => line(l, 112 + i * 50));
  const x = line([...PROMPT, [term.typed]], 112 + term.lines.length * 50);
  if (term.cursor) { g.fillStyle = TC.y; g.fillRect(x + 2, 112 + term.lines.length * 50 - 29, 18, 36); }
  if (term.hint > .02) {
    g.globalAlpha = term.hint; const t = coarse ? 'Tap: this terminal is real' : 'Click: this terminal is real', w = 420;
    g.fillStyle = TC.t; g.beginPath(); g.roundRect(TW - w - 30, TH - 78, w, 50, 25); g.fill();
    g.fillStyle = TC.ink; g.font = `700 24px ${MONO}`; g.textAlign = 'center'; g.fillText(t, TW - w / 2 - 30, TH - 45); g.globalAlpha = 1;
  }
  screenTex.needsUpdate = true;
}

/* =====================================================================
   TIME OF DAY (Delhi)
   ===================================================================== */
/* Every hour reads dark and techy: day is a brighter, cooler window light with the lamp off; night is a dark room, the lamp's warm pool and the LEDs. */
const sky = { day: 0, gold: 0 }, cNight = new THREE.Color(0x8f9cff), cDay = new THREE.Color(0xdde7ff), cGold = new THREE.Color(0xffa066), cTmp = new THREE.Color();
const cHemiDay = new THREE.Color(0xcfd8f0), cGroundDay = new THREE.Color(0x2b2e39);
function delhiNow() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const h = +parts.find(x => x.type === 'hour').value, m = +parts.find(x => x.type === 'minute').value;
  return { h: h % 24, m };
}
function applyTime() {
  const now = delhiNow(), forced = parseFloat(qs.get('t')), t = Number.isFinite(forced) ? forced : now.h + now.m / 60;
  sky.day = sstep(5.6, 7.6, t) * (1 - sstep(17.4, 19.4, t));
  sky.gold = Math.max(Math.exp(-(((t - 6.7) / 1.0) ** 2)), Math.exp(-(((t - 18.3) / 1.0) ** 2)));
  cTmp.copy(cNight).lerp(cDay, sky.day).lerp(cGold, sky.gold * .65);
  sun.color.copy(cTmp); sun.intensity = lerp(.28, 1.9, sky.day);
  hemi.color.set(0x565f7c).lerp(cHemiDay, sky.day).lerp(cGold, sky.gold * .2);
  hemi.groundColor.set(0x101116).lerp(cGroundDay, sky.day);
  hemi.intensity = lerp(.45, .9, sky.day);
  scene.environmentIntensity = lerp(.24, .6, sky.day);
  panes.material.color.copy(cTmp); panes.material.opacity = lerp(.1, .3, sky.day) + sky.gold * .12;
  renderer.toneMappingExposure = lerp(1.2, 1.02, sky.day);
  if (!lamp.touched) lamp.on = sky.day < .6;
  if (ui.clock) {
    const hh = Number.isFinite(forced) ? Math.floor(forced) % 24 : now.h, mm = Number.isFinite(forced) ? Math.round((forced % 1) * 60) : now.m;
    ui.clock.textContent = `Live from the desk · ${(hh % 12) || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'} in Delhi`;
  }
}
applyTime(); setInterval(applyTime, 30000);

/* =====================================================================
   CAMERA
   The scene is framed inside a "rect": the part of the hero that is free
   of text or cards. The lens is shifted so that rect is the centre of view.
   ===================================================================== */
const HOME_DIR = new V3(0, Math.sin(.46), Math.cos(.46));
const CONTENT_W = DESK_W + .16, CONTENT_H = 1.26;
const rig = { pos: new V3(), tgt: new V3(), cx: .5, cy: .5, hf: 1 }, goal = { pos: new V3(), tgt: new V3(), cx: .5, cy: .5, hf: 1 };
const home = { d: 2.6, panMax: 0, perPx: .002 }, cardBox = { w: 0, h: 0 };
const state = { mode: 'home', item: null, embed: false };
const tmp = new V3(), fwd = new V3();
let W = 1, H = 1, pan = 0, panVel = 0, focusK = 0, scrimD = 1.3;
const stacked = () => W < 820;
const setRect = (x, y, w, h) => { goal.cx = (x + w / 2) / W; goal.cy = (y + h / 2) / H; goal.hf = clamp(h / H, .2, 1); return w / h; };

function frame() {
  /* home framing is always computed: the pick-up point hangs off it */
  const copyEnd = ui.copy.offsetTop + ui.copy.offsetHeight;
  const hr = { x: 0, y: copyEnd + 4, w: W, h: Math.max(200, H - copyEnd - 10) };   // the desk gets everything below the headline
  const ha = hr.w / hr.h, dV = (CONTENT_H / 2) / T15, dH = (CONTENT_W / 2) / (T15 * ha);
  home.d = Math.max(dV, Math.min(dH, dV * 1.32));
  home.panMax = Math.max(0, CONTENT_W / 2 - home.d * T15 * ha);
  home.perPx = 2 * home.d * T15 / hr.h;
  pan = clamp(pan, -home.panMax, home.panMax);
  const hT = new V3(pan, .17, -.03);
  if (state.mode !== 'terminal') {
    /* picking something up only nudges the camera in: the object comes to you (see showAt) */
    setRect(hr.x, hr.y, hr.w, hr.h); goal.tgt.copy(hT); goal.pos.copy(hT).addScaledVector(HOME_DIR, home.d * (state.mode === 'focus' ? .94 : 1));
    return;
  }
  const a = state.embed ? setRect(0, 50, W, H - 70) : stacked() ? setRect(0, 0, W, Math.max(160, H - cardBox.h - 26)) : setRect(0, 0, freeW(), H);
  const n = new V3(0, Math.sin(-SCREEN_TILT), Math.cos(-SCREEN_TILT)), fill = state.embed ? .9 : .8;
  const d = Math.max((SCREEN_H / 2) / (T15 * fill), (SCREEN_W / 2) / (T15 * a * fill));
  screenMesh.getWorldPosition(goal.tgt); goal.pos.copy(goal.tgt).addScaledVector(n, d);
}
const freeW = () => Math.max(260, W - cardBox.w - Math.max(40, (W - 1120) / 2 + 20));   // width left of the card
/* where a picked-up object floats: centred in the space the card leaves free, sized to fit it */
function showAt(it) {
  const fw = stacked() ? W : freeW(), fh = stacked() ? Math.max(140, H - cardBox.h - 30) : H;
  it.showD = Math.max(.34, it.radius * H * rig.hf / (2 * T15 * .38 * Math.min(fw, fh)));
  tmp.set(fw / W - 1, 1 - fh / H, .5).unproject(camera).sub(camera.position).normalize();
  it.show.copy(camera.position).addScaledVector(tmp, it.showD);
}
function resize() {
  const r = hero.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
  renderer.setSize(W, H, false); if (!ui.card.hidden) { cardBox.w = ui.card.offsetWidth; cardBox.h = ui.card.offsetHeight; } frame();
}
new ResizeObserver(resize).observe(hero); new ResizeObserver(() => frame()).observe(ui.copy);
resize();
rig.pos.copy(goal.pos); rig.tgt.copy(goal.tgt); rig.cx = goal.cx; rig.cy = goal.cy; rig.hf = goal.hf;
if (!reduce) { rig.pos.addScaledVector(HOME_DIR, 1.1); rig.pos.y += .35; }

/* =====================================================================
   UI: tooltip, card, terminal overlay, tour
   ===================================================================== */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const card = {
  cat: $('.dc-cat', ui.card), n: $('.dc-n', ui.card), name: $('.dc-name', ui.card), kind: $('.dc-kind', ui.card),
  desc: $('.dc-desc', ui.card), go: $('.dc-go', ui.card), alt: $('.dc-alt', ui.card), hint: $('.dc-hint', ui.card)
};
function showCard(it) {
  const p = it.p, i = tour.indexOf(it);
  if (it.type === 'chai') {
    card.cat.textContent = 'Not a project'; card.n.textContent = ''; card.name.textContent = 'Chai, mostly';
    card.kind.textContent = 'What this desk runs on';
    card.desc.textContent = "Tell me about your shop over one. I'll reply on WhatsApp with a free mockup idea, no commitment.";
    card.go.textContent = 'Get a free mockup'; card.go.href = '#enquire'; card.go.removeAttribute('target');
  } else {
    card.cat.textContent = CAT[p.cat] || ''; card.n.textContent = i >= 0 ? `${i + 1} / ${tour.length}` : '';
    card.name.textContent = p.name; card.kind.textContent = p.kind; card.desc.textContent = p.desc;
    card.go.innerHTML = (it.type === 'monitor' ? 'Open the terminal' : 'Visit live site') + ' <span aria-hidden="true">↗</span>';
    card.go.href = it.type === 'monitor' ? 'terminal.html' : p.url; card.go.target = '_blank';
  }
  card.alt.hidden = !(it.type === 'monitor' && !stacked());
  card.hint.textContent = it.type === 'monitor' ? 'Snake, a commit roulette, and a few secrets.' : coarse ? 'Swipe the object to turn it.' : 'Drag the object to turn it.';
  ui.card.hidden = false; cardBox.w = ui.card.offsetWidth; cardBox.h = ui.card.offsetHeight; requestAnimationFrame(() => ui.card.classList.add('in'));
}
function hideCard() { ui.card.classList.remove('in'); ui.card.hidden = true; cardBox.w = cardBox.h = 0; }
function hideTerm() { ui.term.classList.remove('in', 'ready'); state.embed = false; }
function setMode(mode, item) {
  state.mode = mode; state.item = item || null; hero.dataset.mode = mode;
  document.body.classList.toggle('desk-open', mode !== 'home');
  for (const it of items) { it.kGoal = it === item && mode === 'focus' ? 1 : 0; if (it.kGoal) { it.pitch = 0; it.yawVel = 0; } }
  setHover(null);
}
function goHome() {
  const back = ui.card.contains(document.activeElement) || ui.term.contains(document.activeElement);   // keyboard users: hand focus back to the tour bar instead of losing it
  hideCard(); hideTerm(); setMode('home'); frame();
  if (back && ui.bar) { const b = $('[data-desk="next"]', ui.bar); if (b) b.focus({ preventScroll: true }); }
}
function focusItem(it) { hideTerm(); setMode('focus', it); showCard(it); frame(); }
function openMonitor(embed) {
  setMode('terminal', monitor);
  if (embed) {
    hideCard(); state.embed = true;
    if (!ui.term.querySelector('iframe')) { const f = document.createElement('iframe'); f.src = 'terminal.html'; f.title = 'Yatharth Webs terminal'; ui.term.appendChild(f); }
    ui.term.classList.add('in');
  } else { hideTerm(); showCard(monitor); }
  frame();
}
function open(it) {
  if (!it) return goHome();
  if (it.type === 'lamp') { lamp.touched = true; lamp.on = !lamp.on; lamp.t = 0; if (!reduce) led.ripple = 0; hovered = null; return; }   // the tube strikes, and a ripple runs along the wall
  if (it.type === 'note') { goHome(); const t = $('#pricing'); if (t) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); return; }
  if (it.type === 'monitor') return openMonitor(!stacked());
  focusItem(it);
}
function step(dir) {
  if (!tour.length) return;
  const i = tour.indexOf(state.item), n = tour.length, it = tour[i < 0 ? (dir > 0 ? 0 : n - 1) : (i + dir + n) % n];
  it.type === 'monitor' ? openMonitor(false) : focusItem(it);
}
hero.addEventListener('click', e => {
  const b = e.target.closest('[data-desk]'); if (!b) return;
  const a = b.dataset.desk;
  if (a === 'next') step(1); else if (a === 'prev') step(-1); else if (a === 'close') goHome(); else if (a === 'embed') openMonitor(true);
  /* the tour bar hides once a card is open: move keyboard focus onto the card's own arrow */
  if ((a === 'next' || a === 'prev') && b.closest('#deskBar')) { const t = $('.dc-nav [data-desk="' + a + '"]', ui.card); if (t) t.focus({ preventScroll: true }); }
});
card.go.addEventListener('click', () => { if (card.go.getAttribute('href') === '#enquire') goHome(); });
addEventListener('keydown', e => {
  if (state.mode === 'home') return;
  if (e.key === 'Escape') goHome(); else if (state.embed) return;   // arrows belong to the terminal while it is open
  else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1);
});
addEventListener('message', e => { if (e.origin === location.origin && e.data === 'yw-term-exit') goHome(); });
if (ui.hint) ui.hint.textContent = coarse ? 'Tap anything on the desk' : 'Click anything on the desk';

/* ---------- pointer ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), par = { x: 0, y: 0, tx: 0, ty: 0 };
let hovered = null, ptr = null, hoverXY = null, lastTouch = -9, idleK = 0;   // lastTouch: when the pointer last did anything over the desk (on the loop's clock)
function pick(x, y) {
  const r = canvas.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(hits, false)[0], it = h ? h.object.userData.item : null;
  if (state.mode === 'focus') return it === state.item ? it : null;
  if (state.mode === 'terminal') return it === monitor ? it : null;
  return it;
}
function setHover(it, x, y) {
  if (it !== hovered) {
    hovered = it;
    const label = !it || state.mode !== 'home' ? '' : it.type === 'lamp' ? `Lamp: turn it ${lamp.on ? 'off' : 'on'}` : it.type === 'note' ? 'See pricing'
      : it.type === 'chai' ? 'Chai break?' : it.type === 'monitor' ? '' : it.p.name;
    ui.tip.hidden = !label;
    if (label) ui.tip.innerHTML = `<b>${esc(label)}</b>${it.p && it.type === 'project' ? `<span>${esc(CAT[it.p.cat] || '')}</span>` : ''}`;
    canvas.style.cursor = it && state.mode !== 'focus' ? 'pointer' : state.mode === 'focus' || (state.mode === 'home' && home.panMax > 0) ? 'grab' : '';
  }
  if (it && x !== undefined) { const r = hero.getBoundingClientRect(); ui.tip.style.transform = `translate(${Math.round(x - r.left)}px,${Math.round(y - r.top)}px) translate(-50%,-150%)`; }
}
canvas.addEventListener('pointerdown', e => {
  if (e.button) return;
  ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false }; panVel = 0; lastTouch = clock;
});
addEventListener('pointermove', e => {
  if (ptr || hero.contains(e.target)) lastTouch = clock;
  if (e.pointerType !== 'touch') { const r = hero.getBoundingClientRect(); par.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); par.ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1); }
  if (ptr && e.pointerId === ptr.id) {
    const dx = e.clientX - ptr.lx, dy = e.clientY - ptr.ly; ptr.lx = e.clientX; ptr.ly = e.clientY;
    if (!ptr.moved && Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y) > 7) { ptr.moved = true; setHover(null); }
    if (ptr.moved) {
      if (state.mode === 'home') { pan = clamp(pan - dx * home.perPx, -home.panMax, home.panMax); panVel = -dx * home.perPx * 60; }
      else if (state.mode === 'focus' && state.item) { const it = state.item; it.yaw += dx * .011; it.yawVel = dx * .011 * 60; it.pitch = clamp(it.pitch + dy * .007, -.8, .8); }
    }
  } else if (e.target === canvas && e.pointerType !== 'touch') hoverXY = [e.clientX, e.clientY];
  else if (hovered) { hoverXY = null; setHover(null); }
}, { passive: true });
addEventListener('pointerup', e => {
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = ptr; ptr = null;
  if (!p.moved) open(pick(e.clientX, e.clientY));
});
addEventListener('pointercancel', () => { ptr = null; });
canvas.addEventListener('pointerleave', () => { hoverXY = null; setHover(null); });

/* =====================================================================
   THE LOOP
   ===================================================================== */
let clock = 0, last = 0, running = false, visible = true, raf = 0, nextHop = 5, fAcc = 0, fN = 0, drops = 0;
const beamY = BEAM_DIR.clone().negate(), beamX = new V3(), beamZ = new V3(), beamM = new THREE.Matrix4();
function tick(now) {
  raf = 0; if (!running) return;
  const raw = clamp((now - last) / 1000 || 0, 0, .25); last = now;   // never negative: a frame timestamp can sit just before the moment the loop was (re)started
  const dt = Math.min(.05, raw); clock += dt;
  const fast = reduce ? 1 : 0;

  /* adapt to slow devices: lower the resolution first, then drop shadows */
  if (clock > 3 && raw < .2) { fAcc += raw; if (++fN >= 90) {
    if (fAcc / fN > .034 && drops < 4) { drops++;
      if (dpr > 1) { dpr = Math.max(1, dpr - .5); renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); }
      else { sun.castShadow = lampLight.castShadow = false; }
    } fAcc = 0; fN = 0; } }

  /* hover */
  if (hoverXY && !ptr) setHover(pick(hoverXY[0], hoverXY[1]), hoverXY[0], hoverXY[1]);
  term.hint = damp(term.hint, hovered === monitor && state.mode === 'home' ? 1 : 0, 10, dt);
  if (term.hint > .02 && term.hint < .98) term.dirty = true;
  const lit = hovered && hovered.rest && state.mode === 'home' ? 1 : 0;   // only things standing on the desk get the pool of light
  if (lit) { hoverGlow.position.x = hovered.rest.x; hoverGlow.position.z = hovered.rest.z; hoverGlow.scale.setScalar(Math.max(.28, hovered.radius * 3)); }
  hoverGlow.material.opacity = damp(hoverGlow.material.opacity, lit * .5, 10, dt); hoverGlow.visible = hoverGlow.material.opacity > .01;

  /* pan inertia */
  if (state.mode === 'home') { if (!ptr && Math.abs(panVel) > .001) { pan = clamp(pan + panVel * dt, -home.panMax, home.panMax); panVel *= Math.exp(-5 * dt); } frame(); }

  /* camera */
  const f = fast || 1 - Math.exp(-4.4 * dt);
  rig.pos.lerp(goal.pos, f); rig.tgt.lerp(goal.tgt, f); rig.cx += (goal.cx - rig.cx) * f; rig.cy += (goal.cy - rig.cy) * f; rig.hf += (goal.hf - rig.hf) * f;
  par.x = damp(par.x, par.tx, 3, dt); par.y = damp(par.y, par.ty, 3, dt);
  const amp = reduce || coarse ? 0 : state.mode === 'home' ? 1 : state.mode === 'focus' ? .35 : 0;
  camera.position.copy(rig.pos); camera.position.x += par.x * .15 * amp; camera.position.y -= par.y * .06 * amp;
  /* nobody touching it: the camera drifts and breathes, slowly, so the desk never sits dead still */
  const still = !reduce && !ptr && !hovered && state.mode !== 'terminal' && clock - lastTouch > 2.4;
  idleK = damp(idleK, still ? (state.mode === 'focus' ? .45 : 1) : 0, still ? .7 : 4, dt);
  if (idleK > .001) {
    camera.position.x += Math.sin(clock * .21) * .06 * idleK; camera.position.y += Math.sin(clock * .29 + 1.3) * .02 * idleK;
    camera.position.addScaledVector(HOME_DIR, Math.sin(clock * .16 + .6) * .045 * idleK);
  }
  camera.lookAt(rig.tgt);
  camera.aspect = W / H; camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(T15 / rig.hf));
  camera.setViewOffset(W, H, (.5 - rig.cx) * W, (.5 - rig.cy) * H, W, H);
  camera.updateMatrixWorld();

  /* lamp + focus light. Switched on, the lamp stutters like a tube striking; switched off, the bulb keeps a dull ember for a moment */
  lamp.t += dt;
  lamp.k = damp(lamp.k, lamp.on ? 1 : 0, 9, dt);
  lamp.heat = damp(lamp.heat, lamp.on ? 1 : 0, lamp.on ? 9 : 1.3, dt);
  const flick = reduce ? 1 : clock < 1.4 ? (Math.sin(clock * 47) > -.3 ? 1 : .25) : lamp.on && lamp.t < .46 ? (Math.sin(lamp.t * 58) > .15 ? 1 : .16) : 1;
  const lk = lamp.k * flick, ember = Math.max(0, lamp.heat - lamp.k), night = 1 - sky.day * .7;
  lampLight.intensity = 11 * lk; lamp.glow.material.opacity = .55 * lk;
  lampLight.shadow.autoUpdate = lk > .003;   // lamp off: do not re-render its shadow map every frame
  lamp.bulb.material.color.setRGB(.2 + .8 * lk + .5 * ember, .18 + .76 * lk + .13 * ember, .17 + .62 * lk);
  lamp.liner.material.emissiveIntensity = .85 * lk + .1 * ember;
  lamp.ring.material.color.setHex(0x8b9bff).multiplyScalar(lamp.on ? .5 : reduce ? 1 : .6 + .4 * Math.sin(clock * 2.4));   // off: the touch ring pulses, "tap me"
  lamp.beam.visible = lk * night > .02;
  if (lamp.beam.visible) {
    lamp.beam.material.opacity = .13 * lk * night;
    beamX.subVectors(camera.position, lamp.beam.position); beamX.crossVectors(beamY, beamX).normalize(); beamZ.crossVectors(beamX, beamY);
    lamp.beam.quaternion.setFromRotationMatrix(beamM.makeBasis(beamX, beamY, beamZ));
  }
  if (dust) { dust.material.opacity = (.42 * lk + .1) * night; dust.rotation.y = Math.sin(clock * .07) * .12; dust.position.y = Math.sin(clock * .23) * .03; }
  ledTick(dt, clock);
  for (let i = 0; i < 2; i++) { ledAt(ledU(bias[i].position.x), bias[i].material.color); bias[i].material.opacity = (.2 + (reduce ? 0 : .03 * Math.sin(clock * 9 + i))) * lerp(1, .6, sky.day); }   // flickers a touch, with the screen
  focusK = damp(focusK, state.mode === 'focus' ? 1 : 0, 6, dt);
  showLight.intensity = 3.4 * focusK; showLight.position.copy(camera.position).add(tmp.set(-.3, .45, .05));
  if (state.mode === 'focus' && state.item) { showAt(state.item); scrimD = state.item.showD + state.item.radius + .1; }
  scrim.visible = focusK > .01;
  if (scrim.visible) { camera.getWorldDirection(fwd); scrim.position.copy(camera.position).addScaledVector(fwd, scrimD); scrim.quaternion.copy(camera.quaternion); scrim.material.opacity = .84 * focusK; }
  screenLight.intensity = .55 + Math.sin(clock * 9) * .02;

  /* idle: now and then an object hops, to show it can be picked up */
  if (state.mode === 'home' && !reduce && clock > nextHop) { nextHop = clock + 2.6 + rnd() * 2.6; const it = items[(rnd() * items.length) | 0]; if (it !== hovered) it.hop = 1; }

  /* objects */
  for (const it of items) {
    it.k = fast ? it.kGoal : damp(it.k, it.kGoal, 6, dt); if (Math.abs(it.k - it.kGoal) < .0006) it.k = it.kGoal;
    it.hov = damp(it.hov, it === hovered && state.mode === 'home' ? 1 : 0, 12, dt);
    it.hop = Math.max(0, it.hop - dt * 2.2);
    const e = it.k * it.k * (3 - 2 * it.k), born = reduce ? 1 : clamp((clock - it.born) / .55, 0, 1);
    it.holder.position.lerpVectors(it.rest, it.show, e);
    it.holder.position.y += Math.sin(e * Math.PI) * .07 + it.hov * .016 + Math.sin((1 - it.hop) * Math.PI) * .03 * (it.hop > 0) + (1 - born) * .3;
    it.holder.scale.setScalar(Math.max(.001, backOut(born)) * (1 + it.hov * .05));
    if (it.kGoal === 1) {
      if (!(ptr && ptr.moved)) { it.yaw += (reduce ? 0 : .42) * dt + it.yawVel * dt; it.yawVel *= Math.exp(-3.5 * dt); }
    } else { const near = it.yaw0 + Math.round((it.yaw - it.yaw0) / TAU) * TAU; it.yaw = fast ? near : damp(it.yaw, near, 6, dt); }
    it.spin.rotation.set((it.tilt + it.pitch) * e, it.yaw, 0);
    if (it.tick) it.tick(reduce ? 0 : dt, reduce ? 0 : clock, it);   // reduced motion: every object holds one still pose
  }

  /* monitor */
  termTick(dt); if (term.dirty) termDraw();
  if (state.embed) placeTerm();

  renderer.render(scene, camera);
  if (hero.dataset.state !== 'live') hero.dataset.state = 'live';
  raf = requestAnimationFrame(tick);
}
/* keep the real terminal glued to the 3D screen */
const corner = new V3();
function placeTerm() {
  const px = (lx, ly) => { corner.set(lx, ly, 0); screenMesh.localToWorld(corner).project(camera); return [(corner.x * .5 + .5) * W, (-corner.y * .5 + .5) * H]; };
  const a = px(-SCREEN_W / 2, SCREEN_H / 2), b = px(SCREEN_W / 2, -SCREEN_H / 2);
  const s = ui.term.style; s.left = a[0] + 'px'; s.top = a[1] + 'px'; s.width = Math.max(40, b[0] - a[0]) + 'px'; s.height = Math.max(40, b[1] - a[1]) + 'px';
  const settled = rig.pos.distanceTo(goal.pos) < .04;
  const was = ui.term.classList.contains('ready');
  ui.term.classList.toggle('ready', settled);
  if (settled && !was) {   // the screen has arrived: put the keyboard in the terminal
    const f = ui.term.querySelector('iframe');
    if (f) { f.focus({ preventScroll: true }); if (!coarse) try { const i = f.contentDocument && f.contentDocument.querySelector('input'); if (i) i.focus({ preventScroll: true }); } catch (_) {} }
  }
}
function setRunning() {
  const want = visible && !document.hidden;
  if (want && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
  else if (!want) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
}
new IntersectionObserver(es => {
  visible = es[0].isIntersecting; if (!visible && state.mode !== 'home') goHome(); setRunning();
}, { threshold: .02 }).observe(hero);
document.addEventListener('visibilitychange', setRunning);
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; hero.dataset.state = 'static'; });
setRunning();

/* small public handle, e.g. YWDesk.open('detent') from a link elsewhere on the page */
window.YWDesk = { open: id => byId[id] && open(byId[id]), home: goHome, next: () => step(1), prev: () => step(-1),
  info: () => ({ tier, dpr, mode: state.mode, lamp: lamp.on, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }) };
}
