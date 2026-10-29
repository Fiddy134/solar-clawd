# Making or changing a theme, step by step

<!--
An outline, 2026-10-29: the headings and what goes under each, drawn from
how floor and terminal went in rounds 1, 2 and v3. Each step is to be
written out with Vincent, and the whole kept up to date after every theme
and every change.
-->

[`THEME-GUIDE.md`](THEME-GUIDE.md) says how a theme is written: the contract, the signals, the helpers, the checklist. This guide says how a theme comes to be, and how it changes after that. It covers the steps from an idea to something that works live, who does each step, and where to stop and look. The idea can be a whole new theme or one change inside a theme that exists, such as a new corner, a character, a moment or a different night. "You" are the person whose theme it is, and Claude builds it. The guide is a living document: after each theme and each change, what went wrong and what worked go back into it.

Why it exists: in rounds 1 and 2 a theme was written in one sweep from a paragraph, and it passed the checklist without being what the person had seen in their head. Vincent's words after round 2 were "I see many places that need changing from my vision". Version 3 came from photos, eight rounds of sketches and a design written from Vincent's own words. This guide makes that the way every theme is made and every change is done.

The steps are the same for a new theme and for a change. A change runs each step at its own size, and the box at the end of each step says how.

## 1. The vision (you and Claude, together)

1. **Your words first, as you say them.** What the theme is, what it should feel like, and what it is not. Claude quotes them in the order you said them and does not tidy them up. For floor v3 the words were "a bit of character and cosiness", "a bit of depth is missing" and "everything felt very 2D", and the judge later worked from them.
2. **References:** your photos and pictures, kept locally in `.preview/ref-<name>/` and not committed when they are someone else's. When something is hard to put into words, such as an angle, a light or a mood, a reference does it better: a game, a film, a place. For floor v3 it was "like Stardew Valley or Pokémon Ruby" that settled the angle.
3. **The big decisions, in rough blocks.** Before any detail, settle:
   - what stays sky and what is the stage
   - the angle
   - the width (240 to 480 pt, in steps of 40; a changed margin reaches only new tabs)
   - where the eye should land

   Claude draws each decision as two or three alternatives side by side, in blocks with no detail, at the real size of the window and stage, and you pick one. What was learnt: of floor v3's eight sketch versions, nearly all went on these decisions (a city behind the text, a vanishing point, seen from above, no outside at all, a ceiling instead of a gable), and the details hardly changed. Those were often shown one sketch at a time, while you tried to explain the angle in words; alternatives side by side would have made it easier to choose. A vanishing point behind the text also makes the text hard to read, while seen from above it reads.
4. **The detailed sketch,** once the big decisions hold: by day and by evening, at the real size. The sketch fixes the composition, and the house style still decides how it looks.
5. **A reads-as list:** each thing in the picture and what someone should take it for at a glance ("the cubes are NYSE's hanging cubes, boxes with a top and a front, not flat signs"). It turns the picture in your head into lines that can be held against a frame:
   - the judge, who was not there when you talked, goes through it line by line, which §14 of the guide alone does not do (in round 2 the judge passed floor while the crowd it was meant to be about read as specks)
   - the builder knows what each thing must read as while drawing it
   - at a later change, the lines are tried again, so that a change in one corner does not break what already read
   - at your checkpoint, you go down the lines instead of looking for what is off across a whole sheet

   How it is made: Claude proposes it from the sketch and your words, grouped as the whole picture, then place by place, then evening and the closed hours, and marks lines that come from the design but do not show in the sketch. You strike and correct, and answer what Claude could not tell from the sketch. A handful of lines are marked **bearing**: one that does not hold fails the theme, and the rest are points for the fix rounds. Floor v3's list, in its design, is the first one.
6. **The design** in `docs/superpowers/specs/`: your words quoted, the chosen sketch, the reads-as list, the goals and non-goals, and what is left to the builder.

> **For a change:** what is to change and why, in your words, and what must stay as it is. A sketch when the change moves or adds something you can see, drawn over a frame of the theme as it stands. A reads-as line for each thing that is new or changed. A note in the theme's design is enough, or a design of its own when the change is large.

## 2. What the engine lacks (Claude)

- What the design needs that the engine does not yet have: signals (a New York weekday, a new high), letters (`M`, `N`, `W`), helpers.
- Built, tested and documented in the guide before the theme is started, on its own branch.
- What was learnt: in round 2 the authors invented `under()` and their own rotations, because what they needed was missing or not documented.

> **For a change:** the same question, often answered with "nothing". A change to the engine still comes first and on its own, because every theme gets it.

## 3. Building in layers (Claude)

- Start from the template, or from an earlier version of the theme if one exists, and keep what worked there.
- The layers, in order:
  1. rough shapes: the masses, the light and dark, where things stand
  2. shapes: each thing drawn as what it is
  3. details: the things that make it lived in
  4. movement: who goes where, kept so that every moment is a still
  5. night, weather and the closed hours
- After each layer: single frames at fixed times, and a bench with `--bench 100`. A theme benched only once it was finished came out over budget (1.35 in round 1).
- One preview at a time on the machine.

> **For a change:** first, the frames that show the part to be changed, drawn before anything is touched and kept as the "before". Then the same layers, for that part only. Night and weather are easy to forget in a small change.

## 4. Your checkpoint (you)

- After the rough shapes: the frames next to the sketch. Is it the picture you meant?
- After the shapes, once more if needed.
- Taste is decided here, with you. The detailed work after it can go to subagents.

> **For a change:** before and after side by side. A small change may need only this one look.

## 5. What a script can check (Claude)

- Lint, size against the caps, compiling, bench ≤ 1.25 × fyr (`--rounds 3`, without `--event`), the sheet.
- Nothing on this list should be left to the eye.

> **For a change:** the same, plus the bench against the theme as it was. Then `tools/preview/diff.mjs` on before and after, to show where a frame changed, so that a change meant for one corner has not reached another.

## 6. The judge (a fresh agent)

- The sheet, the design, the sketch and your words, with the reads-as list and the guide's §14 checklist.
- The question for each thing on the list: does it read as what it is?
- What was learnt: in round 2 the judge passed floor while the crowd it was meant to be about read as specks. The reads-as list is meant to catch that.

> **For a change:** the new and changed reads-as lines, and whether anything that read before has stopped reading. A small change can do without a judge when you have looked at it in step 4.

## 7. Two short fix rounds (Claude)

- The judge's findings, fixed in order of weight, and judged again.
- At most two rounds. What is still wrong after that goes to you, not into a third round.

## 8. The sheet and the live try (you)

- The sheet goes to you.
- In Ghostty: `/solar theme <name>`, then a new window (⌘N) to see the whole stage.
- You measure the GPU (`tools/measure/gpu.sh`), with nothing heavy running.
- What you see live goes back as fixes, or into the next version's design.

> **For a change:** the frames that show it rather than the whole sheet, unless the change reaches the whole theme (light, width, the floor everyone stands on).

## 9. Shipping (Claude, after your yes)

- The theme into `main` after it has been tested merged in a worktree, the version in `plugin.json` bumped, and a push after your yes.
- What this theme taught us goes back into this guide, and into `THEME-GUIDE.md` where it concerns how a theme is written.

## Who does what

- **Inline with you:** the vision, the sketches, the checkpoint and every call of taste.
- **Subagents** (after the checkpoint): the engine's gaps, the layers after the rough shapes, the judge and the fix rounds. A small change can be done inline from start to end.
- A workflow only on your explicit yes.
