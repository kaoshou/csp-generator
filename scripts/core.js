(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./catalog.js'));
  else root.CSPCore = factory(root.CSPCatalog);
})(globalThis, function (catalog) {
  'use strict';
  const own = (obj, key) => Object.hasOwn(obj, key);
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const namePattern = /^[a-z][a-z0-9-]*$/;
  const controls = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
  const reserved = new Set(['__proto__', 'prototype', 'constructor']);
  const keywords = new Set(['self', 'none', 'unsafe-inline', 'unsafe-eval', 'wasm-unsafe-eval', 'strict-dynamic', 'unsafe-hashes', 'report-sample', 'inline-speculation-rules', 'unsafe-allow-redirects']);
  const quotedSource = /^'(?:self|none|unsafe-inline|unsafe-eval|wasm-unsafe-eval|strict-dynamic|unsafe-hashes|report-sample|inline-speculation-rules|unsafe-allow-redirects)'$/;
  const nonceHash = /^'(?:nonce-[A-Za-z0-9+/_-]+=*|sha(?:256|384|512)-[A-Za-z0-9+/_-]+=*)'$/;
  const hostSource = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:\*|\*\.[a-z0-9.-]+|[a-z0-9.-]+)(?::(?:\*|\d+))?(?:\/[^\s;,"'<>?#\\]*)?$/i;
  const schemeSource = /^[a-z][a-z0-9+.-]*:$/i;
  function createProject(id = 'static') {
    const scenario = catalog.scenarios.find(s => s.id === id);
    if (!scenario) throw new Error('找不到使用情境。');
    return { version: 1, name: '我的 CSP 政策', origin: 'https://example.com', mode: 'report-only', reportingEndpoint: '', directives: clone(scenario.directives) };
  }
  function parsePolicy(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('請貼上單一 CSP 政策或完整 HTTP 標頭。');
    if (text.length > 200000) throw new Error('政策太長（上限 200 KB）。');
    if (controls.test(text)) throw new Error('政策含不允許的控制字元。');
    let body = text.trim();
    let reportingEndpoint, reportingGroup;
    const reportLines = body.split(/\r?\n/).filter(line => /^\s*Reporting-Endpoints\s*:/i.test(line));
    if (reportLines.length) {
      const report = reportLines.length === 1 && reportLines[0].trim().match(/^Reporting-Endpoints:\s*([a-z][a-z0-9_.*-]*)="([^"\r\n]+)"\s*$/i);
      if (!report || !validEndpoint(report[2])) throw new Error('Reporting-Endpoints 標頭需為單一群組及 HTTPS URL。多群組請以 JSON 專案分別管理。');
      [, reportingGroup, reportingEndpoint] = report;
      body = body.split(/\r?\n/).filter(line => !/^\s*Reporting-Endpoints\s*:/i.test(line)).join('\n');
    }
    const headers = body.match(/content-security-policy(?:-report-only)?\s*:/gi) || [];
    if (headers.length > 1 || body.includes(',')) throw new Error('偵測到多重政策；請一次匯入單一政策，不能合併以免改變交集效果。');
    let mode;
    const prefix = body.match(/^content-security-policy(-report-only)?\s*:\s*/i);
    if (prefix) { mode = prefix[1] ? 'report-only' : 'enforce'; body = body.slice(prefix[0].length); }
    if (/(?:^|[\r\n])\s*[a-z][a-z0-9-]*:\s+\S/i.test(body)) throw new Error('含額外 HTTP 標頭；請只匯入單一 CSP 與對應 Reporting-Endpoints。');
    if (!body.trim()) throw new Error('政策沒有任何指令。');
    const directives = {};
    const warnings = [];
    for (const part of body.split(';')) {
      const tokens = part.trim().split(/\s+/);
      if (!tokens[0]) continue;
      const name = tokens.shift().toLowerCase();
      if (!namePattern.test(name) || reserved.has(name)) throw new Error(`無效的指令名稱：${name}`);
      if (own(directives, name)) { warnings.push(`${name} 重複：依瀏覽器行為保留第一個，後面的指令已忽略。`); continue; }
      directives[name] = [...new Set(tokens)];
      if (!catalog.byName[name]) warnings.push(`${name} 不在內建目錄，已保留。請確認相容性與用途。`);
    }
    if (!Object.keys(directives).length) throw new Error('政策沒有任何指令。');
    if (reportingGroup && directives['report-to']?.[0] !== reportingGroup) throw new Error('Reporting-Endpoints 群組需與 report-to 一致。');
    return { directives, mode, warnings, ...(reportingEndpoint ? { reportingEndpoint } : {}) };
  }
  function serializePolicy(directives) {
    return Object.entries(directives).map(([name, values]) => `${name}${values.length ? ' ' + values.join(' ') : ''};`).join(' ');
  }
  function importProject(text) {
    if (typeof text !== 'string' || text.length > 200000) throw new Error('專案檔超過 200 KB 或格式不正確。');
    let p;
    try { p = JSON.parse(text); } catch { throw new Error('JSON 格式不正確。'); }
    if (!p || p.version !== 1 || !p.directives || typeof p.directives !== 'object' || Array.isArray(p.directives)) throw new Error('不是支援的 CSP 專案（version: 1）。');
    if (p.mode !== 'enforce' && p.mode !== 'report-only') throw new Error('專案模式必須是 enforce 或 report-only。');
    for (const field of ['name', 'origin', 'reportingEndpoint']) if (typeof p[field] !== 'string' || controls.test(p[field]) || /[\r\n]/.test(p[field])) throw new Error(`專案欄位 ${field} 格式不正確。`);
    for (const [name, values] of Object.entries(p.directives)) {
      if (!namePattern.test(name) || reserved.has(name) || !Array.isArray(values) || values.some(v => typeof v !== 'string' || !v || /[\s;,]/.test(v) || controls.test(v))) throw new Error(`專案指令 ${name} 格式不正確。`);
    }
    return { version: 1, name: p.name, origin: p.origin, mode: p.mode, reportingEndpoint: p.reportingEndpoint, directives: clone(p.directives) };
  }
  function exportProject(project) { return JSON.stringify(project, null, 2); }
  function effectiveDirective(directives, name) {
    let chain;
    if (['frame-ancestors', 'base-uri', 'form-action'].includes(name)) chain = [name];
    else if (name === 'worker-src') chain = ['worker-src', 'child-src', 'script-src', 'default-src'];
    else if (name === 'frame-src') chain = ['frame-src', 'child-src', 'default-src'];
    else if (/^(script|style)-src-(elem|attr)$/.test(name)) chain = [name, name.split('-').slice(0, 2).join('-'), 'default-src'];
    else chain = name === 'default-src' ? [name] : [name, 'default-src'];
    for (const key of chain) if (own(directives, key)) return { name: key, values: directives[key], chain };
    return { name: null, values: null, chain };
  }
  function validOrigin(origin) {
    try { const u = new URL(origin); return /^https?:$/.test(u.protocol) && u.origin === origin && !u.username && !u.password; } catch { return false; }
  }
  function validEndpoint(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.hash && !/[\s"<>\\]/.test(value); } catch { return false; }
  }
  function validate(p) {
    const issues = [];
    const add = (level, directive, message) => issues.push({ level, directive, message });
    if (!validOrigin(p.origin)) add('error', '網站來源', '請填不含路徑或結尾斜線的 HTTP(S) origin，例如 https://app.example.com。');
    if (p.reportingEndpoint && !validEndpoint(p.reportingEndpoint)) add('error', 'Reporting-Endpoints', '回報端點需為不含帳密、片段或引號的完整 HTTPS URL。');
    if (!Object.keys(p.directives).length) add('error', '政策', '目前沒有任何指令；請先建立政策。');
    const obsolete = ['require-sri-for', 'block-all-mixed-content', 'navigate-to', 'prefetch-src'];
    for (const [name, values] of Object.entries(p.directives)) {
      if (!namePattern.test(name) || reserved.has(name)) { add('error', name, '無效的指令名稱。'); continue; }
      const def = catalog.byName[name];
      if (obsolete.includes(name)) add('warning', name, '此指令已過時或缺乏現代瀏覽器支援，不能依賴它提供保護；已保留原值。');
      else if (!def) add('warning', name, '未收錄的指令已保留；瀏覽器可能忽略，請對照規格確認。');
      if (values.some(v => /[\s;,"<>\\]/.test(v) || controls.test(v))) { add('error', name, '來源含空白、控制字元或不支援的分隔符號，請分開輸入有效來源。'); continue; }
      if (values.includes("'none'") && values.length > 1) add('error', name, 'none 需單獨使用；與其他值混用不代表完全封鎖。');
      if (def?.kind === 'flag' && values.length) add('error', name, '這個指令不接受參數。');
      if (def?.kind === 'sources') {
        for (const value of values) {
          if (keywords.has(value)) add('error', name, `${value} 是關鍵字，需加單引號：'${value}'。`);
          else if (!(quotedSource.test(value) || nonceHash.test(value) || hostSource.test(value) || schemeSource.test(value))) add('error', name, `無法辨識來源 ${value}；請填 CSP 來源，不是完整 HTML 或伺服器設定。`);
          const executable = /^(?:default-src|(?:script|style)-src(?:-(?:elem|attr))?)$/.test(name);
          if ((quotedSource.test(value) && !["'self'", "'none'"].includes(value) || nonceHash.test(value)) && !executable) add('error', name, `${value} 不適用這類資源；此項請使用來源、self 或 none。`);
          if (value.startsWith("'nonce-") && name.endsWith('-attr')) add('error', name, 'nonce 不能授權行內事件或 style 屬性。');
          if (value === "'strict-dynamic'" && !(name === 'default-src' || name === 'script-src' || name === 'script-src-elem')) add('error', name, 'strict-dynamic 僅適用腳本載入。');
          if (nonceHash.test(value) && value.startsWith("'sha")) {
            const match = value.match(/^'sha(256|384|512)-(.+)'$/);
            try { const length = atob(match[2].replace(/-/g, '+').replace(/_/g, '/')).length; if (length !== Number(match[1]) / 8) throw new Error(); }
            catch { add('error', name, 'hash 的 Base64 長度不符 SHA 演算法；請用下方工具重新計算。'); }
          }
          if (/REPLACE|nonce_value|\{.*\}|example\.(?:com|org|net)/i.test(value)) add(value.includes('nonce-') ? 'error' : 'warning', name, `${value} 是示範／樣板值，部署前必須換成實際設定。`);
          if (value === '*' || value === 'https:' || value === 'http:') add('warning', name, `${value} 範圍很廣，會信任大量來源；正式環境優先列出精確來源。`);
          if (value.startsWith('http:')) add('warning', name, 'HTTP 來源可能受混合內容限制，也無傳輸加密；改用 HTTPS 並測試。');
          if (value === 'data:' && /script|object/.test(name)) add('warning', name, 'data: 允許內嵌資料作為可執行資源，會大幅削弱防護。');
          if (/^'nonce-/.test(value)) add('info', name, 'nonce 必須由伺服器以密碼學亂數為每次回應重新產生，且與元素的 nonce 屬性一致；不能固定重用。');
        }
        if (!values.length) add('info', name, '已啟用的空來源清單會封鎖此類資源；停用指令才會使用回退規則。');
        if (values.includes("'unsafe-inline'")) add('warning', name, 'unsafe-inline 放寬行內執行；腳本或樣式應優先改為 nonce/hash 或外部檔案。搭配 nonce/hash 時可能被忽略。');
        if (values.includes("'unsafe-eval'")) add('warning', name, 'unsafe-eval 允許字串編譯程式碼，降低對注入的防護；確認是否能移除。');
        if (values.includes("'unsafe-hashes'")) add('warning', name, 'unsafe-hashes 允許符合 hash 的屬性內容，仍有內容被重用的風險。');
        if (values.includes("'strict-dynamic'")) {
          if (!values.some(v => nonceHash.test(v))) add('warning', name, 'strict-dynamic 未搭配 nonce/hash；在支援的瀏覽器中，來源白名單不再授權一般 script 元素，腳本可能全被擋。');
          add('info', name, '支援 strict-dynamic 的瀏覽器會忽略腳本來源白名單及 unsafe-inline，並信任受信腳本動態載入的腳本；載入鏈需實測。');
        }
      }
      if (name === 'sandbox') {
        for (const value of values) if (!/^allow-(downloads|forms|modals|orientation-lock|pointer-lock|popups|popups-to-escape-sandbox|presentation|same-origin|scripts|storage-access-by-user-activation|top-navigation|top-navigation-by-user-activation|top-navigation-to-custom-protocols)$/.test(value)) add('error', name, `未知 sandbox 權限：${value}`);
        add('warning', name, 'sandbox 限制整份文件，可能破壞腳本、表單及來源身分；請使用獨立測試頁驗證。');
        if (p.mode === 'report-only') add('warning', name, 'sandbox 在 Report-Only 不生效，無法用此模式預演沙箱影響。');
      }
      if (name === 'require-trusted-types-for' && (values.length !== 1 || values[0] !== "'script'")) add('error', name, "僅支援 'script' 值。它不是要求 SRI。");
      if (name === 'trusted-types' && values.some(v => !/^(?:[a-zA-Z0-9#=_/@.%+-]+|\*|'none'|'allow-duplicates')$/.test(v))) add('error', name, 'Trusted Types 政策名稱格式不正確。');
      if (name === 'report-to' && (values.length !== 1 || !/^[a-z][a-z0-9_.*-]*$/.test(values[0]))) add('error', name, 'report-to 請填單一群組名稱，例如 csp，而不是 URL。');
      if (name === 'report-uri' && (!values.length || values.some(v => { try { const u = new URL(v, p.origin); return !/^https?:$/.test(u.protocol) || !!u.username || !!u.password || !!u.hash; } catch { return true; } }))) add('error', name, 'report-uri 需至少一個有效 HTTP(S) 或相對回報 URL。');
      if (name === 'upgrade-insecure-requests' && p.mode === 'report-only') add('info', name, 'Report-Only 不會升級 HTTP 請求；需在強制模式另外驗證 HTTPS 相容性。');
      if (name.includes('trusted-types')) add('info', name, 'Trusted Types 的瀏覽器支援與應用程式改造需另行確認；工具不驗證 sanitizer 安全性。');
    }
    if (own(p.directives, 'report-to') && !p.reportingEndpoint) add('warning', 'report-to', '尚未設定對應的 Reporting-Endpoints HTTPS 端點；本工具不提供回報接收服務。');
    if (p.reportingEndpoint && !own(p.directives, 'report-to')) add('warning', 'Reporting-Endpoints', '已填端點，但尚未啟用 report-to 群組。');
    if (p.mode === 'report-only' && !own(p.directives, 'report-to') && !own(p.directives, 'report-uri')) add('warning', '觀察模式', '尚未設定回報端點；主要需透過瀏覽器開發者工具檢查，不會自動有伺服器報告。');
    for (const name of ['object-src', 'base-uri', 'frame-ancestors', 'form-action']) if (!own(p.directives, name)) add('info', name, `尚未明確設定 ${name}。${name === 'object-src' ? '此項會依 default-src 回退。' : '此項不繼承 default-src。'}`);
    return issues;
  }
  const htmlEscape = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function exportConfig(p, format) {
    if (format === 'json') return exportProject(p);
    const errors = validate(p).filter(i => i.level === 'error');
    if (errors.length) throw new Error('請先修正設定錯誤：' + errors.map(i => `${i.directive}：${i.message}`).join('\n'));
    const policy = serializePolicy(p.directives);
    const header = p.mode === 'report-only' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
    const group = p.directives['report-to']?.[0];
    const reporting = group && p.reportingEndpoint ? `${group}="${p.reportingEndpoint}"` : '';
    const quote = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    if (format === 'raw') return policy;
    if (format === 'header') return `${header}: ${policy}${reporting ? '\nReporting-Endpoints: ' + reporting : ''}`;
    if (format === 'nginx') {
      if ((policy + reporting).includes('$')) throw new Error('Nginx 會將 $ 解讀為變數；此靜態輸出無法安全表示。請改用 HTTP 標頭格式，由部署端處理並確認實際回應。');
      return `# 放在適當的 server 或 location；避免重複／衝突標頭，先 nginx -t\nadd_header ${header} "${quote(policy)}" always;${reporting ? '\nadd_header Reporting-Endpoints "' + quote(reporting) + '" always;' : ''}`;
    }
    if (format === 'apache') {
      const apacheQuote = value => quote(value).replace(/%/g, '%%');
      return `# 需啟用 mod_headers；先 apachectl configtest\nHeader always set ${header} "${apacheQuote(policy)}"${reporting ? '\nHeader always set Reporting-Endpoints "' + apacheQuote(reporting) + '"' : ''}`;
    }
    if (format === 'meta') {
      if (p.mode === 'report-only') throw new Error('meta 不支援 Report-Only；請使用 HTTP 回應標頭。');
      const unsupported = ['frame-ancestors', 'sandbox', 'report-uri', 'report-to'].filter(n => own(p.directives, n));
      if (unsupported.length) throw new Error(`meta 不支援以下功能：${unsupported.join('、')}。請改用 HTTP 標頭，或自行明確移除後再匯出。`);
      return '<!-- 放在 head 前段；只作用於它之後載入的內容，建議優先用 HTTP 標頭 -->\n<meta http-equiv="Content-Security-Policy" content="' + htmlEscape(policy) + '">';
    }
    throw new Error('未知輸出格式。');
  }
  function sourceMatch(source, url, origin, type) {
    if (source === "'self'") {
      if (url.protocol === 'blob:' || (type === 'connect-src' && /^wss?:$/.test(url.protocol))) return null;
      return url.origin === origin.origin || (origin.protocol === 'http:' && url.protocol === 'https:' && url.hostname === origin.hostname && url.port === origin.port);
    }
    if (source.startsWith("'")) return false;
    if (source === '*') return /^(https?|wss?):$/.test(url.protocol);
    const schemeMatches = (a, b) => a === b || (a === 'http:' && b === 'https:') || (a === 'ws:' && ['wss:', 'http:', 'https:'].includes(b)) || (a === 'wss:' && b === 'https:');
    if (schemeSource.test(source)) return schemeMatches(source.toLowerCase(), url.protocol);
    const m = source.match(/^(?:([a-z][a-z0-9+.-]*:)\/\/)?([^/:]+)(?::(\*|\d+))?(\/.*)?$/i);
    if (!m) return null;
    const [, rawScheme, rawHost, sourcePort, path] = m;
    const scheme = (rawScheme || origin.protocol).toLowerCase();
    if (!schemeMatches(scheme, url.protocol)) return false;
    const host = rawHost.toLowerCase();
    if (host.startsWith('*.')) {
      if (!url.hostname.endsWith('.' + host.slice(2))) return false;
    } else if (host !== '*' && host !== url.hostname.toLowerCase()) return false;
    const defaultPort = protocol => ({ 'http:': '80', 'https:': '443', 'ws:': '80', 'wss:': '443' })[protocol];
    const actualPort = url.port || defaultPort(url.protocol);
    if (sourcePort !== '*') {
      if (sourcePort) {
        if (!(actualPort === sourcePort || (sourcePort === '80' && actualPort === '443' && ['http:', 'ws:'].includes(scheme)))) return false;
      } else if (url.port) return false;
    }
    if (path && path !== '/') {
      try {
        const expected = path.split('/').map(decodeURIComponent);
        const actual = url.pathname.split('/').map(decodeURIComponent);
        if (expected.length > actual.length) return false;
        if (path.endsWith('/')) expected.pop();
        else if (expected.length !== actual.length) return false;
        if (!expected.every((segment, i) => segment === actual[i])) return false;
      } catch { return null; }
    }
    return true;
  }
  function simulate(p, request) {
    const type = request.kind === 'eval' ? 'script-src' : request.type;
    const rule = effectiveDirective(p.directives, type);
    const done = (status, reason) => {
      if (status === 'allowed' && own(p.directives, 'sandbox') && p.mode === 'enforce') { status = 'unknown'; reason = '來源規則允許，但 sandbox 可能另行限制執行與來源身分，需實測。'; }
      return { status, reason, directive: rule.name, values: rule.values, chain: rule.chain, enforced: p.mode === 'enforce', mode: p.mode };
    };
    if (validate(p).some(i => i.level === 'error')) return done('unknown', '政策尚有錯誤，請先修正後再模擬。');
    if (!catalog.byName[type] || catalog.byName[type].kind !== 'sources') return done('unknown', '此指令不在簡化來源模擬支援範圍。');
    if (request.kind === 'inline' && !/^(script|style)-src(?:-(elem|attr))?$/.test(type)) return done('unknown', '此類型不適用行內腳本或樣式檢查。');
    const values = rule.values;
    if (!values) return done('allowed', '此類型沒有設定來源限制，且沒有可用的回退指令。此結果僅指 CSP 來源規則。');
    if (request.kind === 'eval') return done(values.includes("'unsafe-eval'") ? 'allowed' : 'blocked', values.includes("'unsafe-eval'") ? 'unsafe-eval 允許字串編譯程式碼。' : '未授權 eval；self 或 nonce 都不會授權 eval。');
    const isElement = /^(script|style)-src(?:-elem)?$/.test(type);
    const isAttribute = /-attr$/.test(type);
    const script = type.startsWith('script');
    const hasNonceHash = values.some(v => nonceHash.test(v));
    const strict = script && !isAttribute && values.includes("'strict-dynamic'");
    const nonceOK = isElement && request.nonce && values.includes(`'nonce-${request.nonce}'`);
    const hashOK = /^'sha(?:256|384|512)-[A-Za-z0-9+/_-]+=*'$/.test(request.hash || '') && values.includes(request.hash) && (!isAttribute || values.includes("'unsafe-hashes'"));
    let status, reason;
    if (request.kind === 'inline') {
      if (nonceOK || hashOK) { status = 'allowed'; reason = '提供的 nonce/hash 符合有效指令；真實內容及元素屬性仍須一致。'; }
      else if (values.includes("'unsafe-inline'") && !hasNonceHash && !(script && values.includes("'strict-dynamic'"))) { status = 'allowed'; reason = 'unsafe-inline 允許此行內內容，同時降低防護。'; }
      else { status = 'blocked'; reason = isAttribute ? '行內屬性未獲授權；nonce 不能授權事件或 style 屬性。' : '行內內容未獲授權；self 與外部來源不會允許行內內容。'; }
    } else {
      if (isAttribute) return done('unknown', '屬性指令僅適合測試行內內容。');
      if (nonceOK) { status = 'allowed'; reason = 'script/style 元素的 nonce 符合有效指令。'; }
      else if (hashOK && script) return done('unknown', '外部腳本 hash 還需正確的 integrity metadata 及瀏覽器支援，請實測。');
      else if (strict) return done(request.dynamic ? 'unknown' : 'blocked', request.dynamic ? 'strict-dynamic 需知道實際受信任腳本載入鏈與 parser-inserted 狀態，請用瀏覽器實測。' : 'strict-dynamic 使來源白名單失去授權作用；一般 script 元素需要有效 nonce/hash。');
      else {
        let url;
        try { url = new URL(request.url, p.origin); } catch { return done('unknown', '請輸入有效資源 URL。'); }
        if (!request.url?.trim() || url.username || url.password) return done('unknown', '請輸入不含帳密的資源 URL。');
        if (p.mode === 'enforce' && own(p.directives, 'upgrade-insecure-requests') && url.protocol === 'http:') { url.protocol = 'https:'; if (url.port === '80') url.port = ''; }
        const matches = values.map(s => sourceMatch(s, url, new URL(p.origin), type));
        if (matches.includes(true)) { status = 'allowed'; reason = '資源 URL 符合有效來源清單。'; }
        else if (matches.includes(null)) return done('unknown', '此來源涉及 blob、WebSocket self 或未支援的匹配細節，請用目標瀏覽器確認。');
        else { status = 'blocked'; reason = '資源 URL 不符合有效來源清單。'; }
      }
    }
    if (status === 'allowed' && ['frame-ancestors', 'form-action', 'worker-src'].includes(type)) return done('unknown', '單一 URL 符合來源規則；完整祖先鏈、重新導向、Worker 同源條件等仍需瀏覽器驗證。');
    return done(status, reason);
  }
  async function hashSource(text, algorithm = 'SHA-256') {
    if (!['SHA-256', 'SHA-384', 'SHA-512'].includes(algorithm)) throw new Error('只支援 SHA-256、SHA-384 與 SHA-512。');
    if (!globalThis.crypto?.subtle) throw new Error('此環境不支援 Web Crypto；請以 HTTPS 或 localhost 開啟。');
    const hash = await globalThis.crypto.subtle.digest(algorithm, new TextEncoder().encode(text));
    return "'" + algorithm.toLowerCase().replace('-', '') + '-' + btoa(String.fromCharCode(...new Uint8Array(hash))) + "'";
  }
  return { createProject, parsePolicy, serializePolicy, importProject, exportProject, effectiveDirective, validOrigin, validate, exportConfig, clone, simulate, hashSource };
});
