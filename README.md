# dotfiles

Personal machine configuration, kept in git so a new machine can be brought up quickly.

> **This is my personal setup, published for my own convenience — not a product.**
> It is offered as-is, with no warranty and no support. If you use any of it, you
> do so **at your own risk**: read the scripts first, understand what they change
> on your machine, and keep your own backups. Anything here may change or be
> deleted without notice, and it may not suit your setup at all.

## Contents

- [`claude/`](./claude) — custom Claude Code status line (model, context usage, cost, session time, git branch)

## Setup on a new machine

```bash
git clone <this-repo> ~/dotfiles
bash ~/dotfiles/claude/install.sh
```

To revert: `bash ~/dotfiles/claude/uninstall.sh`

## Note on unofficial APIs

The Claude status line reads an account spend figure from an **undocumented,
unsupported Anthropic endpoint**. See [`claude/README.md`](./claude/README.md#disclaimer)
before using it.
