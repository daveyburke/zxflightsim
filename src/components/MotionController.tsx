'use client';

import { useState, useEffect, useRef } from 'react';

export default function MotionController() {
  const [enabled, setEnabled] = useState(false);
  const [needPermission, setNeedPermission] = useState(false);

  const lastKeyboardPress = useRef(0);

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
      charCode: { value: 0 },
      isMotionController: { value: true }
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
    // Elegant Mutual Exclusion: If the user hit a physical or virtual keyboard key in the last 1 second, 
    // force motion requests to neutral natively. This absolutely eradicates matrix ghosting during menu sequences
    // and naturally secures mid-flight keyboard interventions without locking structural simulation state.
    if (!force && Date.now() - lastKeyboardPress.current < 1000) {
      shouldBeDown = false;
    }

    const kState = keyStates.current as any;
    const internalKey = key === 'ArrowUp' ? 'up' : key === 'ArrowDown' ? 'down' : key === 'ArrowLeft' ? 'left' : 'right';

    if (shouldBeDown !== kState[internalKey]) {
      const now = Date.now();
      // Enforce strict 2Hz (500) transition ceiling to physically block runaway polling noise
      if (!force && (now - (throttleCache.current as any)[internalKey] < 500)) return;

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
  }, [enabled]);

  // Global mutual exclusion keystroke listener natively tracks when the user physically touches the keyboard.
  useEffect(() => {
    const handleKeydown = (e: any) => {
      // Ignore perfectly simulated synthetic events organically fired by our own controller!
      if (e.isMotionController) return;
      lastKeyboardPress.current = Date.now();
    };

    // Bind to the capture phase to ensure we intercept it BEFORE deeply nested canvas shadow DOMs trap the event loop
    window.addEventListener('keydown', handleKeydown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeydown, { capture: true });
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
          Control aircraft with phone sensors
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
