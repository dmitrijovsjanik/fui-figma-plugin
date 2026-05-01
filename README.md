# Fast UI Kit — Color Generator (Figma plugin)

Native Figma plugin that runs the Fast UI Kit palette generator inside Figma and
syncs its output directly to Figma Variables. Replaces the file-based DTCG export
workflow.

## Install (development)

```sh
npm install
npm run build
```

This produces `dist/code.js` and `dist/ui.html`.

In Figma desktop:

1. Plugins menu → Development → **Import plugin from manifest…**
2. Pick `manifest.json` from this repo.
3. Run the plugin: Plugins → Development → Fast UI Kit — Color Generator.

Re-run `npm run build` (or `npm run dev` for watch mode) after code changes; close
and re-open the plugin window in Figma to pick up the new bundle.

## What it does

- 12-step OKLCH palette generator with semantic role mapping (brand / success / warning / danger / info / neutral, plus optional secondary).
- Light + dark scales auto-derived from one brand color.
- **Sync to Figma** button — creates two collections and keeps them in sync:
  - `primitives` (single mode `Default`) — flat list `light/gray/0..12`, `dark/accent/1..12`, etc., plus theme-invariant `black-a/1..12` and `white-fixed`.
  - `semantics` (modes `Light` / `Dark`) — 52 v2.3 semantic tokens (`bg/canvas`, `fg/primary`, `border/strong`, `ring/focus`, `overlay/scrim`, …) referencing primitives via cross-collection aliases.
- First click → creates from scratch. Subsequent clicks → update values + rename variables when section names change.
- Section names (`bg`, `fg`, `border`, `ring`, `overlay`) are renamable in the **Semantic sections** field.
- All settings persist via `figma.clientStorage` between sessions.

## Sync semantics

| Figma state | Sync action |
|---|---|
| Both collections absent | Create both from scratch |
| Both collections present | Update values in place, rename existing variables to match current naming config |
| Only one of two | Toast error: clean up Figma side before retrying |

Update is currently best-effort: variables are matched by index against the previous applied structure. Schema is assumed stable — adding/removing semantic tokens isn't supported yet (will require a migration path).

## Project structure

```
src/
  code.ts                  — sandbox entry, message router
  ui.tsx                   — React entry
  messages.ts              — typed UI ↔ sandbox protocol
  ui/
    PluginApp.tsx          — main React component (forked from theme-builder/App.tsx)
    persistence.ts         — clientStorage bridge
    persistence-types.ts   — PersistedState + SemanticNamingConfig
    preset-types.ts        — StepPreset
    components/            — palette UI (forked from fast-ui-kit theme-builder)
  palette-core/            — palette generation algorithms (copied verbatim from fast-ui-kit)
  components/              — shared UI components (Button, Tag, etc — copied from fast-ui-kit)
  figma-builder/
    structure.ts           — neutral in-memory variable structure
    detect.ts              — find existing primitives / semantics collections
    apply.ts               — createCollections + updateCollections
  styles/, tokens/         — CSS used by copied components
```

## Origin

Forked from `~/Documents/Pet Projects/Fast UI Kit/`. Changes to palette generation
logic over there will need manual sync into `src/palette-core/` here. Tracked
manually for now — if it becomes painful we can switch to a workspace setup.
