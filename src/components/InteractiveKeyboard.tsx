'use client';
import { MouseEvent, useState } from 'react';
import Image from 'next/image';

// Map of the generic ZX Spectrum 48k keyboard keys
const KYBD_MAP = [
  ['1', '2', '3', '4', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'Enter'],
  ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'SymbolShift', ' ']
];

// Use measured empirical key center offsets to correct for visual staggering
// Standard ZX Spectrum 48k mold uses identical physical key dimensions across all rows.
// Bisection geometric tuning verified colWidth = 0.0900 to exactly follow orthographic distortion.
const ROW_ZONES = [
  { yMax: 0.285, startX: 0.0570, colWidth: 0.0900 },
  { yMax: 0.513, startX: 0.0980, colWidth: 0.0900 },
  { yMax: 0.741, startX: 0.1233, colWidth: 0.0900 },
  { yMax: 1.000, startX: 0.0820, colWidth: 0.0900 }, // Shifted right natively
];

export default function InteractiveKeyboard() {
  const [activeKey, setActiveKey] = useState<{row: number, col: number} | null>(null);

  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); // Stop standard touch behaviours taking browser focus

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    let rowIndex = 0;
    for (let r = 0; r < 4; r++) {
      if (y < ROW_ZONES[r].yMax) {
        rowIndex = r;
        break;
      }
    }

    const zone = ROW_ZONES[rowIndex];
    let colIndex = Math.round((x - zone.startX) / zone.colWidth);
    
    // Clamp to valid 0-9 indices
    if (colIndex < 0) colIndex = 0;
    if (colIndex > 9) colIndex = 9;

    const row = rowIndex;
    const col = colIndex;

    const key = KYBD_MAP[row][col];
    setActiveKey({row, col});
    
    const host = document.getElementById('jsspeccy');
    if (host) {
      // Emscripten/SDL natively registers key handlers directly onto its specific child <canvas> node.
      // Dispatching to wrappers usually fails its internal module target checks!
      const emulatorTarget = (host.querySelector('canvas') || host.querySelector('.appContainer') || host) as HTMLElement;
      
      if (emulatorTarget) {
        // Enforce DOM focus since JSSpeccy relies on it
        emulatorTarget.focus();

        const keyCodeMap: Record<string, number> = {
          'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39, 'Enter': 13, ' ': 32, 'Shift': 16, 'SymbolShift': 17
        };
        const keyCode = keyCodeMap[key] || key.toUpperCase().charCodeAt(0);
        
        const getCode = (k: string) => {
          if (k >= '0' && k <= '9') return `Digit${k}`;
          if (k >= 'a' && k <= 'z') return `Key${k.toUpperCase()}`;
          if (k === ' ') return 'Space';
          if (k === 'Shift') return 'ShiftLeft';
          if (k === 'SymbolShift') return 'ControlLeft';
          return k;
        };

        const eventCode = getCode(key);
        const eventKey = key === 'SymbolShift' ? 'Control' : key;
        
        // Strict Emscripten/SDL KeyboardEvent synthesizer
        const createSDLEvent = (type: string) => {
          const ev = new KeyboardEvent(type, {
            key: eventKey, code: eventCode, keyCode: keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true
          });
          // Forcibly inject read-only properties that strict WebAssembly C-ports check for
          Object.defineProperties(ev, {
            keyCode: { value: keyCode },
            which: { value: keyCode },
            charCode: { value: 0 }
          });
          return ev;
        };
        
        // Dispatch downward into the element
        emulatorTarget.dispatchEvent(createSDLEvent('keydown'));
        
        // Mimic a natural keypress duration to ensure the emulator Z80 process registers it!
        setTimeout(() => {
          emulatorTarget.dispatchEvent(createSDLEvent('keyup'));
          setActiveKey(null);
        }, 150);
      }
    }
  };

  return (
    <div 
      className="spectrum-image glass-panel" 
      style={{ WebkitTapHighlightColor: 'transparent', position: 'relative', width: '100%', cursor: 'pointer', overflow: 'hidden', touchAction: 'none' }}
      onPointerDown={handleTap}
    >
      <Image
        src="/assets/zx-keyboard.jpg"
        alt="Sinclair ZX Spectrum 48k Keyboard"
        width={1200}
        height={516}
        style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '100%', userSelect: 'none' }}
        draggable={false}
        priority={true}
      />
      
      {/* Visual touch feedback UI dynamically mapped over the hit key! */}
      {activeKey && (() => {
        const zone = ROW_ZONES[activeKey.row];
        const cx = zone.startX + activeKey.col * zone.colWidth;
        // Approximation of visual padding box per row for the highlighting
        const heightPct = 0.20; 
        const widthPct = zone.colWidth * 0.90;
        let cy = 0.1744;
        if (activeKey.row === 1) cy = 0.3973;
        if (activeKey.row === 2) cy = 0.6298;
        if (activeKey.row === 3) cy = 0.8250; // Shifted UP visually

        return (
          <div style={{
              position: 'absolute',
              left: `${(cx - widthPct/2) * 100}%`,
              top: `${(cy - heightPct/2) * 100}%`,
              width: `${widthPct * 100}%`,
              height: `${heightPct * 100}%`,
              backgroundColor: 'rgba(0, 215, 215, 0.4)',
              border: '2px solid rgba(0, 255, 255, 0.8)',
              borderRadius: '6px',
              pointerEvents: 'none'
          }} />
        );
      })()}
    </div>
  );
}
