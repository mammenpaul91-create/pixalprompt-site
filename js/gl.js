/* ============================================================
   PIXAL PROMPT — LATENT WebGL layer v1
   One Three.js renderer on the shared gsap.ticker. Every
   [data-plane] <img class="plane"> is promoted to a DOM-synced
   plane with a noise-dissolve reveal (uT scrubbed by viewport
   position) + hover displacement/RGB split. If WebGL or the
   module fails, the real <img> simply stays — full fallback.
   ============================================================ */

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uT;      // 0 noise -> 1 resolved
  uniform float uTime;
  uniform float uHover;
  uniform float uSeed;
  uniform vec2 uPlane;   // plane px
  uniform vec2 uImg;     // texture px

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1 + uSeed, 311.7))) * 43758.5453123);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.1; a *= 0.5; }
    return v;
  }

  void main() {
    // cover-fit uv
    vec2 s = uPlane / uImg;
    float sc = max(s.x, s.y);
    vec2 fit = uImg * sc / uPlane;
    vec2 uv = (vUv - 0.5) / fit + 0.5;

    // hover: liquid wobble
    float w = uHover * 0.018;
    uv += vec2(
      fbm(vUv * 3.0 + uTime * 0.4) - 0.5,
      fbm(vUv * 3.0 - uTime * 0.35 + 7.0) - 0.5
    ) * w;

    // dissolve field
    float n = fbm(vUv * 5.0 + uSeed * 13.0);
    float t = uT * 1.15;
    float resolved = step(n, t);
    float edge = smoothstep(t - 0.06, t, n) * resolved;

    // rgb split scales with hover
    float sp = uHover * 0.006;
    vec3 col;
    col.r = texture2D(uMap, uv + vec2(sp, 0.0)).r;
    col.g = texture2D(uMap, uv).g;
    col.b = texture2D(uMap, uv - vec2(sp, 0.0)).b;

    // grayscale until nearly resolved; hover restores color too
    float g = dot(col, vec3(0.299, 0.587, 0.114));
    float colorAmt = clamp(smoothstep(0.72, 1.0, uT) + uHover * 0.6, 0.0, 1.0);
    col = mix(vec3(g), col, colorAmt);

    // unresolved pixels: live static
    float st = hash(vUv * 900.0 + fract(uTime) * 37.0);
    vec3 staticCol = vec3(st * 0.14 + 0.02);

    vec3 outCol = mix(staticCol, col, resolved);
    // acid rim where the image is currently resolving
    outCol = mix(outCol, vec3(0.83, 1.0, 0.0), edge * 0.55);

    gl_FragColor = vec4(outCol, 1.0);
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

window.PPGL = { sync: null };

(async () => {
  if (REDUCED || typeof gsap === "undefined") return;
  let THREE;
  try {
    THREE = await import(THREE_URL);
  } catch { return; }

  let renderer;
  try {
    const canvas = document.createElement("canvas");
    canvas.className = "gl";
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  } catch { return; }

  document.body.appendChild(renderer.domElement);
  document.body.classList.add("gl-on");
  const DPR = Math.min(window.devicePixelRatio || 1, window.innerWidth < 821 ? 1.5 : 2);
  renderer.setPixelRatio(DPR);

  const scene = new THREE.Scene();
  let camera;
  const size = () => {
    const W = window.innerWidth, H = window.innerHeight;
    renderer.setSize(W, H);
    camera = new THREE.OrthographicCamera(0, W, 0, -H, -100, 100);
    camera.updateProjectionMatrix();
  };
  size();
  window.addEventListener("resize", size);

  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";
  const geo = new THREE.PlaneGeometry(1, 1);
  const planes = [];

  function promote(img) {
    img.dataset.gl = "1";
    const src = img.currentSrc || img.src;
    loader.load(src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uMap: { value: tex },
          uT: { value: 0 },
          uTime: { value: Math.random() * 10 },
          uHover: { value: 0 },
          uSeed: { value: Math.random() },
          uPlane: { value: new THREE.Vector2(1, 1) },
          uImg: { value: new THREE.Vector2(tex.image.width, tex.image.height) },
        },
      });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      const p = { img, mesh, mat, t: 0, hover: 0, hoverTarget: 0 };
      planes.push(p);
      img.style.opacity = "0";
      const host = img.closest("[data-plane]") || img;
      host.addEventListener("pointerenter", () => (p.hoverTarget = 1));
      host.addEventListener("pointerleave", () => (p.hoverTarget = 0));
    });
  }

  window.PPGL.sync = () => {
    document.querySelectorAll("[data-plane] img.plane:not([data-gl])").forEach(promote);
  };
  window.PPGL.sync();

  /* ---------- hero particle field: stateless curl-ish flow,
     compressed to the core during boot, bursts open on enter,
     ignites acid→spectral around the cursor ---------- */
  const FIELD_VERT = /* glsl */ `
    attribute vec3 aSeed;
    uniform float uTime;
    uniform vec2 uRes;
    uniform vec2 uMouse;
    uniform float uBoot;
    varying float vIgnite;
    varying vec3 vSeed;
    void main() {
      vec2 base = aSeed.xy * uRes;
      float t = uTime * (0.18 + aSeed.z * 0.25);
      vec2 drift = vec2(
        sin(t + aSeed.x * 6.2831 + sin(t * 0.7 + aSeed.y * 9.0) * 1.6),
        cos(t * 0.9 + aSeed.y * 6.2831 + sin(t * 0.6 + aSeed.x * 7.0) * 1.8)
      ) * (14.0 + aSeed.z * 34.0);
      vec2 p = base + drift;

      // boot: collapse toward the core with chaos, release on enter
      vec2 center = uRes * 0.5;
      vec2 chaos = vec2(
        sin(uTime * 3.2 + aSeed.x * 43.0),
        cos(uTime * 2.7 + aSeed.y * 39.0)
      ) * 70.0 * uBoot;
      p = mix(p, center + (base - center) * 0.06 + chaos, uBoot);

      // cursor stir: repel + ignite
      vec2 d = p - uMouse;
      float dist = length(d);
      float f = max(0.0, 1.0 - dist / 170.0);
      p += normalize(d + 0.001) * f * f * 64.0;
      vIgnite = f;
      vSeed = aSeed;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, -p.y, -5.0, 1.0);
      gl_PointSize = 1.0 + aSeed.z * 1.8 + f * 2.2;
    }
  `;
  const FIELD_FRAG = /* glsl */ `
    precision highp float;
    varying float vIgnite;
    varying vec3 vSeed;
    uniform float uTime;
    uniform float uFade;
    void main() {
      float a = (0.10 + vSeed.z * 0.18) * uFade;
      vec3 col = vec3(0.55, 0.54, 0.51);
      vec3 acid = vec3(0.83, 1.0, 0.0);
      vec3 spec = vec3(
        0.55 + 0.4 * sin(uTime * 2.0 + vSeed.x * 21.0),
        0.60 + 0.4 * sin(uTime * 1.7 + vSeed.y * 17.0 + 2.1),
        1.0
      );
      vec3 ig = mix(acid, spec, smoothstep(0.65, 1.0, vIgnite));
      col = mix(col, ig, smoothstep(0.04, 0.75, vIgnite));
      a = mix(a, 0.9 * uFade, vIgnite * vIgnite);
      gl_FragColor = vec4(col, a);
    }
  `;

  let field = null;
  const hero = document.querySelector(".hero");
  if (hero) {
    const COUNT = window.innerWidth < 821 ? 12000 : 45000;
    const seeds = new Float32Array(COUNT * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    fgeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
    const fmat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: FIELD_VERT,
      fragmentShader: FIELD_FRAG,
      uniforms: {
        uTime: { value: Math.random() * 100 },
        uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uMouse: { value: new THREE.Vector2(-9999, -9999) },
        uBoot: { value: document.getElementById("boot") ? 1 : 0 },
        uFade: { value: 1 },
      },
    });
    field = new THREE.Points(fgeo, fmat);
    field.frustumCulled = false;
    scene.add(field);

    window.addEventListener("resize", () =>
      fmat.uniforms.uRes.value.set(window.innerWidth, window.innerHeight));
    window.addEventListener("mousemove", (e) =>
      fmat.uniforms.uMouse.value.set(e.clientX, e.clientY));
    document.addEventListener("pp:boot-t", (e) => {
      fmat.uniforms.uBoot.value = Math.max(fmat.uniforms.uBoot.value * 0.0 + e.detail, 0);
    });
    document.addEventListener("pp:boot-done", () => {
      gsap.to(fmat.uniforms.uBoot, { value: 0, duration: 1.6, ease: "expo.out" });
    });
  }

  const vh = () => window.innerHeight;
  gsap.ticker.add((time, dt) => {
    if (!planes.length && !field) return;
    let any = false;
    if (field) {
      const fade = Math.max(0, 1 - window.scrollY / (vh() * 0.9));
      field.material.uniforms.uFade.value = fade;
      field.material.uniforms.uTime.value += dt * 0.001;
      field.visible = fade > 0.02;
      if (field.visible) any = true;
    }
    for (const p of planes) {
      const r = p.img.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh() + 80 || !r.width) {
        p.mesh.visible = false;
        continue;
      }
      any = true;
      p.mesh.visible = true;
      p.mesh.scale.set(r.width, r.height, 1);
      p.mesh.position.set(r.left + r.width / 2, -(r.top + r.height / 2), 0);

      // resolve as the plane travels into view; never re-noise
      const target = Math.min(1, Math.max(0, (vh() * 0.94 - r.top) / (vh() * 0.55)));
      p.t = Math.max(p.t, p.t + (target - p.t) * 0.14);
      p.hover += (p.hoverTarget - p.hover) * 0.09;

      p.mat.uniforms.uT.value = p.t;
      p.mat.uniforms.uHover.value = p.hover;
      p.mat.uniforms.uTime.value += dt * 0.001;
      p.mat.uniforms.uPlane.value.set(r.width, r.height);
    }
    if (any) renderer.render(scene, camera);
  });
})();
