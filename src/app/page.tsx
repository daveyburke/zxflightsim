import Image from 'next/image';
import SpectrumEmulator from '@/components/SpectrumEmulator';
import MotionController from '@/components/MotionController';
import EngineSound from '@/components/EngineSound';
import InteractiveKeyboard from '@/components/InteractiveKeyboard';

export default function Home() {
  return (
    <main>
      <div className="layout-grid" style={{ paddingTop: '1rem' }}>
        <section className="emulator-container">
          <SpectrumEmulator />

          <div style={{ marginTop: '0.5rem' }}>
            <InteractiveKeyboard />
          </div>
        </section>

        <aside className="controls-panel glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h2 style={{ marginBottom: '0.5rem', fontSize: '1.6rem', color: 'var(--zx-white)', textShadow: 'none' }}>
            Psion Flight Simulation<br /> ZX Spectrum 48K (1982)
          </h2>
          <h3>PILOT CONTROLS</h3>
          <ul className="controls-list">
            <li><span className="key-badge">Cursor Up</span> <span className="action-desc">Pitch down</span></li>
            <li><span className="key-badge">Cursor Down</span> <span className="action-desc">Pitch up</span></li>
            <li><span className="key-badge">Cursor Right</span> <span className="action-desc">Bank right</span></li>
            <li><span className="key-badge">Cursor Left</span> <span className="action-desc">Bank left</span></li>
            <li><span className="key-badge">Z</span> <span className="action-desc">Rudder left</span></li>
            <li><span className="key-badge">X</span> <span className="action-desc">Rudder right</span></li>
            <li><span className="key-badge">P</span> <span className="action-desc">Increase throttle</span></li>
            <li><span className="key-badge">O</span> <span className="action-desc">Decrease throttle</span></li>
            <li><span className="key-badge">F</span> <span className="action-desc">Increase flap</span></li>
            <li><span className="key-badge">D</span> <span className="action-desc">Decrease flap</span></li>
            <li><span className="key-badge">G</span> <span className="action-desc">Toggle gear</span></li>
            <li><span className="key-badge">B</span> <span className="action-desc">Change beacon</span></li>
            <li><span className="key-badge">M</span> <span className="action-desc">Switch Map / Cockpit</span></li>
            <li><span className="key-badge">Esc / 0</span> <span className="action-desc">Restart</span></li>
          </ul>

          <div style={{ marginTop: 'auto' }}>
            <MotionController />
          </div>
          <div style={{ marginTop: '0.25rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--zx-cyan)' }}>
            Powered by JSSpeccy. Vibe coded by Dave Burke (2026)
          </div>
        </aside>
      </div>
      <EngineSound />
    </main>
  );
}
