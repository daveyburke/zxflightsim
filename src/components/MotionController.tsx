'use client';

import { useState, useEffect, useRef } from 'react';

export default function MotionController() {
  const [enabled, setEnabled] = useState(false);
  const [needPermission, setNeedPermission] = useState(false);
  const [inMenu, setInMenu] = useState(true);

  const keyStates = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const throttleCache = useRef({
    up: 0,
    down: 0,
    left: 0,
    right: 0
  });

  const dispatchKey = (key: string, type: string) => {
    const keyCode = key === 'ArrowUp' ? 38 : key === 'ArrowDown' ? 40 : key === 'ArrowLeft' ? 37 : 39;
    const event = new KeyboardEvent(type, {
      key,
      code: key,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true
    });

    Object.defineProperties(event, {
      keyCode: { value: keyCode },
      which: { value: keyCode },
      charCode: { value: 0 }
    });

    // Directly dispatch into the JSSpeccy DOM
    const host = document.getElementById('jsspeccy');
    if (host) {
      const emulatorTarget = host.querySelector('canvas') || host.querySelector('.appContainer') || host;
      if (emulatorTarget) {
        emulatorTarget.dispatchEvent(event);
        return;
      }
    }

    // Fallback if shadow root isn't heavily initialized yet
    document.dispatchEvent(event);
  };

  const updateKey = (key: string, shouldBeDown: boolean, force = false) => {
    // If we're blocked strictly sitting in the BASIC 1982 initialization menu,
    // intercept all tilt signals and force them to explicitly evaluate neutrally 
    // to strictly prevent "keyboard matrix ghosting" from erasing modern number inputs
    if (inMenu && !force) {
      shouldBeDown = false;
    }

    const kState = keyStates.current as any;
    const internalKey = key === 'ArrowUp' ? 'up' : key === 'ArrowDown' ? 'down' : key === 'ArrowLeft' ? 'left' : 'right';

    if (shouldBeDown !== kState[internalKey]) {
      const now = Date.now();
      // Enforce strict 1Hz (1000ms) transition ceiling to physically block runaway polling noise
      if (!force && (now - (throttleCache.current as any)[internalKey] < 1000)) return;

      kState[internalKey] = shouldBeDown;
      (throttleCache.current as any)[internalKey] = now;
      dispatchKey(key, shouldBeDown ? 'keydown' : 'keyup');
    }
  };

  // Generic Sensor API handler
  const handleAccelerometer = (x: number, y: number, z: number) => {
    const k = keyStates.current as any;
    // Vertical hold roll (x-axis tracks lateral tilt)
    updateKey('ArrowLeft', !k.left ? x > 3.0 : x > 1.5);
    updateKey('ArrowRight', !k.right ? x < -3.0 : x < -1.5);

    // Vertical hold pitch maps to Z axis!
    updateKey('ArrowUp', !k.up ? z > 1.5 : z > 0.8);
    updateKey('ArrowDown', !k.down ? z < -1.5 : z < -0.8);
  };

  // DeviceOrientation handler
  const handleOrientation = (beta: number | null, gamma: number | null) => {
    if (beta === null || gamma === null) return;
    const k = keyStates.current as any;

    // For vertical portrait hold: Center is beta ~90.
    updateKey('ArrowLeft', !k.left ? gamma < -15 : gamma < -8);
    updateKey('ArrowRight', !k.right ? gamma > 15 : gamma > 8);

    // Increased sensitivity margin: ~10 degrees from neutral center natively
    updateKey('ArrowUp', !k.up ? beta < 80 : beta < 85);
    updateKey('ArrowDown', !k.down ? Math.abs(beta) > 100 : Math.abs(beta) > 95);
  };

  // Setup sensors when active
  useEffect(() => {
    let sensor: any = null;
    let orientHandler: any = null;

    if (!enabled) {
      // Release all keys immediately ignoring throttle limitations
      updateKey('ArrowUp', false, true);
      updateKey('ArrowDown', false, true);
      updateKey('ArrowLeft', false, true);
      updateKey('ArrowRight', false, true);
      return;
    }

    // Track if generic sensor successfully streams data
    let hasAccelerometerData = false;

    // Try Generic Sensor API first
    if (typeof window !== "undefined" && 'Accelerometer' in window) {
      try {
        sensor = new (window as any).Accelerometer({ frequency: 20 });
        sensor.addEventListener('reading', () => {
          hasAccelerometerData = true;
          if (sensor) {
            handleAccelerometer(sensor.x, sensor.y, sensor.z);
          }
        });
        sensor.start();
      } catch (err) {
        console.warn('Generic Sensor API failed', err);
        sensor = null;
      }
    }

    // Always attach DeviceOrientation Event as a fallback
    // Chrome on Mac successfully creates Accelerometer but never emits 'reading' events.
    // By keeping DeviceOrientation attached, Chrome DevTools Sensor emulation works seamlessly on desktop!
    if (typeof window !== "undefined" && window.DeviceOrientationEvent) {
      orientHandler = (e: DeviceOrientationEvent) => {
        // If accelerometer is actively firing, ignore legacy device orientation to prevent double-firing
        if (!hasAccelerometerData && e.beta !== null && e.gamma !== null) {
          handleOrientation(e.beta, e.gamma);
        }
      };
      window.addEventListener('deviceorientation', orientHandler);
    }

    return () => {
      if (sensor) sensor.stop();
      if (orientHandler) window.removeEventListener('deviceorientation', orientHandler);
    };
  }, [enabled, inMenu]);

  // Track the raw keystrokes globally to intuitively guess when the classic ROM boot sequence 
  // explicitly transitions away from the Basic input menus and fully arms the core assembly 3D engine
  useEffect(() => {
    let menuStep = 0;
    const tracker = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      
      if (menuStep === 0 && ['1', '2', '3'].includes(k)) {
        menuStep = 1;
      } else if (menuStep === 1 && ['y', 'n'].includes(k)) {
        setInMenu(false);
      } else if (k === 'escape' || k === '0') {
        // Esc / 0 mathematically restarts the emulator entirely back to its title ROM sequence
        menuStep = 0;
        setInMenu(true);
      }
    };
    
    window.addEventListener('keydown', tracker);
    return () => window.removeEventListener('keydown', tracker);
  }, []);

  // Check iOS permission requirements
  useEffect(() => {
    if (typeof window !== "undefined" && typeof (window.DeviceOrientationEvent as any)?.requestPermission === 'function') {
      setNeedPermission(true);
    }
  }, []);

  const requestPermission = () => {
    if (typeof window !== "undefined") {
      (window.DeviceOrientationEvent as any).requestPermission()
        .then((response: string) => {
          if (response === 'granted') {
            setNeedPermission(false);
            setEnabled(true);
          } else {
            alert('Sensor permission denied');
          }
        })
        .catch(console.error);
    }
  };

  return (
    <div className="motion-control-wrapper glass-panel" style={{ padding: '0.8rem', marginTop: '0.5rem' }}>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--zx-green)' }}>Motion Controls</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--zx-white)', margin: '0.5rem 0' }}>
          {enabled && inMenu ? (
            <span style={{ color: 'var(--zx-yellow)' }}>Armed. Awaiting takeoff...</span>
          ) : (
            'Control aircraft with phone sensors'
          )}
        </p>
      </div>

      {needPermission ? (
        <button className="btn-permission" onClick={requestPermission}>
          Grant Sensor Permission
        </button>
      ) : (
        <label className="switch">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          <span className="slider"></span>
        </label>
      )}
    </div>
  );
}
