import { findOpcodeSpecializationPreset, OPCODE_SKILL_DEFINITIONS } from './opcodeSkillDefinitions'
import type { CharacterSheet, CreateCharacterSheetDto, OpcodeDerivedStats, OpcodeHealthMode, OpcodeHealthPart, OpcodeHealthTotals, OpcodeSheetForm, OpcodeSheetSummary, OpcodeSkillPointMode, OpcodeSkillRow, OpcodeStatKey, UpdateCharacterSheetDto } from './characterSheet.types'

export type { OpcodeSheetSummary } from './characterSheet.types'
import {
  buildFreshOpcodeStatusVitals,
  clampOpcodeVitalsFields,
  opcodeDeathSaveDifficulty,
  opcodeStunSaveDifficulty,
  readOpcodeVitalsFromStatusHealth,
} from './opcode-health-vitals'
import {
  OPCODE_DEFAULT_STAT,
  OPCODE_HEALTH_PARTS,
  OPCODE_RULE_BOOK,
  OPCODE_STAT_KEYS,
} from './characterSheet.types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VERSION_MAX_LENGTH = 64
const NAME_MAX_LENGTH = 128
const DEFAULT_STAT = String(OPCODE_DEFAULT_STAT)
const HEALTH_PART_RATIOS: Record<OpcodeHealthPart, number> = {
  head: 0.1,
  torso: 0.3,
  hand_primary: 0.1,
  hand_secondary: 0.1,
  leg_left: 0.2,
  leg_right: 0.2,
}

const EMPTY_SKILLS = { base: {}, extra: {} }
const EMPTY_RULES = { extensions: {}, optionals: {} }
const EMPTY_STATUS_STATS = { extra: {} }

export function isCharacterSheetId(value: unknown): boolean {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function createOpcodeSheetForm(): OpcodeSheetForm {
  return {
    name: '',
    characterId: '',
    version: '1',
    baseStats: {
      ref: DEFAULT_STAT,
      int: DEFAULT_STAT,
      wil: DEFAULT_STAT,
      chr: DEFAULT_STAT,
      bod: DEFAULT_STAT,
      luk: DEFAULT_STAT,
    },
    healthMode: 'simple',
    skillPointMode: 'cap',
    skills: Object.entries(OPCODE_SKILL_DEFINITIONS).map(([name, stats]) => ({
      id: `skill-${name}`, name, value: '0', trained: false,
      stats: [...stats], specializations: [],
    })),
  }
}

export function sheetToOpcodeForm(sheet: CharacterSheet): OpcodeSheetForm {
  const form = createOpcodeSheetForm()
  form.name = typeof sheet.name === 'string' ? sheet.name : form.name
  form.characterId = typeof sheet.character_id === 'string' && isCharacterSheetId(sheet.character_id)
    ? sheet.character_id
    : ''
  form.version = typeof sheet.version === 'string' ? sheet.version : form.version

  const statsRoot = asRecord(sheet.stats)
  const statsBlock = asRecord(statsRoot.stats)
  for (const key of OPCODE_STAT_KEYS)
    form.baseStats[key] = readPairBase(statsBlock[key]) ?? DEFAULT_STAT

  const health = asRecord(asRecord(statsRoot.derivated).health)
  form.healthMode = health.mode === 'normal' ? 'normal' : 'simple'
  form.skillPointMode = readOpcodeSkillPointMode(statsRoot)

  const storedSkills = new Map(readSkillRows(asRecord(asRecord(statsRoot.skills).base)).map(skill => [skill.name, skill]))
  form.skills = [
    ...form.skills.map(skill => storedSkills.get(skill.name) || skill),
    ...[...storedSkills.values()].filter(skill => !Object.hasOwn(OPCODE_SKILL_DEFINITIONS, skill.name)),
  ]

  return form
}

export function validateOpcodeSheetForm(form: OpcodeSheetForm): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = form.name.trim()
  if (!name)
    errors.name = 'characterSheets.validation.required'
  else if (name.length > NAME_MAX_LENGTH)
    errors.name = 'characterSheets.validation.nameTooLong'

  const version = form.version.trim()
  if (!version)
    errors.version = 'characterSheets.validation.required'
  else if (version.length > VERSION_MAX_LENGTH)
    errors.version = 'characterSheets.validation.versionTooLong'

  const characterId = form.characterId.trim()
  if (characterId && !isCharacterSheetId(characterId))
    errors.characterId = 'characterSheets.validation.invalidCharacter'

  for (const key of OPCODE_STAT_KEYS) {
    const parsed = parseSafeInteger(form.baseStats[key])
    if (parsed === null)
      errors[`baseStats.${key}`] = 'characterSheets.validation.safeInteger'
  }

  const seenSkills = new Set<string>()
  form.skills.forEach((skill, index) => {
    const name = skill.name.trim()
    const value = skill.value.trim()
    if (!name && !value && !skill.specializations?.length)
      return
    if (!name)
      errors[`skills.${index}.name`] = 'characterSheets.validation.required'
    else if (seenSkills.has(name))
      errors[`skills.${index}.name`] = 'characterSheets.validation.duplicateSkill'
    else
      seenSkills.add(name)
    if (parseSafeInteger(skill.value) === null)
      errors[`skills.${index}.value`] = 'characterSheets.validation.safeInteger'
    const seenSpecializations = new Set<string>()
    for (const [specIndex, spec] of (skill.specializations || []).entries()) {
      const specName = spec.name.trim()
      const key = `skills.${index}.specializations.${specIndex}`
      if (!specName)
        errors[`${key}.name`] = 'characterSheets.validation.required'
      else if (seenSpecializations.has(specName))
        errors[`${key}.name`] = 'characterSheets.validation.duplicateSkill'
      seenSpecializations.add(specName)
      if (parseSafeInteger(spec.value) === null)
        errors[`${key}.value`] = 'characterSheets.validation.safeInteger'
    }
  })

  return errors
}

export function parseOpcodeSkillLevel(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isInteger(parsed) ? parsed : 0
}

export function opcodeSpecializationNameTaken(
  specializations: Array<{ name: string }> | undefined,
  name: string,
): boolean {
  const normalized = name.trim().toLocaleLowerCase()
  if (!normalized) return true
  return (specializations ?? []).some(
    (spec) => spec.name.trim().toLocaleLowerCase() === normalized,
  )
}

export function calculateOpcodeAttributePointsUsed(
  baseStats: Partial<Record<OpcodeStatKey, string | number>>,
): number {
  return OPCODE_STAT_KEYS.reduce(
    (total, key) => total + Math.max(0, parseOpcodeSkillLevel(baseStats[key])),
    0,
  )
}

export function calculateOpcodeSkillPointsUsed(
  skills: Array<{ value: string | number, specializations?: Array<{ value: string | number }> }>,
): number {
  return skills.reduce((total, skill) => {
    const skillPoints = Math.max(0, parseOpcodeSkillLevel(skill.value))
    const specPoints = (skill.specializations ?? []).reduce(
      (sum, spec) => sum + Math.max(0, parseOpcodeSkillLevel(spec.value)),
      0,
    )
    return total + skillPoints + specPoints
  }, 0)
}

export function normalizeOpcodeSkillPointMode(value: unknown): OpcodeSkillPointMode {
  return value === 'sum' ? 'sum' : 'cap'
}

export function readOpcodeHighestStat(
  baseStats: Record<OpcodeStatKey, number>,
): { key: OpcodeStatKey, value: number } {
  let key: OpcodeStatKey = OPCODE_STAT_KEYS[0]
  let value = baseStats[key]
  for (const statKey of OPCODE_STAT_KEYS) {
    if (baseStats[statKey] > value) {
      key = statKey
      value = baseStats[statKey]
    }
  }
  return { key, value }
}

export function calculateOpcodeSkillPointBudget(
  mode: OpcodeSkillPointMode,
  baseStats: Partial<Record<OpcodeStatKey, string | number>>,
): { budget: number, highestStat: { key: OpcodeStatKey, value: number }, attributePointsTotal: number } {
  const parsed = {} as Record<OpcodeStatKey, number>
  for (const statKey of OPCODE_STAT_KEYS)
    parsed[statKey] = Math.max(0, parseOpcodeSkillLevel(baseStats[statKey]))

  const attributePointsTotal = calculateOpcodeAttributePointsUsed(parsed)
  const highestStat = readOpcodeHighestStat(parsed)
  const budget = mode === 'sum'
    ? Math.floor(attributePointsTotal * 1.5 + 5)
    : highestStat.value * 5

  return { budget, highestStat, attributePointsTotal }
}

export function calculateOpcodeSpecializationRollBonus(specValue: number): number {
  const level = Math.max(0, specValue)
  return level * 2
}

export function formatOpcodeSpecializationRollBonus(specValue: number): string {
  return `+${calculateOpcodeSpecializationRollBonus(specValue)}`
}

export function formatOpcodeSkillRollLine(
  stats: OpcodeStatKey[] | undefined,
  baseStats: Partial<Record<OpcodeStatKey, string | number>>,
  skillValue: string | number | null | undefined,
): string {
  const attrs = formatOpcodeStatBonusLine(stats, baseStats)
  const rank = Math.max(0, parseOpcodeSkillLevel(skillValue))
  const total = readOpcodeLinkedStatValue(stats, baseStats) + rank
  return `${total}=${attrs}${rank}`
}

export function formatOpcodeSpecializationRollLine(
  stats: OpcodeStatKey[] | undefined,
  baseStats: Partial<Record<OpcodeStatKey, string | number>>,
  specValue: string | number | null | undefined,
): string {
  const rank = Math.max(0, parseOpcodeSkillLevel(specValue))
  const extra = calculateOpcodeSpecializationRollBonus(rank)
  const total = readOpcodeLinkedStatValue(stats, baseStats) + rank + extra
  return `${total}=${formatOpcodeStatBonusLine(stats, baseStats)}${rank}${formatOpcodeSpecializationRollBonus(rank)}`
}

export function clampOpcodeSkillSpecializations(_skill: OpcodeSkillRow): void {
  // Specializations spend skill points independently; roll bonuses are derived at read time.
}

export function readOpcodeFortitudeBonus(
  skills: Array<{ name: string, value: number, specializations: Array<{ name: string, value: number }> }>,
): number {
  const consitution = skills.find(skill => skill.name === 'consitution')
  if (!consitution)
    return 0

  let total = Math.max(0, consitution.value)
  for (const spec of consitution.specializations) {
    if (findOpcodeSpecializationPreset('consitution', spec.name)?.key === 'fortitude')
      total += Math.max(0, spec.value)
  }
  return total
}

export function formatOpcodeSaveRoll(statValue: number, fortitudeBonus: number): string {
  return formatOpcodeRoll([statValue, fortitudeBonus])
}

export function readOpcodeLinkedStatValue(
  stats: OpcodeStatKey[] | undefined,
  baseStats: Partial<Record<OpcodeStatKey, string | number>>,
): number {
  if (!stats?.length)
    return 0
  return stats.reduce(
    (best, key) => Math.max(best, Math.max(0, parseOpcodeSkillLevel(baseStats[key]))),
    0,
  )
}

function formatOpcodeRoll(parts: number[]): string {
  return `1D10${parts.map(part => `+${Math.max(0, part)}`).join('')}`
}

export function formatOpcodeSkillRoll(
  stats: OpcodeStatKey[] | undefined,
  baseStats: Partial<Record<OpcodeStatKey, string | number>>,
  skillValue: string | number | null | undefined,
): string {
  return formatOpcodeRoll([
    readOpcodeLinkedStatValue(stats, baseStats),
    parseOpcodeSkillLevel(skillValue),
  ])
}

export function formatOpcodeSpecializedSkillRoll(
  stats: OpcodeStatKey[] | undefined,
  baseStats: Partial<Record<OpcodeStatKey, string | number>>,
  skillValue: string | number | null | undefined,
  specValue: string | number | null | undefined,
): string {
  return formatOpcodeRoll([
    readOpcodeLinkedStatValue(stats, baseStats),
    parseOpcodeSkillLevel(skillValue),
    calculateOpcodeSpecializationRollBonus(parseOpcodeSkillLevel(specValue)),
  ])
}

export function formatOpcodeStatBonus(statKey: OpcodeStatKey, value: string | number | null | undefined): string {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  const n = Number.isInteger(parsed) ? parsed : 0
  return `${statKey.toUpperCase()}(${n}+)`
}

export function formatOpcodeStatBonusLine(
  stats: OpcodeStatKey[] | undefined,
  baseStats: Partial<Record<OpcodeStatKey, string | number>>,
): string {
  if (!stats?.length)
    return ''
  return stats.map(key => formatOpcodeStatBonus(key, baseStats[key])).join(' ')
}

export function calculateOpcodeDerived(baseStats: Record<OpcodeStatKey, number>): OpcodeDerivedStats {
  return {
    mov: Math.round(baseStats.ref * 1.75 + baseStats.bod * 1.25),
    sensA: baseStats.ref + baseStats.wil * 2,
    sensV: baseStats.ref + baseStats.wil * 10,
    sensS: baseStats.ref + baseStats.wil + 2,
    weight: 20 + 10 * baseStats.bod,
  }
}

export function calculateOpcodeHitPoints(bod: number, wil: number): number {
  return Math.ceil(wil * 0.5 + bod * 2 + 6)
}

export function calculateOpcodeHealth(form: OpcodeSheetForm): OpcodeHealthTotals {
  const parsed = requireBaseStats(form)
  const max = calculateOpcodeHitPoints(parsed.bod, parsed.wil)
  if (form.healthMode === 'simple') {
    return {
      mode: 'simple',
      mul: 1,
      max,
      simple: { base: max, mod: 0 },
    }
  }

  const normal = {} as Record<OpcodeHealthPart, { base: number, mod: 0 }>
  let partTotal = 0
  for (const part of OPCODE_HEALTH_PARTS) {
    const value = Math.ceil(max * HEALTH_PART_RATIOS[part])
    normal[part] = { base: value, mod: 0 }
    partTotal += value
  }

  return {
    mode: 'normal',
    mul: 1,
    max: partTotal,
    normal,
  }
}

export function buildCreateCharacterSheetDto(form: OpcodeSheetForm): CreateCharacterSheetDto {
  assertValidForm(form)
  const health = calculateOpcodeHealth(form)
  return {
    name: form.name.trim(),
    character_id: form.characterId.trim() || null,
    rule_book: OPCODE_RULE_BOOK,
    version: form.version.trim(),
    stats: buildFreshStats(form, health),
    status: buildFreshStatus(health),
  }
}

export function buildUpdateCharacterSheetDto(
  form: OpcodeSheetForm,
  originalSheet: CharacterSheet,
): UpdateCharacterSheetDto {
  assertValidForm(form)
  const stats = cloneRecord(originalSheet.stats)
  const status = cloneRecord(originalSheet.status)
  const health = calculateOpcodeHealth(form)
  const parsed = requireBaseStats(form)
  const statsBlock = asRecord(stats.stats)
  const extra = asRecord(statsBlock.extra)
  const effective = {} as Record<OpcodeStatKey, number>
  for (const key of OPCODE_STAT_KEYS) {
    statsBlock[key] = overlayPairBase(statsBlock[key], parsed[key])
    effective[key] = parsed[key] + readPairMod(statsBlock[key]) + readRuntimeStatMod(status, key)
  }
  statsBlock.extra = extra
  stats.stats = statsBlock

  const derivedValues = calculateOpcodeDerived(effective)
  const derived = asRecord(stats.derivated)
  derived.mov = overlayPairBase(derived.mov, derivedValues.mov)
  derived.weight = { ...(isPlainObject(derived.weight) ? derived.weight : {}), base: derivedValues.weight }
  const previousSens = asRecord(derived.sens)
  derived.sens = {
    ...previousSens,
    a: overlayPairBase(previousSens.a, derivedValues.sensA),
    v: overlayPairBase(previousSens.v, derivedValues.sensV),
    s: overlayPairBase(previousSens.s, derivedValues.sensS),
  }
  derived.health = buildHealthStats(health)
  stats.derivated = derived
  stats.skills = {
    ...asRecord(stats.skills),
    base: writeSkillBase(form, asRecord(asRecord(stats.skills).base)),
    extra: asRecord(asRecord(stats.skills).extra),
  }
  stats.rules = writeOpcodeRules(form, stats.rules)

  const originalHealth = asRecord(status.health)
  const originalMode = originalHealth.mode === 'normal' || originalHealth.mode === 'simple'
    ? originalHealth.mode
    : null
  status.health = originalMode === form.healthMode
    ? clampStatusHealth(originalHealth, health)
    : buildFreshStatusHealth(health)

  if (!isPlainObject(status.skills))
    status.skills = structuredClone(EMPTY_SKILLS)
  if (!Array.isArray(status.inventory))
    status.inventory = []
  if (!isPlainObject(status.containers))
    status.containers = {}

  return {
    name: form.name.trim(),
    character_id: form.characterId.trim() || null,
    version: form.version.trim(),
    stats,
    status,
  }
}

export function readOpcodeSheetSummary(
  stats: Record<string, unknown>,
  status: Record<string, unknown>,
): OpcodeSheetSummary {
  const statsRoot = asRecord(stats)
  const statsBlock = asRecord(statsRoot.stats)
  const baseStats = {} as Record<OpcodeStatKey, number>
  let canCalculate = true
  for (const key of OPCODE_STAT_KEYS) {
    const value = readPairBaseNumber(statsBlock[key])
    if (value === null) {
      baseStats[key] = 0
      canCalculate = false
    }
    else {
      baseStats[key] = value
    }
  }

  const calculated = canCalculate ? calculateOpcodeDerived(baseStats) : null
  const derived = asRecord(statsRoot.derivated)
  const sens = asRecord(derived.sens)
  const health = asRecord(derived.health)
  const statusHealth = asRecord(asRecord(status).health)
  const healthMode: OpcodeHealthMode | null = health.mode === 'normal' || health.mode === 'simple'
    ? health.mode
    : null

  const skills = readSkillSummary(asRecord(asRecord(statsRoot.skills).base))
  const skillPointMode = readOpcodeSkillPointMode(statsRoot)
  const skillPointBudget = calculateOpcodeSkillPointBudget(skillPointMode, baseStats)
  const skillPointsUsed = calculateOpcodeSkillPointsUsed(skills)
  const summary: OpcodeSheetSummary = {
    baseStats,
    attributePointsUsed: calculateOpcodeAttributePointsUsed(baseStats),
    skillPointMode,
    skillPointsBudget: skillPointBudget.budget,
    skillPointsRemaining: skillPointBudget.budget - skillPointsUsed,
    highestStatKey: skillPointBudget.highestStat.key,
    highestStatValue: skillPointBudget.highestStat.value,
    skillPointsUsed,
    fortitudeBonus: readOpcodeFortitudeBonus(skills),
    mov: readPairBaseNumber(derived.mov) ?? calculated?.mov ?? 0,
    sensA: readPairBaseNumber(sens.a) ?? calculated?.sensA ?? 0,
    sensV: readPairBaseNumber(sens.v) ?? calculated?.sensV ?? 0,
    sensS: readPairBaseNumber(sens.s) ?? calculated?.sensS ?? 0,
    weight: readPairBaseNumber(derived.weight) ?? calculated?.weight ?? 0,
    healthMode,
    maxHealth: 0,
    currentHealth: null,
    stunGauge: null,
    stunGaugeMax: 0,
    stunSaveDifficulty: 10,
    deathSaveDifficulty: 10,
    stunPenalty: 0,
    vitalsUnconscious: false,
    vitalsDeathSave: false,
    vitalsDead: false,
    parts: [],
    skills,
  }

  if (healthMode === 'simple') {
    const max = readPairEffective(health.simple) ?? readSafeInt(health.max) ?? 0
    summary.maxHealth = max
    summary.currentHealth = readPairEffective(statusHealth.simple)
  }
  else if (healthMode === 'normal') {
    const normal = asRecord(health.normal)
    const statusNormal = asRecord(statusHealth.normal)
    let maxTotal = 0
    let currentTotal = 0
    let hasCurrent = false
    for (const part of OPCODE_HEALTH_PARTS) {
      const max = readPairEffective(normal[part]) ?? 0
      const current = readPairEffective(statusNormal[part])
      maxTotal += max
      if (current !== null) {
        currentTotal += current
        hasCurrent = true
      }
      summary.parts.push({ key: part, max, current })
    }
    summary.maxHealth = readSafeInt(health.max) ?? maxTotal
    summary.currentHealth = hasCurrent ? currentTotal : null
  }

  const vitals = readOpcodeVitalsFromStatusHealth(statusHealth)
  summary.stunGaugeMax = summary.maxHealth
  summary.stunGauge = summary.maxHealth > 0 ? vitals.stunGauge : null
  summary.stunPenalty = vitals.stunPenalty
  summary.stunSaveDifficulty = opcodeStunSaveDifficulty(vitals.stunGauge)
  summary.deathSaveDifficulty = opcodeDeathSaveDifficulty(
    vitals.damageTaken,
    vitals.deathSaveDifficultyReduction,
  )
  summary.vitalsUnconscious = vitals.unconscious
  summary.vitalsDeathSave = vitals.deathSave
  summary.vitalsDead = vitals.dead

  return summary
}

function readSkillRows(base: Record<string, unknown>): OpcodeSkillRow[] {
  return Object.entries(base).map(([name, value]) => ({
    id: `skill-${name}`,
    originalName: name,
    name,
    value: readPairBase(value) ?? '0',
    trained: typeof asRecord(value).trained === 'boolean' ? asRecord(value).trained as boolean : undefined,
    stats: Array.isArray(asRecord(value).stat)
      ? (asRecord(value).stat as unknown[]).filter((key): key is OpcodeStatKey => OPCODE_STAT_KEYS.includes(key as OpcodeStatKey))
      : [...(OPCODE_SKILL_DEFINITIONS[name] || [])],
    specializations: Object.entries(asRecord(asRecord(value).specialization)).map(([specName, spec]) => ({
      id: `specialization-${specName}`,
      originalName: specName,
      name: specName,
      value: readPairBase(spec) ?? '0',
    })),
  }))
}

function readSkillSummary(base: Record<string, unknown>): OpcodeSheetSummary['skills'] {
  return readSkillRows(base)
    .filter(skill => readPairBaseNumber(base[skill.name]) !== null)
    .map(skill => ({
      name: skill.name,
      value: Number(skill.value),
      stats: skill.stats || [],
      trained: skill.trained === true,
      specializations: (skill.specializations || []).map(spec => ({
        name: spec.name,
        value: Number(spec.value),
        rollBonus: calculateOpcodeSpecializationRollBonus(Number(spec.value)),
      })),
    }))
}

function writeSkillBase(
  form: OpcodeSheetForm,
  previousBase: Record<string, unknown> = {},
): Record<string, unknown> {
  return Object.fromEntries(form.skills.filter(skill => skill.name.trim()).map((skill) => {
    // Stable source names preserve modifiers and metadata when a branch is renamed.
    const sourceName = skill.originalName ?? skill.name.trim()
    const previous = Object.hasOwn(previousBase, sourceName) ? asRecord(previousBase[sourceName]) : {}
    const node: Record<string, unknown> = { ...previous, base: requireSafeInteger(skill.value), mod: readSafeInt(previous.mod) ?? 0 }
    if (skill.trained !== undefined)
      node.trained = skill.trained
    if (skill.stats?.length || Object.hasOwn(previous, 'stat'))
      node.stat = skill.stats || []
    if (skill.specializations?.length || Object.hasOwn(previous, 'specialization')) {
      const previousSpecs = asRecord(previous.specialization)
      node.specialization = Object.fromEntries((skill.specializations || []).map((spec) => {
        const sourceSpec = spec.originalName ?? spec.name.trim()
        const old = Object.hasOwn(previousSpecs, sourceSpec) ? asRecord(previousSpecs[sourceSpec]) : {}
        return [spec.name.trim(), { ...old, base: requireSafeInteger(spec.value), mod: readSafeInt(old.mod) ?? 0 }]
      }))
    }
    return [skill.name.trim(), node]
  }))
}

function assertValidForm(form: OpcodeSheetForm) {
  const errors = validateOpcodeSheetForm(form)
  if (Object.keys(errors).length)
    throw new Error('Invalid Opcode sheet form')
}

function buildFreshStats(form: OpcodeSheetForm, health: OpcodeHealthTotals): Record<string, unknown> {
  const parsed = requireBaseStats(form)
  const derived = calculateOpcodeDerived(parsed)
  const statsBlock: Record<string, unknown> = { extra: {} }
  for (const key of OPCODE_STAT_KEYS)
    statsBlock[key] = { base: parsed[key], mod: 0 }

  return {
    stats: statsBlock,
    derivated: {
      mov: { base: derived.mov, mod: 0 },
      weight: { base: derived.weight },
      sens: {
        a: { base: derived.sensA, mod: 0 },
        v: { base: derived.sensV, mod: 0 },
        s: { base: derived.sensS, mod: 0 },
      },
      health: buildHealthStats(health),
    },
    skills: {
      base: writeSkillBase(form),
      extra: {},
    },
    rules: writeOpcodeRules(form),
  }
}

function readOpcodeSkillPointMode(statsRoot: Record<string, unknown>): OpcodeSkillPointMode {
  const rules = asRecord(statsRoot.rules)
  const optionals = asRecord(rules.optionals)
  return normalizeOpcodeSkillPointMode(optionals.skill_point_mode)
}

function writeOpcodeRules(form: OpcodeSheetForm, previousRules: unknown = EMPTY_RULES): Record<string, unknown> {
  const rules = isPlainObject(previousRules) ? { ...previousRules as Record<string, unknown> } : structuredClone(EMPTY_RULES)
  const extensions = isPlainObject(rules.extensions) ? { ...rules.extensions as Record<string, unknown> } : {}
  const optionals = isPlainObject(rules.optionals) ? { ...rules.optionals as Record<string, unknown> } : {}
  optionals.skill_point_mode = form.skillPointMode
  return {
    extensions,
    optionals,
  }
}

function buildFreshStatus(health: OpcodeHealthTotals): Record<string, unknown> {
  return {
    stats: structuredClone(EMPTY_STATUS_STATS),
    health: buildFreshStatusHealth(health),
    skills: structuredClone(EMPTY_SKILLS),
    containers: {},
    inventory: [],
  }
}

function buildHealthStats(health: OpcodeHealthTotals): Record<string, unknown> {
  if (health.mode === 'simple') {
    return {
      mode: 'simple',
      mul: 1,
      max: health.max,
      simple: health.simple,
    }
  }

  return {
    mode: 'normal',
    mul: 1,
    max: health.max,
    normal: health.normal,
  }
}

function buildFreshStatusHealth(health: OpcodeHealthTotals): Record<string, unknown> {
  const vitals = buildFreshOpcodeStatusVitals()
  if (health.mode === 'simple') {
    return {
      mode: 'simple',
      simple: { base: health.max, mod: 0 },
      ...vitals,
    }
  }

  const normal = {} as Record<OpcodeHealthPart, { base: number, mod: 0 }>
  for (const part of OPCODE_HEALTH_PARTS)
    normal[part] = { base: health.normal![part].base, mod: 0 }

  return {
    mode: 'normal',
    normal,
    ...vitals,
  }
}

function clampStatusHealth(
  originalHealth: Record<string, unknown>,
  health: OpcodeHealthTotals,
): Record<string, unknown> {
  if (health.mode === 'simple') {
    const current = readPairEffective(originalHealth.simple)
    return clampOpcodeVitalsFields({
      ...originalHealth,
      mode: 'simple',
      simple: { base: clampInt(current ?? health.max, 0, health.max), mod: 0 },
      normal: undefined,
    }, health.max)
  }

  const originalNormal = asRecord(originalHealth.normal)
  const normal = {} as Record<OpcodeHealthPart, { base: number, mod: 0 }>
  for (const part of OPCODE_HEALTH_PARTS) {
    const max = health.normal![part].base
    const current = readPairEffective(originalNormal[part])
    normal[part] = { base: clampInt(current ?? max, 0, max), mod: 0 }
  }

  return clampOpcodeVitalsFields({
    ...originalHealth,
    mode: 'normal',
    normal,
    simple: undefined,
  }, health.max)
}

function requireBaseStats(form: OpcodeSheetForm): Record<OpcodeStatKey, number> {
  const parsed = {} as Record<OpcodeStatKey, number>
  for (const key of OPCODE_STAT_KEYS)
    parsed[key] = requireSafeInteger(form.baseStats[key])
  return parsed
}

function parseSafeInteger(raw: string): number | null {
  const value = raw.trim()
  if (!value || !/^[+-]?\d+$/.test(value))
    return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function requireSafeInteger(raw: string): number {
  const parsed = parseSafeInteger(raw)
  if (parsed === null)
    throw new Error('Invalid Opcode sheet form')
  return parsed
}

function readPairBase(value: unknown): string | null {
  const parsed = readPairBaseNumber(value)
  return parsed === null ? null : String(parsed)
}

function overlayPairBase(value: unknown, base: number): Record<string, unknown> {
  const previous = asRecord(value)
  return {
    ...previous,
    base,
    mod: readSafeInt(previous.mod) ?? 0,
  }
}

function readPairMod(value: unknown): number {
  if (!isPlainObject(value) || value.mod === undefined)
    return 0
  return readSafeInt(value.mod) ?? 0
}

function readRuntimeStatMod(status: Record<string, unknown>, key: OpcodeStatKey): number {
  return readPairMod(asRecord(asRecord(status).stats)[key])
}

function readPairBaseNumber(value: unknown): number | null {
  if (!isPlainObject(value))
    return null
  return readSafeInt(value.base)
}

function readPairEffective(value: unknown): number | null {
  if (!isPlainObject(value))
    return null
  const base = readSafeInt(value.base)
  if (base === null)
    return null
  const mod = value.mod === undefined ? 0 : readSafeInt(value.mod)
  if (mod === null)
    return null
  return base + mod
}

function readSafeInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
}

function clampInt(value: number, min: number, max: number): number {
  if (value < min)
    return min
  if (value > max)
    return max
  return value
}

function cloneRecord(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(asRecord(value))) as Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
