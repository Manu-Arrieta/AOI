import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectLanguage,
  extractExportedSignatures,
  validateContractDiff,
  classifyBlastRadius,
} from './ast-contract-guard.mjs'

test('detectLanguage correctly categorizes file extensions', () => {
  assert.equal(detectLanguage('app/component.vue'), 'vue')
  assert.equal(detectLanguage('services/api.py'), 'python')
  assert.equal(detectLanguage('Controllers/UserController.cs'), 'csharp')
  assert.equal(detectLanguage('server/routes.ts'), 'typescript')
  assert.equal(detectLanguage('config.json'), 'generic')
})

test('extractExportedSignatures extracts TypeScript symbols', () => {
  const tsCode = `
export function fetchUsers(query: string): User[] { return [] }
export const API_VERSION = 'v2'
export interface User { id: string }
export type UserId = string
`
  const signatures = extractExportedSignatures(tsCode, 'types.ts')
  assert.ok(signatures.has('fetchUsers'))
  assert.ok(signatures.has('API_VERSION'))
  assert.ok(signatures.has('User'))
  assert.ok(signatures.has('UserId'))
})

test('extractExportedSignatures extracts Vue SFC macros and composables', () => {
  const vueCode = `
<script setup lang="ts">
const props = defineProps<{ title: string }>()
const emit = defineEmits(['close'])
export function formatTitle(t: string) { return t.toUpperCase() }
</script>
`
  const signatures = extractExportedSignatures(vueCode, 'MyComponent.vue')
  assert.ok(signatures.has('defineProps'))
  assert.ok(signatures.has('defineEmits'))
  assert.ok(signatures.has('formatTitle'))
})

test('extractExportedSignatures extracts Python functions and classes', () => {
  const pyCode = `
def calculate_score(data: dict) -> float:
    return 100.0

class ScoreManager:
    pass

def _internal_helper():
    pass
`
  const signatures = extractExportedSignatures(pyCode, 'scorer.py')
  assert.ok(signatures.has('calculate_score'))
  assert.ok(signatures.has('ScoreManager'))
  assert.ok(!signatures.has('_internal_helper'))
})

test('extractExportedSignatures extracts C# classes, interfaces, methods, and properties', () => {
  const csCode = `
namespace MyApp.Services
{
    public interface IUserService
    {
        Task<UserDto> GetUserAsync(Guid id);
    }

    public class UserService : IUserService
    {
        public string ConnectionString { get; set; }

        public async Task<UserDto> GetUserAsync(Guid id)
        {
            return await Task.FromResult(new UserDto());
        }
    }
}
`
  const signatures = extractExportedSignatures(csCode, 'UserService.cs')
  assert.ok(signatures.has('IUserService'))
  assert.ok(signatures.has('UserService'))
  assert.ok(signatures.has('ConnectionString'))
  assert.ok(signatures.has('GetUserAsync'))
})

test('validateContractDiff detects breaking changes in C# contracts', () => {
  const originalCs = `
public interface IAuthService
{
    Task<bool> LoginAsync(string email, string password);
    Task LogoutAsync();
}
`
  const proposedCs = `
public interface IAuthService
{
    Task<bool> LoginAsync(string email, string password);
    // LogoutAsync was accidentally deleted!
}
`
  const diff = validateContractDiff(originalCs, proposedCs, 'IAuthService.cs')
  assert.equal(diff.safe, false)
  assert.equal(diff.removedSymbols.length, 1)
  assert.equal(diff.removedSymbols[0], 'LogoutAsync')
})

test('classifyBlastRadius rates impact accurately', () => {
  assert.equal(classifyBlastRadius(0), 'low')
  assert.equal(classifyBlastRadius(2), 'medium')
  assert.equal(classifyBlastRadius(5), 'high')
})
