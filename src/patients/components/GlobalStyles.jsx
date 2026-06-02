const FONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap')`;

export default function GlobalStyles({ dark }) {
  const bg       = dark ? "#0f1117" : "#f8fafc";
  const surface  = dark ? "#1a1d27" : "#ffffff";
  const surface2 = dark ? "#22263a" : "#f1f5f9";
  const border   = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const text     = dark ? "#e8eaf0" : "#0f172a";
  const muted    = dark ? "#8891a8" : "#64748b";
  const accent   = "#4f7cff";

  return (
    <style>{`
      ${FONTS}
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      .crm-root {
        font-family: 'DM Sans', sans-serif;
        background: ${bg};
        color: ${text};
        min-height: 100vh;
        --bg: ${bg};
        --surface: ${surface};
        --surface2: ${surface2};
        --border: ${border};
        --text: ${text};
        --muted: ${muted};
        --accent: ${accent};
        --accent-soft: ${dark ? "rgba(79,124,255,0.15)" : "rgba(79,124,255,0.1)"};
        --red: #ef4444;
        --green: #22c55e;
        --amber: #f59e0b;
        transition: background 0.2s, color 0.2s;
      }
      .crm-root *, input, select, textarea, button { font-family: 'DM Sans', sans-serif; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${muted}33; border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: ${muted}55; }

      /* ── Buttons ── */
      .btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 500;
        cursor: pointer; border: none; transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .btn-primary { background: var(--accent); color: #fff; box-shadow: 0 2px 8px rgba(79,124,255,0.25); }
      .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,124,255,0.35); }
      .btn-primary:active { transform: translateY(0); }
      .btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); }
      .btn-ghost:hover { background: var(--surface2); color: var(--text); border-color: var(--muted); }
      .btn-danger { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
      .btn-danger:hover { background: #fecaca; }

      /* ── Inputs ── */
      input[type=text], input[type=search], select, textarea {
        background: var(--surface); border: 1px solid var(--border);
        color: var(--text); border-radius: 10px;
        padding: 10px 14px; font-size: 14px; outline: none; transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      input[type=text]:focus, input[type=search]:focus, select:focus, textarea:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-soft), 0 2px 8px rgba(79,124,255,0.15);
      }

      /* ── Atoms ── */
      .badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap; }
      .tag   { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 500; }
      .chip  { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.01em; }
      .card  { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
      .divider { border: none; border-top: 1px solid var(--border); }
      .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mono { font-family: 'DM Mono', monospace; }

      /* ── Avatar ── */
      .avatar    { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .avatar-lg { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.12); }

      /* ── Layout helpers ── */
      .row { display: flex; align-items: center; }
      .col { display: flex; flex-direction: column; }
      .gap-2  { gap: 2px;  } .gap-4  { gap: 4px;  } .gap-6  { gap: 6px;  }
      .gap-8  { gap: 8px;  } .gap-12 { gap: 12px; } .gap-16 { gap: 16px; }
      .section-label {
        font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
        text-transform: uppercase; color: var(--muted); margin-bottom: 10px;
      }

      /* ── Table ── */
      .hover-row:hover  { background: var(--surface2); }
      .selected-row     { background: var(--accent-soft) !important; }

      /* ── Animations ── */
      @keyframes slideIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      .slide-in { animation: slideIn 0.3s ease; }
      .fade-in  { animation: fadeIn  0.3s ease; }
      .scale-in { animation: scaleIn 0.2s ease; }

      /* ── Responsive ── */
      @media (max-width: 768px) { .desktop-only { display: none !important; } }
      @media (min-width: 769px) { .mobile-only  { display: none !important; } }

      /* ── Privacy ── */
      .privacy-blur { filter: blur(5px); transition: filter 0.2s; user-select: none; }
      .privacy-blur:hover { filter: blur(0); }
      .privacy-screen::after {
        content: '';
        position: fixed; inset: 0; z-index: 9000;
        background: repeating-linear-gradient(
          45deg,
          rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px,
          transparent 1px, transparent 8px
        );
        pointer-events: none;
      }
    `}</style>
  );
}
