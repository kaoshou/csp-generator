const { test } = require('node:test');
const assert = require('node:assert/strict');
let c;
try { c = require('../scripts/core.js'); } catch { c = {}; }

test('imported header regenerates the actual policy including unknown and empty directives', () => {
  const result = c.parsePolicy("Content-Security-Policy-Report-Only: default-src 'self'; sandbox; upgrade-insecure-requests; x-future alpha;");
  assert.equal(result.mode, 'report-only');
  assert.equal(c.serializePolicy(result.directives), "default-src 'self'; sandbox; upgrade-insecure-requests; x-future alpha;");
});
test('duplicate directives keep the first as browsers do and warn', () => {
  const result = c.parsePolicy("IMG-SRC 'self'; img-src https:;");
  assert.deepEqual(result.directives, { 'img-src': ["'self'"] });
  assert.ok(result.warnings.some(x => x.includes('重複')));
});
test('empty fetch directives survive round trips and are not omitted', () => {
  assert.equal(c.serializePolicy(c.parsePolicy('img-src; sandbox;').directives), 'img-src; sandbox;');
});
test('multiple policies are rejected instead of being flattened or loosened', () => {
  for (const input of ["default-src 'self', script-src 'none'", "Content-Security-Policy: img-src 'self'\nContent-Security-Policy: script-src 'self'"]) {
    assert.throws(() => c.parsePolicy(input), /多|單一/);
  }
});
test('multiline values work but controls and malformed directive names do not', () => {
  assert.equal(c.serializePolicy(c.parsePolicy("default-src 'self';\n img-src https:;").directives), "default-src 'self'; img-src https:;");
  assert.throws(() => c.parsePolicy('img-src https://a.test\u0000'), /控制/);
  assert.throws(() => c.parsePolicy('<img src=x>'), /指令/);
});
test('JSON project round trip preserves mode origin reporting and unknown directives', () => {
  const p = { version: 1, name: '測試', origin: 'https://app.example', mode: 'report-only', reportingEndpoint: 'https://reports.example/csp', directives: { sandbox: [], 'x-future': ['alpha'] } };
  assert.deepEqual(c.importProject(c.exportProject(p)), p);
});
test('malformed and prototype-bearing project data are rejected', () => {
  for (const raw of ['{"version":2}', '{"version":1,"directives":[]}', '{"version":1,"directives":{"__proto__":[]}}', '{"version":1,"directives":{"img-src":"https:"}}']) {
    assert.throws(() => c.importProject(raw));
  }
});
test('none mixed with sources and unquoted keywords are actionable errors', () => {
  const p = c.createProject('static');
  p.directives['img-src'] = ["'none'", 'https:'];
  p.directives['script-src'] = ['self'];
  const errors = c.validate(p).filter(x => x.level === 'error');
  assert.ok(errors.some(x => x.directive === 'img-src'));
  assert.ok(errors.some(x => x.directive === 'script-src'));
  assert.throws(() => c.exportConfig(p, 'header'));
});
test('meta does not silently drop unsupported directives or pretend to support report-only', () => {
  const p = c.createProject('static');
  assert.throws(() => c.exportConfig(p, 'meta'), /meta|Meta/);
  p.mode = 'enforce';
  assert.throws(() => c.exportConfig(p, 'meta'), /frame-ancestors/);
  delete p.directives['frame-ancestors'];
  assert.match(c.exportConfig(p, 'meta'), /http-equiv="Content-Security-Policy"/);
});
test('nginx rejects literal dollar variables that cannot be safely represented in a static snippet', () => {
  const p = c.createProject('static');
  p.directives['img-src'] = ['https://example.com/$asset'];
  assert.throws(() => c.exportConfig(p, 'nginx'), /\$|變數/);
  assert.match(c.exportConfig(p, 'apache'), /Header always set Content-Security-Policy-Report-Only/);
});
test('Apache escapes percent format specifiers in both policy and reporting endpoint', () => {
  const p = c.createProject('static');
  p.directives['img-src'] = ['https://a.test/hello%20world.png'];
  p.directives['report-to'] = ['csp'];
  p.reportingEndpoint = 'https://reports.test/a%20b';
  const output = c.exportConfig(p, 'apache');
  assert.ok(output.includes('hello%%20world.png'));
  assert.ok(output.includes('a%%20b'));
  assert.ok(c.exportConfig(p, 'raw').includes('hello%20world.png'));
});
test('scenario projects do not share mutable source arrays', () => {
  const a = c.createProject('static');
  a.directives['img-src'].push('https://images.example');
  assert.deepEqual(c.createProject('static').directives['img-src'], ["'self'"]);
  assert.deepEqual(c.createProject('app').directives['img-src'], ["'self'"]);
});
test('worker and element fallbacks follow CSP order without merging', () => {
  const d = { 'default-src': ["'none'"], 'script-src': ["'self'"], 'child-src': ['blob:'] };
  assert.equal(c.effectiveDirective(d, 'worker-src').name, 'child-src');
  assert.equal(c.effectiveDirective(d, 'script-src-elem').name, 'script-src');
  d['worker-src'] = [];
  assert.deepEqual(c.effectiveDirective(d, 'worker-src').values, []);
  assert.equal(c.effectiveDirective(d, 'frame-ancestors').name, null);
  assert.equal(c.effectiveDirective(d, 'form-action').name, null);
});
test('simulation distinguishes same origin from same host with a different port', () => {
  const p = c.createProject('static');
  assert.equal(c.simulate(p, { type: 'img-src', url: 'https://example.com/a.png' }).status, 'allowed');
  const result = c.simulate(p, { type: 'img-src', url: 'https://example.com:8443/a.png' });
  assert.equal(result.status, 'blocked');
  assert.equal(result.enforced, false);
  p.mode = 'enforce';
  assert.equal(c.simulate(p, { type: 'img-src', url: 'https://example.com:8443/a.png' }).enforced, true);
});
test('wildcard subdomains exclude apex and deceptive suffixes, and paths honor boundaries', () => {
  const p = c.createProject('static');
  p.directives['img-src'] = ['https://*.assets.test/images/'];
  for (const url of ['https://a.assets.test/images/a.png', 'https://a.b.assets.test/images/a.png']) assert.equal(c.simulate(p, { type: 'img-src', url }).status, 'allowed');
  for (const url of ['https://assets.test/images/a.png', 'https://evilassets.test/images/a.png', 'https://a.assets.test/images-other/a.png', 'https://a.assets.test:8443/images/a.png']) assert.equal(c.simulate(p, { type: 'img-src', url }).status, 'blocked');
});
test('inline self is blocked while a matching nonce authorizes an element', () => {
  const p = c.createProject('static');
  assert.equal(c.simulate(p, { type: 'script-src-elem', kind: 'inline' }).status, 'blocked');
  p.directives['script-src'] = ["'nonce-YWJjZGVmZ2g='", "'unsafe-inline'"];
  assert.equal(c.simulate(p, { type: 'script-src-elem', kind: 'inline', nonce: 'YWJjZGVmZ2g=' }).status, 'allowed');
  assert.equal(c.simulate(p, { type: 'script-src-elem', kind: 'inline' }).status, 'blocked');
  assert.equal(c.simulate(p, { type: 'script-src-attr', kind: 'inline', nonce: 'YWJjZGVmZ2g=' }).status, 'blocked');
});
test('strict-dynamic ignores host allowlists and marks unverified dynamic trust as uncertain', () => {
  const p = c.createProject('static');
  p.directives['script-src'] = ["'nonce-YWJjZA=='", "'strict-dynamic'", 'https:'];
  assert.equal(c.simulate(p, { type: 'script-src-elem', url: 'https://cdn.test/a.js' }).status, 'blocked');
  assert.equal(c.simulate(p, { type: 'script-src-elem', url: 'https://cdn.test/a.js', dynamic: true }).status, 'unknown');
});
test('unsupported cases and invalid policies cannot claim simulation success', () => {
  const p = c.createProject('static');
  p.directives['img-src'] = ['self'];
  assert.equal(c.simulate(p, { type: 'img-src', url: 'https://example.com/a.png' }).status, 'unknown');
  assert.equal(c.simulate(c.createProject('static'), { type: 'img-src', url: 'blob:https://example.com/id' }).status, 'unknown');
});
test('sha256 uses exact UTF-8 contents including whitespace', async () => {
  assert.equal(await c.hashSource('hello'), "'sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='");
  assert.notEqual(await c.hashSource('hello '), await c.hashSource('hello'));
});
test('exported HTTP headers with Reporting-Endpoints can be pasted back without loss', () => {
  const p = c.createProject('static');
  p.directives['report-to'] = ['csp'];
  p.reportingEndpoint = 'https://reports.test/csp';
  const parsed = c.parsePolicy(c.exportConfig(p, 'header'));
  assert.deepEqual(parsed.directives, p.directives);
  assert.equal(parsed.reportingEndpoint, 'https://reports.test/csp');
  assert.equal(parsed.mode, 'report-only');
});
test('unrelated HTTP headers are not accidentally parsed as CSP source tokens', () => {
  assert.throws(() => c.parsePolicy("Content-Security-Policy: default-src 'self'\nX-Test: hello"), /標頭|單一/);
});
test('invalid keyword contexts cannot masquerade as usable protection', () => {
  const p = c.createProject('static');
  p.directives['frame-ancestors'] = ["'unsafe-inline'"];
  p.directives['img-src'] = ["'nonce-YWJjZA=='"];
  const issues = c.validate(p);
  assert.ok(issues.some(i => i.directive === 'frame-ancestors' && i.level === 'error'));
  assert.ok(issues.some(i => i.directive === 'img-src' && i.level === 'error'));
});
test('hash and nonce comparisons do not authorize arbitrary resource types', () => {
  const p = c.createProject('static');
  assert.equal(c.simulate(p, { type: 'img-src', kind: 'inline', hash: "'self'" }).status, 'unknown');
});
test('a supplied hash must be a genuine hash-source rather than any matching keyword', () => {
  const p = c.createProject('static');
  assert.equal(c.simulate(p, { type: 'script-src-elem', kind: 'inline', hash: "'self'" }).status, 'blocked');
});
test('strict-dynamic with matching external hash requires SRI verification', () => {
  const p = c.createProject('static');
  const hash = "'sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='";
  p.directives['script-src'] = [hash, "'strict-dynamic'"];
  assert.equal(c.simulate(p, { type: 'script-src-elem', url: 'https://a.test/a.js', hash }).status, 'unknown');
});
test('sandbox is considered even when no source directive applies', () => {
  const p = c.createProject('static');
  p.mode = 'enforce';
  p.directives = { sandbox: [] };
  assert.equal(c.simulate(p, { type: 'script-src-elem', url: 'https://a.test/a.js' }).status, 'unknown');
});
test('self matches secure upgrades only on matching hosts and equal or default ports', () => {
  const p = c.createProject('static');
  p.origin = 'http://example.com';
  assert.equal(c.simulate(p, {type:'img-src',url:'https://example.com/a.png'}).status, 'allowed');
  assert.equal(c.simulate(p, {type:'img-src',url:'https://example.com:8443/a.png'}).status, 'blocked');
  p.origin = 'http://example.com:8443';
  assert.equal(c.simulate(p, {type:'img-src',url:'https://example.com:8443/a.png'}).status, 'allowed');
  assert.equal(c.simulate(p, {type:'img-src',url:'https://example.com/a.png'}).status, 'blocked');
});
test('directory source paths require the slash boundary in the target', () => {
  const p = c.createProject('static'); p.directives['img-src'] = ['https://a.test/images/'];
  assert.equal(c.simulate(p,{type:'img-src',url:'https://a.test/images'}).status, 'blocked');
});
test('strict-dynamic suppresses unsafe-inline on event attributes using script-src fallback', () => {
  const p = c.createProject('static'); p.directives['script-src'] = ["'strict-dynamic'", "'unsafe-inline'"];
  assert.equal(c.simulate(p,{type:'script-src-attr',kind:'inline'}).status, 'blocked');
});
