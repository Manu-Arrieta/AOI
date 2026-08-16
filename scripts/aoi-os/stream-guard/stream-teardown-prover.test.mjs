import test from 'node:test'
import assert from 'node:assert/strict'
import { proveStreamTeardownSafety } from './stream-teardown-prover.mjs'

test('proveStreamTeardownSafety approves streaming endpoints with abort handlers and interval cleanup', () => {
  const code = `
export default defineEventHandler((event) => {
  const eventStream = createEventStream(event);
  const timer = setInterval(() => eventStream.push('ping'), 1000);
  event.node.req.on('close', () => {
    clearInterval(timer);
    eventStream.close();
  });
  return eventStream.send();
});
`
  const result = proveStreamTeardownSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.streamProof, 'STREAM_TEARDOWN_AND_INTERVALS_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('proveStreamTeardownSafety detects streaming endpoints missing close handler or interval cleanup', () => {
  const code = `
export default defineEventHandler((event) => {
  const eventStream = createEventStream(event);
  const timer = setInterval(() => eventStream.push('ping'), 1000);
  return eventStream.send();
});
`
  const result = proveStreamTeardownSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.streamProof, 'DANGLING_STREAM_OR_INTERVAL_DETECTED')
  assert.equal(result.violationsCount, 2)
})
