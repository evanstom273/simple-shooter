# TODO.md

Living to-do list. Timestamps are Europe/London, ISO 8601 with UTC offset. Design decisions live in `GAME_DESIGN.md`; this file tracks the work.

---

## In progress

- Nothing yet.

## Next

**Priority (Lyra, #67):** ~~1. player shooting~~ (done) · ~~2. hub + shop~~ (done, #74) · 3. randomly generated platforms (designed: #79–#82). Then worlds and art.

- Tune the ranged enemy and tank in play.
- Next (Lyra): enemy and boss designs. Bosses: 3 mini + 1 major per world (#91). Worlds (working set, #88–#89, see §B Worlds): Celestial Gothic Horror, Frozen Sci-fi, Volcanic Industrial, Overgrown Solarpunk (a breath of fresh air). Open: order, portal mapping, names, hazards per world, rosters, bosses.
- Hand-designed arenas (#100): mock up section 1 of Celestial Gothic Horror first. Then decide endless (keep generating or hand-made rooms) and whether to remove the generator.
- Generation, remaining steps (#79):
  6. World palettes and the per-section ramp, once worlds have identities.
- Lyra to play: wall jump feel, generated sections, each hazard, the chunk editor (Testing → Test room / Random room / Chunk editor).
- Grapple, bought in the shop (#77, #78): design it. Never gating: the platform generator builds for the base kit only (base jump, double jump, dash, wall jump).
- Hub part 3: the short tutorial room on first launch (#70).
- Lyra to play the hub and story loop: section length, gold per section, shop prices, the wave offset per section (#74).
- Restructure (#62) still to come: boss fights, per-world enemy rosters, world names.
- Decide what makes waves harder past ~wave 13.
- Tune the melee enemy in play after the difficulty pass (#48–#51): wind-up, roll speed, dizzy, cooldown if still too hard.
- When combat exists, add its juice: hit-stop, enemy hit flash/squash/knockback, death shards, muzzle flash + recoil (shotgun shove), damage feedback (bigger shake, red edge pulse, light dims at low health), last-kill slow motion, wave banners, animated upgrade cards.
- Title (Lyra, deferred).
- Lyra to try the bigger arena and zoom (#35) on the Fold and desktop; also whether the movement blur is gone.
- Plan the next step (#16).

## Done

- [x] Endless rebuilds every wave: sink-and-rise sweep, fixed room size, no pits, hazards ramp by wave (#85). *(2026-11-15T00:07:50+00:00)*
- [x] Generation decluttered: sparser zigzag air layers, merged platforms, bigger air chunks (#84). *(2026-11-15T00:04:29+00:00)*
- [x] Step 13: wall jumping, level generator + starter chunks, hazards and environment pieces, in-game chunk editor (#79–#83). *(2026-11-14T23:55:09+00:00)*
- [x] Portals need a press to enter, with a prompt and an ENTER touch button (#76). *(2026-11-14T23:21:05+00:00)*
- [x] Transitions: fades between places, player beam-in on arrival, portal pull and beam-out on leaving (#75). *(2026-11-14T23:04:37+00:00)*
- [x] Hub in the game as the main menu: portals to story sections (5 waves), shop on pedestals with reroll, training dummy, endless portal, death/clear rules, progress saved, W / ↑ and touch BUY (#70, #72, #74). *(2026-11-14T22:06:39+00:00)*
- [x] Character art in the game: player, melee, ranged, tank (#73). *(2026-11-14T22:06:39+00:00)*
- [x] Melee-first rebalance: gun damage ~40%, only dash/stomp kills heal, Fire Rate → dash & stomp damage upgrade (design; hook in code) (#69). *(2026-11-14T21:39:33+00:00)*
- [x] Step 12: player shooting: pistol / automatic / shotgun, magazines + auto-reload, switching (keys, wheel, SWAP), HUD icons, testing Give buttons (#68). *(2026-11-14T21:30:44+00:00)*
- [x] Step 11: basic endless waves, gold drops + magnet, score, wave HUD + intermission count-up, run over + Play again, local high scores (#60). *(2026-11-14T14:52:38+00:00)*
- [x] Step 10: stomp (#59). *(2026-11-14T14:38:46+00:00)*
- [x] Testing: automatic spawning off; on-screen spawn buttons for each enemy (touch and desktop). *(2026-11-14T14:33:08+00:00)*
- [x] Step 9: ranged enemy (#56), tank (#58), health 5 × 4 with 2-stage hits (#57), hazards, spawner for all three. *(2026-11-14T07:12:19+00:00)*
- [x] Dash cooldown 0.8 s → 1.6 s (#55). *(2026-11-14T06:53:18+00:00)*
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
