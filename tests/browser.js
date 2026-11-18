// Development-only tests: real browser File, DataTransfer, DOM events and app state.
document.getElementById('run').addEventListener('click',async()=>{
  const button=document.getElementById('run');button.disabled=true;
  const frame=document.getElementById('app');
  const results=document.getElementById('results');results.replaceChildren();
  let passed=0,failed=0;
  const d=()=>frame.contentDocument,w=()=>frame.contentWindow,q=selector=>d().querySelector(selector);
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const click=selector=>{const el=q(selector);assert(el,'Missing '+selector);el.click();};
  const fill=(selector,value)=>{const el=q(selector);el.value=value;el.dispatchEvent(new (w().Event)('input',{bubbles:true}));};
  const select=(selector,value)=>{const el=q(selector);el.value=value;el.dispatchEvent(new (w().Event)('change',{bubbles:true}));};
  const readProject=()=>{select('#output-format','json');return JSON.parse(q('#policy-output').value);};
  const wait=async(predicate)=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('等待結果逾時');};
  const test=async(name,run)=>{const li=document.createElement('li');try{await run();li.className='pass';li.textContent='通過：'+name;passed++;}catch(error){li.className='fail';li.textContent='失敗：'+name+' — '+error.message;failed++;}results.append(li);};
  await test('工作台初始化與全部指令',()=>{assert(q('#directives').children.length===25,'指令數量錯誤');assert(q('#session-mode').textContent.includes('Report-Only'),'未預設觀察模式');});
  await test('一般基線與整合套用／復原／重做',()=>{
    click('.hero [data-scenario="baseline"]');click('#apply-scenario');
    const baseline=JSON.stringify(readProject());
    click('[data-view="guidance"]');click('[data-recipe="youtube-private"]');
    assert(!q('#apply-recipe').disabled,'應可套用 YouTube');click('#apply-recipe');
    assert(readProject().directives['frame-src'].includes('https://www.youtube-nocookie.com'),'來源遺失');
    click('#undo');assert(JSON.stringify(readProject())===baseline,'復原未還原完整政策');
    click('#redo');assert(readProject().directives['frame-src'].includes('https://www.youtube-nocookie.com'),'重做失敗');
  });
  await test('非安全與萬用 CDN 網址拒絕套用',()=>{
    click('[data-view="guidance"]');click('[data-recipe="js-cdn"]');
    for(const url of ['https://*/','https://%2A/','http://cdn.test/app.js','javascript:alert(1)','https://user:pass@cdn.test/app.js']){fill('#recipe-url',url);assert(q('#apply-recipe').disabled,'不應接受 '+url);}
    click('#recipe-dialog [data-close]');
  });
  await test('CDN 元素規則與 query 說明',()=>{
    click('[data-recipe="js-cdn"]');fill('#recipe-url','https://cdn.test/lib@1/app.js?q=1');click('#apply-recipe');
    const p=readProject();assert(p.directives['script-src-elem'].includes('https://cdn.test/lib@1/app.js'),'檔案來源錯誤');assert(p.directives['script-src-attr'][0]==="'none'",'行內事件被意外放寬');assert(p.directives['script-src'][0]==="'self'",'script fallback 被意外改寫');
  });
  await test('JSON 貼上往返與未知／無參數指令',()=>{
    const p=readProject();p.directives['x-future']=['alpha'];p.directives.sandbox=[];
    click('[data-action="open-import"]');fill('#import-text',JSON.stringify(p));click('#preview-import');click('#apply-import');
    const after=readProject();assert(after.directives['x-future'][0]==='alpha','未知指令遺失');assert(Array.isArray(after.directives.sandbox)&&after.directives.sandbox.length===0,'空 sandbox 遺失');
  });
  await test('真實 File.text + DataTransfer 檔案匯入',async()=>{
    const p=readProject();p.name='瀏覽器 File API 回歸測試';
    click('[data-action="open-import"]');
    const transfer=new (w().DataTransfer)();transfer.items.add(new (w().File)([JSON.stringify(p)],'policy.csp.json',{type:'application/json'}));
    q('#import-file').files=transfer.files;q('#import-file').dispatchEvent(new (w().Event)('change',{bubbles:true}));
    await wait(()=>!q('#apply-import').disabled);click('#apply-import');assert(readProject().name===p.name,'檔案內容未寫入專案');
  });
  await test('過大 File 拒絕且政策不變',async()=>{
    const before=JSON.stringify(readProject());click('[data-action="open-import"]');
    const transfer=new (w().DataTransfer)();transfer.items.add(new (w().File)(['a'.repeat(200001)],'large.txt'));
    q('#import-file').files=transfer.files;q('#import-file').dispatchEvent(new (w().Event)('change',{bubbles:true}));
    await wait(()=>q('#import-preview').textContent.includes('200 KB'));
    assert(q('#apply-import').disabled,'過大檔仍可套用');click('#import-dialog [data-close]');assert(JSON.stringify(readProject())===before,'失敗匯入破壞資料');
  });
  await test('多重政策拒絕／不覆蓋原值',()=>{
    const before=JSON.stringify(readProject());click('[data-action="open-import"]');fill('#import-text',"default-src 'self', img-src 'none'");click('#preview-import');assert(q('#apply-import').disabled,'多份政策誤接受');click('#import-dialog [data-close]');assert(JSON.stringify(readProject())===before,'原政策被改動');
  });
  await test('本機草稿儲存與載入（保留既有測試前草稿）',()=>{
    const storage=w().localStorage,key='csp-workbench-project-v1',previous=storage.getItem(key);
    try{
      const name=readProject().name;click('#save-local');fill('#project-name','暫時修改名稱');click('#load-local');click('#apply-import');assert(readProject().name===name,'草稿未還原專案');
    }finally{if(previous===null)storage.removeItem(key);else storage.setItem(key,previous);}
  });
  await test('匯入文字不會變成可執行的 HTML 元素',()=>{
    const p=readProject();p.directives['x-markup']=['<img/src=x/onerror=alert(1)>'];
    click('[data-action="open-import"]');fill('#import-text',JSON.stringify(p));click('#preview-import');click('#apply-import');
    assert(q('#values-x-markup').value.includes('<img/'),'匯入文字應保留');assert(!q('#directives img'),'匯入內容變成了 HTML 圖片');
  });
  await test('未知指令後套情境不會中斷畫面',()=>{click('.hero [data-scenario="baseline"]');click('#apply-scenario');assert(!q('#scenario-dialog').open,'情境套用中斷');assert(!readProject().directives['x-future'],'舊未知指令未替換');});
  await test('上線流程結果依規則標記重測，可復原並從本機草稿還原',()=>{
    const original=readProject(),storage=w().localStorage,key='csp-workbench-project-v1',saved=storage.getItem(key);
    const maps='[data-rollout-flow="maps"]',forms='[data-rollout-flow="forms"]',backup='[data-rollout-check="backup"]';
    const load=text=>{click('[data-action="open-import"]');fill('#import-text',text);click('#preview-import');click('#apply-import');};
    try{
      click('[data-view="rollout"]');click(backup);select(maps,'pass');select(forms,'fail');
      const tested=readProject();
      click('#save-local');
      load("frame-src https://maps.test; "+w().CSPCore.serializePolicy(Object.fromEntries(Object.entries(tested.directives).filter(([name])=>name!=='frame-src'))));
      assert(q(maps).value==='retest'&&q(forms).value==='fail','框架變更應只提醒相關流程');
      assert(q('#rollout-note-maps').textContent.includes('通過'),'應保留前次通過紀錄');
      click('#undo');assert(JSON.stringify(readProject())===JSON.stringify(tested),'未復原政策與實測紀錄');
      click('#redo');assert(q(maps).value==='retest','重做沒有標示重測');
      select(maps,'pass');assert(!readProject().rollout.flows.maps.needsRetest,'重新通過後仍顯示過期');
      select(forms,'pending');click(backup);click('#load-local');click('#apply-import');
      assert(q(backup).checked&&q(maps).value==='pass'&&q(forms).value==='fail','草稿遺失檢查或流程結果');
      const malformed=readProject();malformed.rollout.flows.maps.status='bogus';
      click('[data-action="open-import"]');fill('#import-text',JSON.stringify(malformed));click('#preview-import');
      assert(q('#apply-import').disabled,'錯誤的流程資料仍可套用');click('#import-dialog [data-close]');
    }finally{
      if(saved===null)storage.removeItem(key);else storage.setItem(key,saved);
      load(JSON.stringify(original));
    }
  });
  await test('雜湊預覽可取消、保留繼承清單或只用雜湊，並可復原',async()=>{
    const original=JSON.stringify(readProject());
    click('[data-action="open-import"]');fill('#import-text',"default-src 'self' https://static.test;");click('#preview-import');click('#apply-import');
    const before=JSON.stringify(readProject());
    click('[data-view="guidance"]');click('[data-action="open-hash"]');select('#hash-target','script-src-elem');
    fill('#hash-content','hello');select('#hash-algorithm','SHA-256');click('#calculate-hash');await wait(()=>!q('#add-hash').disabled);
    const digest="'sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='";
    click('#add-hash');assert(q('#hash-dialog').open,'未開啟預覽');
    assert(q('#hash-before').textContent==="default-src 'self' https://static.test;",'未列出繼承清單');
    assert(q('#hash-after').textContent==="script-src-elem 'self' https://static.test "+digest+";",'預設未保留來源');
    select('#hash-strategy','only');assert(q('#hash-after').textContent==='script-src-elem '+digest+';','只使用雜湊的預覽錯誤');
    click('#hash-dialog [data-close]');assert(JSON.stringify(readProject())===before,'取消變更了政策');
    click('#add-hash');click('#apply-hash');
    assert(JSON.stringify(readProject().directives['script-src-elem'])===JSON.stringify(["'self'",'https://static.test',digest]),'套用結果與預覽不同');
    click('#undo');assert(JSON.stringify(readProject())===before,'復原未移除新指令');
    click('#add-hash');select('#hash-strategy','only');click('#apply-hash');
    assert(JSON.stringify(readProject().directives['script-src-elem'])===JSON.stringify([digest]),'只使用雜湊的套用結果有誤');
    click('#undo');click('#undo');assert(JSON.stringify(readProject())===original,'未還原測試前政策');
  });
  await test('SHA-256／384／512 產生及 stale hash 重設',async()=>{
    click('[data-view="guidance"]');click('[data-action="open-hash"]');fill('#hash-content','hello');
    const expected={'SHA-256':"'sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='",'SHA-384':"'sha384-WeF0h3dEjGnea4ANejO7+5/xtGPkQ1TDVTvNucZm+pASWjx5+QOXvfX2oT3oKGhP'",'SHA-512':"'sha512-m3HSJL1i83hdltRq0+o9czGb+8KJDKra4t/3JRlnPKcjI8PZm6XBHXx6zG4UuMXaDEZjR1wuXDre9G9zvN7AQw=='"};
    for(const algorithm of Object.keys(expected)){select('#hash-algorithm',algorithm);assert(q('#add-hash').disabled,'舊 hash 未失效');click('#calculate-hash');await wait(()=>!q('#add-hash').disabled);assert(q('#hash-result').textContent===expected[algorithm],algorithm+' 結果不符');}
    fill('#hash-content','hello ');assert(q('#add-hash').disabled,'內容更新未使 hash 失效');
  });
  await test('模擬 iframe 開放前後與觀察模式',()=>{
    click('[data-view="simulator"]');select('#sim-type','frame-src');fill('#sim-url','https://www.youtube.com/embed/demo');click('#run-simulation');assert(q('#simulation-result').classList.contains('blocked'),'基線應封鎖 iframe');assert(q('#simulation-result').textContent.includes('觀察模式'),'未解釋 Report-Only');
    click('[data-view="guidance"]');click('[data-recipe="youtube"]');click('#apply-recipe');click('[data-view="simulator"]');click('#run-simulation');assert(q('#simulation-result').classList.contains('allowed'),'加入來源後應允許');
  });
  await test('六種輸出與 meta 限制',()=>{
    click('[data-view="editor"]');
    for(const format of ['raw','header','nginx','apache','json']){select('#output-format',format);assert(!q('#copy-output').disabled,format+' 不可輸出');assert(q('#policy-output').value.length>20,format+' 無內容');}
    select('#output-format','meta');assert(q('#copy-output').disabled,'Report-Only meta 不應可輸出');
    click('[data-mode="enforce"]');assert(q('#copy-output').disabled,'frame-ancestors meta 不應可輸出');click('[data-mode="report-only"]');select('#output-format','header');
  });
  await test('strict-dynamic 阻止只加 CDN 的錯誤調整',()=>{
    click('[data-action="open-import"]');fill('#import-text',"default-src 'self'; script-src 'nonce-YWJjZA==' 'strict-dynamic';");click('#preview-import');click('#apply-import');
    click('[data-view="guidance"]');click('[data-recipe="js-cdn"]');fill('#recipe-url','https://cdn.test/app.js');assert(q('#apply-recipe').disabled,'strict-dynamic 應要求 nonce/SRI');assert(q('#recipe-preview').textContent.includes('strict-dynamic'),'沒有說明衝突');click('#recipe-dialog [data-close]');
  });
  await test('首頁分流至地圖 iframe、Maps API、CDN 與匯入',()=>{
    const before = readProject();
    for (const recipe of ['youtube', 'youtube-private', 'maps-embed', 'css-cdn', 'js-cdn']) {
      select('#task-choice', recipe); click('#open-task');
      assert(q('#recipe-dialog').open, recipe + ' 未開啟');
      assert(q('#recipe-url-field').hidden === !recipe.endsWith('cdn'), 'CDN URL 欄位錯誤');
      click('#recipe-dialog [data-close]');
    }
    select('#task-choice','maps-js'); click('#open-task');
    assert(!q('#view-guidance').hidden && d().activeElement.id==='maps-js-guide','應前往 Maps JS 實作說明');
    click('.hero [data-action="open-import"]'); assert(q('#import-dialog').open,'首頁匯入未開啟');
    click('#import-dialog [data-close]');
    assert(JSON.stringify(readProject())===JSON.stringify(before),'查看情境改寫草稿');
  });
  await test('弱掃提醒指出命中值，可跳轉、預覽、取消再套用',()=>{
    const policy = "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'";
    click('[data-action="open-import"]'); fill('#import-text',policy); click('#preview-import'); click('#apply-import');
    click('[data-view="guidance"]');
    assert(q('#baseline-assessment a[href$="/10055-10/"]'),'缺少 unsafe-eval 對照');
    assert(q('#baseline-assessment a[href$="/10055-6/"]'),'缺少 style unsafe-inline 對照');
    click('[data-edit-finding="script-src"]');
    assert(d().activeElement.id==='values-script-src','未定位規則');
    click('[data-view="guidance"]'); click('[data-preview-finding="script-src"]'); fill('#finding-input',"'self'");
    assert(q('#finding-after').textContent.includes("script-src 'self'"),'預覽未顯示新規則');
    click('#finding-dialog [data-close]'); assert(readProject().directives['script-src'].includes("'unsafe-eval'"),'取消應保留設定');
    click('[data-preview-finding="script-src"]'); fill('#finding-input',"'self'"); click('#finding-apply');
    assert(readProject().directives['script-src'].join(' ')==="'self'",'套用失敗');
    click('#undo'); assert(readProject().directives['script-src'].includes("'unsafe-eval'"),'復原失敗');
  });
  document.getElementById('summary').textContent=`完成：${passed} 通過，${failed} 失敗。`;
  button.disabled=false;
});
