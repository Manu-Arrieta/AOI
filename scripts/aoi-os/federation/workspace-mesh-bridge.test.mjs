import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorkspaceMeshNode, computeMeshDigest } from './workspace-mesh-bridge.mjs'

test('createWorkspaceMeshNode registers peers and verifies cryptographic bundle integrity', () => {
  const mesh = createWorkspaceMeshNode({
    workspaceId: 'AOI-Main',
    peers: ['MoviHub-Backend'],
  })

  const payload = { contracts: ['ITaskService', 'IAuthService'], status: 'active' }
  const validDigest = computeMeshDigest(payload)

  // 1. Stage valid peer bundle
  const resultValid = mesh.stagePeerBundle({
    sourceWorkspace: 'MoviHub-Backend',
    version: '2026.08.15-01',
    payload,
    digest: validDigest,
  })

  assert.equal(resultValid.accepted, true)
  assert.equal(mesh.getVerifiedBundles().length, 1)

  // 2. Reject tampered digest
  const resultTampered = mesh.stagePeerBundle({
    sourceWorkspace: 'MoviHub-Backend',
    version: '2026.08.15-02',
    payload,
    digest: 'deadbeef1234567890abcdef',
  })

  assert.equal(resultTampered.accepted, false)
  assert.ok(resultTampered.reason.includes('Cryptographic digest mismatch'))

  // 3. Reject unregistered peer
  const resultUnknown = mesh.stagePeerBundle({
    sourceWorkspace: 'Unknown-Repo',
    version: '2026.08.15-01',
    payload,
    digest: validDigest,
  })

  assert.equal(resultUnknown.accepted, false)
  assert.ok(resultUnknown.reason.includes('Unregistered peer'))
})
