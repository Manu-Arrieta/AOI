/**
 * Shared SDD phase registry.
 *
 * Kept dependency-neutral so both the assembler (which produces literal
 * context) and the budget (which measures it) can depend on the same ordered
 * registry without importing each other.
 */
export const SDD_PHASES = [
  ['Phase_-2_Genesis', '.github/prompts/sdd-genesis.prompt.md'],
  ['Phase_0_Frame', '.github/prompts/sdd-frame.prompt.md'],
  ['Phase_1_New', '.github/prompts/sdd-new.prompt.md'],
  ['Phase_2_FF', '.github/prompts/sdd-ff.prompt.md'],
  ['Phase_3_Apply', '.github/prompts/sdd-apply.prompt.md'],
  ['Phase_4_Verify', '.github/prompts/sdd-verify.prompt.md'],
  ['Phase_5_Archive', '.github/prompts/sdd-archive.prompt.md'],
]
