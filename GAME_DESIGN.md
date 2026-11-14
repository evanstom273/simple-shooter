# GAME_DESIGN.md

Authoritative, living record of the game's design. Timestamps are Europe/London, ISO 8601 with UTC offset, recorded at the time the decision was confirmed in conversation unless marked otherwise.

---

## A. Project Overview

A **2D side-view, wave-based roguelite arena shooter** (History #1, #7). The player, a square, survives increasingly difficult waves of geometric enemies in a single arena with platforms, choosing one of three upgrades between waves. The focus is simple, enjoyable combat and replayability, at a small enough scope to actually finish. Working title: none yet; the repository is `simple-shooter`.

The core design (History #7–#15) was worked out in a separate conversation and brought here by Lyra; its timestamps are documentation time.

**Where the project stands (as of 2026-11-14T04:24:39+00:00):**
- Repository set up with GitHub Pages deployment from `main` (History #2) and these living documents (History #3).
- Stack chosen (History #4). Core design documented (History #7–#15) and the follow-up questions answered (2026-11-14T04:24:39+00:00, History #16–#22). Upgrade and enemy numbers are placeholders to tune in play (#19, #20).
- **Project scaffolded** (2026-11-14T04:15:39+00:00): builds and deploys; Phaser shows an empty placeholder scene under a React UI layer. No gameplay.

**Stack:** React, Vite, TypeScript, Tailwind CSS, Phaser, IndexedDB via Dexie.js; the same stack as Lyra's previous project (History #4). Phaser handles gameplay, physics, rendering and input; React handles menus, HUD and upgrade selection; Dexie handles local persistent data (History #5, #14). Deployed on GitHub Pages (History #2, #6).

**Guiding principles** *(carried over from Lyra's previous project's design document; flag if any don't apply here)*:
- Discuss → Decide → Document → Implement → Test → Expand.
- Small, polished and functional beats large and placeholder-filled.
- The creative director (Lyra) makes design decisions; recommendations are not decisions until approved.
- **Small scope, with the aim of actually finishing the game** (History #7, #15).
- **Built methodically, step by step, not one-shotted** (History #16).

---

## B. Confirmed Design Decisions

### Concept
- **A simple shooter.** *(2026-11-14T04:09:54+00:00 — History #1)*
- **2D side-view, wave-based roguelite arena shooter.** The player survives increasingly difficult waves of enemies and picks upgrades between waves. Focus on simple, enjoyable combat and replayability. Small scope, with the aim of actually finishing the game. Refines #1. *(2026-11-14T04:17:36+00:00 — History #7)*

### Runs, death and saving *(2026-11-14T04:24:39+00:00 — History #17)*
- **Endless waves.** A run goes on until you die; the score is how far you got. *(2026-11-14T04:24:39+00:00 — History #18)*
- **Dying ends the run, and that's the only way to lose it.** You start again fully from scratch: wave 1, no upgrades, no weapons.
- **A run survives closing the browser.** The run is saved between waves; come back (even days later) and you're on the **upgrade screen before the wave you left**. Leaving mid-wave restarts that wave, with what you had at the start of it.
- **Local high scores** kept in IndexedDB (Dexie): e.g. enemies killed and wave reached.

### Scope *(2026-11-14T04:17:36+00:00 — History #15)*
- One playable character.
- One arena initially.
- Three enemy types (#11).
- Four upgrade categories (#12).
- Simple geometric graphics (#8).
- Desktop and mobile support (#9).
- **Not in scope:** unnecessary simulation systems, crafting, elaborate skill trees or complex progression mechanics.

### Graphics *(2026-11-14T04:17:36+00:00 — History #8)*
- **Minimalist geometric shapes** instead of traditional sprites.
- **Player: a square.**
- **Enemies: different geometric shapes** per type.
- Simple platforms and projectiles.
- No elaborate character art or animations required.

### Movement and controls *(2026-11-14T04:17:36+00:00 — History #9)*
- **Desktop:** A/D move left and right; Space jumps; the mouse aims a full 360°; left-click shoots.
- **Mobile:** landscape orientation; a virtual joystick on the left for movement; tap or hold on the right side to aim and shoot; an on-screen jump button.
- **Dash:** right-click on desktop (towards the mouse); an on-screen dash button on mobile. *(2026-11-14T04:24:39+00:00 — History #21)*
- **Weapon switching (desktop):** number keys (1, 2, 3…) and the mouse wheel. *(2026-11-14T04:24:39+00:00 — History #22)*
- **Weapon switching (mobile):** an on-screen button that cycles through your weapons. *(2026-11-14T04:27:30+00:00 — History #25)*

### Arena *(2026-11-14T04:17:36+00:00 — History #10)*
- **Side-view arena with platforms at different heights.** Platforming and jumping are part of combat.
- Enemies spawn into the arena and attack the player.
- No exploration and no procedurally generated levels.

### Enemies *(2026-11-14T04:17:36+00:00 — History #11)*
| Enemy | Behaviour |
|---|---|
| **Melee** | Chases the player and attacks at close range. |
| **Ranged** | Shoots projectiles towards the player, potentially keeping its distance. |
| **Tank** | Slow-moving, with significantly more health. |

### Upgrades *(2026-11-14T04:17:36+00:00 — History #12)*
- **Four upgrades; three offered at random between waves; the player picks exactly one.**
- **Upgrades can be picked repeatedly and stack.**

| Upgrade | Effect |
|---|---|
| **Health** | Increases player health. |
| **Jump Height** | Increases jump height. |
| **Movement Speed** | Increases movement speed. |
| **Fire Rate** | Increases shooting speed. |

- **Diminishing returns:** each repeat of the same upgrade adds a bit less than the last. Actual amounts are placeholders, tuned once it's playable. *(2026-11-14T04:24:39+00:00 — History #19)*
- **Fire Rate applies to every weapon you carry** (a player stat, not per gun). *(2026-11-14T04:24:39+00:00 — History #22)*

### Taking damage *(2026-11-14T04:27:30+00:00 — History #23)*
- **Touching an enemy damages you**, unless you're dashing (#24).
- **Getting hit knocks you back a bit and takes some of your health.**

### Weapons and dash
- **The player starts unarmed, with only a dash that does damage.** *(2026-11-14T04:24:39+00:00 — History #21)*
- **The dash is kept for the whole run**, alongside any weapons. *(2026-11-14T04:24:39+00:00 — History #21)*
- **Dash: has a cooldown, damages enemies it hits, and makes you invulnerable while dashing**, so it's how you get through enemies without the contact damage (#23). Numbers tuned in play. *(2026-11-14T04:27:30+00:00 — History #24)*
- **Several weapons: pistol, automatic, shotgun, maybe others.** *(2026-11-14T04:24:39+00:00 — History #22)*
- **Weapons are offered between waves in the same three-card pool as the stat upgrades**; you still pick exactly one. *(2026-11-14T04:24:39+00:00 — History #22)*
- **You carry every weapon you've picked and switch between them** (#9 for inputs). *(2026-11-14T04:24:39+00:00 — History #22)*
- **Picking a weapon you already own improves it.** *(2026-11-14T04:24:39+00:00 — History #22)*
- **Improving a weapon raises its damage.** There's no damage upgrade among the four stat upgrades, so this is how damage goes up. *(2026-11-14T04:27:30+00:00 — History #26)*

### Waves *(2026-11-14T04:17:36+00:00 — History #13)*
- Enemies get progressively more difficult across waves.
- Enemy numbers increase as waves progress.
- New enemy types can be introduced in later waves.
- **Enemy stats are placeholders**, set relative to each other (the tank much tougher, ranged keeps its distance) and tuned once it's playable. *(2026-11-14T04:24:39+00:00 — History #20)*
- Upgrade selection happens between waves (#12).

### Technical architecture / platform
- **Stack: React, Vite, TypeScript, Tailwind CSS, Phaser, IndexedDB via Dexie.js**, the same as Lyra's previous project. *(2026-11-14T04:12:26+00:00 — History #4)*
- **Phaser renders the game; React handles UI panels**, the same split as the previous project. *(2026-11-14T04:13:47+00:00 — History #5)*
- **Phaser handles gameplay, physics, rendering and input; React handles menus, HUD and upgrade selection; Dexie handles local persistent data.** Refines #5. *(2026-11-14T04:17:36+00:00 — History #14)*
- **Deployed on GitHub Pages**, built and published by GitHub Actions on every push to `main`. *(2026-11-14T04:09:54+00:00 — History #2)*
- **Stay on GitHub Pages** unless the game gets big enough to warrant Cloudflare. *(2026-11-14T04:13:47+00:00 — History #6)*
- **Vite builds to `dist/`, and the Pages workflow deploys `dist/`.** *(2026-11-14T04:13:47+00:00 — History #6)*

### Documentation
- **Living `GAME_DESIGN.md`** in the format of Lyra's previous project's design document, plus `TODO.md`, kept updated as decisions are made and work is done. *(2026-11-14T04:09:54+00:00 — History #3)*

---

## C. Current Development Scope

### Scaffold — **DONE** *(2026-11-14T04:15:39+00:00)*
**In scope (done):** Vite + React + TypeScript + Tailwind CSS v4 + Phaser 4 + Dexie; Phaser lazily loaded in its own chunk and mounted under a React UI layer; placeholder scene; Dexie database with a `saves` table; Pages workflow building with Vite and deploying `dist/`.

**Out of scope:** any game design or gameplay.

---

## D. Future Possibilities

*Proposals only — not confirmed features.*

- **Moving to Cloudflare** if the game outgrows GitHub Pages (#6).

---

## E. Open Questions

1. **Title.** Deferred: Lyra will think of something.
2. ~~**Everything about the game itself.**~~ Core design resolved (#7–#15). The items left open in the original conversation:
   - ~~**Wave count.**~~ Endless (#18).
   - ~~**Upgrade amounts.**~~ Diminishing returns; values tuned in play (#19).
   - ~~**Enemy statistics.**~~ Placeholders tuned in play (#20).
   - ~~**Weapon selection.**~~ Several weapons (#22). Open: whether there are more than the three. ~~How picking an owned weapon improves it.~~ Damage (#26).
   - ~~**Additional mechanics.**~~ Unarmed start with a damaging dash (#21).
3. ~~**Stack.**~~ Resolved (#4); Phaser/React split resolved (#5).
4. ~~**Target devices.**~~ Resolved: desktop and mobile, mobile in landscape (#9, #15).
5. ~~**What Dexie stores.**~~ Resolved: local high scores and the run in progress (#17).
6. **Player health:** ~~what damage does~~ (knockback + health loss, #23); ~~what happens on death~~ (run ends, #17). Still open: whether there's a short invulnerability after a hit.
7. ~~**Dash details.**~~ Resolved: cooldown, damages enemies, invulnerable while dashing (#24). Numbers tuned in play.
8. ~~**Weapon switching on mobile.**~~ Resolved: a cycle button (#25).

---

## F. Implementation Status

*Updated 2026-11-14T04:15:39+00:00.*

| Feature | Status | Notes |
|---|---|---|
| Design docs | Done | `GAME_DESIGN.md`, `TODO.md`. |
| GitHub Pages deployment | Implemented | `.github/workflows/pages.yml`: on push to `main` (or run by hand), runs `npm ci` and `npm run build` on Node 22 and deploys `dist/` (#6). Pages source is set to GitHub Actions (done by Lyra in the repo settings). *(updated 2026-11-14T04:15:39+00:00)* |
| Project scaffold | Tested | `npm run build` (type-check + Vite build) and `npm run lint` pass; checked in headless Chromium via `vite preview`: canvas renders, no console errors. *(2026-11-14T04:15:39+00:00)* |
| Saves | Scaffolded | Dexie database `simple-shooter`, table `saves` (`id`, `data`, `updatedAt`). Nothing reads or writes it yet. |

### Known issues and limitations
- Phaser is a large chunk (~1.4 MB minified, ~360 KB gzipped). It loads lazily after the page, and the Vite size warning is raised to 1600 KB to stop it nagging.
- No tests yet (Heat & Handle used Vitest; not added here until there's logic to test).

### Implementation interpretations (technical, not design decisions — flag if wrong)
- The guiding principles in §A and the workflow standing order in §H were carried over from Lyra's previous design document rather than restated for this project.
- Phaser's scale mode is `RESIZE` (the canvas fills the window). Placeholder only: how the game should scale isn't decided.
- Resuming at the upgrade screen (#17) means saving the run at the end of each wave, with health as it was then.

---

## G. Decision History

*Append-only. Changed decisions are recorded as new entries; earlier entries are preserved.*

| # | Timestamp (Europe/London) | Category | Decision |
|---|---|---|---|
| 1 | 2026-11-14T04:09:54+00:00 | Concept | A simple shooter. |
| 2 | 2026-11-14T04:09:54+00:00 | Deployment | GitHub Pages, deployed by GitHub Actions on push to `main`. |
| 3 | 2026-11-14T04:09:54+00:00 | Documentation | Living `GAME_DESIGN.md` (format of Lyra's previous project) and `TODO.md`. |
| 4 | 2026-11-14T04:12:26+00:00 | Technical | Stack: React, Vite, TypeScript, Tailwind CSS, Phaser, IndexedDB via Dexie.js (same as the previous project). |
| 5 | 2026-11-14T04:13:47+00:00 | Technical | Phaser renders the game; React handles UI panels (same split as the previous project). |
| 6 | 2026-11-14T04:13:47+00:00 | Deployment | Stay on GitHub Pages unless the game gets big enough to warrant Cloudflare. Vite builds to `dist/`, which the Pages workflow deploys. |
| 7 | 2026-11-14T04:17:36+00:00 | Concept | 2D side-view, wave-based roguelite arena shooter: survive increasingly difficult waves, pick upgrades between waves; simple, enjoyable combat and replayability; small scope, aiming to finish. Refines #1. Decided in a separate conversation; timestamp is documentation time (applies to #7–#15). |
| 8 | 2026-11-14T04:17:36+00:00 | Graphics | Minimalist geometric shapes, no sprites. Player is a square; enemies are different shapes; simple platforms and projectiles; no elaborate art or animation. |
| 9 | 2026-11-14T04:17:36+00:00 | Controls | Desktop: A/D move, Space jump, mouse 360° aim, left-click shoot. Mobile: landscape; left virtual joystick moves; tap/hold on the right aims and shoots; on-screen jump button. |
| 10 | 2026-11-14T04:17:36+00:00 | Arena | One side-view arena with platforms at different heights; platforming is part of combat; enemies spawn in. No exploration or procedural levels. |
| 11 | 2026-11-14T04:17:36+00:00 | Enemies | Three types: Melee (chases, close-range attacks), Ranged (shoots at the player, may keep distance), Tank (slow, much more health). |
| 12 | 2026-11-14T04:17:36+00:00 | Upgrades | Four upgrades (Health, Jump Height, Movement Speed, Fire Rate). Three offered at random between waves; pick exactly one; repeats allowed and stack. |
| 13 | 2026-11-14T04:17:36+00:00 | Waves | Difficulty and enemy numbers rise across waves; new enemy types can appear later; upgrade choice between waves. |
| 14 | 2026-11-14T04:17:36+00:00 | Technical | Phaser: gameplay, physics, rendering, input. React: menus, HUD, upgrade selection. Dexie: local persistent data. GitHub Pages. Refines #5. |
| 15 | 2026-11-14T04:17:36+00:00 | Scope | One character, one arena initially, three enemy types, four upgrade categories, geometric graphics, desktop and mobile. No unnecessary simulation, crafting, elaborate skill trees or complex progression. |
| 16 | 2026-11-14T04:24:39+00:00 | Process | Build the game methodically, step by step, as a real game would be made; no one-shotting. |
| 17 | 2026-11-14T04:24:39+00:00 | Saves / runs | Dexie stores local high scores (e.g. enemies killed, wave reached) and the run in progress. Runs are saved between waves; closing the browser and returning (even days later) resumes at the upgrade screen before the interrupted wave. Dying is the only way to lose a run; you restart fully from scratch (no upgrades). |
| 18 | 2026-11-14T04:24:39+00:00 | Waves | Endless. |
| 19 | 2026-11-14T04:24:39+00:00 | Upgrades | Diminishing returns on repeated picks of the same upgrade; values are placeholders tuned in play. |
| 20 | 2026-11-14T04:24:39+00:00 | Enemies | Stats are placeholders tuned in play. |
| 21 | 2026-11-14T04:24:39+00:00 | Weapons / dash | Player starts unarmed with a dash that does damage. Dash on right-click (towards the mouse) / mobile button; kept for the whole run. |
| 22 | 2026-11-14T04:24:39+00:00 | Weapons | Several weapons: pistol, automatic, shotgun, maybe others. Offered in the same three-card pool as upgrades (pick one). Carry them all and switch with number keys and the mouse wheel. Picking an owned weapon improves it. Fire Rate applies to all weapons. |
| 23 | 2026-11-14T04:27:30+00:00 | Combat | Touching an enemy damages you unless you're dashing. Getting hit causes a bit of knockback and takes some health. |
| 24 | 2026-11-14T04:27:30+00:00 | Dash | Dash has a cooldown, damages enemies and makes you invulnerable while dashing. |
| 25 | 2026-11-14T04:27:30+00:00 | Controls | Mobile weapon switching: an on-screen button that cycles weapons. |
| 26 | 2026-11-14T04:27:30+00:00 | Weapons | Picking an owned weapon raises its damage (there's no damage stat upgrade). Title deferred. |

---

## H. Technical Notes

- **Repository:** `evanstom273/simple-shooter`. Working branch `ccr-fd64429e-dgca91`.
- **Workflow (Lyra's standing order across all her projects, from the previous design document):** after committing to the working branch, always merge straight to `main` as well; no need to ask each time.
- **Deployment:** `.github/workflows/pages.yml` uses `actions/setup-node` (22), `npm ci`, `npm run build`, then `actions/configure-pages`, `actions/upload-pages-artifact` (path `dist`) and `actions/deploy-pages`. Vite `base` is `/simple-shooter/`. Can also be run manually from the Actions tab (`workflow_dispatch`). Site URL: https://evanstom273.github.io/simple-shooter/
- **Code layout:** `src/main.tsx` entry; `src/App.tsx` stacks the Phaser view and the React UI layer; `src/game/` Phaser (`PhaserView` React host that lazily imports `createGame`, `MainScene` placeholder); `src/ui/` React UI (`Hud`, pointer-events off so input reaches the game); `src/persist/db.ts` Dexie.
- **Commands:** `npm run dev`, `npm run build`, `npm run lint` (oxlint), `npm run preview`.
