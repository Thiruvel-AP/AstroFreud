import React, { useState, useRef, useEffect } from 'react';
import { ShieldAlert, User, Camera, AlertTriangle, Fingerprint, Activity } from 'lucide-react';
import './index.css';

const API_BASE = 'http://localhost:8000';

/* ── Robot peek — only in assistant bubbles ── */
function RobotPeek() {
  return (
    <div className="robot-peek">
      <div className="robot-face">
        <div className="robot-eyes">
          <div className="robot-eye" />
          <div className="robot-eye" />
        </div>
        <div className="robot-mouth" />
      </div>
      <div className="robot-body" />
    </div>
  );
}

/* ── Space Background ── */
function SpaceBg() {
  return (
    <div className="space-bg">
      <div className="stars-layer" />
      <div className="stars-layer-2" />
      <div className="nebula nebula-1" />
      <div className="nebula nebula-2" />
      <div className="nebula nebula-3" />
      <div className="nebula nebula-4" />
      <div className="planet planet-1" />
      <div className="planet planet-2" />
      <div className="planet planet-3" />
      <div className="planet planet-4" />
      <div className="planet planet-5" />
      <div className="shooting-star shoot-1" />
      <div className="shooting-star shoot-2" />
      <div className="shooting-star shoot-3" />
    </div>
  );
}

/* ── Identity Badge — shows VIAN or Unknown state ── */
function IdentityBadge({ identity, isCritical }) {
  const isVian    = identity === "VIAN";
  const isStandby = identity === "STANDBY";
  const isUnknown = identity === "Unknown Personnel" || identity === "Unknown";

  return (
    <div className={`identity-badge ${isVian ? 'badge-vian' : isUnknown ? 'badge-unknown' : 'badge-standby'} ${isCritical ? 'badge-critical' : ''}`}>
      <div className="badge-icon">
        {isVian
          ? <Fingerprint size={22} />
          : isUnknown
            ? <AlertTriangle size={22} />
            : <User size={22} />
        }
      </div>
      <div className="badge-info">
        <span className="badge-label">PERSONNEL ID</span>
        <span className={`badge-name ${isVian ? 'name-vian' : isUnknown ? 'name-unknown' : 'name-standby'}`}>
          {identity}
        </span>
        <span className="badge-status">
          {isVian    ? '● IDENTITY CONFIRMED'    :
           isUnknown ? '● UNRECOGNISED SUBJECT'  :
                       '● AWAITING BIOMETRICS'   }
        </span>
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState({
    identity: "STANDBY",
    mood:     "---",
    score:    0,
    message:  "System Initializing...",
  });
  const [loading, setLoading]           = useState(false);
  const [chatHistory, setChatHistory]   = useState([]);
  const [input, setInput]               = useState("");
  const [darkMode, setDarkMode]         = useState(true);
  const [introVisible, setIntroVisible] = useState(true);
  const [scanFlash, setScanFlash]       = useState(false);

  const [token] = useState(() => Math.random().toString(36).slice(2, 9));

  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const chatEndRef    = useRef(null);
  const introVideoRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle('light', !darkMode);
  }, [darkMode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
        .catch(err => console.error('Camera access denied:', err));
    }
  }, []);

  const skipIntro = () => {
    if (introVideoRef.current) introVideoRef.current.pause();
    setIntroVisible(false);
  };

  // ── Biometric Scan ──────────────────────────────────────────
  const scanVian = async () => {
    setLoading(true);
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 600);

    try {
      const context = canvasRef.current.getContext('2d');
      context.drawImage(videoRef.current, 0, 0, 400, 300);
      const imageData = canvasRef.current.toDataURL('image/jpeg');

      const res = await fetch(`${API_BASE}/analyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: imageData }),
      });
      const result = await res.json();

      setData({
        identity: result.identity || 'Unknown',
        mood:     result.mood     || 'neutral',
        score:    result.score    ?? 0,
        message:  result.message  || 'Analysis complete.',
      });

      // Post a scan result message into chat
      const isVian = result.identity === 'VIAN';
      setChatHistory(prev => [...prev, {
        role:    'assistant',
        content: isVian
          ? `Identity confirmed: VIAN. Affect detected — ${(result.mood || 'neutral').toUpperCase()}. Stress Index: ${result.score}/20. Monitoring active.`
          : `Unrecognised biometric signature. Stress Index: ${result.score}/20. Proceeding as anonymous subject.`,
      }]);

      // Critical alert
      if (result.score >= 12) {
        setChatHistory(prev => [...prev, {
          role:    'assistant',
          content: `⚠ ALERT: Elevated ${(result.mood || '').toUpperCase()} detected. ${result.identity}, please report your current status immediately.`,
        }]);
      }
    } catch (err) {
      console.error(err);
      setData(prev => ({ ...prev, message: 'CONNECTION ERROR' }));
      setChatHistory(prev => [...prev, {
        role:    'assistant',
        content: 'Biometric uplink failed. Check backend connection on port 8000.',
      }]);
    }
    setLoading(false);
  };

  // ── Send Chat Message ───────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setChatHistory(prev => [...prev, userMessage]);
    setInput('');

    try {
      const identityParam =
        data.identity !== 'STANDBY' && data.identity !== 'Unknown Personnel'
          ? data.identity
          : 'Unknown';

      const res = await fetch(
        `${API_BASE}/chat?identity=${encodeURIComponent(identityParam)}&token=${token}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ messages: [...chatHistory, userMessage] }),
        }
      );
      const chatData = await res.json();
      if (chatData.message) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: chatData.message }]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Uplink failure. System offline.' }]);
    }
  };

  const isCritical = data.score >= 12;
  const isVian     = data.identity === 'VIAN';

  return (
    <>
      {/* Intro Video */}
      <div className={`intro-screen ${!introVisible ? 'hidden' : ''}`}>
        <video
          ref={introVideoRef}
          className="intro-video"
          src="/intro.mp4"
          autoPlay
          playsInline
          onEnded={() => setIntroVisible(false)}
        />
        <button className="intro-skip" onClick={skipIntro}>SKIP INTRO ▶</button>
      </div>

      <SpaceBg />

      <div className={`main-wrapper ${isCritical ? 'critical-active' : ''} ${isVian ? 'vian-active' : ''}`}>
        <div className="container">

          {/* Header */}
          <header className="header">
            <div className="logo-group">
              <img src="/logo.png" alt="AstroFreud" className="logo-img" />
              <div className="brand-text">
                <h1 className="title">AstroFreud</h1>
                <span className="version">v0 // COMMAND_HUB</span>
              </div>
            </div>

            <div className="header-right">
              {/* Connection status dot */}
              <div className="conn-status">
                <span className="conn-dot" />
                <span className="conn-label">BACKEND :8000</span>
              </div>

              <button className="theme-toggle" onClick={() => setDarkMode(d => !d)}>
                <span className="theme-toggle-icon">{darkMode ? '☀' : '🌙'}</span>
                {darkMode ? 'LIGHT' : 'DARK'}
              </button>

              {isCritical && (
                <div className="warning-label">
                  <AlertTriangle size={13} className="pulse-icon" />
                  <span>EVALUATION REQUIRED</span>
                </div>
              )}
            </div>
          </header>

          {/* Dashboard */}
          <div className="dashboard-grid">

            {/* Camera Card */}
            <div className={`card camera-card ${scanFlash ? 'scan-flash' : ''}`}>
              <div className="card-label"><Camera size={13} /> LIVE BIOMETRICS</div>
              <div className="video-container">
                <div className="scanner-line" />
                {isVian && <div className="vian-overlay">✓ VIAN</div>}
                <video ref={videoRef} autoPlay playsInline muted className="webcam-view" />
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} width="400" height="300" />
            </div>

            {/* Stats Card */}
            <div className="stats-column">
              <div className={`card stat-card ${isCritical ? 'border-red' : isVian ? 'border-vian' : 'border-default'}`}>

                {/* Identity Badge */}
                <IdentityBadge identity={data.identity} isCritical={isCritical} />

                {/* Score */}
                <div className="score-block">
                  <div className="score-row">
                    <Activity size={14} className="score-icon" />
                    <span className="score-label-top">STRESS INDEX</span>
                  </div>
                  <div className="score-bar-wrap">
                    <div
                      className={`score-bar-fill ${isCritical ? 'fill-red' : isVian ? 'fill-green' : 'fill-blue'}`}
                      style={{ width: `${(data.score / 20) * 100}%` }}
                    />
                  </div>
                  <div className="score-nums">
                    <span className={`score-number ${isCritical ? 'text-red' : isVian ? 'text-green' : 'text-blue'}`}>
                      {data.score}
                    </span>
                    <span className="score-max">/20</span>
                  </div>
                </div>

                {/* Mood */}
                <div className="mood-row">
                  <span className="mood-label">AFFECT</span>
                  <span className={`mood-value mood-${data.mood.toLowerCase()}`}>
                    {data.mood.toUpperCase()}
                  </span>
                </div>

                {/* Scan Button */}
                <button
                  onClick={scanVian}
                  disabled={loading}
                  className={`action-button ${isCritical ? 'btn-red' : 'btn-purple'}`}
                >
                  {loading
                    ? <><span className="spinner" /> CALIBRATING...</>
                    : <><Fingerprint size={14} /> INITIATE SCAN</>
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Chat Terminal */}
          <div className="card chat-container">
            <div className="card-label"><ShieldAlert size={13} /> PSYCH-LINK TERMINAL
              {isVian && <span className="vian-tag">LINKED: VIAN</span>}
            </div>

            <div className="chat-history">
              {chatHistory.length === 0 && (
                <div className="empty-chat">
                  <div className="empty-icon">◉</div>
                  <div>Awaiting biometric scan to initialise session...</div>
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} className={`chat-bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>
                  {m.role === 'assistant' && <RobotPeek />}
                  <span className="sender-tag">
                    {m.role === 'user'
                      ? (data.identity !== 'STANDBY' ? data.identity : 'CREW')
                      : 'ARES_AI'}
                  </span>
                  <p>{m.content}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendMessage} className="chat-input-area">
              <input
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isVian ? `VIAN — input mission report...` : 'Input mission status report...'}
              />
              <button className="send-btn" type="submit" disabled={!input.trim()}>
                TRANSMIT
              </button>
            </form>
          </div>

        </div>
      </div>
    </>
  );
}

export default App;