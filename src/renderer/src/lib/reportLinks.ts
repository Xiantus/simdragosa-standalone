// Helpers for exporting Raidbots report links so they can be pasted into
// bulk droptimizer importers (which accept a Discord message or one link
// per line).

export interface ReportLinkJob {
  char_name: string
  spec?: string
  difficulty: string
  build_label?: string
  status: string
  url?: string
}

/** Completed jobs that carry a Raidbots report URL, de-duplicated by URL. */
export function exportableLinks<T extends ReportLinkJob>(jobs: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const job of jobs) {
    if (job.status !== 'done') continue
    const url = job.url?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(job)
  }
  return out
}

/** Bare report URLs, one per line. */
export function formatLinkList(jobs: ReportLinkJob[]): string {
  return exportableLinks(jobs)
    .map((j) => j.url!.trim())
    .join('\n')
}

/**
 * One labelled line per report — still one link per line, so importers that
 * scrape links out of a pasted Discord message pick them all up.
 */
export function formatDiscordMessage(
  jobs: ReportLinkJob[],
  diffLabels: Record<string, string> = {},
): string {
  return exportableLinks(jobs)
    .map((j) => {
      const parts = [j.char_name]
      if (j.spec) parts.push(j.spec.charAt(0).toUpperCase() + j.spec.slice(1))
      parts.push(diffLabels[j.difficulty] ?? j.difficulty)
      if (j.build_label && j.build_label !== 'Default') parts.push(j.build_label)
      return `${parts.join(' · ')} — ${j.url!.trim()}`
    })
    .join('\n')
}
