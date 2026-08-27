import { difficultyKeyForRow, QE_M10_INDEX, QE_RAID_TOGGLE } from './qe-import'

describe('difficultyKeyForRow', () => {
  it('maps fully-upgraded raid rows to their difficulty', () => {
    expect(difficultyKeyForRow({ dropLoc: 'Raid', dropDifficulty: 1, dropType: 'max' })).toBe('raid-normal')
    expect(difficultyKeyForRow({ dropLoc: 'Raid', dropDifficulty: 2, dropType: 'max' })).toBe('raid-heroic')
    expect(difficultyKeyForRow({ dropLoc: 'Raid', dropDifficulty: 3, dropType: 'max' })).toBe('raid-mythic')
  })

  it('skips raid rows that are not fully upgraded', () => {
    expect(difficultyKeyForRow({ dropLoc: 'Raid', dropDifficulty: 3, dropType: 'drop' })).toBeNull()
    expect(difficultyKeyForRow({ dropLoc: 'Raid', dropDifficulty: 3, dropType: 'bonus' })).toBeNull()
  })

  it('skips LFR', () => {
    expect(difficultyKeyForRow({ dropLoc: 'Raid', dropDifficulty: 0, dropType: 'max' })).toBeNull()
  })

  it('splits +10 dungeon rows into end-of-run and vault', () => {
    expect(difficultyKeyForRow({ dropLoc: 'Dungeon', dropDifficulty: QE_M10_INDEX, dropType: 'max' }))
      .toBe('dungeon-mythic10')
    expect(difficultyKeyForRow({ dropLoc: 'Dungeon', dropDifficulty: QE_M10_INDEX, dropType: 'bonus' }))
      .toBe('dungeon-mythic-weekly10')
    expect(difficultyKeyForRow({ dropLoc: 'Dungeon', dropDifficulty: QE_M10_INDEX, dropType: 'drop' }))
      .toBeNull()
  })

  it('skips key levels below +10', () => {
    expect(difficultyKeyForRow({ dropLoc: 'Dungeon', dropDifficulty: 4, dropType: 'max' })).toBeNull()
  })

  it('skips crafted and delve rows', () => {
    expect(difficultyKeyForRow({ dropLoc: 'Crafted', dropDifficulty: '', dropType: 'drop' })).toBeNull()
    expect(difficultyKeyForRow({ dropLoc: 'Delves', dropDifficulty: '', dropType: 'drop' })).toBeNull()
  })

  it('still reads pre-2026 reports, which have no dropType', () => {
    expect(difficultyKeyForRow({ dropLoc: 'Raid', dropDifficulty: 5 })).toBe('raid-heroic')
    expect(difficultyKeyForRow({ dropLoc: 'Raid', dropDifficulty: 7 })).toBe('raid-mythic')
    expect(difficultyKeyForRow({ dropLoc: 'Dungeon', dropDifficulty: 6 })).toBe('dungeon-mythic10')
    expect(difficultyKeyForRow({ dropLoc: 'Raid', dropDifficulty: 4 })).toBeNull()
  })
})

describe('QE_RAID_TOGGLE', () => {
  it('covers every raid difficulty the app offers', () => {
    expect(Object.keys(QE_RAID_TOGGLE).sort()).toEqual(['raid-heroic', 'raid-mythic', 'raid-normal'])
  })
})
