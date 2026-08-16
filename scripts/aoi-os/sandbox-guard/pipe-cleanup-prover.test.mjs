import test from 'node:test'
import assert from 'node:assert/strict'
import { provePipeCleanupSafety } from './pipe-cleanup-prover.mjs'

test('provePipeCleanupSafety approves clean code unlinking domain sockets', () => {
  const code = `
const socketPath = '/tmp/sandbox.sock';
const server = net.createServer();
process.on('exit', () => {
  fs.unlinkSync(socketPath);
});
`
  const result = provePipeCleanupSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.pipeProof, 'ALL_IPC_PIPES_AND_SOCKETS_CLEANED')
  assert.equal(result.violationsCount, 0)
})

test('provePipeCleanupSafety detects domain socket creation without cleanup unlink', () => {
  const code = `
const socketPath = '/tmp/sandbox.sock';
const server = net.createServer().listen(socketPath);
`
  const result = provePipeCleanupSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.pipeProof, 'DANGLING_PIPE_OR_SOCKET_DETECTED')
  assert.equal(result.violationsCount, 1)
})
