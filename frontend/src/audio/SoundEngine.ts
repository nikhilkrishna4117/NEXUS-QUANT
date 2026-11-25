// Web Audio API Procedural Sound Engine
// 100% synthesized - zero external audio assets required

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false; // Enabled by default on first user interaction
  private ambientGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Automatically hook window interactions to unlock Web Audio on first gesture
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.initContext();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().then(() => {
            if (!this.isMuted) {
              this.startAmbient();
            }
          });
        }
      };

      window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
      window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
      window.addEventListener('click', unlockAudio, { once: true, passive: true });
    }
  }

  public initContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.isInitialized = true;
      }
    } catch (e) {
      console.warn('Web Audio API not supported on this device');
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isMuted = !this.isMuted;

    if (!this.isMuted) {
      this.startAmbient();
      // Play instant pleasant confirmation chord so user immediately hears that audio is ON
      this.playConfirmationChime();
    } else {
      this.stopAmbient();
    }

    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    if (this.isMuted === muted) return;
    this.toggleMute();
  }

  // 1. Ambient Glacial Drone & Ethereal Sub-Pad
  public startAmbient() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      if (this.ambientOsc1) {
        return; // Already running
      }

      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc2 = this.ctx.createOscillator();
      this.ambientFilter = this.ctx.createBiquadFilter();
      this.ambientGain = this.ctx.createGain();

      this.ambientOsc1.type = 'sine';
      this.ambientOsc1.frequency.setValueAtTime(55, this.ctx.currentTime); // 55Hz (A1 sub drone)

      this.ambientOsc2.type = 'triangle';
      this.ambientOsc2.frequency.setValueAtTime(110.2, this.ctx.currentTime); // Slight detuned harmonic

      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
      this.ambientFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      this.ambientGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      this.ambientGain.gain.exponentialRampToValueAtTime(0.12, this.ctx.currentTime + 2.0);

      this.ambientOsc1.connect(this.ambientFilter);
      this.ambientOsc2.connect(this.ambientFilter);
      this.ambientFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);

      this.ambientOsc1.start();
      this.ambientOsc2.start();
    } catch (e) {
      // Audio policy catch
    }
  }

  public stopAmbient() {
    if (!this.ctx || !this.ambientGain) return;
    try {
      this.ambientGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.6);
      setTimeout(() => {
        try {
          this.ambientOsc1?.stop();
          this.ambientOsc2?.stop();
          this.ambientOsc1?.disconnect();
          this.ambientOsc2?.disconnect();
          this.ambientOsc1 = null;
          this.ambientOsc2 = null;
        } catch {}
      }, 700);
    } catch {}
  }

  // Modulate ambient filter cutoff based on 3D camera depth
  public updateAmbientDepth(depthFraction: number) {
    if (!this.ctx || !this.ambientFilter || this.isMuted) return;
    const targetFreq = 160 + depthFraction * 400;
    this.ambientFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
  }

  // Confirmation Chime when Sound is Turned ON
  public playConfirmationChime() {
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);

        gain.gain.setValueAtTime(0.0001, now + i * 0.06);
        gain.gain.linearRampToValueAtTime(0.18, now + i * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.55);
      });
    } catch {}
  }

  // 2. Scroll Velocity Air Whoosh
  public playScrollWhoosh(velocity: number) {
    this.initContext();
    if (!this.ctx || this.isMuted || Math.abs(velocity) < 0.2) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(90 + Math.min(Math.abs(velocity) * 100, 220), now);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400 + Math.min(Math.abs(velocity) * 250, 750), now);
      filter.Q.setValueAtTime(2.0, now);

      const intensity = Math.min(Math.abs(velocity) * 0.06, 0.16);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(intensity, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.32);
    } catch {}
  }

  // 3. Crisp Crystalline Glass Hover Tick (Audible & Punchy)
  public playHoverTick() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2600 + Math.random() * 300, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {}
  }

  // 4. Mechanical Character Decode Tick (For Scramble Text)
  public playScrambleTick() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(950 + Math.random() * 250, now);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }

  // 5. Deep Cinematic 808 Sub-Drop (Module Click / Transition)
  public playSubDrop() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.7);

      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.9);
    } catch {}
  }

  // 6. Cryogenic Frost-Lock Sweep (Guardrail Trigger)
  public playFrostLock() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.55);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(5.0, now);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    } catch {}
  }

  // 7. Granular Harmonic Particle Chime with Spatial Stereo Panning
  public playParticleChime(freqMult = 1.0, pan = 0.0) {
    this.initContext();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const notes = [587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
      const baseFreq = notes[Math.floor(Math.random() * notes.length)] * freqMult;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(this.ctx.destination);
      }

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  // Convenient Aliases
  public playTick() {
    this.playHoverTick();
  }

  public playChime() {
    this.playConfirmationChime();
  }
}

export const soundEngine = new ProceduralSoundEngine();
