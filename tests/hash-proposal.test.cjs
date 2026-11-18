const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../scripts/core.js');

const digest = "'sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='";

test('hash preview preserves the nearest list and leaves its fallback untouched', () => {
  const directives = { 'default-src': ["'self'"], 'style-src': ['https://styles.test'] };
  const preview = C.proposeHash(directives, 'style-src-elem', digest);
  assert.equal(preview.before.name, 'style-src');
  assert.deepEqual(preview.before.values, ['https://styles.test']);
  assert.deepEqual(preview.after, ['https://styles.test', digest]);
  assert.deepEqual(directives, { 'default-src': ["'self'"], 'style-src': ['https://styles.test'] });
  assert.deepEqual(C.proposeHash(directives, 'style-src-elem', digest, 'only').after, [digest]);
});

test('empty, none and unrestricted lists yield a hash-only rule without inventing a fallback', () => {
  for (const values of [[], ["'none'"], null]) {
    const directives = values ? { 'default-src': values } : {};
    const preview = C.proposeHash(directives, 'script-src', digest);
    assert.deepEqual(preview.after, [digest]);
    assert.equal(preview.before.name, values ? 'default-src' : null);
    assert.deepEqual(preview.before.values, values);
  }
});

test('duplicate hash cannot create a redundant rule and an element override blocks ineffective edits', () => {
  assert.equal(C.proposeHash({ 'default-src': [digest] }, 'script-src-elem', digest).canApply, false);
  const directives = { 'style-src': ["'self'"], 'style-src-elem': [] };
  const preview = C.proposeHash(directives, 'style-src', digest);
  assert.equal(preview.canApply, false);
  assert.ok(preview.notes.some(note => note.includes('style-src-elem')));
  assert.equal(C.proposeHash(directives, 'style-src-elem', digest).canApply, true);
});

test('preview explains keyword interactions for the proposed list', () => {
  const directives = { 'default-src': ["'unsafe-inline'", "'strict-dynamic'", "'self'"] };
  const script = C.proposeHash(directives, 'script-src-elem', digest);
  assert.ok(script.notes.some(note => note.includes('unsafe-inline')));
  assert.ok(script.notes.some(note => note.includes('strict-dynamic')));
  const style = C.proposeHash(directives, 'style-src-elem', digest);
  assert.ok(style.notes.some(note => note.includes('unsafe-inline')));
  assert.ok(!style.notes.some(note => note.includes('載入其他腳本')));
  assert.deepEqual(style.after, ["'unsafe-inline'", "'self'", digest]);
  const project = { ...C.createProject(), directives: { ...directives, 'style-src-elem': style.after } };
  assert.deepEqual(C.validate(project).filter(issue => issue.level === 'error'), []);
});
