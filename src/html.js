'use strict';
// Tiny HTML helpers. Every page is server-rendered, works with no JavaScript,
// and stays a few KB so it loads on a weak 2G/3G or overloaded connection.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Inline CSS (no external files; Readex Pro is self-hosted).
const FAVICON = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"%3E%3Crect width="16" height="16" rx="3" fill="#14532d"/%3E%3Cpath fill="#facc15" d="M2 4h12v2.6a1.4 1.4 0 0 0 0 2.8V12H2V9.4a1.4 1.4 0 0 0 0-2.8z"/%3E%3Cpath fill="#14532d" d="M10 5.3h1v1h-1zm0 2.2h1v1h-1zm0 2.2h1v1h-1zM4 6.6h4.5v1.3H4zm1.5 2H8.5v1.2h-3z"/%3E%3C/svg%3E';
const CSS = `
*{box-sizing:border-box}
@font-face{font-family:"Readex Pro";src:url(/font/readex-ar.woff2) format("woff2");font-weight:400 700;font-display:swap}
body{margin:0;font-family:"Readex Pro",Tahoma,"Segoe UI","Noto Naskh Arabic",Arial,sans-serif;background:#f4f1ea;color:#1d1d1b;line-height:1.6;font-size:17px}
header{background:#14532d;color:#fff;padding:6px 16px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;border-bottom:4px solid #facc15}
header a{color:#fff;text-decoration:none;font-weight:bold;display:inline-block;padding:8px 4px;min-height:44px}
header nav a{font-weight:normal;margin-right:8px}
.logo{font-size:1.5em;line-height:28px;display:flex;align-items:center;gap:8px}.logo svg{width:42px;height:28px}
main{max-width:720px;margin:0 auto;padding:16px}
h1{font-size:1.5em;line-height:1.3;margin:.4em 0 .2em;color:#14532d}h2{font-size:1.15em;margin:.6em 0 .3em}
.card{background:#fff;border:1px solid #ddd6c8;border-radius:10px;padding:16px;margin:14px 0;box-shadow:0 2px 0 #ddd6c8}
.card>h2:first-child{margin-top:0}
label{display:block;margin:10px 0 4px;font-weight:bold}
input,select,textarea{width:100%;min-height:48px;padding:10px 12px;font-size:1em;border:1px solid #8a8373;border-radius:8px;background:#fff;font-family:inherit;color:inherit}
button,.btn{display:inline-block;min-height:48px;min-width:44px;padding:10px 18px;font-size:1em;border:0;border-radius:8px;background:#14532d;color:#fff;cursor:pointer;text-decoration:none;font-family:inherit;font-weight:bold;margin:4px 0;box-shadow:inset 0 -3px 0 rgba(0,0,0,.25);text-align:center}
.btn2{background:#e7e2d6;color:#1d1d1b;box-shadow:inset 0 -3px 0 #ccc4b3}.warn{background:#9a3412}.big{font-size:1.2em;padding:14px 22px;width:100%;min-height:56px}
a{color:#14532d}
a:focus,button:focus,input:focus,select:focus,textarea:focus{outline:3px solid #b45309;outline-offset:2px}
header a{display:inline-block;padding:8px 4px;min-height:44px}
header a:focus,header a:focus-visible{outline-color:#facc15}
main p>a:only-child{display:inline-block;min-height:44px;padding:10px 0}
.tw{overflow-x:auto}th[scope=row]{font-weight:normal}
.vh{position:absolute;margin:-1px;padding:0;border:0;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.row form{margin:0}
.num{font-size:4.5em;font-weight:bold;text-align:center;color:#14532d;line-height:1.05;letter-spacing:-.02em}
.muted{color:#5c5648;font-size:.9em}.ok{color:#14532d;font-weight:bold}.bad{color:#9a3412;font-weight:bold}
.notice{background:#fef3c7;border:1px solid #f59e0b;border-right-width:6px;border-radius:8px;padding:10px 12px;margin:10px 0;font-weight:bold;color:#78350f}
.called{background:#dcfce7;border:2px solid #16a34a}
.tkt{position:relative;text-align:center;border:0;border-radius:14px;padding:20px 22px;box-shadow:0 3px 0 #ddd6c8;border-top:10px solid #14532d}
.tkt.called{border:0;border-top:10px solid #16a34a;background:#dcfce7}
.tkt .num{font-size:5.5em}.tkt table td{text-align:right}.tkt table td+td{text-align:left}
.perf{position:relative;border-top:3px dashed #c9c1b0;margin:16px -8px 8px}
.perf:before,.perf:after{content:"";position:absolute;top:-16px;width:28px;height:28px;border-radius:50%;background:#f4f1ea}.perf:before{right:-28px}.perf:after{left:-28px}
.st{display:inline-block;padding:4px 16px;border-radius:999px;background:#dbeafe;color:#1e3a8a;font-size:1.05em;margin:6px 0}
.called .st{background:#14532d;color:#fff}
table{width:100%;border-collapse:collapse}td,th{padding:8px 6px;border-bottom:1px solid #ece6da;text-align:right}th{color:#5c5648;font-size:.9em}
.screen{background:#0b2e1a;color:#fff;min-height:100vh;text-align:center;padding:24px}
.screen h1{color:#fff;font-size:2.4em;border-bottom:6px solid #facc15;display:inline-block;padding:0 24px 8px}
.screen .num{color:#facc15;font-size:9em}.screen h2{font-size:2em;margin:.6em 0 0}.screen p{font-size:1.4em}
`;

function page(title, body, { refresh, bare, nav = '', css = '' } = {}) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="${FAVICON}">
${refresh ? `<meta http-equiv="refresh" content="${refresh}">` : ''}
<title>${esc(title)} · دور</title><style>${CSS}${css}</style></head><body>
${bare ? body : `<header><a href="/" aria-label="دور — الرئيسية"><span class="logo"><svg aria-hidden="true" viewBox="0 0 240 160"><path fill="#facc15" d="M28 20H212A18 18 0 0 1 230 38V64A16 16 0 0 0 230 96V122A18 18 0 0 1 212 140H28A18 18 0 0 1 10 122V96A16 16 0 0 0 10 64V38A18 18 0 0 1 28 20Z"/><path stroke="#14532d" stroke-width="8" stroke-linecap="round" stroke-dasharray="1 16" d="M168 40V120"/><circle cx="199" cy="80" r="16" fill="#14532d"/></svg>دور</span></a><nav>${nav}</nav></header><main id="main">${body}</main>`}
</body></html>`;
}

// A POST form with a single button (used for all actions so nothing needs JS).
const action = (url, label, cls = '', hidden = {}) =>
  `<form method="post" action="${esc(url)}">${Object.entries(hidden)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}<button class="${cls}">${label}</button></form>`;

const mins = (m) => {
  m = Math.round(m);
  if (m < 1) return 'أقل من دقيقة';
  if (m < 60) return `${m} دقيقة`;
  const h = Math.floor(m / 60), r = m % 60;
  return `${h} ساعة${r ? ` و ${r} دقيقة` : ''}`;
};

module.exports = { esc, page, action, mins };
