import {
  AudioContext,
  AudioBuffer,
  AudioBufferSourceNode,
  AudioManager,
  AudioRecorder,
  FileDirectory,
  FileFormat,
  FilePreset,
  Result,
  FileInfo,
  GainNode,
} from 'react-native-audio-api';
import { PitchSample } from '../types';
import { Yin, computeRMS } from '../pitch/yin';

const SAMPLE_RATE = 44100;
const FRAME_SIZE = 4096;

export interface RecordedFile {
  path: string | null;
  duration: number;
  pitchTrack: PitchSample[];
}

class AudioEngine {
  private context: AudioContext | null = null;
  private backingSource: AudioBufferSourceNode | null = null;
  private backingGain: GainNode | null = null;
  private coachSource: AudioBufferSourceNode | null = null;
  private fileSource: AudioBufferSourceNode | null = null;
  private recorder: AudioRecorder | null = null;
  private yin: Yin | null = null;
  private yinSampleRate = 0;
  private pitchTrack: PitchSample[] = [];
  private onSamples: ((samples: PitchSample[]) => void) | null = null;

  async init(): Promise<void> {
    const permission = await AudioManager.requestRecordingPermissions();
    if (permission !== 'Granted') {
      throw new Error('Microphone permission is required to record coach vocals.');
    }

    await this.ensureContext();
    if (!this.yin) this.yin = new Yin(FRAME_SIZE, SAMPLE_RATE);
  }

  private async ensureContext(): Promise<void> {
    if (this.context) return;

    AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosOptions: ['defaultToSpeaker'],
    });
    await AudioManager.setAudioSessionActivity(true);

    const sampleRate = AudioManager.getDevicePreferredSampleRate();
    this.context = new AudioContext(sampleRate > 0 ? { sampleRate } : undefined);
  }

  async decode(path: string): Promise<AudioBuffer> {
    await this.ensureContext();
    return this.context!.decodeAudioData(path);
  }

  async probeDuration(path: string): Promise<number> {
    try {
      const buffer = await this.decode(path);
      return buffer.duration;
    } catch {
      return 0;
    }
  }

  /** Play a whole audio file once (used for listening to recordings). */
  async playFile(path: string, onEnded?: () => void): Promise<void> {
    const buffer = await this.decode(path);
    if (!this.context) return;
    this.stopFile();
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.onEnded = () => {
      this.liveSources = this.liveSources.filter((item) => item !== source);
      if (this.fileSource === source) this.fileSource = null;
      onEnded?.();
    };
    this.fileSource = source;
    source.start();
    this.liveSources.push(source);
  }

  private liveSources: AudioBufferSourceNode[] = [];

  stopFile(): void {
    const source = this.fileSource;
    if (!source) return;
    this.fileSource = null;
    source.onEnded = null;
    try {
      source.stop();
    } catch {}
    source.disconnect();
    this.liveSources = this.liveSources.filter((item) => item !== source);
  }

  private clockStart = 0;

  /** Play the backing track starting at the given offset within the file (seconds). */
  async playBacking(path: string, offsetSeconds: number): Promise<void> {
    const buffer = await this.decode(path);
    if (!this.context) return;
    this.stopBacking();
    const source = this.context.createBufferSource({ pitchCorrection: true });
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(this.context.destination);
    source.start(0, offsetSeconds);
    this.backingSource = source;
    this.backingGain = gain;
    this.clockStart = Date.now();
  }

  /** File-playback position in seconds since the last playBacking call. */
  getPlaybackElapsed(): number {
    return (Date.now() - this.clockStart) / 1000;
  }

  stopBacking(): void {
    try {
      this.backingSource?.stop();
    } catch {}
    this.backingSource?.disconnect();
    this.backingSource = null;
    try {
      this.backingGain?.disconnect();
    } catch {}
    this.backingGain = null;
  }

  /** Play a slice of an audio file: from startTime for duration seconds. */
  async playSegment(path: string, startTime: number, duration: number): Promise<void> {
    const buffer = await this.decode(path);
    if (!this.context) return;
    this.stopSegment();
    const safeStart = Math.max(0, Math.min(startTime, buffer.duration));
    const safeDuration = Math.min(duration, buffer.duration - safeStart);
    if (safeDuration <= 0) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.start(0, safeStart, safeDuration);
    this.coachSource = source;
    this.liveSources.push(source);
  }

  stopSegment(): void {
    try {
      this.coachSource?.stop();
    } catch {}
    try {
      this.coachSource?.disconnect();
    } catch {}
    this.coachSource = null;
  }

  async startRecording(
    fileNameOverride: string,
    onSamples?: (samples: PitchSample[]) => void,
    capturePitch = true
  ): Promise<void> {
    await this.init();
    await this.stopRecording();
    this.pitchTrack = [];
    this.onSamples = onSamples ?? null;

    const recorder = new AudioRecorder();
    this.recorder = recorder;
    let elapsedFrames = 0;

    // Capture raw PCM buffers for pitch analysis (always).
    if (capturePitch) {
      recorder.onAudioReady(
        { sampleRate: SAMPLE_RATE, bufferLength: FRAME_SIZE, channelCount: 1 },
        (event) => {
          const rate = event.buffer.sampleRate > 0 ? event.buffer.sampleRate : SAMPLE_RATE;
          if (!this.yin || this.yinSampleRate !== rate) {
            this.yin = new Yin(FRAME_SIZE, rate);
            this.yinSampleRate = rate;
          }
          const data = event.buffer.getChannelData(0);
          const pitch = this.yin.getPitch(data);
          const volume = computeRMS(data);
          const sample: PitchSample = {
            time: Number.isFinite(event.when) ? event.when : elapsedFrames / rate,
            freq: pitch.freq,
            confidence: pitch.confidence,
            volume,
          };
          this.pitchTrack.push(sample);
          this.onSamples?.([sample]);
          elapsedFrames += event.numFrames || data.length;
        }
      );
    }

    recorder.onError((error) => {
      console.warn('Recorder error:', error.message);
    });

    // Also save the vocal to a file so the student can replay it.
    try {
      recorder.enableFileOutput({
        directory: FileDirectory.Document,
        subDirectory: 'vocalcoach/recordings',
        fileNamePrefix: 'take',
        format: FileFormat.M4A,
        preset: FilePreset.High,
        channelCount: 1,
      });
    } catch (e) {
      console.warn('File output disabled:', e);
    }

    const result = await recorder.start({ fileNameOverride });
    if (result.status === 'error') {
      throw new Error(result.message || 'Failed to start recording.');
    }
  }

  async stopRecording(): Promise<RecordedFile> {
    if (!this.recorder) return { path: null, duration: 0, pitchTrack: this.pitchTrack };
    let fileInfo: Result<FileInfo> | null = null;
    try {
      fileInfo = await this.recorder.stop();
    } catch (e) {
      console.warn('recorder stop error', e);
    }
    const path = fileInfo && fileInfo.status === 'success' && fileInfo.paths[0] ? fileInfo.paths[0] : null;
    const duration = fileInfo && fileInfo.status === 'success' ? fileInfo.duration : 0;
    this.recorder.clearOnAudioReady();
    this.recorder.disableFileOutput();
    this.recorder = null;
    const track = this.pitchTrack;
    this.pitchTrack = [];
    return { path, duration, pitchTrack: track };
  }

  async dispose(): Promise<void> {
    this.stopBacking();
    this.stopSegment();
    this.stopFile();
    for (const source of this.liveSources) {
      try {
        source.stop();
      } catch {}
    }
    this.liveSources = [];
    if (this.recorder) {
      try {
        await this.recorder.stop();
      } catch {}
      this.recorder = null;
    }
    if (this.context) {
      try {
        await this.context.close();
      } catch {}
      this.context = null;
    }
  }
}

export const audioEngine = new AudioEngine();
export default audioEngine;
