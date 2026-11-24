'use strict';
// Tiny HTML helpers. Every page is server-rendered, works with no JavaScript,
// and stays a few KB so it loads on a weak 2G/3G or overloaded connection.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Inline CSS (no external files, no web fonts: system Arabic fonts only).
const CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:Tahoma,"Segoe UI","Noto Naskh Arabic",Arial,sans-serif;background:#f4f1ea;color:#1d1d1b;line-height:1.6;font-size:17px}
header{background:#14532d;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
header a{color:#fff;text-decoration:none;font-weight:bold}
main{max-width:720px;margin:0 auto;padding:16px}
h1{font-size:1.4em;margin:.3em 0}h2{font-size:1.15em;margin:.8em 0 .3em}
.card{background:#fff;border:1px solid #ddd6c8;border-radius:10px;padding:14px;margin:12px 0}
label{display:block;margin:8px 0 2px;font-weight:bold}
input,select,textarea{width:100%;min-height:44px;padding:10px;font-size:1em;border:1px solid #b9b2a3;border-radius:8px;background:#fff;font-family:inherit}
button,.btn{display:inline-block;min-height:44px;min-width:44px;padding:10px 16px;font-size:1em;border:0;border-radius:8px;background:#14532d;color:#fff;cursor:pointer;text-decoration:none;font-family:inherit;margin:4px 0}
.btn2{background:#e7e2d6;color:#1d1d1b}.warn{background:#9a3412}.big{font-size:1.25em;padding:14px 22px;width:100%}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #b45309;outline-offset:2px}
a:focus,button:focus,input:focus,select:focus,textarea:focus{outline:3px solid #b45309;outline-offset:2px}
header a{display:inline-block;padding:8px 4px;min-height:44px}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.row form{margin:0}
.num{font-size:4.5em;font-weight:bold;text-align:center;color:#14532d;line-height:1.1}
.muted{color:#6b6556;font-size:.9em}.ok{color:#14532d;font-weight:bold}.bad{color:#9a3412;font-weight:bold}
.notice{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:10px;margin:10px 0}
.called{background:#dcfce7;border:2px solid #16a34a}
table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #eee;text-align:right}
.screen{background:#0b2e1a;color:#fff;min-height:100vh;text-align:center;padding:20px}
.screen .num{color:#facc15;font-size:9em}.screen h2{font-size:2em}
`;

function page(title, body, { refresh, bare, nav = '', css = '' } = {}) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${refresh ? `<meta http-equiv="refresh" content="${refresh}">` : ''}
<title>${esc(title)} · دور</title><style>${CSS}${css}</style></head><body>
${bare ? body : `<header><a href="/" aria-label="دور — الرئيسية"><span aria-hidden="true">🎫</span> دور</a><nav>${nav}</nav></header><main id="main">${body}</main>`}
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
