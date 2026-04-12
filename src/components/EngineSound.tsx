'use client';

import { useEffect, useRef } from 'react';

export default function EngineSound() {
  const audioCtxState = useRef<AudioContext | null>(null);
  const oscillatorState = useRef<OscillatorNode | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Start the engine when 1, 2, or 3 is pressed on the main menu
      if (['1', '2', '3'].includes(e.key) && !audioCtxState.current) {
        startEngineSound();
      }

      // Stop engine on Escape
      if (e.key === 'Escape' && audioCtxState.current) {
        audioCtxState.current.close().catch(console.error);
        audioCtxState.current = null;
        oscillatorState.current = null;
      }

      // If engine is running, allow throttle keys P and O to dynamically shift the pitch!
      if (audioCtxState.current && oscillatorState.current && audioCtxState.current.state === 'running') {
        const osc = oscillatorState.current;
        if (e.key.toLowerCase() === 'p') {
          // Throttle up (pitch up)
          if (osc.frequency.value < 100) {
            osc.frequency.setTargetAtTime(osc.frequency.value + 4, audioCtxState.current.currentTime, 0.1);
          }
        } else if (e.key.toLowerCase() === 'o') {
          // Throttle down (pitch down)
          if (osc.frequency.value > 30) {
            osc.frequency.setTargetAtTime(Math.max(30, osc.frequency.value - 4), audioCtxState.current.currentTime, 0.1);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // WebKit/Chrome requires an explicit, genuine user DOM interaction to unlock the Audio Engine.
    // Since our custom keyboard uses synthetic Event dispatches which strip the 'trusted' execution flag,
    // we attach a global catch-all proxy specifically to force native AudioContext resumption!
    const unlockAudio = () => {
      if (audioCtxState.current && audioCtxState.current.state === 'suspended') {
        audioCtxState.current.resume().catch(console.error);
      }
    };
    document.addEventListener('pointerdown', unlockAudio, { passive: true });
    document.addEventListener('touchstart', unlockAudio, { passive: true });
    document.addEventListener('click', unlockAudio, { passive: true });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (audioCtxState.current && audioCtxState.current.state === 'running') {
          audioCtxState.current.suspend().catch(console.error);
        }
      } else {
        // Only resume if it actually exists; unlockAudio will handle user-gesture requirements if needed
        if (audioCtxState.current && audioCtxState.current.state === 'suspended') {
          audioCtxState.current.resume().catch(console.error);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const startEngineSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxState.current = audioCtx;

      // Master gain to keep it quiet
      const masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.04; // 8-bit sound can be piercing, keeping it low
      masterGain.connect(audioCtx.destination);

      // We'll use a lowpass filter to "muffle" the engine so it sounds like we're in the cockpit
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 350; // Cut off harsh high frequencies
      filter.connect(masterGain);

      // The core engine 8-bit pulse/square wave
      const engineOsc = audioCtx.createOscillator();
      engineOsc.type = 'square';
      engineOsc.frequency.value = 55; // Base low rumble

      // Add a Low Frequency Oscillator (LFO) to create a sputtering/beating effect
      const lfo = audioCtx.createOscillator();
      lfo.type = 'sawtooth';
      lfo.frequency.value = 15; // 15 pulses per second

      // Connect LFO to control the pitch slightly, giving an engine vibration characteristic
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 5; // Modulate by 5Hz
      lfo.connect(lfoGain);
      lfoGain.connect(engineOsc.frequency);

      engineOsc.connect(filter);
      
      // Start the nodes
      lfo.start();
      engineOsc.start();
      
      oscillatorState.current = engineOsc;
    } catch (e) {
      console.warn("Failed to initialize Web Audio Engine Sound", e);
    }
  };

  // Ensure audio is cleaned up on unmount
  useEffect(() => {
    return () => {
      if (audioCtxState.current) {
        audioCtxState.current.close().catch(console.error);
        audioCtxState.current = null;
      }
    };
  }, []);

  return null; // Invisible daemon component
}
