(() => {
  "use strict";

  /* 秦风 · 骠骑 —— 主程序前缀 */
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");

  const ui = {
    score: document.getElementById("scoreValue"),
    distance: document.getElementById("distanceValue"),
    pips: Array.from(document.querySelectorAll("#pips .pip")),
    combo: document.getElementById("comboBadge"),
    comboValue: document.getElementById("comboValue"),
    rush: document.getElementById("rush"),
    rushFill: document.getElementById("rushFill"),
    menu: document.getElementById("menuScreen"),
    pause: document.getElementById("pauseScreen"),
    over: document.getElementById("overScreen"),
    menuBest: document.getElementById("menuBest"),
    soundBtn: document.getElementById("soundBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    startBtn: document.getElementById("startBtn"),
    resumeBtn: document.getElementById("resumeBtn"),
    pauseMenuBtn: document.getElementById("pauseMenuBtn"),
    restartBtn: document.getElementById("restartBtn"),
    overMenuBtn: document.getElementById("overMenuBtn"),
    finalScore: document.getElementById("finalScore"),
    finalDistance: document.getElementById("finalDistance"),
    finalBells: document.getElementById("finalBells"),
    finalRank: document.getElementById("finalRank"),
    rankNote: document.getElementById("rankNote"),
    rankNext: document.getElementById("rankNext"),
    rankProgressFill: document.getElementById("rankProgressFill"),
    newBest: document.getElementById("newBest"),
    overFlavor: document.getElementById("overFlavor"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toastText"),
    canvasTip: document.getElementById("canvasTip"),
    jumpBtn: document.getElementById("jumpBtn"),
  };

  const VIEW_W = 1280;
  const VIEW_H = 720;
  const GROUND = 566;
  const PLAYER_X = 302;
  const MENU_X = 934;
  const STEPS_PER_UNIT = 28;
  const DASH_DURATION = 6;
  const TAU = Math.PI * 2;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min = 0, max = 1) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const mod = (n, m) => ((n % m) + m) % m;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundRect(g, x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    g.beginPath();
    g.moveTo(x + radius, y);
    g.arcTo(x + w, y, x + w, y + h, radius);
    g.arcTo(x + w, y + h, x, y + h, radius);
    g.arcTo(x, y + h, x, y, radius);
    g.arcTo(x, y, x + w, y, radius);
    g.closePath();
  }

  function makeLayer(w, h, paint) {
    const layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
    paint(layer.getContext("2d"), w, h);
    return layer;
  }

  function readNumber(key, fallback) {
    try {
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function readFlag(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value === "1";
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* ignore */
    }
  }

  let bestScore = readNumber("qin-cavalry-best", 0);
  let soundEnabled = readFlag("qin-cavalry-sound", true);

  /* ————————————— WebAudio 音效 ————————————— */
  class Soundscape {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.ambient = null;
      this.buffer = null;
      this.running = false;
      this.ambientOn = false;
      this.beatClock = 0;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
        return;
      }
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = soundEnabled ? 0.62 : 0;
        this.master.connect(this.ctx.destination);
        this.buffer = this.makeNoise();
        this.buildAmbient();
        this.ctx.resume().catch(() => {});
      } catch {
        this.ctx = null;
      }
    }

    makeNoise() {
      const length = Math.floor(this.ctx.sampleRate * 2);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i += 1) {
        last = last * 0.87 + (Math.random() * 2 - 1) * 0.13;
        data[i] = last;
      }
      return buffer;
    }

    buildAmbient() {
      const c = this.ctx;
      this.ambient = c.createGain();
      this.ambient.gain.value = 0;
      this.ambient.connect(this.master);

      const droneFilter = c.createBiquadFilter();
      droneFilter.type = "lowpass";
      droneFilter.frequency.value = 210;
      droneFilter.connect(this.ambient);
      const droneGain = c.createGain();
      droneGain.gain.value = 0.05;
      droneGain.connect(droneFilter);
      [55, 82.5, 110].forEach((freq, index) => {
        const osc = c.createOscillator();
        osc.type = index === 2 ? "triangle" : "sine";
        osc.frequency.value = freq;
        const gain = c.createGain();
        gain.gain.value = index === 0 ? 0.85 : index === 1 ? 0.4 : 0.15;
        osc.connect(gain);
        gain.connect(droneGain);
        osc.start();
      });

      const wind = c.createBufferSource();
      wind.buffer = this.buffer;
      wind.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 390;
      filter.Q.value = 0.6;
      const windGain = c.createGain();
      windGain.gain.value = 0.05;
      wind.connect(filter);
      filter.connect(windGain);
      windGain.connect(this.ambient);
      wind.start();

      const lfo = c.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(windGain.gain);
      lfo.start();
    }

    setEnabled(enabled) {
      soundEnabled = enabled;
      writeStorage("qin-cavalry-sound", enabled ? 1 : 0);
      if (!this.ctx) return;
      this.master.gain.setTargetAtTime(enabled ? 0.62 : 0, this.ctx.currentTime, 0.04);
    }

    start() {
      this.init();
      this.running = true;
      if (!this.ctx) return;
      this.ctx.resume().catch(() => {});
      this.ambient.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.6);
      this.ambientOn = true;
      this.beatClock = 0.3;
    }

    stop() {
      this.running = false;
      if (!this.ctx) return;
      this.ambient.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
      this.ambientOn = false;
    }

    setPaused(paused) {
      if (paused) {
        this.stop();
      } else if (this.ctx) {
        this.running = true;
        this.ambient.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.25);
        this.ambientOn = true;
        this.ctx.resume().catch(() => {});
      }
    }

    tone(freq, duration, options = {}) {
      if (!this.ctx || !soundEnabled) return;
      const c = this.ctx;
      const now = c.currentTime + (options.delay || 0);
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = options.type || "sine";
      osc.frequency.setValueAtTime(freq, now);
      if (options.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.slide), now + duration);
      const vol = options.volume == null ? 0.08 : options.volume;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    }

    noise(duration, options = {}) {
      if (!this.ctx || !soundEnabled) return;
      const c = this.ctx;
      const now = c.currentTime + (options.delay || 0);
      const source = c.createBufferSource();
      source.buffer = this.buffer;
      const filter = c.createBiquadFilter();
      filter.type = options.filterType || "lowpass";
      filter.frequency.setValueAtTime(options.frequency || 800, now);
      if (options.filterSlide) filter.frequency.exponentialRampToValueAtTime(Math.max(60, options.filterSlide), now + duration);
      const gain = c.createGain();
      const vol = options.volume == null ? 0.05 : options.volume;
      gain.gain.setValueAtTime(Math.max(0.0002, vol), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(now);
      source.stop(now + duration + 0.03);
    }

    jump(doubleJump = false) {
      this.tone(doubleJump ? 390 : 230, 0.16, { type: "triangle", volume: 0.05, slide: doubleJump ? 640 : 380 });
      this.noise(0.12, { volume: 0.02, frequency: doubleJump ? 1900 : 1100, filterSlide: 500 });
    }

    pickup(combo = 0) {
      const base = 740 * Math.pow(1.028, Math.min(combo, 28));
      this.tone(base, 0.1, { volume: 0.045 });
      this.tone(base * 1.5, 0.16, { volume: 0.028, delay: 0.035 });
      this.tone(base * 2.01, 0.1, { type: "triangle", volume: 0.012, delay: 0.06 });
    }

    hit() {
      this.noise(0.26, { volume: 0.14, frequency: 540, filterSlide: 90 });
      this.tone(126, 0.3, { volume: 0.11, slide: 44 });
      this.tone(78, 0.22, { type: "triangle", volume: 0.08, slide: 36 });
    }

    smash() {
      this.noise(0.17, { volume: 0.075, frequency: 1600, filterSlide: 200 });
      this.tone(170, 0.12, { type: "square", volume: 0.022, slide: 70 });
    }

    dash() {
      [196, 293.66, 392, 587.33].forEach((freq, index) => {
        this.tone(freq, 1.05 - index * 0.1, { type: index % 2 ? "triangle" : "sine", volume: 0.04 - index * 0.005, delay: index * 0.035 });
      });
      this.noise(0.55, { volume: 0.04, frequency: 2600, filterSlide: 260 });
    }

    milestone() {
      this.tone(523.25, 0.6, { volume: 0.04 });
      this.tone(783.99, 0.8, { volume: 0.032, delay: 0.11 });
      this.tone(1046.5, 0.7, { type: "triangle", volume: 0.016, delay: 0.2 });
    }

    gameOver() {
      [196, 164.81, 130.81].forEach((freq, index) => {
        this.tone(freq, 0.55, { volume: 0.07, delay: index * 0.16, slide: freq * 0.86 });
      });
      this.tone(65.4, 0.8, { type: "triangle", volume: 0.06, delay: 0.08, slide: 42 });
      this.noise(0.5, { volume: 0.05, frequency: 420, filterSlide: 100, delay: 0.05 });
    }

    drum(delay = 0) {
      if (!this.ctx || !soundEnabled) return;
      const c = this.ctx;
      const now = c.currentTime + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(92, now);
      osc.frequency.exponentialRampToValueAtTime(43, now + 0.22);
      gain.gain.setValueAtTime(0.042, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.34);
    }

    update(dt, intensity) {
      if (!this.running || !this.ambientOn) return;
      this.beatClock -= dt;
      if (this.beatClock <= 0) {
        this.beatClock += clamp(0.82 - intensity * 0.3, 0.42, 0.82);
        this.drum();
        if (Math.random() < 0.2) this.drum(0.16);
      }
    }
  }

  const sound = new Soundscape();

  /* ————————————— 预渲染山水 ————————————— */
  const skyLayer = makeLayer(VIEW_W, VIEW_H, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, "#e7ddc7");
    sky.addColorStop(0.32, "#e8d6b8");
    sky.addColorStop(0.64, "#dfc6a1");
    sky.addColorStop(0.82, "#d2b68e");
    sky.addColorStop(1, "#c2a078");
    g.fillStyle = sky;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    const glow = g.createRadialGradient(974, 173, 8, 974, 173, 280);
    glow.addColorStop(0, "rgba(255, 241, 203, 0.85)");
    glow.addColorStop(0.35, "rgba(250, 224, 172, 0.34)");
    glow.addColorStop(1, "rgba(250, 224, 172, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, VIEW_W, 560);
    const sun = g.createRadialGradient(952, 149, 4, 974, 173, 76);
    sun.addColorStop(0, "rgba(255, 250, 229, 0.95)");
    sun.addColorStop(0.55, "rgba(248, 227, 184, 0.72)");
    sun.addColorStop(1, "rgba(239, 207, 153, 0.1)");
    g.fillStyle = sun;
    g.beginPath();
    g.arc(974, 173, 77, 0, TAU);
    g.fill();

    g.save();
    g.filter = "blur(18px)";
    [
      [110, 152, 210, 34, 0.2],
      [370, 216, 160, 24, 0.14],
      [760, 104, 190, 28, 0.16],
      [1090, 278, 250, 34, 0.12],
      [520, 330, 280, 24, 0.1],
      [260, 448, 330, 20, 0.08],
    ].forEach(([x, y, rx, ry, a]) => {
      g.globalAlpha = a;
      g.fillStyle = "#fbf4e2";
      g.beginPath();
      g.ellipse(x, y, rx, ry, -0.04, 0, TAU);
      g.fill();
    });
    g.restore();

    g.strokeStyle = "rgba(68, 56, 43, 0.28)";
    g.lineWidth = 1.2;
    g.lineCap = "round";
    [[735, 235, 1], [752, 246, 0.75], [722, 250, 0.65], [1118, 330, 0.8], [1138, 337, 0.55]].forEach(([x, y, s]) => {
      g.beginPath();
      g.moveTo(x - 8 * s, y);
      g.quadraticCurveTo(x - 3 * s, y - 4 * s, x, y);
      g.quadraticCurveTo(x + 3 * s, y - 4 * s, x + 8 * s, y);
      g.stroke();
    });

    const rng = mulberry32(2088);
    for (let i = 0; i < 150; i += 1) {
      const x = rng() * VIEW_W;
      const y = rng() * 540;
      const w = 12 + rng() * 90;
      g.strokeStyle = `rgba(128, 101, 68, ${0.012 + rng() * 0.026})`;
      g.lineWidth = 0.7 + rng() * 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + w / 2, y + rng() * 3 - 1.5, x + w, y);
      g.stroke();
    }

    const haze = g.createLinearGradient(0, 360, 0, 566);
    haze.addColorStop(0, "rgba(238, 222, 194, 0)");
    haze.addColorStop(0.68, "rgba(238, 222, 194, 0.22)");
    haze.addColorStop(1, "rgba(231, 210, 176, 0.35)");
    g.fillStyle = haze;
    g.fillRect(0, 360, VIEW_W, 206);
  });

  function mountainRidge(g, width, baseY, amplitude, phases, fill, stroke) {
    g.beginPath();
    g.moveTo(0, VIEW_H);
    for (let x = 0; x <= width; x += 5) {
      const u = (x / width) * TAU;
      const shape =
        Math.abs(Math.sin(u * 2 + phases[0])) * 0.52 +
        Math.abs(Math.sin(u * 5 + phases[1])) * 0.24 +
        Math.sin(u * 9 + phases[2]) * 0.12 +
        Math.sin(u * 17 + phases[3]) * 0.06;
      const y = baseY - amplitude * (0.22 + shape * 0.78);
      if (x === 0) g.lineTo(0, y);
      else g.lineTo(x, y);
    }
    g.lineTo(width, VIEW_H);
    g.lineTo(0, VIEW_H);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = 1.4;
      g.stroke();
    }
  }

  function buildMountainLayer(width, baseY, amplitude, seed, topColor, bottomColor, hazeColor) {
    const rng = mulberry32(seed);
    const a = [rng() * TAU, rng() * TAU, rng() * TAU, rng() * TAU];
    const b = [rng() * TAU, rng() * TAU, rng() * TAU, rng() * TAU];
    return makeLayer(width, VIEW_H, (g) => {
      const gradA = g.createLinearGradient(0, baseY - amplitude, 0, baseY + 80);
      gradA.addColorStop(0, topColor);
      gradA.addColorStop(1, bottomColor);
      mountainRidge(g, width, baseY - 10, amplitude * 0.86, a, gradA, "rgba(91, 77, 60, 0.13)");
      const gradB = g.createLinearGradient(0, baseY - amplitude, 0, baseY + 110);
      gradB.addColorStop(0, hazeColor);
      gradB.addColorStop(0.7, "rgba(110, 92, 69, 0.14)");
      gradB.addColorStop(1, "rgba(110, 92, 69, 0.03)");
      mountainRidge(g, width, baseY + 4, amplitude * 0.74, b, gradB, null);
      g.save();
      g.globalCompositeOperation = "screen";
      const light = g.createLinearGradient(0, baseY - amplitude, width, baseY);
      light.addColorStop(0, "rgba(255, 245, 218, 0)");
      light.addColorStop(0.5, "rgba(255, 245, 218, 0.12)");
      light.addColorStop(1, "rgba(255, 245, 218, 0)");
      g.fillStyle = light;
      g.fillRect(0, baseY - amplitude, width, amplitude);
      g.restore();
    });
  }

  const farMountains = buildMountainLayer(1920, 452, 124, 7311, "rgba(139, 123, 101, 0.3)", "rgba(145, 127, 101, 0.08)", "rgba(153, 135, 108, 0.18)");
  const midMountains = buildMountainLayer(1600, 514, 98, 9134, "rgba(99, 82, 61, 0.24)", "rgba(94, 76, 55, 0.08)", "rgba(112, 92, 67, 0.18)");

  function drawSoldierSilhouette(g, x, base, scale, color) {
    g.save();
    g.translate(x, base);
    g.scale(scale, scale);
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineCap = "round";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(11, 0);
    g.lineTo(11, -116);
    g.stroke();
    g.beginPath();
    g.moveTo(11, -116);
    g.lineTo(20, -108);
    g.lineTo(11, -102);
    g.closePath();
    g.fill();
    g.fillRect(-10, -29, 8, 29);
    g.fillRect(3, -27, 8, 27);
    g.beginPath();
    g.moveTo(-17, -72);
    g.quadraticCurveTo(-21, -50, -15, -25);
    g.lineTo(15, -25);
    g.quadraticCurveTo(20, -51, 15, -72);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(-15, -71, 8, 5, -0.25, 0, TAU);
    g.ellipse(15, -71, 8, 5, 0.25, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(0, -84, 8.5, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(4, -94, 5, 6, 0.2, 0, TAU);
    g.fill();
    g.globalAlpha *= 0.72;
    g.beginPath();
    g.ellipse(-19, -47, 10, 18, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawHorseSilhouette(g, x, base, scale, color) {
    g.save();
    g.translate(x, base);
    g.scale(scale, scale);
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0, -54, 31, 15, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(-21, -60);
    g.quadraticCurveTo(-24, -79, -12, -85);
    g.quadraticCurveTo(5, -88, 16, -77);
    g.lineTo(24, -54);
    g.lineTo(11, -53);
    g.lineTo(5, -69);
    g.lineTo(-4, -62);
    g.lineTo(-8, -53);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(21, -71);
    g.quadraticCurveTo(34, -85, 44, -80);
    g.lineTo(49, -72);
    g.lineTo(38, -64);
    g.lineTo(29, -66);
    g.closePath();
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-18, -51);
    g.lineTo(-23, -30);
    g.lineTo(-18, -5);
    g.moveTo(18, -51);
    g.lineTo(24, -31);
    g.lineTo(20, -5);
    g.moveTo(-13, -51);
    g.lineTo(-10, -27);
    g.lineTo(-14, -5);
    g.moveTo(12, -51);
    g.lineTo(8, -28);
    g.lineTo(12, -5);
    g.stroke();
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(-1, -96, 7, 15, 0.1, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(2, -116, 6, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawTower(g, x, base, scale, color) {
    g.save();
    g.translate(x, base);
    g.scale(scale, scale);
    g.fillStyle = color;
    g.fillRect(-34, -62, 68, 62);
    g.fillRect(-45, -10, 90, 10);
    g.fillRect(-26, -112, 52, 52);
    g.fillRect(-35, -116, 70, 7);
    g.beginPath();
    g.moveTo(-44, -116);
    g.lineTo(-28, -130);
    g.lineTo(28, -130);
    g.lineTo(44, -116);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-52, -118);
    g.quadraticCurveTo(-38, -126, -28, -132);
    g.lineTo(-8, -137);
    g.lineTo(-2, -130);
    g.lineTo(-16, -128);
    g.quadraticCurveTo(-38, -124, -47, -114);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(52, -118);
    g.quadraticCurveTo(38, -126, 28, -132);
    g.lineTo(8, -137);
    g.lineTo(2, -130);
    g.lineTo(16, -128);
    g.quadraticCurveTo(38, -124, 47, -114);
    g.closePath();
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(0, -130);
    g.lineTo(0, -212);
    g.stroke();
    g.fillStyle = "rgba(137, 50, 35, 0.35)";
    g.beginPath();
    g.moveTo(2, -208);
    g.quadraticCurveTo(27, -204, 45, -194);
    g.quadraticCurveTo(25, -190, 2, -188);
    g.closePath();
    g.fill();
    g.restore();
  }

  const armyLayer = makeLayer(1600, VIEW_H, (g) => {
    const rng = mulberry32(4406);
    g.globalAlpha = 0.72;
    for (let i = 0; i < 20; i += 1) {
      const x = 50 + i * 78 + (rng() - 0.5) * 22;
      drawSoldierSilhouette(g, x, 546 + rng() * 2, 0.38 + rng() * 0.16, i % 3 === 0 ? "rgba(91, 72, 51, 0.2)" : "rgba(105, 85, 63, 0.15)");
    }
    g.globalAlpha = 1;
    drawTower(g, 274, 552, 1.22, "rgba(84, 65, 46, 0.24)");
    drawTower(g, 1288, 552, 0.88, "rgba(84, 65, 46, 0.19)");
    [[622, 552, 1.25, 0.25], [1018, 552, 0.9, 0.18]].forEach(([x, base, scale, alpha]) => {
      g.save();
      g.translate(x, base);
      g.scale(scale, scale);
      g.globalAlpha = alpha;
      g.strokeStyle = "rgba(81, 60, 41, 0.8)";
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -170);
      g.stroke();
      g.fillStyle = "rgba(135, 49, 34, 0.7)";
      g.beginPath();
      g.moveTo(2, -166);
      g.quadraticCurveTo(28, -160, 44, -150);
      g.quadraticCurveTo(26, -145, 2, -141);
      g.closePath();
      g.fill();
      g.globalAlpha = alpha * 0.8;
      g.fillStyle = "rgba(226, 196, 139, 0.9)";
      g.font = '18px "KaiTi", "STKaiti", serif';
      g.textAlign = "center";
      g.fillText("秦", 20, -152);
      g.restore();
    });
    [90, 1030, 1460].forEach((x, index) => {
      drawHorseSilhouette(g, x, 562, 1.15 + index * 0.05, "rgba(82, 62, 44, 0.27)");
    });
    for (let i = 0; i < 13; i += 1) {
      const x = 30 + i * 124 + (rng() - 0.5) * 46;
      if (x > 260 && x < 330) continue;
      drawSoldierSilhouette(g, x, 566 + rng() * 3, 0.62 + rng() * 0.24, i % 4 === 0 ? "rgba(84, 63, 44, 0.23)" : "rgba(93, 71, 49, 0.18)");
    }
    const haze = g.createLinearGradient(0, 470, 0, 570);
    haze.addColorStop(0, "rgba(230, 211, 180, 0)");
    haze.addColorStop(0.7, "rgba(230, 211, 180, 0.28)");
    haze.addColorStop(1, "rgba(230, 211, 180, 0.12)");
    g.fillStyle = haze;
    g.fillRect(0, 470, 1600, 110);
  });

  const cloudLayer = makeLayer(1920, 260, (g) => {
    const rng = mulberry32(881);
    g.filter = "blur(11px)";
    for (let i = 0; i < 9; i += 1) {
      g.globalAlpha = 0.12 + rng() * 0.14;
      g.fillStyle = i % 3 === 0 ? "#f8f0df" : "#b49a76";
      g.beginPath();
      g.ellipse(90 + i * 205 + rng() * 110, 55 + rng() * 120, 80 + rng() * 125, 12 + rng() * 18, -0.03, 0, TAU);
      g.fill();
    }
  });

  /* ————————————— 地面与前景 ————————————— */
  const decorRng = mulberry32(6612);
  const groundMarks = [];
  for (let i = 0; i < 108; i += 1) {
    const type = decorRng();
    groundMarks.push({
      x: decorRng() * 1600,
      y: GROUND + 12 + decorRng() * 142,
      size: 1 + decorRng() * 3.4,
      rot: decorRng() * TAU,
      alpha: 0.1 + decorRng() * 0.26,
      type: type < 0.58 ? "pebble" : type < 0.82 ? "crack" : "shard",
      length: 6 + decorRng() * 24,
    });
  }

  const foregroundRng = mulberry32(9914);
  const foregroundGrass = [];
  for (let i = 0; i < 74; i += 1) {
    foregroundGrass.push({
      x: foregroundRng() * 1600,
      y: 683 + foregroundRng() * 38,
      height: 18 + foregroundRng() * 58,
      lean: (foregroundRng() - 0.5) * 0.8,
      phase: foregroundRng() * TAU,
      alpha: 0.15 + foregroundRng() * 0.34,
      width: 0.7 + foregroundRng() * 1.5,
    });
  }

  const ambientMotes = [];
  const moteRng = mulberry32(3402);
  for (let i = 0; i < 40; i += 1) {
    ambientMotes.push({
      x: moteRng() * VIEW_W,
      y: 300 + moteRng() * 390,
      r: 0.6 + moteRng() * 2.4,
      alpha: 0.06 + moteRng() * 0.18,
      phase: moteRng() * TAU,
      speed: 0.25 + moteRng() * 0.9,
    });
  }

  /* ————————————— 游戏状态 ————————————— */
  const RANKS = [
    { min: 0, name: "公士", note: "初入军阵" },
    { min: 350, name: "上造", note: "已识弓马" },
    { min: 900, name: "簪袅", note: "驰道扬尘" },
    { min: 1700, name: "不更", note: "骁勇渐显" },
    { min: 2800, name: "大夫", note: "一骑当先" },
    { min: 4300, name: "官大夫", note: "名动骊山" },
    { min: 6200, name: "公大夫", note: "尘惊六军" },
    { min: 8500, name: "公乘", note: "秦风烈烈" },
    { min: 11500, name: "五大夫", note: "骠骑无双" },
  ];

  const state = {
    mode: "menu",
    time: 0,
    runTime: 0,
    scenery: 0,
    speed: 360,
    distance: 0,
    score: 0,
    bells: 0,
    hp: 3,
    combo: 0,
    comboTimer: 0,
    jumpY: 0,
    vy: 0,
    onGround: true,
    airJumpUsed: false,
    jumpHeld: false,
    jumpBuffer: 0,
    coyote: 0,
    invuln: 0,
    dashTime: 0,
    shake: 0,
    flash: 0,
    obstacleTimer: 2.2,
    coinTimer: 1.2,
    tallyTimer: 10.5,
    nextMilestone: 250,
    phase: 0,
    footTimer: 0,
    trail: [],
    tipTimer: 0,
    wasNewBest: false,
  };

  let entities = [];
  let particles = [];
  let floatTexts = [];
  let toastTimer = 0;
  let tipHideTimer = 0;
  let hudCache = { score: -1, distance: -1, combo: -1, pips: -1, rush: -1, rushActive: null };

  const obstacles = [
    { type: "stone", weight: 0.4 },
    { type: "halberd", weight: 0.31 },
    { type: "pit", weight: 0.29 },
  ];

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe(canvas);
  window.addEventListener("resize", resizeCanvas, { passive: true });

  function updateSoundButton() {
    ui.soundBtn.textContent = soundEnabled ? "音" : "静";
    ui.soundBtn.classList.toggle("muted", !soundEnabled);
    ui.soundBtn.setAttribute("aria-label", soundEnabled ? "关闭音效" : "开启音效");
  }

  function toggleSound() {
    sound.setEnabled(!soundEnabled);
    updateSoundButton();
    if (soundEnabled) {
      sound.init();
      if (state.mode === "playing") sound.start();
      sound.milestone();
    }
  }

  function setStateMode(mode) {
    state.mode = mode;
    stage.dataset.state = mode;
    ui.menu.classList.toggle("hidden", mode !== "menu");
    ui.pause.classList.toggle("hidden", mode !== "paused");
    ui.over.classList.toggle("hidden", mode !== "over");
    if (mode !== "playing") ui.canvasTip.classList.remove("show");
  }

  function showToast(text, mark = "令", duration = 1900) {
    ui.toastText.textContent = text;
    const markEl = ui.toast.querySelector(".toast-mark");
    if (markEl) markEl.textContent = mark;
    ui.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => ui.toast.classList.remove("show"), duration);
  }

  function showTip(duration = 4200) {
    ui.canvasTip.classList.add("show");
    window.clearTimeout(tipHideTimer);
    tipHideTimer = window.setTimeout(() => ui.canvasTip.classList.remove("show"), duration);
  }

  function updateHud(force = false) {
    const score = Math.floor(state.score);
    if (force || score !== hudCache.score) {
      ui.score.textContent = score.toLocaleString("zh-CN");
      hudCache.score = score;
    }
    const steps = Math.floor(state.distance / STEPS_PER_UNIT);
    if (force || steps !== hudCache.distance) {
      ui.distance.textContent = steps.toLocaleString("zh-CN");
      hudCache.distance = steps;
    }
    const showCombo = state.combo >= 5 && state.comboTimer > 0;
    if (force || showCombo !== hudCache.combo) {
      ui.combo.classList.toggle("visible", showCombo);
      hudCache.combo = showCombo;
    }
    if (showCombo) ui.comboValue.textContent = `×${getComboMultiplier()}`;
    if (force || state.hp !== hudCache.pips) {
      ui.pips.forEach((pip, index) => pip.classList.toggle("lost", index >= state.hp));
      hudCache.pips = state.hp;
    }
    const rushActive = state.dashTime > 0;
    if (force || rushActive !== hudCache.rushActive) {
      ui.rush.classList.toggle("active", rushActive);
      hudCache.rushActive = rushActive;
    }
    if (rushActive) ui.rushFill.style.transform = `scaleX(${clamp(state.dashTime / DASH_DURATION, 0, 1)})`;
  }

  function getComboMultiplier() {
    return Math.min(5, 1 + Math.floor(state.combo / 5));
  }

  function updateBestLabels() {
    ui.menuBest.textContent = Math.floor(bestScore).toLocaleString("zh-CN");
  }

  function getRank(score) {
    let index = 0;
    RANKS.forEach((rank, i) => {
      if (score >= rank.min) index = i;
    });
    return { rank: RANKS[index], next: RANKS[index + 1] || null };
  }

  function updatePips() {
    ui.pips.forEach((pip, index) => pip.classList.toggle("lost", index >= state.hp));
    hudCache.pips = state.hp;
  }

  function resetRun() {
    Object.assign(state, {
      runTime: 0,
      distance: 0,
      score: 0,
      bells: 0,
      hp: 3,
      combo: 0,
      comboTimer: 0,
      speed: 360,
      jumpY: 0,
      vy: 0,
      onGround: true,
      airJumpUsed: false,
      jumpHeld: false,
      jumpBuffer: 0,
      coyote: 0,
      invuln: 0,
      dashTime: 0,
      shake: 0,
      flash: 0,
      obstacleTimer: 2.15,
      coinTimer: 1.4,
      tallyTimer: 10.5,
      nextMilestone: 250,
      phase: 0,
      footTimer: 0,
      trail: [],
      tipTimer: 0,
      wasNewBest: false,
    });
    entities = [];
    particles = [];
    floatTexts = [];
    hudCache = { score: -1, distance: -1, combo: -1, pips: -1, rush: -1, rushActive: null };
    updateHud(true);
  }

  function startGame() {
    sound.init();
    sound.start();
    resetRun();
    setStateMode("playing");
    state.tipTimer = 4.2;
    showTip(4200);
    updateBestLabels();
    showToast("鼓声已动 · 策马入阵", "秦", 1750);
    try {
      canvas.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }

  function pauseGame() {
    if (state.mode !== "playing") return;
    setStateMode("paused");
    state.jumpHeld = false;
    state.jumpBuffer = 0;
    sound.setPaused(true);
    updateHud(true);
  }

  function resumeGame() {
    if (state.mode !== "paused") return;
    setStateMode("playing");
    sound.setPaused(false);
    state.jumpHeld = false;
    state.jumpBuffer = 0;
    state.coyote = 0;
    state.tipTimer = 0;
    updateHud(true);
  }

  function returnToMenu() {
    sound.stop();
    setStateMode("menu");
    state.dashTime = 0;
    state.jumpY = 0;
    state.vy = 0;
    state.onGround = true;
    state.jumpHeld = false;
    entities = [];
    particles = [];
    floatTexts = [];
    updateBestLabels();
    updateSoundButton();
  }

  function finishGame() {
    state.mode = "over";
    stage.dataset.state = "over";
    const finalScore = Math.floor(state.score);
    state.wasNewBest = finalScore > bestScore;
    if (state.wasNewBest) {
      bestScore = finalScore;
      writeStorage("qin-cavalry-best", bestScore);
    }
    updateBestLabels();
    const steps = Math.floor(state.distance / STEPS_PER_UNIT);
    const rankInfo = getRank(finalScore);
    ui.finalScore.textContent = finalScore.toLocaleString("zh-CN");
    ui.finalDistance.textContent = steps.toLocaleString("zh-CN");
    ui.finalBells.textContent = state.bells.toLocaleString("zh-CN");
    ui.finalRank.textContent = rankInfo.rank.name;
    ui.rankNote.textContent = rankInfo.rank.note;
    ui.newBest.classList.toggle("hidden", !state.wasNewBest);
    if (rankInfo.next) {
      const span = rankInfo.next.min - rankInfo.rank.min;
      const progress = clamp((finalScore - rankInfo.rank.min) / Math.max(1, span), 0, 1);
      ui.rankProgressFill.style.width = `${Math.max(2, progress * 100)}%`;
      ui.rankNext.textContent = `再得 ${Math.max(1, rankInfo.next.min - finalScore).toLocaleString("zh-CN")} 军功，可晋「${rankInfo.next.name}」`;
    } else {
      ui.rankProgressFill.style.width = "100%";
      ui.rankNext.textContent = "已至军功爵顶端 · 骠骑无双";
    }
    const flavors = [
      "一骑绝尘，军功留于驰道。",
      "陶马长嘶，千年风尘皆作回声。",
      "鼓声渐远，你的名字已录入军阵。",
      "尘归秦土，驰道仍向远方。",
    ];
    ui.overFlavor.textContent = pick(flavors);
    setStateMode("over");
    ui.toast.classList.remove("show");
    window.clearTimeout(toastTimer);
    sound.stop();
    sound.gameOver();
    updateHud(true);
  }

  function damagePlayer() {
    if (state.mode !== "playing" || state.invuln > 0 || state.dashTime > 0) return;
    state.hp -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.invuln = 1.65;
    state.shake = 15;
    state.flash = 0.55;
    updatePips();
    updateHud(true);
    sound.hit();
    burstClay(PLAYER_X + 20, GROUND - state.jumpY - 120, 18);
    addFloatText(PLAYER_X + 10, GROUND - state.jumpY - 200, "军心 −1", "#c76a50", 1.1, 20);
    if (state.hp <= 0) {
      state.hp = 0;
      updatePips();
      finishGame();
    }
  }

  /* ————————————— 生成 ————————————— */
  function spawnObstacle() {
    const roll = Math.random();
    let type = "stone";
    let cumulative = 0;
    for (let i = 0; i < obstacles.length; i += 1) {
      cumulative += obstacles[i].weight;
      if (roll <= cumulative) {
        type = obstacles[i].type;
        break;
      }
    }
    if (type === "pit" && state.runTime < 14) type = Math.random() < 0.5 ? "stone" : "halberd";
    const baseX = VIEW_W + rand(40, 150);
    let width = 70;
    let height = 58;
    if (type === "halberd") {
      width = 90;
      height = 94;
    } else if (type === "pit") {
      width = 124;
      height = 45;
    }
    entities.push({ kind: "hazard", x: baseX, y: GROUND, width, height, type, dead: false, seed: Math.random() * 100 });
    if (Math.random() < 0.7) spawnCoinArc(baseX + width / 2, type === "halberd" ? 5 : 4);
  }

  function spawnCoinArc(centerX, count) {
    const startX = centerX - (count - 1) * 34;
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      entities.push({
        kind: "bell",
        x: startX + i * 68,
        y: GROUND - 330 + Math.sin(t * Math.PI) * -58 + Math.abs(t - 0.5) * 24,
        seed: Math.random() * TAU,
        dead: false,
      });
    }
  }

  function spawnCoinPattern() {
    const pattern = Math.random();
    const startX = VIEW_W + rand(60, 200);
    if (pattern < 0.4) {
      const count = randInt(5, 7);
      const baseY = GROUND - rand(250, 315);
      for (let i = 0; i < count; i += 1) {
        entities.push({ kind: "bell", x: startX + i * 58, y: baseY + Math.sin(i * 0.9) * 16, seed: Math.random() * TAU, dead: false });
      }
    } else if (pattern < 0.72) {
      const count = randInt(4, 6);
      const startY = GROUND - rand(205, 245);
      for (let i = 0; i < count; i += 1) {
        entities.push({ kind: "bell", x: startX + i * 66, y: startY - i * 25, seed: Math.random() * TAU, dead: false });
      }
    } else {
      const count = randInt(4, 6);
      const baseY = GROUND - rand(178, 215);
      for (let i = 0; i < count; i += 1) {
        entities.push({ kind: "bell", x: startX + i * 62, y: baseY + Math.sin(i * 1.3) * 10, seed: Math.random() * TAU, dead: false });
      }
    }
  }

  function spawnTally() {
    entities.push({ kind: "tally", x: VIEW_W + rand(80, 160), y: GROUND - rand(270, 325), seed: Math.random() * TAU, dead: false });
    showToast("虎符现世 · 破阵可期", "符", 1500);
  }

  function scheduleObstacles() {
    const speed = Math.max(300, state.speed * (state.dashTime > 0 ? 1.16 : 1));
    const difficulty = clamp(state.runTime / 95, 0, 1);
    state.obstacleTimer = Math.max(330, rand(500, 720) - difficulty * 130) / speed;
  }

  function scheduleCoins() {
    const speed = Math.max(300, state.speed * (state.dashTime > 0 ? 1.16 : 1));
    state.coinTimer = rand(780, 1450) / speed;
  }

  function scheduleTally() {
    state.tallyTimer = rand(18, 26);
  }

  /* ————————————— 粒子 ————————————— */
  function addParticle(particle) {
    if (particles.length > 260) particles.shift();
    particles.push(particle);
  }

  function spawnDust(x, y, options = {}) {
    const count = options.count || 1;
    for (let i = 0; i < count; i += 1) {
      addParticle({
        kind: "dust",
        x: x + rand(-12, 12),
        y: y + rand(-3, 2),
        vx: rand(-55, -12) - (options.forceX || 0),
        vy: rand(-58, -8),
        gravity: rand(-5, 9),
        size: rand(3, options.size || 10),
        life: rand(0.35, 0.8),
        maxLife: 0.8,
        color: options.color || "rgba(183, 145, 104, 0.42)",
        scroll: 0.78,
        grow: 16,
      });
    }
  }

  function burstGrab(x, y, color = "#e7c47d", count = 12) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(30, 150);
      addParticle({
        kind: "spark",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        gravity: 180,
        size: rand(1.2, 3.2),
        life: rand(0.3, 0.75),
        maxLife: 0.75,
        color,
        scroll: 0.2,
      });
    }
    addParticle({ kind: "ring", x, y, vx: 0, vy: 0, gravity: 0, size: 8, life: 0.36, maxLife: 0.36, color: "rgba(222, 187, 122, 0.7)", scroll: 0, grow: 72 });
  }

  function burstClay(x, y, count = 14) {
    for (let i = 0; i < count; i += 1) {
      addParticle({
        kind: "shard",
        x,
        y,
        vx: rand(-180, 120),
        vy: rand(-220, -30),
        gravity: 780,
        size: rand(2, 7),
        life: rand(0.35, 0.9),
        maxLife: 0.9,
        color: pick(["#a97650", "#c08a5f", "#8c5c3f", "#d6a97a"]),
        rot: rand(0, TAU),
        spin: rand(-9, 9),
        scroll: 0.25,
      });
    }
  }

  function burstSmash(x, y, color = "rgba(206, 167, 96, 0.8)", count = 16) {
    for (let i = 0; i < count; i += 1) {
      addParticle({
        kind: i % 3 === 0 ? "shard" : "spark",
        x: x + rand(-20, 20),
        y: y - rand(10, 80),
        vx: rand(-120, 220),
        vy: rand(-260, -30),
        gravity: 620,
        size: rand(2, 6),
        life: rand(0.35, 0.95),
        maxLife: 0.95,
        color,
        rot: rand(0, TAU),
        spin: rand(-8, 8),
        scroll: 0.3,
      });
    }
  }

  function addFloatText(x, y, text, color = "#eed5a0", life = 0.9, size = 18) {
    floatTexts.push({ x, y, text, color, life, maxLife: life, size });
  }

  function updateParticles(dt) {
    const worldShift = state.mode === "playing" ? state.speed * (state.dashTime > 0 ? 1.16 : 1) : state.mode === "menu" ? 86 : 0;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x -= worldShift * dt * (p.scroll == null ? 0.4 : p.scroll);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      if (p.rot != null) p.rot += (p.spin || 0) * dt;
      if (p.grow) p.size += p.grow * dt;
      p.vx *= 1 - dt * 0.7;
    }
    for (let i = floatTexts.length - 1; i >= 0; i -= 1) {
      const text = floatTexts[i];
      text.life -= dt;
      text.y -= 36 * dt;
      if (text.life <= 0) floatTexts.splice(i, 1);
    }
  }

  /* ————————————— 玩法 ————————————— */
  function doJump(doubleJump) {
    state.vy = doubleJump ? 490 : 650;
    state.onGround = false;
    state.coyote = 0;
    state.jumpBuffer = 0;
    state.airJumpUsed = doubleJump;
    sound.jump(doubleJump);
    if (doubleJump) {
      addFloatText(PLAYER_X + 60, GROUND - state.jumpY - 140, "再跃", "#e8ce95", 0.65, 15);
      spawnDust(PLAYER_X - 20, GROUND - state.jumpY - 40, { count: 8, size: 12, color: "rgba(203, 164, 118, 0.35)" });
    } else {
      spawnDust(PLAYER_X - 70, GROUND - 2, { count: 9, size: 11 });
    }
  }

  function requestJump() {
    if (state.mode === "playing") state.jumpBuffer = 0.13;
  }

  function updatePlaying(dt) {
    state.runTime += dt;
    state.time += dt;
    state.phase += dt * (8.2 + state.speed * 0.016);
    state.speed = lerp(state.speed, 360 + Math.min(305, state.runTime * 4.05), 1 - Math.pow(0.012, dt));
    const moveSpeed = state.speed * (state.dashTime > 0 ? 1.16 : 1);
    state.scenery += moveSpeed * dt;
    state.distance += moveSpeed * dt;
    state.score += moveSpeed * dt * 0.045;
    if (state.dashTime > 0) {
      state.score += moveSpeed * dt * 0.027;
      state.dashTime = Math.max(0, state.dashTime - dt);
      if (Math.random() < dt * 34) {
        addParticle({
          kind: "spark",
          x: PLAYER_X - rand(20, 150),
          y: GROUND - state.jumpY - rand(20, 290),
          vx: rand(-150, -40),
          vy: rand(-55, 20),
          gravity: 90,
          size: rand(1.2, 3.4),
          life: rand(0.25, 0.65),
          maxLife: 0.65,
          color: pick(["#f7dc9e", "#e9bd6d", "#fff0bd"]),
          scroll: 0.25,
        });
      }
      if (state.dashTime === 0) showToast("破阵结束 · 仍在驰道", "令", 1400);
    }
    state.invuln = Math.max(0, state.invuln - dt);
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0 && state.combo > 0) state.combo = 0;
    state.shake = Math.max(0, state.shake - dt * 38);
    state.flash = Math.max(0, state.flash - dt * 1.8);
    state.tipTimer = Math.max(0, state.tipTimer - dt);
    if (state.tipTimer === 0) ui.canvasTip.classList.remove("show");

    state.jumpBuffer = Math.max(0, state.jumpBuffer - dt);
    state.coyote = state.onGround ? 0.11 : Math.max(0, state.coyote - dt);
    if (state.jumpBuffer > 0) {
      if (state.onGround || state.coyote > 0) doJump(false);
      else if (!state.airJumpUsed) doJump(true);
    }

    if (!state.onGround) {
      state.vy -= (state.jumpHeld && state.vy > 0 ? 1900 : 2550) * dt;
      state.jumpY += state.vy * dt;
      if (state.jumpY <= 0) {
        const impact = Math.abs(state.vy);
        state.jumpY = 0;
        state.vy = 0;
        state.onGround = true;
        state.airJumpUsed = false;
        spawnDust(PLAYER_X - 15, GROUND - 2, { count: impact > 500 ? 14 : 7, size: impact > 500 ? 16 : 10, forceX: impact > 500 ? 70 : 15 });
        if (impact > 500) {
          state.shake = Math.max(state.shake, 3.5);
          addParticle({ kind: "ring", x: PLAYER_X + 10, y: GROUND - 8, vx: 0, vy: 0, gravity: 0, size: 6, life: 0.3, maxLife: 0.3, color: "rgba(194, 158, 111, 0.45)", scroll: 0, grow: 145 });
        }
      }
    }

    state.footTimer -= dt;
    if (state.onGround && state.footTimer <= 0) {
      state.footTimer = clamp(0.11 - state.speed * 0.00005, 0.045, 0.1);
      spawnDust(PLAYER_X - 70 + rand(-30, 40), GROUND - 2, { count: 1, size: rand(5, 11), color: "rgba(180, 141, 101, 0.3)", forceX: state.speed * 0.15 });
    }

    if (state.dashTime > 0) {
      state.trail.push({ x: state.scenery, t: state.time });
      if (state.trail.length > 7) state.trail.shift();
    } else if (state.trail.length) {
      state.trail.length = 0;
    }

    state.obstacleTimer -= dt;
    if (state.obstacleTimer <= 0) {
      spawnObstacle();
      scheduleObstacles();
    }
    state.coinTimer -= dt;
    if (state.coinTimer <= 0) {
      spawnCoinPattern();
      scheduleCoins();
    }
    state.tallyTimer -= dt;
    if (state.tallyTimer <= 0) {
      spawnTally();
      scheduleTally();
    }

    const steps = Math.floor(state.distance / STEPS_PER_UNIT);
    if (steps >= state.nextMilestone) {
      state.score += 120;
      showToast(`驰行 ${state.nextMilestone.toLocaleString("zh-CN")} 步 · 军功 +120`, "功", 1800);
      sound.milestone();
      state.nextMilestone += 250;
      burstGrab(PLAYER_X + 60, GROUND - state.jumpY - 210, "#e8c77f", 16);
    }

    updateEntities(dt, moveSpeed);
    updateParticles(dt);
    sound.update(dt, clamp(state.speed / 660, 0, 1));
    updateHud();
  }

  function updateEntities(dt, moveSpeed) {
    const playerBox = { x: PLAYER_X - 55, y: GROUND - state.jumpY - 140, w: 112, h: 116 };
    const pickupX = PLAYER_X + 26;
    const pickupY = GROUND - state.jumpY - 176;
    for (let i = entities.length - 1; i >= 0; i -= 1) {
      const entity = entities[i];
      entity.x -= moveSpeed * dt;
      if (entity.kind === "bell" && !entity.dead) {
        const dx = entity.x - pickupX;
        const dy = entity.y - pickupY;
        if (dx * dx + dy * dy < 82 * 82) {
          entity.dead = true;
          collectBell(entity);
        }
      } else if (entity.kind === "tally" && !entity.dead) {
        const dx = entity.x - pickupX;
        const dy = entity.y - pickupY;
        if (dx * dx + dy * dy < 90 * 90) {
          entity.dead = true;
          collectTally(entity);
        }
      } else if (entity.kind === "hazard" && !entity.dead) {
        const hazardBox = getHazardBox(entity);
        if (
          playerBox.x < hazardBox.x + hazardBox.w &&
          playerBox.x + playerBox.w > hazardBox.x &&
          playerBox.y < hazardBox.y + hazardBox.h &&
          playerBox.y + playerBox.h > hazardBox.y
        ) {
          if (state.dashTime > 0) {
            entity.dead = true;
            state.score += 35;
            state.shake = Math.max(state.shake, 7);
            burstSmash(entity.x + entity.width / 2, GROUND - 30);
            sound.smash();
            addFloatText(entity.x + entity.width / 2, GROUND - 100, "+35", "#f0d493", 0.8, 19);
          } else if (state.invuln <= 0) {
            damagePlayer();
          }
        }
      }
      if (entity.x < -220 || entity.dead) entities.splice(i, 1);
    }
  }

  function getHazardBox(entity) {
    if (entity.type === "pit") {
      return { x: entity.x + 5, y: GROUND - 54, w: entity.width - 12, h: 72 };
    }
    return { x: entity.x + 8, y: GROUND - entity.height + 3, w: entity.width - 16, h: entity.height - 2 };
  }

  function collectBell(entity) {
    state.bells += 1;
    state.combo += 1;
    state.comboTimer = 3.2;
    const multiplier = getComboMultiplier();
    const value = 12 * multiplier;
    state.score += value;
    sound.pickup(state.combo);
    burstGrab(entity.x, entity.y, "#eac77f", 8);
    addFloatText(entity.x + 8, entity.y - 10, `+${value}`, multiplier > 1 ? "#f2d797" : "#e8d3a4", 0.72, multiplier > 1 ? 20 : 17);
    if (state.combo === 5 || state.combo === 10 || state.combo === 20) {
      showToast(`连收 ${state.combo} 铃 · 军功 ×${getComboMultiplier()}`, "铃", 1200);
    }
    updateHud(true);
  }

  function collectTally(entity) {
    state.dashTime = DASH_DURATION;
    state.score += 150;
    state.invuln = Math.max(state.invuln, 0.2);
    sound.dash();
    state.shake = Math.max(state.shake, 5);
    state.flash = 0.24;
    showToast("虎符在手 · 破阵六息", "符", 1900);
    addFloatText(entity.x + 10, entity.y - 24, "虎符 · 破阵", "#f4d58f", 1.1, 23);
    burstGrab(entity.x, entity.y, "#f0cb80", 26);
    updateHud(true);
  }

  /* ————————————— 场景绘制 ————————————— */
  function drawWrappedLayer(layer, offset, y = 0) {
    const width = layer.width;
    const x = -mod(offset, width);
    ctx.drawImage(layer, x, y);
    ctx.drawImage(layer, x + width, y);
    if (x + width * 2 < VIEW_W) ctx.drawImage(layer, x + width * 2, y);
  }

  function drawClouds() {
    const offset = state.mode === "playing" ? state.scenery * 0.035 : state.scenery * 0.045;
    ctx.save();
    ctx.globalAlpha = 0.78;
    drawWrappedLayer(cloudLayer, offset, 84);
    ctx.restore();
  }

  function drawMountains() {
    drawWrappedLayer(farMountains, state.scenery * 0.032, 0);
    const haze = ctx.createLinearGradient(0, 420, 0, 575);
    haze.addColorStop(0, "rgba(233, 218, 192, 0)");
    haze.addColorStop(0.65, "rgba(233, 218, 192, 0.3)");
    haze.addColorStop(1, "rgba(229, 209, 177, 0.1)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 420, VIEW_W, 156);
    drawWrappedLayer(midMountains, state.scenery * 0.075, 0);
    drawWrappedLayer(armyLayer, state.scenery * 0.16, 0);
  }

  function drawGround() {
    const top = GROUND;
    const groundGradient = ctx.createLinearGradient(0, top, 0, VIEW_H);
    groundGradient.addColorStop(0, "#c49b72");
    groundGradient.addColorStop(0.1, "#b78b63");
    groundGradient.addColorStop(0.38, "#a77854");
    groundGradient.addColorStop(0.72, "#8f6549");
    groundGradient.addColorStop(1, "#79543d");
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, top, VIEW_W, VIEW_H - top);

    const sunlight = ctx.createRadialGradient(940, 610, 20, 940, 610, 520);
    sunlight.addColorStop(0, "rgba(244, 217, 173, 0.12)");
    sunlight.addColorStop(1, "rgba(244, 217, 173, 0)");
    ctx.fillStyle = sunlight;
    ctx.fillRect(0, top, VIEW_W, VIEW_H - top);

    ctx.strokeStyle = "rgba(231, 201, 156, 0.42)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(VIEW_W, top);
    ctx.stroke();
    ctx.strokeStyle = "rgba(86, 57, 39, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, top + 4);
    ctx.lineTo(VIEW_W, top + 4);
    ctx.stroke();

    for (let band = 0; band < 8; band += 1) {
      const y = top + 22 + band * 19;
      const offset = state.scenery * (0.75 + band * 0.025);
      ctx.strokeStyle = band % 3 === 0 ? "rgba(77, 51, 34, 0.13)" : "rgba(233, 199, 151, 0.085)";
      ctx.lineWidth = band % 3 === 0 ? 1.6 : 1;
      ctx.beginPath();
      for (let x = -40; x <= VIEW_W + 40; x += 26) {
        const px = x - mod(offset, 260);
        const py = y + Math.sin((px + band * 40) * 0.013) * 2.2;
        if (x === -40) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#5c3c28";
    ctx.lineWidth = 5;
    [36, 92].forEach((offsetY) => {
      ctx.beginPath();
      for (let x = -30; x <= VIEW_W + 30; x += 30) {
        const px = x - mod(state.scenery * 0.96, 300);
        const py = top + offsetY + Math.sin(px * 0.01) * 1.4;
        if (x === -30) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
    ctx.restore();

    groundMarks.forEach((mark) => {
      let x = mark.x - mod(state.scenery, 1600);
      if (x < -40) x += 1600;
      if (x > VIEW_W + 40) return;
      ctx.save();
      ctx.translate(x, mark.y);
      ctx.rotate(mark.rot);
      if (mark.type === "pebble") {
        ctx.fillStyle = `rgba(80, 53, 36, ${mark.alpha})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, mark.size * 1.7, mark.size, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(231, 197, 150, ${mark.alpha * 0.55})`;
        ctx.beginPath();
        ctx.ellipse(-mark.size * 0.4, -mark.size * 0.45, mark.size * 0.7, mark.size * 0.3, 0, 0, TAU);
        ctx.fill();
      } else if (mark.type === "crack") {
        ctx.strokeStyle = `rgba(77, 49, 32, ${mark.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(mark.length * 0.4, -2);
        ctx.lineTo(mark.length * 0.7, 2);
        ctx.lineTo(mark.length, 0);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(129, 76, 51, ${mark.alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(mark.length * 0.55, -mark.size);
        ctx.lineTo(mark.length, 2);
        ctx.lineTo(mark.length * 0.32, mark.size);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });

    const baseShade = ctx.createLinearGradient(0, 650, 0, VIEW_H);
    baseShade.addColorStop(0, "rgba(62, 40, 27, 0)");
    baseShade.addColorStop(1, "rgba(49, 31, 21, 0.34)");
    ctx.fillStyle = baseShade;
    ctx.fillRect(0, 650, VIEW_W, VIEW_H - 650);
  }

  function drawForeground() {
    const offset = state.scenery * 1.17;
    ctx.save();
    foregroundGrass.forEach((grass) => {
      let x = grass.x - mod(offset, 1600);
      if (x < -60) x += 1600;
      if (x > VIEW_W + 60) return;
      const sway = Math.sin(state.time * 1.4 + grass.phase) * 4 + grass.lean * 9;
      ctx.strokeStyle = `rgba(63, 41, 27, ${grass.alpha})`;
      ctx.lineWidth = grass.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, grass.y);
      ctx.quadraticCurveTo(x + sway * 0.5, grass.y - grass.height * 0.55, x + sway, grass.y - grass.height);
      ctx.stroke();
      if (grass.height > 54) {
        ctx.strokeStyle = `rgba(83, 54, 34, ${grass.alpha * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(x, grass.y);
        ctx.quadraticCurveTo(x - sway * 0.2, grass.y - grass.height * 0.45, x - sway * 0.8, grass.y - grass.height * 0.82);
        ctx.stroke();
      }
    });
    ambientMotes.forEach((mote) => {
      const x = mod(mote.x - state.scenery * mote.speed * 0.2, VIEW_W + 80) - 40;
      const y = mote.y + Math.sin(state.time * 0.55 + mote.phase) * 14;
      ctx.fillStyle = `rgba(232, 206, 164, ${mote.alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, mote.r, 0, TAU);
      ctx.fill();
    });
    const shade = ctx.createLinearGradient(0, 678, 0, VIEW_H);
    shade.addColorStop(0, "rgba(61, 39, 25, 0)");
    shade.addColorStop(1, "rgba(53, 33, 20, 0.34)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 678, VIEW_W, VIEW_H - 678);
    ctx.restore();
  }


  /* —————————————————————————————
     画：秦骑兵与陶马
  ————————————————————————————— */

  const CLAY = {
    far: "#8d5c3e",
    farLight: "#a46f4d",
    near: "#c89165",
    light: "#e0ae7c",
    highlight: "#efc18d",
    deep: "#805034",
    shadow: "#673f29",
    line: "#5c3a26",
    hoof: "#513729",
    mane: "#59402d",
    maneLight: "#76563a",
    bridle: "#6f7e68",
    bridleLight: "#98a58e",
    bronze: "#b08a4d",
    bronzeLight: "#d8b878",
    saddle: "#8f362b",
    saddleDark: "#65231d",
    gold: "#cda75f",
    armor: "#6b7160",
    armorLight: "#8b917a",
    armorDark: "#4f5546",
    skin: "#c28d61",
    boot: "#5c4532",
  };

  const HORSE_CRACKS = [
    [
      [-78, -192],
      [-68, -180],
      [-74, -167],
      [-60, -157],
      [-65, -146],
    ],
    [
      [64, -198],
      [53, -185],
      [60, -173],
      [48, -163],
    ],
    [
      [113, -277],
      [123, -289],
      [120, -299],
      [129, -306],
    ],
  ];

  function drawLeg(g, hip, knee, hoof, opts) {
    g.save();
    g.globalAlpha *= opts.alpha == null ? 1 : opts.alpha;
    g.lineCap = "round";
    g.lineJoin = "round";

    g.strokeStyle = opts.color;
    g.lineWidth = opts.topWidth;
    g.beginPath();
    g.moveTo(hip.x, hip.y);
    g.lineTo(knee.x, knee.y);
    g.stroke();

    g.lineWidth = opts.bottomWidth;
    g.beginPath();
    g.moveTo(knee.x, knee.y);
    g.quadraticCurveTo(
      (knee.x + hoof.x) / 2 + (opts.bend || 0),
      (knee.y + hoof.y) / 2,
      hoof.x,
      hoof.y
    );
    g.stroke();

    // 关节
    g.fillStyle = opts.jointColor || CLAY.deep;
    g.beginPath();
    g.arc(knee.x, knee.y, opts.bottomWidth * 0.52, 0, TAU);
    g.fill();

    // 陶土高光
    g.strokeStyle = "rgba(245, 211, 169, 0.28)";
    g.lineWidth = Math.max(1, opts.topWidth * 0.14);
    g.beginPath();
    g.moveTo(hip.x - opts.topWidth * 0.22, hip.y + 5);
    g.quadraticCurveTo(knee.x - opts.bottomWidth * 0.3, hip.y + (knee.y - hip.y) * 0.6, knee.x - opts.bottomWidth * 0.28, knee.y - 2);
    g.stroke();

    // 球节
    const fetlockX = lerp(knee.x, hoof.x, 0.7);
    const fetlockY = lerp(knee.y, hoof.y, 0.7);
    g.fillStyle = opts.color;
    g.beginPath();
    g.arc(fetlockX, fetlockY, opts.bottomWidth * 0.48, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(86, 56, 36, 0.45)";
    g.lineWidth = Math.max(1, opts.bottomWidth * 0.1);
    g.beginPath();
    g.arc(fetlockX, fetlockY, opts.bottomWidth * 0.46, 0.2, Math.PI * 0.95);
    g.stroke();

    // 蹄
    const angle = Math.atan2(hoof.y - knee.y, hoof.x - knee.x);
    g.translate(hoof.x, hoof.y);
    g.rotate(angle - Math.PI / 2);
    g.fillStyle = opts.hoofColor || CLAY.hoof;
    g.beginPath();
    g.ellipse(4, 1.5, opts.hoofWidth || 11, opts.hoofHeight || 6, 0, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(225, 188, 145, 0.24)";
    g.beginPath();
    g.ellipse(5.5, -2.3, 4.6, 1.5, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawHorseTail(g, phase, airborne) {
    const sway = Math.sin(phase * 0.55 + 1.1) * (airborne ? 3 : 9);
    g.save();
    g.lineCap = "round";
    g.lineJoin = "round";
    // 尾根与蓬松的尾身
    g.fillStyle = CLAY.mane;
    g.beginPath();
    g.moveTo(-97, -186);
    g.bezierCurveTo(-134, -209, -168, -195, -194, -160 + sway);
    g.bezierCurveTo(-178, -170, -154, -170, -130, -158);
    g.quadraticCurveTo(-107, -165, -97, -186);
    g.closePath();
    g.fill();
    g.fillStyle = CLAY.maneLight;
    g.beginPath();
    g.moveTo(-108, -180);
    g.bezierCurveTo(-142, -194, -170, -184, -188, -158 + sway);
    g.bezierCurveTo(-164, -166, -139, -167, -119, -158);
    g.closePath();
    g.fill();
    // 一缕缕尾毛
    g.strokeStyle = "rgba(58, 39, 26, 0.72)";
    g.lineWidth = 2.2;
    for (let i = 0; i < 6; i += 1) {
      const droop = i * 4.2;
      g.beginPath();
      g.moveTo(-104 - i * 2, -181 + i * 2);
      g.bezierCurveTo(-134 - i * 4, -194 + i * 3, -166 - i * 4, -178 + i * 2, -190 - i * 2, -153 + sway + droop);
      g.stroke();
    }
    g.strokeStyle = "rgba(238, 201, 152, 0.18)";
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(-115, -184);
    g.bezierCurveTo(-144, -196, -171, -183, -193, -159 + sway);
    g.stroke();
    g.restore();
  }

  function drawSpear(g) {
    g.save();
    g.lineCap = "round";
    // 木杆
    const shaftGradient = g.createLinearGradient(-190, -440, 35, -190);
    shaftGradient.addColorStop(0, "#6b4b32");
    shaftGradient.addColorStop(0.5, "#523822");
    shaftGradient.addColorStop(1, "#3f2b1b");
    g.strokeStyle = shaftGradient;
    g.lineWidth = 5.5;
    g.beginPath();
    g.moveTo(-187, -438);
    g.lineTo(30, -191);
    g.stroke();

    // 杆上缠绳
    g.strokeStyle = "rgba(177, 138, 82, 0.45)";
    g.lineWidth = 1.4;
    for (let i = 0; i < 6; i += 1) {
      const t = 0.28 + i * 0.045;
      const x = lerp(-187, 30, t);
      const y = lerp(-438, -191, t);
      g.beginPath();
      g.moveTo(x - 4, y - 2);
      g.lineTo(x + 4, y + 2);
      g.stroke();
    }

    // 青铜戈头
    g.save();
    g.translate(-187, -438);
    g.rotate(Math.atan2(247, -217));
    g.fillStyle = CLAY.bronze;
    g.beginPath();
    g.moveTo(-2, -6);
    g.quadraticCurveTo(17, -5, 35, 0);
    g.quadraticCurveTo(17, 5, -2, 6);
    g.closePath();
    g.fill();
    g.fillStyle = CLAY.bronzeLight;
    g.beginPath();
    g.moveTo(-1, -3);
    g.quadraticCurveTo(15, -2, 29, 0);
    g.quadraticCurveTo(13, 1, -1, 1);
    g.closePath();
    g.fill();
    g.fillStyle = CLAY.bronze;
    g.beginPath();
    g.moveTo(1, -2);
    g.lineTo(21, -26);
    g.lineTo(25, -24);
    g.lineTo(11, 2);
    g.closePath();
    g.fill();
    g.restore();

    // 朱缨
    g.strokeStyle = "rgba(143, 50, 36, 0.9)";
    g.lineWidth = 2.4;
    for (let i = 0; i < 4; i += 1) {
      g.beginPath();
      g.moveTo(-182 + i * 2, -428);
      g.quadraticCurveTo(-196 + i * 3, -402, -189 + i * 5, -383 + i * 3);
      g.stroke();
    }
    g.restore();
  }

  function drawHorseBody(g, dash) {
    g.save();
    const bodyGradient = g.createLinearGradient(0, -238, 0, -82);
    bodyGradient.addColorStop(0, CLAY.light);
    bodyGradient.addColorStop(0.34, CLAY.near);
    bodyGradient.addColorStop(0.72, CLAY.far);
    bodyGradient.addColorStop(1, CLAY.deep);

    g.beginPath();
    g.moveTo(-123, -146);
    g.bezierCurveTo(-130, -184, -111, -218, -73, -228);
    g.bezierCurveTo(-33, -238, 36, -234, 79, -211);
    g.bezierCurveTo(105, -197, 119, -172, 113, -146);
    g.bezierCurveTo(108, -119, 88, -99, 51, -91);
    g.bezierCurveTo(9, -82, -48, -85, -86, -104);
    g.bezierCurveTo(-110, -116, -124, -130, -123, -146);
    g.closePath();
    if (dash) {
      g.save();
      g.shadowColor = "rgba(245, 204, 117, 0.75)";
      g.shadowBlur = 24;
      g.fillStyle = bodyGradient;
      g.fill();
      g.restore();
    }
    g.fillStyle = bodyGradient;
    g.fill();
    g.strokeStyle = "rgba(91, 57, 37, 0.52)";
    g.lineWidth = 1.5;
    g.stroke();

    // 肌理：肩、臀、腹
    g.save();
    g.clip();
    const shoulder = g.createRadialGradient(72, -159, 6, 72, -159, 58);
    shoulder.addColorStop(0, "rgba(247, 205, 157, 0.4)");
    shoulder.addColorStop(1, "rgba(247, 205, 157, 0)");
    g.fillStyle = shoulder;
    g.fillRect(0, -240, 160, 170);

    const haunch = g.createRadialGradient(-77, -165, 5, -77, -165, 64);
    haunch.addColorStop(0, "rgba(235, 179, 128, 0.32)");
    haunch.addColorStop(1, "rgba(235, 179, 128, 0)");
    g.fillStyle = haunch;
    g.fillRect(-150, -240, 170, 170);

    g.fillStyle = "rgba(91, 55, 35, 0.24)";
    g.beginPath();
    g.ellipse(2, -101, 78, 20, -0.04, 0, TAU);
    g.fill();

    // 肩胛与后腿根部的转折
    g.strokeStyle = "rgba(102, 62, 39, 0.28)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(86, -200);
    g.bezierCurveTo(72, -176, 74, -150, 88, -126);
    g.stroke();
    g.strokeStyle = "rgba(246, 207, 161, 0.22)";
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(-88, -202);
    g.bezierCurveTo(-104, -178, -106, -150, -95, -125);
    g.stroke();

    // 细碎陶土斑点
    const rng = mulberry32(542);
    for (let i = 0; i < 26; i += 1) {
      const x = -100 + rng() * 190;
      const y = -218 + rng() * 120;
      g.fillStyle = `rgba(102, 66, 45, ${0.035 + rng() * 0.08})`;
      g.beginPath();
      g.arc(x, y, 0.7 + rng() * 1.9, 0, TAU);
      g.fill();
    }

    // 裂纹
    g.strokeStyle = "rgba(101, 64, 43, 0.48)";
    g.lineWidth = 1.25;
    HORSE_CRACKS.forEach((points, index) => {
      g.beginPath();
      points.forEach(([x, y], i) => {
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x + (index % 2 ? 1 : -1), y);
      });
      g.stroke();
    });
    g.restore();

    // 背脊亮边
    g.strokeStyle = "rgba(247, 212, 167, 0.24)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-82, -222);
    g.bezierCurveTo(-34, -235, 48, -228, 84, -198);
    g.stroke();

    // 胸带
    g.strokeStyle = "rgba(104, 119, 99, 0.8)";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(76, -207);
    g.quadraticCurveTo(93, -177, 90, -144);
    g.stroke();
    g.strokeStyle = "rgba(214, 181, 113, 0.7)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(78, -205);
    g.quadraticCurveTo(95, -176, 91, -145);
    g.stroke();
    g.restore();
  }

  function drawHorseNeckAndHead(g, phase) {
    g.save();
    const neckGradient = g.createLinearGradient(60, -300, 120, -160);
    neckGradient.addColorStop(0, CLAY.light);
    neckGradient.addColorStop(0.55, CLAY.near);
    neckGradient.addColorStop(1, CLAY.deep);

    g.beginPath();
    g.moveTo(48, -205);
    g.bezierCurveTo(56, -253, 81, -290, 117, -304);
    g.lineTo(149, -294);
    g.bezierCurveTo(133, -270, 120, -232, 104, -177);
    g.lineTo(78, -160);
    g.closePath();
    g.fillStyle = neckGradient;
    g.fill();
    g.strokeStyle = "rgba(91, 57, 37, 0.45)";
    g.lineWidth = 1.4;
    g.stroke();

    // 颈部暗面
    g.strokeStyle = "rgba(110, 70, 46, 0.3)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(96, -178);
    g.bezierCurveTo(112, -225, 125, -266, 144, -294);
    g.stroke();

    // 鬃毛
    g.save();
    g.strokeStyle = CLAY.mane;
    g.lineCap = "round";
    for (let i = 0; i < 10; i += 1) {
      const t = i / 9;
      const x = lerp(62, 140, t);
      const y = lerp(-242, -318, t);
      const sway = Math.sin(phase * 0.7 + i * 0.8) * 1.8;
      g.lineWidth = 5.5 - t * 1.6;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x - 8 + sway, y - 2, x - 13 + sway, y + 12 + i * 0.8);
      g.stroke();
    }
    g.restore();

    // 头
    const headGradient = g.createLinearGradient(136, -345, 224, -268);
    headGradient.addColorStop(0, CLAY.light);
    headGradient.addColorStop(0.55, CLAY.near);
    headGradient.addColorStop(1, CLAY.deep);
    g.beginPath();
    g.moveTo(134, -314);
    g.bezierCurveTo(139, -342, 163, -352, 187, -337);
    g.bezierCurveTo(206, -326, 217, -311, 224, -293);
    g.lineTo(225, -278);
    g.bezierCurveTo(217, -266, 202, -262, 190, -269);
    g.bezierCurveTo(172, -278, 157, -289, 142, -299);
    g.closePath();
    g.fillStyle = headGradient;
    g.fill();
    g.strokeStyle = "rgba(91, 57, 37, 0.46)";
    g.lineWidth = 1.4;
    g.stroke();

    // 耳朵
    g.fillStyle = CLAY.deep;
    g.beginPath();
    g.moveTo(142, -330);
    g.quadraticCurveTo(137, -346, 141, -357);
    g.quadraticCurveTo(152, -348, 156, -333);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(161, -335);
    g.quadraticCurveTo(162, -351, 169, -359);
    g.quadraticCurveTo(176, -348, 174, -336);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(230, 178, 132, 0.42)";
    g.beginPath();
    g.ellipse(145.5, -341, 3.1, 7, -0.18, 0, TAU);
    g.fill();

    // 颌线、颧骨与口鼻体积
    g.strokeStyle = "rgba(111, 69, 46, 0.36)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(154, -294);
    g.bezierCurveTo(169, -281, 186, -272, 202, -270);
    g.stroke();
    g.strokeStyle = "rgba(242, 200, 152, 0.28)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(171, -329);
    g.bezierCurveTo(187, -320, 199, -307, 209, -292);
    g.stroke();
    g.fillStyle = "rgba(242, 199, 151, 0.22)";
    g.beginPath();
    g.ellipse(176, -303, 8, 12, -0.6, 0, TAU);
    g.fill();

    // 额发
    g.strokeStyle = CLAY.mane;
    g.lineWidth = 4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(154, -339);
    g.quadraticCurveTo(162, -325, 169, -314);
    g.stroke();
    g.beginPath();
    g.moveTo(158, -343);
    g.quadraticCurveTo(172, -327, 181, -317);
    g.stroke();

    // 眼、鼻、口
    g.fillStyle = "#3c2b20";
    g.beginPath();
    g.ellipse(181, -316, 3.2, 2.2, -0.15, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(255, 238, 202, 0.65)";
    g.beginPath();
    g.arc(182, -317, 0.9, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(97, 60, 40, 0.6)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(174, -322);
    g.quadraticCurveTo(181, -326, 188, -321);
    g.stroke();
    g.fillStyle = "rgba(74, 45, 30, 0.72)";
    g.beginPath();
    g.ellipse(216, -282, 2.7, 1.7, 0.3, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(87, 52, 34, 0.72)";
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(211, -269);
    g.quadraticCurveTo(220, -267, 225, -274);
    g.stroke();

    // 面部裂纹
    g.strokeStyle = "rgba(106, 65, 44, 0.45)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(194, -331);
    g.lineTo(200, -321);
    g.lineTo(196, -313);
    g.stroke();

    // 青铜辔头
    g.strokeStyle = CLAY.bridle;
    g.lineWidth = 3.2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(158, -329);
    g.quadraticCurveTo(190, -310, 208, -292);
    g.stroke();
    g.beginPath();
    g.moveTo(203, -292);
    g.quadraticCurveTo(216, -284, 224, -278);
    g.stroke();
    g.strokeStyle = CLAY.bridleLight;
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(160, -331);
    g.quadraticCurveTo(190, -312, 208, -294);
    g.stroke();
    g.fillStyle = CLAY.bronze;
    g.beginPath();
    g.arc(197, -305, 3, 0, TAU);
    g.fill();
    g.fillStyle = CLAY.bronzeLight;
    g.beginPath();
    g.arc(196.2, -306, 1.1, 0, TAU);
    g.fill();

    // 朱红小缨
    g.strokeStyle = "rgba(143, 50, 36, 0.8)";
    g.lineWidth = 1.8;
    for (let i = 0; i < 3; i += 1) {
      g.beginPath();
      g.moveTo(209 + i * 2, -291);
      g.quadraticCurveTo(215 + i * 3, -278, 208 + i * 3, -267 + i * 2);
      g.stroke();
    }
    g.restore();
  }

  function drawSaddle(g) {
    g.save();
    const blanket = g.createLinearGradient(0, -232, 0, -145);
    blanket.addColorStop(0, "#a84535");
    blanket.addColorStop(0.55, CLAY.saddle);
    blanket.addColorStop(1, CLAY.saddleDark);
    g.beginPath();
    g.moveTo(-61, -226);
    g.lineTo(54, -228);
    g.quadraticCurveTo(67, -214, 58, -189);
    g.lineTo(45, -157);
    g.quadraticCurveTo(12, -145, -12, -157);
    g.lineTo(-41, -178);
    g.quadraticCurveTo(-64, -201, -61, -226);
    g.closePath();
    g.fillStyle = blanket;
    g.fill();

    // 织纹
    g.save();
    g.clip();
    g.strokeStyle = "rgba(226, 179, 104, 0.3)";
    g.lineWidth = 1.2;
    for (let i = 0; i < 5; i += 1) {
      const x = -44 + i * 20;
      g.beginPath();
      g.moveTo(x, -230);
      g.lineTo(x + 15, -148);
      g.stroke();
    }
    g.fillStyle = "rgba(220, 172, 98, 0.24)";
    for (let i = 0; i < 4; i += 1) {
      const x = -35 + i * 20;
      const y = -193 + (i % 2) * 7;
      g.beginPath();
      g.moveTo(x, y - 4);
      g.lineTo(x + 5, y);
      g.lineTo(x, y + 4);
      g.lineTo(x - 5, y);
      g.closePath();
      g.fill();
    }
    g.restore();

    // 金边
    g.strokeStyle = "rgba(225, 184, 105, 0.68)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-55, -223);
    g.lineTo(49, -225);
    g.quadraticCurveTo(59, -212, 53, -192);
    g.stroke();

    // 鞍座
    g.fillStyle = "#4c3524";
    g.beginPath();
    g.moveTo(-37, -231);
    g.quadraticCurveTo(-10, -243, 28, -235);
    g.quadraticCurveTo(36, -227, 28, -219);
    g.lineTo(-25, -216);
    g.quadraticCurveTo(-37, -220, -37, -231);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(217, 176, 101, 0.44)";
    g.lineWidth = 1;
    g.stroke();

    // 流苏与铜铃
    g.strokeStyle = "rgba(213, 167, 91, 0.7)";
    g.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
      g.beginPath();
      g.moveTo(38 + i * 2, -157);
      g.lineTo(41 + i * 2, -146 + (i % 2) * 3);
      g.stroke();
    }
    g.fillStyle = CLAY.bronze;
    g.beginPath();
    g.arc(46, -143, 3.2, 0, TAU);
    g.fill();

    // 马镫
    g.strokeStyle = "rgba(104, 82, 47, 0.85)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(22, -202);
    g.quadraticCurveTo(25, -176, 30, -158);
    g.stroke();
    g.strokeStyle = CLAY.bronze;
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(33, -151, 8, 10, 0.2, 0, TAU);
    g.stroke();
    g.restore();
  }

  function drawRider(g) {
    g.save();

    // 颈后朱色披巾，逆风扬起
    const flutter = Math.sin(state.time * 6.8) * 5 + Math.sin(state.time * 3.3) * 2;
    g.fillStyle = "rgba(139, 46, 34, 0.94)";
    g.beginPath();
    g.moveTo(3, -300);
    g.bezierCurveTo(-20, -311, -42, -324 + flutter, -68, -306 + flutter * 0.8);
    g.bezierCurveTo(-50, -299, -28, -290, -1, -290);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(104, 33, 25, 0.55)";
    g.beginPath();
    g.moveTo(-11, -303);
    g.bezierCurveTo(-30, -311, -44, -315 + flutter, -61, -307 + flutter * 0.8);
    g.bezierCurveTo(-42, -304, -26, -298, -8, -295);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(211, 163, 82, 0.4)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-5, -304);
    g.bezierCurveTo(-25, -313, -43, -321 + flutter, -64, -306 + flutter * 0.8);
    g.stroke();

    // 远侧腿
    g.strokeStyle = "#825437";
    g.lineCap = "round";
    g.lineWidth = 13;
    g.beginPath();
    g.moveTo(-10, -229);
    g.quadraticCurveTo(-26, -208, -22, -188);
    g.stroke();
    g.strokeStyle = "#6f4a31";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(-22, -188);
    g.lineTo(-5, -157);
    g.stroke();
    g.fillStyle = "#4f3928";
    g.beginPath();
    g.ellipse(-2, -153, 9, 5, 0.15, 0, TAU);
    g.fill();

    // 远侧手臂（执长戈）
    g.strokeStyle = CLAY.armorDark;
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(-23, -281);
    g.quadraticCurveTo(-39, -289, -48, -279);
    g.stroke();
    g.fillStyle = "#aa7953";
    g.beginPath();
    g.arc(-50, -278, 4.8, 0, TAU);
    g.fill();

    // 躯干甲胄
    const armorGradient = g.createLinearGradient(-30, -310, 40, -218);
    armorGradient.addColorStop(0, CLAY.armorLight);
    armorGradient.addColorStop(0.45, CLAY.armor);
    armorGradient.addColorStop(1, CLAY.armorDark);
    g.beginPath();
    g.moveTo(-32, -292);
    g.quadraticCurveTo(-24, -307, 8, -306);
    g.quadraticCurveTo(37, -302, 44, -280);
    g.lineTo(36, -228);
    g.quadraticCurveTo(13, -214, -16, -221);
    g.quadraticCurveTo(-35, -244, -35, -270);
    g.closePath();
    g.fillStyle = armorGradient;
    g.fill();
    g.strokeStyle = "rgba(49, 51, 41, 0.78)";
    g.lineWidth = 1.4;
    g.stroke();

    // 甲片
    g.save();
    g.clip();
    g.strokeStyle = "rgba(209, 178, 119, 0.34)";
    g.lineWidth = 0.9;
    for (let row = 0; row < 4; row += 1) {
      const y = -288 + row * 14;
      g.beginPath();
      g.moveTo(-32, y);
      g.quadraticCurveTo(4, y + 4, 40, y - 2);
      g.stroke();
      const count = 5;
      for (let col = 0; col < count; col += 1) {
        const x = -24 + col * 13;
        g.beginPath();
        g.moveTo(x, y - 10);
        g.lineTo(x, y + 4);
        g.stroke();
      }
    }
    // 胸前系带
    g.strokeStyle = "rgba(161, 64, 45, 0.65)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(24, -293);
    g.quadraticCurveTo(30, -265, 21, -222);
    g.stroke();
    g.restore();

    // 肩甲
    g.fillStyle = CLAY.armor;
    g.beginPath();
    g.ellipse(34, -284, 14, 10, 0.18, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(216, 182, 118, 0.48)";
    g.lineWidth = 1.1;
    g.beginPath();
    g.arc(34, -284, 11, Math.PI * 0.2, Math.PI * 1.2);
    g.stroke();
    g.fillStyle = CLAY.armorDark;
    g.beginPath();
    g.ellipse(-28, -280, 11, 8, -0.2, 0, TAU);
    g.fill();

    // 围颈朱巾
    g.fillStyle = "rgba(139, 45, 33, 0.9)";
    g.beginPath();
    g.moveTo(-5, -305);
    g.quadraticCurveTo(15, -312, 28, -300);
    g.quadraticCurveTo(13, -294, -3, -297);
    g.closePath();
    g.fill();

    // 脖颈
    g.fillStyle = CLAY.skin;
    g.fillRect(4, -322, 12, 18);

    // 头部
    const faceGradient = g.createLinearGradient(0, -350, 36, -312);
    faceGradient.addColorStop(0, "#d4a276");
    faceGradient.addColorStop(1, "#b37e55");
    g.fillStyle = faceGradient;
    g.beginPath();
    g.ellipse(17, -335, 15, 17, 0.05, 0, TAU);
    g.fill();
    // 下颌与鼻梁
    g.beginPath();
    g.moveTo(24, -349);
    g.quadraticCurveTo(36, -342, 34, -330);
    g.quadraticCurveTo(35, -322, 29, -320);
    g.quadraticCurveTo(23, -316, 18, -321);
    g.lineTo(14, -330);
    g.closePath();
    g.fill();

    // 头盔
    const helmet = g.createLinearGradient(1, -358, 31, -330);
    helmet.addColorStop(0, "#5b5d4c");
    helmet.addColorStop(1, "#3e4136");
    g.fillStyle = helmet;
    g.beginPath();
    g.moveTo(-1, -338);
    g.quadraticCurveTo(1, -357, 16, -360);
    g.quadraticCurveTo(32, -359, 34, -337);
    g.quadraticCurveTo(20, -345, -1, -338);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(200, 165, 103, 0.65)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-1, -338);
    g.quadraticCurveTo(17, -345, 34, -337);
    g.stroke();
    // 盔顶小髻
    g.fillStyle = "#444638";
    g.beginPath();
    g.ellipse(14, -365, 6, 7, -0.2, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(190, 155, 96, 0.55)";
    g.lineWidth = 1.1;
    g.beginPath();
    g.arc(14, -365, 5, 0, Math.PI, true);
    g.stroke();

    // 五官
    g.strokeStyle = "#5b3b28";
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(20, -341);
    g.quadraticCurveTo(25, -343, 29, -340);
    g.stroke();
    g.fillStyle = "#3a271b";
    g.beginPath();
    g.ellipse(26, -337, 1.7, 1.2, 0.1, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(255, 235, 202, 0.7)";
    g.beginPath();
    g.arc(26.4, -337.4, 0.5, 0, TAU);
    g.fill();
    g.strokeStyle = "#6f4a33";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(30, -329);
    g.quadraticCurveTo(33, -327, 33, -325);
    g.stroke();
    g.beginPath();
    g.moveTo(23, -318);
    g.quadraticCurveTo(27, -319, 30, -322);
    g.stroke();
    // 八字须
    g.strokeStyle = "rgba(76, 49, 33, 0.9)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(23, -323);
    g.quadraticCurveTo(20, -319, 16, -318);
    g.moveTo(27, -323);
    g.quadraticCurveTo(29, -319, 31, -317);
    g.stroke();
    // 耳
    g.fillStyle = "#aa7751";
    g.beginPath();
    g.ellipse(6, -335, 3, 4.3, -0.2, 0, TAU);
    g.fill();

    // 近侧腿
    g.strokeStyle = "#a87550";
    g.lineWidth = 15;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(7, -230);
    g.quadraticCurveTo(34, -216, 41, -196);
    g.stroke();
    g.strokeStyle = "#8a5c3d";
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(41, -196);
    g.lineTo(26, -161);
    g.stroke();
    // 护膝
    g.fillStyle = "rgba(78, 82, 64, 0.94)";
    g.beginPath();
    g.arc(40, -197, 7, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(203, 170, 105, 0.5)";
    g.lineWidth = 1;
    g.stroke();
    // 靴
    g.fillStyle = CLAY.boot;
    g.beginPath();
    g.moveTo(19, -166);
    g.quadraticCurveTo(33, -166, 34, -156);
    g.quadraticCurveTo(33, -148, 19, -149);
    g.quadraticCurveTo(14, -156, 19, -166);
    g.closePath();
    g.fill();

    // 近侧手臂，收缰
    g.strokeStyle = CLAY.armor;
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(35, -283);
    g.quadraticCurveTo(52, -267, 65, -255);
    g.stroke();
    g.strokeStyle = "rgba(198, 164, 102, 0.45)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(37, -285);
    g.quadraticCurveTo(53, -269, 66, -257);
    g.stroke();
    // 护腕
    g.fillStyle = CLAY.bronze;
    g.beginPath();
    g.ellipse(66, -254, 4.6, 5.5, 0.4, 0, TAU);
    g.fill();
    // 手
    g.fillStyle = CLAY.skin;
    g.beginPath();
    g.arc(73, -249, 5.2, 0, TAU);
    g.fill();
    g.strokeStyle = "#8e5d3d";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(72, -251);
    g.lineTo(78, -246);
    g.stroke();

    // 缰绳
    g.strokeStyle = "rgba(83, 54, 36, 0.9)";
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(77, -249);
    g.quadraticCurveTo(138, -242, 216, -280);
    g.stroke();
    g.strokeStyle = "rgba(162, 123, 74, 0.5)";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(79, -251);
    g.quadraticCurveTo(138, -244, 215, -282);
    g.stroke();
    g.fillStyle = CLAY.bronze;
    g.beginPath();
    g.arc(214, -281, 2.4, 0, TAU);
    g.fill();

    g.restore();
  }

  function drawHorseLegs(g, phase, airborne, near) {
    const color = near ? CLAY.near : CLAY.far;
    const hoofColor = near ? CLAY.hoof : "#442f22";
    const alpha = near ? 1 : 0.97;
    const configs = near
      ? [
          { front: false, phaseOffset: Math.PI, hipX: -66, hipY: -138, top: 22, bottom: 14, bend: -6 },
          { front: true, phaseOffset: 0, hipX: 73, hipY: -142, top: 21, bottom: 13, bend: 5 },
        ]
      : [
          { front: false, phaseOffset: Math.PI + 0.55, hipX: -88, hipY: -137, top: 16, bottom: 10.5, bend: -4 },
          { front: true, phaseOffset: 0.6, hipX: 50, hipY: -140, top: 15, bottom: 9.5, bend: 4 },
        ];

    configs.forEach((cfg) => {
      if (airborne) {
        let kneeX;
        let kneeY;
        let hoofX;
        let hoofY;
        if (cfg.front) {
          kneeX = cfg.hipX + 29;
          kneeY = cfg.hipY + 41;
          hoofX = kneeX + 11;
          hoofY = kneeY + 44;
        } else {
          kneeX = cfg.hipX - 32;
          kneeY = cfg.hipY + 43;
          hoofX = kneeX - 27;
          hoofY = kneeY + 34;
        }
        drawLeg(
          g,
          { x: cfg.hipX, y: cfg.hipY },
          { x: kneeX, y: kneeY },
          { x: hoofX, y: hoofY },
          {
            color,
            topWidth: cfg.top,
            bottomWidth: cfg.bottom,
            bend: cfg.bend,
            alpha,
            hoofColor,
            hoofWidth: cfg.front ? 12 : 11,
            hoofHeight: 6.5,
          }
        );
      } else {
        const p = phase + cfg.phaseOffset;
        const swing = Math.sin(p);
        const lift = Math.pow(Math.max(0, Math.cos(p)), 1.5);
        const kneeX = cfg.hipX + (cfg.front ? 18 : -15) + swing * 14;
        const kneeY = cfg.hipY + 61 - lift * 16;
        const hoofX = kneeX + (cfg.front ? 20 : -14) + swing * 21;
        const hoofY = -Math.max(0, lift) * 36;
        drawLeg(
          g,
          { x: cfg.hipX, y: cfg.hipY },
          { x: kneeX, y: kneeY },
          { x: hoofX, y: hoofY },
          {
            color,
            topWidth: cfg.top,
            bottomWidth: cfg.bottom,
            bend: cfg.bend,
            alpha,
            hoofColor,
            hoofWidth: cfg.front ? 12 : 11,
            hoofHeight: 6.5,
          }
        );
      }
    });
  }

  function drawDashAura(g, x, baseY) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const glow = ctx.createRadialGradient(x - 20, baseY - 160, 10, x - 20, baseY - 160, 240);
    glow.addColorStop(0, "rgba(255, 230, 163, 0.34)");
    glow.addColorStop(0.5, "rgba(232, 183, 94, 0.19)");
    glow.addColorStop(1, "rgba(228, 176, 90, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 300, baseY - 420, 600, 490);

    // 近地的破阵光轮
    const pulse = 1 + Math.sin(state.time * 5) * 0.035;
    ctx.save();
    ctx.translate(x - 10, baseY - 8);
    ctx.scale(pulse, 1);
    ctx.strokeStyle = "rgba(244, 207, 128, 0.48)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 142, 18, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 235, 181, 0.18)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(0, -2, 162, 24, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // 金色速度线
    for (let i = 0; i < 11; i += 1) {
      const y = baseY - 54 - i * 29 + Math.sin(state.time * 4 + i) * 8;
      const len = 90 + (i % 4) * 55;
      const startX = x - 125 - (i % 3) * 30;
      ctx.strokeStyle = `rgba(246, 209, 132, ${0.14 + (i % 3) * 0.06})`;
      ctx.lineWidth = 1.4 + (i % 2) * 1.2;
      ctx.beginPath();
      ctx.moveTo(startX - len, y);
      ctx.quadraticCurveTo(startX - len * 0.4, y - 2, startX, y);
      ctx.stroke();
    }

    // 旋转的破阵符纹
    ctx.translate(x - 18, baseY - 168);
    ctx.rotate(state.time * 0.5);
    ctx.strokeStyle = "rgba(233, 192, 108, 0.26)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * TAU;
      const px = Math.cos(angle) * 145;
      const py = Math.sin(angle) * 100;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawHorseRider(g, x, baseY, options = {}) {
    const phase = options.phase || 0;
    const airborne = Boolean(options.airborne);
    const vy = options.vy || 0;
    const dash = Boolean(options.dash);
    const alpha = options.alpha == null ? 1 : options.alpha;
    const isMenu = Boolean(options.menu);

    // 地面投影
    const height = GROUND - baseY;
    const shadowScale = clamp(1 - height / 520, 0.55, 1);
    g.save();
    g.globalAlpha = 0.2 * alpha * shadowScale;
    g.fillStyle = "#3d291c";
    g.beginPath();
    g.ellipse(x + 4, GROUND + 8, 118 * shadowScale, 13 * shadowScale, 0, 0, TAU);
    g.fill();
    g.restore();

    if (dash) drawDashAura(g, x, baseY);

    g.save();
    g.translate(x, baseY);
    const rotation = airborne ? clamp(-vy * 0.00017, -0.095, 0.115) : Math.sin(phase * 0.5) * 0.012;
    g.rotate(rotation);
    const bob = airborne ? 0 : Math.sin(phase * 2) * 4;
    g.translate(0, bob);
    g.globalAlpha = alpha;

    drawSpear(g);

    // 远侧腿
    drawHorseLegs(g, phase, airborne, false);

    drawHorseTail(g, phase, airborne);
    drawHorseBody(g, dash);

    // 近侧双腿（压在身体之上，鞍鞯再覆于腿根）
    drawHorseLegs(g, phase, airborne, true);
    drawHorseNeckAndHead(g, phase);
    drawSaddle(g);
    drawRider(g);

    // 陶马眼部高光、鼻息
    if (!isMenu) {
      g.save();
      g.globalAlpha = 0.28;
      g.strokeStyle = "rgba(246, 220, 181, 0.65)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(232, -282);
      g.quadraticCurveTo(242, -290, 246, -302);
      g.stroke();
      g.restore();
    }

    g.restore();
  }

  /* —————————————————————————————
     画：障碍、铜铃与虎符
  ————————————————————————————— */

  function drawHazard(g, entity) {
    const x = entity.x;
    const base = GROUND;

    // 阴影
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = "#3c291c";
    g.beginPath();
    g.ellipse(x + entity.width / 2, base + 8, entity.width * 0.62, 9, 0, 0, TAU);
    g.fill();
    g.restore();

    if (entity.type === "stone") {
      g.save();
      g.translate(x + entity.width / 2, base - 2);
      g.rotate(-0.07);
      const stone = g.createLinearGradient(-34, -62, 32, 0);
      stone.addColorStop(0, "#b09778");
      stone.addColorStop(0.48, "#8c7258");
      stone.addColorStop(1, "#624a37");
      g.fillStyle = stone;
      g.beginPath();
      g.moveTo(-35, 0);
      g.lineTo(-32, -42);
      g.lineTo(-24, -53);
      g.lineTo(-20, -50);
      g.lineTo(-12, -62);
      g.lineTo(1, -55);
      g.lineTo(9, -60);
      g.lineTo(17, -49);
      g.lineTo(28, -44);
      g.quadraticCurveTo(34, -37, 33, -28);
      g.lineTo(31, 0);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(56, 39, 27, 0.5)";
      g.lineWidth = 1.5;
      g.stroke();

      // 断口与裂纹
      g.strokeStyle = "rgba(62, 43, 30, 0.7)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-14, -59);
      g.lineTo(-6, -42);
      g.lineTo(-13, -31);
      g.lineTo(-6, -19);
      g.moveTo(9, -54);
      g.lineTo(16, -37);
      g.lineTo(10, -24);
      g.stroke();
      // 模糊刻痕
      g.strokeStyle = "rgba(55, 37, 25, 0.42)";
      g.lineWidth = 1.3;
      for (let i = 0; i < 3; i += 1) {
        g.beginPath();
        g.moveTo(-18 + i * 5, -25 + i * 6);
        g.lineTo(12 + i * 4, -27 + i * 5);
        g.stroke();
      }
      // 顶部受光
      g.strokeStyle = "rgba(241, 214, 171, 0.4)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-26, -47);
      g.lineTo(-13, -57);
      g.lineTo(3, -51);
      g.stroke();
      // 草
      g.strokeStyle = "rgba(68, 46, 29, 0.72)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-32, 0);
      g.quadraticCurveTo(-39, -13, -31, -22);
      g.moveTo(29, 0);
      g.quadraticCurveTo(37, -11, 31, -19);
      g.moveTo(22, 0);
      g.quadraticCurveTo(26, -8, 21, -13);
      g.stroke();
      g.restore();
    } else if (entity.type === "halberd") {
      g.save();
      g.translate(x + entity.width / 2, base - 1);
      // 木架
      g.strokeStyle = "#6a4630";
      g.lineWidth = 4;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-32, 0);
      g.lineTo(22, -78);
      g.moveTo(32, 0);
      g.lineTo(-23, -70);
      g.moveTo(2, 0);
      g.lineTo(3, -94);
      g.stroke();
      g.strokeStyle = "rgba(222, 186, 132, 0.2)";
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(-31, 0);
      g.lineTo(21, -76);
      g.moveTo(2, 0);
      g.lineTo(3, -92);
      g.stroke();
      // 青铜戟头
      function halberdHead(px, py, angle) {
        g.save();
        g.translate(px, py);
        g.rotate(angle);
        g.fillStyle = CLAY.bronze;
        g.beginPath();
        g.moveTo(0, -5);
        g.quadraticCurveTo(12, -5, 22, 0);
        g.quadraticCurveTo(12, 5, 0, 5);
        g.closePath();
        g.fill();
        g.fillStyle = CLAY.bronzeLight;
        g.beginPath();
        g.moveTo(1, -2);
        g.lineTo(16, 0);
        g.lineTo(1, 1);
        g.closePath();
        g.fill();
        g.fillStyle = CLAY.bronze;
        g.beginPath();
        g.moveTo(2, -1);
        g.lineTo(-5, -15);
        g.lineTo(-1, -16);
        g.lineTo(8, -2);
        g.closePath();
        g.fill();
        g.restore();
      }
      halberdHead(21, -78, -0.3);
      halberdHead(-22, -70, -0.2);
      halberdHead(3, -94, 0.04);
      // 红缨
      g.strokeStyle = "rgba(147, 54, 38, 0.8)";
      g.lineWidth = 2;
      for (let i = 0; i < 3; i += 1) {
        g.beginPath();
        g.moveTo(21 + i, -75);
        g.quadraticCurveTo(30 + i * 2, -66, 24 + i * 3, -58 + i * 2);
        g.stroke();
      }
      // 底部泥土
      g.fillStyle = "rgba(103, 77, 53, 0.32)";
      g.beginPath();
      g.ellipse(0, 2, 42, 6, 0, 0, TAU);
      g.fill();
      g.restore();
    } else if (entity.type === "pit") {
      g.save();
      g.translate(x, base);
      const pitGradient = g.createLinearGradient(0, 0, 0, 55);
      pitGradient.addColorStop(0, "#3d2a1d");
      pitGradient.addColorStop(0.5, "#4b3322");
      pitGradient.addColorStop(1, "#301f15");

      // 外沿
      g.fillStyle = "rgba(223, 187, 140, 0.3)";
      g.beginPath();
      g.moveTo(-2, 3);
      g.lineTo(6, -6);
      g.lineTo(23, -2);
      g.lineTo(31, 4);
      g.lineTo(52, 1);
      g.lineTo(64, 6);
      g.lineTo(84, 0);
      g.lineTo(98, 5);
      g.lineTo(113, 0);
      g.lineTo(126, 6);
      g.lineTo(118, 13);
      g.lineTo(8, 14);
      g.closePath();
      g.fill();

      // 陷坑内部
      g.beginPath();
      g.moveTo(4, 5);
      g.lineTo(15, -5);
      g.lineTo(29, 2);
      g.lineTo(40, -1);
      g.lineTo(55, 5);
      g.lineTo(69, 1);
      g.lineTo(82, 6);
      g.lineTo(96, 2);
      g.lineTo(112, 7);
      g.lineTo(120, 12);
      g.lineTo(105, 30);
      g.lineTo(90, 26);
      g.lineTo(72, 34);
      g.lineTo(57, 27);
      g.lineTo(38, 33);
      g.lineTo(22, 25);
      g.lineTo(8, 27);
      g.closePath();
      g.fillStyle = pitGradient;
      g.fill();

      // 内部碎陶与暗影
      g.fillStyle = "rgba(21, 13, 9, 0.45)";
      g.beginPath();
      g.ellipse(64, 25, 44, 8, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(136, 84, 54, 0.65)";
      g.beginPath();
      g.moveTo(35, 16);
      g.lineTo(46, 12);
      g.lineTo(51, 19);
      g.lineTo(40, 22);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(83, 9);
      g.lineTo(94, 13);
      g.lineTo(89, 21);
      g.lineTo(80, 17);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(231, 195, 145, 0.3)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(15, 1);
      g.lineTo(31, 5);
      g.lineTo(43, 1);
      g.stroke();
      g.restore();
    }
  }

  function drawBell(g, entity) {
    const bob = Math.sin(state.time * 3.4 + entity.seed) * 4;
    const pulse = 1 + Math.sin(state.time * 4.6 + entity.seed) * 0.05;
    const x = entity.x;
    const y = entity.y + bob;
    g.save();
    g.translate(x, y);
    g.scale(pulse, pulse);

    // 光晕
    const glow = g.createRadialGradient(0, 0, 3, 0, 0, 28);
    glow.addColorStop(0, "rgba(247, 219, 156, 0.4)");
    glow.addColorStop(0.55, "rgba(232, 190, 112, 0.12)");
    glow.addColorStop(1, "rgba(232, 190, 112, 0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, 28, 0, TAU);
    g.fill();

    // 挂环
    g.strokeStyle = CLAY.bronzeLight;
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(0, -12, 4.2, 0, TAU);
    g.stroke();

    // 铃身
    const body = g.createLinearGradient(-9, -9, 9, 12);
    body.addColorStop(0, "#f2d99f");
    body.addColorStop(0.45, "#c79a55");
    body.addColorStop(1, "#7d5a2d");
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-5, -8);
    g.lineTo(5, -8);
    g.quadraticCurveTo(10, 0, 9, 7);
    g.quadraticCurveTo(0, 11, -9, 7);
    g.quadraticCurveTo(-10, 0, -5, -8);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(255, 235, 180, 0.46)";
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = "rgba(81, 55, 26, 0.72)";
    g.beginPath();
    g.arc(0, 9, 1.8, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(255, 242, 198, 0.62)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-4, -5);
    g.quadraticCurveTo(-7, 1, -5, 6);
    g.stroke();
    // 小铃舌
    g.strokeStyle = "rgba(96, 63, 31, 0.7)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, 8);
    g.lineTo(2, 13);
    g.stroke();
    g.restore();
  }

  function drawTally(g, entity) {
    const bob = Math.sin(state.time * 2.8 + entity.seed) * 5;
    const x = entity.x;
    const y = entity.y + bob;
    g.save();
    g.translate(x, y);
    const glow = g.createRadialGradient(0, 0, 4, 0, 0, 52);
    glow.addColorStop(0, "rgba(250, 222, 151, 0.5)");
    glow.addColorStop(0.5, "rgba(229, 186, 99, 0.17)");
    glow.addColorStop(1, "rgba(229, 186, 99, 0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, 52, 0, TAU);
    g.fill();

    // 旋转的光刺
    g.save();
    g.rotate(state.time * 0.45 + entity.seed);
    g.strokeStyle = "rgba(238, 205, 135, 0.28)";
    g.lineWidth = 1.2;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * TAU;
      const inner = i % 2 ? 26 : 31;
      const outer = i % 2 ? 43 : 48;
      g.beginPath();
      g.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      g.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      g.stroke();
    }
    g.restore();

    g.rotate(Math.sin(state.time * 1.4 + entity.seed) * 0.04);
    // 铜牌
    const plaque = g.createLinearGradient(-15, -24, 15, 26);
    plaque.addColorStop(0, "#e2c484");
    plaque.addColorStop(0.45, "#b58a49");
    plaque.addColorStop(1, "#77572b");
    g.fillStyle = plaque;
    roundRect(g, -16, -23, 32, 46, 5);
    g.fill();
    g.strokeStyle = "rgba(255, 237, 188, 0.55)";
    g.lineWidth = 1.2;
    g.stroke();
    g.strokeStyle = "rgba(93, 62, 30, 0.55)";
    g.lineWidth = 1;
    roundRect(g, -12, -19, 24, 38, 3);
    g.stroke();

    // 挂环
    g.strokeStyle = CLAY.bronzeLight;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, -27, 4, 0, TAU);
    g.stroke();

    // “虎”字
    g.fillStyle = "rgba(59, 41, 21, 0.9)";
    g.font = 'bold 20px "KaiTi", "STKaiti", serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("虎", 0, 1);

    // 朱色小印
    g.fillStyle = "rgba(147, 53, 38, 0.88)";
    g.fillRect(7, 13, 5, 5);
    g.restore();
  }

  /* —————————————————————————————
     画：粒子与浮字
  ————————————————————————————— */

  function drawParticles(frontPass) {
    particles.forEach((p) => {
      const isFront = p.kind === "spark" || p.kind === "shard";
      if (isFront !== frontPass) return;
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha * (p.kind === "dust" ? 0.9 : 1);
      if (p.kind === "dust") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      } else if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.stroke();
      } else if (p.kind === "spark") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || alpha * 2);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.55, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.55, 0);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === "shard") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.size, -p.size * 0.4);
        ctx.lineTo(p.size * 0.8, -p.size * 0.8);
        ctx.lineTo(p.size, p.size * 0.5);
        ctx.lineTo(-p.size * 0.4, p.size);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawFloatTexts() {
    floatTexts.forEach((text) => {
      const alpha = clamp(text.life / text.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `600 ${text.size}px "KaiTi", "STKaiti", "Songti SC", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = text.color;
      ctx.shadowColor = "rgba(42, 25, 11, 0.55)";
      ctx.shadowBlur = 6;
      ctx.fillText(text.text, text.x, text.y);
      ctx.restore();
    });
  }

  /* —————————————————————————————
     渲染主流程
  ————————————————————————————— */

  function render() {
    const dpr = canvas.width / Math.max(1, canvas.clientWidth);
    const scaleX = canvas.width / VIEW_W;
    const scaleY = canvas.height / VIEW_H;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    // 天空不动，让运动集中在地面与军阵上
    ctx.drawImage(skyLayer, 0, 0);

    ctx.save();
    if (state.shake > 0.4) {
      const shakeX = rand(-state.shake, state.shake);
      const shakeY = rand(-state.shake * 0.55, state.shake * 0.55);
      ctx.translate(shakeX, shakeY);
    }

    drawClouds();
    drawMountains();
    drawGround();

    // 地面上的物件
    entities.forEach((entity) => {
      if (entity.kind === "hazard") drawHazard(ctx, entity);
    });
    entities.forEach((entity) => {
      if (entity.kind === "bell") drawBell(ctx, entity);
      else if (entity.kind === "tally") drawTally(ctx, entity);
    });

    drawParticles(false);

    const playerX = state.mode === "menu" ? MENU_X : PLAYER_X;
    const baseY = GROUND - (state.mode === "menu" ? 0 : state.jumpY);
    let alpha = 1;
    if (state.mode === "playing" && state.invuln > 0) {
      alpha = 0.78 + Math.sin(state.time * 34) * 0.16;
    }
    drawHorseRider(ctx, playerX, baseY, {
      phase: state.phase,
      airborne: state.mode !== "menu" && !state.onGround,
      vy: state.vy,
      dash: state.mode !== "menu" && state.dashTime > 0,
      alpha: clamp(alpha, 0.35, 1),
      menu: state.mode === "menu",
    });

    drawParticles(true);
    drawFloatTexts();
    drawForeground();

    ctx.restore();

    // 受击红晕
    if (state.flash > 0) {
      const flash = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 150, VIEW_W / 2, VIEW_H / 2, 720);
      flash.addColorStop(0, "rgba(127, 43, 28, 0)");
      flash.addColorStop(0.65, `rgba(129, 44, 28, ${state.flash * 0.27})`);
      flash.addColorStop(1, `rgba(77, 24, 15, ${state.flash * 0.6})`);
      ctx.fillStyle = flash;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // 画面上下的空气感
    const bottomFade = ctx.createLinearGradient(0, VIEW_H - 70, 0, VIEW_H);
    bottomFade.addColorStop(0, "rgba(26, 16, 9, 0)");
    bottomFade.addColorStop(1, "rgba(20, 12, 7, 0.24)");
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, VIEW_H - 70, VIEW_W, 70);
  }

  /* —————————————————————————————
     菜单待机
  ————————————————————————————— */

  function updateMenu(dt) {
    state.time += dt;
    state.phase += dt * 12.2;
    state.scenery += 92 * dt;
    updateParticles(dt);
  }

  /* —————————————————————————————
     输入与状态切换
  ————————————————————————————— */

  function canJumpNow() {
    return state.mode === "playing";
  }

  function handleJumpPress(event) {
    if (event) event.preventDefault();
    if (!canJumpNow()) return;
    state.jumpHeld = true;
    requestJump();
  }

  function handleJumpRelease() {
    state.jumpHeld = false;
  }

  function onKeyDown(event) {
    const code = event.code;
    if (code === "KeyM") {
      event.preventDefault();
      toggleSound();
      return;
    }

    if (code === "KeyP" || code === "Escape") {
      if (state.mode === "playing") {
        event.preventDefault();
        pauseGame();
        return;
      }
      if (state.mode === "paused") {
        event.preventDefault();
        resumeGame();
        return;
      }
      if (code === "Escape" && state.mode === "over") {
        event.preventDefault();
        returnToMenu();
        return;
      }
    }

    if (event.repeat) return;

    if (state.mode === "menu") {
      if (code === "Space" || code === "Enter" || code === "NumpadEnter") {
        event.preventDefault();
        startGame();
      }
      return;
    }

    if (state.mode === "over") {
      if (code === "Space" || code === "Enter" || code === "NumpadEnter" || code === "KeyR") {
        event.preventDefault();
        startGame();
      }
      return;
    }

    if (state.mode !== "playing") return;

    if (code === "Space" || code === "ArrowUp" || code === "KeyW") {
      event.preventDefault();
      handleJumpPress();
    }
  }

  function onKeyUp(event) {
    const code = event.code;
    if (code === "Space" || code === "ArrowUp" || code === "KeyW") {
      handleJumpRelease();
    }
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => {
    state.jumpHeld = false;
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.mode === "playing") {
      pauseGame();
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state.mode !== "playing") return;
    event.preventDefault();
    if (event.pointerType === "mouse" && event.button !== 0) return;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture 不是所有环境都支持 */
    }
    handleJumpPress();
  });
  canvas.addEventListener("pointerup", handleJumpRelease);
  canvas.addEventListener("pointercancel", handleJumpRelease);
  window.addEventListener("pointerup", handleJumpRelease);

  ui.startBtn.addEventListener("click", startGame);
  ui.restartBtn.addEventListener("click", startGame);
  ui.resumeBtn.addEventListener("click", resumeGame);
  ui.pauseBtn.addEventListener("click", () => {
    if (state.mode === "playing") pauseGame();
  });
  ui.pauseMenuBtn.addEventListener("click", returnToMenu);
  ui.overMenuBtn.addEventListener("click", returnToMenu);
  ui.soundBtn.addEventListener("click", toggleSound);

  if (ui.jumpBtn) {
    ui.jumpBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleJumpPress();
    });
    ui.jumpBtn.addEventListener("pointerup", handleJumpRelease);
    ui.jumpBtn.addEventListener("pointercancel", handleJumpRelease);
  }

  /* —————————————————————————————
     启动主循环
  ————————————————————————————— */

  let lastFrame = performance.now();

  function frame(now) {
    const dt = clamp((now - lastFrame) / 1000, 0, 1 / 30);
    lastFrame = now;

    if (state.mode === "menu") {
      updateMenu(dt);
    } else if (state.mode === "playing") {
      updatePlaying(dt);
    } else if (state.mode === "paused") {
      // 暂停时连风也停住
    } else if (state.mode === "over") {
      updateParticles(dt);
    }

    render();
    requestAnimationFrame(frame);
  }

  function init() {
    resizeCanvas();
    updateSoundButton();
    updateBestLabels();
    setStateMode("menu");
    stage.dataset.state = "menu";
    // 让菜单中的陶马一开始就处于奔跑姿态
    state.phase = 3.2;
    state.scenery = 240;
    updateHud(true);
    requestAnimationFrame(frame);
  }

  init();
})();
