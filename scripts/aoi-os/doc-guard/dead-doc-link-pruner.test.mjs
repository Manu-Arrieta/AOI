import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadMarkdownDocLinks } from './dead-doc-link-pruner.mjs'

test('auditDeadMarkdownDocLinks approves valid internal and web links', () => {
  const doc = `
# Documentation
See [Architecture](docs/architecture.md) and [GitHub](https://github.com/rtk-ai/icm).
`
  const validFiles = ['docs/architecture.md']
  const result = auditDeadMarkdownDocLinks(doc, validFiles)
  assert.equal(result.allValid, true)
  assert.equal(result.docProof, 'ALL_DOC_LINKS_REACHABLE')
  assert.equal(result.deadLinksCount, 0)
})

test('auditDeadMarkdownDocLinks detects broken relative file link', () => {
  const doc = `
# Documentation
See [Old Spec](docs/deprecated-spec.md) for details.
`
  const validFiles = ['docs/architecture.md']
  const result = auditDeadMarkdownDocLinks(doc, validFiles)
  assert.equal(result.allValid, false)
  assert.equal(result.docProof, 'BROKEN_DOC_LINKS_DETECTED')
  assert.equal(result.deadLinksCount, 1)
  assert.equal(result.deadLinks[0].target, 'docs/deprecated-spec.md')
})
