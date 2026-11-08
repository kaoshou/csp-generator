# CSP 工作台驗證紀錄

## 2.1.0 建議基線與整合指南

2026-11-09，本機驗證完成：

- Node 原生回歸 **43 項通過、0 失敗**；app/core/catalog/guidance/browser-test 腳本語法檢查與 diff 空白檢查通過。
- `tests/browser.html` 的 **15 組真實瀏覽器回歸通過、0 失敗**：包含基線、預覽/套用/復原/重做、元素 CDN 規則、錯誤 URL、JSON 往返、未知/空指令、File.text/DataTransfer 匯入、過大檔案、多重政策拒絕、本機草稿、HTML 文字跳脫、SHA-256/384/512、模擬、六種輸出與 strict-dynamic 衝突。
- 另外透過瀏覽器 UI 逐一驗證 10 種整合，來源、metadata 與未修改指令保持正確。CDN query/fragment 不進入來源規則；不放寬 script-src-attr 或 default-src。
- 獨立檢視發現並補測：fallback 中不適用的執行關鍵字、萬用來源及不支援的主機語法。另以瀏覽器重現 URL 主機字元正規化差異，修正後拒絕明文與 percent-encoded 萬用主機。
- 320px、390px 手機與 768px 平板檢查無頁面水平溢出；長 URL 的預覽對話框已修正換行，對話框 scrollWidth 等於 clientWidth。恢復測試時的 viewport 覆寫。
- 實際點擊複製，再 Ctrl+V 貼回匯入欄位，確認政策標頭正確。實際下載 `csp-local-validation-20261109.csp.json`，檔案解析為完整 version-1、Report-Only 專案。
- 檔案匯入已使用瀏覽器原生 File、DataTransfer 與實際 change handler 驗證；未要求擴大擴充功能的檔案系統權限，未使用作業系統檔案選擇對話框。這與下方 2.0 時尚未完成的程式路徑驗證有所不同。
- 測試與 docs 透過 `_config.yml` 排除於正式 Pages 輸出。資產版本參數為 `2.1.0`。

以上是工具功能與本機來源規則驗證，不是目標網站的弱掃或真實 Google/CDN 服務相容性保證。指南本身不主動載入第三方服務；實際整合仍需依需求、官方文件與完整頁面流程驗證。

## 2.0 開發紀錄（保留歷史）

日期：2026-11-09。環境：Windows、Node.js 24.14.0、Google Chrome，本機 loopback 開發伺服器。

## 自動檢查

`npm test`：29 項通過，0 失敗。`node --check`：app、core、catalog、serve 全部通過。`git diff --check`：無空白錯誤。

範圍包含：HTTP／JSON 往返、Reporting-Endpoints、重複指令第一個生效、未知與空指令保留、多重政策拒絕、JSON 結構與危險鍵名拒絕、none 混用、關鍵字適用範圍、meta 限制、Apache 百分比與 Nginx 變數、fallback、同源／連接埠／子網域／目錄邊界、inline nonce/hash、strict-dynamic、sandbox、HTTPS 升級，以及精確 UTF-8 SHA-256。

## 瀏覽器操作驗證

| 操作 | 結果 |
| --- | --- |
| 首頁、25 項規則及預設 Report-Only 輸出 | 正常載入 |
| 匯入含未知 x-future、無參數 sandbox 的完整標頭 | 預覽、套用、輸出均保留 |
| 修改 img-src 加入 data: | 即時輸出與變更比較同步 |
| 復原與重做 | 原值／新值正確還原 |
| JSON 輸出後貼回匯入 | 完整輸出逐字一致 |
| 多份政策匯入 | 顯示錯誤，禁止套用，目前政策保持不變 |
| 帶未知指令的政策改套情境 | 發現舊 DOM 卡片的 metadata 存取錯誤，修正後重做完整流程通過 |
| 教學情境模擬同源圖片 | 回退 default-src none，顯示若強制執行將封鎖 |
| 為 img-src 加入 self 再模擬 | 顯示有效規則允許 |
| Report-Only 匯出 meta | 明確阻止輸出，禁止複製 |
| none 與 https: 混用 | 顯示錯誤，禁止部署格式複製 |
| SHA-256 計算 hello 並加入腳本規則 | 得到 LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ= 並寫入政策 |
| 點擊本機儲存、修改名稱、載入草稿 | 先預覽再套用，名稱與 hash 正確恢復；測試草稿已清除 |
| 點擊複製後 Ctrl+V 貼回匯入欄位 | 貼入正確的 Content-Security-Policy-Report-Only 標頭 |
| 點擊儲存專案下載 | 實際下載 .csp.json，檔案內容確認為完整有效專案 |
| 桌面約 1495px 與手機 390px、320px | 檢視實際畫面；窄版工具列修正後無垂直文字，沒有頁面水平溢出 |

## 獨立程式檢視

另一名 reviewer 進行唯讀檢視，指出 6 項可重現問題：Apache `%`、Nginx `$`、任意字串誤作 hash、strict-dynamic 外部 hash 的 SRI 不確定性、sandbox 被提前成功返回略過，以及 self 的 HTTPS 升級。每項已補回歸案例，先確認失敗再修正；完整測試通過。另補目錄斜線邊界與事件屬性 strict-dynamic 回退的案例。

## 尚未驗證的範圍

- 檔案輸入控制的自動化驗證受 Chrome 擴充功能未開啟 file URL 存取權限限制；後續原生視窗驗證因工具無法可靠確認當前瀏覽器網址而停止。未擴大瀏覽器權限。檔案讀取功能已實作，但此紀錄不宣稱檔案選取匯入已通過端到端測試。貼上相同 JSON 的匯入與下載檔案內容已分別驗證。
- 未在 Apache／Nginx 實際伺服器載入產出設定；字元處理依官方文件與來源碼查核及回歸案例驗證，部署前仍需執行主機語法檢查。
- 未修改真實網站政策、回報端點或 CDN 設定，未做實際應用程式的登入／付款等相容性測試。
- 未做 Firefox／Safari 跨瀏覽器測試、完整無障礙稽核或 repository 安全稽核。模擬器明確限制為來源規則推演。
