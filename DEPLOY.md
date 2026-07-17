# Put The UI Generator on the web (no terminal)

Everything happens on github.com in your browser.

## One-time setup (2 minutes)
1. Upload this folder's contents to the repo branch
   `claude/game-ui-generator-khedvc` (Add file → Upload files — same as before).
   Make sure the `.github/workflows/pages.yml` file is included.
2. On github.com → your repo → **Settings → Pages** → under **Build and
   deployment**, set **Source: GitHub Actions**. Save.
3. Go to the **Actions** tab — a "Deploy to GitHub Pages" run will be going.
   When it's green, your app is live at:

   **https://cripgod.github.io/webflow-assets/**

## Every update after that
Upload changed files to the branch → the action rebuilds → same URL updates.
No terminal, ever.

## Your logo
Upload the PatternBreak PNG to the repo as **`public/pb-logo.png`**
(exact name). The app loads it automatically; until then it shows a fallback.
