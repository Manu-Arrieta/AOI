import test from 'node:test'
import assert from 'node:assert/strict'
import { steerDagWithUserStoryFeedback } from './user-story-steering-bridge.mjs'

test('steerDagWithUserStoryFeedback injects global and task-specific human steering directives', () => {
  const tasks = [
    { id: 'T-1', title: 'Create Auth API' },
    { id: 'T-2', title: 'Build UI Component' },
  ]
  const feedback = {
    globalNotes: ['Ensure 100% adherence to dark mode'],
    taskDirectives: {
      'T-1': ['Use Argon2id instead of bcrypt'],
    },
  }

  const result = steerDagWithUserStoryFeedback(tasks, feedback)
  assert.equal(result.steered, true)
  assert.equal(result.steeringProof, 'HUMAN_STORY_STEERING_INJECTED')
  assert.equal(result.totalSteeredCount, 2)
  assert.deepEqual(result.steeredTasks[0].humanSteeringDirectives, [
    'Ensure 100% adherence to dark mode',
    'Use Argon2id instead of bcrypt',
  ])
  assert.deepEqual(result.steeredTasks[1].humanSteeringDirectives, [
    'Ensure 100% adherence to dark mode',
  ])
})

test('steerDagWithUserStoryFeedback handles empty steering feedback cleanly', () => {
  const tasks = [{ id: 'T-1', title: 'Task 1' }]
  const result = steerDagWithUserStoryFeedback(tasks, {})
  assert.equal(result.steered, false)
  assert.equal(result.steeringProof, 'NO_STEERING_DIRECTIVES_PRESENT')
  assert.equal(result.totalSteeredCount, 0)
})
