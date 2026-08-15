import test from 'node:test'
import assert from 'node:assert/strict'
import { skeletonizeSource } from './ast-skeletonizer.mjs'

test('skeletonizeSource preserves small files without pruning', () => {
  const smallCode = `
import { User } from './types'
export function getUser() { return {} }
`
  const result = skeletonizeSource(smallCode, 'user.ts', {
    targetSymbols: ['getUser'],
    minLinesToSkeletonize: 80,
  })

  assert.equal(result.skeletonizedCode, smallCode)
  assert.equal(result.savingsPercent, 0)
})

test('skeletonizeSource skeletonizes non-target functions in TypeScript', () => {
  const filler = Array.from({ length: 90 }, (_, i) => `  const x${i} = ${i};`).join('\n')
  const largeTsCode = `
import { UserDto } from './types'

export function helperFunction(a: number): number {
${filler}
  return a * 2;
}

export function targetFunction(id: string): UserDto {
  const user = { id, name: 'Alice' };
  return user;
}
`
  const result = skeletonizeSource(largeTsCode, 'service.ts', {
    targetSymbols: ['targetFunction'],
    minLinesToSkeletonize: 50,
  })

  assert.ok(result.skeletonizedCode.includes('import { UserDto } from \'./types\''))
  assert.ok(result.skeletonizedCode.includes('export function helperFunction(a: number): number { /* ... */ }'))
  assert.ok(result.skeletonizedCode.includes('export function targetFunction(id: string): UserDto {'))
  assert.ok(result.skeletonizedCode.includes('const user = { id, name: \'Alice\' };'))
  assert.ok(result.savingsPercent > 50)
})

test('skeletonizeSource skeletonizes non-target methods in C#', () => {
  const filler = Array.from({ length: 90 }, (_, i) => `        int x${i} = ${i};`).join('\n')
  const largeCsCode = `
using System;
using System.Threading.Tasks;

public class OrderService
{
    public async Task<bool> ValidateOrderAsync(Guid orderId)
    {
${filler}
        return true;
    }

    public async Task<OrderDto> CreateOrderAsync(CreateOrderDto dto)
    {
        var order = new OrderDto { Id = Guid.NewGuid() };
        return order;
    }
}
`
  const result = skeletonizeSource(largeCsCode, 'OrderService.cs', {
    targetSymbols: ['CreateOrderAsync'],
    minLinesToSkeletonize: 50,
  })

  assert.ok(result.skeletonizedCode.includes('using System;'))
  assert.ok(result.skeletonizedCode.includes('public async Task<bool> ValidateOrderAsync(Guid orderId) { /* ... */ }'))
  assert.ok(result.skeletonizedCode.includes('public async Task<OrderDto> CreateOrderAsync(CreateOrderDto dto)'))
  assert.ok(result.skeletonizedCode.includes('var order = new OrderDto { Id = Guid.NewGuid() };'))
  assert.ok(result.savingsPercent > 50)
})
