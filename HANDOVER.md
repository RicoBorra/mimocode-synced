# HANDOVER: mimocode-synced adaptation

## What this is

A fork of [opencode-synced](https://github.com/iHildy/opencode-synced) adapted for MiMo Code. Syncs global config (`~/.config/mimocode/`) and skills across machines via GitHub.

**Repo**: https://github.com/RicoBorra/mimocode-synced

## Current state

The code compiles, all 79 tests pass, lint is clean. The plugin is installed at `~/.config/mimocode/plugins/` with the correct `dist/` structure. **But the `/sync-init` command does not appear in MiMo Code's TUI.**

## What was done

1. Renamed all `opencode` → `mimocode` in paths, strings, config fields, env vars, tool names
2. Switched `@opencode-ai/plugin` → `@mimo-ai/plugin` API, then removed the dependency entirely because:
   - `@mimo-ai/plugin` on npm is at `0.1.0-preview.0` but MiMo Code tries to install `@mimo-ai/plugin@0.1.0` (stable, doesn't exist)
   - MiMo Code doesn't ship a visible `node_modules` with `@mimo-ai/plugin` — it's bundled into the binary
3. Defined local type stubs in `src/sync/plugin-types.ts` (PluginClient, PluginShell, Plugin, PluginInput)
4. Inlined the `tool()` helper (it's just `return input` + `tool.schema = z`)
5. Plugin now has zero external runtime deps except `zod`

## What's blocking

**The plugin loads but commands don't register.** The MiMo Code log from last attempt shows:

```
INFO  service=plugin path=file:///home/nemo/.config/mimocode/plugins/index.js loading plugin
```

But then the session errors and the plugin's `config()` hook (which registers slash commands) never runs. Possible causes:

1. **Plugin export format mismatch**: MiMo Code expects `export const plugin: Plugin` or `export default` but our plugin exports `opencodeConfigSync`, `mimocodeConfigSync`, `mimocodeSynced`, `opencodeSynced`, and `default`. The default export is `mimocodeConfigSync`. **Check what export name MiMo Code looks for** — it might expect a specific name like `plugin` or `default`.

2. **Plugin function signature**: Our function signature is `async (ctx) => { tool, event, config }`. MiMo Code's `Plugin` type is `(input: PluginInput, options?) => Promise<Hooks>`. The `Hooks` type has `tool`, `event`, `config` — this should match. But verify the return shape.

3. **`config()` hook not being called**: Even if the plugin loads, if `config()` isn't called, slash commands won't register. Check if MiMo Code calls `config()` on all loaded plugins.

4. **`zod` import failing**: The plugin imports `zod` at runtime. If zod isn't available in MiMo Code's plugin sandbox, the import fails silently and the plugin never initializes. **This is the most likely cause.**

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

## What to try next

1. **Check if `zod` is available**: Add a `console.log` or `try/catch` around the zod import in the plugin to see if it fails. If zod isn't available, bundle it or inline the tiny bit we need (just `z.string()`, `z.boolean()`, `z.enum()`, `z.array()`).

2. **Check the exact export MiMo Code expects**: Look at MiMo Code's plugin loader source or try different export patterns:
   - `export default function(ctx) { ... }`
   - `export const plugin: Plugin = async (ctx) => { ... }`
   - `export const server: Plugin = async (ctx) => { ... }` (MiMo Code uses `PluginModule` type with `server` field)

3. **Test plugin loading in isolation**: Create a minimal plugin that just logs something:
   ```js
   export default async (ctx) => {
     ctx.client.app.log({ body: { service: 'test', level: 'info', message: 'Plugin loaded!' } });
     return {};
   };
   ```
   Put it in `~/.config/mimocode/plugins/test.js` and see if the log message appears.

4. **Check if commands appear as tools instead of slash commands**: The `tool` hook registers `mimocode_sync` as a tool, not a slash command. The slash commands (`/sync-init` etc.) are registered via the `config` hook. If `config()` isn't called, only the tool would be available — ask the AI to "use the mimocode_sync tool with command init".

## Files to examine

- `src/index.ts` — plugin entry point, exports, tool definition, config hook
- `src/sync/plugin-types.ts` — local type definitions (may need adjusting)
- `src/sync/service.ts` — all sync operations
- `src/sync/paths.ts` — path resolution (APP_NAME = 'mimocode')
- `~/.config/mimocode/plugins/` — installed plugin
- `~/.local/share/mimocode/log/` — runtime logs
