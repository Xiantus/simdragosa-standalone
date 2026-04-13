# Simdragosa

Standalone Windows desktop app that automates WoW Droptimizer sims on Raidbots and shows the DPS gains in-game via a tooltip addon.

![Windows](https://img.shields.io/badge/Windows-10%2F11-blue) ![Version](https://img.shields.io/github/v/release/Xiantus/simdragosa-standalone)

---

## What it does

1. You set up your characters once with their SimC profile strings
2. Select which characters and loot tracks to sim (Normal / Heroic / Mythic / M+10 / M+10 Vault)
3. Simdragosa submits Droptimizer jobs to Raidbots automatically and waits for the results
4. Results are shown in the app as ranked DPS upgrade bars per item
5. A `SimdragosaData.lua` file is written to your WoW addon folder so item tooltips in-game show the DPS gains automatically after a `/reload`

---

## Installation

1. Download `Simdragosa-Setup-x.x.x.exe` from the [Releases page](https://github.com/Xiantus/simdragosa-standalone/releases)
2. Run the installer — if Windows SmartScreen appears, click **More info → Run anyway**
3. Install the [Simdragosa WoW addon](https://github.com/Xiantus/simdragosa-addon) — shows DPS gains on item tooltips in-game (available on CurseForge)

### Requirements

- Windows 10 or 11 (64-bit)
- Python 3.10+ installed from [python.org](https://python.org) — **not** the Microsoft Store version
- A [Raidbots](https://raidbots.com) account

---

## First-time setup

### 1. Get your Raidbots Session ID

The app submits sims on your behalf, so it needs your Raidbots login cookie.

1. Log in to [raidbots.com](https://raidbots.com)
2. Open browser DevTools (`F12`) → **Application** tab → **Cookies** → `https://www.raidbots.com`
3. Find the cookie named `raidsid` and copy its value
4. Paste it into **Raidbots Session ID** in the app's setup screen

Your session ID is stored locally and never sent anywhere except Raidbots.

### 2. Set your WoW folder (optional but recommended)

Set the **WoW Retail Folder** to your WoW installation root, e.g.:

```
C:\Program Files (x86)\World of Warcraft\_retail_
```

The app will automatically write sim results to `Interface\AddOns\Simdragosa\data\SimdragosaData.lua` after every sim. Without this, you can still use the **Export Lua** button manually.

### 3. Install the browser

On first launch, a yellow banner will appear asking you to install Playwright's Chromium browser. Click **Install Browser** and wait for the download (~150 MB). This is what the app uses to automate Raidbots.

> If you see a Python error during install, make sure you installed Python from [python.org](https://python.org) and not the Microsoft Store. In Windows Settings → Apps → Advanced app settings → App execution aliases, disable the Python aliases.

---

## Adding characters

Click the **+** button in the left sidebar to add a character.

| Field | Description |
|-------|-------------|
| Name | Your character's name (case-sensitive) |
| Realm | Your realm name |
| Region | US / EU / TW / KR / CN |
| Spec | Your DPS spec |
| SimC String | Paste from the SimulationCraft addon in-game (`/simc`) |
| Crafted stats | Optional — stat allocation for crafted gear (default `36/49`) |

The SimC string contains your current gear, talents, and stats. Raidbots uses it as the baseline for the sim.

---

## Keeping SimC strings up to date

After a patch or gear change your SimC string goes stale. The easiest way to refresh it:

1. Install the [SimulationCraft addon](https://www.curseforge.com/wow/addons/simulationcraft) and the [Simdragosa WoW addon](https://github.com/Xiantus/simdragosa-addon)
2. Log into the character in WoW and type `/sdr export`
3. The Simdragosa addon captures the full profile (gear, talents, stats) and stores it in SavedVariables
4. Within a few seconds, the desktop app detects the new export and asks you to update the character — no copy-pasting required

You can also paste a SimC string manually: open the SimulationCraft addon with `/simc`, copy the text, and paste it into the **SimC String** field.

---

## Running sims

1. Check one or more characters in the **character selector**
2. Toggle the loot tracks you want to sim:

| Button | What it sims |
|--------|-------------|
| Normal | Raid Normal (Champion track) |
| Heroic | Raid Heroic |
| Mythic | Raid Mythic |
| M+ 10 | Mythic+ 10 (Heroic track loot) |
| M+ 10 Vault | Great Vault reward from M+10 (Mythic track) |

3. Click **GO**

Each character × difficulty combination is a separate job. You can watch progress in the active jobs strip at the top. Click **Cancel** to stop all running jobs.

---

## Viewing results

Completed sims appear as rows in the results panel. Each row shows the character name, spec, and loot track.

Click **N upgrades ▼** to expand a ranked bar chart of the best item upgrades from that sim — items are sorted by DPS gain, colour-coded from purple (best) to teal, with item names fetched automatically from Wowhead.

Click **View Report →** to open the full Raidbots report in your browser.

Results are saved to a local database and restored the next time you open the app. Only the most recent sim per character + track is shown.

---

## In-game overlay

Enable **In-Game Mode** from the title bar toggle. This:

- Keeps the Simdragosa window always on top of WoW (works in Windowed Fullscreen mode)
- Shows a small round floating button with the Simdragosa icon

The floating button:
- **Click** — toggle the main window open/closed
- **Click and drag** — move the button anywhere on screen
- **Auto-hides** when you alt-tab to an app other than WoW or Simdragosa
- **Disappears** when you minimise the main window via the OS taskbar

To exit overlay mode, bring the main window up and toggle the mode off.

---

## WoW addon tooltips

After sims complete, the app writes `SimdragosaData.lua` to your addon's data folder. Type `/reload` in-game to load the new data without logging out.

Hover any item in your bags, the dungeon journal, or a tooltip link — if Simdragosa has sim data for it, you'll see lines like:

```
[Frost]  +1.2k DPS (Heroic)  +1.5k DPS (Mythic)
Simdragosa — simmed 2 days ago
```

### Slash commands

| Command | Description |
|---------|-------------|
| `/sdr toggle` | Show or hide tooltip lines |
| `/sdr status` | Show how many items have sim data for your character |
| `/sdr staleness <days>` | Hide results older than N days (0 = never hide) |
| `/sdr debug` | Show the character key and all stored data |
| `/sdr debug <itemID>` | Check if a specific item has sim data |

### Manual export

If the auto-export isn't writing (e.g. WoW folder not configured), click **Export Lua** in the results panel header. You'll see a confirmation message with the full path it wrote to.

---

## Settings

Open settings from the title bar gear icon.

| Setting | Description |
|---------|-------------|
| Raidbots Session ID | Your `raidsid` cookie from raidbots.com |
| WoW Retail Folder | Path to `_retail_` — app writes the addon data file here automatically |

---

## Troubleshooting

**Nothing happens when I launch the installer**
Right-click the `.exe` → Run as administrator. If SmartScreen appears, click More info → Run anyway.

**"Python not found" error**
Install Python 3.10+ from [python.org](https://python.org). In Windows Settings → Apps → Advanced app settings → App execution aliases, turn off the Python and Python3 aliases.

**Sim fails with an error**
Your Raidbots session ID may have expired. Log into raidbots.com again, copy the new `raidsid` cookie, and update it in Settings.

**Tooltip shows no data after /reload**
Run `/sdr debug` in-game. It will show the character key the addon is looking for (e.g. `Xiage-TarrenMill`). Make sure your character name and realm in the app match exactly.

**The floating button isn't visible in WoW**
WoW must be running in **Windowed (Fullscreen)** mode, not exclusive fullscreen. Change it in WoW's System → Graphics settings.
