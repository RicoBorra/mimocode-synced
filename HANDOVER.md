# HANDOVER: mimocode-synced adaptation

## What this is

A fork of [opencode-synced](https://github.com/iHildy/opencode-synced) adapted for MiMo Code. Syncs global config (`~/.config/mimocode/`) and skills across machines via GitHub.

**Repo**: https://github.com/RicoBorra/mimocode-synced

## Current state

The code compiles, all 79 tests pass, lint is clean. The plugin is installed at `~/.config/mimocode/plugins/` with the correct `dist/` structure. **The `/sync-init` command should now appear after restarting MiMo Code** (see "Fix applied" below).

## What was done

1. Renamed all `opencode` → `mimocode` in paths, strings, config fields, env vars, tool names
2. Switched `@opencode-ai/plugin` → `@mimo-ai/plugin` API, then removed the dependency entirely because:
   - `@mimo-ai/plugin` on npm is at `0.1.0-preview.0` but MiMo Code tries to install `@mimo-ai/plugin@0.1.0` (stable, doesn't exist)
   - MiMo Code doesn't ship a visible `node_modules` with `@mimo-ai/plugin` — it's bundled into the binary
3. Defined local type stubs in `src/sync/plugin-types.ts` (PluginClient, PluginShell, Plugin, PluginInput)
4. Inlined the `tool()` helper (it's just `return input` + `tool.schema = z`)
5. Plugin now has zero external runtime deps except `zod`

## What's blocking (RESOLVED — see "Fix applied" below)

**Root causes found:**

1. **`zod` was not available at runtime** — the plugin imports `zod` but it wasn't installed in the plugins directory. When mimocode loaded the plugin, the `import { z } from 'zod'` failed, causing the entire plugin initialization to fail silently. The `config()` hook never ran, so slash commands never registered.

2. **`@mimo-ai/plugin@0.1.0` install failure** — mimocode's config service tries to install `@mimo-ai/plugin@0.1.0` for each config directory. This version doesn't exist on npm (only preview versions: `0.1.0-preview.0`, `0.1.1-preview.0`, `0.1.1-preview.1`). The install failure was logged as a WARN but may have also blocked the plugin loading pipeline.

3. **Plugin was not bundled** — the dist output was multiple files (`index.js`, `sync/*.js`) with external imports. The plugin needed to be a single self-contained bundle.

## Key technical details

- **Plugin API docs**: https://mimo.xiaomi.com/mimocode/share (Config File page has `$schema: "https://mimo.xiaomi.com//config.json"`)
- **MiMo Code config dir**: `~/.config/mimocode/`
- **MiMo Code data dir**: `~/.local/share/mimocode/`
- **Plugin loading**: MiMo Code scans `~/.config/mimocode/plugins/` for JS files, reads `package.json` `main` field
- **Plugin logs**: `~/.local/share/mimocode/log/` — newest file has plugin loading errors
- **`@mimo-ai/plugin` npm**: only `0.1.0-preview.0`, `0.1.1-preview.0`, `0.1.1-preview.1` exist. No stable `0.1.0`.
- **The `tool()` function** in `@mimo-ai/plugin/tool` is literally `function tool(input) { return input }` and `tool.schema = z` (zod)
- **Slash commands**: Registered via the `config()` hook by setting `config.command[name] = { template, description }`
- **The `tool` hook** returns `{ mimocode_sync: toolDefinition }` — this registers a custom tool

## Fix applied

1. **Bundled the plugin with esbuild** — Updated `package.json` build script to use `esbuild` to bundle `dist/index.js` into a single self-contained file (587KB). This includes `zod` so the plugin has zero external runtime dependencies. Build command: `npm run build`.

2. **Installed `@mimo-ai/plugin@0.1.1-preview.1`** — Created `~/.config/mimocode/package.json` with the preview SDK version and ran `npm install`. This resolves the `NpmInstallFailedError` that was blocking the config service.

3. **Export format** — Mimocode's plugin loader iterates `Object.values(module)` and throws if any export is not a function. The plugin only exports `server` and `default` (both functions). The `id` export and alias exports (`mimocodeSynced`, `opencodeConfigSync`, `opencodeSynced`) were removed because they broke the loader.

4. **Plugin must be registered in config** — `~/.config/mimocode/mimocode.json` needs `"plugin": ["./plugins/dist/index.js"]` for the plugin to be discovered.

**To verify**: Restart MiMo Code and check if `/sync-init` appears as a slash command.

## What to try next (if still not working)

1. **Check the log** — `~/.local/share/mimocode/log/` newest file. Look for `service=plugin` entries.

2. **Check if commands appear as tools instead of slash commands** — The `tool` hook registers `mimocode_sync` as a tool, not a slash command. The slash commands (`/sync-init` etc.) are registered via the `config` hook. If `config()` isn't called, only the tool would be available — ask the AI to "use the mimocode_sync tool with command init".

3. **Test plugin loading in isolation** — Create a minimal plugin that just logs something:
   ```js
   export default async (ctx) => {
     ctx.client.app.log({ body: { service: 'test', level: 'info', message: 'Plugin loaded!' } });
     return {};
   };
   ```
   Put it in `~/.config/mimocode/plugins/test.js` and see if the log message appears.

## Files to examine

- `src/index.ts` — plugin entry point, exports, tool definition, config hook
- `src/sync/plugin-types.ts` — local type definitions (may need adjusting)
- `src/sync/service.ts` — all sync operations
- `src/sync/paths.ts` — path resolution (APP_NAME = 'mimocode')
- `~/.config/mimocode/plugins/` — installed plugin
- `~/.local/share/mimocode/log/` — runtime logs
