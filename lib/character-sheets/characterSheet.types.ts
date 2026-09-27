export const OPCODE_STAT_KEYS = ['ref', 'int', 'wil', 'chr', 'bod', 'luk'] as const
export type OpcodeStatKey = typeof OPCODE_STAT_KEYS[number]
export const OPCODE_DEFAULT_STAT = 5

export const OPCODE_HEALTH_PARTS = [
  'head',
  'torso',
  'hand_primary',
  'hand_secondary',
  'leg_left',
  'leg_right',
] as const
export type OpcodeHealthPart = typeof OPCODE_HEALTH_PARTS[number]
export type OpcodeHealthMode = 'simple' | 'normal'
export type OpcodeSkillPointMode = 'cap' | 'sum'

export const OPCODE_RULE_BOOK = 'Opcode' as const
export type OpcodeRuleBook = typeof OPCODE_RULE_BOOK

export interface CharacterSheet {
  id: string
  name: string
  created_at: string
  updated_at: string
  created_by: string
  character_id: string | null
  rule_book: OpcodeRuleBook
  version: string
  stats: Record<string, unknown>
  status: Record<string, unknown>
}

export interface OpcodeSkillValue {
  id: string
  name: string
  value: string
  originalName?: string
}

export interface OpcodeSkillRow extends OpcodeSkillValue {
  trained?: boolean
  stats?: OpcodeStatKey[]
  specializations?: OpcodeSkillValue[]
}

export interface OpcodeSheetForm {
  name: string
  characterId: string
  version: string
  baseStats: Record<OpcodeStatKey, string>
  healthMode: OpcodeHealthMode
  skillPointMode: OpcodeSkillPointMode
  skills: OpcodeSkillRow[]
}

export interface OpcodeDerivedStats {
  mov: number
  sensA: number
  sensV: number
  sensS: number
  weight: number
}

export interface OpcodeHealthTotals {
  mode: OpcodeHealthMode
  mul: 1
  max: number
  simple?: { base: number, mod: 0 }
  normal?: Record<OpcodeHealthPart, { base: number, mod: 0 }>
}

export interface OpcodeHealthPartSummary {
  key: OpcodeHealthPart
  max: number
  current: number | null
}

export interface OpcodeSheetSummary {
  baseStats: Record<OpcodeStatKey, number>
  attributePointsUsed: number
  skillPointMode: OpcodeSkillPointMode
  skillPointsBudget: number
  skillPointsRemaining: number
  highestStatKey: OpcodeStatKey | null
  highestStatValue: number
  skillPointsUsed: number
  fortitudeBonus: number
  mov: number
  sensA: number
  sensV: number
  sensS: number
  weight: number
  healthMode: OpcodeHealthMode | null
  maxHealth: number
  currentHealth: number | null
  parts: OpcodeHealthPartSummary[]
  skills: Array<{
    name: string
    value: number
    stats: OpcodeStatKey[]
    trained: boolean
    specializations: Array<{ name: string, value: number, rollBonus: number }>
  }>
}

export interface CreateCharacterSheetDto {
  name: string
  character_id: string | null
  rule_book: OpcodeRuleBook
  version: string
  stats: Record<string, unknown>
  status: Record<string, unknown>
}

export interface UpdateCharacterSheetDto {
  name?: string
  character_id?: string | null
  version?: string
  stats?: Record<string, unknown>
  status?: Record<string, unknown>
}

export interface CreateCharacterSheetResult {
  id: string
}

export interface CharacterOption {
  id: string
  label: string
  avatarUrl: string
  isUserCharacter: boolean
}

export interface OpcodeBackendValidationError {
  path?: string
  code?: string
  message?: string
}

export interface CharacterSheetFormError {
  formKey: string
  fields: Record<string, string>
}
