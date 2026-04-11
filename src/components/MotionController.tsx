'use client';

import { useState, useEffect, useRef } from 'react';

export default function MotionController() {
  const [enabled, setEnabled] = useState(false);
  const [needPermission, setNeedPermission] = useState(false);
  const [activeSensors, setActiveSensors] = useState<string>('None');

  const keyStates = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
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

  const updateKey = (key: string, shouldBeDown: boolean) => {
    const kState = keyStates.current as any;
    const internalKey = key === 'ArrowUp' ? 'up' : key === 'ArrowDown' ? 'down' : key === 'ArrowLeft' ? 'left' : 'right';
    
    if (shouldBeDown && !kState[internalKey]) {
      kState[internalKey] = true;
      dispatchKey(key, 'keydown');
    } else if (!shouldBeDown && kState[internalKey]) {
      kState[internalKey] = false;
      dispatchKey(key, 'keyup');
    }
  };

  // Generic Sensor API handler
  const handleAccelerometer = (x: number, y: number, z: number) => {
    // Vertical hold roll (x-axis tracks lateral tilt)
    updateKey('ArrowLeft', x > 3);
    updateKey('ArrowRight', x < -3);
    
    // Vertical hold pitch maps to Z axis!
    // Tilt forward -> face up gravity -> z is positive. Lower threshold to 1.5 for higher sensitivity
    updateKey('ArrowUp', z > 1.5);    // Dive
    // Tilt backward -> face down gravity -> z is negative
    updateKey('ArrowDown', z < -1.5); // Climb
  };

  // DeviceOrientation handler
  const handleOrientation = (beta: number | null, gamma: number | null) => {
    if (beta === null || gamma === null) return;
    // For vertical portrait hold: Center is beta ~90.
    // Tilt forward (top away, screen faces up): beta approaches 0.
    // Tilt backward (top towards you, screen faces down): beta approaches 180.
    updateKey('ArrowLeft', gamma < -15);
    updateKey('ArrowRight', gamma > 15);
    // Increased sensitivity margin: 10 degrees from neutral center
    updateKey('ArrowUp', beta < 80);
    // Tilting backward -> go up (climb = ArrowDown)
    updateKey('ArrowDown', Math.abs(beta) > 100);
  };

  // Setup sensors when active
  useEffect(() => {
    let sensor: any = null;
    let orientHandler: any = null;

    if (!enabled) {
      // Release all keys
      updateKey('ArrowUp', false);
      updateKey('ArrowDown', false);
      updateKey('ArrowLeft', false);
      updateKey('ArrowRight', false);
      setActiveSensors('None');
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
            setActiveSensors('Accelerometer (Generic API)');
          }
        });
        sensor.start();
        setActiveSensors('Initializing Sensor...');
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
          setActiveSensors('DeviceOrientationEvent (Fallback)');
        }
      };
      window.addEventListener('deviceorientation', orientHandler);
    }

    return () => {
      if (sensor) sensor.stop();
      if (orientHandler) window.removeEventListener('deviceorientation', orientHandler);
    };
  }, [enabled]);

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
          Steer the aircraft using device accelerometer/gyroscope.
        </p>
        <span className={`status-badge ${enabled ? 'active' : 'inactive'}`}>
          {enabled ? `ACTIVE (${activeSensors})` : 'INACTIVE'}
        </span>
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
