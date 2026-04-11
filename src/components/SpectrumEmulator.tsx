'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

export default function SpectrumEmulator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [emuReady, setEmuReady] = useState(false);
  const emuInstance = useRef<any>(null);

  const initEmulator = () => {
    if (typeof window !== 'undefined' && (window as any).JSSpeccy && containerRef.current && !emuInstance.current) {
      console.log("Initializing JSSpeccy...");
      const isMobile = window.innerWidth <= 800;
      emuInstance.current = (window as any).JSSpeccy(containerRef.current, {
        zoom: isMobile ? 1 : 3,
        machine: 48,
        openUrl: '/games/FlightSimulation.tap',
        tapeTrapsEnabled: true,
        autoLoadTapes: true,
        autoStart: true,
        uiEnabled: false,
      });
      setEmuReady(true);
    }
  };

  useEffect(() => {
    const handleReset = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '0') {
        // Full hard reset by reloading the client window (clears memory, audio context, and sensors)
        window.location.reload();
      }
    };
    document.addEventListener('keydown', handleReset);
    return () => document.removeEventListener('keydown', handleReset);
  }, []);

  // Global Key Forwarder: Forces designated game keys to always go to the emulator
  // even if the user hasn't actively clicked/focused the JSSpeccy canvas!
  useEffect(() => {
    const forwardKey = (e: KeyboardEvent) => {
      const host = document.getElementById('jsspeccy');
      if (!host) return;
      
      const emulatorTarget = (host.querySelector('canvas') || host.querySelector('.appContainer') || host) as HTMLElement;

      // Skip forwarding if JSSpeccy is already currently focused properly
      if (document.activeElement === host || document.activeElement === emulatorTarget) {
        return;
      }

      // Keys defined in the app panel UI + basic ZX spectrum inputs
      const allowedKeys = ['1', '2', '3', 'y', 'n', 'z', 'x', 'p', 'o', 'f', 'd', 'g', 'b', 'm', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
      
      if (allowedKeys.includes(e.key.toLowerCase())) {
        e.preventDefault(); // Prevents page scrolling when tapping arrows
        
        // Clone the exact keystroke into the emulator's internal listener!
        const ev = new KeyboardEvent(e.type, {
          key: e.key,
          code: e.code,
          keyCode: e.keyCode,
          which: e.which,
          bubbles: true,
          cancelable: true,
          composed: true
        });

        // Hard-set legacy properties required by WASM/SDL emulators
        Object.defineProperties(ev, {
          keyCode: { value: e.keyCode },
          which: { value: e.which },
          charCode: { value: 0 }
        });

        emulatorTarget.dispatchEvent(ev);
      }
    };

    // Use capturing phase so we intercept before other component handlers do
    window.addEventListener('keydown', forwardKey, { capture: true });
    window.addEventListener('keyup', forwardKey, { capture: true });
    
    return () => {
      window.removeEventListener('keydown', forwardKey, { capture: true });
      window.removeEventListener('keyup', forwardKey, { capture: true });
    };
  }, []);

  return (
    <div className="player-wrapper glass-panel">
      <Script
        src="/jsspeccy/jsspeccy.js"
        strategy="afterInteractive"
        onLoad={initEmulator}
      />
      <div className="jsspeccy-crop-window">
        <div id="jsspeccy" ref={containerRef} className="jsspeccy-inner"></div>
        {!emuReady && <p style={{ color: 'var(--zx-cyan)', position: 'absolute' }}>Loading Simulator...</p>}
      </div>
    </div>
  );
}
