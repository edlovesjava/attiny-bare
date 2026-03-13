import { useState } from 'react';
import USISimulator from './USISimulator.jsx';
import OLEDSimulator from './OLEDSimulator.jsx';

const TABS = [
  { id: 'usi', label: 'USI I2C' },
  { id: 'oled', label: 'SSD1306 OLED' },
];

const styles = {
  tabBar: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid #2a3a2a',
    marginBottom: '0',
    fontFamily: "'IBM Plex Mono', monospace",
  },
  tab: (active) => ({
    padding: '10px 24px',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #00ff66' : '2px solid transparent',
    color: active ? '#00ff66' : '#4a6a4a',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '14px',
    fontWeight: active ? 700 : 400,
    letterSpacing: '0.5px',
    transition: 'color 0.15s, border-color 0.15s',
  }),
};

export default function App() {
  const [activeTab, setActiveTab] = useState('usi');

  return (
    <div style={{ background: '#070d07', minHeight: '100vh' }}>
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            style={styles.tab(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'usi' && <USISimulator />}
      {activeTab === 'oled' && <OLEDSimulator />}
    </div>
  );
}
