# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (uses Turbopack)
npm run build    # Production build
npm run lint     # Run ESLint
```

No test framework is configured.

## Architecture

This is a Next.js 16 (App Router) + React 19 app. It serves the **Psion Flight Simulation** (1982, ZX Spectrum 48K) via a browser-based emulator.

**Key pieces:**

- `src/app/page.tsx` — Single-page layout: two columns (emulator on left, controls panel on right).
- `src/components/SpectrumEmulator.tsx` — Client component. Loads `public/jsspeccy/jsspeccy.js` via `next/script` (strategy `afterInteractive`), then initializes the JSSpeccy emulator in a `<div ref>`. Loads the game from `public/games/FlightSimulation.tap`.
- `src/components/MotionController.tsx` — Client component. Maps device tilt (Generic Sensor API or `DeviceOrientationEvent` fallback) to arrow key `KeyboardEvent` dispatches on `document`, so the emulator receives directional input from mobile motion sensors. Handles iOS permission flow.
- `public/jsspeccy/` — Bundled JSSpeccy emulator (JS + WASM). Treated as a static vendor asset; not modified.
- `public/games/FlightSimulation.tap` — The ZX Spectrum tape image for the game.
- `src/app/globals.css` — All styling, including CSS custom properties for ZX Spectrum palette colors (`--zx-*`), `.glass-panel`, `.layout-grid`, `.key-badge`, and the motion-control toggle switch.

**Important config (`next.config.ts`):** Turbopack is enabled with `root: __dirname`, and `outputFileTracingRoot` is set to `__dirname`. Check `node_modules/next/dist/docs/` before modifying Next.js config or APIs.
