import assert from 'node:assert/strict'
import test from 'node:test'
import { reactive } from 'vue'

import {
  buildCreateCharacterSheetDto,
  buildUpdateCharacterSheetDto,
  calculateOpcodeAttributePointsUsed,
  calculateOpcodeDerived,
  calculateOpcodeHealth,
  calculateOpcodeHitPoints,
  calculateOpcodeSkillPointBudget,
  calculateOpcodeSkillPointsUsed,
  calculateOpcodeSpecializationRollBonus,
  clampOpcodeSkillSpecializations,
  formatOpcodeStatBonus,
  formatOpcodeStatBonusLine,
  formatOpcodeSaveRoll,
  formatOpcodeSkillRollLine,
  formatOpcodeSpecializationRollLine,
  createOpcodeSheetForm,
  readOpcodeFortitudeBonus,
  isCharacterSheetId,
  parseOpcodeSkillLevel,
  readOpcodeSheetSummary,
  sheetToOpcodeForm,
  validateOpcodeSheetForm,
} from './opcodeSheet.ts'
import { OPCODE_DEFAULT_STAT } from './characterSheet.types.ts'

const SHEET_ID = '44444444-4444-4444-8444-444444444444'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'

function asRecord(value) {
  assert.equal(value !== null && typeof value === 'object' && !Array.isArray(value), true)
  return value
}

function validForm() {
  const form = createOpcodeSheetForm()
  form.name = 'Rook'
  return form
}

function pair(value) {
  const record = asRecord(value)
  return { base: record.base, mod: record.mod }
}

test('formats Opcode skill check attribute bonus labels', () => {
  assert.equal(formatOpcodeStatBonus('wil', 10), 'WIL(10+)')
  assert.equal(formatOpcodeStatBonus('ref', '8'), 'REF(8+)')
  assert.equal(formatOpcodeStatBonusLine(['wil', 'int'], { wil: 10, int: 8 }), 'WIL(10+) INT(8+)')
  assert.equal(formatOpcodeStatBonusLine([], { wil: 10 }), '')
  assert.equal(formatOpcodeSkillRollLine(['wil'], { wil: 5 }, 2), '7=WIL(5+)2')
  assert.equal(formatOpcodeSpecializationRollLine(['wil'], { wil: 5 }, 2), '11=WIL(5+)2+4')
  assert.equal(formatOpcodeSkillRollLine(['wil', 'int'], { wil: 10, int: 8 }, 2), '12=WIL(10+) INT(8+)2')
})

test('accepts UUID sheet ids and rejects bigint leftovers', () => {
  assert.equal(isCharacterSheetId(SHEET_ID), true)
  assert.equal(isCharacterSheetId(SHEET_ID.toUpperCase()), true)
  assert.equal(isCharacterSheetId('42'), false)
  assert.equal(isCharacterSheetId('1234567890123456789'), false)
  assert.equal(isCharacterSheetId(42), false)
})

test('calculates movement and three senses from base stats', () => {
  const derived = calculateOpcodeDerived({
    ref: 10,
    int: 4,
    wil: 6,
    chr: 1,
    bod: 8,
    luk: 2,
  })

  assert.deepEqual(derived, {
    mov: 20,
    sensA: 22,
    sensV: 70,
    sensS: 18,
  })
})

test('calculates simple and normal maximum health', () => {
  assert.equal(calculateOpcodeHitPoints(10, 10), 31)
  assert.equal(calculateOpcodeHitPoints(8, 6), 25)
  assert.equal(calculateOpcodeHitPoints(5, 5), 19)

  const simpleForm = createOpcodeSheetForm()
  assert.equal(calculateOpcodeHealth(simpleForm).max, 19)

  const normalForm = createOpcodeSheetForm()
  normalForm.healthMode = 'normal'
  const normal = calculateOpcodeHealth(normalForm)
  assert.equal(normal.normal.head.base, 2)
  assert.equal(normal.normal.torso.base, 6)
  assert.equal(normal.max, 20)
})

test('creates current health at the new maximum', () => {
  const simpleForm = validForm()
  const simpleDto = buildCreateCharacterSheetDto(simpleForm)
  assert.equal(simpleDto.name, 'Rook')
  const simpleHealth = asRecord(asRecord(simpleDto.status).health)
  assert.deepEqual(pair(simpleHealth.simple), { base: 19, mod: 0 })
  assert.equal(simpleHealth.mode, 'simple')
  assert.deepEqual(asRecord(simpleDto.status).inventory, [])
  assert.deepEqual(asRecord(asRecord(simpleDto.status).stats).extra, {})

  const derivedHealth = asRecord(asRecord(asRecord(simpleDto.stats).derivated).health)
  assert.equal(derivedHealth.mul, 1)
  assert.equal(derivedHealth.max, 19)

  const normalForm = validForm()
  normalForm.healthMode = 'normal'
  const normalDto = buildCreateCharacterSheetDto(normalForm)
  const normalHealth = asRecord(asRecord(asRecord(normalDto.status).health).normal)
  assert.deepEqual(pair(normalHealth.head), { base: 2, mod: 0 })
  assert.deepEqual(pair(normalHealth.torso), { base: 6, mod: 0 })
})

test('preserves, clamps, or resets current health on edit', () => {
  const original = {
    id: SHEET_ID,
    name: 'Rook',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_by: USER_ID,
    character_id: CHARACTER_ID,
    rule_book: 'Opcode',
    version: '1',
    stats: {
      stats: {
        ref: { base: 10, mod: 0 },
        int: { base: 10, mod: 0 },
        wil: { base: 10, mod: 0 },
        chr: { base: 10, mod: 0 },
        bod: { base: 10, mod: 0 },
        luk: { base: 10, mod: 0 },
        extra: { grit: { base: 1, mod: 2 } },
      },
      derivated: {
        mov: { base: 22, mod: 0 },
        sens: {
          a: { base: 30, mod: 0 },
          v: { base: 110, mod: 0 },
          s: { base: 22, mod: 0 },
        },
        health: {
          mode: 'simple',
          mul: 1,
          max: 10,
          simple: { base: 10, mod: 0 },
        },
        leftover: { note: 'keep-me' },
      },
      skills: { base: { calm: { base: 1, mod: 0 } }, extra: {} },
      rules: { extensions: { house: true }, optionals: {} },
      unknownStats: { secret: 7 },
    },
    status: {
      stats: {
        ref: { mod: 3 },
        extra: { grit: { mod: 1 } },
      },
      health: {
        mode: 'simple',
        simple: { base: 8, mod: 1 },
      },
      skills: { base: {}, extra: {} },
      inventory: [{ name: 'knife', count: 1, desc: 'sharp' }],
      unknownStatus: { flag: true },
    },
  }

  const preservedForm = sheetToOpcodeForm(original)
  const preserved = buildUpdateCharacterSheetDto(preservedForm, original)
  assert.deepEqual(pair(asRecord(asRecord(preserved.status).health).simple), { base: 9, mod: 0 })

  const clampedForm = sheetToOpcodeForm(original)
  clampedForm.baseStats.bod = '0'
  clampedForm.baseStats.wil = '2'
  const clamped = buildUpdateCharacterSheetDto(clampedForm, original)
  assert.deepEqual(pair(asRecord(asRecord(clamped.status).health).simple), { base: 7, mod: 0 })

  const resetForm = sheetToOpcodeForm(original)
  resetForm.healthMode = 'normal'
  const reset = buildUpdateCharacterSheetDto(resetForm, original)
  const resetHealth = asRecord(asRecord(reset.status).health)
  assert.equal(resetHealth.mode, 'normal')
  assert.equal(resetHealth.simple, undefined)
  assert.deepEqual(pair(asRecord(resetHealth.normal).head), { base: 4, mod: 0 })
})

test('keeps unknown stats, status, and inventory branches without mutating the original', () => {
  const original = {
    id: SHEET_ID,
    name: 'Rook',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_by: USER_ID,
    character_id: CHARACTER_ID,
    rule_book: 'Opcode',
    version: '1',
    stats: {
      stats: {
        ref: { base: 10, mod: 0 },
        int: { base: 10, mod: 0 },
        wil: { base: 10, mod: 0 },
        chr: { base: 10, mod: 0 },
        bod: { base: 10, mod: 0 },
        luk: { base: 10, mod: 0 },
        extra: { grit: { base: 1, mod: 2 } },
      },
      derivated: {
        mov: { base: 22, mod: 0 },
        sens: {
          a: { base: 30, mod: 0 },
          v: { base: 110, mod: 0 },
          s: { base: 22, mod: 0 },
        },
        health: {
          mode: 'simple',
          mul: 1,
          max: 10,
          simple: { base: 10, mod: 0 },
        },
        leftover: { note: 'keep-me' },
      },
      skills: { base: { calm: { base: 1, mod: 0 } }, extra: {} },
      rules: { extensions: { house: true }, optionals: {} },
      unknownStats: { secret: 7 },
    },
    status: {
      stats: {
        ref: { mod: 3 },
        extra: { grit: { mod: 1 } },
      },
      health: {
        mode: 'simple',
        simple: { base: 8, mod: 0 },
      },
      skills: { base: {}, extra: {} },
      inventory: [{ name: 'knife', count: 1, desc: 'sharp' }],
      unknownStatus: { flag: true },
    },
  }
  const snapshot = structuredClone(original)
  const form = sheetToOpcodeForm(original)
  form.baseStats.ref = '12'
  const updated = buildUpdateCharacterSheetDto(form, original)

  assert.deepEqual(original, snapshot)
  assert.deepEqual(asRecord(updated.stats).unknownStats, { secret: 7 })
  assert.deepEqual(asRecord(asRecord(updated.stats).derivated).leftover, { note: 'keep-me' })
  assert.deepEqual(asRecord(asRecord(updated.stats).stats).extra, { grit: { base: 1, mod: 2 } })
  assert.deepEqual(asRecord(updated.status).inventory, [{ name: 'knife', count: 1, desc: 'sharp' }])
  assert.deepEqual(asRecord(updated.status).unknownStatus, { flag: true })
  assert.deepEqual(asRecord(asRecord(updated.status).stats).ref, { mod: 3 })
  assert.deepEqual(asRecord(asRecord(updated.status).stats).extra, { grit: { mod: 1 } })
  assert.deepEqual(pair(asRecord(asRecord(updated.stats).stats).ref), { base: 12, mod: 0 })
  assert.deepEqual(pair(asRecord(asRecord(updated.stats).derivated).mov), { base: 27, mod: 0 })
})

test('preserves static mods, runtime mods, armor, and derived metadata when editing the base sheet', () => {
  const original = {
    id: SHEET_ID,
    name: 'Rook',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_by: USER_ID,
    character_id: CHARACTER_ID,
    rule_book: 'Opcode',
    version: '1',
    stats: {
      stats: {
        ref: { base: 10, mod: 2, note: 'static' },
        int: { base: 10, mod: 0 },
        wil: { base: 10, mod: 1 },
        chr: { base: 10, mod: 0 },
        bod: { base: 10, mod: 4 },
        luk: { base: 10, mod: 0 },
        extra: {},
      },
      derivated: {
        mov: { base: 28, mod: 3, note: 'mov-meta' },
        sens: {
          a: { base: 33, mod: 0 },
          v: { base: 113, mod: 0 },
          s: { base: 25, mod: 1, note: 'sense-meta' },
        },
        health: { mode: 'simple', mul: 1, max: 31, simple: { base: 31, mod: 0 } },
      },
      skills: { base: {}, extra: {} },
      rules: { extensions: {}, optionals: {} },
    },
    status: {
      stats: { ref: { mod: 5 }, extra: {} },
      derivated: { sens: { s: { mod: 10 } } },
      health: { mode: 'simple', simple: { base: 20, mod: 0 } },
      armor: { normal: { torso: 12 } },
      skills: { base: { charm: { mod: 10 } }, extra: {} },
      inventory: [{ id: SHEET_ID, name: 'knife', count: 1, desc: '' }],
    },
  }
  const snapshot = structuredClone(original)
  const form = sheetToOpcodeForm(original)
  form.baseStats.ref = '11'
  const updated = buildUpdateCharacterSheetDto(form, original)

  assert.deepEqual(original, snapshot)
  assert.deepEqual(asRecord(asRecord(updated.stats).stats).ref, { base: 11, mod: 2, note: 'static' })
  assert.deepEqual(asRecord(asRecord(updated.status).stats).ref, { mod: 5 })
  assert.deepEqual(asRecord(updated.status).derivated, original.status.derivated)
  assert.deepEqual(asRecord(updated.status).armor, original.status.armor)
  assert.deepEqual(asRecord(updated.status).skills, original.status.skills)
  assert.deepEqual(asRecord(updated.status).inventory, original.status.inventory)
  assert.deepEqual(asRecord(asRecord(updated.stats).derivated).mov, { base: 34, mod: 3, note: 'mov-meta' })
  assert.deepEqual(asRecord(asRecord(asRecord(updated.stats).derivated).sens).a, { base: 40, mod: 0 })
  assert.deepEqual(asRecord(asRecord(asRecord(updated.stats).derivated).sens).v, { base: 128, mod: 0 })
  assert.deepEqual(asRecord(asRecord(asRecord(updated.stats).derivated).sens).s, { base: 31, mod: 1, note: 'sense-meta' })
})

test('writes named skills into the Opcode payload', () => {
  const form = validForm()
  form.skills = [{ id: 'skill-calm', name: 'calm', value: '3' }]
  const dto = buildCreateCharacterSheetDto(form)
  assert.deepEqual(pair(asRecord(asRecord(asRecord(dto.stats).skills).base).calm), { base: 3, mod: 0 })
})

test('rejects non-safe integers and negative health', () => {
  const form = validForm()
  form.baseStats.ref = '1.5'
  form.version = ''
  form.name = ''
  const errors = validateOpcodeSheetForm(form)
  assert.equal(errors['baseStats.ref'], 'characterSheets.validation.safeInteger')
  assert.equal(errors.version, 'characterSheets.validation.required')
  assert.equal(errors.name, 'characterSheets.validation.required')

  form.baseStats.ref = '9007199254740992'
  const unsafe = validateOpcodeSheetForm(form)
  assert.equal(unsafe['baseStats.ref'], 'characterSheets.validation.safeInteger')
})

test('reads a stored summary without copying formulas into callers', () => {
  const dto = buildCreateCharacterSheetDto(validForm())
  const summary = readOpcodeSheetSummary(dto.stats, dto.status)
  assert.equal(summary.mov, 12)
  assert.equal(summary.sensA, 15)
  assert.equal(summary.sensV, 55)
  assert.equal(summary.sensS, 12)
  assert.equal(summary.maxHealth, 19)
  assert.equal(summary.currentHealth, 19)
  assert.equal(summary.attributePointsUsed, 30)
  assert.equal(summary.skillPointMode, 'cap')
  assert.equal(summary.skillPointsBudget, 25)
  assert.equal(summary.skillPointsUsed, 0)
  assert.equal(summary.skillPointsRemaining, 25)
})

test('calculates opcode skill point budgets and specialization roll bonuses', () => {
  const form = createOpcodeSheetForm()
  assert.deepEqual(calculateOpcodeSkillPointBudget('cap', form.baseStats), {
    budget: 25,
    highestStat: { key: 'ref', value: 5 },
    attributePointsTotal: 30,
  })
  assert.equal(calculateOpcodeSkillPointBudget('sum', form.baseStats).budget, 50)

  form.baseStats.ref = '7'
  assert.equal(calculateOpcodeSkillPointBudget('cap', form.baseStats).budget, 35)
  assert.equal(calculateOpcodeSkillPointBudget('sum', form.baseStats).budget, 53)

  assert.equal(calculateOpcodeSpecializationRollBonus(0), 0)
  assert.equal(calculateOpcodeSpecializationRollBonus(1), 2)
  assert.equal(calculateOpcodeSpecializationRollBonus(2), 4)
  assert.equal(calculateOpcodeSpecializationRollBonus(4), 8)
})

test('formats stun and death saves from WIL, BOD, and Fortitude', () => {
  assert.equal(formatOpcodeSaveRoll(5, 0), '1D10+5+0')
  assert.equal(formatOpcodeSaveRoll(7, 3), '1D10+7+3')

  const bonus = readOpcodeFortitudeBonus([
    {
      name: 'consitution',
      value: 2,
      specializations: [{ name: 'Fortitude', value: 1 }],
    },
  ])
  assert.equal(bonus, 3)

  const summary = readOpcodeSheetSummary(
    buildCreateCharacterSheetDto(validForm()).stats,
    buildCreateCharacterSheetDto(validForm()).status,
  )
  assert.equal(summary.fortitudeBonus, 0)
  assert.equal(formatOpcodeSaveRoll(summary.baseStats.wil, summary.fortitudeBonus), '1D10+5+0')
  assert.equal(formatOpcodeSaveRoll(summary.baseStats.bod, summary.fortitudeBonus), '1D10+5+0')
})

test('defaults new sheets to five in every attribute and tracks spent points', () => {
  const form = createOpcodeSheetForm()
  assert.equal(OPCODE_DEFAULT_STAT, 5)
  for (const key of ['ref', 'int', 'wil', 'chr', 'bod', 'luk'])
    assert.equal(form.baseStats[key], '5')

  assert.equal(calculateOpcodeAttributePointsUsed(form.baseStats), 30)

  form.baseStats.ref = '7'
  form.baseStats.bod = '6'
  form.skills[0].value = '3'
  form.skills[0].specializations = [{ id: 'spec-a', name: 'A', value: '2' }]
  assert.equal(calculateOpcodeAttributePointsUsed(form.baseStats), 33)
  assert.equal(calculateOpcodeSkillPointsUsed(form.skills), 5)
})

test('persists skill point mode and allows specializations above their parent skill rank', () => {
  const form = validForm()
  form.skillPointMode = 'sum'
  form.skills = [{
    id: 'skill-calm',
    name: 'calm',
    value: '2',
    stats: ['wil'],
    specializations: [{ id: 'spec-a', name: 'A', value: '4' }],
  }]
  assert.equal(parseOpcodeSkillLevel('2'), 2)
  assert.equal(validateOpcodeSheetForm(form)['skills.0.specializations.0.value'], undefined)

  const dto = buildCreateCharacterSheetDto(form)
  assert.equal(dto.stats.rules.optionals.skill_point_mode, 'sum')
  assert.equal(sheetToOpcodeForm({ ...dto, id: SHEET_ID, created_at: '', updated_at: '', created_by: USER_ID }).skillPointMode, 'sum')

  clampOpcodeSkillSpecializations(form.skills[0])
  assert.equal(form.skills[0].specializations[0].value, '4')
})

test('round-trips reactive skill trees and preserves branch metadata after renaming', () => {
  const original = {
    ...buildCreateCharacterSheetDto(validForm()),
    id: SHEET_ID,
    created_at: '',
    updated_at: '',
    created_by: USER_ID,
  }
  original.stats.skills = {
    base: {
      perception: {
        base: 3,
        mod: 2,
        stat: ['wil', 'int'],
        note: 'preserve skill metadata',
        specialization: {
          observation: { base: 2, mod: 1, note: 'preserve specialization metadata' },
          listening: { base: 1, mod: 0 },
        },
      },
    },
    extra: { custom: { base: 1, mod: 2 } },
    houseRules: { enabled: true },
  }
  const untouched = structuredClone(original)
  const reactiveSheet = reactive(original)
  const form = sheetToOpcodeForm(reactiveSheet)
  assert.equal(form.skills[0].specializations.length, 2)
  assert.deepEqual(form.skills[0].stats, ['wil', 'int'])
  const roundTrip = buildUpdateCharacterSheetDto(form, reactiveSheet).stats.skills
  assert.deepEqual(roundTrip.base.perception, original.stats.skills.base.perception)
  assert.deepEqual(roundTrip.extra, original.stats.skills.extra)
  assert.deepEqual(roundTrip.houseRules, original.stats.skills.houseRules)
  assert.equal(Object.keys(roundTrip.base).length, 22)

  form.skills[0].name = 'awareness'
  form.skills[0].value = '4'
  form.skills[0].specializations[0].name = 'tracking'
  form.skills[0].specializations[0].value = '5'
  const updated = buildUpdateCharacterSheetDto(form, reactiveSheet)
  assert.equal(updated.stats.skills.base.perception, undefined)
  assert.deepEqual(updated.stats.skills.base.awareness, {
    ...original.stats.skills.base.perception,
    base: 4,
    specialization: {
      tracking: { base: 5, mod: 1, note: 'preserve specialization metadata' },
      listening: { base: 1, mod: 0 },
    },
  })
  const summary = readOpcodeSheetSummary(updated.stats, updated.status)
  assert.deepEqual(summary.skills[0].stats, ['wil', 'int'])
  assert.deepEqual(summary.skills[0].specializations, [
    { name: 'tracking', value: 5, rollBonus: 10 },
    { name: 'listening', value: 1, rollBonus: 2 },
  ])
  assert.deepEqual(original, untouched)
})

test('creates, validates, and removes specialization branches without affecting siblings', () => {
  const form = validForm()
  form.skills = [{ id: 'skill', name: 'medical', value: '3', stats: ['wil'], specializations: [
    { id: 'first', name: 'first aid', value: '2' },
    { id: 'second', name: 'diagnosis', value: '1' },
  ] }]
  const created = buildCreateCharacterSheetDto(form)
  assert.deepEqual(created.stats.skills.base.medical.specialization['first aid'], { base: 2, mod: 0 })
  form.skills[0].specializations[1].name = 'first aid'
  form.skills[0].specializations[1].value = '1.5'
  assert.equal(validateOpcodeSheetForm(form)['skills.0.specializations.1.name'], 'characterSheets.validation.duplicateSkill')
  assert.equal(validateOpcodeSheetForm(form)['skills.0.specializations.1.value'], 'characterSheets.validation.safeInteger')
  assert.throws(() => buildCreateCharacterSheetDto(form))
  const edit = sheetToOpcodeForm(created)
  edit.skills.find(skill => skill.name === 'medical').specializations.splice(0, 1)
  assert.deepEqual(buildUpdateCharacterSheetDto(edit, created).stats.skills.base.medical.specialization, {
    diagnosis: { base: 1, mod: 0 },
  })
})

test('restores the documented base skill list without copying example bonuses', () => {
  const fresh = validForm()
  assert.equal(fresh.skills.length, 22)
  assert.deepEqual(fresh.skills.find(skill => skill.name === 'medical').stats, ['wil'])
  assert.deepEqual(fresh.skills.find(skill => skill.name === 'operate').stats, ['ref', 'int'])
  assert.ok(fresh.skills.every(skill => skill.value === '0' && skill.trained === false))
  const created = buildCreateCharacterSheetDto(fresh)
  assert.equal(created.stats.skills.base.charm.mod, 0)
  created.status.skills = { base: { charm: { mod: 10 } }, extra: { magic: { mod: 2 } } }
  created.stats.skills.base.charm.trained = true
  delete created.stats.skills.base.medical
  const edit = sheetToOpcodeForm(created)
  assert.equal(edit.skills.length, 22)
  assert.equal(edit.skills.find(skill => skill.name === 'medical').value, '0')
  assert.equal(edit.skills.find(skill => skill.name === 'charm').trained, true)
  edit.skills.find(skill => skill.name === 'medical').trained = true
  const updated = buildUpdateCharacterSheetDto(edit, created)
  assert.equal(updated.stats.skills.base.medical.trained, true)
  assert.equal(updated.stats.skills.base.charm.trained, true)
  assert.deepEqual(updated.status.skills, created.status.skills)
})
