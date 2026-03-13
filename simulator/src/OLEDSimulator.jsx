const styles = {
  container: {
    padding: '40px',
    fontFamily: "'IBM Plex Mono', monospace",
    color: '#00ff66',
  },
  header: {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '16px',
    letterSpacing: '1px',
  },
  placeholder: {
    color: '#4a6a4a',
    fontSize: '14px',
  },
};

export default function OLEDSimulator() {
  return (
    <div style={styles.container}>
      <h2 style={styles.header}>SSD1306 OLED &#9670; COMMAND SIMULATOR</h2>
      <p style={styles.placeholder}>Coming soon...</p>
    </div>
  );
}
