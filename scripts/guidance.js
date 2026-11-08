(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./core.js'));
  else root.CSPGuidance=factory(root.CSPCore);
})(globalThis,function(C){
  'use strict';
  const recipes = [
    {id:'youtube-private',category:'iframe',title:'YouTube 隱私加強嵌入',subtitle:'只開放播放器所在的 iframe 來源',description:'將嵌入碼的 src 設為 https://www.youtube-nocookie.com/embed/VIDEO_ID，並在 frame-src 開放該來源。',rules:{'frame-src':['https://www.youtube-nocookie.com']},notes:['iframe 內部的影片、圖片與腳本由該文件自己的政策控制；不需要把 googlevideo.com 等所有服務域名加進你網站的 script-src 或 media-src。','隱私加強模式不代表完全沒有資料傳送；仍需依網站需求處理同意、Cookie 與隱私告知。','若出現 YouTube error 153，另查 Referer 與 referrerpolicy；建議評估 strict-origin-when-cross-origin，不能只放寬 CSP。'],source:'https://support.google.com/youtube/answer/171780'},
    {id:'youtube',category:'iframe',title:'YouTube 一般嵌入',subtitle:'適用 youtube.com/embed/…',description:'使用一般 iframe 嵌入碼時，在 frame-src 允許 https://www.youtube.com。一般觀看頁 watch?v=… 不等於嵌入網址。',rules:{'frame-src':['https://www.youtube.com']},notes:['只嵌入 iframe 不必開放網站的 script-src；如果使用 YouTube IFrame Player JavaScript API，還要盤點父頁的 API 腳本與初始化程式。','frame-ancestors 是誰能嵌入你，方向相反；不要為了播放影片把它改成 *。','嵌入權限、地區、Referer 與影片擁有者的設定仍可能讓播放器拒絕播放。'],source:'https://developers.google.com/youtube/player_parameters'},
    {id:'maps-embed',category:'iframe',title:'Google Maps iframe',subtitle:'地址、店家頁面的嵌入地圖',description:'對 src 為 https://www.google.com/maps/embed/… 的 iframe，調整 frame-src 允許 https://www.google.com。',rules:{'frame-src':['https://www.google.com']},notes:['這個調整僅適用 iframe；不需要把 Google 的 JS/CSS 域名一併加到父頁。若 src 是不同網域，依實際嵌入碼另外評估精確來源。','Maps Embed API 與 Google Maps 分享嵌入碼的金鑰需求不同；使用 Embed API 時仍須正確的 API key、服務啟用與網站來源限制。','參考 Google 的 iframe referrerpolicy="strict-origin-when-cross-origin"，避免 Referer 被移除導致金鑰限制驗證失敗。'],source:'https://developers.google.com/maps/documentation/embed/embedding-map'},
    {id:'google-fonts',category:'CSS / 字型',title:'Google Fonts',subtitle:'樣式表與字型檔是兩類來源',description:'CSS 來自 fonts.googleapis.com，實際字型檔來自 fonts.gstatic.com；需分別開放樣式元素與 font-src。',rules:{'style-src-elem':['https://fonts.googleapis.com'],'font-src':['https://fonts.gstatic.com']},notes:['若已存在 style-src-elem，修改 style-src 不會覆蓋它；本調整直接處理元素有效規則。','只允許遠端樣式表，不會順便開放 style 屬性或行內 style 標籤。','外部字型另涉及網路可用性與隱私；自架字型可減少第三方相依。'],source:'https://developers.google.com/fonts/docs/getting_started'},
    {id:'js-cdn',category:'JS / CDN',title:'指定 JavaScript CDN',subtitle:'貼入實際的 JS 檔案 URL',description:'只調整 script 元素的有效規則，保留行內事件、eval 與 Worker 原有的限制。',input:'https',placeholder:'https://cdn.example.com/library/1.2.3/app.min.js',notes:['優先使用固定版本的完整檔案路徑；信任整個共享 CDN，可能同時信任其他使用者發布的程式碼。CSP 路徑限制也不是完整供應鏈防護。','外部 JS 建議另加供應商提供或針對確切檔案計算的 integrity（SRI）與適當 crossorigin。CSP 主機白名單不驗證檔案內容。','模組的 import、動態 chunk、套件額外的 API/Worker/CSS 仍需逐項盤點。不要為了套件報錯直接加入 unsafe-eval。','若有效腳本規則使用 strict-dynamic，單加 CDN 來源沒有授權效果；請用每次回應的 nonce 或搭配 SRI 的 hash，本工具會阻止此錯誤套用。'],source:'https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity'},
    {id:'css-cdn',category:'CSS / CDN',title:'指定 CSS CDN',subtitle:'Bootstrap、圖示或其他外部樣式表',description:'貼入實際的 CSS 檔案 URL，只開放 link/style 元素的來源。',input:'https',placeholder:'https://cdn.example.com/library/1.2.3/ui.min.css',notes:['CSS 可能再載入 @import、字型、背景圖；分別檢查樣式、font-src 與 img-src。','允許 CSS CDN 不會允許 HTML 的 style 屬性；部分 UI 元件需要動態行內樣式，應另行評估 style-src-attr，並記錄放寬原因。','固定版本並考慮 integrity（SRI）。不要把整個 default-src 改為 https: 來解決單一樣式表問題。'],source:'https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity'},
    {id:'api',category:'API / 連線',title:'跨站 API',subtitle:'fetch / XHR / EventSource / beacon',description:'將真正的 API origin 加入 connect-src。只設定 CSP 還不能解除 API 端的 CORS、認證或 Cookie 限制。',input:'https',placeholder:'https://api.example.com',notes:['此調整採用 URL 的 origin，不包含路徑、query 或 fragment。盤點實際端點與重新導向，避免只憑前端程式碼猜測。','此調整不會開放 HTML form 提交；跨站表單應另外處理 form-action。'],source:'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src'},
    {id:'websocket',category:'API / 連線',title:'WebSocket 即時連線',subtitle:'明確開放 wss:// 來源',description:'把實際 WebSocket 的 wss:// origin 加入 connect-src，避免只依賴 self 的瀏覽器差異。',input:'wss',placeholder:'wss://realtime.example.com',notes:['連接埠是 origin 的一部分；wss://host 與 wss://host:8443 不同。','CSP 不負責 WebSocket 伺服器的 Origin 驗證、授權與訊息安全。'],source:'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src'},
    {id:'image-preview',category:'圖片 / 上傳',title:'上傳圖片的本機預覽',subtitle:'URL.createObjectURL 產生的 blob:',description:'在 img-src 允許 blob:，供選取檔案後的本機圖片預覽使用。',rules:{'img-src':['blob:']},notes:['blob: 與 data: 是不同來源表示法；只有真正使用 Base64/data URL 時才評估加入 data:。','不會開放 blob: 腳本或 Worker，也不會執行或上傳圖片。完成預覽後應由應用程式釋放 object URL。'],source:'https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static'},
    {id:'partner-frame',category:'嵌入邊界',title:'允許合作站嵌入本站',subtitle:'調整 frame-ancestors，而非 frame-src',description:'填入需要嵌入你網站的合作夥伴 origin；每一層祖先都必須符合來源清單。',input:'https',placeholder:'https://portal.partner.example',notes:['這會放寬點擊劫持邊界，僅加入可信且確實需要的來源。','只能透過 HTTP CSP 標頭生效；meta 不支援。若另有 X-Frame-Options: DENY，需評估舊瀏覽器相容性與兩者一致性。','iframe 的 sandbox、瀏覽器 Cookie 限制及登入狀態可能另行影響功能。'],source:'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors'}
  ];
  function inputURL(value,protocol){
    if(typeof value!=='string'||!value||/[\s;,"'<>\\]/.test(value)) throw new Error('請填不含空白、帳密或 CSP 分隔符號的完整安全 URL。');
    let url;try{url=new URL(value);}catch{throw new Error('URL 格式不正確，請包含 https:// 或 wss://。');}
    if(url.protocol!==protocol+':'||url.username||url.password) throw new Error(`此項只接受不含帳密的 ${protocol}:// URL。`);
    if(value.includes('*')||/%2a/i.test(url.hostname)) throw new Error('請填實際服務的明確網域，不接受萬用字元來源。');
    if(url.hostname.includes(':')) throw new Error('此來源編輯目前不支援 IPv6 主機表示法；請使用正式服務的網域。');
    if(!/^[a-z0-9.-]+$/i.test(url.hostname)) throw new Error('此主機名稱不符合支援的 CSP 網域語法，請使用明確的正式網域。');
    return url;
  }
  function proposeRecipe(project,id,options={}){
    const recipe=recipes.find(r=>r.id===id);
    if(!recipe) throw new Error('找不到這個整合指南。');
    const next=C.clone(project),notes=[...recipe.notes],conflicts=[],changes=[];
    let additions=C.clone(recipe.rules||{});
    if(recipe.input){
      const url=inputURL(options.url,recipe.input);
      const directive={'js-cdn':'script-src-elem','css-cdn':'style-src-elem',api:'connect-src',websocket:'connect-src','partner-frame':'frame-ancestors'}[id];
      const file=id==='js-cdn'||id==='css-cdn';
      additions[directive]=[file?url.origin+url.pathname:url.origin];
      if(url.search||url.hash) notes.unshift('query／fragment 不屬於此 CSP 路徑授權：已移除查詢字串與片段，這項規則不會限制 query 參數。');
      if(file&&url.pathname==='/') notes.unshift('目前填的是整個 CDN origin；建議改填固定版本的實際檔案路徑以縮小信任範圍。');
      if(!file&&url.pathname!=='/') notes.unshift('此調整以 origin 授權；輸入中的路徑不會成為連線或祖先限制。');
    }
    if(id==='js-cdn'&&C.effectiveDirective(project.directives,'script-src-elem').values?.includes("'strict-dynamic'")){
      conflicts.push('目前有效規則使用 strict-dynamic，加入 CDN 白名單不能授權腳本。請為 script 元素提供有效 nonce，或使用正確的 hash 與 integrity；不會自動改寫或移除 strict-dynamic。');
      return {project:next,changes,notes,conflicts};
    }
    for(const [name,values]of Object.entries(additions)){
      const before=project.directives[name];
      const effective=C.effectiveDirective(project.directives,name);
      let inherited=effective.values||[];
      if(effective.name!==name){
        const original=inherited;
        const executable=/^(?:script|style)-src-elem$/.test(name);
        inherited=inherited.filter(value=>{
          if(!value.startsWith("'"))return true;
          if(["'self'","'none'"].includes(value))return true;
          if(!executable)return false;
          if(/^'(?:nonce-|sha(?:256|384|512)-)/.test(value))return true;
          return ["'unsafe-inline'","'unsafe-hashes'","'report-sample'",...(name==='script-src-elem'?["'strict-dynamic'","'inline-speculation-rules'"]:[])].includes(value);
        });
        if(original.length!==inherited.length) notes.push(`${name} 僅複製對該資源有效的回退來源，略過不適用的執行關鍵字；原本的 ${effective.name} 保持不變。`);
      }
      const after=[...new Set([...inherited.filter(v=>v!=="'none'"),...values])];
      if(!effective.name) notes.push(`${name} 原本沒有可用的來源限制；啟用後會限制為預覽清單，請確認其他既有需求。`);
      if(effective.name&&effective.name!==name) notes.push(`${name} 會複製目前 ${effective.name} 的有效來源，再加入此項，不會改寫回退指令。`);
      if(JSON.stringify(before)!==JSON.stringify(after)){changes.push({name,before:before===undefined?null:[...before],after:[...after]});next.directives[name]=after;}
    }
    return {project:next,changes,notes:[...new Set(notes)],conflicts};
  }
  function assessBaseline(project){
    const d=project.directives,own=name=>Object.hasOwn(d,name),effective=name=>C.effectiveDirective(d,name).values;
    const wide=values=>values?.some(v=>v==='*'||/^(?:https?|data):$/.test(v)||v.includes('*.')||/^[a-z][a-z0-9+.-]*:\/\/\*/i.test(v));
    const risky=values=>!values||wide(values)||values.some(v=>["'unsafe-inline'","'unsafe-eval'","'unsafe-hashes'"].includes(v));
    const row=(id,title,status,message,reference)=>({id,title,status,message,reference});
    const explicit=(id,name,title)=>row(id,title,!own(name)?'missing':risky(d[name])?'review':'configured',!own(name)?`${name} 不繼承 default-src，請明確設定。`:`目前 ${name}：${d[name].join(' ')||'空清單'}。請確認符合實際流程與部署。`,'https://www.zaproxy.org/docs/alerts/10055-13/');
    const scriptRules=['script-src-elem','script-src-attr'].map(effective),styleRules=['style-src-elem','style-src-attr'].map(effective);
    const evalRule=effective('script-src');
    const scriptRisk=scriptRules.some(risky)||risky(evalRule);
    const issues=C.validate(project);
    return [
      row('delivery','正式 HTTP 標頭與模式',project.mode==='enforce'?'verify':'review',project.mode==='enforce'?'草稿已選強制模式，但仍需在 Network／HTTP 回應中確認實際送出 Content-Security-Policy；此工具不連線檢查網站。':'目前是 Report-Only。適合測試，但不強制阻擋；掃描器可能仍回報 CSP 未強制啟用。','https://www.zaproxy.org/docs/alerts/10038/'),
      row('default','預設資源邊界',!own('default-src')?'missing':risky(d['default-src'])?'review':'configured','明確設定 default-src 並避免 *、整個 https: 或可執行 data: 的過寬信任。個別指令會取代此清單。','https://www.zaproxy.org/docs/alerts/10055-4/'),
      row('scripts','腳本與行內事件',scriptRisk?'review':'configured','檢查 script-src、script-src-elem、script-src-attr 的有效規則及 eval。避免 unsafe-inline／unsafe-eval／unsafe-hashes；來源白名單仍有繞過風險，需評估 nonce/hash strict CSP。','https://www.zaproxy.org/docs/alerts/10055/'),
      row('styles','樣式與行內屬性',styleRules.some(risky)?'review':'configured','分別確認 style 元素與 style 屬性的有效規則。unsafe-inline 也常被掃描器提示，但不能直接等同 JavaScript 的執行風險。','https://www.zaproxy.org/docs/alerts/10055-6/'),
      row('objects','停用不需要的外掛',!effective('object-src')?'missing':effective('object-src').length===0||effective('object-src').length===1&&effective('object-src')[0]==="'none'"?'configured':'review','未使用 object/embed 時，建議 object-src none；此項可回退到 default-src，但明列更容易檢查。','https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/object-src'),
      explicit('base','base-uri','限制 base 網址改寫'),explicit('ancestors','frame-ancestors','防止非預期的網站嵌入'),explicit('forms','form-action','限制表單目的地'),
      row('syntax','語法、舊指令與相容性',issues.some(i=>i.level==='error'||/未收錄|過時/.test(i.message))?'review':'configured','確認 ASCII 語法、有效關鍵字與目前支援的指令。require-sri-for 等舊指令不能代替實際 SRI；meta 也不能取代所有 HTTP 標頭功能。','https://www.zaproxy.org/docs/alerts/10055/')
    ];
  }
  return {recipes,proposeRecipe,assessBaseline};
});
