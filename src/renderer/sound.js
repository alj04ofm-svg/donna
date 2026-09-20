/* sound.js — four tiny synthesized cues, Web Audio only (zero-latency, no
   asset files). Fired at the visual peak of an animation, never on their own.
   Deliberately quiet — feedback, not fanfare. cfg.sounds === false mutes all
   (Settings toggle); reduced-motion users keep sound (it's not motion). */

const snd = (() => {
  let ctx = null;
  const ac = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  };
  const on = () => (typeof cfg === "undefined" || cfg.sounds !== false);

  /* one enveloped tone: fast attack, exponential decay */
  function tone(freq, at, dur, { type = "sine", gain = 0.05, glideTo = null } = {}) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  return {
    /* task complete — soft two-note tick, up a fifth */
    tick() { if (!on()) return; tone(660, 0, 0.09, { gain: 0.045 }); tone(990, 0.055, 0.12, { gain: 0.04 }); },
    /* habit check-in — warmer major-third chime */
    chime() { if (!on()) return; tone(523.25, 0, 0.16, { type: "triangle", gain: 0.05 }); tone(659.25, 0.07, 0.2, { type: "triangle", gain: 0.045 }); },
    /* milestone / streak — rising three-note motif */
    milestone() { if (!on()) return; tone(523.25, 0, 0.14, { gain: 0.05 }); tone(659.25, 0.09, 0.14, { gain: 0.05 }); tone(783.99, 0.18, 0.24, { gain: 0.055 }); },
    /* capture saved — muted low pop with a downward glide */
    pop() { if (!on()) return; tone(340, 0, 0.08, { type: "sine", gain: 0.05, glideTo: 210 }); },
  };
})();
