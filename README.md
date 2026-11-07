# dotfiles

My macOS development environment — Kanagawa-themed, keyboard-driven, minimal noise.

## What's inside

| Tool | Config | Highlights |
|------|--------|------------|
| **Zsh** | `.zshrc`, `.p10k.zsh` | Oh My Zsh + Powerlevel10k, fzf integration, lazy-load pyenv |
| **Git** | `.gitignore_global` | Global ignore for macOS, Node, Python |
| **Ghostty** | `config` | Kanagawa Wave colors, JetBrains Mono, quick terminal (Cmd+`) |
| **Neovim** | `init.lua` | Kanagawa theme, Treesitter, Comment.nvim — minimal for quick edits |
| **VS Code** | `settings.json` | Prettier + ESLint on save, Tailwind class sorting, Kanagawa theme, zero noise |
| **Obsidian** | `app.json`, `appearance.json`, plugins, hotkeys, snippets | JetBrains Mono, custom Kanagawa CSS, Dataview, Kanban |
| **Herdr** | `herdr/` layout, mods, theme, keys | Agent board: every Claude Code session as a live card, ⌘1–9 to jump, ⌘K to open one (optionally on a Pulse task or in a new git worktree), Claude's status line moved to a footer |
| **Homebrew** | `Brewfile` | CLI tools, languages, databases, apps, VS Code extensions |
| **macOS** | `macos.sh` | Dock, Finder, keyboard, trackpad, screenshots — one-time setup |

## Structure

```
dotfiles/
├── ghostty/config
├── git/.gitignore_global
├── nvim/init.lua
├── obsidian/
│   ├── app.json
│   ├── appearance.json
│   ├── community-plugins.json
│   ├── core-plugins.json
│   ├── hotkeys.json
│   └── snippets/kanagawa.css
├── vscode/settings.json
├── zsh/.zshrc
├── zsh/.p10k.zsh
├── Brewfile
├── install.sh
└── macos.sh
```

## Install

```bash
git clone https://github.com/IPalSeb/dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

The script will:
- Symlink zsh, git, Ghostty, Neovim and VS Code configs to their expected locations
- Copy Obsidian configs to the vault (no symlink — Obsidian doesn't like them)
- Install Oh My Zsh, Powerlevel10k and zsh plugins if missing
- Optionally run `brew bundle` to install Homebrew packages

Existing files are backed up as `*.backup` before linking.

### macOS preferences

Run once on a fresh Mac:

```bash
./macos.sh
```

Sets Dock, Finder, keyboard repeat speed, trackpad tap-to-click, screenshots without shadow, and disables auto-correct. Requires restart.

## Theme

Everything runs on [Kanagawa](https://github.com/rebelot/kanagawa.nvim) — terminal, editor, notes, and Neovim.

## License

MIT

## Herdr board

A layout for [Herdr](https://herdr.dev) built for running several coding agents at once:

- **Board**: every open session as an equal card with its state (waiting on you, working, done, idle), git branch, context usage and the last lines of its terminal. A warning shows when two sessions share a folder.
- **Moving around**: `⌘1–9` jumps to a session, `⌃Tab` cycles, `⌘J` goes to the next one waiting on you, `⌘0` back to the board.
- **New session** (`⌘K`): pinned folders, then every folder in your projects dir. If the repo has tasks in a Pulse MCP server, pick one and Claude starts with it; if the repo already has a session, start the new one in its own git worktree.
- **Footer**: Claude Code's status line (folder, branch, model, context, 5-hour quota) shown by Herdr instead of inside Claude.

Personal settings live outside the repo, in `~/.config/herdr-app/data/tablero.json`:

```json
{ "projectsDir": "~/Projects", "pinned": [{ "name": "Notes", "folder": "~/notes" }] }
```

To send Claude Code's status line to the footer, add this near the top of your own statusline script (after reading stdin into `$INPUT`):

```bash
[ -n "$HC_TERMINAL_ID" ] && { echo "$INPUT" | bash ~/.config/herdr-app/mods/tablero-pie/claude-statusline.sh; exit 0; }
```
