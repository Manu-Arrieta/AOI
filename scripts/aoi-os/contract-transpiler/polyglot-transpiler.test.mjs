import test from 'node:test'
import assert from 'node:assert/strict'
import {
  transpileToCSharp,
  transpileToPython,
  transpileToSql,
} from './polyglot-transpiler.mjs'

const SAMPLE_INTERFACE = `
export interface UserAccount {
  userId: string;
  userAge: number;
  isActive: boolean;
}
`

test('transpileToCSharp converts TypeScript interface to clean C# DTO class', () => {
  const cs = transpileToCSharp(SAMPLE_INTERFACE)
  assert.ok(cs.includes('public class UserAccountDto'))
  assert.ok(cs.includes('public string UserId { get; set; }'))
  assert.ok(cs.includes('public int UserAge { get; set; }'))
  assert.ok(cs.includes('public bool IsActive { get; set; }'))
})

test('transpileToPython converts TypeScript interface to Python Pydantic BaseModel', () => {
  const py = transpileToPython(SAMPLE_INTERFACE)
  assert.ok(py.includes('class UserAccount(BaseModel):'))
  assert.ok(py.includes('user_id: str'))
  assert.ok(py.includes('user_age: int'))
  assert.ok(py.includes('is_active: bool'))
})

test('transpileToSql converts TypeScript interface to SQL CREATE TABLE DDL', () => {
  const sql = transpileToSql(SAMPLE_INTERFACE)
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS user_account ('))
  assert.ok(sql.includes('user_id VARCHAR(255) PRIMARY KEY'))
  assert.ok(sql.includes('user_age INTEGER'))
  assert.ok(sql.includes('is_active BOOLEAN'))
})
