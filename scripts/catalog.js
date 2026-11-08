(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.CSPCatalog = data;
})(globalThis, function () {
  const item = (name, title, group, purpose, impact, use, options, kind = 'sources') => ({ name, title, group, purpose, impact, use, options, kind });
  const directives = [
    item('default-src', '預設資源', '基礎', '未單獨設定的資源類型會依 fallback 鏈使用這裡的規則。明確設定的指令會取代、而非加上本規則。', '設為 self 會限制第三方資源；設為 none 時，必須逐類開放需要的資源。它不限制表單、被嵌入來源或 base 標籤。', '先建立預設限制，再為圖片、腳本、API 等設定例外。', ["'self'", "'none'"]),
    item('script-src', 'JavaScript 腳本', '基礎', '控制外部腳本、行內腳本與字串程式碼執行。', '未授權的行內 script、onclick 與 eval 可能失效。self 只允許同源外部檔案，不等於允許行內腳本。', '先移除行內事件與 eval，動態網站考慮每次回應產生 nonce，靜態行內片段使用 hash。', ["'self'", "'none'", "'strict-dynamic'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", "'report-sample'"]),
    item('style-src', 'CSS 樣式', '基礎', '控制外部樣式表及行內 style。', '未授權的 style 標籤、style 屬性或某些 UI 套件的動態樣式可能失效。', '外部 CSS 用精確來源；style 標籤可用 nonce/hash。style 屬性需另外評估。', ["'self'", "'none'", "'unsafe-inline'", 'https://fonts.googleapis.com']),
    item('img-src', '圖片', '基礎', '控制圖片、圖示與 CSS 背景圖片的來源。', '外站圖片、base64 圖片或本機預覽可能消失；data: 與 blob: 需分別加入。', '圖片上傳預覽常需要 blob:；只在確實需要時允許 data:。', ["'self'", "'none'", 'data:', 'blob:', 'https:']),
    item('connect-src', 'API 與連線', '基礎', '控制 fetch、XHR、WebSocket、EventSource 與 sendBeacon 等連線。', '登入、搜尋、即時通知、分析或付款 API 可能無法連線。CSP 允許後仍需通過 CORS。', '填入真正的 API origin；WebSocket 建議明確填 wss:// 來源並跨瀏覽器測試。', ["'self'", "'none'"]),
    item('font-src', '網頁字型', '資源', '控制 @font-face 載入的字型檔。', '字型可能回退成系統字型；載入 Google Fonts 同時涉及 style-src 與 font-src。', '自架字型用 self，遠端字型加上精確字型檔來源。', ["'self'", "'none'", 'https://fonts.gstatic.com']),
    item('media-src', '音訊與影片', '資源', '控制 audio、video 與 track 資源。', '遠端影音或 blob 串流可能無法播放；嵌入影片的 iframe 另由 frame-src 控制。', '自架或 CDN 影音站點；MediaSource 視實際需求加入 blob:。', ["'self'", "'none'", 'blob:']),
    item('frame-src', '嵌入的外部頁面', '資源', '控制這個網站可以載入哪些 iframe。', 'YouTube、地圖、付款或登入 iframe 可能空白。這個指令不控制別人能否嵌入本站。', '允許精確的嵌入 origin，不以整個網站 URL 推測所有相依來源。', ["'self'", "'none'", 'https://www.youtube-nocookie.com']),
    item('worker-src', '背景工作程式', '資源', '控制 Web Worker、SharedWorker 與 Service Worker 的腳本來源。', '離線功能、背景運算或編輯器可能停止運作。未設定時依 child-src → script-src → default-src 回退。', 'PWA 通常至少需要 self；blob worker 需明確評估 blob:。', ["'self'", "'none'", 'blob:']),
    item('object-src', '外掛與嵌入物件', '資源', '控制 object 與 embed 載入的資源。', '舊式外掛或以 object 嵌入的 PDF 可能無法顯示。', '多數現代網站可使用 none；若需 PDF 改以經測試的呈現方式處理。', ["'none'", "'self'"]),
    item('manifest-src', '應用程式資訊清單', '資源', '控制 Web App Manifest 的來源。', 'PWA 安裝資訊可能無法載入。', '同源 PWA 通常使用 self。', ["'self'", "'none'"]),
    item('frame-ancestors', '誰能嵌入本站', '邊界', '限制哪些祖先頁面可以透過 frame/iframe/object 等嵌入本站，降低點擊劫持風險。', 'none 禁止所有嵌入；self 僅允許同源祖先。合作夥伴 portal 需明列且每層祖先都要符合。', '與 frame-src 方向相反；不繼承 default-src，必須用 HTTP 回應標頭，meta 無效。', ["'none'", "'self'"]),
    item('base-uri', '基底網址', '邊界', '控制 base 元素可指定的網址，降低插入 base 改寫相對連結的風險。', 'none 會禁止 base 元素；部分前端路由部署使用 base，需改為 self 或精確來源。', '不繼承 default-src；未使用 base 的網站可用 none。', ["'self'", "'none'"]),
    item('form-action', '表單送出目的地', '邊界', '控制 HTML 表單可以送到哪些網址。', '跨站登入或付款表單可能無法送出；fetch API 由 connect-src 控制。重新導向行為需實測。', '不繼承 default-src；加入實際表單端點的 origin。', ["'self'", "'none'"]),
    item('upgrade-insecure-requests', '升級 HTTP 資源', '邊界', '指示瀏覽器將適用的 HTTP 請求升級為 HTTPS。', '目標沒有 HTTPS 時資源會失敗，並不自動退回 HTTP；Report-Only 不會執行升級。', '完成 HTTPS 盤點後再強制使用，不能取代 HSTS 或伺服器 HTTPS 設定。', [], 'flag'),
    item('script-src-elem', 'script 元素', '進階', '單獨控制 script 元素的外部與行內腳本。', '設定後取代 script-src 對 script 元素的來源規則，nonce/hash 也需放在此有效指令中。', '需要區分 script 元素與事件處理器時使用。', ["'self'", "'none'", "'strict-dynamic'"]),
    item('script-src-attr', '行內事件', '進階', '控制 onclick 等 HTML 行內事件處理器。', 'none 會阻止 HTML 行內事件；nonce 不適用事件屬性。', '建議改用 addEventListener；特定 hash 例外需要 unsafe-hashes，仍有重用風險。', ["'none'", "'unsafe-inline'", "'unsafe-hashes'"]),
    item('style-src-elem', 'style 與 link 元素', '進階', '單獨控制 style 元素與 link 樣式表。', '設定後取代 style-src 對樣式元素的規則；需自行帶入原本需要的來源或 nonce。', '需要分別控制樣式標籤和 style 屬性時使用。', ["'self'", "'none'", "'unsafe-inline'"]),
    item('style-src-attr', 'style 屬性', '進階', '控制 HTML style 屬性中的行內樣式。', 'none 會阻止 style 屬性，部分 UI 元件會失去排版；nonce 不適用此類屬性。', '先確認框架如何套用樣式，再決定是否可移除行內 style。', ["'none'", "'unsafe-inline'", "'unsafe-hashes'"]),
    item('child-src', '子框架與 Worker 回退', '進階', '提供 frame-src 與 worker-src 未設定時的回退來源。', '若同時設定了 frame-src 或 worker-src，應以各自的有效指令為準。', '用明確的 frame-src 與 worker-src 通常較容易閱讀；匯入既有政策時保留此規則。', ["'self'", "'none'", 'blob:']),
    item('sandbox', '整份文件沙箱', '進階', '對收到此政策的文件套用沙箱限制，並不只作用於 iframe。啟用但不填參數代表完整沙箱。', '腳本、表單、彈窗、cookie 與來源身分可能受限。Report-Only 與 meta 不支援。', '適合隔離不受信任文件；一般網站不要直接套用完整沙箱。', ['allow-forms', 'allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-downloads', 'allow-modals', 'allow-top-navigation-by-user-activation'], 'sandbox'),
    item('require-trusted-types-for', 'Trusted Types 檢查', '進階', '要求相容瀏覽器的 DOM XSS 注入接收點（如 innerHTML）使用 Trusted Types。', '既有 DOM 寫入可能拋出例外；需搭配程式碼改造與安全的 policy。瀏覽器支援度需確認。', '先用 Report-Only 盤點 DOM 寫入，再逐步導入。', ["'script'"], 'trusted-require'),
    item('trusted-types', 'Trusted Types 政策名稱', '進階', '限制應用程式可建立的 Trusted Types policy 名稱。', '不在名單的 policy 無法建立；單有名稱限制不會自動清理 HTML 或強制接收點。', '與 require-trusted-types-for 配合；檢查 sanitizer 與 policy 實作。', ["'none'", "'allow-duplicates'"], 'trusted'),
    item('report-uri', '傳統回報端點', '回報', '把 CSP 違規報告送到 URI；已棄用但仍可作相容性用途。', '需自行提供接收服務；報告可能含頁面 URL 等資料，需處理隱私、驗證與流量限制。', '可搭配 report-to；支援 report-to 的瀏覽器可能忽略 report-uri。相對 URL 以受保護頁面為基準。', [], 'uris'),
    item('report-to', '回報群組名稱', '回報', '指定 Reporting-Endpoints 回應標頭中設定的群組名稱。這裡不是 URL。', '只填群組而沒有相應端點，伺服器通常收不到回報；各瀏覽器回報支援不同。', '例如填 csp，並在部署設定提供 csp="https://reports.example/csp"。', ['csp'], 'group')
  ];
  const base = { 'default-src': ["'self'"], 'script-src': ["'self'"], 'style-src': ["'self'"], 'img-src': ["'self'"], 'connect-src': ["'self'"], 'object-src': ["'none'"], 'base-uri': ["'self'"], 'frame-ancestors': ["'none'"], 'form-action': ["'self'"] };
  const scenarios = [
    { id: 'baseline', icon: '00', name: '一般網站建議基線', tag: '常見弱掃檢查', description: '從明確的資源與邊界限制開始，再逐項開放實際需求。', impact: '這是同源網站的起點，不是通過所有掃描的保證。預設不允許 iframe、行內腳本／事件與行內樣式；第三方服務、跨站表單與 API 需依指南調整。來源白名單仍可能被繞過，較高防護需求應採 nonce/hash 嚴格政策。', directives: { ...base, 'script-src-attr': ["'none'"], 'frame-src': ["'none'"] } },
    { id: 'static', icon: '01', name: '靜態網站', tag: '從簡單開始', description: '部落格、文件、形象網站，資源以同源為主。', impact: '行內腳本與樣式將不符合政策；請外移檔案或使用 hash。外站圖片需另行開放。', directives: base },
    { id: 'app', icon: '02', name: '前後端分離', tag: 'API / SPA', description: '有登入、API 或即時連線的網頁應用程式。', impact: '請把 api.example.com 換成真正的 API origin；WebSocket 另加 wss://。前端框架行內樣式需測試。', directives: { ...base, 'connect-src': ["'self'", 'https://api.example.com'], 'worker-src': ["'self'"], 'manifest-src': ["'self'"] } },
    { id: 'embed', icon: '03', name: '第三方內容', tag: '字型 / 影片', description: '示範如何為遠端字型、圖片與影片分別授權。', impact: '範例允許 Google Fonts 與 YouTube 隱私加強嵌入；並非任何第三方服務的完整相依清單。', directives: { ...base, 'style-src': ["'self'", 'https://fonts.googleapis.com'], 'font-src': ["'self'", 'https://fonts.gstatic.com'], 'frame-src': ['https://www.youtube-nocookie.com'], 'img-src': ["'self'", 'data:'] } },
    { id: 'strict', icon: '04', name: 'Nonce 嚴格政策', tag: '需後端配合', description: '透過每次回應的新 nonce 授權腳本及動態載入。', impact: 'REPLACE_PER_RESPONSE 是不可直接部署的樣板。後端需用密碼學亂數產生每次回應的新值，同步設定標頭與 script nonce 屬性。', directives: { ...base, 'script-src': ["'nonce-REPLACE_PER_RESPONSE'", "'strict-dynamic'"], 'base-uri': ["'none'"] } },
    { id: 'deny', icon: '05', name: '從全部封鎖學習', tag: '教學實驗', description: '先禁止資源，再觀察逐項開放後的差異。', impact: '切換強制模式後，多數資源都會被封鎖。適合課堂或測試頁，不能直接視為一般網站的部署建議。', directives: { 'default-src': ["'none'"], 'object-src': ["'none'"], 'base-uri': ["'none'"], 'frame-ancestors': ["'none'"], 'form-action': ["'none'"] } }
  ];
  return { directives, byName: Object.fromEntries(directives.map(d => [d.name, d])), scenarios };
});
