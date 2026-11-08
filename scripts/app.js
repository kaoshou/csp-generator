/* All imported policy data is rendered as escaped text, never executable markup. */
(() => {
  'use strict';
  const C = window.CSPCore, catalog = window.CSPCatalog;
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const owns = (obj, key) => Object.hasOwn(obj, key);
  const storageKey = 'csp-workbench-project-v1';
  let project = C.createProject(), history = [], future = [], baseline = null;
  let group = '全部', candidate = null, scenarioId = null, hash = '', toastTimer;
  let lastEdit = { key: null, time: 0 }, hasSimulated = false;

  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
  }
  function commit(change, key) {
    const next = C.clone(project);
    change(next);
    if (JSON.stringify(next) === JSON.stringify(project)) return;
    const now = Date.now();
    if (!key || lastEdit.key !== key || now - lastEdit.time > 900) {
      history.push(C.clone(project));
      if (history.length > 80) history.shift();
    }
    lastEdit = { key, time: now };
    future = [];
    project = next;
    renderDerived();
  }
  function syncField(id, value) { if (document.activeElement !== $(id)) $(id).value = value; }
  function renderDerived() {
    syncField('project-name', project.name);
    syncField('project-origin', project.origin);
    syncField('reporting-endpoint', project.reportingEndpoint);
    const observing = project.mode === 'report-only';
    $('mode-help').textContent = observing ? '記錄違規，不強制封鎖資源。' : '瀏覽器會強制限制違規資源，請先完成相容性測試。';
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = button.dataset.mode === project.mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $('output-mode').textContent = observing ? 'REPORT-ONLY' : 'ENFORCE';
    $('output-mode').className = 'badge ' + (observing ? 'observing' : 'enforcing');
    $('undo').disabled = !history.length;
    $('redo').disabled = !future.length;
    $('rule-count').textContent = Object.keys(project.directives).length + ' 已啟用';
    $('sim-origin').textContent = project.origin;
    $('sim-mode').textContent = observing ? '觀察模式' : '強制模式';
    renderOutput();
    renderDiagnostics();
    updateCards();
    renderChanges();
    if (hasSimulated) simulate();
  }
  function renderOutput() {
    const format = $('output-format').value;
    let valid = true, content;
    try { content = C.exportConfig(project, format); }
    catch (error) { valid = false; content = error.message; }
    $('policy-output').value = content;
    $('policy-output').classList.toggle('invalid', !valid);
    $('copy-output').disabled = !valid;
    $('download-output').disabled = !valid;
    const notes = {
      header: '設定在網頁文件的 HTTP 回應；不要只加到 JS 或 CSS 檔案。',
      raw: '純政策值不包含模式與回報端點標頭；請確認部署時使用正確的標頭名稱。',
      nginx: '先備份設定並執行 nginx -t；確認 server/location 的標頭繼承與實際回應。',
      apache: '需 mod_headers。先檢查語法，再確認 CDN/Proxy 沒有加上另一份政策。',
      meta: 'meta 功能有限，僅影響它之後載入的內容。優先使用 HTTP 標頭。',
      json: '完整保存模式、網站來源、回報端點與政策。可保留未修正的草稿。'
    };
    $('output-note').textContent = valid ? notes[format] : '目前無法匯出此格式。仍可用「儲存專案」保留草稿，修正後再部署。';
  }
  function renderDiagnostics() {
    const order = { error: 0, warning: 1, info: 2 };
    const issues = C.validate(project).sort((a, b) => order[a.level] - order[b.level]);
    const errors = issues.filter(i => i.level === 'error').length;
    const warnings = issues.filter(i => i.level === 'warning').length;
    $('diagnostics-count').textContent = errors ? `${errors} 項錯誤` : warnings ? `${warnings} 項提醒` : '已檢查';
    $('diagnostics-summary').textContent = errors ? '先修正錯誤，再匯出可部署設定。草稿仍可保存。' : warnings ? '可繼續編輯；請確認下列提醒符合你的使用需求。' : '未發現內建規則可辨識的錯誤；仍需在網站實測。';
    $('diagnostics').innerHTML = issues.map(i => `<div class="issue ${i.level}"><span class="issue-dot" aria-hidden="true"></span><div><strong>${escape({ error: '錯誤', warning: '提醒', info: '說明' }[i.level])} · ${escape(i.directive)}</strong><p>${escape(i.message)}</p></div></div>`).join('');
  }
  function allDefinitions() {
    return [...catalog.directives, ...Object.keys(project.directives).filter(name => !catalog.byName[name]).map(name => ({ name, title: '匯入的額外指令', group: '其他', purpose: '原政策的額外指令已完整保留。', impact: '瀏覽器可能忽略不支援的指令；不要依賴未確認的行為提供保護。', use: '查閱對應規格與目標瀏覽器支援，確認後再調整。', options: [], kind: 'unknown' }))];
  }
  function renderRules(initial = false) {
    const opened = new Set([...document.querySelectorAll('.rule-card[open]')].map(card => card.dataset.rule));
    if (initial) opened.add('default-src');
    $('directives').innerHTML = allDefinitions().map((d, i) => {
      const enabled = owns(project.directives, d.name), values = project.directives[d.name] || [];
      const inputLabel = d.kind === 'group' ? '回報群組名稱' : d.kind === 'sandbox' ? '允許的沙箱權限' : '來源或參數';
      return `<details class="rule-card${enabled ? ' enabled' : ''}" data-rule="${escape(d.name)}" ${opened.has(d.name) ? 'open' : ''}>
        <summary><span class="rule-symbol" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="rule-name"><strong>${escape(d.name)}</strong><span>${escape(d.title)}</span></span><span class="rule-brief"></span><span class="rule-state"></span><span class="chevron" aria-hidden="true">⌄</span></summary>
        <div class="rule-body"><p class="rule-purpose">${escape(d.purpose)}</p><div class="rule-insights"><div><strong>可能影響</strong><p>${escape(d.impact)}</p></div><div><strong>適合情境與做法</strong><p>${escape(d.use)}</p></div></div>
        <label class="check-label rule-enable"><input type="checkbox" data-enable="${escape(d.name)}" ${enabled ? 'checked' : ''}> 啟用 ${escape(d.name)} ${d.kind === 'flag' ? '（無參數）' : ''}</label>
        ${d.kind !== 'flag' ? `<label class="rule-values-label" for="values-${escape(d.name)}">${inputLabel}<span>空白或換行分隔 · 輸入即更新</span></label><textarea id="values-${escape(d.name)}" class="rule-values" data-values="${escape(d.name)}" rows="2" spellcheck="false" ${!enabled ? 'disabled' : ''} placeholder="${d.kind === 'sandbox' ? '留空代表啟用完整沙箱' : d.kind === 'group' ? 'csp' : "例如 'self' https://cdn.your-domain.com"}">${escape(values.join(' '))}</textarea><div class="quick-sources">${d.options.map(v => `<button class="source-button${v.includes('unsafe') ? ' risky' : ''}" data-source="${escape(v)}" data-dir="${escape(d.name)}" title="切換 ${escape(v)}">${escape(v)}</button>`).join('')}</div>` : ''}
        <div class="rule-feedback" id="feedback-${escape(d.name)}"></div><p class="rule-fallback" data-fallback="${escape(d.name)}"></p><a class="small-note" href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/${encodeURIComponent(d.name)}" target="_blank" rel="noopener noreferrer">查閱指令文件 ↗</a></div></details>`;
    }).join('');
    updateCards();
  }
  function updateCards() {
    const search = $('rule-search').value.trim().toLowerCase();
    const definitions = allDefinitions();
    const errors = C.validate(project).filter(issue => issue.level === 'error');
    let visible = 0;
    document.querySelectorAll('.rule-card').forEach(card => {
      const name = card.dataset.rule, d = definitions.find(def => def.name === name);
      // A replacement/undo can remove an imported unknown directive before the
      // next full rule render. Do not read metadata from that obsolete card.
      if (!d) { card.hidden = true; return; }
      const enabled = owns(project.directives, name), values = project.directives[name] || [];
      const match = (group === '全部' || d.group === group) && (!$('enabled-only').checked || enabled) && `${name} ${d.title} ${d.purpose} ${d.impact} ${d.use} ${values.join(' ')}`.toLowerCase().includes(search);
      card.hidden = !match;
      if (match) visible++;
      card.classList.toggle('enabled', enabled);
      card.querySelector('.rule-state').textContent = enabled ? '已啟用' : '未設定';
      card.querySelector('.rule-brief').textContent = enabled ? values.join(' ') || '（無參數）' : '';
      const checkbox = card.querySelector('[data-enable]');
      checkbox.checked = enabled;
      const textarea = card.querySelector('textarea');
      const ruleErrors = errors.filter(issue => issue.directive === name);
      card.querySelector('.rule-feedback').textContent = ruleErrors.map(issue => issue.message).join(' ');
      if (textarea) { textarea.disabled = !enabled; textarea.setAttribute('aria-invalid', String(ruleErrors.length > 0)); textarea.setAttribute('aria-describedby', 'feedback-' + name); if (document.activeElement !== textarea) textarea.value = values.join(' '); }
      card.querySelectorAll('[data-source]').forEach(button => { const selected = enabled && values.includes(button.dataset.source); button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
      const fallback = card.querySelector('[data-fallback]');
      if (d.kind === 'sources') {
        const effective = C.effectiveDirective(project.directives, name);
        fallback.textContent = effective.name ? `目前有效規則：${effective.name} ${effective.values.join(' ') || '（空清單，封鎖）'}${effective.name !== name ? ' · 由回退規則提供' : ''}` : '目前未設定；沒有來源限制。此項不一定會繼承 default-src。';
      } else fallback.textContent = enabled ? '已包含在政策輸出中。' : '未包含在政策輸出中。';
    });
    $('no-rules').hidden = visible > 0;
  }
  function renderChanges() {
    $('changes-panel').hidden = !baseline;
    if (!baseline) return;
    const changes = [];
    for (const name of new Set([...Object.keys(baseline), ...Object.keys(project.directives)])) {
      const before = baseline[name], after = project.directives[name];
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      if (before) changes.push(`− ${name}${before.length ? ' ' + before.join(' ') : ''};`);
      if (after) changes.push(`+ ${name}${after.length ? ' ' + after.join(' ') : ''};`);
    }
    $('policy-changes').textContent = changes.join('\n') || '規則尚無變更。模式與回報端點請另外確認。';
  }
  function showView(view, focus = false) {
    if (!['editor', 'simulator', 'rollout', 'learn'].includes(view)) view = 'editor';
    document.querySelectorAll('.view').forEach(section => { section.hidden = section.id !== 'view-' + view; });
    document.querySelectorAll('[data-view]').forEach(button => { const active = button.dataset.view === view; button.classList.toggle('active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
    if (location.hash !== '#' + view) window.history.replaceState(null, '', '#' + view);
    if (focus) document.querySelector('.workspace-nav').scrollIntoView({ block: 'start' });
    if (view === 'simulator') { $('sim-origin').textContent = project.origin; }
  }
  function chooseScenario(id) {
    const scenario = catalog.scenarios.find(s => s.id === id);
    if (!scenario) return;
    scenarioId = id;
    $('scenario-title').textContent = scenario.name;
    $('scenario-description').textContent = scenario.description;
    $('scenario-impact').textContent = scenario.impact;
    $('scenario-policy').textContent = C.serializePolicy(scenario.directives);
    $('scenario-dialog').showModal();
  }
  function invalidateImport() {
    candidate = null;
    $('apply-import').disabled = true;
    $('import-preview').hidden = true;
  }
  function previewImport() {
    const text = $('import-text').value.trim();
    const box = $('import-preview');
    candidate = null;
    box.hidden = false;
    box.className = 'import-preview';
    try {
      let warnings = [];
      if (text.startsWith('{')) candidate = C.importProject(text);
      else {
        const parsed = C.parsePolicy(text);
        warnings = parsed.warnings;
        candidate = { ...C.clone(project), directives: parsed.directives, mode: parsed.mode || project.mode, reportingEndpoint: parsed.reportingEndpoint || '' };
      }
      const issues = C.validate(candidate);
      const errors = issues.filter(i => i.level === 'error').length;
      box.innerHTML = `<strong>${Object.keys(candidate.directives).length} 項指令 · ${candidate.mode === 'report-only' ? '觀察模式' : '強制模式'}</strong><p>${errors ? `含 ${errors} 項設定錯誤，可載入為草稿，修正後才能匯出部署設定。` : '解析成功。套用後會取代目前規則，可使用復原還原。'}</p>${warnings.map(w => `<p>提醒：${escape(w)}</p>`).join('')}<pre>${escape(C.serializePolicy(candidate.directives))}</pre>`;
      $('apply-import').disabled = false;
    } catch (error) { box.classList.add('error'); box.textContent = error.message; $('apply-import').disabled = true; }
  }
  function simulate() {
    hasSimulated = true;
    const result = C.simulate(project, { type: $('sim-type').value, kind: $('sim-kind').value, url: $('sim-url').value.trim(), nonce: $('sim-nonce').value.trim(), hash: $('sim-hash').value.trim(), dynamic: $('sim-dynamic').checked });
    const titles = { allowed: '來源規則允許', blocked: result.enforced ? '政策會封鎖' : '若強制執行，將會封鎖', unknown: '需要進一步實測' };
    const effect = result.status === 'blocked' ? result.enforced ? '目前是強制模式：此違規行為會受到阻擋。' : '目前是觀察模式：此 CSP 不會強制封鎖，請檢查 Console 或回報。' : result.status === 'allowed' ? '此結果僅代表 CSP 來源規則；其他瀏覽器限制仍可能阻擋。' : '簡化模擬無法確認結果，請在目標瀏覽器執行實際流程。';
    $('simulation-result').className = 'panel simulation-result ' + result.status;
    $('simulation-result').innerHTML = `<span class="result-icon" aria-hidden="true">${{ allowed: '✓', blocked: '!', unknown: '?' }[result.status]}</span><h3>${titles[result.status]}</h3><p>${escape(result.reason)}</p><pre>${result.directive ? escape(result.directive + ' ' + (result.values.join(' ') || '（空來源清單）')) : '沒有有效的來源指令'}</pre><p>回退順序：${escape(result.chain.join(' → '))}</p><p class="enforcement-note">${escape(effect)}</p>`;
  }
  function syncSimulationKind() {
    const type = $('sim-type').value;
    const scriptOrStyle = /^(script|style)-src/.test(type);
    const attr = type.endsWith('-attr');
    [...$('sim-kind').options].forEach(option => { option.disabled = (option.value === 'inline' && !scriptOrStyle) || (option.value === 'external' && attr) || (option.value === 'eval' && !type.startsWith('script')); });
    if ($('sim-kind').selectedOptions[0].disabled) $('sim-kind').value = attr ? 'inline' : 'external';
    $('sim-url-field').hidden = $('sim-kind').value !== 'external';
    if (hasSimulated) simulate();
  }
  function download(content, filename, json = false) {
    const url = URL.createObjectURL(new Blob([content], { type: json ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已建立下載；請確認瀏覽器的下載項目。');
  }
  function fileStem() { return project.name.replace(/[^\p{L}\p{N}_.-]/gu, '-').slice(0, 70) || 'csp-policy'; }
  function refreshStorage() {
    let exists = false;
    try { exists = !!localStorage.getItem(storageKey); } catch { /* private browsing may disable storage */ }
    $('load-local').hidden = $('clear-local').hidden = !exists;
  }

  $('scenario-cards').innerHTML = catalog.scenarios.map(s => `<button class="scenario-card" data-scenario="${s.id}"><span class="scenario-number">${s.icon}</span><span class="scenario-arrow" aria-hidden="true">↗</span><strong>${escape(s.name)}</strong><span class="scenario-tag">${escape(s.tag)}</span><p>${escape(s.description)}</p></button>`).join('');
  $('rule-filters').innerHTML = ['全部', '基礎', '資源', '邊界', '進階', '回報', '其他'].map(g => `<button data-group="${g}" class="${g === group ? 'selected' : ''}" aria-pressed="${g === group}">${g}</button>`).join('');
  document.addEventListener('click', event => {
    const button = event.target.closest('button, a');
    if (!button) return;
    if (button.dataset.action === 'open-import') { event.preventDefault(); invalidateImport(); $('import-dialog').showModal(); $('import-text').focus(); }
    if (button.dataset.action === 'download-project') download(C.exportProject(project), fileStem() + '.csp.json', true);
    if (button.dataset.action === 'jump-output') { $('policy-output').scrollIntoView({ block: 'center' }); $('policy-output').focus({ preventScroll: true }); }
    if (button.dataset.close) $(button.dataset.close).close();
    if (button.dataset.view || button.dataset.go) { event.preventDefault(); showView(button.dataset.view || button.dataset.go, !!button.dataset.go); }
    if (button.dataset.scenario) chooseScenario(button.dataset.scenario);
    if (button.dataset.mode) commit(p => { p.mode = button.dataset.mode; });
    if (button.dataset.group) {
      group = button.dataset.group;
      document.querySelectorAll('[data-group]').forEach(b => { const selected = b.dataset.group === group; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
      updateCards();
    }
    if (button.dataset.source) {
      const name = button.dataset.dir, value = button.dataset.source;
      commit(p => {
        let values = p.directives[name] || [];
        if (values.includes(value)) values = values.filter(v => v !== value);
        else values = value === "'none'" ? [value] : [...values.filter(v => v !== "'none'"), value];
        p.directives[name] = values;
      });
    }
    if (button.dataset.example) {
      $('sim-nonce').value = $('sim-hash').value = ''; $('sim-dynamic').checked = false;
      $('sim-type').value = button.dataset.example === 'same' ? 'img-src' : 'script-src-elem';
      $('sim-kind').value = button.dataset.example === 'inline' ? 'inline' : 'external';
      $('sim-url').value = button.dataset.example === 'same' ? project.origin + '/image.png' : 'https://cdn.example.net/app.js';
      syncSimulationKind(); simulate();
    }
  });
  $('project-name').addEventListener('input', event => commit(p => { p.name = event.target.value; }, 'name'));
  $('project-origin').addEventListener('input', event => commit(p => { p.origin = event.target.value.trim(); }, 'origin'));
  $('reporting-endpoint').addEventListener('input', event => commit(p => { p.reportingEndpoint = event.target.value.trim(); }, 'reporting'));
  $('rule-search').addEventListener('input', updateCards);
  $('enabled-only').addEventListener('change', updateCards);
  $('directives').addEventListener('change', event => {
    if (event.target.dataset.enable) {
      const name = event.target.dataset.enable;
      commit(p => { if (event.target.checked) p.directives[name] = []; else delete p.directives[name]; });
    }
  });
  $('directives').addEventListener('input', event => {
    const name = event.target.dataset.values;
    if (name) commit(p => { p.directives[name] = [...new Set(event.target.value.trim().split(/\s+/).filter(Boolean))]; }, 'values-' + name);
  });
  $('undo').addEventListener('click', () => { if (!history.length) return; future.push(C.clone(project)); project = history.pop(); lastEdit.key = null; renderDerived(); renderRules(); toast('已復原。'); });
  $('redo').addEventListener('click', () => { if (!future.length) return; history.push(C.clone(project)); project = future.pop(); lastEdit.key = null; renderDerived(); renderRules(); toast('已重做。'); });
  $('output-format').addEventListener('change', renderOutput);
  $('copy-output').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('policy-output').value); toast('已複製目前格式的設定。'); }
    catch { $('policy-output').focus(); $('policy-output').select(); toast('瀏覽器未允許自動複製，已選取內容；請使用 Ctrl/Cmd+C。'); }
  });
  $('download-output').addEventListener('click', () => { const format = $('output-format').value; download($('policy-output').value, fileStem() + ({ json: '.csp.json', meta: '.meta.txt', nginx: '.nginx.conf', apache: '.apache.conf' }[format] || '.csp.txt'), format === 'json'); });
  $('import-text').addEventListener('input', invalidateImport);
  $('preview-import').addEventListener('click', previewImport);
  $('import-file').addEventListener('change', async event => {
    invalidateImport();
    const file = event.target.files[0];
    if (!file) return;
    try { if (file.size > 200000) throw new Error('檔案超過 200 KB，請改用較小的政策檔。'); $('import-text').value = await file.text(); previewImport(); }
    catch (error) { $('import-preview').hidden = false; $('import-preview').className = 'import-preview error'; $('import-preview').textContent = error.message; }
    event.target.value = '';
  });
  $('apply-import').addEventListener('click', () => {
    if (!candidate) return;
    const next = C.clone(candidate); baseline = C.clone(next.directives);
    commit(p => Object.assign(p, next));
    candidate = null; $('import-dialog').close(); renderRules(); renderChanges(); showView('editor'); toast('已匯入政策；可繼續編輯，或使用復原還原。');
  });
  $('apply-scenario').addEventListener('click', () => {
    const next = C.createProject(scenarioId);
    commit(p => { p.directives = next.directives; p.mode = next.mode; p.reportingEndpoint = ''; });
    $('scenario-dialog').close(); renderRules(); showView('editor'); toast('已套用情境並切回觀察模式；請依實際網站調整。');
  });
  $('save-local').addEventListener('click', () => { try { localStorage.setItem(storageKey, C.exportProject(project)); refreshStorage(); toast('已儲存在此瀏覽器；不會上傳，也不會自動儲存後續變更。'); } catch { toast('此瀏覽器無法儲存資料，請下載 JSON 專案備份。'); } });
  $('load-local').addEventListener('click', () => { try { $('import-text').value = localStorage.getItem(storageKey) || ''; $('import-dialog').showModal(); previewImport(); } catch { toast('讀取本機草稿失敗，請改用 JSON 備份。'); } });
  $('clear-local').addEventListener('click', () => { try { localStorage.removeItem(storageKey); refreshStorage(); toast('已刪除瀏覽器中的草稿，目前編輯內容仍保留。'); } catch { toast('無法存取瀏覽器儲存空間。'); } });
  $('hash-content').addEventListener('input', () => { hash = ''; $('hash-result').textContent = ''; $('add-hash').disabled = true; });
  $('calculate-hash').addEventListener('click', async () => {
    const text = $('hash-content').value;
    try { const value = await C.hashSource(text); if (text !== $('hash-content').value) return; hash = value; $('hash-result').textContent = value; $('add-hash').disabled = false; }
    catch (error) { toast(error.message); }
  });
  $('add-hash').addEventListener('click', () => { if (!hash) return; const name = $('hash-target').value; commit(p => { p.directives[name] = [...new Set([...(p.directives[name] || []).filter(v => v !== "'none'"), hash])]; }); toast('已將 hash 加入 ' + name + '。'); });
  $('run-simulation').addEventListener('click', simulate);
  $('sim-type').addEventListener('change', syncSimulationKind);
  $('sim-kind').addEventListener('change', syncSimulationKind);
  for (const id of ['sim-url', 'sim-nonce', 'sim-hash', 'sim-dynamic']) $(id).addEventListener('input', () => { if (hasSimulated) simulate(); });
  window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
  renderRules(true); renderDerived(); refreshStorage(); showView(location.hash.slice(1));
})();
