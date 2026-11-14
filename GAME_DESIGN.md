# GAME_DESIGN.md

Authoritative, living record of the game's design. Timestamps are Europe/London, ISO 8601 with UTC offset, recorded at the time the decision was confirmed in conversation unless marked otherwise.

---

## A. Project Overview

A **2D side-view, wave-based roguelite arena shooter** (History #1, #7). The player, a square, survives increasingly difficult waves of geometric enemies in a single arena with platforms, choosing one of three upgrades between waves. The focus is simple, enjoyable combat and replayability, at a small enough scope to actually finish. Working title: none yet; the repository is `simple-shooter`.

The core design (History #7–#15) was worked out in a separate conversation and brought here by Lyra; its timestamps are documentation time.

**Where the project stands (as of 2026-11-14T06:47:26+00:00):**
- Repository set up with GitHub Pages deployment from `main` (History #2) and these living documents (History #3).
- Stack chosen (History #4). Core design documented (History #7–#15) and the follow-up questions answered (2026-11-14T04:24:39+00:00, History #16–#22). Upgrade and enemy numbers are placeholders to tune in play (#19, #20).
- **Project scaffolded** (2026-11-14T04:15:39+00:00): builds and deploys; Phaser shows an empty placeholder scene under a React UI layer.
- **Contact damage removed entirely** (#52): only attacks hurt (2026-11-14T06:47:26+00:00).
- **After playtesting the melee enemy ("very fucking hard"):** health is now 5 pips × 5 stages; contact costs a stage, attacks a pip; kills heal a stage; enemies take turns attacking; enemies 1.1× the player; enemy health bars (2026-11-14T06:44:50+00:00, #48–#51).
- **Melee enemy built** (#40); practice dummies removed; a temporary spawner keeps two in the arena (2026-11-14T06:35:05+00:00).
- **Heal on kills built** (#47) (2026-11-14T06:23:49+00:00).
- **Player health built; gun removed (start unarmed); dash damages dummies; dash auto-aims in the auto modes** (2026-11-14T06:17:03+00:00).
- **Off-screen enemy markers and target zoom-out** (2026-11-14T06:06:53+00:00).
- **After testing: bullets pass through platforms; auto-aim re-picks the nearest target continuously** (2026-11-14T05:50:22+00:00).
- **Shooting and aiming built** (all three aim modes, settings panel, test pistol, practice dummies) (2026-11-14T05:45:20+00:00).
- **Short hops removed; bigger arena experiment (2400×1350, 0.8× zoom, 10 platforms)** (2026-11-14T05:12:44+00:00).
- **Sound, short hops, coyote time, jump buffering, one-way platforms, vibration, camera look-ahead, platform reactions and motes** (2026-11-14T05:08:55+00:00).
- **Lighting, screen shake and smoother movement** (2026-11-14T05:00:48+00:00).
- **Squash, stretch and movement effects built; dash cooldown shown on desktop** (2026-11-14T04:55:00+00:00).
- **Dash and double jump built** (2026-11-14T04:49:36+00:00).
- **Movement built** (2026-11-14T04:42:54+00:00): the square runs and jumps around a placeholder arena, on desktop (A/D, Space) and touch (joystick, jump button).

**Stack:** React, Vite, TypeScript, Tailwind CSS, Phaser, IndexedDB via Dexie.js; the same stack as Lyra's previous project (History #4). Phaser handles gameplay, physics, rendering and input; React handles menus, HUD and upgrade selection; Dexie handles local persistent data (History #5, #14). Deployed on GitHub Pages (History #2, #6).

**Guiding principles** *(carried over from Lyra's previous project's design document; flag if any don't apply here)*:
- Discuss → Decide → Document → Implement → Test → Expand.
- Small, polished and functional beats large and placeholder-filled.
- The creative director (Lyra) makes design decisions; recommendations are not decisions until approved.
- **Small scope, with the aim of actually finishing the game** (History #7, #15).
- **Built methodically, step by step, not one-shotted** (History #16).
- **Depth before breadth** (Lyra, 2026-11-14): get the basics in and give the existing mechanics depth so nothing is shallow, rather than piling on new mechanics. More enemy types, bosses and so on aren't ruled out; they come after the basics. This is what separates this project's growth from scope creep.

---

## B. Confirmed Design Decisions

### Concept
- **A simple shooter.** *(2026-11-14T04:09:54+00:00 — History #1)*
- **2D side-view, wave-based roguelite arena shooter.** The player survives increasingly difficult waves of enemies and picks upgrades between waves. Focus on simple, enjoyable combat and replayability. Small scope, with the aim of actually finishing the game. Refines #1. *(2026-11-14T04:17:36+00:00 — History #7)*

### Runs, death and saving *(2026-11-14T04:24:39+00:00 — History #17)*
- **Endless waves.** A run goes on until you die; the score is how far you got. *(2026-11-14T04:24:39+00:00 — History #18)*
- **Dying ends the run, and that's the only way to lose it.** You start again fully from scratch: wave 1, no upgrades, no weapons.
- **A run survives closing the browser.** The run is saved between waves; come back (even days later) and you're in the **shop** (was: upgrade screen, #53) **before the wave you left**. Leaving mid-wave restarts that wave, with what you had at the start of it.
- **Local high scores** kept in IndexedDB (Dexie): **the run's final cumulative score** (#53), plus e.g. wave reached.

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
- **Dark arena, lit around the player.** The edges of the screen fall away into darkness and a soft pool of light follows the player. Characters and effects (player, dust, trails, later enemies and bullets) are never darkened. *(2026-11-14T05:00:48+00:00 — History #31)*
- **A tiny amount of screen shake** on impacts (hard landings, dashing into walls), off when the device's reduce-motion setting is on. *(2026-11-14T05:00:48+00:00 — History #31)*

### Movement and controls *(2026-11-14T04:17:36+00:00 — History #9)*
- **Desktop:** A/D move left and right; Space jumps; S drops through platforms (#33); the mouse aims a full 360°; left-click shoots.
- **Mobile:** landscape orientation; a virtual joystick on the left for movement; tap or hold on the right side to aim and shoot; an on-screen jump button.
- **Fixed jump height again: short hops removed** after playtesting (Lyra: didn't fit). Every jump, including the double jump, is full height. Supersedes #32. *(2026-11-14T05:12:44+00:00 — History #34)*
- ~~**Short hops:**~~ *(Removed by #34.)* let go of jump early for a lower jump; holding gives the full height, which the Jump Height upgrade (#12) raises. Applies to the double jump too. *(2026-11-14T05:08:55+00:00 — History #32)*
- **One-way platforms:** jump up through platforms from below; press down (S on desktop, joystick down on touch; down + jump also works) to drop through. The floor is solid. *(2026-11-14T05:08:55+00:00 — History #33)*
- **Double jump:** press jump again in mid-air for one extra jump. *(2026-11-14T04:49:36+00:00 — History #30)*
- **Aiming is a setting with three modes** *(2026-11-14T05:20:16+00:00 — History #36)*:
  - **Manual:** aim and shoot yourself (desktop: mouse aim, left-click; touch: tap/hold on the right side, as in #9).
  - **Auto aim, manual shooting:** the game picks the target; you choose when to fire.
  - **Full auto:** the game aims and fires.
  - **Touch trigger:** hold anywhere on the right side of the screen (away from JUMP and DASH) to shoot, in every mode; in Manual shots go towards your thumb, otherwise at the auto-aim target. No separate SHOOT button. *(2026-11-14T05:45:20+00:00 — History #41)*
  - **Full auto never fires at nothing:** only when it has a target (line of sight no longer applies, #42). *(2026-11-14T05:45:20+00:00 — History #41)*
  - **Gun barrel:** a small barrel nub on the square points where you're aiming. *(2026-11-14T05:45:20+00:00 — History #41)*
  - **Choosing a mode:** a settings panel (gear button, top right); the choice is saved. *(2026-11-14T05:45:20+00:00 — History #41)*
  **Defaults: Auto aim, manual shooting on mobile; Manual on desktop.** *(2026-11-14T05:22:58+00:00 / 2026-11-14T05:23:10+00:00 — History #39)*
  Motivation: manual aiming on a phone, especially the Fold's cover screen, is awkward with the right thumb already on jump and dash.
- **Auto-aim targets the nearest enemy**, with a visible indicator on the current target. No facing-based targeting: the square has no front.
  - **Off-screen markers:** an arrow at the screen edge for every enemy you can't see, in the enemy's colour; closer enemies get bigger, brighter arrows. The auto-aim target's arrow is yellow, larger and pulsing. *(2026-11-14T06:06:53+00:00 — History #44)*
  - **Zoom out for an off-screen target:** while the auto-aim target is off screen the camera zooms out (up to 15%) to bring it in, easing out quickly and back slowly. *(2026-11-14T06:06:53+00:00 — History #44)*
  - **Bullets pass through platforms, and platforms don't block auto-aim.** Only the floor stops bullets. Supersedes the line-of-sight rule below. *(2026-11-14T05:50:22+00:00 — History #42)*
  - **Auto-aim re-picks the nearest target in range every frame**, switching only when another target is at least 15% closer (so the bracket doesn't flicker). Supersedes "locked until it dies". *(2026-11-14T05:50:22+00:00 — History #43)*
  - ~~**The target stays locked until it dies**; then the next nearest is picked.~~ *(Superseded by #43.)* *(2026-11-14T05:22:06+00:00 — History #38)*
  - **No target in range: shots go straight ahead**, i.e. the way you last moved. *(2026-11-14T05:22:06+00:00 — History #38)*
  - ~~**Line of sight:** auto-aim only picks enemies it can see; platforms block.~~ *(Superseded by #42.)* *(2026-11-14T05:22:06+00:00 — History #38)*
  - **Range:** a placeholder (700 px, about two-fifths of the desktop view width), tuned in play. *(2026-11-14T05:22:06+00:00 — History #38)*
  *(2026-11-14T05:20:16+00:00 — History #37)*
- **Dash:** right-click on desktop (towards the mouse); an on-screen dash button on mobile. *(2026-11-14T04:24:39+00:00 — History #21)*
- **Weapon switching (desktop):** number keys (1, 2, 3…) and the mouse wheel. *(2026-11-14T04:24:39+00:00 — History #22)*
- **The game fills the whole screen** in every shape: desktop, the Fold's cover screen in landscape and portrait, and its inner screen. Where the screen's shape doesn't match the arena, the view is zoomed in and follows the player (portrait gets a narrower, zoomed-in view). No margins. *(2026-11-14T04:45:51+00:00 — History #29)*
- **Weapon switching (mobile):** an on-screen button that cycles through your weapons. *(2026-11-14T04:27:30+00:00 — History #25)*

### Arena *(2026-11-14T04:17:36+00:00 — History #10)*
- **Arena size experiment:** 2400×1350 (was 1600×900), camera zoomed out to 0.8× the old baseline so more is visible and the camera scrolls around the arena; 8–10 platforms; player speed and dash distance unchanged. First experiment, to be judged in play. *(2026-11-14T05:12:44+00:00 — History #35)*
- **Side-view arena with platforms at different heights.** Platforming and jumping are part of combat.
- Enemies spawn into the arena and attack the player.
- No exploration and no procedurally generated levels.

### Enemies *(2026-11-14T04:17:36+00:00 — History #11)*
| Enemy | Behaviour |
|---|---|
| **Melee** | Chases the player and attacks at close range. |
| **Ranged** | Shoots projectiles towards the player, potentially keeping its distance. |
| **Tank** | Slow-moving, with significantly more health. |

### Enemies attack in turns *(2026-11-14T06:44:50+00:00 — History #49)*
- **Only one enemy winds up or lunges at a time.** The others hang back about 400 px away, hopping back and forth, until the attacker's dizzy spell ends; then a 0.5 s gap before the next can start.

### Enemy health bars *(2026-11-14T06:44:50+00:00 — History #51)*
- **A small segmented bar above each enemy** (one segment per hit point), shown once it's been hit; untouched enemies stay clean.

### Melee enemy *(2026-11-14T05:31:56+00:00 — History #40)*
Designed with Lyra through a round of questions. All numbers are placeholders, tuned in play.
- **Look:** an **orange circle**, ~~smaller than the player (about ¾ of the square's size)~~ **1.1× the player's size** *(2026-11-14T06:44:50+00:00 — History #50)*, with **one eye** that tracks you. Orange keeps red free for damage feedback.
- **Movement:** **quick little hops**: constant, bouncy and fairly fast.
- **Pathing:** **properly navigates** between platforms to reach you (works out a route), rather than just hopping straight at you.
- **Attack: a lunge, chosen by situation.** If you're on its level it **rolls** fast along the ground at you; if you're above or below it **leaps** through the air at you. Contact still hurts at any time (#23).
- **Tell:** during the wind-up it **glows brighter** (orange heating towards white-hot) with a **rising sound cue**.
- **After a lunge:** a **dizzy moment** where it's stopped and vulnerable, your window to hit back. A roll that misses **keeps going and bounces off walls** before it recovers.
- **Toughness:** **middling**: takes a few hits; one alone is a small fight.
- **Your dash:** **damages it**, and dashing into it **during the wind-up cancels the lunge** and dizzies it.
- **Death:** **shatters into curved orange shards** (pieces of the circle) that scatter and fade.
- **Spawning:** a **marker appears briefly first** as a warning, then it **fades in** there.
- **Crowds:** they **bump and push** each other, so a group spreads out rather than stacking.

### Shop and currency (replaces the three-card offer) *(2026-11-14T06:52:12+00:00 — History #53)*
- **Enemies drop currency when killed.** Drops scatter from the kill and **fly to you once you're close** (magnet). *(2026-11-14T06:52:12+00:00 — History #54)*
- **Between waves there's a shop.** Spend as much or as little as you like on **stat upgrades, new weapons and improvements to weapons you own**, or save it for later waves.
- **Rotating selection:** each shop offers a random handful of items, so runs play out differently. *(2026-11-14T06:52:12+00:00 — History #54)*
- **Escalating prices:** buying the same thing again costs more (pairs with diminishing returns, #19). *(2026-11-14T06:52:12+00:00 — History #54)*
- **The shop sells healing** too, so heal-or-upgrade is a choice. *(2026-11-14T06:52:12+00:00 — History #54)*
- **Score = everything you've earned this run**, including currency already spent; spending never lowers it.
- **Dying resets currency, weapons and upgrades**; the final score is recorded as a high score.
- Aim: more freedom and meaningful decisions between waves.

### Upgrades *(2026-11-14T04:17:36+00:00 — History #12; how you get them changed by #53)*
- ~~**Four upgrades; three offered at random between waves; the player picks exactly one.**~~ *(Replaced by the shop, #53.)* The four stat upgrades remain.
- **Upgrades can be picked repeatedly and stack.**

| Upgrade | Effect |
|---|---|
| **Health** | Increases player health. |
| **Jump Height** | Increases jump height. |
| **Movement Speed** | Increases movement speed. |
| **Fire Rate** | Increases shooting speed. |

- **Diminishing returns:** each repeat of the same upgrade adds a bit less than the last. Actual amounts are placeholders, tuned once it's playable. *(2026-11-14T04:24:39+00:00 — History #19)*
- **Fire Rate applies to every weapon you carry** (a player stat, not per gun). *(2026-11-14T04:24:39+00:00 — History #22)*

### Health, revised after playtesting *(2026-11-14T06:44:50+00:00 — History #48)*
- **25 health: 5 pips × 5 stages.** Each pip shows how many of its stages are left.
- ~~**Brushing an enemy costs 1 stage**, then 0.4 s invulnerability, with a light version of the hurt feedback.~~ *(Removed by #52.)*
- **Touching an enemy does nothing. Only attacks hurt.** Contact damage is gone entirely, for all enemies going forward. Supersedes #23. *(2026-11-14T06:47:26+00:00 — History #52)*
- **Being caught by an attack (a roll or leap) costs a whole pip**, then the full 1 s invulnerability, knockback and hurt feedback.
- **Each kill restores 1 stage** (5 kills = a pip); wasted at full health. Replaces the random 3–5 and the reset-on-hit of #47.

### Health *(2026-11-14T06:17:03+00:00 — History #45)*
- **5 hit points**, shown as five square pips top-left (React HUD). Placeholder number.
- **Hurt feedback:** knockback, a red pulse at the screen edges, bigger screen shake, a hurt sound, a vibration on the phone and a short freeze-frame; the square flickers while invulnerable.
- **Dying (temporary):** health refills with a white flash until runs exist (#17 is the real rule).
- ~~**Healing by kills:** every few kills gives one pip back.~~ *(Replaced by #48: one stage per kill.)* The number needed is **random between 3 and 5**, re-rolled for each pip. Kills while at full health are **wasted**; **getting hit resets** the partial progress; **every enemy counts as one kill**. *(2026-11-14T06:21:18+00:00 — History #47)*

### Taking damage *(2026-11-14T04:27:30+00:00 — History #23)*
- ~~**Touching an enemy damages you**, unless you're dashing (#24).~~ *(Superseded by #52: only attacks hurt.)*
- **Getting hit knocks you back a bit and takes some of your health.**
- **A short invulnerability after a hit**, so contact damage can't drain you in one go. Length tuned in play. *(2026-11-14T04:28:58+00:00 — History #27)*

### Weapons and dash
- **The player starts unarmed, with only a dash that does damage.** *(2026-11-14T04:24:39+00:00 — History #21)*
- **Dash aims itself in the auto-aim modes** (Auto aim, Full auto): with no movement input it goes for the auto-aim target. Touch: joystick direction if pushed, else the target, else facing. Desktop: A/D direction if held, else the target, else facing (mouse ignored, as for shooting). Manual is unchanged (mouse / joystick). *(2026-11-14T06:17:03+00:00 — History #46)*
- **The dash is kept for the whole run**, alongside any weapons. *(2026-11-14T04:24:39+00:00 — History #21)*
- **Dash: has a cooldown, damages enemies it hits, and makes you invulnerable while dashing**, so it's how you get through enemies without the contact damage (#23). Numbers tuned in play. *(2026-11-14T04:27:30+00:00 — History #24)*
- **Several weapons: pistol, automatic, shotgun, maybe others.** *(2026-11-14T04:24:39+00:00 — History #22)*
- **Three weapons for now, deliberately.** Others may be considered later (§D). *(2026-11-14T04:28:58+00:00 — History #28)*
- ~~**Weapons are offered between waves in the same three-card pool as the stat upgrades**; you still pick exactly one.~~ *(Replaced by the shop, #53.)* *(2026-11-14T04:24:39+00:00 — History #22)*
- **You carry every weapon you've picked and switch between them** (#9 for inputs). *(2026-11-14T04:24:39+00:00 — History #22)*
- **Improving a weapon you own** (now bought in the shop, #53). *(2026-11-14T04:24:39+00:00 — History #22)*
- **Improving a weapon raises its damage.** There's no damage upgrade among the four stat upgrades, so this is how damage goes up. *(2026-11-14T04:27:30+00:00 — History #26)*

### Waves *(2026-11-14T04:17:36+00:00 — History #13)*
- Enemies get progressively more difficult across waves.
- Enemy numbers increase as waves progress.
- New enemy types can be introduced in later waves.
- **Enemy stats are placeholders**, set relative to each other (the tank much tougher, ranged keeps its distance) and tuned once it's playable. *(2026-11-14T04:24:39+00:00 — History #20)*
- The shop opens between waves (#53).

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

### Step 8d: No contact damage — **BUILT** *(2026-11-14T06:47:26+00:00)*
Touching enemies never hurts; only a roll or leap does (#52).


### Step 8c: Difficulty pass after playtesting — **BUILT** *(2026-11-14T06:44:50+00:00)*
Stage-based health (#48), contact scrape vs attack hit, one stage healed per kill, turn-taking (#49), bigger enemies (#50), enemy health bars (#51). Enemy health (3) and count (2) unchanged at Lyra's request.


### Step 8b: The melee enemy — **BUILT** *(2026-11-14T06:35:05+00:00)*
**In scope (done):** everything in #40: look (orange circle, tracking eye), quick hops, platform route-finding, wind-up tell (glow + rising whine), roll on the same level / leap otherwise, dizzy afterwards with missed rolls bouncing off walls, 3 HP, dash damage and wind-up cancel, arc-shard death, spawn marker, bumping. Kills feed healing (#47). A temporary spawner (keeps 2; E spawns more). Practice dummies removed.

**Out of scope:** weapons, waves, upgrades.


### Step 8a: Player health — **BUILT** *(2026-11-14T06:17:03+00:00)*
**In scope (done):** health (#45) with HUD pips, hurt pulse and revive flash; contact damage, knockback and post-hit invulnerability (#23, #27); the gun removed so you start unarmed (#21); the dash damages targets once per dash with a freeze-frame (#24); dash auto-aim in the auto modes (#46); the practice dummies hurt on touch (temporary) so health can be tested.

**Next:** Step 8b, the melee enemy (#40).


### Step 7c: Off-screen markers and target zoom — **BUILT** *(2026-11-14T06:06:53+00:00)*
Edge arrows for off-screen enemies and a highlighted arrow for the auto-aim target; camera zooms out up to 15% while the target is off screen (#44).


### Step 7b: Shooting changes after testing — **BUILT** *(2026-11-14T05:50:22+00:00)*
Bullets pass through platforms and auto-aim ignores them (#42); auto-aim re-picks the nearest target continuously with a 15% switch margin (#43).


### Step 7: Shooting, aiming and controls — **BUILT** *(2026-11-14T05:45:20+00:00)*
**In scope (done):** the three aim modes (#36–#39, #41) with a settings panel; desktop mouse aim + left-click, touch right-side trigger; auto-aim lock (nearest, line of sight, 700 px, locked until it dies) with a target bracket; a temporary pistol from the start; bullets stopped by platforms; muzzle flash, glow, barrel kick, recoil, shot and impact sounds, sparks; crosshair on desktop Manual; temporary practice dummies.

**Out of scope:** weapon switching, the automatic and shotgun (weapons step); enemies (next step: the melee enemy, #40).


### Step 6: Fixed jump, bigger arena — **BUILT** *(2026-11-14T05:12:44+00:00)*
**In scope (done):** short hops removed (#34); arena 2400×1350 with a 0.8× zoom setting and 10 placeholder platforms in four tiers (#35); more motes for the bigger space.


### Step 5: Juice and platform movement — **BUILT** *(2026-11-14T05:08:55+00:00)*
**In scope (done):** synthesised sound effects with a remembered mute button; short hops (#32); coyote time and jump buffering; one-way platforms with drop-through (#33); phone vibration; camera look-ahead; platforms dip and brighten when landed on; ambient motes caught in the light.

**Deferred until combat exists** (in `TODO.md`): hit-stop, enemy hit flash/squash/knockback, death shards, muzzle flash and recoil, damage feedback (bigger shake, red edge pulse, light dimming at low health), last-kill slow motion, wave banners, animated upgrade cards.


### Step 4: Lighting, shake, smoother movement — **BUILT** *(2026-11-14T05:00:48+00:00)*
**In scope (done):** fix for the blur when moving (physics now steps once per drawn frame); refresh-rate-independent camera follow; tiny shake on hard landings and dash impacts; darkness around a pool of light that follows the player, under characters and effects (#31).


### Step 3: Feel — squash, stretch and effects — **BUILT** *(2026-11-14T04:55:00+00:00)*
**In scope (done):** springy squash and stretch on jump, double jump, landing, air speed, running lean, dash streak and wall impacts; dust on take-off, landing and skids; a dash-start burst; a dash cooldown bar under the square on desktop; a flash and ring when the dash is ready again (desktop and touch).

**Out of scope:** bigger screen shake (saved for hits and enemy deaths). A tiny amount on impacts was added afterwards (#31).


### Step 2: Dash and double jump — **BUILT** *(2026-11-14T04:49:36+00:00)*
**In scope (done):** double jump (#30); dash (#21, #24) on right-click towards the mouse and on a touch button, with a cooldown, invulnerability while dashing, and a trail.

**Out of scope:** dash damage (no enemies yet; the dash state is there for enemies to check), aiming and shooting.


### Step 1: Movement — **BUILT** *(2026-11-14T04:42:54+00:00)*
The player square in an arena, moving and jumping, on desktop and on Lyra's Pixel 10 Pro Fold (cover screen landscape and portrait, inner screen).

**In scope (done):** the square; gravity, running and jumping with Arcade physics; a placeholder arena (floor + five platforms); A/D and Space on desktop; on touch screens a joystick on the left and a jump button on the right; the arena scales to fit any screen shape; sharp rendering at the phone's real pixel density.

**Out of scope:** aiming, shooting, dash, enemies, health, waves, upgrades, saving.


### Scaffold — **DONE** *(2026-11-14T04:15:39+00:00)*
**In scope (done):** Vite + React + TypeScript + Tailwind CSS v4 + Phaser 4 + Dexie; Phaser lazily loaded in its own chunk and mounted under a React UI layer; placeholder scene; Dexie database with a `saves` table; Pages workflow building with Vite and deploying `dist/`.

**Out of scope:** any game design or gameplay.

---

## D. Future Possibilities

*Proposals only — not confirmed features.*

- **Moving to Cloudflare** if the game outgrows GitHub Pages (#6).
- **More weapons** beyond pistol, automatic and shotgun (Lyra: kept light for now, #28).

---

## E. Open Questions

1. **Title.** Deferred: Lyra will think of something.
1c. **Shop (#53, #54), open:** how many items per shop; whether you can reroll the selection; prices and how fast they escalate; what healing costs and whether it escalates; how much currency each enemy drops (per type?); whether weapons and improvements share the rotation with stat upgrades; shop UI.
1b. **Melee enemy (#40), open:** numbers (hop speed and height, health, damage, wind-up length, dizzy length, lunge speed), and whether "properly navigates" means planning routes across several platforms or one platform at a time.
1a. **Aim modes (#36–#38):** ~~line of sight~~ (yes), ~~range~~ (placeholder), ~~no target~~ (straight ahead), ~~stickiness~~ (locked until it dies). ~~Defaults~~ (mobile: auto aim + manual shooting; desktop: Manual, #39). Nothing left open here. To watch in testing: a locked target that goes behind a platform keeps the lock (#38), so shots would hit the platform until it comes back into view or dies.
2. ~~**Everything about the game itself.**~~ Core design resolved (#7–#15). The items left open in the original conversation:
   - ~~**Wave count.**~~ Endless (#18).
   - ~~**Upgrade amounts.**~~ Diminishing returns; values tuned in play (#19).
   - ~~**Enemy statistics.**~~ Placeholders tuned in play (#20).
   - ~~**Weapon selection.**~~ Several weapons (#22). ~~Whether there are more than the three.~~ Three for now (#28). ~~How picking an owned weapon improves it.~~ Damage (#26).
   - ~~**Additional mechanics.**~~ Unarmed start with a damaging dash (#21).
3. ~~**Stack.**~~ Resolved (#4); Phaser/React split resolved (#5).
4. ~~**Target devices.**~~ Resolved: desktop and mobile, mobile in landscape (#9, #15).
5. ~~**What Dexie stores.**~~ Resolved: local high scores and the run in progress (#17).
6. **Player health:** ~~what damage does~~ (knockback + health loss, #23); ~~what happens on death~~ (run ends, #17). ~~Invulnerability after a hit.~~ Yes, short (#27).
7. ~~**Dash details.**~~ Resolved: cooldown, damages enemies, invulnerable while dashing (#24). Numbers tuned in play.
8. ~~**Weapon switching on mobile.**~~ Resolved: a cycle button (#25).

---

## F. Implementation Status

*Updated 2026-11-14T04:42:54+00:00.*

| Feature | Status | Notes |
|---|---|---|
| Design docs | Done | `GAME_DESIGN.md`, `TODO.md`. |
| GitHub Pages deployment | Implemented | `.github/workflows/pages.yml`: on push to `main` (or run by hand), runs `npm ci` and `npm run build` on Node 22 and deploys `dist/` (#6). Pages source is set to GitHub Actions (done by Lyra in the repo settings). *(updated 2026-11-14T04:15:39+00:00)* |
| Project scaffold | Tested | `npm run build` (type-check + Vite build) and `npm run lint` pass; checked in headless Chromium via `vite preview`: canvas renders, no console errors. *(2026-11-14T04:15:39+00:00)* |
| Movement (#9) | Tested | Square (48 px) with gravity, running (eased towards top speed) and a fixed-height jump; collides with platforms and the arena edges. Desktop: A/D, Space. Touch: floating joystick in the left 45% of the screen (appears where your thumb lands; horizontal only), jump button bottom-right; shown on touch screens (or after the first touch). Multi-touch works (move + jump together). All numbers in `src/game/tuning.ts`. *(2026-11-14T04:42:54+00:00)* |
| Arena size and zoom (#35) | Tested | Arena 2400×1350. Zoom = the zoom at which the screen would show 1600×900 (the old arena), × `VIEW.zoom` (0.8), never so far out that the view exceeds the arena. Visible area: desktop 1440×900 → 1800×1125; cover landscape 2000×913; cover portrait 514×1125; inner ~1071×1125. 10 one-way platforms in four tiers 180 px apart; each tier reached from the one below with a single jump (checked). Single jump ≈ 192 px. 100 motes. *(2026-11-14T05:12:44+00:00)* |
| Screen fitting (#29) | Tested | *(Arena and zoom since changed by #35.)* The arena is a fixed 1600×900 world. The camera zooms until the arena covers the whole screen (no margins) and follows the player, clamped to the arena edges. Visible area: desktop 1440×900 of the arena; cover landscape 1600×731 (top trimmed, follows vertically); cover portrait 411×900 (about a quarter of the width); inner ~857×900. *(updated 2026-11-14T04:45:51+00:00)* Previously fit-whole-arena with margins. Rendered at device pixel ratio (capped at 3). Checked in headless Chromium at desktop 1440×900, Fold cover landscape 900×411 and portrait 411×900, and an approximate inner screen 790×830, at the Fold's pixel density. *(2026-11-14T04:42:54+00:00)* |
| Double jump (#30) | Tested | One extra jump in mid-air (90% of a normal jump's speed), with a small ring puff. Resets on landing. Walking off a ledge still leaves you the air jump. Jump Height (#12) will scale both. *(2026-11-14T04:49:36+00:00)* |
| Dash (#21, #24) | Tested | Right-click: dashes towards the mouse in any direction (360°). Touch: DASH button beside JUMP; dashes the way the joystick points, or the way you're facing if the stick is idle. 0.15 s at 1500 px/s (~225 px), gravity off, keeps 35% of its speed after; cooldown 0.8 s. Square turns blue with an afterimage trail. `invulnerable` is true for the whole dash, for enemies to check later. Touch button shows the cooldown as a ring filling back up. Works in the air. *(2026-11-14T04:49:36+00:00)* |
| Squash and stretch | Tested | The visible square (`PlayerView`) is separate from the physics box, so it deforms without affecting collisions. Scale runs on a damped spring (wobbles back to square). Jump: stretch 0.72×1.32; double jump 0.8×1.22; landing: squash up to 1.4×0.6 depending on impact speed; slight stretch with vertical speed in the air; lean into the run; dash: a 1.45×0.7 streak rotated along the dash (afterimages match); dashing into a wall, floor or ceiling ends the dash and flattens against it; coming out of a dash, a small stretch along its direction. Feet stay planted while squashing. *(2026-11-14T04:55:00+00:00)* |
| Movement effects | Tested | Small tumbling squares (`fx.ts`): dust on take-off, sideways dust on landing (more on hard landings), skid dust when turning round at speed, a blue burst behind you at dash start, sparks on dash impacts. *(2026-11-14T04:55:00+00:00)* |
| Dash cooldown display | Tested | Desktop: thin bar under the square that fills while recharging, hidden when ready (hidden when touch controls are showing; they have the button ring). Both: the square flashes white with a blue outline and a ring pulses out when the dash is ready again. *(2026-11-14T04:55:00+00:00)* |
| Smooth movement on fast screens | Tested | Blur when moving (reported by Lyra) was most likely 60 Hz physics on a 90/120 Hz screen, moving things only every other frame. Arcade physics now runs with `fixedStep: false` (one step per drawn frame), and the camera's follow smoothing is corrected for frame rate. Not yet confirmed on the Fold. *(2026-11-14T05:00:48+00:00)* |
| Screen shake (#31) | Tested | Hard landings (only above ~a third of max impact; scales with it) and dash impacts. ~4 px, ~0.1 s. Respects `prefers-reduced-motion`. Numbers in `SCREEN` in `tuning.ts`. *(2026-11-14T05:00:48+00:00)* |
| Lighting (#31) | Tested | A radial-gradient darkness image drawn between the arena (depth 0) and effects/player (5+), centred on the player and sized to the screen so it looks the same at every zoom. Lit core ~22% of its radius; ~92% dark at the radius (62% of the screen diagonal) and beyond. Touch controls are a separate scene, so unaffected. First tried as a camera vignette, which darkened the player too; Lyra liked the darkness, so it was kept but moved under the characters and centred on the player. *(2026-11-14T05:00:48+00:00)* |
| Sound | Tested (plays without errors; not listened to by a person yet) | Web Audio synthesis, no files (`src/audio/sfx.ts`): jump, double jump, landing (scaled by impact), dash whoosh, dash impact, dash-ready ping, skid, footstep ticks while running. Slight random pitch variation. Starts on the first tap or key press (browser rule). Mute button top-right (React), saved in Dexie (`saves` record `settings`) and restored on load. *(2026-11-14T05:08:55+00:00)* |
| ~~Short hops (#32)~~ | Removed (#34) | Releasing jump while rising cuts upward speed to 45%: a tap reached ~62 px, a full hold ~178 px. *(2026-11-14T05:08:55+00:00)* |
| Coyote time / jump buffer | Tested | 0.1 s after leaving a ledge still counts as a ground jump (keeps the double jump); a press up to 0.12 s before landing jumps on landing. *(2026-11-14T05:08:55+00:00)* |
| One-way platforms (#33) | Tested | Every platform but the floor only collides from above. Down on a one-way platform drops you through (0.22 s of ignoring platforms). *(2026-11-14T05:08:55+00:00)* |
| Vibration | Implemented (not testable headless) | `navigator.vibrate` on touch play only: 8–30 ms on landings by impact, 35 ms on dash impacts. Android Chrome; iOS has no vibration API. *(2026-11-14T05:08:55+00:00)* |
| Camera look-ahead | Tested | Leads up to 15% of the visible width in the running direction, easing in and out. Horizontal only. *(2026-11-14T05:08:55+00:00)* |
| Platform reaction | Tested | Landing dips the platform's visible shape 2–6 px and flashes it; the collision box doesn't move. *(2026-11-14T05:08:55+00:00)* |
| Motes | Tested | 45 faint drifting squares under the darkness layer, so they mostly show near the player's light. *(2026-11-14T05:08:55+00:00)* |
| Aim modes (#36–#39, #41) | Tested | `settingsStore` (plain TS, shared by React and Phaser) holds the mode; settings panel (gear button) with Manual / Auto aim / Full auto; saved in Dexie with mute. Defaults from `pointer: coarse`: touch → Auto aim, desktop → Manual. *(2026-11-14T05:45:20+00:00)* |
| Shooting (`Shooter.ts`) | Tested | Hold the trigger to fire at the weapon's rate (pistol 4/s, exact). Desktop: left mouse button; mouse aims in Manual (system cursor replaced by a crosshair). Touch: hold anywhere right of the joystick zone that isn't JUMP/DASH; in Manual shots go towards the thumb. No target in range: shots go straight ahead (direction last moved). Full auto fires only at a locked target in line of sight. Can't fire mid-dash. Bullets: 1900 px/s, sub-stepped so they can't skip thin platforms; pass through platforms (#42) and stop at the floor with sparks. *(2026-11-14T05:45:20+00:00)* |
| Auto-aim | Tested | *(Updated 2026-11-14T05:50:22+00:00, #42–#43.)* Nearest living target within 700 px, re-checked every frame; keeps the current target unless another is ≥15% closer (`AIM.switchMargin`); drops it when it dies or leaves range. Platforms ignored. Checked: a 6% difference kept the old target, 33% switched. *Previously:* line of sight + locked until death. Rotating corner bracket on the locked target. *(2026-11-14T05:45:20+00:00)* |
| Shot feel | Tested | Muzzle star flash, additive glow, barrel kicks back, small recoil push (sideways; lift when firing down in the air), tiny squash, shot sound; impact sparks + tick. *(2026-11-14T05:45:20+00:00)* |
| Off-screen markers (#44) | Tested | `MarkersScene` (screen space, drawn under the touch controls): for each living target outside the view, an arrowhead where the line from screen centre to the target meets the edge (inset 26 CSS px). Size 9–15 px and opacity by distance (fades out to 1600 px). Auto-aim target: yellow, 16–19 px pulsing, with a pulsing ring. Each target supplies its marker colour. *(2026-11-14T06:06:53+00:00)* |
| Health (#45) | Superseded by #48 | `hudStore` (plain TS) shared with React. Touching a target without invulnerability: −1 HP, knockback away and up (520/480 px/s), 1 s invulnerability with flicker, 0.08 s freeze-frame, shake, red edge pulse (CSS), sound, 80 ms vibration. At 0 HP: refill, 1.5 s invulnerability, white flash and chime (temporary). *(2026-11-14T06:17:03+00:00)* |
| Dash damage | Tested | Dashing through a target hits it once per dash (1 damage), with white sparks, a thud, a small shake, 25 ms vibration and a 0.05 s freeze-frame. Three dashes pop a dummy. *(2026-11-14T06:17:03+00:00)* |
| Dash grace | Tested | 0.12 s of invulnerability after a dash ends (`DASH.grace`), added after testing showed a dash ending just inside a dummy hurt the player. *(2026-11-14T06:17:03+00:00)* |
| Dash auto-aim (#46) | Tested | Auto modes, no movement input: dash direction = towards the auto-aim target (checked: mouse ignored, dash went to the target); with A held it went straight left. *(2026-11-14T06:17:03+00:00)* |
| Unarmed start (#21) | Tested | Gun switched off (`armed = false`): no shooting, no barrel; auto-aim still runs (bracket and markers show the dash target). Shooting code kept for the weapons step. *(2026-11-14T06:17:03+00:00)* |
| Heal on kills (#47) | Superseded by #48 | Each kill while hurt counts towards the next pip; the number needed is rolled 3–5 (`HEAL`) and re-rolled after each heal. Kills at full health are ignored; a hit resets the count. HUD: the first empty pip fills from the bottom (kills ÷ needed); the restored pip pops in; in game a ring, rising white sparks, a chime and a short buzz. Dummy pops count as kills. *(2026-11-14T06:23:49+00:00)* |
| Melee enemy (#40) | Tested | `enemies/MeleeEnemy.ts`. Radius 18 (¾ of the square), 3 HP. Invisible physics circle + a visible circle that squashes; eye tracks the player (spins with the body when rolling, wobbles when dizzy, with orbiting stars). States: spawning (1 s marker) → chase (hops 240×380 px/s, 0.06 s pause) → wind-up 0.5 s (heats orange→white, shivers, rising whine) → roll (880 px/s, ends after 2 wall bounces or 1.6 s) or leap (0.55 s ballistic arc to where you were) → dizzy 1 s → 0.8 s before it can lunge again. Lunges when within 300 px: roll if on your platform (or within 40 px vertically), else leap. Hit: white flash, squash, knockback; a hit in the wind-up, roll or leap makes it dizzy. Death: six curved orange arc shards, sparks, ring, shatter sound, counts as a kill (#47). Checked: spawn → drop to the floor → hop over → wind-up → roll hits you → wall bounce → dizzy; climbs to the top platform; leaps up from below. *(2026-11-14T06:35:05+00:00)* |
| Enemy route-finding | Tested | `enemies/nav.ts`: graph of moves between platforms (jump straight up through a one-way platform above, drop through one below, hop across a gap up or down), shortest route by breadth-first search. Every platform reachable from the floor and back. Target = the platform you're on, or the one below you if you're in the air. *(2026-11-14T06:35:05+00:00)* |
| Temporary spawner | Temporary | Keeps 2 enemies in the arena, a new one 2 s after a kill, on a random platform ≥600 px from you; E (desktop) spawns an extra. Until waves exist. *(2026-11-14T06:35:05+00:00)* |
| Stage health (#48) | Tested | Health counted in stages (25). *Contact damage removed by #52 (checked: glued to a non-attacking enemy for 2 s, no damage).* Roll/leap hit: −5 stages (checked 25→20→15). Kill: +1 stage (checked 20→21); the pip that refills pops. HUD pips fill from the bottom by stages. Temporary refill at 0 kept. *(2026-11-14T06:44:50+00:00)* |
| Turn-taking (#49) | Tested | Scene-level token: an enemy must get the turn to wind up; released when its dizzy spell ends (or it dies), then 0.5 s gap. Others within 480 px hop away to ~400 px or shuffle. Checked over 9 s with two enemies: never more than one attacking at once; they alternated. *(2026-11-14T06:44:50+00:00)* |
| Enemy size (#50) | Done | Radius 26 (1.1 × the 48 px square). *(2026-11-14T06:44:50+00:00)* |
| Enemy health bar (#51) | Tested | Three 12×5 px segments above the enemy, orange for remaining HP; drawn once it's taken a hit. *(2026-11-14T06:44:50+00:00)* |
| Target zoom-out (#44) | Tested | If the auto-aim target is outside the view *at normal zoom* (so it can't see-saw), zoom out just enough to fit it plus a margin, capped at 15% (`VIEW.targetZoomOut`); eases out at 3/s, back at 1.2/s. Never zooms out past the arena. Portrait check: a target just off screen pulled in at ~5% zoom-out; one further away hit the cap and kept its yellow arrow. *(2026-11-14T06:06:53+00:00)* |
| ~~Test pistol~~ | Removed | You now start unarmed (#21); the gun returns through upgrade offers. |
| ~~Practice dummies~~ | Removed (replaced by the melee enemy) | Five grey circles floating above platforms; 3 hits (dash or shot) to pop, respawn after 2.5 s; touching one hurts (to test health). Removed when the melee enemy goes in. |
| Saves | Scaffolded | Dexie database `simple-shooter`, table `saves` (`id`, `data`, `updatedAt`). Nothing reads or writes it yet. |

### Known issues and limitations
- **No way to get a gun yet**: you start unarmed (#21) and weapons come from upgrade offers, which don't exist yet.
- **Dash doesn't damage anything yet**: there's nothing to hit.
- **Arena layout is a placeholder** (floor + five platforms) so there's something to jump on; not a designed arena (#10).
- **Zoomed-in views see less of the arena** (#29): in portrait about a fifth of its width. Off-screen enemies now get edge markers (#44).
- **Portrait: the player sits under the touch controls** when on the floor (the camera can't scroll below the arena), so the square is partly hidden behind DASH. Accepted by Lyra (2026-11-14): still playable; not fixing for now.
- **Touch controls sit over the game**, most noticeably in portrait, where the floor and the player run under the joystick and jump button.
- Not yet tried on the physical Pixel 10 Pro Fold.
- Phaser is a large chunk (~1.4 MB minified, ~360 KB gzipped). It loads lazily after the page, and the Vite size warning is raised to 1600 KB to stop it nagging.
- No tests yet (Heat & Handle used Vitest; not added here until there's logic to test).

### Implementation interpretations (technical, not design decisions — flag if wrong)
- The guiding principles in §A and the workflow standing order in §H were carried over from Lyra's previous design document rather than restated for this project.
- **Placeholder platform layout for #35** (four tiers, each a single jump apart) is Claude's, not designed.
- **16:9 arena** as a middle ground between desktop, the Fold's very wide cover screen and its near-square inner screen. Camera follow is slightly smoothed.
- **Floating joystick:** the design says "a virtual joystick on the left" (#9); it appears wherever the thumb lands in the left part of the screen, so you don't have to hit a fixed spot. Only its horizontal axis is used.
- **Dash direction on touch:** the design only says "an on-screen dash button" (#21); it uses the joystick's direction (including up/down), falling back to the way you're facing.
- ~~Platforms block bullets from every side.~~ Changed by #42: bullets pass through.
- **A hit during a roll or leap also dizzies the enemy** (the design only says the wind-up). Otherwise a mid-roll hit's knockback would be overwritten by the roll.
- **Rolls can carry an enemy off the end of a platform**; it falls and finds its way back.
- **Post-dash grace (0.12 s)** is Claude's addition so a dash that ends inside something doesn't immediately hurt you.
- **Health shown as pips** rather than a bar: five hit points read better as five squares.
- **No firing during a dash** (the barrel hides while dashing).
- **Air jump doesn't reset on dash**, and dashing doesn't use up a jump.
- ~~**Jump is a fixed height.**~~ Replaced by short hops (#32).
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
| 27 | 2026-11-14T04:28:58+00:00 | Combat | Short invulnerability after taking a hit. |
| 28 | 2026-11-14T04:28:58+00:00 | Weapons | Three weapons for now (pistol, automatic, shotgun), deliberately light; others may come later. |
| 29 | 2026-11-14T04:45:51+00:00 | Screen layout | Fill the whole screen on desktop, cover landscape, cover portrait and the inner screen; zoom in and follow the player where the shape doesn't match the arena (portrait is a narrower, zoomed-in view). |
| 30 | 2026-11-14T04:49:36+00:00 | Movement | Double jump: one extra jump in mid-air. |
| 31 | 2026-11-14T05:00:48+00:00 | Visuals | Dark arena edges with a pool of light following the player; characters and effects stay fully lit. Tiny screen shake on impacts (hard landings, dash impacts). |
| 32 | 2026-11-14T05:08:55+00:00 | Movement | Variable jump height: release early for a short hop; works with the Jump Height upgrade (raises the full height). Supersedes the fixed-height interpretation. |
| 33 | 2026-11-14T05:08:55+00:00 | Arena / controls | One-way platforms: jump up through from below; down (S / joystick down; down + jump also) drops through. Floor stays solid. |
| 34 | 2026-11-14T05:12:44+00:00 | Movement | Short hops removed after playtesting: fixed jump height (all jumps full height). Supersedes #32. |
| 35 | 2026-11-14T05:12:44+00:00 | Arena | Experiment: arena 2400×1350, camera 0.8× the previous baseline zoom, 8–10 platforms; player speed and dash distance unchanged. |
| 36 | 2026-11-14T05:20:16+00:00 | Controls | Aiming is a player setting: Manual / Auto aim + manual shooting / Full auto. Prompted by manual aiming being awkward on the phone's cover screen. |
| 37 | 2026-11-14T05:20:16+00:00 | Controls | Auto-aim picks the nearest enemy and shows an indicator on the target (the square has no facing). |
| 38 | 2026-11-14T05:22:06+00:00 | Controls | Auto-aim: lock on the target until it dies; with no target in range, shoot straight ahead (direction last moved); line of sight required (platforms block); range a placeholder to tune in play. |
| 39 | 2026-11-14T05:22:58+00:00 | Controls | Default aim mode: mobile Auto aim + manual shooting; desktop Manual (desktop part confirmed 2026-11-14T05:23:10+00:00). |
| 40 | 2026-11-14T05:31:56+00:00 | Enemies | Melee enemy: smaller orange circle with one tracking eye; quick little hops; properly navigates platforms; lunge by situation (roll on same level, leap if above/below) with a glow + rising-sound tell; dizzy after a lunge, missed rolls bounce off walls; middling toughness; dash damages it and cancels a wind-up into dizzy; shatters into orange arcs; spawns at a warning marker; enemies bump and push each other. |
| 41 | 2026-11-14T05:45:20+00:00 | Controls | Touch trigger is the whole right side (no SHOOT button), in every aim mode; full auto never fires at nothing; a gun barrel nub shows aim; aim mode chosen in a settings panel and saved. (Approved plan.) |
| 42 | 2026-11-14T05:50:22+00:00 | Combat | After testing: platforms are invisible to bullets (only the floor stops them) and no longer block auto-aim; the line-of-sight rule (#38) is dropped. |
| 43 | 2026-11-14T05:50:22+00:00 | Controls | After testing: auto-aim is the nearest target in range, re-picked continuously, with a 15% tolerance before switching; no longer locked until death (#38). |
| 44 | 2026-11-14T06:06:53+00:00 | UI / camera | Off-screen enemy markers (edge arrows in the enemy's colour, bigger/brighter when closer); the auto-aim target's arrow is highlighted; the camera zooms out up to 15% while the auto-aim target is off screen. |
| 45 | 2026-11-14T06:17:03+00:00 | Combat | Player health: 5 HP (placeholder), HUD pips, hurt feedback (knockback, red pulse, shake, sound, vibration, freeze-frame, flicker); temporary refill on death. Start unarmed (gun removed). Dash damages targets. |
| 46 | 2026-11-14T06:17:03+00:00 | Controls | In the auto-aim modes the dash aims at the auto-aim target unless you're moving (joystick pushed / A or D held). |
| 47 | 2026-11-14T06:21:18+00:00 | Combat | Heal on kills: one pip back every 3–5 kills (random per pip); kills at full health are wasted; getting hit resets the partial progress; all enemies count as one. |
| 48 | 2026-11-14T06:44:50+00:00 | Combat | After playtesting: health is 25 (5 pips × 5 stages); contact costs 1 stage (0.4 s invulnerability, light feedback), an attack costs a pip (full feedback); each kill heals 1 stage. Supersedes the HP count in #45 and the heal rule in #47. |
| 49 | 2026-11-14T06:44:50+00:00 | Enemies | Enemies take turns: only one winds up or lunges at a time; the rest keep ~400 px away until its dizzy spell ends, then a 0.5 s gap. |
| 50 | 2026-11-14T06:44:50+00:00 | Enemies | Melee enemy is 1.1× the player's size (was ¾). |
| 51 | 2026-11-14T06:44:50+00:00 | UI | Enemy health bars: small segments above each enemy, shown once it's been hit. |
| 52 | 2026-11-14T06:47:26+00:00 | Combat | After playtesting: contact damage removed entirely; touching enemies never hurts, only their attacks do (melee: a roll or leap, one pip). Applies to all enemies going forward. Supersedes #23 and the contact part of #48. |
| 53 | 2026-11-14T06:52:12+00:00 | Upgrades / economy | Replace the three-card upgrade offer with a currency shop between waves: enemies drop currency; spend any amount on stat upgrades, new weapons and weapon improvements, or save it. Score = total earned in the run (spending never lowers it). Death resets currency, weapons and upgrades; the final score is the high score. Supersedes the offer mechanics of #12 and #22. |
| 54 | 2026-11-14T06:52:12+00:00 | Upgrades / economy | Shop details: rotating selection each shop; drops fly to you when close (magnet); escalating prices on repeat purchases; the shop sells healing. |

---

## H. Technical Notes

- **Repository:** `evanstom273/simple-shooter`. Working branch `ccr-fd64429e-dgca91`.
- **Explain before adding (Lyra, 2026-11-14):** before building anything, Claude says what it's about to add and how, then waits for the go-ahead.
- **Workflow (Lyra's standing order across all her projects, from the previous design document):** after committing to the working branch, always merge straight to `main` as well; no need to ask each time.
- **Deployment:** `.github/workflows/pages.yml` uses `actions/setup-node` (22), `npm ci`, `npm run build`, then `actions/configure-pages`, `actions/upload-pages-artifact` (path `dist`) and `actions/deploy-pages`. Vite `base` is `/simple-shooter/`. Can also be run manually from the Actions tab (`workflow_dispatch`). Site URL: https://evanstom273.github.io/simple-shooter/
- **Code layout:** `src/main.tsx` entry; `src/App.tsx` stacks the Phaser view and the React UI layer; `src/game/` Phaser (`PhaserView` React host that lazily imports `createGame`; `GameScene` arena + player; `TouchControlsScene` on-screen controls, drawn at screen scale over the game; `PlayerView` the visible square (squash/stretch, separate from the physics box); `fx.ts` one-shot effects; `haptics.ts` vibration; `Shooter.ts` aiming, bullets, barrel, bracket, crosshair; `targets.ts` shootable interface; `enemies/` melee enemy and platform route-finding; `MarkersScene.ts` off-screen markers; `controls.ts` merged input state; `tuning.ts` all gameplay numbers); `src/ui/` React UI (`Hud`, pointer-events off so input reaches the game); `src/persist/db.ts` Dexie; `src/persist/settings.ts` settings (mute, aim mode); `src/settings/store.ts` live settings shared by React and Phaser; `src/state/hud.ts` health for the HUD; `src/audio/sfx.ts` synthesised sound.
- **Commands:** `npm run dev`, `npm run build`, `npm run lint` (oxlint), `npm run preview`.
- **Rendering:** Phaser scale mode `NONE`; the canvas is CSS size × dpr (max 3) shown at zoom 1/dpr, resized by a `ResizeObserver` on the host element. `GameScene` sets its camera zoom on every resize (baseline 1600×900 view × `VIEW.zoom`, #35). In dev, the game is on `window.__game` for poking at from the console.
