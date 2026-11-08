# 建議基線、整合指南與正式部署

沿用使用者先前「交給你處理」的設計授權；此次明確授權本機測試後推送 GitHub、更新既有線上站點並驗證。

## 決定

保留純靜態架構、原作者、GPL 與 csp.yuhan.tw。增加獨立「建議與整合」工作區，比只增加文字或用整份第三方範本覆蓋政策更適合既有政策維護。新增一般網站基線情境，持續以 Report-Only 起步，不能宣稱通過所有弱掃。

## 功能契約

- 基線至少明確設定 default-src、script-src、script-src-attr、style-src、object-src、base-uri、frame-ancestors、form-action、frame-src。避免 unsafe-inline、unsafe-eval、萬用來源；解釋 host allowlist 不等於 strict CSP，基線可能破壞 inline/iframe/跨站 API。
- 動態檢核對照 ZAP 的 CSP 缺失、Report-Only、萬用來源、unsafe-inline/eval/hashes、無 fallback 指令與過時標頭等常見問題；來源設定狀態與實際 HTTP 部署狀態分開。HSTS、nosniff、Referrer-Policy、X-Frame-Options、cookie 等只提供獨立說明，不假裝由 CSP 控制。
- 常見整合涵蓋 YouTube 兩種 iframe、Google Maps iframe 與 JS API 的差異、Google Fonts、自訂 JS/CSS CDN、API/WebSocket、blob 圖片預覽與允許合作站嵌入。
- 常見整合是可檢查的差異預覽，經使用者在產品中按「套用」才修改。保留現有政策與未修改指令、保留模式與回報資料；新增來源時移除互斥 none、複製原本有效 fallback，保留明確空清單的封鎖意圖。JS/CSS CDN 應調整元素有效指令，不誤改 attr 或放寬 default-src。strict-dynamic 腳本需要 nonce/SRI，阻止「只加 CDN 就完成」的誤導。
- CDN URL 只接受 HTTPS、無帳密；政策值不含 query/fragment，並說明放寬範圍及版本/SRI 要求。API/WebSocket 與祖先頁面採 origin。指南不自動載入第三方資源。
- 保留並完整測試現有匯入、匯出、復原/重做、hash、本機草稿、模擬與教學功能。
- 視覺改為深色工具導覽、藍青色重點、清楚的狀態列與可讀的設定卡；保留明亮編輯工作區、鍵盤操作、320px 以上響應式配置。

## 驗證與部署

Node 真實核心測試、瀏覽器測試指南預覽/套用/復原/JSON 往返/多重政策拒絕/模擬/複製下載與檔案讀取。測試頁僅在開發伺服器中使用，不加入正式 HTML。先完成本機再推送 feature branch 並以可追溯 PR 合併 main，沿用 GitHub Pages legacy main 根目錄。等待建置完成，確認 csp.yuhan.tw 的實際新資產與功能。

GitHub CLI 已確認：build_type=legacy、source=main:/、cname=csp.yuhan.tw、https_enforced=true。工具插件無 Pages 管理功能，使用既有 GitHub CLI 查看部署狀態，不建立另一個 Sites 網站。

## 查核來源

- https://www.zaproxy.org/docs/alerts/10055/
- https://www.zaproxy.org/docs/alerts/10038/
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy
- https://developers.google.com/maps/documentation/embed/embedding-map
- https://developers.google.com/maps/documentation/javascript/content-security-policy
- https://developers.google.com/youtube/player_parameters
- https://developers.google.com/youtube/terms/required-minimum-functionality
- https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
