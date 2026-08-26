import test from 'node:test'
import assert from 'node:assert/strict'
import {
  arrangeContext,
  stratifyByDomain,
  formatArrangedContext,
} from './context-arranger.mjs'

test('arrangeContext balances 50:50 signal and background items by default', () => {
  const signals = [
    { id: 'SIG-1', content: 'Critical auth bug' },
    { id: 'SIG-2', content: 'Payment timeout blocker' },
    { id: 'SIG-3', content: 'Database migration fail' },
    { id: 'SIG-4', content: 'Memory leak' },
    { id: 'SIG-5', content: 'API crash' },
  ]
  const backgrounds = [
    { id: 'BG-1', content: 'Updated button styling' },
    { id: 'BG-2', content: 'Bumped linter dependency' },
    { id: 'BG-3', content: 'Fixed typo in readme' },
    { id: 'BG-4', content: 'Added comment' },
    { id: 'BG-5', content: 'Reformatted json' },
  ]

  const arranged = arrangeContext({
    signalItems: signals,
    backgroundItems: backgrounds,
    targetRatio: 0.5,
    position: 'end',
    maxItems: 10,
  })

  assert.equal(arranged.length, 10)
  // Background items come first when position is 'end'
  assert.equal(arranged[0].id, 'BG-1')
  assert.equal(arranged[9].id, 'SIG-5')
})

test('arrangeContext supports start and scattered positions', () => {
  const signals = [{ id: 'S1' }, { id: 'S2' }]
  const backgrounds = [{ id: 'B1' }, { id: 'B2' }]

  const startArranged = arrangeContext({
    signalItems: signals,
    backgroundItems: backgrounds,
    position: 'start',
    maxItems: 4,
  })
  assert.equal(startArranged[0].id, 'S1')

  const scatteredArranged = arrangeContext({
    signalItems: signals,
    backgroundItems: backgrounds,
    position: 'scattered',
    maxItems: 4,
  })
  assert.equal(scatteredArranged[0].id, 'S1')
  assert.equal(scatteredArranged[1].id, 'B1')
  assert.equal(scatteredArranged[2].id, 'S2')
  assert.equal(scatteredArranged[3].id, 'B2')
})

test('stratifyByDomain groups items by domain or type', () => {
  const items = [
    { id: '1', domain: 'contract', content: 'interface' },
    { id: '2', domain: 'contract', content: 'type' },
    { id: '3', domain: 'tasks', content: 'task 1' },
  ]

  const stratified = stratifyByDomain(items)
  assert.equal(stratified.contract.length, 2)
  assert.equal(stratified.tasks.length, 1)
})

test('formatArrangedContext renders structured prompt block', () => {
  const items = [
    { id: 'T-1', title: 'Task 1', content: 'Do work' },
  ]
  const formatted = formatArrangedContext(items)
  assert.ok(formatted.includes('<!-- CALIBRATED_CONTEXT_START -->'))
  assert.ok(formatted.includes('### [T-1] - Task 1'))
  assert.ok(formatted.includes('Do work'))
  assert.ok(formatted.includes('<!-- CALIBRATED_CONTEXT_END -->'))
})
