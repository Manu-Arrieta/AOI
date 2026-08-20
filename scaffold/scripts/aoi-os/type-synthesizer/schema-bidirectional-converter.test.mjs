import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractInterfaceFields,
  generateZodSchemaFromFields,
  verifyTypeSchemaBidirectionalAlignment,
} from './schema-bidirectional-converter.mjs'

test('extractInterfaceFields parses interface fields with optional markers', () => {
  const ts = `
interface TaskDto {
  id: string;
  title: string;
  points?: number;
  completed: boolean;
}
`
  const fields = extractInterfaceFields(ts)
  assert.equal(fields.length, 4)
  assert.equal(fields[0].name, 'id')
  assert.equal(fields[0].type, 'string')
  assert.equal(fields[0].isOptional, false)
  assert.equal(fields[2].name, 'points')
  assert.equal(fields[2].isOptional, true)
})

test('generateZodSchemaFromFields builds aligned Zod schema code', () => {
  const fields = [
    { name: 'id', type: 'string', isOptional: false },
    { name: 'age', type: 'number', isOptional: true },
  ]
  const zod = generateZodSchemaFromFields('UserSchema', fields)
  assert.ok(zod.includes('id: z.string()'))
  assert.ok(zod.includes('age: z.number().optional()'))
})

test('verifyTypeSchemaBidirectionalAlignment approves matching schemas and detects missing fields', () => {
  const ts = `
interface Product {
  id: string;
  price: number;
  tags: string[];
}
`
  const matchingZod = `
export const ProductSchema = z.object({
  id: z.string(),
  price: z.number(),
  tags: z.array(z.string()),
});
`
  const resValid = verifyTypeSchemaBidirectionalAlignment(ts, matchingZod)
  assert.equal(resValid.aligned, true)
  assert.equal(resValid.alignmentProof, 'BIDIRECTIONAL_TYPE_SCHEMA_ALIGNMENT_VERIFIED')

  const incompleteZod = `
export const ProductSchema = z.object({
  id: z.string(),
});
`
  const resInvalid = verifyTypeSchemaBidirectionalAlignment(ts, incompleteZod)
  assert.equal(resInvalid.aligned, false)
  assert.equal(resInvalid.alignmentProof, 'TYPE_SCHEMA_FIELD_DRIFT_DETECTED')
  assert.ok(resInvalid.missingInZod.includes('price'))
  assert.ok(resInvalid.missingInZod.includes('tags'))
})
