export interface PitchResult {
  freq: number | null;
  confidence: number;
}

interface YinResult {
  freq: number | null;
  confidence: number;
}

export class Yin {
  constructor(
    private readonly frameSize: number,
    private readonly sampleRate: number,
    private readonly threshold = 0.15
  ) {}

  getPitch(input: Float32Array): PitchResult {
    if (input.length < this.frameSize) {
      // Still run on whatever we have in a smaller window.
      const resized = new Float32Array(this.frameSize);
      resized.set(input.slice(0, this.frameSize), 0);
      return this.computePitch(resized);
    }
    return this.computePitch(input);
  }

  private computePitch(input: Float32Array): PitchResult {
    const result = yin(input, this.sampleRate, this.threshold);
    return result;
  }
}

function differenceFunction(input: Float32Array, tauMax: number): Float32Array {
  const size = input.length;
  const half = size / 2;
  const tauLimit = Math.min(tauMax, half - 1);
  const d = new Float32Array(tauLimit + 1);

  for (let tau = 1; tau <= tauLimit; tau++) {
    let sum = 0;
    for (let j = 0; j < half; j++) {
      const delta = input[j] - input[j + tau];
      sum += delta * delta;
    }
    d[tau] = sum / half;
  }
  return d;
}

function cumulativeMeanNormalized(d: Float32Array): Float32Array {
  const size = d.length;
  const cmndf = new Float32Array(size);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < size; tau++) {
    runningSum += d[tau];
    cmndf[tau] = runningSum === 0 ? 1 : (d[tau] * tau) / runningSum;
  }
  return cmndf;
}

function parabolicInterpolation(array: Float32Array, x: number): { x: number; y: number } {
  const x1 = Math.max(1, x - 1);
  const x2 = x;
  const x3 = Math.min(array.length - 1, x + 1);
  const y1 = array[x1];
  const y2 = array[x2];
  const y3 = array[x3];
  const denom = 2 * (2 * y2 - y1 - y3);
  if (denom === 0) return { x, y: y2 };
  const refined = x2 + (y3 - y1) / denom;
  return { x: refined, y: y2 };
}

export function yin(input: Float32Array, sampleRate: number, threshold = 0.15): YinResult {
  const size = input.length;
  if (size < 512) return { freq: null, confidence: 0 };

  let tauMax = Math.floor(size / 2);
  // Restrict search to a practical vocal range: ~43 Hz .. ~1250 Hz
  const minTau = Math.max(4, Math.floor(sampleRate / 1250));
  const maxTau = Math.min(tauMax, Math.floor(sampleRate / 43));
  if (maxTau <= minTau) return { freq: null, confidence: 0 };
  tauMax = maxTau;

  const d = differenceFunction(input.subarray(0, tauMax * 2), tauMax);
  const cmndf = cumulativeMeanNormalized(d);

  // 1) Absolute threshold: first tau where cmndf falls below threshold
  let tauEstimate = -1;
  for (let tau = minTau; tau <= tauMax; tau++) {
    if (cmndf[tau] < threshold) {
      while (tau + 1 < cmndf.length && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  // 2) If none found, use global minimum
  if (tauEstimate === -1) {
    let minVal = Infinity;
    for (let tau = minTau; tau <= tauMax; tau++) {
      if (cmndf[tau] < minVal) {
        minVal = cmndf[tau];
        tauEstimate = tau;
      }
    }
  }

  if (tauEstimate <= 0) return { freq: null, confidence: 0 };

  const best = parabolicInterpolation(cmndf, tauEstimate);
  const freq = sampleRate / best.x;
  const confidence = Math.max(0, Math.min(1, 1 - best.y));

  if (!isFinite(freq) || freq > 2000 || freq < 40) {
    return { freq: null, confidence: 0 };
  }

  return { freq, confidence };
}

export function computeRMS(input: Float32Array): number {
  if (input.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    sum += input[i] * input[i];
  }
  return Math.sqrt(sum / input.length);
}