/** Original Solay39 report palette and compact, single-column presentation.
 * Appearance only: evidence, findings, export and approval semantics stay in the report.
 */
export const PRELIMINARY_REPORT_STYLE = `
.s39-report{--r-bg:var(--s39-bg0,#030608);--r-panel:var(--s39-bg1,#07090d);--r-raised:var(--s39-bg2,#0c0f14);--r-line:#263140;--r-muted:#9aa9ba;--r-text:var(--s39-lite,#ccd6e0);--r-white:var(--s39-white,#eef4fa);--r-green:var(--s39-green,#00ff88);--r-cyan:var(--s39-cyan,#00e5ff);--r-xs:12px;--r-sm:13px;--r-body:14px;--r-heading:16px;--r-title:28px;min-height:100dvh;background:var(--r-bg);color:var(--r-text);font:var(--r-body)/1.7 var(--font-sans,'JetBrains Mono',monospace);overflow-wrap:anywhere}
.s39-report *{box-sizing:border-box}.s39-report a{color:var(--r-cyan);text-decoration:none}.s39-report a:hover{text-decoration:underline}
.s39-report a:focus-visible,.s39-report button:focus-visible,.s39-report summary:focus-visible{outline:2px solid var(--r-green);outline-offset:3px}
.s39-report button{font:inherit;cursor:pointer}.s39-report .r-shell{max-width:1060px;margin:auto;padding:0 24px}
.s39-report .r-top{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--r-line);min-height:76px}
.s39-report .r-brand{font-size:18px;font-weight:800;letter-spacing:.12em;color:var(--r-green)}
.s39-report .r-brand small{display:block;font-size:var(--r-xs);letter-spacing:.08em;color:var(--r-muted);font-weight:400}
.s39-report .r-back{display:inline-flex;min-height:44px;align-items:center;font-size:var(--r-xs);color:var(--r-muted)}
.s39-report .r-layout{display:block}.s39-report .r-index{padding-top:12px;min-width:0}
.s39-report .r-nav{display:flex;gap:4px;overflow-x:auto;padding:0 0 8px;border-bottom:1px solid var(--r-line)}
.s39-report .r-nav a{display:flex;align-items:center;justify-content:center;min-height:44px;padding:8px 12px;color:var(--r-muted);border:1px solid transparent;font-size:var(--r-xs);white-space:nowrap}
.s39-report .r-nav a:hover,.s39-report .r-nav a:focus-visible{color:var(--r-green);border-color:#00ff8840;background:#00ff8808;text-decoration:none}
.s39-report .r-content{min-width:0;padding:28px 0 44px}.s39-report h1,.s39-report h2,.s39-report h3,.s39-report p{margin:0}
.s39-report .r-project-heading{display:flex;align-items:center;gap:12px;margin:12px 0 8px}
.s39-report .r-project-identity{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}
.s39-report .r-token-logo{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;flex:0 0 48px;border-radius:8px;overflow:hidden;border:1px solid var(--r-line);background:var(--r-raised);color:var(--r-muted);font-size:24px;font-weight:700}
.s39-report .r-token-logo img{display:block;width:100%;height:100%;object-fit:contain}
.s39-report h1{font-size:var(--r-title);line-height:1.25;letter-spacing:-.025em;font-weight:800;color:var(--r-white)}
.s39-report .r-ticker{display:inline-block;padding:3px 8px;border:1px solid var(--r-line);background:var(--r-raised);font-size:var(--r-xs);color:var(--r-muted)}
.s39-report h2{display:flex;align-items:center;gap:14px;font-size:var(--r-heading);line-height:1.5;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:var(--r-cyan)}
.s39-report h2:after{content:"";height:1px;flex:1;background:var(--r-line)}
.s39-report h3{font-size:var(--r-body);line-height:1.6;font-weight:700;color:var(--r-white)}
.s39-report .r-kicker{font-size:var(--r-xs);letter-spacing:.14em;color:var(--r-green)}.s39-report .r-muted{color:var(--r-muted)}
.s39-report .r-caption{font-size:var(--r-xs)}
.s39-report .r-lead{max-width:860px;color:var(--r-muted);margin-top:10px;font-size:var(--r-sm);line-height:1.8}
.s39-report .r-status{display:inline-flex;align-items:center;gap:8px;border:1px solid #ffb80055;background:#ffb80008;color:#ffd16b;padding:5px 9px;font-size:var(--r-xs)}
.s39-report .r-status:before{content:"";width:5px;height:5px;border-radius:50%;background:#ffd16b}
.s39-report .r-actions{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.s39-report .r-action{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border:1px solid #00e5ff50;background:#00e5ff08;padding:9px 13px;color:var(--r-cyan);font-size:var(--r-xs)}
.s39-report .r-action:hover{border-color:var(--r-cyan);text-decoration:none}.s39-report .r-action-primary{background:#00ff880d;color:var(--r-green);border-color:#00ff8870}
.s39-report .r-action-primary:hover{background:#00ff881a;border-color:var(--r-green)}
.s39-report .r-notice{border:1px solid #ffb80030;border-left:2px solid #ffb80070;padding:12px 14px;background:#ffb80004;color:#dccca9;font-size:var(--r-xs)}
.s39-report .r-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px}
.s39-report .r-stat{padding:14px 16px;min-width:0;border:1px solid var(--r-line);background:var(--r-panel)}
.s39-report .r-stat strong{display:block;font-size:24px;font-weight:700;color:var(--r-green)}.s39-report .r-stat span{display:block;font-size:var(--r-xs);color:var(--r-muted)}
.s39-report .r-stat:nth-child(2) strong{color:#ff8c9f}.s39-report .r-stat:nth-child(3) strong{color:var(--r-cyan)}
.s39-report .r-section{padding-top:26px;margin-top:26px;border-top:1px solid var(--r-line);scroll-margin-top:20px}
.s39-report .r-section-head{display:flex;gap:16px;justify-content:space-between;align-items:start;margin-bottom:16px}.s39-report .r-section-head>div{width:100%;min-width:0}
.s39-report .r-section-head p{font-size:var(--r-xs);color:var(--r-muted);margin-top:6px}
.s39-report .r-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.s39-report .r-panel{background:var(--r-panel);border:1px solid var(--r-line);padding:16px;min-width:0}
.s39-report .r-panel h3{margin-bottom:8px}.s39-report .r-panel p+p{margin-top:10px}.s39-report .r-panel p,.s39-report .r-prose{font-size:var(--r-sm);line-height:1.85}
.s39-report .r-issue{border-left:2px solid #ffb80080;margin-top:10px}.s39-report .r-issue p{color:var(--r-muted)}
.s39-report .r-label{color:var(--r-muted);font-size:var(--r-xs);letter-spacing:.05em;text-transform:uppercase;display:block;margin-bottom:4px}
.s39-report .r-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:0}.s39-report .r-fields dd{margin:0;font-size:var(--r-xs)}
.s39-report .r-table-wrap{overflow-x:auto;margin-top:16px;border:1px solid var(--r-line)}.s39-report table{width:100%;border-collapse:collapse;text-align:left;font-size:var(--r-xs)}
.s39-report table.r-technical-table{min-width:720px}.s39-report .r-technical-table th:nth-child(2){min-width:150px}.s39-report .r-technical-table th:nth-child(3){min-width:110px}
.s39-report caption{padding:10px 12px;background:var(--r-panel)}.s39-report th,.s39-report td{padding:11px 12px;border-bottom:1px solid var(--r-line);vertical-align:top}
.s39-report th{font-weight:400;font-size:var(--r-xs);color:var(--r-muted);text-transform:uppercase;background:var(--r-raised)}
.s39-report .r-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.s39-report .r-filter{min-height:44px;padding:8px 12px;border:1px solid var(--r-line);color:var(--r-muted);background:var(--r-panel);font-size:var(--r-xs)}
.s39-report .r-filter[aria-pressed=true]{background:#00ff880d;color:var(--r-green);border-color:#00ff8870}
.s39-report #findings h2{color:#ff8c9f}.s39-report #evidence h2{color:#8db9ff}.s39-report #review h2{color:var(--r-green)}
.s39-report .r-finding{padding:18px;border:1px solid var(--r-line);background:var(--r-panel);margin-top:14px;scroll-margin-top:20px}
.s39-report .r-finding-head{display:flex;justify-content:space-between;gap:14px;align-items:start;margin:-18px -18px 14px;padding:12px 18px;background:var(--r-raised);border-bottom:1px solid var(--r-line)}
.s39-report .r-severity{display:inline-block;font-size:var(--r-xs);padding:3px 7px;border:1px solid #697b91;color:#d2dbe7;white-space:nowrap}
.s39-report .r-severity[data-level=HIGH],.s39-report .r-severity[data-level=CRITICAL]{border-color:#ff2d5570;color:#ff8c9f;background:#ff2d550d}
.s39-report .r-severity[data-level=MEDIUM]{border-color:#ffd60070;color:#ffe473;background:#ffd60008}.s39-report .r-severity[data-level=LOW]{border-color:#4488ff80;color:#8db9ff;background:#4488ff0d}
.s39-report .r-severity[data-level=INFO]{border-color:#00e5ff60;color:#7eefff;background:#00e5ff08}
.s39-report .r-finding .r-prose{margin-top:14px;white-space:pre-wrap}.s39-report .r-location{font-size:var(--r-xs);color:var(--r-cyan)}
.s39-report .r-finding-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.s39-report .r-finding-grid>div{padding:12px;border:1px solid var(--r-line);background:var(--r-bg);min-width:0}.s39-report .r-finding-grid p{font-size:var(--r-xs);line-height:1.8}
.s39-report .r-review-question{padding:12px;background:#00ff8806;border-left:2px solid #00ff8855;font-size:var(--r-xs);color:#b8dbca;margin-top:14px}
.s39-report .r-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;font-size:var(--r-xs);color:var(--r-muted)}.s39-report .r-tags>*{padding:3px 7px;border:1px solid var(--r-line);background:var(--r-raised)}
.s39-report details{margin-top:12px;border-top:1px solid var(--r-line)}.s39-report summary{cursor:pointer;min-height:48px;padding:13px 0;font-size:var(--r-xs);color:var(--r-cyan)}
.s39-report pre{margin:10px 0 0;background:var(--r-bg);border:1px solid var(--r-line);padding:14px;overflow:auto;max-height:460px;font-size:var(--r-xs);line-height:1.7;white-space:pre;overflow-wrap:normal;color:var(--r-green)}
.s39-report .r-evidence-row{display:grid;grid-template-columns:170px minmax(0,1fr);gap:16px;padding:16px 0;border-bottom:1px solid var(--r-line)}
.s39-report .r-evidence-row strong{font-size:var(--r-xs);color:var(--r-white)}.s39-report .r-evidence-row p{font-size:var(--r-xs);color:var(--r-muted);margin-top:4px}
.s39-report .r-evidence-state{font-size:var(--r-xs);color:#ffd16b;text-transform:uppercase}.s39-report .r-evidence-state[data-linked=true]{color:var(--r-green)}
.s39-report .r-list{margin:0;padding-left:18px}.s39-report .r-list li{padding:4px 0;font-size:var(--r-sm)}
.s39-report .r-footer{margin-top:26px;padding-top:20px;border-top:1px solid var(--r-line);font-size:var(--r-xs);color:var(--r-muted)}
@media(max-width:700px){.s39-report .r-shell{padding:0 18px}.s39-report .r-grid,.s39-report .r-finding-grid{grid-template-columns:1fr}.s39-report .r-fields{grid-template-columns:1fr 1fr}.s39-report .r-nav a{padding:8px 10px}.s39-report .r-brand{font-size:16px}.s39-report .r-brand small{max-width:180px}.s39-report .r-content{padding-top:22px}}
@media(max-width:480px){.s39-report{--r-title:24px}.s39-report .r-shell{padding:0 16px}.s39-report .r-stats{gap:6px}.s39-report .r-stat{padding:12px 9px}.s39-report .r-stat strong{font-size:22px}.s39-report .r-fields{grid-template-columns:1fr}.s39-report .r-finding-head{flex-direction:column;gap:8px}.s39-report .r-evidence-row{grid-template-columns:1fr;gap:6px}.s39-report .r-top{gap:12px}.s39-report .r-back{max-width:115px}.s39-report h2{font-size:14px}.s39-report .r-section{padding-top:22px;margin-top:22px}}
@media print{.s39-report .r-index,.s39-report .r-actions,.s39-report .r-back,.s39-report .r-filters{display:none}.s39-report .r-finding{break-inside:avoid}}
`
