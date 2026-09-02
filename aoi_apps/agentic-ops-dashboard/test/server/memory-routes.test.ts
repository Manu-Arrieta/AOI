import { describe, expect, it, vi } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: <T>(handler: T) => handler,
  getQuery: () => ({}),
}))

import { parseFactsOutput } from '../../server/api/memory/facts.get'
import { parseMemoirConcepts, parseMemoirJson } from '../../server/api/memory/memoirs.get'

describe('Memory Route Parsers', () => {
  it('parseFactsOutput correctly parses CLI key-value output', () => {
    const sampleOutput = `
      AOI.service.auth = port:3000
      AOI.endpoint.login = /api/v1/login
      general.status = active
    `
    const facts = parseFactsOutput(sampleOutput, 'AOI')
    expect(facts.length).toBe(3)
    expect(facts[0].entity).toBe('AOI')
    expect(facts[0].key).toBe('service.auth')
    expect(facts[0].value).toBe('port:3000')
    expect(facts[0].namespace).toBe('service')

    expect(facts[1].key).toBe('endpoint.login')
    expect(facts[1].namespace).toBe('endpoint')
  })

  it('parseFactsOutput correctly parses icm facts list tabular output', () => {
    const tableOutput = `key                              value
------------------------------------------------------------
icm.protocol                     v4
stack.packageManager             pnpm
stack.runtime                    Node >=20.19.0`

    const facts = parseFactsOutput(tableOutput, 'AOI')
    expect(facts.length).toBe(3)
    expect(facts[0].key).toBe('icm.protocol')
    expect(facts[0].value).toBe('v4')
    expect(facts[0].namespace).toBe('icm')

    expect(facts[1].key).toBe('stack.packageManager')
    expect(facts[1].value).toBe('pnpm')

    expect(facts[2].key).toBe('stack.runtime')
    expect(facts[2].value).toBe('Node >=20.19.0')
    expect(facts[2].namespace).toBe('stack')
  })

  it('parseMemoirJson parses JSON export concepts and links', () => {
    const rawJson = JSON.stringify({
      memoir: { name: 'AOI-architecture' },
      concepts: [
        {
          id: '01KV',
          name: 'BaseProjectMap',
          definition: 'Root topology',
          labels: ['type:artifact', 'feature:sandbox'],
        },
      ],
      links: [
        {
          source: 'BaseProjectMap',
          target: 'Sandbox',
          relation: 'depends_on',
        },
      ],
    })

    const result = parseMemoirJson(rawJson)
    expect(result.concepts.length).toBe(1)
    expect(result.concepts[0].name).toBe('BaseProjectMap')
    expect(result.concepts[0].category).toBe('Artifact')
    expect(result.concepts[0].dependencies).toEqual(['Sandbox'])
    expect(result.links.length).toBe(1)
  })

  it('parseMemoirConcepts parses markdown sections into concept objects', () => {
    const sampleOutput = `
      ### BaseProjectMap
      dependencies: frontend, backend
      tags: architecture, map
      Root topology of the workspace.

      ### SDD Lifecycle
      tags: process, lifecycle
      Spec driven development flow.
    `
    const concepts = parseMemoirConcepts(sampleOutput)
    expect(concepts.length).toBe(2)
    expect(concepts[0].name).toBe('BaseProjectMap')
    expect(concepts[0].dependencies).toEqual(['frontend', 'backend'])
    expect(concepts[0].tags).toEqual(['architecture', 'map'])

    expect(concepts[1].name).toBe('SDD Lifecycle')
    expect(concepts[1].tags).toEqual(['process', 'lifecycle'])
  })
})
