import type { OpcodeHealthPart } from './characterSheet.types'

export const OPCODE_INVENTORY_TYPED_KINDS = [
  'weapon',
  'ammo',
  'magazine',
  'throwable',
  'armor',
] as const

export type OpcodeInventoryItemType = typeof OPCODE_INVENTORY_TYPED_KINDS[number]
export type OpcodeInventoryItemKind = 'generic' | OpcodeInventoryItemType

export const OPCODE_INVENTORY_KINDS = [
  'generic',
  ...OPCODE_INVENTORY_TYPED_KINDS,
] as const

export const OPCODE_INVENTORY_LIST_KIND_ORDER = [
  'weapon',
  'magazine',
  'ammo',
  'throwable',
  'armor',
  'generic',
] as const

export const OPCODE_INVENTORY_KIND_ICONS: Record<OpcodeInventoryItemKind, string> = {
  generic: 'i-lucide:package',
  weapon: 'i-lucide:swords',
  ammo: 'i-lucide:circle-dot',
  magazine: 'i-lucide:cylinder',
  throwable: 'i-lucide:bomb',
  armor: 'i-lucide:shield',
}

export const OPCODE_WEAPON_TYPES = ['melee', 'ranged'] as const
export type OpcodeWeaponType = typeof OPCODE_WEAPON_TYPES[number]

export const OPCODE_AMMO_DAMAGE_KINDS = ['ball', 'buck', 'explosive'] as const
export type OpcodeAmmoDamageKind = typeof OPCODE_AMMO_DAMAGE_KINDS[number]

export const OPCODE_EXPLOSIVE_TYPES = ['he', 'frag', 'thermal'] as const
export type OpcodeExplosiveType = typeof OPCODE_EXPLOSIVE_TYPES[number]

export const OPCODE_WEAPON_FIRE_MODE_BITS = {
  semi: 1,
  auto: 2,
  burst: 4,
} as const

export const OPCODE_WEAPON_CONCEALABILITY = [0, 1, 2, 3, 4] as const
export const OPCODE_WEAPON_RELIABILITY = [0, 1, 2] as const

export const OPCODE_WEAPON_MODIFICATION_SLOTS = [
  'receiver',
  'attachment',
  'muzzle',
  'underbarrel',
  'sight',
  'stock',
  'barrel',
] as const

export type OpcodeWeaponModificationSlot = typeof OPCODE_WEAPON_MODIFICATION_SLOTS[number]

export const OPCODE_MOD_EFFECT_KINDS = ['mod', 'enable_slot'] as const
export type OpcodeModEffectKind = typeof OPCODE_MOD_EFFECT_KINDS[number]

export const OPCODE_MOD_EFFECT_TARGETS = [
  'diff',
  'range',
  'caliber',
  'accuracy',
  'concealability',
  'weight',
] as const
export type OpcodeModEffectTarget = typeof OPCODE_MOD_EFFECT_TARGETS[number]

export const OPCODE_MOD_RANGE_BANDS = {
  pointBlank: { min: 0, max: 0 },
  close: { min: 0, max: 0.5 },
  mid: { min: 0.5, max: 1 },
  long: { min: 1, max: 2 },
  extreme: { min: 2, max: null },
} as const

export type OpcodeModRangeBand = keyof typeof OPCODE_MOD_RANGE_BANDS
export const OPCODE_MOD_RANGE_BAND_ORDER = [
  'pointBlank',
  'close',
  'mid',
  'long',
  'extreme',
] as const

export const OPCODE_ARMOR_MATERIALS = ['uhmpe', 'metal', 'ceramic'] as const
export type OpcodeArmorMaterial = typeof OPCODE_ARMOR_MATERIALS[number]

export const OPCODE_ARMOR_COVERAGE_PRESETS = {
  none: [] as const,
  helmet: ['head'] as const,
  vest: ['torso'] as const,
  helmetVest: ['head', 'torso'] as const,
  limbs: ['hand_primary', 'hand_secondary', 'leg_left', 'leg_right'] as const,
  full: ['head', 'torso', 'hand_primary', 'hand_secondary', 'leg_left', 'leg_right'] as const,
} as const

export type OpcodeArmorCoveragePreset = keyof typeof OPCODE_ARMOR_COVERAGE_PRESETS

export type OpcodeModEffectSummary =
  | { kind: 'unknown' }
  | { kind: 'enable_slot', slot: string, count: string, max: string }
  | { kind: 'mod', target: string, amount: string, band: OpcodeModRangeBand | 'custom' | '' }

export const OPCODE_MAGAZINE_TOKEN_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

export interface OpcodeWeaponSkillSpecializationWire {
  mul?: unknown
  [key: string]: unknown
}

export interface OpcodeWeaponSkillWire {
  mul?: unknown
  specialization?: Record<string, OpcodeWeaponSkillSpecializationWire>
  [key: string]: unknown
}

export interface OpcodeWeaponModificationWire {
  name?: unknown
  description?: unknown
  effects?: unknown
  [key: string]: unknown
}

export type OpcodeWeaponModificationsWire = Record<string, unknown>

export interface OpcodeWeaponWire {
  type?: unknown
  skill?: Record<string, OpcodeWeaponSkillWire>
  range?: unknown
  caliber?: unknown
  accuracy?: unknown
  concealability?: unknown
  rof?: unknown
  mode?: unknown
  reliability?: unknown
  weight?: unknown
  damage?: unknown
  modifications?: OpcodeWeaponModificationsWire
  [key: string]: unknown
}

export interface OpcodeAmmoBallWire {
  damage?: unknown
  [key: string]: unknown
}

export interface OpcodeAmmoBuckWire {
  projectile_count?: unknown
  damage?: unknown
  [key: string]: unknown
}

export interface OpcodeExplosiveWire {
  type?: unknown
  damage?: unknown
  lethal?: unknown
  wound?: unknown
  persistance?: unknown
  fuse?: unknown
  [key: string]: unknown
}

export interface OpcodeAmmoWire {
  caliber?: unknown
  damage?: unknown
  penetration?: unknown
  ball?: OpcodeAmmoBallWire
  buck?: OpcodeAmmoBuckWire
  explosive?: Record<string, OpcodeExplosiveWire>
  [key: string]: unknown
}

export interface OpcodeMagazineAmmoWire {
  kinds?: unknown
  contains_max?: unknown
  loaded?: unknown
  [key: string]: unknown
}

export interface OpcodeMagazineWire {
  caliber?: unknown
  ammo?: OpcodeMagazineAmmoWire
  [key: string]: unknown
}

export interface OpcodeArmorProtectionWire {
  normal?: unknown
  [key: string]: unknown
}

export interface OpcodeArmorWire {
  material?: unknown
  layer?: unknown
  protection?: OpcodeArmorProtectionWire
  [key: string]: unknown
}

export interface OpcodeInventoryItemWire {
  id?: unknown
  name?: unknown
  type?: unknown
  count?: unknown
  desc?: unknown
  skill?: unknown
  weapon?: OpcodeWeaponWire
  ammo?: OpcodeAmmoWire
  magazine?: OpcodeMagazineWire
  armor?: OpcodeArmorWire
  [key: string]: unknown
}

export interface OpcodeWeaponSkillSpecializationDraft {
  name: string
  mul: string
}

export interface OpcodeWeaponSkillDraft {
  name: string
  mul: string
  specializations: OpcodeWeaponSkillSpecializationDraft[]
}

export interface OpcodeModEffectDraft {
  key: string
  kind: OpcodeModEffectKind | 'unknown'
  slot: string
  count: string
  max: string
  target: OpcodeModEffectTarget | ''
  flat: string
  level: string
  rangeMin: string
  rangeMax: string
  concealMax: string
  note: string
  source: Record<string, unknown>
}

export interface OpcodeWeaponModificationDraft {
  id: string
  slot: string
  name: string
  description: string
  effects: OpcodeModEffectDraft[]
  source: Record<string, unknown>
}

export interface OpcodeWeaponDraft {
  type: OpcodeWeaponType | ''
  skills: OpcodeWeaponSkillDraft[]
  range: string
  caliber: string
  accuracy: string
  concealability: string
  rof: string
  mode: string
  reliability: string
  weight: string
  damage: Record<string, unknown>
  magazineId: string
  modifications: OpcodeWeaponModificationDraft[]
}

export interface OpcodeExplosiveDraft {
  id: string
  type: string
  damage: Record<string, unknown>
  lethal: string
  wound: string
  persistance: string
  fuse: string
  source: Record<string, unknown>
}

export interface OpcodeAmmoDraft {
  caliber: string
  damage: OpcodeAmmoDamageKind | ''
  penetration: string
  projectileCount: string
  ballDamage: Record<string, unknown>
  buckDamage: Record<string, unknown>
  explosives: OpcodeExplosiveDraft[]
}

export interface OpcodeMagazineDraft {
  caliber: string
  containsMax: string
  kinds: Record<string, string>
  loaded: string
}

export interface OpcodeArmorDraft {
  material: string
  layer: string
  protection: Record<OpcodeHealthPart, string>
}

export interface OpcodeInventoryDraft {
  clientKey: string
  id: string
  kind: OpcodeInventoryItemKind
  name: string
  count: string
  weight: string
  desc: string
  source: Record<string, unknown>
  weapon?: OpcodeWeaponDraft
  ammo?: OpcodeAmmoDraft
  magazine?: OpcodeMagazineDraft
  armor?: OpcodeArmorDraft
}

export interface OpcodeInventoryReference {
  itemId: string
  itemName: string
  kind: OpcodeInventoryItemKind
  path: string
}

export interface OpcodeInventoryIndex {
  byId: Map<string, OpcodeInventoryDraft>
  ammoByCaliber: Map<string, OpcodeInventoryDraft[]>
  magazinesByCaliber: Map<string, OpcodeInventoryDraft[]>
  modificationIds: Set<string>
}

export interface OpcodeMagazineRound {
  token: string
  ammoId: string
  ammoName: string
  index: number
}

export interface OpcodeMagazineRoundGroup extends OpcodeMagazineRound {
  count: number
}

export interface OpcodeInventoryMutationResult {
  ok: boolean
  drafts: OpcodeInventoryDraft[]
  error?: string
}
