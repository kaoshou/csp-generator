# CSP 工作台

一個繁體中文、純前端的 Content Security Policy 編輯與教學工具。從使用情境建立政策，理解各項設定的用途與影響，模擬來源規則，再匯出到部署環境。保存 JSON 專案或貼回政策值，就能繼續編輯。

既有線上站點：[csp.yuhan.tw](https://csp.yuhan.tw/) · [GitHub Pages](https://kaoshou.github.io/csp-generator/)

## 可以做什麼

- **從需求開始**：靜態網站、前後端分離、第三方字型／影片、nonce 嚴格政策，以及從全部封鎖開始的課堂練習。套用前顯示可能影響，不會自動掃描或修改網站。
- **理解再設定**：25 項指令的用途、可能副作用與適合情境；顯示目前有效的 fallback；支援搜尋、分類與只看已啟用。
- **可靠的重新編輯**：匯入純 CSP、單一完整 HTTP 標頭、對應 Reporting-Endpoints，或版本化 JSON 專案。先解析預覽再套用，並可復原／重做。
- **保留原政策**：未知與過時指令不會無聲遺失，無參數 `sandbox`、`upgrade-insecure-requests` 與空來源清單也能保留。重複指令依瀏覽器採第一個並提出提醒。
- **檢查設定**：找出 none 混用、關鍵字缺引號、不適用的來源、nonce 樣板、過寬來源及回報設定等問題。錯誤會阻止部署格式輸出；JSON 仍可保存草稿。
- **六種輸出**：HTTP 回應標頭、純政策值、Nginx、Apache、HTML meta、JSON 專案，可複製或下載。meta 不支援的功能會明確阻止輸出。
- **理解預期結果**：模擬 URL、行內內容、nonce/hash 與 eval，說明命中的來源規則和觀察模式差異。超出模型範圍時明確提示實測。
- **部署與教學**：備份、觀察、流程驗證、逐步強制、回復方案、故障對照表、基本觀念與課堂練習。
- **本機資料**：SHA-256 內容雜湊、明確選擇的瀏覽器草稿與 JSON 備份。無追蹤、外部字型、後端或執行期套件。

## 使用流程

1. 選擇情境，或匯入現有設定。確認政策模式；新專案預設 **Report-Only**。
2. 設定受保護網站的 origin，例如 `https://app.your-domain.com`，不含路徑或結尾斜線。此值協助模擬 `'self'`，不會對該站發送請求。
3. 展開需要的規則，閱讀影響，再填入真實來源。常用選項可切換；每項指令有獨立啟用狀態。**啟用的空來源清單會封鎖該類資源；停用指令才會使用 fallback。**
4. 查看設定檢查與模擬結果。若是範例 API、nonce 樣板或回報端點，先完成實際環境配合。
5. 選擇部署格式複製／下載；用「儲存專案」另存 `.csp.json`，下次可完整還原。
6. 按「安全上線」流程測試，確認最終 HTTP 回應，再逐步使用強制模式。

純政策值不包含模式、網站來源及獨立回報標頭；要完整保存請使用 JSON。可直接重新匯入 HTTP 標頭與政策值；Nginx／Apache／meta 是部署片段，重新編輯時請取出政策值，或使用 JSON 專案。多份 CSP 政策具有交集效果，本工具一次編輯一份，不會將它們合併成較寬鬆的規則。

「儲存在此瀏覽器」只在點擊時儲存，不會自動保存後續修改，也不會自動載入／覆蓋目前工作。清除瀏覽器資料可能刪除草稿；正式設定請保留 JSON 備份。

## 本機執行與測試

需要 Node.js 22 以上，**不需要安裝套件或執行建置**：

```sh
npm run dev
```

開啟 <http://127.0.0.1:4173>。伺服器只監聽本機 loopback，僅供開發。可用環境變數 `PORT` 更換連接埠。也可直接開啟 `index.html`；剪貼簿和 Web Crypto 依瀏覽器對本機檔案的支援而定，建議使用 localhost 或 HTTPS。

```sh
npm test
node --check scripts/app.js
node --check scripts/core.js
node --check scripts/catalog.js
```

自動測試涵蓋匯入／輸出往返、JSON 格式、重複／空指令、CSP fallback、來源／路徑／連接埠匹配、行內腳本、hash、sandbox 與伺服器輸出字元處理。瀏覽器驗證紀錄見 [docs/verification.md](docs/verification.md)。

## 部署這個工具

保留 `index.html`、`styles.css`、`scripts/catalog.js`、`scripts/core.js`、`scripts/app.js` 與 `assets/` 的相對路徑，直接部署靜態檔案即可。原有 GitHub Pages 可繼續使用根目錄，`CNAME` 保留 `csp.yuhan.tw`。不需要註冊服務或設定密鑰。

工具自己使用外部同源 CSS/JS，沒有行內事件處理器。若替工具加上 CSP，需在實際主機設定回應標頭；GitHub Pages 不提供在 repository 檔案中自訂任意 HTTP 回應標頭的能力，需由支援的代理或主機處理。不要將產生的待測政策直接套在工具自身頁面上。

## 正式設定的必要條件

- **Report-Only 不封鎖違規資源**；回報需自行建立接收服務並確認瀏覽器支援。沒有端點時應透過開發者工具檢查。報告不保證即時或完整，且可能含頁面 URL 等資料。
- **Nonce 需要伺服器參與**：每次回應用密碼學安全亂數產生新的值，標頭與 script/style 元素必須一致。不要部署固定 nonce；範例的 `REPLACE_PER_RESPONSE` 會被阻止輸出。
- **Hash 必須對應完全一致的內容**：包括空白與換行，不含 script/style 標籤。外部腳本還需正確的 integrity metadata；行內事件／style 屬性的 hash 涉及 unsafe-hashes 與額外風險。
- **Meta 功能有限**：不支援 Report-Only、frame-ancestors、sandbox 與回報功能。工具不會偷偷移除這些設定來產生 meta。
- **Sandbox 與 HTTP 升級需額外驗證**：sandbox 限制收到政策的整份文件，在 Report-Only 不生效；upgrade-insecure-requests 在觀察模式不會升級請求。
- **部署片段需經主機驗證**：Apache 輸出將 `%` 寫為 `%%`，避免被 mod_headers 當作格式指令；Nginx 輸出遇到 `$` 會阻止，避免誤當變數。這些情形仍可保存原始 CSP／JSON，並由部署端處理。務必執行主機設定語法檢查，再確認瀏覽器收到的最終標頭。
- **模擬不是瀏覽器引擎或安全稽核**：不驗證實際頁面、SRI、CORS、重新導向、Trusted Types sanitizer、動態載入信任鏈或所有瀏覽器行為。需對登入、付款、iframe、上傳、行動版等真實流程實測。CSP 不取代修補 XSS、輸入處理與權限檢查。

## 專案結構

```text
index.html            介面、教學與部署說明
styles.css            響應式樣式、鍵盤焦點與列印樣式
scripts/catalog.js    指令解說與情境資料
scripts/core.js       純政策解析、檢查、輸出與模擬
scripts/app.js        介面、操作歷史、匯入預覽與本機檔案
scripts/serve.cjs     僅供開發的本機伺服器
tests/core.test.cjs   Node 原生回歸測試
```

## 參考資料

說明查核日期：2026-11-09。

- [W3C CSP Level 3](https://www.w3.org/TR/CSP3/)
- [MDN CSP 指令參考](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
- [MDN CSP 部署指南](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CSP)
- [Apache mod_headers](https://httpd.apache.org/docs/2.4/mod/mod_headers.html#header)
- [Nginx headers module](https://nginx.org/en/docs/http/ngx_http_headers_module.html)
- [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/)（外部服務，不會由本工具自動傳送政策）

## 作者與授權

鄭郁翰 (Yu-Han Cheng) · <kaoshou@gmail.com>

本專案採用 [GNU GPL-3.0](LICENSE) 授權，使用、修改及散佈時請遵循原授權條款。
