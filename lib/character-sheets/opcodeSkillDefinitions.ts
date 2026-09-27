import type { OpcodeStatKey } from './characterSheet.types'

export interface OpcodeSpecializationPreset {
  key: string
  name: string
}

// Skill keys and attributes follow backend-middle/docs/stats.json.
// Keep stored keys (including legacy spellings) stable; localize display labels.
export const OPCODE_SKILL_GROUP_ORDER = [
  'general',
  'social',
  'technical',
  'combat',
  'physical',
] as const

export type OpcodeSkillGroupKey = typeof OPCODE_SKILL_GROUP_ORDER[number] | 'custom'

export const OPCODE_SKILL_GROUPS: Record<typeof OPCODE_SKILL_GROUP_ORDER[number], readonly string[]> = {
  general: ['perception', 'survival', 'knowledge', 'medical', 'calm'],
  social: ['social', 'charm', 'disguise', 'camoflauge'],
  technical: ['operate', 'library', 'recon', 'manufacture'],
  combat: ['marksmanship', 'martial', 'projectile', 'melee'],
  physical: ['athelete', 'acrobat', 'consitution', 'swim', 'push'],
}

const OPCODE_SKILL_TO_GROUP = new Map<string, OpcodeSkillGroupKey>(
  OPCODE_SKILL_GROUP_ORDER.flatMap(groupKey =>
    OPCODE_SKILL_GROUPS[groupKey].map(skillName => [skillName, groupKey]),
  ),
)

export function resolveOpcodeSkillGroupKey(skillName: string): OpcodeSkillGroupKey {
  return OPCODE_SKILL_TO_GROUP.get(skillName) ?? 'custom'
}

export interface GroupedOpcodeSkillRow<T extends { name: string }> {
  key: OpcodeSkillGroupKey
  items: Array<{ skill: T, index: number }>
}

export function groupOpcodeSkillRows<T extends { name: string }>(rows: T[]): GroupedOpcodeSkillRow<T>[] {
  const order: OpcodeSkillGroupKey[] = [...OPCODE_SKILL_GROUP_ORDER, 'custom']
  const buckets = new Map<OpcodeSkillGroupKey, Array<{ skill: T, index: number }>>(
    order.map(key => [key, []]),
  )

  rows.forEach((skill, index) => {
    buckets.get(resolveOpcodeSkillGroupKey(skill.name))!.push({ skill, index })
  })

  return order
    .map(key => ({ key, items: buckets.get(key)! }))
    .filter(group => group.items.length > 0)
}

export const OPCODE_SKILL_DEFINITIONS: Record<string, OpcodeStatKey[]> = {
  perception: ['wil'],
  survival: ['wil'],
  knowledge: ['int'],
  medical: ['wil'],
  calm: ['wil', 'bod'],
  social: ['chr', 'int'],
  charm: ['chr', 'wil', 'bod'],
  disguise: ['chr', 'wil'],
  camoflauge: ['int', 'wil', 'ref'],
  operate: ['ref', 'int'],
  library: ['int', 'wil'],
  recon: ['int'],
  manufacture: ['int'],
  marksmanship: ['ref'],
  athelete: ['ref'],
  acrobat: ['ref'],
  consitution: ['bod', 'wil'],
  martial: ['ref', 'bod'],
  projectile: ['ref'],
  swim: ['ref', 'bod'],
  melee: ['bod'],
  push: ['bod'],
}

export const OPCODE_SPECIALIZATION_PRESETS: Record<string, OpcodeSpecializationPreset[]> = {
  perception: [
    { key: 'observation', name: 'Observation' },
    { key: 'listening', name: 'Listening' },
    { key: 'smell', name: 'Smell' },
    { key: 'lowLightPerception', name: 'Low-Light Perception' },
    { key: 'composure', name: 'Composure' },
    { key: 'recallMemory', name: 'Recall / Memory' },
    { key: 'meditation', name: 'Meditation' },
  ],
  survival: [
    { key: 'urbanSurvival', name: 'Urban Survival' },
    { key: 'wildernessSurvival', name: 'Wilderness Survival' },
    { key: 'humanTracking', name: 'Human Tracking' },
    { key: 'animalTracking', name: 'Animal Tracking' },
  ],
  knowledge: [
    { key: 'physics', name: 'Physics' },
    { key: 'chemistry', name: 'Chemistry' },
    { key: 'engineering', name: 'Engineering' },
    { key: 'languages', name: 'Languages' },
    { key: 'occultism', name: 'Occultism' },
    { key: 'magic', name: 'Magic' },
  ],
  medical: [
    { key: 'firstAid', name: 'First Aid' },
    { key: 'longTermAid', name: 'Long-Term Aid' },
    { key: 'diagnosis', name: 'Diagnosis' },
  ],
  social: [
    { key: 'negotiation', name: 'Negotiation' },
    { key: 'persuasion', name: 'Persuasion' },
    { key: 'specificTargetPersuasion', name: 'Persuasion: Specific Target Category' },
    { key: 'leadership', name: 'Leadership' },
  ],
  charm: [
    { key: 'oppositeGenderSocialising', name: 'Socialising with the Opposite Gender' },
    { key: 'sameGenderSocialising', name: 'Socialising with the Same Gender' },
    { key: 'speaking', name: 'Speaking' },
    { key: 'instigation', name: 'Instigation' },
    { key: 'performance', name: 'Performance' },
    { key: 'dance', name: 'Dance' },
  ],
  disguise: [
    { key: 'specificEnvironments', name: 'Specific Environments' },
  ],
  camoflauge: [
    { key: 'concealment', name: 'Concealment' },
    { key: 'camouflage', name: 'Camouflage' },
  ],
  operate: [
    { key: 'computers', name: 'Computers' },
    { key: 'industrialMachinery', name: 'Industrial Machinery' },
    { key: 'heavyVehicles', name: 'Heavy Vehicles' },
    { key: 'tacticalDriving', name: 'Tactical Driving' },
    { key: 'rotaryWingAircraft', name: 'Rotary Wing Aircraft' },
    { key: 'fixedWingAircraft', name: 'Fixed Wing Aircraft' },
    { key: 'specializedVehicles', name: 'Specialized Vehicles' },
  ],
  library: [
    { key: 'databases', name: 'Databases' },
    { key: 'libraries', name: 'Libraries' },
  ],
  recon: [
    { key: 'reconnaissance', name: 'Reconnaissance' },
    { key: 'readingPeople', name: 'Reading People' },
    { key: 'intelligenceGathering', name: 'Intelligence Gathering' },
    { key: 'search', name: 'Search' },
    { key: 'intelligenceAnalysis', name: 'Intelligence Analysis' },
    { key: 'cartography', name: 'Cartography' },
  ],
  manufacture: [
    { key: 'kineticWeapons', name: 'Kinetic Weapons' },
    { key: 'equipment', name: 'Equipment' },
    { key: 'props', name: 'Props' },
    { key: 'industrialDesign', name: 'Industrial Design' },
    { key: 'productDesign', name: 'Product Design' },
    { key: 'ergonomics', name: 'Ergonomics' },
  ],
  marksmanship: [
    { key: 'assaultRifles', name: 'Assault Rifles' },
    { key: 'submachineGuns', name: 'Submachine Guns' },
    { key: 'pistols', name: 'Pistols' },
    { key: 'carbines', name: 'Carbines' },
    { key: 'boltActionRifles', name: 'Bolt-Action Rifles' },
  ],
  athelete: [
    { key: 'running', name: 'Running' },
    { key: 'throwing', name: 'Throwing' },
    { key: 'jumping', name: 'Jumping' },
    { key: 'marathonRunning', name: 'Marathon Running' },
    { key: 'longDistanceCrossCountry', name: 'Long-Distance Cross-Country' },
    { key: 'climbing', name: 'Climbing' },
  ],
  acrobat: [
    { key: 'theft', name: 'Theft' },
    { key: 'lockpicking', name: 'Lockpicking' },
    { key: 'crafting', name: 'Crafting' },
    { key: 'jewellery', name: 'Jewellery' },
    { key: 'art', name: 'Art' },
    { key: 'sculpture', name: 'Sculpture' },
  ],
  consitution: [
    { key: 'fortitude', name: 'Fortitude' },
  ],
  projectile: [
    { key: 'crossbows', name: 'Crossbows' },
    { key: 'recurveBows', name: 'Recurve Bows' },
    { key: 'huntingBows', name: 'Hunting Bows' },
    { key: 'bowsAndArrows', name: 'Bows and Arrows' },
    { key: 'slingshots', name: 'Slingshots' },
    { key: 'throwingSpears', name: 'Throwing Spears' },
  ],
  swim: [
    { key: 'swimming', name: 'Swimming' },
    { key: 'diving', name: 'Diving' },
    { key: 'spaceNavigation', name: 'Space Navigation' },
  ],
  push: [
    { key: 'pulling', name: 'Pulling' },
    { key: 'lifting', name: 'Lifting' },
    { key: 'dragging', name: 'Dragging' },
  ],
}

export function findOpcodeSpecializationPreset(skillName: string, specializationName: string) {
  const normalizedName = specializationName.trim().toLocaleLowerCase()
  return OPCODE_SPECIALIZATION_PRESETS[skillName]
    ?.find(preset => preset.name.toLocaleLowerCase() === normalizedName)
}
