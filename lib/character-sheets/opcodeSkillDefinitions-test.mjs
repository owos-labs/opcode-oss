import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findOpcodeSpecializationPreset,
  groupOpcodeSkillRows,
  OPCODE_SKILL_DEFINITIONS,
  OPCODE_SKILL_GROUPS,
  OPCODE_SKILL_GROUP_ORDER,
  OPCODE_SPECIALIZATION_PRESETS,
  resolveOpcodeSkillGroupKey,
} from './opcodeSkillDefinitions.ts'

test('exposes documented specialization examples as canonical presets', () => {
  assert.deepEqual(
    OPCODE_SPECIALIZATION_PRESETS.perception.map(preset => preset.name),
    ['Observation', 'Listening', 'Smell', 'Low-Light Perception', 'Composure', 'Recall / Memory', 'Meditation'],
  )
  assert.deepEqual(
    OPCODE_SPECIALIZATION_PRESETS.operate.map(preset => preset.name),
    ['Computers', 'Industrial Machinery', 'Heavy Vehicles', 'Tactical Driving', 'Rotary Wing Aircraft', 'Fixed Wing Aircraft', 'Specialized Vehicles'],
  )
  assert.equal(findOpcodeSpecializationPreset('medical', ' first aid ')?.key, 'firstAid')

  for (const [skillName, presets] of Object.entries(OPCODE_SPECIALIZATION_PRESETS)) {
    assert.ok(OPCODE_SKILL_DEFINITIONS[skillName], `${skillName} must be a defined skill`)
    assert.equal(new Set(presets.map(preset => preset.key)).size, presets.length)
    assert.equal(new Set(presets.map(preset => preset.name)).size, presets.length)
  }
})

test('groups every Opcode skill into one category card bucket', () => {
  const groupedSkills = OPCODE_SKILL_GROUP_ORDER.flatMap(key => OPCODE_SKILL_GROUPS[key])
  assert.equal(groupedSkills.length, Object.keys(OPCODE_SKILL_DEFINITIONS).length)
  assert.equal(new Set(groupedSkills).size, groupedSkills.length)

  for (const skillName of Object.keys(OPCODE_SKILL_DEFINITIONS))
    assert.notEqual(resolveOpcodeSkillGroupKey(skillName), 'custom')

  const grouped = groupOpcodeSkillRows(Object.keys(OPCODE_SKILL_DEFINITIONS).map((name, index) => ({
    id: `skill-${name}`,
    name,
    value: '0',
    index,
  })))
  assert.equal(grouped.length, OPCODE_SKILL_GROUP_ORDER.length)
  assert.deepEqual(grouped.map(group => group.key), [...OPCODE_SKILL_GROUP_ORDER])

  const custom = groupOpcodeSkillRows([{ id: 'custom-1', name: 'alchemy', value: '1' }])
  assert.deepEqual(custom.map(group => group.key), ['custom'])
})
