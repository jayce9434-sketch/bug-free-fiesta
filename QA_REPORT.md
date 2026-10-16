# UNDERLEAF: Night Shift - QA Report

This build was exercised in a real headless Chromium rendering session using the same HTML, CSS, and JavaScript shipped in the project. The five included PNG files are browser-rendered screenshots from that build.

## Automated browser checks passed
- Board renders without page errors.
- Bugs, Lab, Settings, and mission screens render and switch correctly.
- Keyboard movement changes the player position.
- Specialist ability input starts a real cooldown.
- Mission abort opens the result state and returns cleanly to the board.
- iPad-sized 1024x768 coarse-pointer session shows the joystick, specialist ability button, and Burst button.
- Developer Test Vault SET changed Sap to the exact entered value.
- Developer Test Vault ADD added the exact entered Amber amount.
- All five contract mechanics were completed successfully in-browser: Scavenge, Relay, Rescue, Sabotage, Survey.
- All six specialist abilities executed successfully: Anchor Dash, Shell Brace, Air Skip, Blade Arc, Signal Flash, Still Cloak.

## Fairness checks
- Player contact radius and predator contact radius use the same visible geometry used for drawing.
- Rain strike damage uses the visible telegraph circle radius.
- No hidden hitbox padding is added to predator contact.
- Difficulty scales through pressure such as threat count, threat speed, mission time, elite hunters, and sector hazards rather than oversized collision boxes.

## Project checks
- Flat repository root structure.
- No CDN or runtime asset dependency.
- GitHub Pages-compatible relative paths.
- PWA manifest and service worker included.
- 192x192, 512x512, and 180x180 Apple touch icons verified.
- Local autosave plus export, import, and reset controls.
- Exact ADD / SET controls for Sap, Amber, and XP.
- Master, Music, and SFX controls expose 0% through 20,000%.
- Source scan found no emoji characters in the in-game HTML, CSS, or JavaScript.
- Six specialists use visibly different anatomy instead of recolors of one shared body.

## Included real screenshots
1. screenshot-1-board.png - live contract board and Field Ant preview.
2. screenshot-2-specialists.png - six distinct specialist designs.
3. screenshot-3-lab.png - permanent Field Lab upgrades.
4. screenshot-4-settings.png - audio, accessibility, Test Vault, and save tools.
5. screenshot-5-mission.png - live iPad-sized mission with touch joystick, Burst, and specialist ability controls.
