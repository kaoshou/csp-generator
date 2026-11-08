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
  document.getElementById('summary').textContent=`完成：${passed} 通過，${failed} 失敗。`;
  button.disabled=false;
});
