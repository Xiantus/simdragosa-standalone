import { describe, it, expect } from 'vitest'
import { exportableLinks, formatLinkList, formatDiscordMessage, type ReportLinkJob } from '../reportLinks'

const DIFF_LABELS = { 'raid-heroic': 'Heroic', 'dungeon-mythic10': 'M+10' }

function job(over: Partial<ReportLinkJob> = {}): ReportLinkJob {
  return {
    char_name: 'Dragosa',
    spec: 'frost',
    difficulty: 'raid-heroic',
    build_label: 'Default',
    status: 'done',
    url: 'https://www.raidbots.com/simbot/report/abc123',
    ...over,
  }
}

describe('exportableLinks', () => {
  it('keeps only done jobs that have a url', () => {
    const jobs = [
      job(),
      job({ status: 'error', url: undefined }),
      job({ status: 'running', url: undefined }),
      job({ status: 'done', url: undefined }),
    ]
    expect(exportableLinks(jobs)).toHaveLength(1)
  })

  it('de-duplicates by url and preserves input order', () => {
    const jobs = [
      job({ url: 'https://www.raidbots.com/simbot/report/aaa' }),
      job({ url: 'https://www.raidbots.com/simbot/report/bbb' }),
      job({ url: 'https://www.raidbots.com/simbot/report/aaa' }),
    ]
    expect(exportableLinks(jobs).map((j) => j.url)).toEqual([
      'https://www.raidbots.com/simbot/report/aaa',
      'https://www.raidbots.com/simbot/report/bbb',
    ])
  })
})

describe('formatLinkList', () => {
  it('emits one bare url per line', () => {
    const text = formatLinkList([
      job({ url: 'https://www.raidbots.com/simbot/report/aaa' }),
      job({ url: ' https://www.raidbots.com/simbot/report/bbb ' }),
      job({ status: 'error', url: undefined }),
    ])
    expect(text).toBe(
      'https://www.raidbots.com/simbot/report/aaa\nhttps://www.raidbots.com/simbot/report/bbb',
    )
  })

  it('returns an empty string when nothing is exportable', () => {
    expect(formatLinkList([job({ status: 'running', url: undefined })])).toBe('')
  })
})

describe('formatDiscordMessage', () => {
  it('labels each line and still puts one link per line', () => {
    const text = formatDiscordMessage(
      [
        job({ url: 'https://www.raidbots.com/simbot/report/aaa' }),
        job({
          char_name: 'Alt',
          spec: 'assassination',
          difficulty: 'dungeon-mythic10',
          build_label: 'QE Healing',
          url: 'https://www.raidbots.com/simbot/report/bbb',
        }),
      ],
      DIFF_LABELS,
    )
    expect(text.split('\n')).toEqual([
      'Dragosa · Frost · Heroic — https://www.raidbots.com/simbot/report/aaa',
      'Alt · Assassination · M+10 · QE Healing — https://www.raidbots.com/simbot/report/bbb',
    ])
  })

  it('falls back to the raw difficulty key when unlabelled', () => {
    const text = formatDiscordMessage([job({ difficulty: 'raid-mythic' })], DIFF_LABELS)
    expect(text).toContain('raid-mythic')
  })
})
