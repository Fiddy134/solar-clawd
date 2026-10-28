# Themes

This folder holds themes in the form a theme from elsewhere takes: a folder for each, named after it, with its `manifest.json` and `theme.glsl`, written from [`docs/THEME-GUIDE.md`](../docs/THEME-GUIDE.md), which is all a theme's author needs. `/solar theme <name>` draws the sky with one of them in every Ghostty session, once it lints as the engine checks any theme; before that a theme is seen through the preview tools, `tools/theme/run.sh lint themes/<name>` and `tools/preview/sheet.sh theme themes/<name>`.
