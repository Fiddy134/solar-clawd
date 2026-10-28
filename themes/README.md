# Themes

This folder holds themes in the form a theme from elsewhere takes: a folder for each, named after it, with its `manifest.json` and `theme.glsl`, written from [`docs/THEME-GUIDE.md`](../docs/THEME-GUIDE.md), which is all a theme's author needs. The sky cannot switch to one of them yet (`/solar theme` is planned, not built), so a theme here is seen through the preview tools, `tools/theme/run.sh lint themes/<name>` and `tools/preview/sheet.sh theme themes/<name>`, and reaches the sky by being built in under `hooks/themes/`, as fyr is.
