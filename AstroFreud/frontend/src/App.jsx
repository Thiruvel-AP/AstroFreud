import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  User, Fingerprint, Activity,
  ShieldAlert, AlertTriangle, Send, Camera,
  Mic, MicOff, Volume2, VolumeX
} from 'lucide-react';
import './index.css';
import SpaceBackground from './SpaceBackground';


function useTTS() {
  const [speaking,  setSpeaking]  = useState(false);
  const [activeIdx, setActiveIdx] = useState(null);
  const uttRef = useRef(null);

  // Prime voice list (async in some browsers)
  useEffect(() => { window.speechSynthesis.getVoices(); }, []);

  const speak = useCallback((text, idx) => {
    window.speechSynthesis.cancel();
    if (activeIdx === idx) { setSpeaking(false); setActiveIdx(null); return; }

    const utt = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voice  = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('google'))
                || voices.find(v => v.lang.startsWith('en'))
                || voices[0];
    if (voice) utt.voice = voice;
    utt.rate   = 0.92;
    utt.pitch  = 0.85;
    utt.volume = 1;
    utt.onstart = () => { setSpeaking(true);  setActiveIdx(idx); };
    utt.onend   = () => { setSpeaking(false); setActiveIdx(null); };
    utt.onerror = () => { setSpeaking(false); setActiveIdx(null); };
    uttRef.current = utt;
    window.speechSynthesis.speak(utt);
  }, [activeIdx]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false); setActiveIdx(null);
  }, []);

  return { speak, stop, speaking, activeIdx };
}


function RobotMascot({ size = 52 }) {
  return (
    <div className="robot-mascot" style={{ width: size, height: size * 1.3 }}>
      <div className="robot-head" style={{ width: size * 0.7, height: size * 0.55, borderRadius: size * 0.12 }}>
        <div className="robot-eyes">
          <div className="robot-eye" style={{ width: size * 0.14, height: size * 0.14 }} />
          <div className="robot-eye" style={{ width: size * 0.14, height: size * 0.14 }} />
        </div>
        <div className="robot-mouth" style={{ width: size * 0.32, height: size * 0.06 }} />
      </div>
      <div className="robot-body" style={{ width: size * 0.85, height: size * 0.62, borderRadius: size * 0.1 }}>
        <div className="robot-core-ring" style={{ width: size * 0.35, height: size * 0.35 }}>
          <div className="robot-core" style={{ width: size * 0.18, height: size * 0.18 }} />
        </div>
      </div>
    </div>
  );
}



function IdentityBadge({ identity, isCritical }) {
  const isVian    = identity === 'VIAN';
  const isUnknown = identity === 'Unknown Personnel' || identity === 'Unknown';
  const cls = isVian ? 'badge-vian' : isUnknown ? 'badge-unknown' : 'badge-standby';
  return (
    <div className={`identity-badge ${cls} ${isCritical ? 'badge-critical' : ''}`}>
      <div className="badge-icon-wrap">
        {isVian ? <Fingerprint size={22} /> : isUnknown ? <AlertTriangle size={22} /> : <User size={22} />}
      </div>
      <div className="badge-info">
        <span className="badge-label-tag">PERSONNEL ID</span>
        <span className="badge-name">{identity}</span>
        <span className="badge-status">
          {isVian ? '● IDENTITY CONFIRMED' : isUnknown ? '● UNRECOGNISED SUBJECT' : '● AWAITING...'}
        </span>
      </div>
    </div>
  );
}


const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const API_BASE = 'http://localhost:8000';


export default function App() {
  const [data, setData] = useState({
    identity: 'STANDBY', mood: '---', score: 0, message: 'System Initializing...',
  });
  const [loading,      setLoading]      = useState(false);
  const [chat,         setChat]         = useState([]);
  const [input,        setInput]        = useState('');
  const [scanFlash,    setScanFlash]    = useState(false);
  const [introVisible, setIntroVisible] = useState(true);
  const [sessionDone,  setSessionDone]  = useState(false);

  // Voice input state
  const [listening,    setListening]    = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const [voiceSupport, setVoiceSupport] = useState(true);
  const recognitionRef = useRef(null);

  const [token] = useState(() => Math.random().toString(36).slice(2, 9));

  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const chatEndRef    = useRef(null);
  const introVideoRef = useRef(null);

  // TTS
  const { speak, activeIdx } = useTTS();

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  // Camera
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: true })
      .then(s => { if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(e => console.error('Camera denied:', e));
  }, []);

  // Speech Recognition
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceSupport(false); return; }

    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';

    rec.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        e.results[i].isFinal ? (final += t) : (interim += t);
      }
      setTranscript(interim);
      if (final) { setInput(prev => (prev + ' ' + final).trim()); setTranscript(''); }
    };
    rec.onerror = () => { setListening(false); setTranscript(''); };
    rec.onend   = () => { setListening(prev => { if (prev) rec.start(); return prev; }); };

    recognitionRef.current = rec;
    return () => rec.abort();
  }, []);

  const toggleMic = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) { rec.stop(); setListening(false); setTranscript(''); }
    else { try { rec.start(); setListening(true); } catch (e) { console.warn(e); } }
  }, [listening]);

  /* handleSendToBackend */
  const handleSendToBackend = useCallback(async (text) => {
    console.log('[AstroFreud] voice/text →', text);
  
    return null;
  }, [data.identity, token]);

  const skipIntro = () => { introVideoRef.current?.pause(); setIntroVisible(false); };

  /* Biometric scan  */
  const scanVian = async () => {
    setLoading(true); setScanFlash(true);
    setTimeout(() => setScanFlash(false), 600);
    try {
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, 400, 300);
      const img = canvasRef.current.toDataURL('image/jpeg');
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: img }),
      });
      const r = await res.json();
      setData({ identity: r.identity || 'Unknown', mood: r.mood || 'neutral', score: r.score ?? 0, message: r.message || '' });
      addMsg('assistant',
        r.identity === 'VIAN'
          ? `Identity confirmed: VIAN. Affect — ${(r.mood || 'neutral').toUpperCase()}. Stress Index: ${r.score}/20. Monitoring active.`
          : `Unrecognised scan. Stress Index: ${r.score}/20. Proceeding as anonymous subject.`
      );
      if (r.score >= 12) addMsg('assistant', `⚠ ALERT: Elevated ${(r.mood || '').toUpperCase()} detected. ${r.identity}, report status immediately.`);
    } catch {
      setData(p => ({ ...p, message: 'CONNECTION ERROR' }));
      addMsg('assistant', 'Scan uplink failed. Check backend on port 8000.');
    }
    setLoading(false);
  };

  /* Chat  */
  const addMsg = (role, content) => setChat(p => [...p, { role, content, time: nowTime() }]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    const txt = input.trim();
    if (!txt) return;
    if (listening) toggleMic();
    addMsg('user', txt);
    setInput('');
    const voiceReply = await handleSendToBackend(txt);
    try {
      const id = data.identity !== 'STANDBY' && data.identity !== 'Unknown Personnel' ? data.identity : 'Unknown';
      const res = await fetch(`${API_BASE}/chat?identity=${encodeURIComponent(id)}&token=${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...chat, { role: 'user', content: txt }] }),
      });
      const d = await res.json();
      if (d.message) addMsg('assistant', d.message);
      else if (voiceReply) addMsg('assistant', voiceReply);

      
      if (d.phase === 'done') {

  const finalMsg = d.message || "Analysis complete";
  

  addMsg('assistant', finalMsg);
  
 
  speak(finalMsg, chat.length);

 
  setTimeout(() => {
    // Reset Identity and Stats
    setData({
      identity: 'STANDBY',
      mood: '---',
      score: 0,
      message: 'System Initializing...',
    });
    
    // Clear Chat History
    setChat([]);
    
    console.log(" Session Terminated. Returning to Standby.");
  }, 8000); 
}
    } catch {
      addMsg('assistant', voiceReply || 'Uplink failure. System offline.');
    }
  };

  const onKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(e); };

  /*  Derived */
  const isCritical  = data.score >= 12;
  const isVian      = data.identity === 'VIAN';
  const fillCls     = isCritical ? 'fill-red' : isVian ? 'fill-green' : 'fill-blue';
  const scoreNumCls = isCritical ? 'text-red'  : isVian ? 'text-green' : 'text-blue';

 
  return (
    <>
      {/* Intro */}
      <div className={`intro-screen ${!introVisible ? 'hidden' : ''}`}>
        <video ref={introVideoRef} className="intro-video" src="/intro.mp4"
          autoPlay playsInline onEnded={() => setIntroVisible(false)} />
        <button className="intro-skip" onClick={skipIntro}>SKIP INTRO ▶</button>
      </div>

      <SpaceBackground />

      <div className={`main-wrapper ${isCritical ? 'critical-active' : ''} ${isVian ? 'vian-active' : ''}`}>
        <div className="container">

          {/* ── Header ── */}
          <header className="header">
            <div className="logo-group">
              <div className="logo-orb">
                <img src="/logo.png" alt="AstroFreud" className="logo-img" />
              </div>
              <div className="brand-text">
                <h1 className="title">AstroFreud</h1>
                <span className="version">v0 </span>
              </div>
            </div>
            <div className="header-right">
              <div className="conn-status">
                <span className="conn-dot" /><span className="conn-label">BACKEND : 8000</span>
              </div>
              {isCritical && (
                <div className="warning-label">
                  <AlertTriangle size={13} className="spin-icon" />
                  <span>EVALUATION REQUIRED</span>
                </div>
              )}
            </div>
          </header>

          {/* Dashboard grid  */}
          <div className="dashboard-grid">

            {/* Camera */}
            <div className={`card camera-card ${scanFlash ? 'scan-flash' : ''}`}>
              <div className="card-label"><Camera size={13} /> LIVE SCAN</div>
              <div className="video-container">
            
                {isVian && <div className="vian-overlay">✓ VIAN</div>}
                <video ref={videoRef} autoPlay playsInline muted className="webcam-view" />
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} width="400" height="300" />
            </div>

            {/* Stats */}
            <div className="stats-column">
              <div className={`card stat-card ${isCritical ? 'border-red' : isVian ? 'border-vian' : ''}`}>
                <IdentityBadge identity={data.identity} isCritical={isCritical} />

                <div className="score-block">
                  <div className="score-header">
                    <Activity size={13} className="score-icon" />
                    <span className="score-label">STRESS INDEX</span>
                    <span className={`score-num ${scoreNumCls}`}>{data.score}/20</span>
                  </div>
                  <div className="score-track">
                    <div className={`score-fill ${fillCls}`} style={{ width: `${(data.score / 20) * 100}%` }} />
                  </div>
                </div>

                {data.mood !== '---' && (
                  <div className="mood-row">
                    <span className="mood-label">AFFECT</span>
                    <span className="mood-value">{data.mood.toUpperCase()}</span>
                  </div>
                )}

                <button className={`btn-scan ${isCritical ? 'btn-scan-red' : ''}`}
                  onClick={scanVian} disabled={loading}>
                  {loading ? <><span className="spinner" /> CALIBRATING...</> : <><Fingerprint size={14} /> INITIATE SCAN</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Psych-Link Terminal  */}
          {data.identity !== 'STANDBY' && !sessionDone && <div className="card chat-card">

            {/* WA header bar */}
            <div className="chat-header-bar">
              <div className="chat-header-left">
                <div className="chat-avatar"><RobotMascot size={26} /></div>
                <div className="chat-contact-info">
                  <span className="chat-contact-name">AstroFreud_AI // PSYCH-LINK</span>
                  <span className="chat-contact-status">{listening ? 'listening...' : 'online'}</span>
                </div>
              </div>
              <div className="chat-header-icons">
                {isVian && <span className="vian-tag">LINKED: VIAN</span>}
                <ShieldAlert size={15} color="#94a3b8" />
              </div>
            </div>

            {/* Messages */}
            <div className="chat-history">
              {chat.length === 0 ? (
                <div className="empty-chat">
                  <div className="empty-dot">◉</div>
                  <span>Awaiting scan to initialise session...</span>
                  <div className="mascot-corner"><RobotMascot size={52} /></div>
                </div>
              ) : (
                <>
                  <div className="date-divider">
                    <span>{new Date().toLocaleDateString([], { weekday:'long', month:'short', day:'numeric' })}</span>
                  </div>
                  {chat.map((m, i) => {
                    const isPlaying = activeIdx === i;
                    return (
                      <div key={i} className={`bubble-wrap ${m.role === 'user' ? 'bubble-right' : 'bubble-left'}`}>
                        {m.role === 'assistant' && <RobotMascot size={26} />}
                        <div className={`bubble ${m.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                          <span className="bubble-sender">
                            {m.role === 'user' ? (data.identity !== 'STANDBY' ? data.identity : 'CREW') : 'AstroFreud_AI'}
                          </span>
                          <p>{m.content}</p>
                          <div className="bubble-meta">
                            <span className="bubble-time">{m.time}</span>
                            {m.role === 'user' && <span className="bubble-tick">✓✓</span>}
                            {m.role === 'assistant' && (
                              <button
                                className={`btn-tts ${isPlaying ? 'tts-active' : ''}`}
                                onClick={() => speak(m.content, i)}
                                title={isPlaying ? 'Stop' : 'Read aloud'}
                              >
                                {isPlaying ? <VolumeX size={11} /> : <Volume2 size={11} />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* Live transcript strip */}
            {listening && (
              <div className="transcript-strip">
                <span className="transcript-dot" />
                <span>{transcript || 'Listening for voice input...'}</span>
              </div>
            )}

            {/* Input bar */}
            <form className="chat-input-area" onSubmit={sendMessage}>
              {voiceSupport ? (
                <button type="button" className={`btn-mic ${listening ? 'listening' : ''}`}
                  onClick={toggleMic} title={listening ? 'Stop mic' : 'Voice input'}>
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              ) : (
                <button type="button" className="btn-mic" disabled title="Not supported">
                  <Mic size={16} />
                </button>
              )}

              <input
                className="chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={listening ? 'Dictating... press send when ready' : 'Message AstroFreud_AI...'}
              />

              <button className="btn-transmit" type="submit" disabled={!input.trim()}>
                <Send size={16} />
              </button>
            </form>

          </div>}
        </div>
      </div>
      <footer className="app-footer">
        <span id="te">created @brisHack 2026 by Vian, Shankar, Thiruvel, Thrijwal</span>
      </footer>
    </>
  );
}