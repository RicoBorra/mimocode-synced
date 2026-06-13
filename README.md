# mimocode-synced

> **Work in Progress** — This is an early adaptation of [opencode-synced](https://github.com/iHildy/opencode-synced) for MiMo Code. Features may be incomplete or change without notice.

Sync global mimocode configuration across machines via a GitHub repo, with optional secrets support for private repos.

## How this differs from opencode-synced

This plugin is a fork of [opencode-synced](https://github.com/iHildy/opencode-synced), adapted for MiMo Code. The **sync logic is identical** — same init flow, same pull/push, same config structure. The differences are in the plugin API surface and how the plugin is loaded.

### SDK and loading

| | opencode-synced (upstream) | mimocode-synced (this fork) |
|---|---|---|
| **Install** | `"plugin": ["opencode-synced"]` — host auto-installs from npm | Manual clone, build, copy to plugins dir |
| **SDK package** | `@opencode-ai/plugin@1.9.0` — exists on npm, works | `@mimo-ai/plugin@0.1.0` — does not exist on npm yet |
| **Runtime deps** | SDK provides zod + types at runtime | Must bundle zod + hand-write type stubs (`src/sync/plugin-types.ts`) |
| **Build** | `tsc` only | `tsc` + esbuild single-file bundle |

### API surface differences

These are actual behavioral differences in the plugin API, not just naming:

| | opencode-synced | mimocode-synced |
|---|---|---|
| **Export convention** | Exports `opencodeConfigSync`, `opencodeSynced` (alias), and `default` — host accepts all | Only `server` + `default` — host iterates `Object.values(module)` and throws on non-function exports |
| **`tool.schema`** | `tool.schema.string()`, `tool.schema.enum()`, etc. available from SDK | Does not exist in `@mimo-ai/plugin/tool` — must import `z` from `zod` directly |
| **PluginModule type** | SDK provides canonical types | Hand-written stubs in `src/sync/plugin-types.ts` that may drift from host |
| **Extra hooks** | N/A | `@mimo-ai/plugin` exports `actor.preStop`/`actor.postStop` hooks not present in upstream (unused by this plugin) |
| **Config casting** | `config.command` works directly | Requires explicit casting: `config as Record<string, unknown>` |

### Design differences

- **SQLite session exclusion**: `mimocode.db` is not synced by default due to dream/distill dependencies in MiMo Code. Upstream syncs it when sessions are enabled.
- **Repo discovery backward compat**: `LIKELY_SYNC_REPO_NAMES` in `repo.ts` includes both mimocode and opencode variants so migrating users can find existing repos.
- **E2E scripts**: Still reference `opencode` binary/paths — deferred until mimocode CLI is available for E2E testing.

### Root cause

`@mimo-ai/plugin` has no stable release on npm. MiMo Code's auto-installer targets a version that doesn't exist, and its plugin loader has stricter export constraints. Once Xiaomi publishes a stable SDK and fixes the loader, the setup and API differences could collapse to match upstream.

The `src/sync/plugin-types.ts` file and the `zod` bundling exist only because of this SDK gap. They will be removed once a working SDK is available.

## Features

- Syncs global mimocode config (`~/.config/mimocode`) and related directories
- Optional secrets sync when the repo is private
- Optional session sync to share conversation history across machines
- Optional prompt stash sync to share stashed prompts and history across machines
- Startup auto-sync with restart toast
- Per-machine overrides via `mimocode-synced.overrides.jsonc`
- Custom `/sync-*` commands and `mimocode_sync` tool

## Setup

### Requirements

- GitHub CLI (`gh`) installed and authenticated (`gh auth login`)
- Git installed and available on PATH
- Node.js (for `npm install` and `npm run build`)

### Install

1. Clone and build the plugin:

```bash
git clone https://github.com/RicoBorra/mimocode-synced.git
cd mimocode-synced
npm install
npm run build
```

2. Copy the plugin to mimocode's plugin directory:

```bash
mkdir -p ~/.config/mimocode/plugins
cp -r dist ~/.config/mimocode/plugins/
cp package.json ~/.config/mimocode/plugins/
```

3. Register the plugin in `~/.config/mimocode/mimocode.json`:

```jsonc
{
  "$schema": "https://mimo.xiaomi.com//config.json",
  "plugin": ["./plugins/dist/index.js"]
}
```

4. Install the plugin SDK workaround (see [How this differs from opencode-synced](#how-this-differs-from-opencode-synced) for why this is needed):

```bash
cd ~/.config/mimocode
npm init -y
npm install @mimo-ai/plugin@0.1.1-preview.1
```

> **Note**: This is temporary. Once Xiaomi publishes `@mimo-ai/plugin@0.1.0` to npm, mimocode's built-in installer will handle this automatically and you can delete `~/.config/mimocode/package.json` and `~/.config/mimocode/node_modules/`.

5. Restart mimocode. Run `/sync-init` to set up your sync repo.

### Updating

```bash
cd mimocode-synced
git pull
npm install
npm run build
cp dist/index.js ~/.config/mimocode/plugins/dist/
```

Restart mimocode to pick up the update.

## Configure

### First machine (create new sync repo)

Run `/sync-init` to create a new sync repo:

1. Detects your GitHub username
2. Creates a private repo (`my-mimocode-config` by default)
3. Clones the repo and pushes your current config

### Additional machines (link to existing repo)

Run `/sync-link` to connect to your existing sync repo:

1. Searches your GitHub for common sync repo names (prioritizes `my-mimocode-config`)
2. Clones and applies the synced config
3. **Overwrites local config** with synced content (preserves your local overrides file)

If auto-detection fails, specify the repo name: `/sync-link my-mimocode-config`

After linking, restart mimocode to apply the synced settings.

### Custom repo name or org

You can specify a custom repo name or use an organization:

- `/sync-init` - Uses `{your-username}/my-mimocode-config`
- `/sync-init my-config` - Uses `{your-username}/my-config`
- `/sync-init my-org/team-config` - Uses `my-org/team-config`

<details>
<summary>Manual configuration</summary>

Create `~/.config/mimocode/mimocode-synced.jsonc`:

```jsonc
{
  "repo": {
    "owner": "your-org",
    "name": "mimocode-config",
    "branch": "main",
  },
  "includeSecrets": false,
  "includeMcpSecrets": false,
  "includeSessions": false,
  "sessionBackend": {
    "type": "git",
    "turso": {
      "syncIntervalSec": 15,
      "autoSetup": true,
    },
  },
  "includePromptStash": false,
  "includeModelFavorites": true,
  "includeMimocodeSkills": true,
  "includeAgentsDir": true,
  "extraSecretPaths": [],
  "extraConfigPaths": [],
}
```

</details>

### Synced paths (default)

- `~/.config/mimocode/mimocode.json` and `mimocode.jsonc`
- `~/.config/mimocode/AGENTS.md`
- `~/.config/mimocode/agent/`, `command/`, `mode/`, `tool/`, `themes/`, `plugin/`, `skills/`
- `~/.agents/`
- `~/.local/state/mimocode/model.json` (model favorites)
- Any additional paths in `extraConfigPaths` (allowlist, files or folders). You do not need to include default paths like `~/.config/mimocode/skills` or `~/.agents`.

Disable default directory sync by setting:
- `"includeMimocodeSkills": false` to skip `~/.config/mimocode/skills/`
- `"includeAgentsDir": false` to skip `~/.agents/`

### Secrets (private repos only)

Enable secrets with `/sync-enable-secrets` or set `"includeSecrets": true`:

- `~/.local/share/mimocode/auth.json`
- `~/.local/share/mimocode/mcp-auth.json`
- Any extra paths in `extraSecretPaths` (allowlist, files or folders)

MCP API keys stored inside `mimocode.json(c)` are **not** committed by default. To allow them
in a private repo, set `"includeMcpSecrets": true` (requires `includeSecrets`).

### Sessions (private repos only)

Session sync remains opt-in via `"includeSessions": true` (and requires `"includeSecrets": true`).
Session backend defaults to Git for backward compatibility. Turso is recommended for users running
multiple active machines concurrently.

> **Note**: The session database (`mimocode.db`) is used by background features like dream and distill.
> Syncing sessions across machines may cause conflicts with these features. Consider whether session
> sync is appropriate for your workflow before enabling it.

```jsonc
{
  "repo": { ... },
  "includeSecrets": true,
  "includeSessions": true,
  "sessionBackend": {
    "type": "git", // or "turso"
    "turso": {
      "database": "my-mimocode-config-sessions", // optional
      "url": "libsql://...", // optional
      "syncIntervalSec": 15, // default 15
      "autoSetup": true, // default true
    },
  },
}
```

#### Git backend (`sessionBackend.type = "git"`, default)

Best-effort session artifact sync via Git paths:

- `~/.local/share/mimocode/mimocode.db`
- `~/.local/share/mimocode/mimocode.db-wal` and `~/.local/share/mimocode/mimocode.db-shm`
- `~/.local/share/mimocode/storage/session/`
- `~/.local/share/mimocode/storage/message/`
- `~/.local/share/mimocode/storage/part/`
- `~/.local/share/mimocode/storage/session_diff/`

This mode can conflict with concurrent writers.

#### Turso backend (`sessionBackend.type = "turso"`)

Concurrent-safe snapshot backend for sessions:

- Session artifacts are **not** synced through Git paths.
- Config + secrets continue using the normal Git sync flow.
- Startup performs a Turso session pull before regular config sync.
- Background loop runs `pull -> push -> pull` on the configured interval.
- Manual `/sync-pull` and `/sync-push` trigger a foreground session sync cycle too.

Turso setup is machine-local and idempotent:

- Auto-installs Turso CLI when needed (best effort).
- Runs headless Turso login flow when needed.
- Creates/reuses the Turso database + token.
- Stores credentials in a local machine-only file (`0600`) outside the sync repo.

After pulling session changes, restart mimocode to ensure the latest session state is loaded.

### Prompt Stash (private repos only)

Sync your stashed prompts and prompt history across machines by setting `"includePromptStash": true`. This requires `includeSecrets` to also be enabled since prompts may contain sensitive data.

```jsonc
{
  "repo": { ... },
  "includeSecrets": true,
  "includePromptStash": true
}
```

Synced prompt data:

- `~/.local/state/mimocode/prompt-stash.jsonl` - Stashed prompts
- `~/.local/state/mimocode/prompt-history.jsonl` - Prompt history

## Overrides

Create a local-only overrides file at:

```
~/.config/mimocode/mimocode-synced.overrides.jsonc
```

Overrides are merged into the runtime config and re-applied to `mimocode.json(c)` after pull.

### MCP secret scrubbing

If your `mimocode.json(c)` contains MCP secrets (for example `mcp.*.headers` or `mcp.*.oauth.clientSecret`), mimocode-synced will automatically:

1. Move the secret values into `mimocode-synced.overrides.jsonc` (local-only).
2. Replace the values in the synced config with `{env:...}` placeholders.

This keeps secrets out of the repo while preserving local behavior. On other machines, set the matching environment variables (or add local overrides).
If you want MCP secrets committed (private repos only), set `"includeMcpSecrets": true` alongside `"includeSecrets": true`.

Env var naming rules:

- If the header name already looks like an env var (e.g. `CONTEXT7_API_KEY`), it is used directly.
- Otherwise: `mimocode_mcp_<SERVER>_<HEADER>` (non-alphanumerics become `_`).
- OAuth client secrets use `mimocode_mcp_<SERVER>_OAUTH_CLIENT_SECRET`.

## Usage

| Command | Description |
|---------|-------------|
| `/sync-init` | Create a new sync repo (first machine) |
| `/sync-link` | Link to existing sync repo (additional machines) |
| `/sync-status` | Show repo status and last sync times |
| `/sync-pull` | Fetch and apply remote config |
| `/sync-push` | Commit and push local changes |
| `/sync-enable-secrets` | Enable secrets sync (private repos only) |
| `/sync-sessions-backend <git\|turso>` | Switch session backend |
| `/sync-sessions-setup-turso` | Install/auth/provision Turso on this machine |
| `/sync-sessions-migrate-turso` | Bootstrap + switch from Git session sync to Turso |
| `/sync-sessions-cleanup-git` | Remove deprecated Git session artifacts after migration |
| `/sync-resolve` | Auto-resolve uncommitted changes using AI |

<details>
<summary>Manual sync (without slash commands)</summary>

### Trigger a sync

Restart mimocode to run the startup sync flow (pull remote, apply if changed, push local changes if needed).

### Check status

Inspect the local repo directly:

```bash
cd ~/.local/share/mimocode/mimocode-synced/repo
git status
git log --oneline -5
```

</details>

## Recovery

If the sync repo has uncommitted changes, you can:

1. **Auto-resolve using AI**: Run `/sync-resolve` to let AI analyze and decide whether to commit or discard the changes
2. **Manual resolution**: Navigate to the repo and resolve manually:

```bash
cd ~/.local/share/mimocode/mimocode-synced/repo
git status
git pull --rebase
```

Then re-run `/sync-pull` or `/sync-push`.

## Removal

<details>
<summary>How to completely remove and delete mimocode-synced</summary>

Run this one-liner to remove the plugin from your config, delete local sync files, and delete the GitHub repository:

```bash
bun -e '
  const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { spawnSync } = require("node:child_process");
  const isWin = os.platform() === "win32", home = os.homedir();
  const configDir = isWin ? path.join(process.env.APPDATA, "mimocode") : path.join(home, ".config", "mimocode");
  const dataDir = isWin ? path.join(process.env.LOCALAPPDATA, "mimocode") : path.join(home, ".local", "share", "mimocode");
  ["mimocode.json", "mimocode.jsonc"].forEach(f => {
    const p = path.join(configDir, f);
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, "utf8"), u = c.replace(/"\.\/plugins\/dist\/index\.js"\s*,?\s*/g, "").replace(/,\s*\]/g, "]");
      if (c !== u) fs.writeFileSync(p, u);
    }
  });
  const scp = path.join(configDir, "mimocode-synced.jsonc");
  if (fs.existsSync(scp)) {
    try {
      const c = JSON.parse(fs.readFileSync(scp, "utf8").replace(/\/\/.*/g, ""));
      if (c.repo?.owner && c.repo?.name) {
        const res = spawnSync("gh", ["repo", "delete", `${c.repo.owner}/${c.repo.name}`, "--yes"], { stdio: "inherit" });
        if (res.status !== 0) console.log("\nNote: Repository delete failed. If it is a permission error, run: gh auth refresh -s delete_repo\n");
      }
    } catch (e) {}
  }
  [scp, path.join(configDir, "mimocode-synced.overrides.jsonc"), path.join(dataDir, "sync-state.json"), path.join(dataDir, "mimocode-synced")].forEach(p => {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  });
  console.log("mimocode-synced removed.");
'
```

### Manual steps
1. Remove `"./plugins/dist/index.js"` from the `plugin` array in `~/.config/mimocode/mimocode.json` (or `.jsonc`).
2. Delete the plugin files:
   ```bash
   rm -rf ~/.config/mimocode/plugins
   ```
3. Clean up the SDK workaround (if no other plugins need it):
   ```bash
   rm -rf ~/.config/mimocode/node_modules ~/.config/mimocode/package.json ~/.config/mimocode/package-lock.json
   ```
2. Delete the local configuration and state:
   ```bash
   rm ~/.config/mimocode/mimocode-synced.jsonc
   rm ~/.local/share/mimocode/sync-state.json
   rm -rf ~/.local/share/mimocode/mimocode-synced
   ```
3. (Optional) Delete the backup repository on GitHub via the web UI or `gh repo delete`.

</details>

## Development

- `bun run build`
- `bun run test`
- `bun run lint`

## Codex Environment

This repo includes a shared Codex local environment at:

- `.codex/environments/environment.toml`
- `scripts/setup-env.sh`
- `scripts/e2e/github_two_instance.py`

### Setup behavior

The Codex environment just invokes `scripts/setup-env.sh`. Setup does:

- `bun install` (idempotent)
- creates runtime folders under `.memory/`
- clones upstream mimocode into `.memory/mimocode-upstream/mimocode` **only if missing**

The upstream clone is local-only and is not auto-updated by setup.

### Actions

The environment exposes these actions in Codex:

- `Check` -> `bun run check`
- `Test` -> `bun test`
- `Build` -> `bun run build`
- `E2E GitHub (2 instances)` -> `python3 scripts/e2e/github_two_instance.py`

### End-to-end test harness

Run manually:

```bash
python3 scripts/e2e/github_two_instance.py
```

Helpful options:

```bash
python3 scripts/e2e/github_two_instance.py --help
python3 scripts/e2e/github_two_instance.py --preflight-only
python3 scripts/e2e/github_two_instance.py --keep-failed-repo
```

The harness runs two isolated mimocode instances, uses a unique ephemeral private GitHub repo,
and writes artifacts to `.memory/e2e/runs/<run-id>/`.

### Local testing (production-like)

To test the same artifact that would be published, install from a packed tarball
into mimocode's cache:

```bash
mise run local-pack-test
```

Then set `~/.config/mimocode/mimocode.json` to use:

```jsonc
{
  "plugin": ["./plugins/dist/index.js"]
}
```

Restart mimocode to pick up the cached install.


## Prefer a CLI version?

I stumbled upon [opencodesync](https://www.npmjs.com/package/opencodesync) while publishing this plugin.
