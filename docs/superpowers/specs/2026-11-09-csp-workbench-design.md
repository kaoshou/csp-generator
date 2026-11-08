# CSP 工作台設計

使用者授權：沿用 kaoshou/csp-generator，完整改善產生、匯出與重新編輯，兼顧不熟悉 CSP 的正式部署者與教學場域；「交給你處理」將設計及執行選擇交由本次實作決定。

## 目標

從使用情境起步，讓每項設定都能看到用途、適合情境、可能壞掉的功能與修復方向。原始 CSP 與版本化 JSON 專案檔可往返編輯。預設 Report-Only，提供正式部署、觀察、回復流程及保守的本機規則模擬。

## 方法與決定

保留純靜態 HTML/CSS/JavaScript、GPL-3.0、作者與 CNAME，可直接部署 GitHub Pages，無執行期依賴、無後端、無外部字型或追蹤。相較引入 React 的整套工具鏈，此專案不需要其維護成本；相較只補匯入錯誤，全面整理資料模型才能讓引導、驗證、教學與輸出保持一致。此為實作者依授權做的決定。

## 產品

- 繁體中文、深藍與青綠的清楚工具介面，桌面雙欄、行動版單欄，鍵盤可操作。
- 四個工作區：政策編輯、規則模擬、安全上線、學習指南。
- 靜態網站、前後端分離、第三方內容、nonce 嚴格政策、教學封鎖等起點；套用時明確說明將取代政策，可復原。
- 編輯器含搜尋、分類、常用來源捷徑、明確啟用與停用、逐指令解說與 fallback；支援現行常見 fetch、document、navigation、reporting、Trusted Types 指令。過時及未知指令保留並提示，不無聲刪除。
- 匯入原始值或單一完整 HTTP 標頭與 JSON 檔案，先預覽再套用。重複指令遵循瀏覽器第一個有效指令的行為並警告；多重政策拒絕合併，避免改變交集語意。無參數 sandbox、upgrade-insecure-requests 與空來源指令必須保留。
- 即時診斷 none 混用、缺引號、未知值、過寬來源、unsafe 關鍵字、nonce 樣板、strict-dynamic、回報端點、Report-Only 特例與 meta 不支援功能。不提供虛假的安全分數。
- 輸出原始值、HTTP、Nginx、Apache、meta、完整 JSON 專案。meta 遇不支援指令與 Report-Only 阻止輸出，不悄悄拿掉保護。語法錯誤阻止部署格式匯出，仍可儲存草稿 JSON。
- 操作歷史復原／重做；明確選擇儲存在本機，無未告知的自動上傳。
- 模擬 URL、inline、eval 與 fallback，顯示命中規則及 Report-Only 實際不封鎖。瀏覽器相容性、重新導向、動態信任、sandbox 等超出精簡模型的情形顯示需實測，不能保證網站能運作。
- SHA-256 工具雜湊原始內容，不包含 script 標籤，保留空白，透過 Web Crypto。

## 驗證與界線

以 Node 內建測試先驗證政策往返、匯入失敗不破壞資料、fallback、來源匹配及輸出跳脫。瀏覽器驗證匯入編輯匯出、情境、模擬、行動版及鍵盤流程。正式發布既有公開站點不屬於本次的必要動作；先交付可檢查的程式碼。

不掃描任意網站、不接收真實 CSP 回報、不產生可重複使用的正式 nonce、不把通過模擬當作 XSS 防護證明。套用到真實網站前需盤點登入、付款、嵌入及各頁面的資源，先觀察再強制。

## 參考

- https://www.w3.org/TR/CSP3/
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox
- https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CSP
