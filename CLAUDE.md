# Solar Clawd

Read `docs/superpowers/HANDOFF.md` before anything else: it says where the last session stopped, which rules changed, and what comes next. Before a session ends, or when Vincent says "handoff", rewrite it and commit it.

The work plan is `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`; specs are in `docs/superpowers/specs/` (Swedish), plans and code in English, comments in plain prose, commit subjects describing the world as it now is.

The session loads the mod from the mirror `~/solar-clawd-live`, never from this clone (`docs/superpowers/specs/2026-10-26-auto-mode.md`). Never run `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh` or `.claude/hooks/mirror.sh --now` yourself, and never write to `~/.claude/settings.json`, `.claude/` or `.git/`: Vincent does those from a terminal window.
