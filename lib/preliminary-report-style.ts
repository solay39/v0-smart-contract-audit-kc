export const PRELIMINARY_REPORT_STYLE = `
.s39-report{--r-bg:#070b10;--r-panel:#0d131c;--r-line:#263242;--r-muted:#a1afc1;--r-text:#e7edf5;--r-green:#56edac;min-height:100dvh;background:var(--r-bg);color:var(--r-text);font:14px/1.65 var(--font-sans,monospace);overflow-wrap:anywhere}
.s39-report *{box-sizing:border-box}.s39-report a{color:var(--r-green);text-decoration:none}.s39-report a:hover{text-decoration:underline}
.s39-report a:focus-visible,.s39-report button:focus-visible,.s39-report summary:focus-visible{outline:2px solid var(--r-green);outline-offset:4px}
.s39-report button{font:inherit;cursor:pointer}.s39-report .r-shell{max-width:1280px;margin:auto;padding:0 36px}
.s39-report .r-top{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--r-line);min-height:80px}
.s39-report .r-brand{font-size:18px;font-weight:800;letter-spacing:.12em;color:var(--r-text)}
.s39-report .r-brand small{display:block;font-size:10px;letter-spacing:.18em;color:var(--r-muted);font-weight:400}
.s39-report .r-back{display:inline-flex;min-height:44px;align-items:center;font-size:12px}
.s39-report .r-layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:44px}.s39-report .r-index{padding-top:40px}
.s39-report .r-nav{position:sticky;top:24px;display:grid;gap:4px}
.s39-report .r-nav a{display:flex;align-items:center;min-height:44px;padding:8px 12px;color:var(--r-muted);border-left:1px solid var(--r-line);font-size:12px}
.s39-report .r-nav a:hover{color:var(--r-green);border-color:var(--r-green);background:#11221e;text-decoration:none}
.s39-report .r-content{min-width:0;padding:40px 0 56px}.s39-report h1,.s39-report h2,.s39-report h3,.s39-report p{margin:0}
.s39-report h1{font-size:38px;line-height:1.2;letter-spacing:-.04em;margin:14px 0 10px;font-weight:800}
.s39-report h2{font-size:20px;line-height:1.35;letter-spacing:-.025em;font-weight:700}.s39-report h3{font-size:16px;line-height:1.5;font-weight:650}
.s39-report .r-kicker{font-size:10px;letter-spacing:.15em;color:var(--r-green)}.s39-report .r-muted{color:var(--r-muted)}
.s39-report .r-lead{max-width:740px;color:var(--r-muted);margin-top:12px;line-height:1.8}
.s39-report .r-status{display:inline-flex;align-items:center;gap:8px;border:1px solid #70613e;background:#211c12;color:#f5d794;padding:5px 10px;font-size:10px}
.s39-report .r-status:before{content:"";width:6px;height:6px;border-radius:50%;background:#f5d794}
.s39-report .r-actions{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}
.s39-report .r-action{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border:1px solid var(--r-line);background:var(--r-panel);padding:9px 14px;color:var(--r-text);font-size:12px}
.s39-report .r-action:hover{border-color:var(--r-green);text-decoration:none}.s39-report .r-action-primary{background:var(--r-green);color:#061710;border-color:var(--r-green)}
.s39-report .r-notice{border-left:2px solid #b9a16c;padding:12px 16px;background:#17150f;color:#dcd1b7;font-size:12px}
.s39-report .r-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--r-line);margin-top:24px}
.s39-report .r-stat{padding:18px 20px;min-width:0}.s39-report .r-stat+.r-stat{border-left:1px solid var(--r-line)}
.s39-report .r-stat strong{display:block;font-size:25px;font-weight:600;color:var(--r-text)}.s39-report .r-stat span{display:block;font-size:11px;color:var(--r-muted)}
.s39-report .r-section{padding-top:36px;margin-top:36px;border-top:1px solid var(--r-line);scroll-margin-top:20px}
.s39-report .r-section-head{display:flex;gap:16px;justify-content:space-between;align-items:start;margin-bottom:18px}
.s39-report .r-section-head p{font-size:12px;color:var(--r-muted);margin-top:7px}
.s39-report .r-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.s39-report .r-panel{background:var(--r-panel);border:1px solid var(--r-line);padding:20px;min-width:0}
.s39-report .r-panel h3{margin-bottom:10px}.s39-report .r-panel p+p{margin-top:12px}.s39-report .r-panel p,.s39-report .r-prose{font-size:13px;line-height:1.85}
.s39-report .r-issue{border-left:2px solid #d0ab6a;margin-top:12px}.s39-report .r-issue p{color:var(--r-muted)}
.s39-report .r-label{color:var(--r-muted);font-size:10px;letter-spacing:.07em;text-transform:uppercase;display:block;margin-bottom:4px}
.s39-report .r-fields{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:0}.s39-report .r-fields dd{margin:0;font-size:12px}
.s39-report .r-table-wrap{overflow-x:auto;margin-top:20px}.s39-report table{width:100%;border-collapse:collapse;text-align:left;font-size:12px}
.s39-report th,.s39-report td{padding:13px 12px;border-bottom:1px solid var(--r-line);vertical-align:top}
.s39-report th{font-weight:400;font-size:10px;color:var(--r-muted);text-transform:uppercase}
.s39-report .r-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.s39-report .r-filter{min-height:44px;padding:8px 14px;border:1px solid var(--r-line);color:var(--r-muted);background:transparent;font-size:12px}
.s39-report .r-filter[aria-pressed=true]{background:#123326;color:var(--r-green);border-color:#398366}
.s39-report .r-finding{padding:24px;border:1px solid var(--r-line);background:var(--r-panel);margin-top:16px;scroll-margin-top:20px}
.s39-report .r-finding-head{display:flex;justify-content:space-between;gap:14px;align-items:start;margin-bottom:14px}
.s39-report .r-severity{display:inline-block;font-size:10px;padding:3px 7px;border:1px solid #697b91;color:#d2dbe7;white-space:nowrap}
.s39-report .r-severity[data-level=HIGH],.s39-report .r-severity[data-level=CRITICAL]{border-color:#bc6873;color:#ffb4bb;background:#27151c}
.s39-report .r-severity[data-level=MEDIUM]{border-color:#ad8c55;color:#efcd93}.s39-report .r-severity[data-level=LOW]{border-color:#678ab6;color:#b8d6ff}
.s39-report .r-severity[data-level=INFO]{border-color:#587e72;color:#b4dfd0}
.s39-report .r-finding .r-prose{margin-top:16px;white-space:pre-wrap}.s39-report .r-location{font-size:11px;color:var(--r-muted)}
.s39-report .r-finding-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:20px 0}.s39-report .r-finding-grid p{font-size:12px;line-height:1.8}
.s39-report .r-review-question{padding:14px;background:#10241f;border-left:2px solid #488c71;font-size:12px;color:#c4e2d5;margin-top:16px}
.s39-report .r-tags{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;font-size:11px;color:var(--r-muted)}
.s39-report details{margin-top:14px;border-top:1px solid var(--r-line)}.s39-report summary{cursor:pointer;min-height:48px;padding:13px 0;font-size:12px;color:var(--r-green)}
.s39-report pre{margin:10px 0 0;background:#070b10;border:1px solid var(--r-line);padding:16px;overflow:auto;max-height:460px;font-size:11px;line-height:1.7;white-space:pre;overflow-wrap:normal;color:#d4dce8}
.s39-report .r-evidence-row{display:grid;grid-template-columns:170px minmax(0,1fr);gap:18px;padding:18px 0;border-bottom:1px solid var(--r-line)}
.s39-report .r-evidence-row strong{font-size:12px}.s39-report .r-evidence-row p{font-size:12px;color:var(--r-muted);margin-top:4px}
.s39-report .r-evidence-state{font-size:10px;color:#efcd93;text-transform:uppercase}.s39-report .r-evidence-state[data-linked=true]{color:var(--r-green)}
.s39-report .r-list{margin:0;padding-left:18px}.s39-report .r-list li{padding:5px 0;font-size:13px}
.s39-report .r-footer{margin-top:36px;padding-top:24px;border-top:1px solid var(--r-line);font-size:11px;color:var(--r-muted)}
@media(max-width:900px){.s39-report .r-shell{padding:0 22px}.s39-report .r-layout{grid-template-columns:minmax(0,1fr);gap:0}.s39-report .r-index{padding-top:14px;min-width:0}.s39-report .r-nav{display:flex;position:static;overflow-x:auto;gap:6px;padding-bottom:4px}.s39-report .r-nav a{white-space:nowrap;border:1px solid var(--r-line)}.s39-report .r-content{padding-top:26px}}
@media(max-width:560px){.s39-report .r-shell{padding:0 18px}.s39-report h1{font-size:30px}.s39-report .r-grid,.s39-report .r-finding-grid,.s39-report .r-fields{grid-template-columns:1fr}.s39-report .r-stat{padding:14px 10px}.s39-report .r-stat strong{font-size:21px}.s39-report .r-stat span{font-size:10px}.s39-report .r-finding{padding:18px}.s39-report .r-panel{padding:16px}.s39-report .r-finding-head{flex-direction:column}.s39-report .r-evidence-row{grid-template-columns:1fr;gap:6px}.s39-report .r-brand{font-size:16px}.s39-report .r-back{font-size:11px}.s39-report .r-section{padding-top:26px;margin-top:26px}}
@media print{.s39-report .r-index,.s39-report .r-actions,.s39-report .r-back,.s39-report .r-filters{display:none}.s39-report .r-layout{display:block}.s39-report .r-finding{break-inside:avoid}}
`
