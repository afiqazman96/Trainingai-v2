import Head from 'next/head';
import { useState, useRef, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const MAX_REC = 600;
const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

const storage = {
  get: () => { try { return JSON.parse(localStorage.getItem('tai_v2') || '[]'); } catch { return []; } },
  save: d => { try { localStorage.setItem('tai_v2', JSON.stringify(d)); } catch(e) { console.error(e); } },
  add: doc => { const all = [doc, ...storage.get()]; storage.save(all); return all; },
  del: id => { const all = storage.get().filter(d => d.id !== id); storage.save(all); return all; },
};

async function aiCall(messages, system) {
  const r = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt: system }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
  if (!data.result) throw new Error('AI tidak menjawab. Cuba lagi.');
  return data.result;
}

async function makeDoc(transcript, title, docType, lang) {
  const isBM = lang === 'bm';
  const sys = isBM
    ? 'Anda pembantu AI profesional. Jana dokumen latihan dalam Bahasa Melayu yang terperinci dan teratur. Gunakan format Markdown dengan heading ##, senarai bernombor dan bullet points. Dokumen mesti komprehensif dan mudah difahami.'
    : 'You are a professional AI assistant. Generate detailed, well-structured training documents in English. Use Markdown format with ## headings, numbered lists and bullet points. Documents must be comprehensive and easy to follow.';

  const map = {
    sop: isBM
      ? `Jana SOP (Standard Operating Procedure) yang lengkap dan terperinci. Sertakan:\n## 1. Tujuan\n## 2. Skop\n## 3. Tanggungjawab\n## 4. Prosedur (langkah bernombor yang jelas)\n## 5. Nota Penting\n## 6. Rujukan\n\nTranskrip:\n${transcript}`
      : `Generate a complete SOP (Standard Operating Procedure). Include:\n## 1. Purpose\n## 2. Scope\n## 3. Responsibilities\n## 4. Procedures (clear numbered steps)\n## 5. Important Notes\n## 6. References\n\nTranscript:\n${transcript}`,
    faq: isBM
      ? `Jana FAQ (Soalan Lazim) yang komprehensif dengan minimum 10 soalan dan jawapan yang relevan. Format: **S:** soalan dan **J:** jawapan.\n\nTranskrip:\n${transcript}`
      : `Generate a comprehensive FAQ with minimum 10 relevant questions and answers. Format: **Q:** question and **A:** answer.\n\nTranscript:\n${transcript}`,
    user_guide: isBM
      ? `Jana Panduan Pengguna yang lengkap. Sertakan:\n## Pengenalan\n## Keperluan\n## Langkah-Langkah (terperinci & bernombor)\n## Tips & Amaran\n## Penyelesaian Masalah\n\nTranskrip:\n${transcript}`
      : `Generate a complete User Guide. Include:\n## Introduction\n## Requirements\n## Steps (detailed & numbered)\n## Tips & Warnings\n## Troubleshooting\n\nTranscript:\n${transcript}`,
    summary: isBM
      ? `Jana ringkasan eksekutif yang padat dan jelas. Sertakan perkara utama, proses penting, dan peringatan kritikal.\n\nTranskrip:\n${transcript}`
      : `Generate a concise executive summary. Include key points, important processes, and critical reminders.\n\nTranscript:\n${transcript}`,
  };

  return await aiCall([{ role: 'user', content: map[docType] }], sys);
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0a0c10;
    --bg2:      #0f1218;
    --surface:  #141820;
    --card:     #1a1f2e;
    --border:   #242938;
    --border2:  #2e3448;
    --purple:   #6c63ff;
    --purple2:  #8b85ff;
    --purpleD:  #1a1640;
    --cyan:     #22d3ee;
    --green:    #10b981;
    --red:      #ef4444;
    --amber:    #f59e0b;
    --text:     #e8ecf7;
    --text2:    #9aa3bc;
    --text3:    #545d78;
  }

  html { height: 100%; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Sora', sans-serif;
    min-height: 100%;
    min-height: -webkit-fill-available;
    overscroll-behavior: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-font-smoothing: antialiased;
  }
  input, select, textarea, button { font-family: 'Sora', sans-serif; font-size: 16px; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:.25; } }
  @keyframes spin     { to { transform: rotate(360deg); } }
  @keyframes glow     { 0%,100% { box-shadow: 0 0 12px #6c63ff44; } 50% { box-shadow: 0 0 28px #6c63ff88; } }
  @keyframes ripple   { from { transform:scale(0); opacity:.5; } to { transform:scale(3); opacity:0; } }
  @keyframes slideIn  { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }

  .card { animation: fadeUp .28s cubic-bezier(.16,1,.3,1); }
  .tab-content { animation: slideIn .22s cubic-bezier(.16,1,.3,1); }

  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--purple) !important; }
  select option { background: var(--card); color: var(--text); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// STRINGS (BM + EN)
// ─────────────────────────────────────────────────────────────────────────────
const STRINGS = {
  bm: {
    appName: 'TrainingAI',
    tagline: 'Sistem Pengurusan Pengetahuan AI',
    tabs: ['Rakam', 'Upload', 'Dokumen', 'Chatbot'],
    tabIcons: ['🎙️', '📤', '📚', '🤖'],

    // Record
    recCard: 'Rakam Sesi Latihan',
    recHint: 'Rakam terus dari mulut anda. AI akan tukar kepada teks secara automatik.',
    recStart: 'Mula Rakam',
    recStop: 'Henti Rakam',
    recLive: 'Sedang merakam',
    recLeft: 'berbaki',
    recEdit: '✏️ Anda boleh edit transkrip di bawah sebelum jana dokumen',

    // Upload
    upCard: 'Upload Transcript',
    upHint: 'Upload fail .txt atau tampal teks transcript anda terus.',
    upDropTitle: 'Klik atau seret fail .txt ke sini',
    upDropSub: 'Hanya fail .txt disokong',
    upOr: 'ATAU',
    upPasteLabel: 'Tampal Teks Transcript',
    upPastePh: 'Tampal transcript latihan anda di sini… Contoh: "Langkah 1: Buka sistem, klik menu PO…"',
    upChars: 'aksara dimasukkan',
    upClear: 'Kosongkan',

    // Shared generate form
    formTitle: 'Jana Dokumen',
    formName: 'Nama Sesi / Tajuk',
    formNamePh: 'cth: Cara Buat Purchase Order, Proses Onboarding',
    formType: 'Jenis Dokumen Yang Ingin Dijana',
    formTypes: [
      { v: 'sop',        l: '📋 SOP — Standard Operating Procedure' },
      { v: 'faq',        l: '❓ FAQ — Soalan Lazim' },
      { v: 'user_guide', l: '📘 Panduan Pengguna' },
      { v: 'summary',    l: '📝 Ringkasan Eksekutif' },
    ],
    formBtn: 'Jana Dokumen dengan AI',
    formGenerating: 'AI sedang menganalisa dan menjana dokumen…',
    formDone: 'Dokumen berjaya dijana dan disimpan!',
    formSaved: 'Tersimpan dalam tab Dokumen ✓',

    // Transcript box
    txLabel: 'Transkrip',
    txEmpty: 'Tiada teks lagi',

    // Docs
    docsEmpty: 'Belum ada dokumen.',
    docsEmptySub: 'Jana dokumen dari tab Rakam atau Upload.',
    docsFrom: 'Sumber',
    docsRec: 'Rakaman',
    docsUp: 'Upload',
    docsBack: '← Senarai',
    docsCopyDoc: 'Salin Dokumen',
    docsCopied: 'Disalin!',
    docsDeleteConfirm: 'Padam dokumen ini?',
    docsTranscript: 'Transkrip Asal',

    // Chat
    chatTitle: 'Tanya AI Tentang Latihan Anda',
    chatSrcLabel: 'Tanya berdasarkan',
    chatAllDocs: 'Semua Dokumen',
    chatNoDocs: 'Belum ada dokumen. Jana dokumen dulu di tab Rakam atau Upload.',
    chatWelcome: 'Selamat datang! Tanya saya apa-apa tentang latihan anda.\n\nContoh soalan:\n• "Macam mana nak buat Purchase Order?"\n• "Apa langkah pertama untuk proses ni?"\n• "Apakah tanggungjawab saya?"',
    chatPh: 'Taip soalan anda…',
    chatSend: 'Hantar',
    chatThinking: 'AI sedang berfikir…',
    chatClear: 'Kosongkan chat',

    // Errors
    errSpeech: '⚠️ Guna Google Chrome untuk fungsi rakaman suara.',
    errTitle: '⚠️ Sila masukkan nama sesi terlebih dahulu.',
    errNoText: '⚠️ Tiada teks transcript. Rakam atau tampal teks dahulu.',
    errFileType: '⚠️ Hanya fail .txt sahaja yang diterima.',
    errEmpty: '⚠️ Transcript kosong. Sila isi dahulu.',
    errApi: 'Ralat semasa menghubungi AI. Sila semak API Key dan cuba lagi.',

    // Install
    installMsg: '📲 Install TrainingAI di homescreen anda!',
    installBtn: 'Install',
    copy: 'Salin',
    copied: 'Disalin!',
  },
  en: {
    appName: 'TrainingAI',
    tagline: 'AI Knowledge Management System',
    tabs: ['Record', 'Upload', 'Documents', 'Chatbot'],
    tabIcons: ['🎙️', '📤', '📚', '🤖'],
    recCard: 'Record Training Session',
    recHint: 'Record directly from your voice. AI will auto-transcribe what you say.',
    recStart: 'Start Recording',
    recStop: 'Stop Recording',
    recLive: 'Recording in progress',
    recLeft: 'remaining',
    recEdit: '✏️ You can edit the transcript below before generating',
    upCard: 'Upload Transcript',
    upHint: 'Upload a .txt file or paste your transcript text directly.',
    upDropTitle: 'Click or drag a .txt file here',
    upDropSub: 'Only .txt files supported',
    upOr: 'OR',
    upPasteLabel: 'Paste Transcript Text',
    upPastePh: 'Paste your training transcript here… e.g. "Step 1: Open the system, click PO menu…"',
    upChars: 'characters entered',
    upClear: 'Clear',
    formTitle: 'Generate Document',
    formName: 'Session Name / Title',
    formNamePh: 'e.g. How to Create Purchase Order, Onboarding Process',
    formType: 'Document Type to Generate',
    formTypes: [
      { v: 'sop',        l: '📋 SOP — Standard Operating Procedure' },
      { v: 'faq',        l: '❓ FAQ — Frequently Asked Questions' },
      { v: 'user_guide', l: '📘 User Guide' },
      { v: 'summary',    l: '📝 Executive Summary' },
    ],
    formBtn: 'Generate Document with AI',
    formGenerating: 'AI is analysing and generating document…',
    formDone: 'Document generated and saved!',
    formSaved: 'Saved to Documents tab ✓',
    txLabel: 'Transcript',
    txEmpty: 'No text yet',
    docsEmpty: 'No documents yet.',
    docsEmptySub: 'Generate documents from Record or Upload tab.',
    docsFrom: 'Source',
    docsRec: 'Recording',
    docsUp: 'Upload',
    docsBack: '← Back to list',
    docsCopyDoc: 'Copy Document',
    docsCopied: 'Copied!',
    docsDeleteConfirm: 'Delete this document?',
    docsTranscript: 'Original Transcript',
    chatTitle: 'Ask AI About Your Training',
    chatSrcLabel: 'Ask based on',
    chatAllDocs: 'All Documents',
    chatNoDocs: 'No documents yet. Generate documents in the Record or Upload tab first.',
    chatWelcome: 'Welcome! Ask me anything about your training materials.\n\nExample questions:\n• "How do I create a Purchase Order?"\n• "What is the first step in this process?"\n• "What are my responsibilities?"',
    chatPh: 'Type your question…',
    chatSend: 'Send',
    chatThinking: 'AI is thinking…',
    chatClear: 'Clear chat',
    errSpeech: '⚠️ Please use Google Chrome for voice recording.',
    errTitle: '⚠️ Please enter a session name first.',
    errNoText: '⚠️ No transcript text. Please record or paste text first.',
    errFileType: '⚠️ Only .txt files are accepted.',
    errEmpty: '⚠️ Transcript is empty. Please fill it in.',
    errApi: 'Error connecting to AI. Please check your API Key and try again.',
    installMsg: '📲 Install TrainingAI on your homescreen!',
    installBtn: 'Install',
    copy: 'Copy',
    copied: 'Copied!',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const IS = { // input style
  width: '100%', background: '#0f1218', border: '1.5px solid #242938',
  color: '#e8ecf7', borderRadius: 14, padding: '13px 16px',
  fontSize: 15, lineHeight: 1.5, transition: 'border .2s',
};
const LS = { // label style
  display: 'block', fontSize: 11, color: '#545d78', fontWeight: 700,
  letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
};

function Card({ children, style }) {
  return (
    <div className="card" style={{
      background: 'linear-gradient(135deg, #1a1f2e 0%, #141820 100%)',
      border: '1px solid #242938', borderRadius: 22,
      padding: '20px 18px', marginBottom: 14, ...style,
    }}>
      {children}
    </div>
  );
}

function PBtn({ children, onClick, disabled, full, color, outline, sm }) {
  const bg = outline ? 'transparent' : disabled ? '#1a1f2e' : (color || 'linear-gradient(135deg,#6c63ff,#8b85ff)');
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: full ? '100%' : 'auto',
      background: bg,
      border: outline ? '1.5px solid #6c63ff' : 'none',
      color: disabled ? '#3a3f55' : outline ? '#6c63ff' : '#fff',
      borderRadius: 14, padding: sm ? '9px 16px' : '14px 22px',
      fontSize: sm ? 13 : 15, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1,
      letterSpacing: .3,
      WebkitTapHighlightColor: 'transparent',
      transition: 'opacity .15s, transform .1s',
      boxShadow: !disabled && !outline ? '0 4px 20px #6c63ff33' : 'none',
    }}>
      {children}
    </button>
  );
}

function ErrBox({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      background: '#1e0a0a', border: '1px solid #5a1010',
      color: '#f87171', borderRadius: 12, padding: '12px 14px',
      fontSize: 13, marginBottom: 14, lineHeight: 1.6,
    }}>
      {msg}
    </div>
  );
}

function InfoBox({ msg, color = '#f59e0b' }) {
  if (!msg) return null;
  return (
    <div style={{
      background: color + '15', border: `1px solid ${color}44`,
      color, borderRadius: 12, padding: '12px 14px',
      fontSize: 13, marginBottom: 14, lineHeight: 1.6,
    }}>
      {msg}
    </div>
  );
}

function Toast({ msg, color = '#10b981' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 82, left: '50%', transform: 'translateX(-50%)',
      background: color, color: '#fff', borderRadius: 16,
      padding: '11px 24px', fontSize: 14, fontWeight: 700,
      zIndex: 9999, whiteSpace: 'nowrap',
      boxShadow: `0 6px 30px ${color}55`,
      animation: 'fadeUp .25s ease',
    }}>
      {msg}
    </div>
  );
}

function Loader({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 0' }}>
      <div style={{ width: 44, height: 44, border: '3px solid #242938', borderTopColor: '#6c63ff', borderRadius: '50%', margin: '0 auto 14px', animation: 'spin .7s linear infinite' }} />
      <div style={{ color: '#f59e0b', fontWeight: 600, fontSize: 14 }}>{label}</div>
      <div style={{ color: '#545d78', fontSize: 12, marginTop: 6 }}>Ambil masa 15–30 saat…</div>
    </div>
  );
}

function Badge({ label, color, bg }) {
  return (
    <span style={{
      background: bg, color, fontSize: 10, fontWeight: 700,
      padding: '3px 9px', borderRadius: 99, letterSpacing: .5,
    }}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE FORM (shared between Record & Upload)
// ─────────────────────────────────────────────────────────────────────────────
function GenForm({ t, transcript, lang, onSaved }) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('sop');
  const [phase, setPhase] = useState('idle'); // idle | loading | done
  const [result, setResult] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!transcript || transcript.trim().length < 10) { setErr(t.errNoText); return; }
    if (!title.trim()) { setErr(t.errTitle); return; }
    setErr(''); setPhase('loading');
    try {
      const doc = await makeDoc(transcript.trim(), title.trim(), docType, lang);
      const newDoc = {
        id: Date.now(), title: title.trim(), type: docType,
        transcript: transcript.trim(), document: doc, lang,
        source: 'record', date: new Date().toLocaleDateString('ms-MY'),
      };
      storage.add(newDoc);
      setResult(doc);
      setPhase('done');
      if (onSaved) onSaved();
    } catch (e) {
      setErr(t.errApi + ' (' + e.message + ')');
      setPhase('idle');
    }
  }

  function copy() {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  if (phase === 'loading') return <Card><Loader label={t.formGenerating} /></Card>;

  if (phase === 'done' && result) return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
        <div>
          <div style={{ color: '#10b981', fontWeight: 700, fontSize: 15 }}>✅ {t.formDone}</div>
          <div style={{ color: '#545d78', fontSize: 12, marginTop: 4 }}>📁 {t.formSaved}</div>
        </div>
        <PBtn sm outline onClick={copy}>{copied ? '✓ ' + t.copied : t.copy}</PBtn>
      </div>
      <pre style={{
        background: '#0a0c10', borderRadius: 14, padding: 16,
        fontSize: 12.5, lineHeight: 1.9, whiteSpace: 'pre-wrap',
        overflowY: 'auto', maxHeight: 420, color: '#c8d0e8',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {result}
      </pre>
      <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
        <PBtn sm outline onClick={() => { setPhase('idle'); setResult(''); setTitle(''); }}>
          ↩ Jana Lagi
        </PBtn>
      </div>
    </Card>
  );

  return (
    <Card>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ background: 'linear-gradient(135deg,#6c63ff,#22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          ✨ {t.formTitle}
        </span>
      </div>

      <label style={LS}>{t.formName}</label>
      <input
        value={title} onChange={e => setTitle(e.target.value)}
        placeholder={t.formNamePh}
        style={{ ...IS, marginBottom: 16 }}
      />

      <label style={LS}>{t.formType}</label>
      <select value={docType} onChange={e => setDocType(e.target.value)} style={{ ...IS, marginBottom: 18 }}>
        {t.formTypes.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
      </select>

      <ErrBox msg={err} />
      <PBtn full onClick={generate} disabled={!transcript || transcript.trim().length < 10 || !title.trim()}>
        {t.formBtn}
      </PBtn>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState(0);
  const [lang, setLang] = useState('bm');
  const [installEvt, setInstallEvt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const t = STRINGS[lang];

  useEffect(() => {
    const h = e => { e.preventDefault(); setInstallEvt(e); setShowBanner(true); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  return (
    <>
      <Head>
        <title>TrainingAI</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no" />
        <meta name="theme-color" content="#6c63ff" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TrainingAI" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </Head>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

        {/* Install Banner */}
        {showBanner && (
          <div style={{ background: 'linear-gradient(90deg,#1a1640,#1a2050)', borderBottom: '1px solid #2e3448', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ flex: 1, fontSize: 13 }}>{t.installMsg}</span>
            <PBtn sm onClick={() => { installEvt?.prompt(); setShowBanner(false); }}>{t.installBtn}</PBtn>
            <button onClick={() => setShowBanner(false)} style={{ background: 'none', border: 'none', color: '#545d78', fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>
        )}

        {/* Header */}
        <header style={{
          background: '#0f1218',
          borderBottom: '1px solid #1e2230',
          padding: '0 18px', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg,#6c63ff,#22d3ee)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>🧠</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -.3 }}>{t.appName}</div>
              <div style={{ fontSize: 10, color: '#545d78', marginTop: -1, letterSpacing: .3 }}>{t.tagline}</div>
            </div>
          </div>
          <button onClick={() => setLang(l => l === 'bm' ? 'en' : 'bm')} style={{
            background: '#1a1640', border: '1px solid #3a3570',
            color: '#8b85ff', borderRadius: 10, padding: '6px 12px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: .5,
          }}>
            {lang === 'bm' ? '🇬🇧 EN' : '🇲🇾 BM'}
          </button>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 4px', WebkitOverflowScrolling: 'touch' }}>
          <div className="tab-content" key={tab}>
            {tab === 0 && <RecordTab t={t} lang={lang} />}
            {tab === 1 && <UploadTab t={t} lang={lang} />}
            {tab === 2 && <DocsTab t={t} />}
            {tab === 3 && <ChatTab t={t} lang={lang} />}
          </div>
        </main>

        {/* Bottom Navigation */}
        <nav style={{
          background: '#0f1218',
          borderTop: '1px solid #1e2230',
          display: 'flex', flexShrink: 0,
          paddingBottom: 'env(safe-area-inset-bottom,0px)',
        }}>
          {t.tabs.map((label, i) => {
            const active = tab === i;
            return (
              <button key={i} onClick={() => setTab(i)} style={{
                flex: 1, padding: '11px 0 9px',
                background: 'none', border: 'none',
                borderTop: active ? '2px solid #6c63ff' : '2px solid transparent',
                color: active ? '#8b85ff' : '#545d78',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'color .2s',
              }}>
                <span style={{ fontSize: 20 }}>{t.tabIcons[i]}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: .3 }}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: RECORD
// ─────────────────────────────────────────────────────────────────────────────
function RecordTab({ t, lang }) {
  const [phase, setPhase] = useState('idle'); // idle | rec
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [err, setErr] = useState('');
  const [toast, setToast] = useState(null);
  const recRef = useRef(null);
  const timerRef = useRef(null);
  const liveRef = useRef('');

  const showToast = (msg, color) => { setToast({ msg, color }); setTimeout(() => setToast(null), 2500); };

  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr(t.errSpeech); return; }
    setErr(''); setTranscript(''); liveRef.current = ''; setElapsed(0);

    const r = new SR();
    r.continuous = true; r.interimResults = true;
    r.lang = lang === 'bm' ? 'ms-MY' : 'en-US';
    recRef.current = r;

    r.onresult = e => {
      let s = '';
      for (let i = 0; i < e.results.length; i++) s += (e.results[i][0]?.transcript || '') + ' ';
      liveRef.current = s.trim();
      setTranscript(s.trim());
    };
    r.onerror = e => { setErr('Mic error: ' + e.error); stop(); };
    r.start(); setPhase('rec');

    timerRef.current = setInterval(() => {
      setElapsed(p => {
        if (p + 1 >= MAX_REC) { stop(); return MAX_REC; }
        return p + 1;
      });
    }, 1000);
  }

  function stop() {
    recRef.current?.stop();
    clearInterval(timerRef.current);
    setPhase('idle');
  }

  const pct = elapsed / MAX_REC;
  const R = 52, C = 2 * Math.PI * R;

  return (
    <div>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      {/* Recorder Card */}
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{t.recCard}</div>
          <div style={{ fontSize: 12, color: '#545d78', marginTop: 5, lineHeight: 1.6 }}>{t.recHint}</div>
        </div>

        {/* Ring Timer */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
          <div style={{ position: 'relative' }}>
            <svg width={126} height={126} style={{ filter: phase === 'rec' ? 'drop-shadow(0 0 14px #ef444466)' : 'drop-shadow(0 0 10px #6c63ff33)' }}>
              <circle cx={63} cy={63} r={R} fill="none" stroke="#1a1f2e" strokeWidth={9} />
              <circle cx={63} cy={63} r={R} fill="none"
                stroke={phase === 'rec' ? '#ef4444' : 'url(#grad)'}
                strokeWidth={9} strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)}
                strokeLinecap="round" transform="rotate(-90 63 63)"
                style={{ transition: 'stroke-dashoffset .5s ease' }} />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6c63ff" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: phase === 'rec' ? '#ef4444' : '#e8ecf7', fontFamily: "'JetBrains Mono', monospace" }}>{fmt(elapsed)}</span>
              <span style={{ fontSize: 10, color: '#545d78' }}>/ {fmt(MAX_REC)}</span>
            </div>
          </div>
        </div>

        {/* Status */}
        {phase === 'rec' && (
          <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 13, fontWeight: 700, marginBottom: 16, animation: 'pulse 1.3s infinite' }}>
            ● {t.recLive} &nbsp;·&nbsp; {fmt(MAX_REC - elapsed)} {t.recLeft}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {phase !== 'rec' && (
            <PBtn full onClick={start}>🎙️ {t.recStart}</PBtn>
          )}
          {phase === 'rec' && (
            <PBtn full onClick={stop} color="#ef4444">⏹ {t.recStop}</PBtn>
          )}
        </div>
      </Card>

      {/* Transcript — editable */}
      {transcript.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={LS}>{t.txLabel}</label>
            <span style={{ fontSize: 11, color: '#545d78' }}>{transcript.length} {lang === 'bm' ? 'aksara' : 'chars'}</span>
          </div>
          <textarea
            value={transcript}
            onChange={e => { setTranscript(e.target.value); liveRef.current = e.target.value; }}
            rows={5}
            style={{ ...IS, resize: 'vertical', lineHeight: 1.8, marginBottom: 8 }}
          />
          <div style={{ fontSize: 11, color: '#545d78' }}>{t.recEdit}</div>
        </Card>
      )}

      <ErrBox msg={err} />

      {/* Generate form — only show if we have transcript */}
      {transcript.trim().length > 10 && (
        <GenForm t={t} transcript={transcript} lang={lang} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: UPLOAD
// ─────────────────────────────────────────────────────────────────────────────
function UploadTab({ t, lang }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  function readFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.txt')) { setErr(t.errFileType); return; }
    setErr('');
    const reader = new FileReader();
    reader.onload = e => setText(e.target.result || '');
    reader.onerror = () => setErr('Gagal baca fail.');
    reader.readAsText(file, 'UTF-8');
  }

  function clear() { setText(''); setErr(''); if (fileRef.current) fileRef.current.value = ''; }

  return (
    <div>
      <Card>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{t.upCard}</div>
        <div style={{ fontSize: 12, color: '#545d78', marginBottom: 20, lineHeight: 1.6 }}>{t.upHint}</div>

        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${drag ? '#6c63ff' : '#2e3448'}`,
            borderRadius: 16, padding: '28px 20px', textAlign: 'center',
            cursor: 'pointer', background: drag ? '#1a164022' : 'transparent',
            transition: 'all .2s', marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: drag ? '#8b85ff' : '#e8ecf7', marginBottom: 4 }}>{t.upDropTitle}</div>
          <div style={{ fontSize: 12, color: '#545d78' }}>{t.upDropSub}</div>
          <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={e => readFile(e.target.files[0])} style={{ display: 'none' }} />
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: '#1e2230' }} />
          <span style={{ fontSize: 11, color: '#545d78', fontWeight: 700, letterSpacing: 1 }}>{t.upOr}</span>
          <div style={{ flex: 1, height: 1, background: '#1e2230' }} />
        </div>

        {/* Paste */}
        <label style={LS}>{t.upPasteLabel}</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t.upPastePh}
          rows={7}
          style={{ ...IS, resize: 'vertical', lineHeight: 1.8, marginBottom: 8 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#545d78' }}>{text.length.toLocaleString()} {t.upChars}</span>
          {text.length > 0 && (
            <button onClick={clear} style={{ background: 'none', border: 'none', color: '#545d78', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              🗑 {t.upClear}
            </button>
          )}
        </div>
      </Card>

      <ErrBox msg={err} />

      {text.trim().length > 10 && (
        <GenForm t={t} transcript={text} lang={lang} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
function DocsTab({ t }) {
  const [docs, setDocs] = useState([]);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { setDocs(storage.get()); }, []);

  const showToast = (msg, color) => { setToast({ msg, color }); setTimeout(() => setToast(null), 2500); };

  function del(id, e) {
    e.stopPropagation();
    if (!confirm(t.docsDeleteConfirm)) return;
    setDocs(storage.del(id));
    if (sel?.id === id) setSel(null);
  }

  const ICON = { sop: '📋', faq: '❓', user_guide: '📘', summary: '📝' };
  const srcBadge = s => s === 'upload'
    ? { label: `📤 ${t.docsUp}`, color: '#10b981', bg: '#0a2018' }
    : { label: `🎙️ ${t.docsRec}`, color: '#6c63ff', bg: '#1a1640' };

  if (docs.length === 0) return (
    <Card style={{ textAlign: 'center', padding: '50px 20px' }}>
      <div style={{ fontSize: 50, marginBottom: 14 }}>📭</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{t.docsEmpty}</div>
      <div style={{ color: '#545d78', fontSize: 13, lineHeight: 1.7 }}>{t.docsEmptySub}</div>
    </Card>
  );

  if (sel) {
    const b = srcBadge(sel.source);
    return (
      <div>
        {toast && <Toast msg={toast.msg} color={toast.color} />}
        <button onClick={() => setSel(null)} style={{
          background: 'none', border: 'none', color: '#6c63ff',
          fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 14, padding: 0,
        }}>
          {t.docsBack}
        </button>
        <Card>
          {/* Doc header */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{ICON[sel.type]}</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>{sel.title}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge label={b.label} color={b.color} bg={b.bg} />
              <Badge label={sel.type.replace('_', ' ').toUpperCase()} color="#9aa3bc" bg="#1a1f2e" />
              <span style={{ fontSize: 11, color: '#545d78' }}>{sel.date}</span>
            </div>
          </div>

          {/* Copy button */}
          <PBtn sm outline onClick={() => {
            navigator.clipboard.writeText(sel.document).then(() => showToast(t.docsCopied, '#6c63ff'));
          }}>
            📋 {t.docsCopyDoc}
          </PBtn>

          {/* Document */}
          <div style={{ marginTop: 16 }}>
            <label style={LS}>{sel.type.replace('_', ' ').toUpperCase()}</label>
            <pre style={{
              background: '#0a0c10', borderRadius: 14, padding: 16,
              fontSize: 12.5, lineHeight: 1.9, whiteSpace: 'pre-wrap',
              overflowY: 'auto', maxHeight: 400, color: '#c8d0e8',
              fontFamily: "'JetBrains Mono', monospace", border: '1px solid #1e2230',
            }}>
              {sel.document}
            </pre>
          </div>

          {/* Transcript accordion */}
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#545d78', fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase', userSelect: 'none', padding: '8px 0' }}>
              {t.docsTranscript}
            </summary>
            <div style={{ background: '#0a0c10', borderRadius: 12, padding: 12, fontSize: 12.5, color: '#9aa3bc', marginTop: 8, maxHeight: 160, overflowY: 'auto', lineHeight: 1.8, border: '1px solid #1e2230' }}>
              {sel.transcript}
            </div>
          </details>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {toast && <Toast msg={toast.msg} color={toast.color} />}
      {docs.map(doc => {
        const b = srcBadge(doc.source);
        return (
          <div key={doc.id} className="card" onClick={() => setSel(doc)} style={{
            background: 'linear-gradient(135deg,#1a1f2e,#141820)',
            border: '1px solid #242938', borderRadius: 20,
            padding: '16px 16px', marginBottom: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14,
            transition: 'border-color .2s',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: '#0a0c10', border: '1px solid #1e2230',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }}>
              {ICON[doc.type] || '📄'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                {doc.title}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge label={b.label} color={b.color} bg={b.bg} />
                <span style={{ fontSize: 10, color: '#545d78' }}>{doc.date}</span>
              </div>
            </div>
            <button onClick={e => del(doc.id, e)} style={{
              background: 'none', border: 'none', color: '#2e3448',
              fontSize: 20, cursor: 'pointer', flexShrink: 0, padding: 6,
              borderRadius: 10, transition: 'color .2s',
            }}>🗑</button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4: CHATBOT
// ─────────────────────────────────────────────────────────────────────────────
function ChatTab({ t, lang }) {
  const [docs, setDocs] = useState([]);
  const [srcId, setSrcId] = useState('all');
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { setDocs(storage.get()); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

  function buildContext() {
    const all = storage.get();
    const rel = srcId === 'all' ? all : all.filter(d => String(d.id) === srcId);
    if (!rel.length) return lang === 'bm' ? 'Tiada dokumen tersedia.' : 'No documents available.';
    return rel.map(d =>
      `### ${d.title} [${d.type.toUpperCase()} | ${d.source === 'upload' ? 'Upload' : 'Rakaman'}]\n\n**Transkrip:**\n${d.transcript}\n\n**Dokumen:**\n${d.document}`
    ).join('\n\n---\n\n');
  }

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    const userMsg = { role: 'user', content: q };
    const history = [...msgs, userMsg];
    setMsgs(history); setInput(''); setLoading(true);
    inputRef.current?.blur();

    const sys = lang === 'bm'
      ? `Anda adalah pembantu latihan AI yang bijak, mesra, dan membantu. Anda mempunyai akses kepada bahan latihan syarikat berikut:\n\n${buildContext()}\n\nArahan penting:\n- Jawab dalam Bahasa Melayu\n- Berikan jawapan yang jelas, tersusun dan mudah difahami\n- Guna nombor atau bullet point untuk langkah-langkah\n- Jika soalan tidak berkaitan dengan bahan latihan, jawab dengan sopan bahawa anda hanya boleh menjawab soalan berkaitan latihan\n- Jika maklumat tidak ada dalam bahan, beritahu pengguna dengan jelas`
      : `You are a smart, friendly, and helpful AI training assistant. You have access to the following company training materials:\n\n${buildContext()}\n\nImportant instructions:\n- Answer in English\n- Give clear, organized, easy-to-understand answers\n- Use numbers or bullet points for steps\n- If the question is unrelated to training materials, politely explain you can only answer training-related questions\n- If information is not in the materials, clearly inform the user`;

    try {
      const reply = await aiCall(history, sys);
      setMsgs([...history, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMsgs([...history, { role: 'assistant', content: `⚠️ ${t.errApi}\n\n_${e.message}_` }]);
    }
    setLoading(false);
  }

  const ICON = { sop: '📋', faq: '❓', user_guide: '📘', summary: '📝' };
  const allDocs = storage.get();

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Source selector */}
      <Card style={{ marginBottom: 12 }}>
        <label style={LS}>{t.chatSrcLabel}</label>
        <select
          value={srcId}
          onChange={e => { setSrcId(e.target.value); setDocs(storage.get()); }}
          style={IS}
        >
          <option value="all">{t.chatAllDocs} ({allDocs.length})</option>
          {allDocs.map(d => (
            <option key={d.id} value={String(d.id)}>
              {ICON[d.type]} {d.title}
            </option>
          ))}
        </select>
        {allDocs.length === 0 && (
          <div style={{ marginTop: 10, background: '#1a120a', border: '1px solid #4a2a10', color: '#f59e0b', borderRadius: 10, padding: '10px 12px', fontSize: 12, lineHeight: 1.6 }}>
            ⚠️ {t.chatNoDocs}
          </div>
        )}
      </Card>

      {/* Chat window */}
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
        {/* Messages */}
        <div style={{
          height: 360, overflowY: 'auto', padding: '14px 14px 10px',
          display: 'flex', flexDirection: 'column', gap: 12,
          WebkitOverflowScrolling: 'touch',
        }}>
          {msgs.length === 0 && (
            <div style={{
              textAlign: 'center', color: '#545d78', paddingTop: 40,
              fontSize: 13, lineHeight: 1.9, whiteSpace: 'pre-line',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
              {t.chatWelcome}
            </div>
          )}

          {msgs.map((m, i) => {
            const isUser = m.role === 'user';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                {!isUser && (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#6c63ff,#22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginRight: 8, marginTop: 2 }}>
                    🤖
                  </div>
                )}
                <div style={{
                  maxWidth: '80%',
                  padding: '11px 15px',
                  borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                  background: isUser ? 'linear-gradient(135deg,#2a1e6a,#1a1640)' : '#0f1218',
                  border: isUser ? '1px solid #3a2e8a' : '1px solid #1e2230',
                  color: '#e8ecf7', fontSize: 13.5, lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#6c63ff,#22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🤖</div>
              <div style={{ background: '#0f1218', border: '1px solid #1e2230', borderRadius: '4px 18px 18px 18px', padding: '11px 16px', color: '#545d78', fontSize: 13, animation: 'pulse 1.2s infinite' }}>
                ⏳ {t.chatThinking}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Clear + Input */}
        {msgs.length > 0 && (
          <div style={{ padding: '4px 14px 0', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setMsgs([])} style={{ background: 'none', border: 'none', color: '#545d78', fontSize: 11, cursor: 'pointer', fontWeight: 600, letterSpacing: .3 }}>
              🗑 {t.chatClear}
            </button>
          </div>
        )}

        <div style={{
          borderTop: '1px solid #1e2230',
          padding: '10px 12px',
          display: 'flex', gap: 8,
          background: '#141820',
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={t.chatPh}
            style={{ ...IS, flex: 1, padding: '11px 14px', borderRadius: 12 }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim() || allDocs.length === 0}
            style={{
              width: 48, flexShrink: 0,
              background: loading || !input.trim() || allDocs.length === 0
                ? '#1a1f2e'
                : 'linear-gradient(135deg,#6c63ff,#8b85ff)',
              border: 'none', borderRadius: 12, color: '#fff', fontSize: 20,
              cursor: loading || !input.trim() || allDocs.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: !loading && input.trim() && allDocs.length > 0 ? '0 4px 16px #6c63ff44' : 'none',
            }}
          >
            ➤
          </button>
        </div>
      </Card>
    </div>
  );
}
