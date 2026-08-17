import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStreamChunkBoundarySafety } from './stream-chunk-boundary-guard.mjs'

test('auditStreamChunkBoundarySafety approves stream reading with StringDecoder', () => {
  const code = `
import { StringDecoder } from 'node:string_decoder';

function processStream(readStream) {
  const decoder = new StringDecoder('utf8');
  readStream.on('data', (chunk) => {
    const text = decoder.write(chunk);
    handleText(text);
  });
}
`
  const result = auditStreamChunkBoundarySafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.boundaryProof, 'SAFE_UTF8_STREAM_BOUNDARY_DECODING_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditStreamChunkBoundarySafety detects unguarded chunk.toString() on data event', () => {
  const code = `
function processStream(readStream) {
  readStream.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    handleText(text);
  });
}
`
  const result = auditStreamChunkBoundarySafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.boundaryProof, 'MULTIBYTE_CHUNK_FRAGMENTATION_RISK')
  assert.equal(result.violationsCount, 1)
})
