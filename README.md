# Content Security Policy (CSP) 產生器工具

這是一個簡單直覺的一頁式工具，輔助初學者認識網站開發如何產生 Content-Security-Policy (CSP) 標頭，以提升網站安全性、降低 XSS 等攻擊風險。

👉 [點此使用線上版](https://kaoshou.github.io/csp-generator/)

---

## ✨ 功能特色

- 支援常見 CSP 指令（如 `script-src`、`style-src`、`img-src` 等）
- 提供常見來源選項（如 `'self'`、`'none'`、CDN 等）供勾選
- 可逐筆輸入自訂來源，免去格式困擾
- 提供 Tooltip 滑鼠懸停顯示 CSP 保留字與關鍵字說明
- 支援進階項目如：
  - `sandbox` 的權限控制
  - `require-sri-for` 強制使用 SRI
  - `report-to` / `report-uri` 回報政策違規事件
- 即時產出完整 CSP 標頭，可複製使用
- 前端執行，無需伺服器，純 HTML + JS + CSS

---

## 🛠 使用方式

1. 開啟 [線上工具頁面](https://kaoshou.github.io/csp-generator/)
2. 瀏覽下方各項 CSP 指令區塊，依需求勾選常見來源或輸入自訂網址
3. 點擊「🚀 產生 Content-Security-Policy 標頭」
4. 下方會顯示完整的 CSP 設定字串，可用於 HTTP Response Header 或 `<meta http-equiv="Content-Security-Policy">`

---

## ⚠️ 注意事項

- 本工具僅供個人測試與教學用途，產生內容之正確性、完整性與安全性，請使用者自行驗證。
- 建議將此工具作為 CSP 建立的輔助工具，實際部署仍需依照應用需求調整。
- `report-uri` 為舊版通報方式，未來建議改用 `report-to` 搭配 Reporting API。

---

## 📚 延伸閱讀

- [W3C CSP 規格（官方文件）](https://www.w3.org/TR/CSP/)
- [MDN Web Docs: Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)（由 Google 提供的 CSP 安全性分析工具）

---

## 🧑‍💻 作者資訊

鄭郁翰 (Yu-Han Cheng)  
📧 E-mail：<kaoshou@gmail.com>

感謝 ChatGPT 😃

---

## 📜 授權條款

本專案採用 [GNU 通用公共授權條款第 3 版（GPL-3.0）](https://www.gnu.org/licenses/gpl-3.0.html) 授權釋出。  
您可以自由使用、修改、散佈本程式碼，但需遵循 GPL-3.0 授權規定。
