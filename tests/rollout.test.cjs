const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../scripts/core.js');

function testedProject() {
  const p = core.createProject('baseline');
  for (const record of Object.values(p.rollout.flows)) {
    Object.assign(record, { status: 'pass', testedRevision: 1 });
  }
  p.rollout.flows.video.status = 'fail';
  for (const key of Object.keys(p.rollout.checks)) p.rollout.checks[key] = true;
  return p;
}

function edit(project, mutate) {
  const next = core.clone(project);
  mutate(next);
  core.updateRollout(project, next);
  return next;
}

test('manual records and checks survive v2 JSON without entering deployment output', () => {
  const p = testedProject();
  assert.deepEqual(core.importProject(core.exportProject(p)), p);
  for (const format of ['header', 'raw', 'apache', 'nginx']) {
    assert.equal(core.exportConfig(p, format), core.exportConfig(core.createProject('baseline'), format));
  }
});

test('frame policy changes stale relevant records, retain their results and clear dependent steps', () => {
  const p = testedProject();
  const next = edit(p, draft => { draft.directives['frame-src'] = ["'self'"]; });
  assert.equal(next.rollout.revision, 2);
  for (const id of ['login', 'payment', 'maps', 'video', 'mobile']) assert.equal(next.rollout.flows[id].needsRetest, true);
  for (const id of ['search', 'forms', 'upload']) assert.equal(next.rollout.flows[id].needsRetest, false);
  assert.deepEqual(next.rollout.flows.video, { status: 'fail', testedRevision: 1, needsRetest: true });
  assert.deepEqual(next.rollout.checks, { backup: true, response: false, journeys: false, monitoring: true });
  assert.deepEqual(core.importProject(core.exportProject(next)), next);
  assert.equal(p.rollout.flows.maps.needsRetest, false);
});

test('fallback changes retest only effective rules covered by each workflow', () => {
  const p = testedProject();
  delete p.directives['frame-src'];
  const next = edit(p, draft => { draft.directives['child-src'] = ['https://embed.test']; });
  assert.equal(next.rollout.flows.maps.needsRetest, true);
  assert.equal(next.rollout.flows.login.needsRetest, true);
  assert.equal(next.rollout.flows.forms.needsRetest, false);
  p.directives['frame-src'] = ["'self'"];
  p.directives['worker-src'] = ["'self'"];
  const shadowed = edit(p, draft => { draft.directives['child-src'] = ['https://embed.test']; });
  assert.equal(shadowed.rollout.flows.maps.needsRetest, false);
});

test('presentation edits preserve revision, reporting changes require response verification only', () => {
  const p = testedProject();
  p.directives['img-src'] = ["'self'", 'blob:'];
  const renamed = edit(p, draft => { draft.name = '新版名稱'; draft.directives['img-src'].reverse(); });
  assert.deepEqual(renamed.rollout, p.rollout);
  const next = edit(p, draft => { draft.reportingEndpoint = 'https://example.test/report'; });
  assert.equal(next.rollout.revision, 2);
  assert.deepEqual(next.rollout.flows, p.rollout.flows);
  assert.deepEqual(next.rollout.checks, { ...p.rollout.checks, response: false });
});

test('site, mode and unknown directive changes stale every verified flow without checking pending flows', () => {
  const p = testedProject();
  p.rollout.flows.login = core.createProject().rollout.flows.login;
  for (const change of [
    draft => { draft.origin = 'https://other.test'; },
    draft => { draft.mode = 'enforce'; },
    draft => { draft.directives['future-rule'] = ['example']; }
  ]) {
    const next = edit(p, change);
    for (const [id, record] of Object.entries(next.rollout.flows)) assert.equal(record.needsRetest, id !== 'login');
    assert.equal(next.rollout.flows.login.status, 'pending');
  }
});

test('reject malformed and unsupported rollout records before replacing a draft', () => {
  for (const change of [
    p => { delete p.rollout; },
    p => { p.rollout.revision = 0; },
    p => { p.rollout.checks.backup = 'true'; },
    p => { p.rollout.flows.login.status = 'complete'; },
    p => { p.rollout.flows.login.testedRevision = 2; },
    p => { p.rollout.flows.login.needsRetest = true; },
    p => { p.rollout.flows.login = { status: 'pending', testedRevision: 1, needsRetest: false }; },
    p => { Object.defineProperty(p.rollout.flows, '__proto__', { enumerable: true, value: {} }); },
    p => { p.rollout.flows = []; },
    p => { p.version = 3; }
  ]) {
    const p = testedProject();
    change(p);
    assert.throws(() => core.importProject(JSON.stringify(p)));
  }
});
