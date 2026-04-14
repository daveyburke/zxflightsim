'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

export default function SpectrumEmulator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [emuReady, setEmuReady] = useState(false);
  const emuInstance = useRef<any>(null);
  const [scaleConfig, setScaleConfig] = useState({ scale: 1, baseHeight: 576 });
  const [cropConfig, setCropConfig] = useState<{
    marginTop: number;
    marginLeft: number;
    width: string | number;
    height: string | number;
    ready: boolean;
  }>({ marginTop: 0, marginLeft: 0, width: '768px', height: '576px', ready: false });

  const initEmulator = () => {
    if (typeof window !== 'undefined' && (window as any).JSSpeccy && containerRef.current && !emuInstance.current) {
      console.log("Initializing JSSpeccy...");
      // Identify true hardware mobile/foldable displays organically vs just small desktop windows!
      const isTouch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
      const isMobile = window.innerWidth <= 800 || (isTouch && window.innerWidth < 1200);

      if (isMobile) {
        // Calculate the maximum clean native scale factor to fill 100vw!
        // We divide raw innerWidth by 256 (the canvas width) to allow the visual 
        // box to securely span bounds without bursting the 0.5rem (8px x2 = 16px) layout-grid padding CSS.
        const padding = 16;
        // Native High-DPI engine base width is strictly 768px now
        const scale = (window.innerWidth - padding) / 768;
        setScaleConfig({ scale, baseHeight: 576 });
      } else {
        // Shrink the native JSSpeccy desktop footprint by precisely 15% per specific request 
        // to gracefully accommodate smaller laptop screens without overflowing!
        setScaleConfig({ scale: 0.85, baseHeight: 576 });
      }

      emuInstance.current = (window as any).JSSpeccy(containerRef.current, {
        zoom: 3, // Uniform native Hi-DPI resolution
        machine: 48,
        openUrl: '/games/FlightSimulation.tap',
        tapeTrapsEnabled: true,
        autoLoadTapes: true,
        autoStart: true,
        uiEnabled: false,
      });

      // Dynamically measure emulator's actual injected `<canvas>` hardware bounds
      // to calculate exact native borders and organically slice them off!
      let attempts = 0;
      const zoomLevel = 3; // Natively forced Hi-DPI Engine render
      const coreW = 256 * zoomLevel; // 768px
      const coreH = 192 * zoomLevel; // 576px

      const t = setInterval(() => {
        attempts++;
        const canvas = containerRef.current?.querySelector('canvas');
        if (canvas) {
          const cw = canvas.clientWidth;
          const ch = Math.round(canvas.clientHeight);
          if (cw > 0 && ch > 0) {
            // Calculate base border geometry (left/right are strictly symmetrical)
            const borderX = (cw - coreW) / 2;
            const borderY = (ch - coreH) / 2;
            
            // To completely clear the yellow horizon block without guessing CSS pixels,
            // we actively advance the top vertical offset by ~12 native game pixels!
            const yellowCrop = 12 * zoomLevel;

            const finalHeight = coreH - yellowCrop;

            setCropConfig({
              marginTop: -(borderY + yellowCrop),
              marginLeft: -borderX,
              width: coreW,
              height: finalHeight,
              ready: true
            });

            // Re-sync correct scaled grid bounds using the exact height remaining!
            if (isMobile) {
              setScaleConfig({ scale: (window.innerWidth - 16) / 768, baseHeight: finalHeight });
            } else {
              setScaleConfig({ scale: 0.85, baseHeight: finalHeight });
            }

            clearInterval(t);
          }
        }
        if (attempts > 60) clearInterval(t);
      }, 50);

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

  useEffect(() => {
    if (cropConfig.ready) {
      const w = typeof cropConfig.width === 'number' ? cropConfig.width : parseInt(String(cropConfig.width).replace('px', '')) || 768;
      document.documentElement.style.setProperty('--jsspeccy-scaled-width', `${w * scaleConfig.scale}px`);
    }
  }, [cropConfig.width, scaleConfig.scale, cropConfig.ready]);

  useEffect(() => {
    const handleDeviceFlip = () => {
      const w = window.innerWidth;
      const isTouch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
      const isMob = w <= 800 || (isTouch && w < 1200);
      // Re-map constraints securely dynamically ensuring math always balances via 768px hi-dpi vector baseline
      setScaleConfig(prev => ({
        ...prev,
        scale: isMob ? Math.max((w - 16) / 768, 0.2) : 0.85
      }));
    };
    
    window.addEventListener('resize', handleDeviceFlip);
    return () => window.removeEventListener('resize', handleDeviceFlip);
  }, []);

  const currentWidthObj = typeof cropConfig.width === 'number' ? cropConfig.width : parseInt(String(cropConfig.width).replace('px', '')) || 768;
  const scaledWidth = currentWidthObj * scaleConfig.scale;

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', width: scaleConfig.scale !== 1 ? `${scaledWidth}px` : '100%', height: scaleConfig.scale !== 1 ? `${scaleConfig.baseHeight * scaleConfig.scale}px` : 'auto' }}>
      <div 
        className="player-wrapper glass-panel"
        style={{
          flexShrink: 0,
          transform: scaleConfig.scale !== 1 ? `scale(${scaleConfig.scale})` : 'none',
          transformOrigin: 'top left'
        }}
      >
        <Script
          src="/jsspeccy/jsspeccy.js"
          strategy="afterInteractive"
          onLoad={initEmulator}
        />
        <div 
          className="jsspeccy-crop-window"
          style={{
            width: cropConfig.width,
            height: cropConfig.height,
            opacity: cropConfig.ready ? 1 : 0,
            transition: 'opacity 0.2s ease-in'
          }}
        >
          <div 
            id="jsspeccy" 
            ref={containerRef} 
            className="jsspeccy-inner"
            style={cropConfig.ready ? {
              marginTop: cropConfig.marginTop,
              marginLeft: cropConfig.marginLeft
            } : undefined}
          ></div>
          {!emuReady && <p style={{ color: 'var(--zx-cyan)', position: 'absolute' }}>Loading Simulator...</p>}
        </div>
      </div>
    </div>
  );
}
