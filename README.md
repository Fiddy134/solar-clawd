# Solar Clawd

A Claude Code mod that puts a living sky behind your terminal while Claude works. It follows the real sun, moon and weather where you are, and a pixel Clawd lives in a band above the prompt — sleeping, drinking coffee, coding, cheering when Claude finishes and facepalming when a tool fails.

![Four skies: day, dusk, aurora at night, rain](assets/skies.png)

Everything is printed in a risograph style: a handful of inks, halftone screens and a key plate slightly off register.

## What's in the sky

- **The real sky** — sun and moon positions and phases, bright stars and constellations, the ISS on its actual visible passes, aurora from NOAA's Kp index, and the weather from Open-Meteo (clouds, rain, snow, wind).
- **Small, rare events** — hot-air balloons, migrating birds, planes with contrails, kites on windy days, autumn leaves, cherry blossom, a comet every couple of months, a dolphin leaping by the lighthouse (now and then a pink one), rainbows after rain, shooting stars (more during the Perseids and Geminids).
- **Swedish days** — Easter witches, the flag on National Day, a maypole at Midsummer, a Lucia procession, the Christmas star and the tomte's sleigh, New Year's fireworks.
- **Claude's state** — a lighthouse far off on the horizon lights up and sweeps when Claude is waiting for you (orange for a question, white when done), and confetti falls after a long piece of work. By Clawd's side a pile of paper grows as the context window fills (he sweats near the top, and sweeps it into a box on `/compact`); he reads a book while Claude only reads, and types while it edits or runs commands.

Events are a pure function of the time and the sky, so every session shows the same sky without keeping any state.

## Requirements

- macOS, or Linux (untested — see [Linux](#linux))
- [Claude Code](https://claude.com/claude-code) with mod support (tested on 2.1.310)
- [Ghostty](https://ghostty.org) 1.3 or later for the sky behind the terminal (iTerm2 gets it as a background image instead)

## Install

```sh
git clone https://github.com/Fiddy134/solar-clawd ~/solar-clawd
```

Load it as a plugin directory in `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/solar-clawd"
  }
}
```

Start Claude Code in Ghostty and run `/solar ghostty` once. It adds one optional include line to Ghostty's config; the included file names the shader while a Claude session runs and is empty otherwise.

## Linux

> **Untested.** Linux support is written and covered by unit tests, but nobody has run it on a real Linux desktop yet. Reports and fixes are welcome.

Installation is the same. `/solar ghostty` adds the include to `$XDG_CONFIG_HOME/ghostty/config.ghostty` (or to `config` if that is the file you have), defaulting to `~/.config/ghostty`.

The mod rewrites the shader and asks Ghostty to reload its config, which on Linux means a `SIGUSR2`:

- If Ghostty runs as its systemd user service, the mod runs `systemctl --user reload app-com.mitchellh.ghostty.service` — the way [Ghostty's docs](https://ghostty.org/docs/linux/systemd) recommend.
- Otherwise it sends `SIGUSR2` with `pkill -x ghostty`, but only if `ghostty --version` says 1.3 or later, since an older Ghostty would quit on that signal.

What differs from macOS:

- Battery is read from `/sys/class/power_supply` (the sky stands still on battery).
- There is no idle detection, so the sky keeps animating while you are away.
- No now-playing music in the band, and no iTerm2 background.

## Commands

| Command | |
|---|---|
| `/solar` | Hide or show the sky |
| `/solar demo` | A whole day in 48 seconds |
| `/solar HH:MM` | Pin a time today |
| `/solar YYYY-MM-DD HH:MM` | Pin a day, e.g. `/solar 2026-12-24 15:01` |
| `/solar now` | Follow the real sun again |
| `/solar plats <city>` | Set the place (otherwise guessed from your IP, starting in Stockholm) |
| `/solar events` | List the events |
| `/solar event <name>` | Play an event for 90 seconds |
| `/solar norrsken` | Toggle a forced aurora |
| `/solar blåst` | Toggle a storm |
| `/solar ghostty` | Add the sky to Ghostty's config |

The mod's own messages are in Swedish.

## Data sources

[Open-Meteo](https://open-meteo.com) (weather and geocoding), [CelesTrak](https://celestrak.org) (ISS orbit), [NOAA SWPC](https://www.swpc.noaa.gov) (Kp index), [ipinfo.io](https://ipinfo.io) / [ipwho.is](https://ipwho.is) (place guess), the [Yale Bright Star Catalog](https://github.com/brettonw/YaleBrightStarCatalog).

## License

[GPL-3.0](LICENSE). A fan project, not affiliated with Anthropic.
