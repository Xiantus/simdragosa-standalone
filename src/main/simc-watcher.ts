// src/main/simc-watcher.ts
//
// Watches WoW SavedVariables/Simdragosa.lua for SimC exports written by the
// in-game /sdr export command. Sends 'simc:export' IPC events to the renderer
// whenever a new, unseen export is detected.

import { existsSync, readdirSync, readFileSync, watch, FSWatcher } from 'fs'
import { join } from 'path'
import type { BrowserWindow } from 'electron'

export interface SimcExportEntry {
  charKey: string
  spec: string
  simc: string
  timestamp: number
}

// ---------------------------------------------------------------------------
// Lua string parser
// ---------------------------------------------------------------------------

/** Parses a Lua-escaped string starting at the opening quote at content[startIdx].
 *  Returns [unescaped string, index after closing quote] or null on failure. */
function parseLuaString(content: string, startIdx: number): [string, number] | null {
  if (content[startIdx] !== '"') return null
  let result = ''
  let i = startIdx + 1
  while (i < content.length) {
    const ch = content[i]
    if (ch === '\\') {
      const next = content[i + 1]
      if (next === 'n')  result += '\n'
      else if (next === 'r') result += '\r'
      else if (next === 't') result += '\t'
      else if (next === '"') result += '"'
      else                result += next ?? ''
      i += 2
    } else if (ch === '"') {
      return [result, i + 1]
    } else {
      result += ch
      i++
    }
  }
  return null
}

/** Returns the index just past the matching closing brace for a `{` at depth=1.
 *  Call with the index immediately after the opening `{`. */
function findBlockEnd(content: string, afterOpen: number): number {
  let depth = 1
  let i = afterOpen
  while (i < content.length) {
    const ch = content[i]
    if (ch === '{') {
      depth++
    } else if (ch === '}') {
      if (--depth === 0) return i
    } else if (ch === '"') {
      // Skip string so braces inside don't confuse the counter
      i++
      while (i < content.length) {
        if (content[i] === '\\') i++      // skip escaped char
        else if (content[i] === '"') break
        i++
      }
    }
    i++
  }
  return -1
}

// ---------------------------------------------------------------------------
// SavedVariables parser
// ---------------------------------------------------------------------------

/** Parse SimcExportEntry[] from the contents of Simdragosa.lua (SavedVariables). */
export function parseSavedVars(fileContent: string): SimcExportEntry[] {
  const results: SimcExportEntry[] = []

  // Locate the exports table
  const exportsMarker = '["exports"] = {'
  const exportsIdx = fileContent.indexOf(exportsMarker)
  if (exportsIdx === -1) return results

  const exportsBodyStart = exportsIdx + exportsMarker.length
  const exportsBodyEnd = findBlockEnd(fileContent, exportsBodyStart)
  if (exportsBodyEnd === -1) return results

  const exportsBody = fileContent.slice(exportsBodyStart, exportsBodyEnd)

  // Iterate character entries: ["CharName-Realm"] = { ... }
  const charKeyPattern = /\["([^"]+)"\]\s*=\s*\{/g
  let m: RegExpExecArray | null

  while ((m = charKeyPattern.exec(exportsBody)) !== null) {
    const charKey = m[1]
    const blockBodyStart = m.index + m[0].length
    const blockBodyEnd = findBlockEnd(exportsBody, blockBodyStart)
    if (blockBodyEnd === -1) continue

    const block = exportsBody.slice(blockBodyStart, blockBodyEnd)

    // Skip opted-out characters
    if (/\["enabled"\]\s*=\s*false/.test(block)) continue

    // Timestamp
    const tsMatch = block.match(/\["timestamp"\]\s*=\s*(\d+)/)
    const timestamp = tsMatch ? parseInt(tsMatch[1], 10) : 0

    // Spec
    const specMatch = block.match(/\["spec"\]\s*=\s*"([^"]*)"/)
    const spec = specMatch ? specMatch[1] : 'unknown'

    // SimC string (may be long and contain escaped characters)
    const simcKeyStr = '["simc"] = '
    const simcKeyIdx = block.indexOf(simcKeyStr)
    if (simcKeyIdx === -1) continue
    const quotePos = block.indexOf('"', simcKeyIdx + simcKeyStr.length)
    if (quotePos === -1) continue
    const parsed = parseLuaString(block, quotePos)
    if (!parsed) continue

    results.push({ charKey, spec, simc: parsed[0], timestamp })
  }

  return results
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/** Returns all Simdragosa.lua SavedVariables paths found under the WoW root. */
export function discoverSavedVarsPaths(wowPath: string): string[] {
  const wtfAccountPath = join(wowPath, 'WTF', 'Account')
  const found: string[] = []
  try {
    const entries = readdirSync(wtfAccountPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const candidate = join(wtfAccountPath, entry.name, 'SavedVariables', 'Simdragosa.lua')
      if (existsSync(candidate)) found.push(candidate)
    }
  } catch {
    // WTF folder doesn't exist or isn't readable — silent fail
  }
  return found
}

// ---------------------------------------------------------------------------
// Watcher
// ---------------------------------------------------------------------------

type SeenTimestamps = Record<string, number>

interface WatcherContext {
  watchers: FSWatcher[]
  mainWindow: BrowserWindow
  getSeenTimestamps: () => SeenTimestamps
  setSeenTimestamps: (ts: SeenTimestamps) => void
}

let activeContext: WatcherContext | null = null

function processFile(filePath: string, ctx: WatcherContext) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const entries = parseSavedVars(content)
    const seen = ctx.getSeenTimestamps()
    let updated = false

    for (const entry of entries) {
      const lastSeen = seen[entry.charKey] ?? 0
      if (entry.timestamp > lastSeen) {
        ctx.mainWindow.webContents.send('simc:export', entry)
      }
    }

    if (updated) ctx.setSeenTimestamps(seen)
  } catch (err) {
    console.warn('[simc-watcher] Error processing', filePath, err)
  }
}

/** Start watching all discovered SavedVariables files for the given WoW path.
 *  Call again with the new path when wow_path changes in settings. */
export function startWatcher(
  wowPath: string,
  mainWindow: BrowserWindow,
  getSeenTimestamps: () => SeenTimestamps,
  setSeenTimestamps: (ts: SeenTimestamps) => void,
): void {
  stopWatcher()
  if (!wowPath) return

  const paths = discoverSavedVarsPaths(wowPath)
  if (paths.length === 0) {
    console.log('[simc-watcher] No Simdragosa.lua SavedVariables found under', wowPath)
    return
  }

  const ctx: WatcherContext = {
    watchers: [],
    mainWindow,
    getSeenTimestamps,
    setSeenTimestamps,
  }

  for (const filePath of paths) {
    console.log('[simc-watcher] Watching', filePath)

    // Initial scan on startup
    processFile(filePath, ctx)

    // Debounced file-change handler
    let debounceTimer: NodeJS.Timeout | null = null
    const watcher = watch(filePath, () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => processFile(filePath, ctx), 500)
    })
    watcher.on('error', (err) => console.warn('[simc-watcher] Watch error on', filePath, err))
    ctx.watchers.push(watcher)
  }

  activeContext = ctx
}

export function stopWatcher(): void {
  if (!activeContext) return
  for (const w of activeContext.watchers) {
    try { w.close() } catch {}
  }
  activeContext = null
}
