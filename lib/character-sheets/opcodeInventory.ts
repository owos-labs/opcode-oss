import type { OpcodeHealthPart } from './characterSheet.types'
import {
  OPCODE_AMMO_DAMAGE_KINDS,
  OPCODE_ARMOR_COVERAGE_PRESETS,
  OPCODE_ARMOR_MATERIALS,
  OPCODE_INVENTORY_LIST_KIND_ORDER,
  OPCODE_INVENTORY_TYPED_KINDS,
  OPCODE_MAGAZINE_TOKEN_ALPHABET,
  OPCODE_MOD_EFFECT_TARGETS,
  OPCODE_MOD_RANGE_BANDS,
  OPCODE_WEAPON_CONCEALABILITY,
  OPCODE_WEAPON_FIRE_MODE_BITS,
  OPCODE_WEAPON_MODIFICATION_SLOTS,
  OPCODE_WEAPON_RELIABILITY,
  OPCODE_WEAPON_TYPES,
  type OpcodeAmmoDamageKind,
  type OpcodeAmmoDraft,
  type OpcodeArmorCoveragePreset,
  type OpcodeArmorDraft,
  type OpcodeExplosiveDraft,
  type OpcodeInventoryDraft,
  type OpcodeInventoryIndex,
  type OpcodeInventoryItemKind,
  type OpcodeInventoryItemType,
  type OpcodeInventoryItemWire,
  type OpcodeInventoryMutationResult,
  type OpcodeInventoryReference,
  type OpcodeMagazineDraft,
  type OpcodeMagazineRound,
  type OpcodeMagazineRoundGroup,
  type OpcodeModEffectDraft,
  type OpcodeModEffectKind,
  type OpcodeModEffectSummary,
  type OpcodeModRangeBand,
  type OpcodeWeaponDraft,
  type OpcodeWeaponModificationDraft,
  type OpcodeWeaponSkillDraft,
  type OpcodeWeaponType,
} from './opcodeInventory.types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEALTH_PARTS: OpcodeHealthPart[] = [
  'head',
  'torso',
  'hand_primary',
  'hand_secondary',
  'leg_left',
  'leg_right',
]

function isInventoryId(value: unknown): boolean {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

const REQUIRED_KEY = 'characterSheets.inventory.validation.required'
const SAFE_INTEGER_KEY = 'characterSheets.inventory.validation.safeInteger'
const NON_NEGATIVE_KEY = 'characterSheets.inventory.validation.nonNegative'
const POSITIVE_KEY = 'characterSheets.inventory.validation.positive'
const INVALID_UUID_KEY = 'characterSheets.inventory.validation.invalidId'
const DUPLICATE_ID_KEY = 'characterSheets.inventory.validation.duplicateId'
const DUPLICATE_MOD_KEY = 'characterSheets.inventory.validation.duplicateModification'
const INVALID_TYPE_KEY = 'characterSheets.inventory.validation.invalidType'
const MISSING_BLOCK_KEY = 'characterSheets.inventory.validation.missingBlock'
const MAGAZINE_COUNT_KEY = 'characterSheets.inventory.validation.magazineCount'
const CALIBER_KEY = 'characterSheets.inventory.validation.caliber'
const DISCRIMINATOR_KEY = 'characterSheets.inventory.validation.damageKind'
const BRANCH_KEY = 'characterSheets.inventory.validation.damageBranch'
const PROJECTILE_KEY = 'characterSheets.inventory.validation.projectileCount'
const TOKEN_KEY = 'characterSheets.inventory.validation.token'
const TOKEN_AMMO_KEY = 'characterSheets.inventory.validation.tokenAmmo'
const LOADED_TOKEN_KEY = 'characterSheets.inventory.validation.loadedToken'
const CAPACITY_KEY = 'characterSheets.inventory.validation.capacity'
const TOKEN_REASSIGN_KEY = 'characterSheets.inventory.validation.tokenReassigned'
const MAGAZINE_REF_KEY = 'characterSheets.inventory.validation.magazineReference'
const MAGAZINE_CALIBER_KEY = 'characterSheets.inventory.validation.magazineCaliber'
const BODY_PART_KEY = 'characterSheets.inventory.validation.bodyPart'
const WEAPON_TYPE_KEY = 'characterSheets.inventory.validation.weaponType'
const CONCEALABILITY_KEY = 'characterSheets.inventory.validation.concealability'
const RELIABILITY_KEY = 'characterSheets.inventory.validation.reliability'
const FINITE_KEY = 'characterSheets.inventory.validation.finite'
const OPAQUE_DAMAGE_KEY = 'characterSheets.inventory.validation.opaqueDamage'
const EXPLOSIVE_KEY = 'characterSheets.inventory.validation.explosive'
const LOAD_CALIBER_KEY = 'characterSheets.inventory.validation.loadCaliber'
const LOAD_AMMO_COUNT_KEY = 'characterSheets.inventory.validation.loadAmmoCount'
const LOAD_CAPACITY_KEY = 'characterSheets.inventory.validation.loadCapacity'
const LOAD_TOKEN_KEY = 'characterSheets.inventory.validation.loadToken'
const UNLOAD_INDEX_KEY = 'characterSheets.inventory.validation.unloadIndex'
const WEAPON_MAGAZINE_KEY = 'characterSheets.inventory.validation.weaponMagazine'

export function readOpcodeInventory(status: unknown): OpcodeInventoryDraft[] {
  const inventory = asRecord(status).inventory
  if (!Array.isArray(inventory))
    return []

  return inventory
    .filter(isPlainObject)
    .map(item => readInventoryDraft(item as OpcodeInventoryItemWire))
}

export function createOpcodeInventoryDraft(kind: OpcodeInventoryItemKind): OpcodeInventoryDraft {
  const id = crypto.randomUUID()
  const draft: OpcodeInventoryDraft = {
    clientKey: crypto.randomUUID(),
    id,
    kind,
    name: '',
    count: '1',
    weight: '0',
    desc: '',
    source: {},
  }

  if (kind === 'weapon')
    draft.weapon = createWeaponDraft()
  else if (kind === 'ammo')
    draft.ammo = createAmmoDraft('ball')
  else if (kind === 'magazine')
    draft.magazine = createMagazineDraft()
  else if (kind === 'throwable')
    draft.ammo = createAmmoDraft('explosive')
  else if (kind === 'armor')
    draft.armor = createArmorDraft()

  return draft
}

export function cloneOpcodeInventoryDraft(draft: OpcodeInventoryDraft): OpcodeInventoryDraft {
  return cloneJson(draft)
}

export function cloneOpcodeInventoryDrafts(drafts: OpcodeInventoryDraft[]): OpcodeInventoryDraft[] {
  return cloneJson(drafts)
}

export function retainOpcodeInventoryClientKeys(
  next: OpcodeInventoryDraft[],
  previous: OpcodeInventoryDraft[],
): OpcodeInventoryDraft[] {
  const byId = new Map(previous.map(item => [item.id, item.clientKey]))
  for (const draft of next) {
    const kept = byId.get(draft.id)
    if (kept)
      draft.clientKey = kept
  }
  return next
}

export function writeOpcodeInventory(drafts: OpcodeInventoryDraft[]): Record<string, unknown>[] {
  return drafts.map(writeInventoryItem)
}

export function buildOpcodeInventoryStatus(
  originalStatus: Record<string, unknown>,
  drafts: OpcodeInventoryDraft[],
): Record<string, unknown> {
  const status = cloneRecord(originalStatus)
  status.inventory = writeOpcodeInventory(drafts)
  return status
}

export function indexOpcodeInventory(drafts: OpcodeInventoryDraft[]): OpcodeInventoryIndex {
  const byId = new Map<string, OpcodeInventoryDraft>()
  const ammoByCaliber = new Map<string, OpcodeInventoryDraft[]>()
  const magazinesByCaliber = new Map<string, OpcodeInventoryDraft[]>()
  const modificationIds = new Set<string>()

  for (const draft of drafts) {
    if (draft.id)
      byId.set(draft.id, draft)

    if (draft.kind === 'ammo') {
      const caliber = draft.ammo?.caliber.trim() || ''
      if (caliber)
        pushIndex(ammoByCaliber, caliber, draft)
    }

    if (draft.kind === 'magazine') {
      const caliber = draft.magazine?.caliber.trim() || ''
      if (caliber)
        pushIndex(magazinesByCaliber, caliber, draft)
    }

    for (const modification of draft.weapon?.modifications || []) {
      if (modification.id)
        modificationIds.add(modification.id)
    }
  }

  return { byId, ammoByCaliber, magazinesByCaliber, modificationIds }
}

export function collectOpcodeInventoryReferences(
  drafts: OpcodeInventoryDraft[],
  itemId: string,
): OpcodeInventoryReference[] {
  const references: OpcodeInventoryReference[] = []

  drafts.forEach((draft, index) => {
    if (draft.kind === 'magazine') {
      const kinds = draft.magazine?.kinds || {}
      const tokens = Object.entries(kinds)
        .filter(([, ammoId]) => ammoId === itemId)
        .map(([token]) => token)
      if (tokens.length) {
        references.push({
          itemId: draft.id,
          itemName: draft.name.trim() || draft.id,
          kind: 'magazine',
          path: `inventory.${index}.magazine.ammo.kinds`,
        })
      }
    }

    if (draft.kind === 'weapon' && draft.weapon?.magazineId === itemId) {
      references.push({
        itemId: draft.id,
        itemName: draft.name.trim() || draft.id,
        kind: 'weapon',
        path: `inventory.${index}.weapon.magazine`,
      })
    }
  })

  return references
}

export function validateOpcodeInventoryDrafts(drafts: OpcodeInventoryDraft[]): Record<string, string> {
  const errors: Record<string, string> = {}
  const seenIds = new Map<string, number>()
  const seenModIds = new Map<string, string>()

  drafts.forEach((draft, index) => {
    const prefix = `inventory.${index}`
    validateCommonEnvelope(draft, prefix, errors)

    const previousIndex = seenIds.get(draft.id)
    if (draft.id && isInventoryId(draft.id) && previousIndex !== undefined)
      errors[`${prefix}.id`] = DUPLICATE_ID_KEY
    else if (draft.id)
      seenIds.set(draft.id, index)

    if (draft.kind === 'weapon')
      validateWeapon(draft, prefix, errors, seenModIds)
    else if (draft.kind === 'ammo')
      validateAmmo(draft, prefix, errors, false)
    else if (draft.kind === 'magazine')
      validateMagazineLocal(draft, prefix, errors)
    else if (draft.kind === 'throwable')
      validateAmmo(draft, prefix, errors, true)
    else if (draft.kind === 'armor')
      validateArmor(draft, prefix, errors)
  })

  validateCrossReferences(drafts, errors)
  return errors
}

export function fillMagazine(
  inventory: OpcodeInventoryDraft[],
  magazineId: string,
  ammoId: string,
): OpcodeInventoryMutationResult {
  const ammo = inventory.find(item => item.id === ammoId && item.kind === 'ammo')
  const count = ammo ? parseSafeInteger(ammo.count) : null
  if (!ammo?.ammo || count === null || count < 1)
    return { ok: false, drafts: inventory, error: LOAD_AMMO_COUNT_KEY }
  return loadMagazineRounds(inventory, magazineId, ammoId, count)
}

// ponytail: preset rows are 1 round, so a new or empty stack is raised to the free slots. Tracked stacks stay as counted.
export function roundsForPresetLoad(have: number, free: number, created: boolean): number {
  const owned = Number.isFinite(have) ? Math.max(0, Math.trunc(have)) : 0
  const slots = Number.isFinite(free) ? Math.max(0, Math.trunc(free)) : 0
  if (slots < 1)
    return owned
  if (created || owned < 1)
    return Math.max(owned, slots)
  return owned
}

export function loadMagazineRound(
  inventory: OpcodeInventoryDraft[],
  magazineId: string,
  ammoId: string,
): OpcodeInventoryMutationResult {
  return loadMagazineRounds(inventory, magazineId, ammoId, 1)
}

export function loadMagazineRounds(
  inventory: OpcodeInventoryDraft[],
  magazineId: string,
  ammoId: string,
  count: number,
): OpcodeInventoryMutationResult {
  const requested = Number.isInteger(count) ? count : NaN
  if (!Number.isInteger(requested) || requested < 1)
    return { ok: false, drafts: inventory, error: LOAD_AMMO_COUNT_KEY }

  const drafts = cloneOpcodeInventoryDrafts(inventory)
  const magazine = drafts.find(item => item.id === magazineId && item.kind === 'magazine')
  const ammo = drafts.find(item => item.id === ammoId && item.kind === 'ammo')
  if (!magazine?.magazine || !ammo?.ammo)
    return { ok: false, drafts: inventory, error: MAGAZINE_REF_KEY }

  if (!sameCaliber(magazine.magazine.caliber, ammo.ammo.caliber))
    return { ok: false, drafts: inventory, error: LOAD_CALIBER_KEY }

  const ammoCount = parseSafeInteger(ammo.count)
  if (ammoCount === null || ammoCount < 1)
    return { ok: false, drafts: inventory, error: LOAD_AMMO_COUNT_KEY }

  const capacity = parseSafeInteger(magazine.magazine.containsMax)
  const free = capacity === null ? 0 : capacity - magazine.magazine.loaded.length
  if (capacity === null || capacity < 1 || free < 1)
    return { ok: false, drafts: inventory, error: LOAD_CAPACITY_KEY }

  const existingToken = Object.entries(magazine.magazine.kinds).find(([, id]) => id === ammoId)?.[0]
  const token = existingToken || nextAvailableToken(magazine.magazine.kinds)
  if (!token)
    return { ok: false, drafts: inventory, error: LOAD_TOKEN_KEY }

  const loaded = Math.min(requested, ammoCount, free)
  magazine.magazine.kinds[token] = ammoId
  magazine.magazine.loaded += token.repeat(loaded)
  ammo.count = String(ammoCount - loaded)
  return { ok: true, drafts }
}

export function unloadMagazineRound(
  inventory: OpcodeInventoryDraft[],
  magazineId: string,
  loadedIndex: number,
): OpcodeInventoryMutationResult {
  const drafts = cloneOpcodeInventoryDrafts(inventory)
  const magazine = drafts.find(item => item.id === magazineId && item.kind === 'magazine')
  if (!magazine?.magazine)
    return { ok: false, drafts: inventory, error: MAGAZINE_REF_KEY }

  const loaded = magazine.magazine.loaded
  if (loadedIndex < 0 || loadedIndex >= loaded.length)
    return { ok: false, drafts: inventory, error: UNLOAD_INDEX_KEY }

  const token = loaded[loadedIndex]
  if (!token)
    return { ok: false, drafts: inventory, error: UNLOAD_INDEX_KEY }

  const ammoId = magazine.magazine.kinds[token]
  const ammo = drafts.find(item => item.id === ammoId && item.kind === 'ammo')
  magazine.magazine.loaded = loaded.slice(0, loadedIndex) + loaded.slice(loadedIndex + 1)

  if (ammo) {
    const ammoCount = parseSafeInteger(ammo.count) ?? 0
    ammo.count = String(ammoCount + 1)
  }

  if (!magazine.magazine.loaded.includes(token))
    delete magazine.magazine.kinds[token]

  return { ok: true, drafts }
}

export function unloadMagazineRounds(
  inventory: OpcodeInventoryDraft[],
  magazineId: string,
  loadedIndex: number,
  count: number,
): OpcodeInventoryMutationResult {
  const requested = Number.isInteger(count) ? count : NaN
  if (!Number.isInteger(requested) || requested < 1)
    return { ok: false, drafts: inventory, error: UNLOAD_INDEX_KEY }

  const drafts = cloneOpcodeInventoryDrafts(inventory)
  const magazine = drafts.find(item => item.id === magazineId && item.kind === 'magazine')
  if (!magazine?.magazine)
    return { ok: false, drafts: inventory, error: MAGAZINE_REF_KEY }

  const loaded = magazine.magazine.loaded
  if (loadedIndex < 0 || loadedIndex >= loaded.length || loadedIndex + requested > loaded.length)
    return { ok: false, drafts: inventory, error: UNLOAD_INDEX_KEY }

  const removed = loaded.slice(loadedIndex, loadedIndex + requested)
  magazine.magazine.loaded = loaded.slice(0, loadedIndex) + loaded.slice(loadedIndex + requested)

  const returned = new Map<string, number>()
  for (const token of removed) {
    const ammoId = magazine.magazine.kinds[token]
    if (!ammoId)
      continue
    returned.set(ammoId, (returned.get(ammoId) || 0) + 1)
  }

  for (const token of new Set(removed)) {
    if (!magazine.magazine.loaded.includes(token))
      delete magazine.magazine.kinds[token]
  }

  for (const [ammoId, amount] of returned) {
    const ammo = drafts.find(item => item.id === ammoId && item.kind === 'ammo')
    if (!ammo)
      continue
    ammo.count = String((parseSafeInteger(ammo.count) ?? 0) + amount)
  }

  return { ok: true, drafts }
}

export function emptyMagazine(
  inventory: OpcodeInventoryDraft[],
  magazineId: string,
): OpcodeInventoryMutationResult {
  const magazine = inventory.find(item => item.id === magazineId && item.kind === 'magazine')
  if (!magazine?.magazine)
    return { ok: false, drafts: inventory, error: MAGAZINE_REF_KEY }
  if (!magazine.magazine.loaded)
    return { ok: true, drafts: inventory }
  return unloadMagazineRounds(inventory, magazineId, 0, magazine.magazine.loaded.length)
}

export function readOpcodeWeaponFireModes(mode: string): Array<'semi' | 'auto' | 'burst'> {
  const value = Number(mode) || 0
  const modes: Array<'semi' | 'auto' | 'burst'> = []
  if ((value & OPCODE_WEAPON_FIRE_MODE_BITS.semi) === OPCODE_WEAPON_FIRE_MODE_BITS.semi)
    modes.push('semi')
  if ((value & OPCODE_WEAPON_FIRE_MODE_BITS.auto) === OPCODE_WEAPON_FIRE_MODE_BITS.auto)
    modes.push('auto')
  if ((value & OPCODE_WEAPON_FIRE_MODE_BITS.burst) === OPCODE_WEAPON_FIRE_MODE_BITS.burst)
    modes.push('burst')
  return modes
}

export function readNextMagazineRound(
  drafts: OpcodeInventoryDraft[],
  magazineId: string,
): OpcodeMagazineRound | null {
  const magazine = drafts.find(item => item.id === magazineId && item.kind === 'magazine')
  const token = magazine?.magazine?.loaded[0]
  if (!magazine?.magazine || !token)
    return null

  const ammoId = magazine.magazine.kinds[token] || ''
  const ammo = drafts.find(item => item.id === ammoId)
  return {
    token,
    ammoId,
    ammoName: ammo?.name.trim() || ammoId,
    index: 0,
  }
}

export function readMagazineRounds(
  drafts: OpcodeInventoryDraft[],
  magazineId: string,
): OpcodeMagazineRound[] {
  const magazine = drafts.find(item => item.id === magazineId && item.kind === 'magazine')
  if (!magazine?.magazine)
    return []

  return [...magazine.magazine.loaded].map((token, index) => {
    const ammoId = magazine.magazine!.kinds[token] || ''
    const ammo = drafts.find(item => item.id === ammoId)
    return {
      token,
      ammoId,
      ammoName: ammo?.name.trim() || ammoId,
      index,
    }
  })
}

export function groupOpcodeMagazineRounds(
  rounds: OpcodeMagazineRound[],
): OpcodeMagazineRoundGroup[] {
  const groups: OpcodeMagazineRoundGroup[] = []
  for (const round of rounds) {
    const current = groups.at(-1)
    if (current && current.token === round.token && current.ammoId === round.ammoId) {
      current.count += 1
      continue
    }
    groups.push({ ...round, count: 1 })
  }
  return groups
}

export function setWeaponMagazine(
  inventory: OpcodeInventoryDraft[],
  weaponId: string,
  magazineId: string,
): OpcodeInventoryMutationResult {
  const drafts = cloneOpcodeInventoryDrafts(inventory)
  const weapon = drafts.find(item => item.id === weaponId && item.kind === 'weapon')
  if (!weapon?.weapon)
    return { ok: false, drafts: inventory, error: INVALID_TYPE_KEY }

  if (!magazineId) {
    weapon.weapon.magazineId = ''
    return { ok: true, drafts }
  }

  const magazine = drafts.find(item => item.id === magazineId && item.kind === 'magazine')
  if (!magazine?.magazine)
    return { ok: false, drafts: inventory, error: WEAPON_MAGAZINE_KEY }

  if (weapon.weapon.type === 'ranged' && !sameCaliber(weapon.weapon.caliber, magazine.magazine.caliber))
    return { ok: false, drafts: inventory, error: MAGAZINE_CALIBER_KEY }

  weapon.weapon.magazineId = magazineId
  return { ok: true, drafts }
}

export function installWeaponModification(
  inventory: OpcodeInventoryDraft[],
  weaponId: string,
  input: { slot: string, name: string, description: string, source: Record<string, unknown> },
): OpcodeInventoryMutationResult {
  const drafts = cloneOpcodeInventoryDrafts(inventory)
  const weapon = drafts.find(item => item.id === weaponId && item.kind === 'weapon')
  if (!weapon?.weapon)
    return { ok: false, drafts: inventory, error: INVALID_TYPE_KEY }

  // ponytail: wire `modifications.magazine` is the seated magazine id
  const requested = input.slot.trim() || 'attachment'
  const slot = requested === 'magazine' ? 'magazineMod' : requested
  const name = input.name.trim()
  const current = weapon.weapon.modifications.find(item => item.slot === slot)
  if (current) {
    current.name = name
    current.description = input.description
    current.source = input.source
    current.effects = []
  }
  else {
    const next = createOpcodeWeaponModificationDraft(slot)
    next.name = name
    next.description = input.description
    next.source = input.source
    weapon.weapon.modifications.push(next)
  }
  return { ok: true, drafts }
}

export function patchWeaponModification(
  inventory: OpcodeInventoryDraft[],
  weaponId: string,
  modificationId: string,
  patch: { name?: string, slot?: string, description?: string, effects?: OpcodeModEffectDraft[] },
): OpcodeInventoryMutationResult {
  const drafts = cloneOpcodeInventoryDrafts(inventory)
  const weapon = drafts.find(item => item.id === weaponId && item.kind === 'weapon')
  const modification = weapon?.weapon?.modifications.find(item => item.id === modificationId)
  if (!weapon?.weapon || !modification)
    return { ok: false, drafts: inventory, error: INVALID_TYPE_KEY }
  if (patch.name !== undefined)
    modification.name = patch.name
  if (patch.description !== undefined)
    modification.description = patch.description
  if (patch.effects)
    modification.effects = patch.effects.map(effect => ({ ...effect, source: cloneRecord(effect.source) }))
  if (patch.slot !== undefined) {
    const requested = patch.slot.trim() || 'attachment'
    modification.slot = requested === 'magazine' ? 'magazineMod' : requested
  }
  return { ok: true, drafts }
}

export function removeWeaponModification(
  inventory: OpcodeInventoryDraft[],
  weaponId: string,
  modificationId: string,
): OpcodeInventoryMutationResult {
  const drafts = cloneOpcodeInventoryDrafts(inventory)
  const weapon = drafts.find(item => item.id === weaponId && item.kind === 'weapon')
  if (!weapon?.weapon)
    return { ok: false, drafts: inventory, error: INVALID_TYPE_KEY }
  const index = weapon.weapon.modifications.findIndex(item => item.id === modificationId)
  if (index < 0)
    return { ok: false, drafts: inventory, error: INVALID_TYPE_KEY }
  weapon.weapon.modifications.splice(index, 1)
  return { ok: true, drafts }
}

export function canonCaliber(raw: string): string {
  return raw.replace(/[×✕✖]/g, 'x')
}

export function sameCaliber(left: string, right: string): boolean {
  const key = (raw: string) => canonCaliber(raw).trim().toLowerCase().replace(/\s+/g, '')
  const a = key(left)
  const b = key(right)
  return a.length > 0 && a === b
}

export function compatibleAmmoDrafts(
  drafts: OpcodeInventoryDraft[],
  caliber: string,
): OpcodeInventoryDraft[] {
  return drafts.filter(item => item.kind === 'ammo' && item.ammo && sameCaliber(item.ammo.caliber, caliber))
}

export function compatibleMagazineDrafts(
  drafts: OpcodeInventoryDraft[],
  caliber: string,
): OpcodeInventoryDraft[] {
  return drafts.filter(item => item.kind === 'magazine' && item.magazine && sameCaliber(item.magazine.caliber, caliber))
}

export function opcodeModEffectRangeBand(min: string, max: string): OpcodeModRangeBand | 'custom' | '' {
  if (!min.trim() && !max.trim())
    return ''
  const start = parseFiniteNumber(min)
  const end = parseFiniteNumber(max)
  for (const [name, spec] of Object.entries(OPCODE_MOD_RANGE_BANDS) as Array<[OpcodeModRangeBand, { min: number, max: number | null }]>) {
    if (start === spec.min && (spec.max === null ? end === null : end === spec.max))
      return name
  }
  return 'custom'
}

export function applyOpcodeModEffectRangeBand(effect: OpcodeModEffectDraft, band: OpcodeModRangeBand | '') {
  if (!band) {
    effect.rangeMin = ''
    effect.rangeMax = ''
    return
  }
  const spec = OPCODE_MOD_RANGE_BANDS[band]
  effect.rangeMin = String(spec.min)
  effect.rangeMax = spec.max === null ? '' : String(spec.max)
}

export function opcodeArmorCoveragePreset(
  protection: Record<OpcodeHealthPart, string>,
): OpcodeArmorCoveragePreset | 'custom' {
  const covered = HEALTH_PARTS.filter(part => (parseSafeInteger(protection[part]?.trim() || '0') || 0) > 0)
  for (const [name, parts] of Object.entries(OPCODE_ARMOR_COVERAGE_PRESETS) as Array<[OpcodeArmorCoveragePreset, readonly OpcodeHealthPart[]]>) {
    if (parts.length === covered.length && parts.every(part => covered.includes(part)))
      return name
  }
  return 'custom'
}

export function applyOpcodeArmorCoveragePreset(
  protection: Record<OpcodeHealthPart, string>,
  preset: OpcodeArmorCoveragePreset,
): Record<OpcodeHealthPart, string> {
  const selected = new Set<OpcodeHealthPart>(OPCODE_ARMOR_COVERAGE_PRESETS[preset])
  const sample = [...selected]
    .map(part => parseSafeInteger(protection[part]?.trim() || '') || 0)
    .find(value => value > 0)
    ?? HEALTH_PARTS.map(part => parseSafeInteger(protection[part]?.trim() || '') || 0).find(value => value > 0)
    ?? 1
  const next = { ...protection }
  for (const part of HEALTH_PARTS)
    next[part] = selected.has(part) ? String(sample) : '0'
  return next
}

export function summarizeOpcodeModEffect(effect: OpcodeModEffectDraft): OpcodeModEffectSummary {
  if (effect.kind === 'enable_slot') {
    return {
      kind: 'enable_slot',
      slot: effect.slot,
      count: effect.count.trim(),
      max: effect.max.trim(),
    }
  }
  if (effect.kind === 'unknown')
    return { kind: 'unknown' }
  const amount = [signedEffectAmount(effect.flat), signedEffectAmount(effect.level)].filter(Boolean).join(' · ')
  return {
    kind: 'mod',
    target: effect.target,
    amount,
    band: opcodeModEffectRangeBand(effect.rangeMin, effect.rangeMax),
  }
}

export function formatOpcodeModEffectLine(
  effect: OpcodeModEffectDraft,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const summary = summarizeOpcodeModEffect(effect)
  if (summary.kind === 'enable_slot') {
    const slot = t(`characterSheets.inventory.modifications.slots.${summary.slot}`)
    if (summary.max) {
      return t('characterSheets.inventory.modifications.slotLineMax', {
        slot,
        count: summary.count || '0',
        max: summary.max,
      })
    }
    return t('characterSheets.inventory.modifications.slotLine', {
      slot,
      count: summary.count || '0',
    })
  }
  if (summary.kind !== 'mod' || !summary.target)
    return ''
  const parts = [t(`characterSheets.inventory.modifications.targets.${summary.target}`)]
  if (summary.amount)
    parts.push(summary.amount)
  if (summary.band && summary.band !== 'custom')
    parts.push(t(`characterSheets.inventory.modifications.rangeBands.${summary.band}`))
  return parts.join(' · ')
}

function signedEffectAmount(raw: string): string {
  const parsed = parseFiniteNumber(raw)
  if (parsed === null)
    return ''
  return parsed > 0 ? `+${parsed}` : String(parsed)
}

export function createOpcodeModEffectDraft(kind: OpcodeModEffectKind = 'mod'): OpcodeModEffectDraft {
  return {
    key: '',
    kind,
    slot: 'attachment',
    count: '1',
    max: '',
    target: 'diff',
    flat: '',
    level: '',
    rangeMin: '',
    rangeMax: '',
    concealMax: '',
    note: '',
    source: {},
  }
}

export function createOpcodeWeaponModificationDraft(slot = 'attachment'): OpcodeWeaponModificationDraft {
  return {
    id: crypto.randomUUID(),
    slot,
    name: '',
    description: '',
    effects: [],
    source: {},
  }
}

export function weaponModificationFieldErrors(
  modification: OpcodeWeaponModificationDraft,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!modification.slot.trim())
    errors.slot = REQUIRED_KEY
  if (!modification.name.trim())
    errors.name = REQUIRED_KEY
  modification.effects.forEach((effect, index) => {
    const prefix = `effects.${index}`
    if (effect.kind === 'unknown')
      return
    if (effect.kind === 'enable_slot') {
      if (!effect.slot.trim() || !(OPCODE_WEAPON_MODIFICATION_SLOTS as readonly string[]).includes(effect.slot))
        errors[`${prefix}.slot`] = REQUIRED_KEY
      requireSafeIntField(effect.count, `${prefix}.count`, errors, false)
      requireSafeIntField(effect.max, `${prefix}.max`, errors, false)
      return
    }
    if (!(OPCODE_MOD_EFFECT_TARGETS as readonly string[]).includes(effect.target))
      errors[`${prefix}.target`] = effect.target.trim() ? INVALID_TYPE_KEY : REQUIRED_KEY
    requireFinite(effect.flat, `${prefix}.flat`, errors, false)
    requireFinite(effect.level, `${prefix}.level`, errors, false)
    requireFinite(effect.rangeMin, `${prefix}.rangeMin`, errors, false)
    requireFinite(effect.rangeMax, `${prefix}.rangeMax`, errors, false)
    const concealMax = requireSafeIntField(effect.concealMax, `${prefix}.concealMax`, errors, false)
    if (concealMax !== null && !(OPCODE_WEAPON_CONCEALABILITY as readonly number[]).includes(concealMax))
      errors[`${prefix}.concealMax`] = CONCEALABILITY_KEY
  })
  return errors
}

export function createOpcodeWeaponSkillDraft(): OpcodeWeaponSkillDraft {
  return {
    name: '',
    mul: '1',
    specializations: [],
  }
}

export function createOpcodeExplosiveDraft(id = '0'): OpcodeExplosiveDraft {
  return {
    id,
    type: 'frag',
    damage: {},
    lethal: '0',
    wound: '0',
    persistance: '0',
    fuse: '0',
    source: {},
  }
}

export function inventoryErrorsForIndex(
  errors: Record<string, string>,
  index: number,
): Record<string, string> {
  const prefix = `inventory.${index}.`
  const exact = `inventory.${index}`
  return Object.fromEntries(Object.entries(errors).filter(([path]) => path === exact || path.startsWith(prefix)))
}

export function inventoryFieldError(
  errors: Record<string, string>,
  index: number,
  suffix: string,
): string {
  if (!suffix)
    return errors[`inventory.${index}`] || ''
  return errors[`inventory.${index}.${suffix}`] || ''
}

export function collectOpcodeInventoryCalibers(drafts: OpcodeInventoryDraft[]): string[] {
  const seen = new Set<string>()
  for (const draft of drafts) {
    const caliber = (
      draft.weapon?.caliber
      || draft.ammo?.caliber
      || draft.magazine?.caliber
      || ''
    ).trim()
    if (caliber)
      seen.add(caliber)
  }
  return [...seen].sort((left, right) => left.localeCompare(right))
}

export function summarizeOpcodeInventoryItem(
  draft: OpcodeInventoryDraft,
  drafts: OpcodeInventoryDraft[] = [],
): {
  caliber: string
  coverage: OpcodeHealthPart[]
  loadedCount: number
  capacity: number | null
  magazineName: string
} {
  const caliber = draft.weapon?.caliber.trim()
    || draft.ammo?.caliber.trim()
    || draft.magazine?.caliber.trim()
    || ''
  const coverage = draft.armor
    ? HEALTH_PARTS.filter(part => (parseSafeInteger(draft.armor!.protection[part]?.trim() || '0') || 0) > 0)
    : []

  if (draft.kind === 'weapon' && draft.weapon?.magazineId) {
    const magazine = drafts.find(item => item.id === draft.weapon?.magazineId)
    if (magazine?.magazine) {
      return {
        caliber,
        coverage,
        loadedCount: magazine.magazine.loaded.length,
        capacity: parseSafeInteger(magazine.magazine.containsMax),
        magazineName: magazine.name.trim() || magazine.id,
      }
    }
  }

  const loadedCount = draft.magazine?.loaded.length || 0
  const capacity = draft.magazine ? parseSafeInteger(draft.magazine.containsMax) : null
  return { caliber, coverage, loadedCount, capacity, magazineName: '' }
}

export function summarizeOpcodeWeaponList(
  draft: OpcodeInventoryDraft,
  drafts: OpcodeInventoryDraft[] = [],
): {
  type: string
  caliber: string
  modes: Array<'semi' | 'auto' | 'burst'>
  magazineName: string
  loadedCount: number
  capacity: number | null
  nextName: string
  attachments: string[]
} | null {
  if (draft.kind !== 'weapon' || !draft.weapon)
    return null
  const summary = summarizeOpcodeInventoryItem(draft, drafts)
  const next = draft.weapon.magazineId
    ? readNextMagazineRound(drafts, draft.weapon.magazineId)
    : null
  return {
    type: draft.weapon.type,
    caliber: summary.caliber,
    modes: readOpcodeWeaponFireModes(draft.weapon.mode),
    magazineName: summary.magazineName,
    loadedCount: summary.loadedCount,
    capacity: summary.capacity,
    nextName: next?.ammoName || '',
    attachments: draft.weapon.modifications.map(item => item.name.trim()).filter(Boolean),
  }
}

export function normalizeOpcodeAmmoDamageKind(value: string): OpcodeAmmoDamageKind {
  return (OPCODE_AMMO_DAMAGE_KINDS as readonly string[]).includes(value)
    ? (value as OpcodeAmmoDamageKind)
    : 'ball'
}

export function groupInventoryByKind(items: OpcodeInventoryDraft[]): Array<{ kind: OpcodeInventoryItemKind, items: OpcodeInventoryDraft[] }> {
  return OPCODE_INVENTORY_LIST_KIND_ORDER.flatMap((kind) => {
    const group = items.filter(item => item.kind === kind)
    return group.length ? [{ kind, items: group }] : []
  })
}

/** `undefined` = no move. `null` = append. Otherwise insert before that id. */
export function inventoryMoveBefore(ordered: string[], itemId: string, delta: number): string | null | undefined {
  const index = ordered.indexOf(itemId)
  const dest = index + delta
  if (index < 0 || dest < 0 || dest >= ordered.length)
    return undefined
  if (delta < 0)
    return ordered[dest]
  const after = ordered[dest + 1]
  return after === undefined ? null : after
}

export function inventoryListFacts(draft: OpcodeInventoryDraft, drafts: OpcodeInventoryDraft[] = []): string[] {
  const facts: string[] = []
  const count = draft.count.trim()
  if (count && count !== '0')
    facts.push(`×${count}`)
  const weapon = summarizeOpcodeWeaponList(draft, drafts)
  if (weapon) {
    if (weapon.type)
      facts.push(weapon.type)
    if (draft.weapon?.type === 'melee') {
      const dice = draft.weapon.damage.dice
      if (typeof dice === 'string' && dice.trim())
        facts.push(dice.trim())
    }
    if (weapon.caliber)
      facts.push(weapon.caliber)
    const weight = draft.weapon?.weight.trim()
    if (weight)
      facts.push(`${weight} kg`)
    if (weapon.magazineName)
      facts.push(weapon.magazineName)
    if (weapon.capacity != null)
      facts.push(`${weapon.loadedCount}/${weapon.capacity}`)
    return facts
  }
  const summary = summarizeOpcodeInventoryItem(draft, drafts)
  if (summary.caliber)
    facts.push(summary.caliber)
  if (draft.kind === 'ammo' && draft.ammo?.damage)
    facts.push(draft.ammo.damage)
  if (draft.kind === 'throwable') {
    for (const explosive of draft.ammo?.explosives ?? []) {
      const type = explosive.type.trim()
      if (type)
        facts.push(type)
    }
  }
  if (draft.kind === 'magazine' && summary.capacity != null)
    facts.push(`${summary.loadedCount}/${summary.capacity}`)
  if (draft.kind === 'armor' && draft.armor?.material.trim())
    facts.push(draft.armor.material.trim())
  const weight = draft.weight.trim()
  if (weight)
    facts.push(`${weight} kg`)
  return facts
}

export function inventoryMatchesQuery(draft: OpcodeInventoryDraft, query: string, drafts: OpcodeInventoryDraft[] = []): boolean {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle)
    return true
  return [draft.name, ...inventoryListFacts(draft, drafts)].join('\n').toLocaleLowerCase().includes(needle)
}

export function inventoryItemFromQuery(itemId: string | null | undefined, drafts: OpcodeInventoryDraft[]): string | null {
  if (!itemId)
    return null
  return drafts.some(draft => draft.id === itemId) ? itemId : null
}

function readInventoryDraft(item: OpcodeInventoryItemWire): OpcodeInventoryDraft {
  const source = cloneRecord(item)
  const kind = readItemKind(item)
  const id = typeof item.id === 'string' && isInventoryId(item.id)
    ? item.id
    : crypto.randomUUID()

  const draft: OpcodeInventoryDraft = {
    clientKey: crypto.randomUUID(),
    id,
    kind,
    name: typeof item.name === 'string' ? item.name : '',
    count: stringifyUnknownNumber(item.count, kind === 'magazine' ? '1' : '0'),
    weight: stringifyUnknownNumber(item.weight, '0'),
    desc: typeof item.desc === 'string' ? item.desc : '',
    source,
  }

  if (kind === 'weapon')
    draft.weapon = readWeaponDraft(item)
  else if (kind === 'ammo' || kind === 'throwable')
    draft.ammo = readAmmoDraft(asRecord(item.ammo), kind === 'throwable')
  else if (kind === 'magazine')
    draft.magazine = readMagazineDraft(asRecord(item.magazine))
  else if (kind === 'armor')
    draft.armor = readArmorDraft(asRecord(item.armor))

  return draft
}

function readItemKind(item: OpcodeInventoryItemWire): OpcodeInventoryItemKind {
  if (item.type === undefined || item.type === null || item.type === '')
    return 'generic'
  if (typeof item.type === 'string' && (OPCODE_INVENTORY_TYPED_KINDS as readonly string[]).includes(item.type))
    return item.type as OpcodeInventoryItemType
  return 'generic'
}

function readWeaponDraft(item: OpcodeInventoryItemWire): OpcodeWeaponDraft {
  const weapon = asRecord(item.weapon)
  const skillSource = isPlainObject(weapon.skill)
    ? asRecord(weapon.skill)
    : isPlainObject(item.skill) ? asRecord(item.skill) : {}
  const modifications = asRecord(weapon.modifications)
  const magazineId = typeof modifications.magazine === 'string' && isInventoryId(modifications.magazine)
    ? modifications.magazine
    : ''

  return {
    type: weapon.type === 'melee' || weapon.type === 'ranged' ? weapon.type : '',
    skills: readWeaponSkills(skillSource),
    range: stringifyUnknownNumber(weapon.range, ''),
    caliber: canonCaliber(typeof weapon.caliber === 'string' ? weapon.caliber : ''),
    accuracy: stringifyUnknownNumber(weapon.accuracy, ''),
    concealability: stringifyUnknownNumber(weapon.concealability, ''),
    rof: stringifyUnknownNumber(weapon.rof, ''),
    mode: stringifyUnknownNumber(weapon.mode, '0'),
    reliability: stringifyUnknownNumber(weapon.reliability, ''),
    weight: stringifyUnknownNumber(weapon.weight, ''),
    damage: isPlainObject(weapon.damage) ? cloneRecord(weapon.damage) : {},
    magazineId,
    modifications: readWeaponModifications(modifications),
  }
}

function readWeaponSkills(source: Record<string, unknown>): OpcodeWeaponSkillDraft[] {
  return Object.entries(source).map(([name, value]) => {
    const record = asRecord(value)
    const specialization = asRecord(record.specialization)
    return {
      name,
      mul: stringifyUnknownNumber(record.mul, '1'),
      specializations: Object.entries(specialization).map(([specName, spec]) => ({
        name: specName,
        mul: stringifyUnknownNumber(asRecord(spec).mul, '2'),
      })),
    }
  })
}

function readWeaponModifications(source: Record<string, unknown>): OpcodeWeaponModificationDraft[] {
  const drafts: OpcodeWeaponModificationDraft[] = []
  for (const [slot, value] of Object.entries(source)) {
    if (slot === 'magazine' || !isPlainObject(value))
      continue
    for (const [id, instance] of Object.entries(value)) {
      const record = asRecord(instance)
      drafts.push({
        id,
        slot,
        name: typeof record.name === 'string' ? record.name : '',
        description: typeof record.description === 'string' ? record.description : '',
        effects: readModEffects(record.effects),
        source: cloneRecord(record),
      })
    }
  }
  return drafts
}

function readModEffects(effects: unknown): OpcodeModEffectDraft[] {
  if (!isPlainObject(effects))
    return []
  return Object.entries(effects).sort(([left], [right]) => {
    const leftIndex = Number(left)
    const rightIndex = Number(right)
    if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex))
      return leftIndex - rightIndex
    return left.localeCompare(right)
  }).map(([key, value]) => {
    const record = asRecord(value)
    if (typeof record.enable_slot === 'string') {
      return {
        ...createOpcodeModEffectDraft('enable_slot'),
        key,
        slot: record.enable_slot,
        count: stringifyUnknownNumber(record.count, '1'),
        max: stringifyUnknownNumber(record.max, ''),
        source: cloneRecord(record),
      }
    }
    const mod = asRecord(record.mod)
    if (Object.keys(mod).length) {
      const amount = asRecord(mod.value)
      const applied = asRecord(amount.applied_on)
      const range = asRecord(applied.range_target)
      const conceal = asRecord(applied.concealability)
      const target = typeof mod.target === 'string' && (OPCODE_MOD_EFFECT_TARGETS as readonly string[]).includes(mod.target)
        ? mod.target as OpcodeModEffectDraft['target']
        : ''
      return {
        ...createOpcodeModEffectDraft('mod'),
        key,
        target,
        flat: stringifyUnknownNumber(amount.flat, ''),
        level: stringifyUnknownNumber(amount.level, ''),
        rangeMin: stringifyUnknownNumber(range.min, ''),
        rangeMax: stringifyUnknownNumber(range.max, ''),
        concealMax: stringifyUnknownNumber(conceal.max, ''),
        note: typeof applied.text === 'string' ? applied.text : '',
        source: cloneRecord(record),
      }
    }
    return {
      ...createOpcodeModEffectDraft('mod'),
      key,
      kind: 'unknown',
      target: '',
      source: cloneRecord(record),
    }
  })
}

function writeModEffects(effects: OpcodeModEffectDraft[]): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  effects.forEach((effect, index) => {
    const key = String(index + 1)
    if (effect.kind === 'unknown') {
      next[key] = Object.keys(effect.source).length ? cloneRecord(effect.source) : {}
      return
    }
    if (effect.kind === 'enable_slot') {
      const node: Record<string, unknown> = {
        enable_slot: effect.slot.trim() || 'attachment',
      }
      const count = parseSafeInteger(effect.count)
      const max = parseSafeInteger(effect.max)
      if (count !== null)
        node.count = count
      if (max !== null)
        node.max = max
      next[key] = node
      return
    }
    const amount: Record<string, unknown> = {}
    const flat = parseFiniteNumber(effect.flat)
    const level = parseFiniteNumber(effect.level)
    if (flat !== null)
      amount.flat = flat
    if (level !== null)
      amount.level = level
    const applied: Record<string, unknown> = {}
    const rangeMin = parseFiniteNumber(effect.rangeMin)
    const rangeMax = parseFiniteNumber(effect.rangeMax)
    if (rangeMin !== null || rangeMax !== null) {
      applied.range_target = {
        ...(rangeMin !== null ? { min: rangeMin } : {}),
        ...(rangeMax !== null ? { max: rangeMax } : {}),
      }
    }
    if (effect.note.trim())
      applied.text = effect.note.trim()
    const concealMax = parseSafeInteger(effect.concealMax)
    if (concealMax !== null)
      applied.concealability = { max: concealMax }
    if (Object.keys(applied).length)
      amount.applied_on = applied
    next[key] = {
      mod: {
        target: effect.target || 'diff',
        value: amount,
      },
    }
  })
  return next
}

function readAmmoDraft(ammo: Record<string, unknown>, forceExplosive: boolean): OpcodeAmmoDraft {
  const ball = asRecord(ammo.ball)
  const buck = asRecord(ammo.buck)
  const explosive = asRecord(ammo.explosive)
  let discriminator = forceExplosive
    ? 'explosive'
    : (OPCODE_AMMO_DAMAGE_KINDS as readonly string[]).includes(String(ammo.damage))
      ? ammo.damage as OpcodeAmmoDamageKind
      : ''
  if (!discriminator && isPlainObject(ball.damage) && Object.keys(ball.damage).length)
    discriminator = 'ball'
  else if (!discriminator && isPlainObject(buck.damage) && Object.keys(buck.damage).length)
    discriminator = 'buck'

  return {
    caliber: canonCaliber(typeof ammo.caliber === 'string' ? ammo.caliber : ''),
    damage: discriminator as OpcodeAmmoDamageKind,
    penetration: stringifyUnknownNumber(ammo.penetration, ''),
    projectileCount: stringifyUnknownNumber(buck.projectile_count, ''),
    ballDamage: isPlainObject(ball.damage) ? cloneRecord(ball.damage) : {},
    buckDamage: isPlainObject(buck.damage) ? cloneRecord(buck.damage) : {},
    explosives: Object.entries(explosive).map(([id, value]) => {
      const record = asRecord(value)
      return {
        id,
        type: typeof record.type === 'string' ? record.type : '',
        damage: isPlainObject(record.damage) ? cloneRecord(record.damage) : {},
        lethal: stringifyUnknownNumber(record.lethal, ''),
        wound: stringifyUnknownNumber(record.wound, ''),
        persistance: stringifyUnknownNumber(record.persistance, ''),
        fuse: stringifyUnknownNumber(record.fuse, ''),
        source: cloneRecord(record),
      }
    }),
  }
}

function readMagazineDraft(magazine: Record<string, unknown>): OpcodeMagazineDraft {
  const ammo = asRecord(magazine.ammo)
  const kindsSource = asRecord(ammo.kinds)
  const kinds: Record<string, string> = {}
  for (const [token, ammoId] of Object.entries(kindsSource)) {
    if (typeof ammoId === 'string')
      kinds[token] = ammoId
  }

  return {
    caliber: canonCaliber(typeof magazine.caliber === 'string' ? magazine.caliber : ''),
    containsMax: stringifyUnknownNumber(ammo.contains_max, ''),
    kinds,
    loaded: typeof ammo.loaded === 'string' ? ammo.loaded : '',
  }
}

function readArmorDraft(armor: Record<string, unknown>): OpcodeArmorDraft {
  const protection = asRecord(asRecord(armor.protection).normal)
  const parts = {} as Record<OpcodeHealthPart, string>
  for (const part of HEALTH_PARTS)
    parts[part] = stringifyUnknownNumber(protection[part], '0')

  return {
    material: readArmorMaterial(armor.material),
    layer: stringifyUnknownNumber(armor.layer, '0'),
    protection: parts,
  }
}

function createWeaponDraft(): OpcodeWeaponDraft {
  return {
    type: 'melee',
    skills: [],
    range: '1',
    caliber: '',
    accuracy: '0',
    concealability: '3',
    rof: '20',
    mode: '0',
    reliability: '1',
    weight: '0',
    damage: {},
    magazineId: '',
    modifications: [],
  }
}

function createAmmoDraft(kind: OpcodeAmmoDamageKind): OpcodeAmmoDraft {
  return {
    caliber: '',
    damage: kind,
    penetration: '0',
    projectileCount: kind === 'buck' ? '1' : '',
    ballDamage: {},
    buckDamage: {},
    explosives: kind === 'explosive'
      ? [{
          id: '0',
          type: 'frag',
          damage: {},
          lethal: '0',
          wound: '0',
          persistance: '0',
          fuse: '0',
          source: {},
        }]
      : [],
  }
}

function createMagazineDraft(): OpcodeMagazineDraft {
  return {
    caliber: '',
    containsMax: '30',
    kinds: {},
    loaded: '',
  }
}

function readArmorMaterial(raw: unknown): string {
  if (typeof raw !== 'string')
    return 'ceramic'
  const value = raw.trim()
  if (!value)
    return 'ceramic'
  const normalized = value.toLowerCase()
  if ((OPCODE_ARMOR_MATERIALS as readonly string[]).includes(normalized))
    return normalized
  return value
}

function createArmorDraft(): OpcodeArmorDraft {
  const protection = {} as Record<OpcodeHealthPart, string>
  for (const part of HEALTH_PARTS)
    protection[part] = '0'
  return {
    material: 'ceramic',
    layer: '0',
    protection,
  }
}

function writeInventoryItem(draft: OpcodeInventoryDraft): Record<string, unknown> {
  const item = cloneRecord(draft.source)
  item.id = draft.id
  item.name = draft.name.trim()
  item.count = requireSafeInteger(draft.count)
  item.desc = draft.desc
  if (draft.kind === 'weapon')
    delete item.weight
  else
    writeNumberField(item, 'weight', draft.weight)
  delete item.clientKey
  delete item.source

  if (draft.kind === 'generic') {
    delete item.type
    delete item.weapon
    delete item.ammo
    delete item.magazine
    delete item.armor
    delete item.skill
    return item
  }

  item.type = draft.kind

  if (draft.kind === 'weapon' && draft.weapon)
    writeWeapon(item, draft.weapon)
  else if ((draft.kind === 'ammo' || draft.kind === 'throwable') && draft.ammo)
    writeAmmo(item, draft.ammo, draft.kind === 'throwable')
  else if (draft.kind === 'magazine' && draft.magazine)
    writeMagazine(item, draft.magazine)
  else if (draft.kind === 'armor' && draft.armor)
    writeArmor(item, draft.armor)

  delete item.skill
  return item
}

function writeWeapon(item: Record<string, unknown>, weapon: OpcodeWeaponDraft) {
  const previous = asRecord(item.weapon)
  const next = cloneRecord(previous)
  next.type = weapon.type
  if (weapon.skills.length)
    next.skill = writeWeaponSkills(weapon.skills, asRecord(previous.skill))
  else if (Object.hasOwn(previous, 'skill') || Object.hasOwn(item, 'skill'))
    next.skill = writeWeaponSkills(weapon.skills, asRecord(previous.skill))

  writeNumberField(next, 'range', weapon.range)
  if (weapon.type === 'ranged' || weapon.caliber.trim())
    next.caliber = canonCaliber(weapon.caliber.trim())
  else
    delete next.caliber

  writeNumberField(next, 'accuracy', weapon.accuracy)
  writeIntegerField(next, 'concealability', weapon.concealability)
  writeIntegerField(next, 'rof', weapon.rof)
  writeIntegerField(next, 'mode', weapon.mode)
  writeIntegerField(next, 'reliability', weapon.reliability)
  writeNumberField(next, 'weight', weapon.weight)
  next.damage = isPlainObject(weapon.damage) ? cloneRecord(weapon.damage) : {}
  next.modifications = writeWeaponModifications(asRecord(previous.modifications), weapon)
  item.weapon = next
  delete item.ammo
  delete item.magazine
  delete item.armor
}

function writeWeaponSkills(
  skills: OpcodeWeaponSkillDraft[],
  previous: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(skills.filter(skill => skill.name.trim()).map((skill) => {
    const old = asRecord(previous[skill.name.trim()])
    const node = cloneRecord(old)
    node.mul = parseFiniteNumber(skill.mul) ?? 1
    if (skill.specializations.length || Object.hasOwn(old, 'specialization')) {
      const previousSpecs = asRecord(old.specialization)
      node.specialization = Object.fromEntries(skill.specializations.filter(spec => spec.name.trim()).map((spec) => {
        const oldSpec = asRecord(previousSpecs[spec.name.trim()])
        return [spec.name.trim(), { ...oldSpec, mul: parseFiniteNumber(spec.mul) ?? 2 }]
      }))
    }
    return [skill.name.trim(), node]
  }))
}

function writeWeaponModifications(
  previous: Record<string, unknown>,
  weapon: OpcodeWeaponDraft,
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [slot, value] of Object.entries(previous)) {
    if (slot === 'magazine')
      continue
    if (!isPlainObject(value))
      next[slot] = value
  }

  for (const modification of weapon.modifications) {
    const slotRecord = isPlainObject(next[modification.slot])
      ? asRecord(next[modification.slot])
      : {}
    const previousInstance = asRecord(asRecord(previous[modification.slot])[modification.id])
    const source = Object.keys(modification.source).length ? modification.source : previousInstance
    slotRecord[modification.id] = {
      ...cloneRecord(source),
      name: modification.name.trim(),
      description: modification.description,
      effects: writeModEffects(modification.effects),
    }
    next[modification.slot] = slotRecord
  }

  const keptIds = new Set(weapon.modifications.map(item => `${item.slot}:${item.id}`))
  for (const [slot, value] of Object.entries(next)) {
    if (!isPlainObject(value))
      continue
    for (const id of Object.keys(value)) {
      if (!keptIds.has(`${slot}:${id}`))
        delete asRecord(value)[id]
    }
    if (!Object.keys(asRecord(next[slot])).length)
      delete next[slot]
  }

  if (weapon.magazineId)
    next.magazine = weapon.magazineId
  else
    delete next.magazine

  return next
}

function writeAmmo(item: Record<string, unknown>, ammo: OpcodeAmmoDraft, throwable: boolean) {
  const previous = asRecord(item.ammo)
  const next = cloneRecord(previous)
  if (!throwable)
    next.caliber = canonCaliber(ammo.caliber.trim())
  next.damage = ammo.damage
  writeIntegerField(next, 'penetration', ammo.penetration)

  if (ammo.damage === 'ball' || isPlainObject(previous.ball)) {
    const ball = cloneRecord(asRecord(previous.ball))
    ball.damage = isPlainObject(ammo.ballDamage) ? cloneRecord(ammo.ballDamage) : {}
    next.ball = ball
  }
  if (ammo.damage === 'buck' || isPlainObject(previous.buck)) {
    const buck = cloneRecord(asRecord(previous.buck))
    buck.damage = isPlainObject(ammo.buckDamage) ? cloneRecord(ammo.buckDamage) : {}
    writeIntegerField(buck, 'projectile_count', ammo.projectileCount)
    next.buck = buck
  }
  if (ammo.damage === 'explosive' || ammo.explosives.length || isPlainObject(previous.explosive))
    next.explosive = writeExplosives(asRecord(previous.explosive), ammo.explosives)

  item.ammo = next
  delete item.weapon
  delete item.magazine
  delete item.armor
}

function writeExplosives(
  previous: Record<string, unknown>,
  explosives: OpcodeExplosiveDraft[],
): Record<string, unknown> {
  return Object.fromEntries(explosives.map((entry) => {
    const old = Object.keys(entry.source).length ? entry.source : asRecord(previous[entry.id])
    const node = cloneRecord(old)
    node.type = entry.type.trim()
    node.damage = isPlainObject(entry.damage) ? cloneRecord(entry.damage) : {}
    writeNumberField(node, 'lethal', entry.lethal)
    writeNumberField(node, 'wound', entry.wound)
    writeNumberField(node, 'persistance', entry.persistance)
    writeNumberField(node, 'fuse', entry.fuse)
    return [entry.id, node]
  }))
}

function writeMagazine(item: Record<string, unknown>, magazine: OpcodeMagazineDraft) {
  const previous = asRecord(item.magazine)
  const next = cloneRecord(previous)
  const ammo = cloneRecord(asRecord(previous.ammo))
  next.caliber = canonCaliber(magazine.caliber.trim())
  ammo.kinds = { ...magazine.kinds }
  writeIntegerField(ammo, 'contains_max', magazine.containsMax)
  ammo.loaded = magazine.loaded
  next.ammo = ammo
  item.magazine = next
  delete item.weapon
  delete item.ammo
  delete item.armor
}

function writeArmor(item: Record<string, unknown>, armor: OpcodeArmorDraft) {
  const previous = asRecord(item.armor)
  const next = cloneRecord(previous)
  next.material = armor.material.trim()
  writeIntegerField(next, 'layer', armor.layer)
  const protection = cloneRecord(asRecord(previous.protection))
  const normal: Record<string, number> = {}
  for (const part of HEALTH_PARTS) {
    const parsed = parseSafeInteger(armor.protection[part]?.trim() || '0')
    normal[part] = parsed === null || parsed < 0 ? 0 : parsed
  }
  protection.normal = normal
  next.protection = protection
  item.armor = next
  delete item.weapon
  delete item.ammo
  delete item.magazine
}

function validateCommonEnvelope(
  draft: OpcodeInventoryDraft,
  prefix: string,
  errors: Record<string, string>,
) {
  if (!isInventoryId(draft.id))
    errors[`${prefix}.id`] = INVALID_UUID_KEY
  if (!draft.name.trim())
    errors[`${prefix}.name`] = REQUIRED_KEY
  if (typeof draft.desc !== 'string')
    errors[`${prefix}.desc`] = REQUIRED_KEY

  const count = parseSafeInteger(draft.count)
  if (count === null)
    errors[`${prefix}.count`] = SAFE_INTEGER_KEY
  else if (count < 0)
    errors[`${prefix}.count`] = NON_NEGATIVE_KEY
  else if (draft.kind === 'magazine' && count !== 1)
    errors[`${prefix}.count`] = MAGAZINE_COUNT_KEY

  if (draft.kind !== 'weapon')
    requireNonNegativeNumber(draft.weight, `${prefix}.weight`, errors)

  if (draft.kind === 'generic')
    return

  if (!(OPCODE_INVENTORY_TYPED_KINDS as readonly string[]).includes(draft.kind)) {
    errors[`${prefix}.type`] = INVALID_TYPE_KEY
    return
  }

  if (draft.kind === 'weapon' && !draft.weapon)
    errors[`${prefix}.weapon`] = MISSING_BLOCK_KEY
  if ((draft.kind === 'ammo' || draft.kind === 'throwable') && !draft.ammo)
    errors[`${prefix}.ammo`] = MISSING_BLOCK_KEY
  if (draft.kind === 'magazine' && !draft.magazine)
    errors[`${prefix}.magazine`] = MISSING_BLOCK_KEY
  if (draft.kind === 'armor' && !draft.armor)
    errors[`${prefix}.armor`] = MISSING_BLOCK_KEY
}

function validateWeapon(
  draft: OpcodeInventoryDraft,
  prefix: string,
  errors: Record<string, string>,
  seenModIds: Map<string, string>,
) {
  const weapon = draft.weapon
  if (!weapon)
    return

  if (!(OPCODE_WEAPON_TYPES as readonly string[]).includes(weapon.type))
    errors[`${prefix}.weapon.type`] = WEAPON_TYPE_KEY

  requireFinite(weapon.range, `${prefix}.weapon.range`, errors, true)
  requireFinite(weapon.accuracy, `${prefix}.weapon.accuracy`, errors, false)
  requireFinite(weapon.weight, `${prefix}.weapon.weight`, errors, false)
  const rof = requireSafeIntField(weapon.rof, `${prefix}.weapon.rof`, errors, true)
  if (rof !== null && rof < 0)
    errors[`${prefix}.weapon.rof`] = NON_NEGATIVE_KEY

  const concealability = requireSafeIntField(weapon.concealability, `${prefix}.weapon.concealability`, errors, false)
  if (concealability !== null && !(OPCODE_WEAPON_CONCEALABILITY as readonly number[]).includes(concealability))
    errors[`${prefix}.weapon.concealability`] = CONCEALABILITY_KEY

  const reliability = requireSafeIntField(weapon.reliability, `${prefix}.weapon.reliability`, errors, false)
  if (reliability !== null && !(OPCODE_WEAPON_RELIABILITY as readonly number[]).includes(reliability))
    errors[`${prefix}.weapon.reliability`] = RELIABILITY_KEY

  requireSafeIntField(weapon.mode, `${prefix}.weapon.mode`, errors, false)

  if (weapon.type === 'ranged' && !weapon.caliber.trim())
    errors[`${prefix}.weapon.caliber`] = CALIBER_KEY

  if (!isPlainObject(weapon.damage))
    errors[`${prefix}.weapon.damage`] = OPAQUE_DAMAGE_KEY

  weapon.skills.forEach((skill, skillIndex) => {
    if (!skill.name.trim())
      errors[`${prefix}.weapon.skill.${skillIndex}.name`] = REQUIRED_KEY
    requireFinite(skill.mul, `${prefix}.weapon.skill.${skillIndex}.mul`, errors, true)
    skill.specializations.forEach((spec, specIndex) => {
      if (!spec.name.trim())
        errors[`${prefix}.weapon.skill.${skillIndex}.specializations.${specIndex}.name`] = REQUIRED_KEY
      requireFinite(spec.mul, `${prefix}.weapon.skill.${skillIndex}.specializations.${specIndex}.mul`, errors, true)
    })
  })

  weapon.modifications.forEach((modification, modIndex) => {
    const path = `${prefix}.weapon.modifications.${modIndex}`
    if (!isInventoryId(modification.id))
      errors[`${path}.id`] = INVALID_UUID_KEY
    if (typeof modification.description !== 'string')
      errors[`${path}.description`] = REQUIRED_KEY
    for (const [key, message] of Object.entries(weaponModificationFieldErrors(modification)))
      errors[`${path}.${key}`] = message
    const previous = seenModIds.get(modification.id)
    if (modification.id && isInventoryId(modification.id) && previous)
      errors[`${path}.id`] = DUPLICATE_MOD_KEY
    else if (modification.id)
      seenModIds.set(modification.id, draft.id)
  })
}

function validateAmmo(
  draft: OpcodeInventoryDraft,
  prefix: string,
  errors: Record<string, string>,
  throwable: boolean,
) {
  const ammo = draft.ammo
  if (!ammo)
    return

  if (!throwable && !ammo.caliber.trim())
    errors[`${prefix}.ammo.caliber`] = CALIBER_KEY

  const penetration = requireSafeIntField(ammo.penetration, `${prefix}.ammo.penetration`, errors, true)
  if (penetration !== null && penetration < 0)
    errors[`${prefix}.ammo.penetration`] = NON_NEGATIVE_KEY

  if (throwable) {
    if (ammo.damage !== 'explosive')
      errors[`${prefix}.ammo.damage`] = DISCRIMINATOR_KEY
  }
  else if (!(OPCODE_AMMO_DAMAGE_KINDS as readonly string[]).includes(ammo.damage)) {
    errors[`${prefix}.ammo.damage`] = DISCRIMINATOR_KEY
  }

  if (ammo.damage === 'ball' && !isPlainObject(ammo.ballDamage))
    errors[`${prefix}.ammo.ball.damage`] = BRANCH_KEY
  if (ammo.damage === 'buck') {
    if (!isPlainObject(ammo.buckDamage))
      errors[`${prefix}.ammo.buck.damage`] = BRANCH_KEY
    const count = requireSafeIntField(ammo.projectileCount, `${prefix}.ammo.buck.projectile_count`, errors, true)
    if (count !== null && count < 1)
      errors[`${prefix}.ammo.buck.projectile_count`] = PROJECTILE_KEY
  }
  if (ammo.damage === 'explosive') {
    if (!ammo.explosives.length)
      errors[`${prefix}.ammo.explosive`] = EXPLOSIVE_KEY
    ammo.explosives.forEach((entry, index) => {
      const path = `${prefix}.ammo.explosive.${entry.id || index}`
      if (!entry.type.trim())
        errors[`${path}.type`] = REQUIRED_KEY
      if (!isPlainObject(entry.damage))
        errors[`${path}.damage`] = OPAQUE_DAMAGE_KEY
      requireNonNegativeNumber(entry.lethal, `${path}.lethal`, errors)
      requireNonNegativeNumber(entry.wound, `${path}.wound`, errors)
      requireNonNegativeNumber(entry.persistance, `${path}.persistance`, errors)
      requireNonNegativeNumber(entry.fuse, `${path}.fuse`, errors)
    })
  }
}

function validateMagazineLocal(
  draft: OpcodeInventoryDraft,
  prefix: string,
  errors: Record<string, string>,
) {
  const magazine = draft.magazine
  if (!magazine)
    return

  if (!magazine.caliber.trim())
    errors[`${prefix}.magazine.caliber`] = CALIBER_KEY

  const capacity = requireSafeIntField(magazine.containsMax, `${prefix}.magazine.ammo.contains_max`, errors, true)
  if (capacity !== null && capacity < 1)
    errors[`${prefix}.magazine.ammo.contains_max`] = POSITIVE_KEY

  if (capacity !== null && magazine.loaded.length > capacity)
    errors[`${prefix}.magazine.ammo.loaded`] = CAPACITY_KEY

  for (const token of Object.keys(magazine.kinds)) {
    if (token.length !== 1)
      errors[`${prefix}.magazine.ammo.kinds.${token}`] = TOKEN_KEY
  }

  for (const token of magazine.loaded) {
    if (!Object.hasOwn(magazine.kinds, token))
      errors[`${prefix}.magazine.ammo.loaded`] = LOADED_TOKEN_KEY
  }

  const originalKinds = asRecord(asRecord(asRecord(draft.source.magazine).ammo).kinds)
  for (const [token, ammoId] of Object.entries(magazine.kinds)) {
    const original = originalKinds[token]
    if (typeof original === 'string' && original !== ammoId && magazine.loaded.includes(token))
      errors[`${prefix}.magazine.ammo.kinds.${token}`] = TOKEN_REASSIGN_KEY
  }
}

function validateArmor(
  draft: OpcodeInventoryDraft,
  prefix: string,
  errors: Record<string, string>,
) {
  const armor = draft.armor
  if (!armor)
    return

  if (!armor.material.trim())
    errors[`${prefix}.armor.material`] = REQUIRED_KEY

  const layer = requireSafeIntField(armor.layer, `${prefix}.armor.layer`, errors, true)
  if (layer !== null && layer < 0)
    errors[`${prefix}.armor.layer`] = NON_NEGATIVE_KEY

  for (const part of HEALTH_PARTS) {
    const raw = armor.protection[part].trim()
    if (!raw)
      continue
    const value = parseSafeInteger(raw)
    if (value === null)
      errors[`${prefix}.armor.protection.normal.${part}`] = SAFE_INTEGER_KEY
    else if (value < 0)
      errors[`${prefix}.armor.protection.normal.${part}`] = NON_NEGATIVE_KEY
  }

  const knownParts = new Set<string>(HEALTH_PARTS)
  const sourceProtection = asRecord(asRecord(asRecord(draft.source.armor).protection).normal)
  for (const key of Object.keys(sourceProtection)) {
    if (!knownParts.has(key))
      errors[`${prefix}.armor.protection.normal.${key}`] = BODY_PART_KEY
  }
}

function validateCrossReferences(
  drafts: OpcodeInventoryDraft[],
  errors: Record<string, string>,
) {
  const byId = new Map(drafts.map(draft => [draft.id, draft]))

  drafts.forEach((draft, index) => {
    if (draft.kind === 'weapon' && draft.weapon?.magazineId) {
      const magazine = byId.get(draft.weapon.magazineId)
      if (!magazine || magazine.kind !== 'magazine') {
        errors[`inventory.${index}.weapon.magazine`] = MAGAZINE_REF_KEY
      }
      else if (draft.weapon.type === 'ranged' && !sameCaliber(draft.weapon.caliber, magazine.magazine?.caliber || '')) {
        errors[`inventory.${index}.weapon.magazine`] = MAGAZINE_CALIBER_KEY
      }
    }

    if (draft.kind !== 'magazine' || !draft.magazine)
      return

    for (const [token, ammoId] of Object.entries(draft.magazine.kinds)) {
      const ammo = byId.get(ammoId)
      if (!ammo || ammo.kind !== 'ammo') {
        errors[`inventory.${index}.magazine.ammo.kinds.${token}`] = TOKEN_AMMO_KEY
        continue
      }
      if (!sameCaliber(draft.magazine.caliber, ammo.ammo?.caliber || ''))
        errors[`inventory.${index}.magazine.ammo.kinds.${token}`] = CALIBER_KEY
    }
  })
}

function nextAvailableToken(kinds: Record<string, string>): string | null {
  for (const token of OPCODE_MAGAZINE_TOKEN_ALPHABET) {
    if (!Object.hasOwn(kinds, token))
      return token
  }
  return null
}

function pushIndex(
  map: Map<string, OpcodeInventoryDraft[]>,
  key: string,
  draft: OpcodeInventoryDraft,
) {
  const current = map.get(key) || []
  current.push(draft)
  map.set(key, current)
}

function requireFinite(
  raw: string,
  path: string,
  errors: Record<string, string>,
  required: boolean,
) {
  if (!raw.trim()) {
    if (required)
      errors[path] = REQUIRED_KEY
    return null
  }
  const parsed = parseFiniteNumber(raw)
  if (parsed === null)
    errors[path] = FINITE_KEY
  return parsed
}

function requireNonNegativeNumber(
  raw: string,
  path: string,
  errors: Record<string, string>,
) {
  const parsed = requireFinite(raw, path, errors, true)
  if (parsed !== null && parsed < 0)
    errors[path] = NON_NEGATIVE_KEY
  return parsed
}

function requireSafeIntField(
  raw: string,
  path: string,
  errors: Record<string, string>,
  required: boolean,
): number | null {
  if (!raw.trim()) {
    if (required)
      errors[path] = REQUIRED_KEY
    return null
  }
  const parsed = parseSafeInteger(raw)
  if (parsed === null)
    errors[path] = SAFE_INTEGER_KEY
  return parsed
}

function writeIntegerField(target: Record<string, unknown>, key: string, raw: string) {
  const parsed = parseSafeInteger(raw)
  if (parsed === null)
    return
  target[key] = parsed
}

function writeNumberField(target: Record<string, unknown>, key: string, raw: string) {
  const parsed = parseFiniteNumber(raw)
  if (parsed === null)
    return
  target[key] = parsed
}

function stringifyUnknownNumber(value: unknown, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value))
    return String(value)
  if (typeof value === 'string')
    return value
  return fallback
}

function parseSafeInteger(raw: string): number | null {
  const value = raw.trim()
  if (!value || !/^[+-]?\d+$/.test(value))
    return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function parseFiniteNumber(raw: string): number | null {
  const value = raw.trim()
  if (!value)
    return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function requireSafeInteger(raw: string): number {
  const parsed = parseSafeInteger(raw)
  if (parsed === null)
    throw new Error('Invalid Opcode inventory count')
  return parsed
}

function cloneRecord(value: unknown): Record<string, unknown> {
  return cloneJson(asRecord(value))
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function asRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
