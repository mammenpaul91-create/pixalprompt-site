/* ============================================================
   PIXAL PROMPT — WebGL layer scaffold v14
   Three.js loads lazily (only when a scene registers) and renders
   on the same gsap.ticker RAF as Lenis + ScrollTrigger.
   Session 2 attaches the intro smoke scene here; Session 4 the
   image diffusion/displacement planes.
   ============================================================ */

const GL_REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

window.PPGL = {
  THREE: null,
  renderer: null,
  scenes: new Set(), // { scene, camera, update(t), enabled }
  _loading: null,
  _ticking: false,

  load() {
    if (GL_REDUCED) return Promise.reject(new Error("reduced motion"));
    if (!this._loading) this._loading = import(THREE_URL).then((m) => (this.THREE = m));
    return this._loading;
  },

  async ensureRenderer() {
    await this.load();
    if (this.renderer) return this.renderer;
    const T = this.THREE;
    const canvas = document.createElement("canvas");
    canvas.className = "gl-layer";
    document.body.appendChild(canvas);
    this.renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap
    const size = () => this.renderer.setSize(window.innerWidth, window.innerHeight);
    size();
    window.addEventListener("resize", size);

    if (!this._ticking && typeof gsap !== "undefined") {
      this._ticking = true;
      gsap.ticker.add((time) => {
        if (!this.scenes.size) return;
        this.renderer.clear();
        for (const s of this.scenes) {
          if (s.enabled === false) continue;
          if (s.update) s.update(time);
          this.renderer.render(s.scene, s.camera);
        }
      });
    }
    return this.renderer;
  },

  register(entry) {
    this.scenes.add(entry);
    return () => this.scenes.delete(entry);
  },
};
