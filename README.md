# Solar Clawd

A Claude Code mod that puts a living sky behind your terminal while Claude works. It follows the real sun, moon and weather where you are, and a pixel Clawd lives in a band above the prompt through his day — early birdin', coffee sesh, workin', vibin', night owl, sleep sesh — cheering when Claude finishes and facepalming when a tool fails.

![A low sun over the sea, the lighthouse lit, a dolphin, and Clawd at work above the prompt](assets/demo.gif)

Everything is printed in a risograph style: a handful of inks, halftone screens and a key plate slightly off register.

## What's in the sky

![Four skies: day, dusk, aurora at night, rain](assets/skies.png)

- **The real sky** — sun and moon positions and phases, bright stars and constellations, the ISS on its actual visible passes, aurora from NOAA's Kp index, and the weather from Open-Meteo (clouds, rain, snow, wind).
- **Small, rare events** — hot-air balloons, now and then a flying saucer among the clouds, migrating birds, planes with contrails, kites on windy days, autumn leaves, cherry blossom, a comet every couple of months, a dolphin leaping by the lighthouse (now and then a pink one), rainbows after rain, shooting stars (more during the Perseids and Geminids).
- **Swedish days** — Easter witches, the flag on National Day, a maypole at Midsummer, a Lucia procession, the Christmas star and Santa's sleigh, New Year's fireworks.
- **Claude's state** — a lighthouse far off on the horizon lights up and sweeps when Claude is waiting for you (orange for a question, white when done), and confetti falls after a long piece of work. In the bottom right corner stands a wire wastebasket (in the band behind Clawd when there is no shader): he tosses a ball of paper into it for each tenth of the context window, and when the conversation is compacted he throws in a match and the context burns away; he reads a book while Claude only reads, and types while it edits or runs commands.
- **The keeper** — in Ghostty the lighthouse is three times larger, and a small Clawd lives there: he fishes on the rocks, walks round the gallery, surfs a wave now and then, stargazes at night, and sleeps in a hammock from 03 to 06. When Claude waits for you he stands by the lit lantern, and every so often a UFO beams him up in a green light and kicks him out again a quarter of a minute later (`/solar event ufo abduction` and `/solar event surf` preview them).

Events are a pure function of the time and the sky, so every session shows the same sky without keeping any state.

## Requirements

- macOS, or Linux (see [Linux](#linux))
- [Claude Code](https://claude.com/claude-code) 2.1.275 or later
- [Ghostty](https://ghostty.org) 1.3 or later for the sky behind the terminal (iTerm2 gets it as a background image instead)

## Install

At the prompt of a Claude Code session:

```
/plugin install solar-clawd --marketplace Fiddy134/solar-clawd
```

Answer `y` to add the marketplace and pick a scope (user, so it runs in every session). From a shell, the same is `claude plugin install solar-clawd --marketplace Fiddy134/solar-clawd`.

Then, in a Claude Code session in Ghostty, run `/solar ghostty` once. It adds one optional include line to Ghostty's config; the included file names the shader while a Claude session runs and is empty otherwise. It also adds a right-hand margin of 240 points, where the lighthouse stands clear of the text; that is added once and kept when the sky is hidden. The sky shows only in the tabs where Claude runs.

### Developing

Clone the repository and load it as a plugin folder, which the session reloads as you save:

```sh
git clone https://github.com/Fiddy134/solar-clawd ~/solar-clawd
```

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/solar-clawd"
  }
}
```

That goes in `~/.claude/settings.json`. `claude plugin test .` runs the tests; `tools/preview/run.sh shader` and `tools/preview/run.sh band` render the sky and the band to PNGs without Ghostty (their flags are listed at the top of each file in `tools/preview/`), and `tools/preview/gif.sh` makes the GIF above.

## Linux

Run by a few people so far; reports and fixes are welcome. `/solar ghostty` adds the include to `$XDG_CONFIG_HOME/ghostty/config.ghostty` (or to `config` if that is the file you have), defaulting to `~/.config/ghostty`.

The mod rewrites the shader and asks Ghostty to reload its config, which on Linux means a `SIGUSR2`:

- If Ghostty runs as its systemd user service, the mod runs `systemctl --user reload app-com.mitchellh.ghostty.service`, the way [Ghostty's docs](https://ghostty.org/docs/linux/systemd) recommend.
- Otherwise it sends `SIGUSR2` with `pkill -x ghostty`, but only if `ghostty --version` says 1.3 or later, since an older Ghostty would quit on that signal.

What differs from macOS:

- Ghostty draws with OpenGL there, so the shader flips its coordinates and reads the terminal's colours in linear light as well.
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
| `/solar place <city>` | Set the place (otherwise guessed from your IP, starting in Stockholm); `auto` goes back to guessing |
| `/solar events` | List the events |
| `/solar event <name>` | Play an event for 90 seconds |
| `/solar aurora` | Toggle a forced aurora |
| `/solar storm` | Toggle a storm |
| `/solar toss` | Clawd throws a ball of paper in the wastebasket |
| `/solar burn` | The wastebasket burns for a while, as on `/compact` (the conversation is not touched) |
| `/solar ghostty` | Add the sky to Ghostty's config |

The Swedish words it took before (`plats`, `norrsken`, `blåst`, `kasta`, `bränn`, and the events' Swedish names) still work.

## Data sources

[Open-Meteo](https://open-meteo.com) (weather and geocoding), [CelesTrak](https://celestrak.org) (ISS orbit), [NOAA SWPC](https://www.swpc.noaa.gov) (Kp index), [ipinfo.io](https://ipinfo.io) / [ipwho.is](https://ipwho.is) (place guess), the [Yale Bright Star Catalog](https://github.com/brettonw/YaleBrightStarCatalog).

## License

[GPL-3.0](LICENSE). A fan project, not affiliated with Anthropic.
