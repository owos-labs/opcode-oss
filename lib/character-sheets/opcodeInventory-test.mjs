import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyOpcodeArmorCoveragePreset,
  applyOpcodeModEffectRangeBand,
  buildOpcodeInventoryStatus,
  cloneOpcodeInventoryDrafts,
  collectOpcodeInventoryCalibers,
  collectOpcodeInventoryReferences,
  createOpcodeInventoryDraft,
  createOpcodeModEffectDraft,
  emptyMagazine,
  formatOpcodeModEffectLine,
  groupOpcodeMagazineRounds,
  loadMagazineRound,
  loadMagazineRounds,
  opcodeArmorCoveragePreset,
  opcodeModEffectRangeBand,
  retainOpcodeInventoryClientKeys,
  summarizeOpcodeInventoryItem,
  summarizeOpcodeModEffect,
  summarizeOpcodeWeaponList,
  indexOpcodeInventory,
  readNextMagazineRound,
  readOpcodeInventory,
  setWeaponMagazine,
  unloadMagazineRound,
  validateOpcodeInventoryDrafts,
  writeOpcodeInventory,
} from './opcodeInventory.ts'

const AMMO_PPBS = '50000000-0000-4000-8000-000000000003'
const AMMO_PS = '50000000-0000-4000-8000-000000000004'
const MAGAZINE_ID = '50000000-0000-4000-8000-000000000013'
const WEAPON_ID = '50000000-0000-4000-8000-000000000002'
const KNIFE_ID = '50000000-0000-4000-8000-000000000001'
const ARMOR_ID = '60000000-0000-4000-8000-000000000007'
const MOD_RECEIVER = '60000000-0000-4000-8000-000000000001'
const MOD_ATTACHMENT = '60000000-0000-4000-8000-000000000002'

function richStatus() {
  return {
    stats: { ref: { mod: 5 }, extra: { grit: { mod: 1 } } },
    derivated: { sens: { s: { mod: 10 } } },
    health: { mode: 'normal', normal: { head: { base: 6, mod: 0 } } },
    armor: { normal: { torso: 12, head: 12 } },
    skills: { base: { charm: { mod: 10 } }, extra: {} },
    leftover: { keep: true },
    inventory: [
      {
        id: KNIFE_ID,
        name: 'knife',
        type: 'weapon',
        skill: {
          martial: { mul: 1, specialization: { blade: { mul: 2 } } },
          melee: { mul: 1 },
        },
        count: 1,
        desc: 'a short blade',
        unknownItem: { secret: true },
        weapon: {
          type: 'melee',
          range: 1,
          damage: { dice: '2d4' },
          rof: 20,
          mode: 0,
        },
      },
      {
        id: WEAPON_ID,
        name: 'aek-971',
        type: 'weapon',
        count: 1,
        desc: 'aek-971 (kord 6p67)',
        weapon: {
          type: 'ranged',
          skill: {
            marksmanship: { mul: 1, specialization: { rifle: { mul: 2 } } },
          },
          range: 400,
          caliber: '5.45x39',
          accuracy: 1,
          concealability: 3,
          rof: 900,
          mode: 3,
          reliability: 1,
          weight: 3.3,
          damage: {},
          modifications: {
            receiver: {
              [MOD_RECEIVER]: {
                name: 'AEK-971 Modernized HG',
                effects: { 1: { enable_slot: 'attachment', count: 3, max: 5 } },
                description: 'Ratnik handguard.',
              },
            },
            attachment: {
              [MOD_ATTACHMENT]: {
                name: 'Perst-4',
                effects: { 1: { mod: { target: 'diff', value: { flat: -1 } } } },
                description: 'Laser / IR illuminator.',
              },
            },
            magazine: MAGAZINE_ID,
          },
        },
      },
      {
        id: AMMO_PPBS,
        name: '5.45x39mm 7n39 ppbs gs',
        type: 'ammo',
        count: 20,
        ammo: {
          caliber: '5.45x39',
          damage: 'ball',
          ball: { damage: { expression: '3d6-2' } },
          penetration: 55,
        },
        desc: '',
      },
      {
        id: MAGAZINE_ID,
        name: '5.45x39mm AK-74 6L20 30rnd Magazine',
        type: 'magazine',
        count: 1,
        magazine: {
          caliber: '5.45x39',
          ammo: {
            kinds: {
              0: AMMO_PS,
              1: AMMO_PPBS,
            },
            contains_max: 30,
            loaded: '111001001000011000110011011111',
          },
        },
        desc: 'Bakelite magazine for AK-74 platform weapons.',
      },
      {
        id: AMMO_PS,
        name: '5.45x39mm 7n6 ps gs',
        type: 'ammo',
        count: 0,
        ammo: {
          caliber: '5.45x39',
          damage: 'ball',
          ball: { damage: {} },
          penetration: 30,
        },
        desc: '',
      },
      {
        id: '50000000-0000-4000-8000-000000000005',
        name: '12x70 7mm buckshot',
        type: 'ammo',
        count: 5,
        ammo: {
          caliber: '12x70',
          damage: 'buck',
          buck: { projectile_count: 5, damage: {} },
          penetration: 10,
        },
        desc: '',
      },
      {
        id: '50000000-0000-4000-8000-000000000006',
        name: 'M67 Frag',
        type: 'throwable',
        count: 5,
        ammo: {
          damage: 'explosive',
          explosive: {
            0: {
              type: 'frag',
              damage: {},
              lethal: 2,
              wound: 3,
              persistance: 0,
              fuse: 5,
            },
          },
          penetration: 0,
        },
        desc: 'M67 Fragmentation Grenade issued by NATO forces.',
      },
      {
        id: '50000000-0000-4000-8000-000000000007',
        name: 'bandage',
        count: 3,
        desc: '',
      },
      {
        id: ARMOR_ID,
        name: 'Generic Level 3 plate',
        type: 'armor',
        count: 1,
        armor: {
          material: 'ceramic',
          layer: 0,
          protection: {
            normal: { torso: 45, hand_primary: 45, hand_secondary: 45 },
          },
        },
        desc: '',
      },
    ],
  }
}

test('passthroughs weapon.modifications.magazine as one magazine UUID on the full status', () => {
  const original = richStatus()
  const snapshot = structuredClone(original)
  const drafts = readOpcodeInventory(original)
  const weapon = drafts.find(item => item.id === WEAPON_ID)

  assert.equal(weapon.weapon.magazineId, MAGAZINE_ID)
  assert.equal(weapon.weapon.modifications.some(mod => mod.slot === 'magazine'), false)

  const status = buildOpcodeInventoryStatus(original, drafts)
  const written = status.inventory.find(item => item.id === WEAPON_ID)

  assert.equal(typeof written.weapon.modifications.magazine, 'string')
  assert.equal(written.weapon.modifications.magazine, MAGAZINE_ID)
  assert.equal(written.weapon.modifications.attachment[MOD_ATTACHMENT].name, 'Perst-4')
  assert.deepEqual(status.stats, original.stats)
  assert.deepEqual(status.health, original.health)
  assert.deepEqual(original, snapshot)
})

test('round-trips a rich inventory without dropping unknown or opaque fields', () => {
  const original = richStatus()
  const snapshot = structuredClone(original)
  const drafts = readOpcodeInventory(original)
  const written = writeOpcodeInventory(drafts)

  assert.equal(drafts.length, original.inventory.length)
  assert.deepEqual(written[0].weapon.skill.martial, original.inventory[0].skill.martial)
  assert.equal(written[0].skill, undefined)
  assert.deepEqual(written[0].unknownItem, { secret: true })
  assert.deepEqual(written[0].weapon.damage, { dice: '2d4' })
  assert.deepEqual(written[1].weapon.modifications.attachment[MOD_ATTACHMENT].effects, original.inventory[1].weapon.modifications.attachment[MOD_ATTACHMENT].effects)
  assert.equal(written[1].weapon.modifications.magazine, MAGAZINE_ID)
  assert.deepEqual(written[2].ammo.ball.damage, { expression: '3d6-2' })
  assert.deepEqual(written[3].magazine.ammo.kinds, original.inventory[3].magazine.ammo.kinds)
  assert.equal(written[3].magazine.ammo.loaded, original.inventory[3].magazine.ammo.loaded)
  assert.equal(written[4].count, 0)
  assert.equal(written[6].ammo.explosive[0].persistance, 0)
  assert.equal(written[7].type, undefined)
  assert.deepEqual(original, snapshot)
})

test('rewrites a legacy root-level weapon skill under weapon.skill', () => {
  const drafts = readOpcodeInventory(richStatus())
  const knife = drafts.find(item => item.id === KNIFE_ID)
  assert.equal(knife.weapon.skills.some(skill => skill.name === 'martial'), true)
  const written = writeOpcodeInventory(drafts).find(item => item.id === KNIFE_ID)
  assert.deepEqual(written.weapon.skill.melee, { mul: 1 })
  assert.equal(written.skill, undefined)
})

test('creates typed drafts without leaking client-only fields', () => {
  for (const kind of ['generic', 'weapon', 'ammo', 'magazine', 'throwable', 'armor']) {
    const draft = createOpcodeInventoryDraft(kind)
    draft.name = 'Item'
    const [written] = writeOpcodeInventory([draft])
    assert.equal(written.clientKey, undefined)
    assert.equal(written.source, undefined)
    assert.equal(typeof written.id, 'string')
    if (kind === 'generic')
      assert.equal(written.type, undefined)
    else
      assert.equal(written.type, kind)
    if (kind === 'magazine')
      assert.equal(written.count, 1)
    if (kind === 'throwable')
      assert.equal(written.ammo.damage, 'explosive')
    if (kind === 'ammo')
      assert.deepEqual(written.ammo.ball.damage, {})
    if (kind === 'weapon')
      assert.deepEqual(written.weapon.damage, {})
  }
})

test('validates envelope, typed blocks, discriminators, and references with stable paths', () => {
  const drafts = readOpcodeInventory(richStatus())
  assert.deepEqual(validateOpcodeInventoryDrafts(drafts), {})

  drafts[1].id = drafts[0].id
  drafts[2].ammo.damage = 'plasma'
  drafts[5].ammo.projectileCount = '0'
  drafts[8].armor.protection.head = 'nope'
  drafts[1].weapon.modifications[0].id = drafts[1].weapon.modifications[1].id
  const magazine = drafts.find(item => item.kind === 'magazine')
  magazine.magazine.kinds['9'] = 'missing-ammo'
  magazine.count = '2'

  const generic = createOpcodeInventoryDraft('weapon')
  generic.name = 'Broken rifle'
  generic.weapon = undefined
  drafts.push(generic)

  const errors = validateOpcodeInventoryDrafts(drafts)
  assert.equal(errors['inventory.1.id'], 'characterSheets.inventory.validation.duplicateId')
  assert.equal(errors['inventory.2.ammo.damage'], 'characterSheets.inventory.validation.damageKind')
  assert.equal(errors['inventory.5.ammo.buck.projectile_count'], 'characterSheets.inventory.validation.projectileCount')
  assert.equal(errors['inventory.8.armor.protection.normal.head'], 'characterSheets.inventory.validation.safeInteger')
  assert.equal(errors['inventory.1.weapon.modifications.1.id'], 'characterSheets.inventory.validation.duplicateModification')
  assert.equal(errors['inventory.3.magazine.ammo.kinds.9'], 'characterSheets.inventory.validation.tokenAmmo')
  assert.equal(errors['inventory.3.count'], 'characterSheets.inventory.validation.magazineCount')
  assert.equal(errors['inventory.9.weapon'], 'characterSheets.inventory.validation.missingBlock')
})

test('rejects token reassignment while that token is still loaded', () => {
  const drafts = readOpcodeInventory(richStatus())
  const magazine = drafts.find(item => item.kind === 'magazine')
  magazine.magazine.kinds['1'] = AMMO_PS
  const errors = validateOpcodeInventoryDrafts(drafts)
  assert.equal(errors['inventory.3.magazine.ammo.kinds.1'], 'characterSheets.inventory.validation.tokenReassigned')
})

test('groups consecutive magazine rounds into stacks', () => {
  const groups = groupOpcodeMagazineRounds([
    { token: '1', ammoId: AMMO_PPBS, ammoName: 'ppbs', index: 0 },
    { token: '1', ammoId: AMMO_PPBS, ammoName: 'ppbs', index: 1 },
    { token: '0', ammoId: AMMO_PS, ammoName: 'ps', index: 2 },
    { token: '0', ammoId: AMMO_PS, ammoName: 'ps', index: 3 },
    { token: '0', ammoId: AMMO_PS, ammoName: 'ps', index: 4 },
  ])
  assert.deepEqual(groups, [
    { token: '1', ammoId: AMMO_PPBS, ammoName: 'ppbs', index: 0, count: 2 },
    { token: '0', ammoId: AMMO_PS, ammoName: 'ps', index: 2, count: 3 },
  ])
})

test('loads and unloads magazine rounds without mutating the original drafts', () => {
  const original = readOpcodeInventory(richStatus())
  const snapshot = structuredClone(original)
  const firstUnload = unloadMagazineRound(original, MAGAZINE_ID, 0)
  assert.equal(firstUnload.ok, true)
  const afterUnload = firstUnload.drafts.find(item => item.id === MAGAZINE_ID)
  const returnedAmmo = firstUnload.drafts.find(item => item.id === AMMO_PPBS)
  assert.equal(afterUnload.magazine.loaded.startsWith('1'), true)
  assert.equal(Number(returnedAmmo.count), 21)
  assert.deepEqual(original, snapshot)

  const loaded = loadMagazineRound(firstUnload.drafts, MAGAZINE_ID, AMMO_PPBS)
  assert.equal(loaded.ok, true)
  const magazine = loaded.drafts.find(item => item.id === MAGAZINE_ID)
  const ammo = loaded.drafts.find(item => item.id === AMMO_PPBS)
  assert.equal(magazine.magazine.loaded.endsWith('1'), true)
  assert.equal(magazine.magazine.loaded.length, original.find(item => item.id === MAGAZINE_ID).magazine.loaded.length)
  assert.equal(Number(ammo.count), 20)
})

test('preserves mixed ammo order and refuses caliber or capacity mutations', () => {
  const drafts = readOpcodeInventory(richStatus())
  const next = readNextMagazineRound(drafts, MAGAZINE_ID)
  assert.equal(next.token, '1')
  assert.equal(next.ammoId, AMMO_PPBS)

  const empty = createOpcodeInventoryDraft('ammo')
  empty.name = '9mm'
  empty.ammo.caliber = '9x19'
  empty.count = '10'
  drafts.push(empty)

  const caliberFail = loadMagazineRound(drafts, MAGAZINE_ID, empty.id)
  assert.equal(caliberFail.ok, false)
  assert.equal(caliberFail.drafts, drafts)

  const magazine = drafts.find(item => item.id === MAGAZINE_ID)
  magazine.magazine.containsMax = String(magazine.magazine.loaded.length)
  const capacityFail = loadMagazineRound(drafts, MAGAZINE_ID, AMMO_PPBS)
  assert.equal(capacityFail.ok, false)
  assert.equal(capacityFail.drafts, drafts)
})

test('blocks deleting referenced ammo and magazines', () => {
  const drafts = readOpcodeInventory(richStatus())
  const ammoRefs = collectOpcodeInventoryReferences(drafts, AMMO_PPBS)
  assert.equal(ammoRefs.some(ref => ref.kind === 'magazine' && ref.itemId === MAGAZINE_ID), true)
  const magazineRefs = collectOpcodeInventoryReferences(drafts, MAGAZINE_ID)
  assert.equal(magazineRefs.some(ref => ref.kind === 'weapon' && ref.itemId === WEAPON_ID), true)
  assert.deepEqual(collectOpcodeInventoryReferences(drafts, KNIFE_ID), [])
})

test('replaces only inventory when building a complete status document', () => {
  const original = richStatus()
  const snapshot = structuredClone(original)
  const drafts = readOpcodeInventory(original)
  drafts[7].count = '9'
  const next = buildOpcodeInventoryStatus(original, drafts)
  assert.deepEqual(next.stats, original.stats)
  assert.deepEqual(next.derivated, original.derivated)
  assert.deepEqual(next.health, original.health)
  assert.deepEqual(next.armor, original.armor)
  assert.deepEqual(next.skills, original.skills)
  assert.deepEqual(next.leftover, original.leftover)
  assert.equal(next.inventory[7].count, 9)
  assert.deepEqual(original, snapshot)
  const indexed = indexOpcodeInventory(drafts)
  assert.equal(indexed.byId.get(WEAPON_ID).kind, 'weapon')
  assert.equal(indexed.ammoByCaliber.get('5.45x39').length, 2)
})

test('sets a weapon magazine only when the caliber matches', () => {
  const drafts = readOpcodeInventory(richStatus())
  const cleared = setWeaponMagazine(drafts, WEAPON_ID, '')
  assert.equal(cleared.ok, true)
  assert.equal(cleared.drafts.find(item => item.id === WEAPON_ID).weapon.magazineId, '')

  const restored = setWeaponMagazine(cleared.drafts, WEAPON_ID, MAGAZINE_ID)
  assert.equal(restored.ok, true)

  const other = createOpcodeInventoryDraft('magazine')
  other.name = '9mm mag'
  other.magazine.caliber = '9x19'
  drafts.push(other)
  const mismatch = setWeaponMagazine(drafts, WEAPON_ID, other.id)
  assert.equal(mismatch.ok, false)
  assert.equal(mismatch.drafts, drafts)
})

test('cloneOpcodeInventoryDrafts isolates later magazine edits', () => {
  const drafts = readOpcodeInventory(richStatus())
  const copy = cloneOpcodeInventoryDrafts(drafts)
  copy[3].magazine.loaded = ''
  assert.notEqual(drafts[3].magazine.loaded, '')
})

test('retainOpcodeInventoryClientKeys keeps editor keys across a round-trip read', () => {
  const original = readOpcodeInventory(richStatus())
  const reread = readOpcodeInventory(richStatus())
  assert.notEqual(reread[1].clientKey, original[1].clientKey)
  retainOpcodeInventoryClientKeys(reread, original)
  assert.equal(reread[1].clientKey, original[1].clientKey)
  assert.equal(reread[1].id, original[1].id)
})

test('collectOpcodeInventoryCalibers returns unique sheet calibers', () => {
  const drafts = readOpcodeInventory(richStatus())
  assert.deepEqual(collectOpcodeInventoryCalibers(drafts), ['12x70', '5.45x39'])
})

test('fills and empties a magazine in bulk', () => {
  const drafts = readOpcodeInventory(richStatus())
  const magazineBefore = drafts.find(item => item.id === MAGAZINE_ID)
  const loadedTokens = [...magazineBefore.magazine.loaded]
  const ppbsLoaded = loadedTokens.filter(token => magazineBefore.magazine.kinds[token] === AMMO_PPBS).length
  const psLoaded = loadedTokens.filter(token => magazineBefore.magazine.kinds[token] === AMMO_PS).length
  const ppbsBefore = Number(drafts.find(item => item.id === AMMO_PPBS).count)
  const psBefore = Number(drafts.find(item => item.id === AMMO_PS).count)

  const emptied = emptyMagazine(drafts, MAGAZINE_ID)
  assert.equal(emptied.ok, true)
  const emptyMag = emptied.drafts.find(item => item.id === MAGAZINE_ID)
  const looseAfterEmpty = Number(emptied.drafts.find(item => item.id === AMMO_PPBS).count)
  const psAfterEmpty = Number(emptied.drafts.find(item => item.id === AMMO_PS).count)
  assert.equal(emptyMag.magazine.loaded, '')
  assert.deepEqual(emptyMag.magazine.kinds, {})
  assert.equal(looseAfterEmpty, ppbsBefore + ppbsLoaded)
  assert.equal(psAfterEmpty, psBefore + psLoaded)

  const filled = loadMagazineRounds(emptied.drafts, MAGAZINE_ID, AMMO_PPBS, 10)
  assert.equal(filled.ok, true)
  const magazine = filled.drafts.find(item => item.id === MAGAZINE_ID)
  const ammo = filled.drafts.find(item => item.id === AMMO_PPBS)
  assert.equal(magazine.magazine.loaded.length, 10)
  assert.equal(Number(ammo.count), looseAfterEmpty - 10)
})

test('emptying a homogeneous magazine returns every round to loose ammo', () => {
  const drafts = readOpcodeInventory(richStatus())
  const cleared = emptyMagazine(drafts, MAGAZINE_ID)
  const filled = loadMagazineRounds(cleared.drafts, MAGAZINE_ID, AMMO_PPBS, 30)
  assert.equal(filled.ok, true)
  const ppbsBefore = Number(filled.drafts.find(item => item.id === AMMO_PPBS).count)

  const dumped = emptyMagazine(filled.drafts, MAGAZINE_ID)
  assert.equal(dumped.ok, true)
  const magazine = dumped.drafts.find(item => item.id === MAGAZINE_ID)
  assert.equal(magazine.magazine.loaded, '')
  assert.deepEqual(magazine.magazine.kinds, {})
  assert.equal(Number(dumped.drafts.find(item => item.id === AMMO_PPBS).count), ppbsBefore + 30)
})

test('summarizeOpcodeInventoryItem follows a weapon to its magazine', () => {
  const drafts = readOpcodeInventory(richStatus())
  const weapon = drafts.find(item => item.id === WEAPON_ID)
  const summary = summarizeOpcodeInventoryItem(weapon, drafts)
  assert.equal(summary.caliber, '5.45x39')
  assert.equal(summary.magazineName, '5.45x39mm AK-74 6L20 30rnd Magazine')
  assert.equal(summary.capacity, 30)
  assert.equal(summary.loadedCount, 30)
  const card = summarizeOpcodeWeaponList(weapon, drafts)
  assert.equal(card.type, 'ranged')
  assert.deepEqual(card.modes, ['semi', 'auto'])
  assert.equal(card.nextName, '5.45x39mm 7n39 ppbs gs')
  assert.equal(card.attachments.includes('Perst-4'), true)
})

test('reads and writes weapon modification effects', () => {
  const drafts = readOpcodeInventory(richStatus())
  const weapon = drafts.find(item => item.id === WEAPON_ID)
  const laser = weapon.weapon.modifications.find(mod => mod.id === MOD_ATTACHMENT)
  const receiver = weapon.weapon.modifications.find(mod => mod.id === MOD_RECEIVER)
  assert.equal(laser.effects[0].kind, 'mod')
  assert.equal(laser.effects[0].target, 'diff')
  assert.equal(laser.effects[0].flat, '-1')
  assert.equal(receiver.effects[0].kind, 'enable_slot')
  assert.equal(receiver.effects[0].slot, 'attachment')
  assert.equal(receiver.effects[0].count, '3')
  assert.equal(receiver.effects[0].max, '5')

  laser.effects[0].flat = '-2'
  const extra = createOpcodeModEffectDraft('mod')
  extra.target = 'accuracy'
  extra.flat = '3'
  extra.rangeMin = '0.5'
  extra.rangeMax = '1'
  receiver.effects.push(extra)

  const written = writeOpcodeInventory(drafts).find(item => item.id === WEAPON_ID)
  assert.deepEqual(written.weapon.modifications.attachment[MOD_ATTACHMENT].effects, {
    1: { mod: { target: 'diff', value: { flat: -2 } } },
  })
  assert.deepEqual(written.weapon.modifications.receiver[MOD_RECEIVER].effects, {
    1: { enable_slot: 'attachment', count: 3, max: 5 },
    2: { mod: { target: 'accuracy', value: { flat: 3, applied_on: { range_target: { min: 0.5, max: 1 } } } } },
  })
})

test('summarizes weapon modification effects', () => {
  const drafts = readOpcodeInventory(richStatus())
  const weapon = drafts.find(item => item.id === WEAPON_ID)
  const laser = weapon.weapon.modifications.find(mod => mod.id === MOD_ATTACHMENT)
  const receiver = weapon.weapon.modifications.find(mod => mod.id === MOD_RECEIVER)
  assert.deepEqual(summarizeOpcodeModEffect(laser.effects[0]), {
    kind: 'mod',
    target: 'diff',
    amount: '-1',
    band: '',
  })
  assert.deepEqual(summarizeOpcodeModEffect(receiver.effects[0]), {
    kind: 'enable_slot',
    slot: 'attachment',
    count: '3',
    max: '5',
  })
  const optic = createOpcodeModEffectDraft('mod')
  optic.target = 'accuracy'
  optic.flat = '3'
  optic.rangeMin = '0.5'
  optic.rangeMax = '1'
  assert.equal(summarizeOpcodeModEffect(optic).band, 'mid')
  assert.equal(summarizeOpcodeModEffect(optic).amount, '+3')
  const labels = {
    'characterSheets.inventory.modifications.targets.accuracy': 'Accuracy',
    'characterSheets.inventory.modifications.rangeBands.mid': 'Mid',
  }
  assert.equal(
    formatOpcodeModEffectLine(optic, (key) => labels[key] || key),
    'Accuracy · +3 · Mid',
  )
})

test('writes named modification range bands including open extreme range', () => {
  const drafts = readOpcodeInventory(richStatus())
  const weapon = drafts.find(item => item.id === WEAPON_ID)
  const laser = weapon.weapon.modifications.find(mod => mod.id === MOD_ATTACHMENT)
  applyOpcodeModEffectRangeBand(laser.effects[0], 'extreme')
  assert.equal(opcodeModEffectRangeBand(laser.effects[0].rangeMin, laser.effects[0].rangeMax), 'extreme')
  const extreme = writeOpcodeInventory(drafts).find(item => item.id === WEAPON_ID)
  assert.deepEqual(
    extreme.weapon.modifications.attachment[MOD_ATTACHMENT].effects[1].mod.value.applied_on.range_target,
    { min: 2 },
  )

  applyOpcodeModEffectRangeBand(laser.effects[0], 'pointBlank')
  assert.equal(opcodeModEffectRangeBand('0', '0'), 'pointBlank')
  const pointBlank = writeOpcodeInventory(drafts).find(item => item.id === WEAPON_ID)
  assert.deepEqual(
    pointBlank.weapon.modifications.attachment[MOD_ATTACHMENT].effects[1].mod.value.applied_on.range_target,
    { min: 0, max: 0 },
  )
})

test('armor coverage presets write zeroes for uncovered parts', () => {
  const draft = createOpcodeInventoryDraft('armor')
  draft.name = 'plate'
  assert.equal(draft.armor.material, 'ceramic')
  assert.equal(opcodeArmorCoveragePreset(draft.armor.protection), 'none')
  draft.armor.protection = applyOpcodeArmorCoveragePreset(draft.armor.protection, 'helmet')
  assert.equal(opcodeArmorCoveragePreset(draft.armor.protection), 'helmet')
  assert.equal(draft.armor.protection.head, '1')
  assert.equal(draft.armor.protection.torso, '0')
  const [written] = writeOpcodeInventory([draft])
  assert.equal(written.armor.protection.normal.head, 1)
  assert.equal(written.armor.protection.normal.torso, 0)
  assert.equal(written.armor.protection.normal.leg_left, 0)
})

test('rejects an incomplete modification effect', () => {
  const drafts = readOpcodeInventory(richStatus())
  const weapon = drafts.find(item => item.id === WEAPON_ID)
  const receiver = weapon.weapon.modifications.find(mod => mod.id === MOD_RECEIVER)
  const broken = createOpcodeModEffectDraft('mod')
  broken.target = ''
  receiver.effects.push(broken)
  const errors = validateOpcodeInventoryDrafts(drafts)
  const modIndex = weapon.weapon.modifications.findIndex(mod => mod.id === MOD_RECEIVER)
  assert.equal(
    errors[`inventory.1.weapon.modifications.${modIndex}.effects.1.target`],
    'characterSheets.inventory.validation.required',
  )
})
