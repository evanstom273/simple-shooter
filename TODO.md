# TODO.md

Living to-do list. Timestamps are Europe/London, ISO 8601 with UTC offset. Design decisions live in `GAME_DESIGN.md`; this file tracks the work.

---

## In progress

- Nothing yet.

## Next

- Shop open questions (§E 1c): items per shop, reroll, prices, healing cost, drop amounts, shop UI.
- Tune the melee enemy in play after the difficulty pass (#48–#51): wind-up, roll speed, dizzy, cooldown if still too hard.
- Weapons step: automatic, shotgun, switching (number keys, wheel, mobile cycle button).
- When combat exists, add its juice: hit-stop, enemy hit flash/squash/knockback, death shards, muzzle flash + recoil (shotgun shove), damage feedback (bigger shake, red edge pulse, light dims at low health), last-kill slow motion, wave banners, animated upgrade cards.
- Title (Lyra, deferred).
- Lyra to try the bigger arena and zoom (#35) on the Fold and desktop; also whether the movement blur is gone.
- Plan the next step (#16).

## Done

- [x] Contact damage removed; only attacks hurt (#52). *(2026-11-14T06:47:26+00:00)*
- [x] Step 8c: stage health, scrape vs attack, heal a stage per kill, turn-taking, bigger enemies, enemy health bars (#48–#51). *(2026-11-14T06:44:50+00:00)*
- [x] Step 8b: the melee enemy (#40) with route-finding, lunges, dizzy, shards; temporary spawner; dummies removed. *(2026-11-14T06:35:05+00:00)*
- [x] Heal on kills (#47): filling pip, heal effect, reset on hit; dummy pops count. *(2026-11-14T06:23:49+00:00)*
- [x] Step 8a: player health + hurt feedback, unarmed start, dash damage, dash auto-aim, post-dash grace (History #45–#46). *(2026-11-14T06:17:03+00:00)*
- [x] Step 7c: off-screen enemy markers, highlighted target arrow, zoom out (≤15%) for an off-screen target (History #44). *(2026-11-14T06:06:53+00:00)*
- [x] Step 7b: bullets through platforms, no line of sight (#42); nearest-target auto-aim with 15% switch margin (#43). *(2026-11-14T05:50:22+00:00)*
- [x] Step 7: shooting and aiming: three aim modes + settings panel, touch trigger, auto-aim lock + bracket, test pistol, shot juice, practice dummies (History #41). *(2026-11-14T05:45:20+00:00)*
- [x] Step 6: short hops removed (#34); arena experiment 2400×1350, 0.8× zoom, 10 platforms (#35). *(2026-11-14T05:12:44+00:00)*
- [x] Step 5: sound + mute, short hops, coyote time, jump buffer, one-way platforms + drop-through, vibration, look-ahead, platform reactions, motes (History #32–#33). *(2026-11-14T05:08:55+00:00)*
- [x] Step 4: movement blur fix (per-frame physics), tiny screen shake on impacts, player-centred lighting (History #31). *(2026-11-14T05:00:48+00:00)*
- [x] Step 3: squash and stretch, dust and dash effects, desktop dash cooldown bar, dash-ready flash. *(2026-11-14T04:55:00+00:00)*
- [x] Step 2: dash (right-click / touch button, cooldown, invulnerable, trail) and double jump (History #30). *(2026-11-14T04:49:36+00:00)*
- [x] Fill the whole screen on every shape, with a camera that follows the player (History #29). *(2026-11-14T04:45:51+00:00)*
- [x] Step 1, movement: square, placeholder arena, A/D + Space, touch joystick + jump button, screen fitting for desktop and the Fold (cover landscape/portrait, inner). *(2026-11-14T04:42:54+00:00)*
- [x] Hit invulnerability and three-weapon scope documented (History #27–#28). *(2026-11-14T04:28:58+00:00)*
- [x] Damage, dash, mobile switching and weapon-improvement decisions documented (History #23–#26). *(2026-11-14T04:27:30+00:00)*
- [x] Follow-up design questions answered and documented (History #16–#22). *(2026-11-14T04:24:39+00:00)*
- [x] Core design documented in `GAME_DESIGN.md` (History #7–#15). *(2026-11-14T04:17:36+00:00)*
- [x] Scaffold: React, Vite, TypeScript, Tailwind CSS, Phaser, Dexie; placeholder scene. *(2026-11-14T04:15:39+00:00)*
- [x] Pages workflow builds with Vite and deploys `dist/`. *(2026-11-14T04:15:39+00:00)*
- [x] GitHub Pages deployment workflow (`.github/workflows/pages.yml`), deploying on push to `main`. *(2026-11-14T04:09:54+00:00)*
- [x] ~~Placeholder `index.html`~~ (replaced by the Vite entry page). *(2026-11-14T04:09:54+00:00)*
- [x] `GAME_DESIGN.md` set up from the previous project's template. *(2026-11-14T04:09:54+00:00)*
- [x] `TODO.md` created. *(2026-11-14T04:09:54+00:00)*
