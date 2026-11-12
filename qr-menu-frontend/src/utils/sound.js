// Mobile-reliable order confirmation sound synthesis (PCM WAV <audio> + Web Audio fallback)

let sharedAudioCtx = null;
let orderAudioEl = null;
let addOnAudioEl = null;
let playingState = { newOrder: false, addOn: false };

const NEW_ORDER_NOTES = [
  { freq: 587.33, start: 0.0, duration: 0.24 }, // D5
  { freq: 739.99, start: 0.1, duration: 0.26 }, // F#5
  { freq: 880.0, start: 0.2, duration: 0.3 }, // A5
  { freq: 1174.66, start: 0.32, duration: 0.5 }, // D6
];

const ADD_ON_NOTES = [
  { freq: 659.25, start: 0.0, duration: 0.22 }, // E5
  { freq: 880.0, start: 0.11, duration: 0.26 }, // A5
  { freq: 1318.51, start: 0.24, duration: 0.44 }, // E6
];

function buildWavBlobUrl(notes) {
  const sampleRate = 22050;
  const totalSec = Math.max(...notes.map((n) => n.start + n.duration)) + 0.05;
  const numSamples = Math.ceil(totalSec * sampleRate);
  const mix = new Float32Array(numSamples);

  for (const note of notes) {
    const startIdx = Math.floor(note.start * sampleRate);
    const lenSamples = Math.floor(note.duration * sampleRate);
    for (let i = 0; i < lenSamples; i++) {
      const idx = startIdx + i;
      if (idx >= numSamples) break;
      const t = i / sampleRate;
      const attack = Math.min(1, t / 0.008);
      const decay = Math.exp((-5.2 * t) / note.duration);
      const env = attack * decay;
      // Rich bell overtones so small mobile speakers project clearly
      const wave =
        0.72 * Math.sin(2 * Math.PI * note.freq * t) +
        0.22 * Math.sin(2 * Math.PI * note.freq * 2 * t) +
        0.06 * Math.sin(2 * Math.PI * note.freq * 3 * t);
      mix[idx] += wave * env;
    }
  }

  // Normalize safely to 85% peak amplitude
  let maxAmp = 0;
  for (let i = 0; i < numSamples; i++) {
    const abs = Math.abs(mix[i]);
    if (abs > maxAmp) maxAmp = abs;
  }
  const norm = maxAmp > 0 ? 0.85 / maxAmp : 1;

  const dataByteLen = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataByteLen);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataByteLen, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.max(-1, Math.min(1, mix[i] * norm));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function getAudioElement(isAddOn) {
  if (typeof Audio === 'undefined') return null;
  if (isAddOn) {
    if (!addOnAudioEl) {
      addOnAudioEl = new Audio(buildWavBlobUrl(ADD_ON_NOTES));
      addOnAudioEl.preload = 'auto';
      addOnAudioEl.onended = () => {
        playingState.addOn = false;
      };
    }
    return addOnAudioEl;
  }
  if (!orderAudioEl) {
    orderAudioEl = new Audio(buildWavBlobUrl(NEW_ORDER_NOTES));
    orderAudioEl.preload = 'auto';
    orderAudioEl.onended = () => {
      playingState.newOrder = false;
    };
  }
  return orderAudioEl;
}

function getWebAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

// Synchronously unlock both HTML5 Audio and Web Audio inside a user click/tap gesture
export function unlockOrderAudio() {
  try {
    const ctx = getWebAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      // 1-sample silent buffer unlock required by iOS/Android Safari across async calls
      const silentBuf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silentBuf;
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch {
    // Ignore AudioContext unlock error
  }

  try {
    [
      [false, 'newOrder'],
      [true, 'addOn'],
    ].forEach(([isAddOn, key]) => {
      if (playingState[key]) return;
      const el = getAudioElement(isAddOn);
      if (!el || !el.paused) return;
      el.muted = true;
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          if (!playingState[key]) {
            el.pause();
            el.currentTime = 0;
            el.muted = false;
          }
        }).catch(() => {
          el.muted = false;
        });
      } else {
        el.muted = false;
      }
    });
  } catch {
    // Ignore HTMLAudio unlock error
  }
}

async function playWebAudioFallback(isAddOn) {
  try {
    const ctx = getWebAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const notes = isAddOn ? ADD_ON_NOTES : NEW_ORDER_NOTES;
    const now = ctx.currentTime;
    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      overtone.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + start);
      overtone.frequency.setValueAtTime(freq * 2, now + start);

      gainNode.gain.setValueAtTime(0.001, now + start);
      gainNode.gain.linearRampToValueAtTime(0.55, now + start + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.25, now + start);

      osc.connect(gainNode);
      overtone.connect(overtoneGain);
      overtoneGain.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + start);
      overtone.start(now + start);
      osc.stop(now + start + duration + 0.02);
      overtone.stop(now + start + duration + 0.02);
    });
  } catch (err) {
    console.warn('Web Audio order confirmation fallback skipped:', err);
  }
}

// Play loud, crisp confirmation chime when an order is confirmed sent to kitchen
export async function playOrderConfirmationSound(isAddOn = false) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([70, 40, 120]);
    }
  } catch {
    // Ignore vibration errors
  }

  const key = isAddOn ? 'addOn' : 'newOrder';
  playingState[key] = true;

  try {
    const el = getAudioElement(isAddOn);
    if (el) {
      el.muted = false;
      el.volume = 1.0;
      el.currentTime = 0;
      await el.play();
      return;
    }
  } catch (err) {
    console.warn('HTMLAudio chime failed, falling back to Web Audio:', err);
  }

  playingState[key] = false;
  await playWebAudioFallback(isAddOn);
}

