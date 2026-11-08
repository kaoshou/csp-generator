const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../scripts/core.js');
let G; try { G = require('../scripts/guidance.js'); } catch { G = {}; }

test('general baseline explicitly closes common gaps without unsafe sources or enforcement by default',()=>{
  const p = C.createProject('baseline');
  assert.equal(p.mode,'report-only');
  for (const name of ['default-src','script-src','script-src-attr','style-src','object-src','base-uri','frame-ancestors','form-action','frame-src']) assert.ok(Object.hasOwn(p.directives,name));
  assert.deepEqual(p.directives['object-src'],["'none'"]);
  assert.deepEqual(p.directives['script-src-attr'],["'none'"]);
  assert.ok(!C.serializePolicy(p.directives).includes('unsafe-'));
  assert.equal(C.validate(p).filter(i=>i.level==='error').length,0);
});
test('YouTube integration changes only frame sources and retains project metadata and unknown directives',()=>{
  const p = C.createProject('static'); p.directives['x-future']=['alpha']; p.mode='enforce'; p.reportingEndpoint='https://reports.test/csp';
  const original=JSON.stringify(p);
  const result=G.proposeRecipe(p,'youtube-private');
  assert.deepEqual(result.project.directives['frame-src'],["'self'",'https://www.youtube-nocookie.com']);
  assert.equal(result.project.mode,'enforce'); assert.equal(result.project.reportingEndpoint,p.reportingEndpoint);
  assert.deepEqual(result.project.directives['x-future'],['alpha']);
  assert.equal(JSON.stringify(p),original);
  assert.deepEqual(result.changes.map(x=>x.name),['frame-src']);
});
test('iframe integration replaces none without opening script or ancestor permissions',()=>{
  const p=C.createProject('baseline');
  const result=G.proposeRecipe(p,'maps-embed');
  assert.deepEqual(result.project.directives['frame-src'],['https://www.google.com']);
  assert.deepEqual(result.project.directives['script-src'],p.directives['script-src']);
  assert.deepEqual(result.project.directives['frame-ancestors'],["'none'"]);
});
test('CDN integrations target explicit element rules without relaxing attribute or worker fallbacks',()=>{
  const p=C.createProject('static'); p.directives['script-src-elem']=["'self'"]; p.directives['script-src-attr']=["'none'"];
  const r=G.proposeRecipe(p,'js-cdn',{url:'https://cdn.test/lib@1.2.3/app.js?v=1#frag'});
  assert.deepEqual(r.project.directives['script-src-elem'],["'self'",'https://cdn.test/lib@1.2.3/app.js']);
  assert.deepEqual(r.project.directives['script-src'],["'self'"]);
  assert.deepEqual(r.project.directives['script-src-attr'],["'none'"]);
  assert.ok(r.notes.some(n=>n.includes('query')||n.includes('查詢')));
});
test('CDN without explicit element rule creates a narrow override from the effective fallback',()=>{
  const p=C.createProject('static');
  const r=G.proposeRecipe(p,'css-cdn',{url:'https://cdn.test/ui.css'});
  assert.deepEqual(r.project.directives['style-src-elem'],["'self'",'https://cdn.test/ui.css']);
  assert.deepEqual(r.project.directives['style-src'],["'self'"]);
});
test('explicit empty rules stay blocked except for the deliberately added integration',()=>{
  const p=C.createProject('static'); p.directives['frame-src']=[];
  assert.deepEqual(G.proposeRecipe(p,'youtube').project.directives['frame-src'],['https://www.youtube.com']);
});
test('a JS CDN proposal cannot pretend a host source solves strict-dynamic',()=>{
  const p=C.createProject('static'); p.directives['script-src']=["'nonce-YWJjZA=='","'strict-dynamic'"];
  const r=G.proposeRecipe(p,'js-cdn',{url:'https://cdn.test/app.js'});
  assert.ok(r.conflicts.length>0);
  assert.deepEqual(r.project,p);
});
test('recipe URLs reject unsafe schemes credentials and policy injection',()=>{
  const p=C.createProject('static');
  for (const url of ['javascript:alert(1)','http://cdn.test/a.js','https://user:pass@cdn.test/a.js','https://cdn.test/a.js;img-src *','https://cdn.test/\napp.js','https://*/','https://%2A/','https://host_name.test/app.js','https://[::1]/app.js']) assert.throws(()=>G.proposeRecipe(p,'js-cdn',{url}));
});
test('baseline assessment detects wildcard host expressions including explicit schemes and ports',()=>{
  const p=C.createProject('baseline');
  for(const source of ['https://*','https://*:443','https://*.cdn.test']){
    p.directives['script-src']=[source];
    assert.equal(G.assessBaseline(p).find(row=>row.id==='scripts').status,'review',source);
  }
});
test('repeated integration application is idempotent and separate proposals do not share arrays',()=>{
  const p=C.createProject('static'); const a=G.proposeRecipe(p,'youtube'); const b=G.proposeRecipe(a.project,'youtube');
  assert.equal(b.changes.length,0);
  a.project.directives['frame-src'].push('https://other.test');
  assert.ok(!b.project.directives['frame-src'].includes('https://other.test'));
});
test('baseline assessment separates report-only from enforced and checks explicit overrides',()=>{
  const p=C.createProject('baseline');
  const rows=G.assessBaseline(p);
  assert.equal(rows.find(r=>r.id==='delivery').status,'review');
  p.mode='enforce'; assert.equal(G.assessBaseline(p).find(r=>r.id==='delivery').status,'verify');
  p.directives['script-src-elem']=['https:',"'unsafe-inline'"];
  assert.equal(G.assessBaseline(p).find(r=>r.id==='scripts').status,'review');
});
test('baseline assessment finds gaps that default-src does not cover and never claims scanner success',()=>{
  const p=C.createProject('static'); delete p.directives['base-uri']; delete p.directives['frame-ancestors'];
  const rows=G.assessBaseline(p);
  assert.equal(rows.find(r=>r.id==='base').status,'missing');
  assert.equal(rows.find(r=>r.id==='ancestors').status,'missing');
  assert.ok(!rows.some(r=>r.status==='pass'));
});
test('copying default-src fallback excludes executable-only tokens for non-script integrations',()=>{
  const p=C.createProject('static'); p.directives={'default-src':["'self'","'nonce-YWJjZA=='","'strict-dynamic'"]};
  for(const [id,options,target]of [['youtube',{},'frame-src'],['google-fonts',{},'font-src'],['image-preview',{},'img-src'],['api',{url:'https://api.test'},'connect-src'],['css-cdn',{url:'https://cdn.test/app.css'},'style-src-elem']]){
    const result=G.proposeRecipe(p,id,options);
    assert.equal(C.validate(result.project).filter(i=>i.level==='error').length,0,id);
    assert.ok(!result.project.directives[target].includes("'strict-dynamic'"),id);
    if(target!=='style-src-elem') assert.ok(!result.project.directives[target].includes("'nonce-YWJjZA=='"),id);
  }
});
