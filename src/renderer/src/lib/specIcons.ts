// WoW spec icon utilities.
// Icons are served from the Wowhead CDN using the `classicon_<class>_<spec>` slug format.
// Falls back to null so callers can hide the <img> on error or unknown spec.

const BASE = 'https://wow.zamimg.com/images/wow/icons/small'

// Spec ID → icon slug (exhaustive, all retail specs as of TWW).
const SPEC_ID_MAP: Record<number, string> = {
  // Death Knight
  250: 'classicon_deathknight_blood',
  251: 'classicon_deathknight_frost',
  252: 'classicon_deathknight_unholy',
  // Demon Hunter
  577: 'classicon_demonhunter_havoc',
  581: 'classicon_demonhunter_vengeance',
  // Druid
  102: 'classicon_druid_balance',
  103: 'classicon_druid_feral',
  104: 'classicon_druid_guardian',
  105: 'classicon_druid_restoration',
  // Evoker
  1467: 'classicon_evoker_devastation',
  1468: 'classicon_evoker_preservation',
  1473: 'classicon_evoker_augmentation',
  // Hunter
  253: 'classicon_hunter_beastmastery',
  254: 'classicon_hunter_marksmanship',
  255: 'classicon_hunter_survival',
  // Mage
   62: 'classicon_mage_arcane',
   63: 'classicon_mage_fire',
   64: 'classicon_mage_frost',
  // Monk
  268: 'classicon_monk_brewmaster',
  270: 'classicon_monk_mistweaver',
  269: 'classicon_monk_windwalker',
  // Paladin
   65: 'classicon_paladin_holy',
   66: 'classicon_paladin_protection',
   70: 'classicon_paladin_retribution',
  // Priest
  256: 'classicon_priest_discipline',
  257: 'classicon_priest_holy',
  258: 'classicon_priest_shadow',
  // Rogue
  259: 'classicon_rogue_assassination',
  260: 'classicon_rogue_outlaw',
  261: 'classicon_rogue_subtlety',
  // Shaman
  262: 'classicon_shaman_elemental',
  263: 'classicon_shaman_enhancement',
  264: 'classicon_shaman_restoration',
  // Warlock
  265: 'classicon_warlock_affliction',
  266: 'classicon_warlock_demonology',
  267: 'classicon_warlock_destruction',
  // Warrior
   71: 'classicon_warrior_arms',
   72: 'classicon_warrior_fury',
   73: 'classicon_warrior_protection',
}

// Spec name (lowercase) → icon slug — used when only the spec string is available
// (e.g. in the results panel where spec_id isn't on the job object).
// Ambiguous names (frost/restoration/holy/protection) resolve to the most common class.
const SPEC_NAME_MAP: Record<string, string> = {
  // Death Knight
  blood:           'classicon_deathknight_blood',
  unholy:          'classicon_deathknight_unholy',
  // Demon Hunter
  havoc:           'classicon_demonhunter_havoc',
  vengeance:       'classicon_demonhunter_vengeance',
  // Druid
  balance:         'classicon_druid_balance',
  feral:           'classicon_druid_feral',
  guardian:        'classicon_druid_guardian',
  // Evoker
  devastation:     'classicon_evoker_devastation',
  preservation:    'classicon_evoker_preservation',
  augmentation:    'classicon_evoker_augmentation',
  // Hunter
  beast_mastery:   'classicon_hunter_beastmastery',
  beastmastery:    'classicon_hunter_beastmastery',
  marksmanship:    'classicon_hunter_marksmanship',
  survival:        'classicon_hunter_survival',
  // Mage
  arcane:          'classicon_mage_arcane',
  fire:            'classicon_mage_fire',
  // Monk
  brewmaster:      'classicon_monk_brewmaster',
  mistweaver:      'classicon_monk_mistweaver',
  windwalker:      'classicon_monk_windwalker',
  // Paladin
  retribution:     'classicon_paladin_retribution',
  // Priest
  discipline:      'classicon_priest_discipline',
  shadow:          'classicon_priest_shadow',
  // Rogue
  assassination:   'classicon_rogue_assassination',
  outlaw:          'classicon_rogue_outlaw',
  subtlety:        'classicon_rogue_subtlety',
  // Shaman
  elemental:       'classicon_shaman_elemental',
  enhancement:     'classicon_shaman_enhancement',
  // Warlock
  affliction:      'classicon_warlock_affliction',
  demonology:      'classicon_warlock_demonology',
  destruction:     'classicon_warlock_destruction',
  // Warrior
  arms:            'classicon_warrior_arms',
  fury:            'classicon_warrior_fury',
  // Ambiguous — resolve to most commonly played class for that name
  frost:           'classicon_mage_frost',        // Frost Mage or Frost DK
  restoration:     'classicon_shaman_restoration', // Resto Shaman or Resto Druid
  holy:            'classicon_paladin_holy',        // Holy Pala or Holy Priest
  protection:      'classicon_warrior_protection',  // Prot War or Prot Pala
}

/** Returns an absolute icon URL for the given WoW spec ID, or null if unknown. */
export function iconUrlFromSpecId(specId: number): string | null {
  const slug = SPEC_ID_MAP[specId]
  return slug ? `${BASE}/${slug}.jpg` : null
}

/** Returns an absolute icon URL for a spec name string (case-insensitive), or null if unknown. */
export function iconUrlFromSpecName(specName: string): string | null {
  const slug = SPEC_NAME_MAP[specName.toLowerCase().replace(/\s+/g, '_')]
  return slug ? `${BASE}/${slug}.jpg` : null
}
