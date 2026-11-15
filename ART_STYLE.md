# ART_STYLE.md

The art style of simple-shooter: what it looks like, why, and how to make new art that fits.

This is the game's own application of **Stylised Geometry**. The game-agnostic version of the style, for use in other games, is in `stylised-geometry/` (`STYLISED_GEOMETRY.md` plus SVG reference sheets).

Everything here comes from decisions already made (the History numbers in `GAME_DESIGN.md` are given in brackets) or from the code and mockups as they stand. Where a rule is my reading of a pattern in those decisions rather than something Lyra decided, it's marked **(Claude)**, so it can be overruled without arguing with a decision.

Where things live:
- **Concepts:** `concepts/player-concept.svg`, `concepts/enemies-concept.svg`, `concepts/hub-mockup.html`.
- **The world mockup canvas:** world scenes, the Celestial Gothic Horror enemies, arenas and bosses, each drawn as four options with the pick marked.
- **In the game:** `src/game/PlayerView.ts` (the player), `src/game/fx.ts` (bursts and rings), the enemy files in `src/game/enemies/`, `src/game/rooms/celestial.ts` (hand-built rooms and their palette), and `SCREEN` in `src/game/tuning.ts` (light, shake, motes).

---

## 1. The style in one line

**Stylised Geometry** (Lyra's term, #61): every character is a recognisable simple shape (a square, a circle, a triangle, a polygon) made into a **bright, bold character** with a face, eyes and floating hands and feet. It lives in a **dark world lit around the player**.

Three layers, each with its own rules:

| Layer | Rule | Source |
|---|---|---|
| Characters (player, enemies, bosses) | Strict geometry: straight-edged polygons and circles, combined | #8, #61, #92 |
| Environments | Looser and more organic around the characters | #90 |
| Light | Dark rooms, a pool of light around the player, candles and glows | #31, #93 |

---

## 2. Why this style

- **Readability first.** It's a fast action game. A shape you can identify in a fraction of a second, against a dark background, is worth more than detail. A silhouette tells you what something is; its colour and glow tell you what it's about to do.
- **Shapes carry character.** A square with two oval eyes and a smile is a person. A face and hands turn a geometric primitive into someone you care about (or are scared of) without any traditional character art.
- **It's achievable and consistent.** Everything is drawn from shapes in code (Phaser rectangles, circles, polygons, graphics) or as SVG. No sprite sheets, so a new enemy is a design problem, not an art-production problem, and everything automatically matches.
- **It sets up the horror.** Because the world is neat geometry, breaking it is unsettling: an eleven-sided "almost a circle", too many eyes, a hole where a shape should be. Celestial Gothic Horror leans on this (#88).
- **Darkness is atmosphere and gameplay at once.** The pool of light makes the rooms moody for free and gives worlds a resource to play with: light that can be taken (#93).

---

## 3. Characters

### 3.1 The rules

1. **One clear base shape.** Each character is a recognisable primitive, or a few stacked together (#92). Any straight-edged polygon counts as geometric (#92).
2. **A face.** Eyes at least; often a mouth or brow. Eyes are the main way a shape becomes a character, and where it looks tells you what it's attending to (the melee enemy's eye tracks you, #40).
3. **Floating hands and feet.** Never attached: they hover near the body (#61). Hands are circles; feet are simple blocks or L-shapes. Optional for enemies; the tank has big square fists and block feet, the ranged enemy tiny fins.
4. **A dark ink outline.** Everything has an outline in near-black ink, `#1a1a26`, about 3 px on bodies and 2–2.5 px on hands and details. It's what holds a flat colour shape together against the dark.
5. **Flat fills, with very little shading.** At most a soft top-to-bottom tint (the player's concept body goes from `#ffffff` to `#d9dbe8`). No textures.
6. **Visuals never change hitboxes.** Hands, feet, faces and squash are visual only; the physics shape stays the plain shape (#61).

### 3.2 The player

- A **white square** (`#f2f2f2`) with **two oval eyes and a smile**, **floating circle hands** and **L-shaped feet** (#61, from Lyra's sketch).
- **Dash:** the body turns **sky blue** (`#8fd3ff`) and stretches into a streak with afterimages (#3 of the feel work). Blue is the player's "power" colour (dash bar, dash ready ring, beam).
- **Hurt:** a pale red body (`#ffb0b0`), an "ouch" face, and a red burst.
- **Moods:** the face reacts. A grin after a stomp or a heal, wince when hurt.
- **Arrival and departure:** the player **beams in** (a line drops, widens into a light column, the player assembles feet → hands → eyes) and **beams out** the same way backwards (#75). Portals **pull** you in and flash their colour. That's deliberately different from how enemies appear.

### 3.3 Base enemies (the original three)

| Enemy | Shape | Colour | Character | Death |
|---|---|---|---|---|
| Melee | Circle, 1.1× the player | Orange `#ff8a2a` | One big tracking eye, little floating hands | Curved orange shards |
| Ranged | Long arrowhead triangle, smaller than the player | Green `#5ee36a` | One narrow browed eye, tiny floating fins | Smaller green triangles |
| Tank | Pentagon, 2× the player | Red `#e0453a` | One heavy-browed eye, big square fists, block feet | Heavy pentagon chunks that fall |

**Each one dies in its own shape.** Shards are pieces of the thing that died (#40, #56, #58). That's a rule worth keeping for every new enemy **(Claude)**.

### 3.4 Size

Size is how danger is read before anything else.

| Thing | Size against the player |
|---|---|
| Ranged, Motes | Smaller |
| Melee | 1.1× |
| Tank, Void Mass | About 2× |
| The Rose | About 4× wide |
| The Firmament | Bigger than the room |

Every new design is drawn **at true size beside the player** before it's picked (see §9).

---

## 4. Shape language

### 4.1 What shapes say (Claude)

These are patterns in what's been designed, offered as a guide rather than law:

- **Square:** the player. Stable, honest, the reference everything is measured against. Keep squares rare on enemies, or use them deliberately: the Unfolding is a closed box, and the horror is that it opens into teeth.
- **Circle:** soft, quick, bouncy (the melee hops and rolls). Eyes and hands are circles everywhere.
- **Triangle:** sharp, fast, pointing (the ranged enemy swivels to aim; Motes, the Gale, shards, teeth).
- **Many-sided polygons:** weight and age. The tank's pentagon, the Summoning Circle's dodecagon, the Ossuary's 7-, 6-, 5- and 4-sided layers.
- **Side count as a counter.** The Ossuary loses a side with each layer you knock off; the Rose has twelve rays. A countable shape can quietly show progress.

### 4.2 Compound shapes (#92)

Characters, and bosses above all, are built by stacking and combining primitives. Examples already designed:

- **The Ossuary:** a cairn of bone polygons, a hole and an eye on top.
- **The Summoning Circle:** a dodecagon ring with two triangles inside turning opposite ways, on a plinth.
- **The Gale:** a diamond of four triangles, an eye at the cross, a ribbon tail of bow-shaped triangle pairs.
- **The Firmament:** a band of night sky edged in small stars, with a constellation running down it as a spine.

The test for a compound shape: **you can still describe it in one sentence of shapes.** If you can't, it's become an illustration.

### 4.3 Wrong geometry (Celestial Gothic Horror)

The cosmic horror world earns its scares by breaking the style's own rules, on purpose (#88):

- **Almost-shapes:** eleven sides where you'd expect twelve (the Void Mass), asymmetric polygons, things that are nearly a circle.
- **Too many eyes,** eyes where there shouldn't be any, and **eyes in the room** that watch you (#93).
- **Holes instead of shapes:** the Void Mass is a hole in the world with stars inside; the Firmament is the dark *between* stars.
- **Shapes that don't behave:** the Unfolding is a square until it unfolds into a star of teeth.

This only works because everything else stays neat. Don't let wrongness leak into other worlds, or into the player **(Claude)**.

---

## 5. Colour

### 5.1 Rules across the whole game

- **The player owns white and sky blue.** White is the body; blue (`#8fd3ff`, lighter `#cfeaff`) is dash, dash-ready, and the beam. No enemy should be white-bodied or sky-blue-bodied **(Claude)**.
- **Red means damage.** The hurt flash, damage bursts and health loss use red (`#ff5a5a` bursts). The melee enemy was made orange specifically to keep red free for damage (#40).
  - **Exception, by design:** in Celestial Gothic Horror a **red iris** means something has **woken up and is looking at you** (the Rose's cracked eye, the Void Mass feeding, the Firmament). It's still "danger"; it's never decoration.
- **Gold means reward.** Gold drops, the shop, gold rings when you buy something (`#ffcf4a`). Candlelight gold (`#ffcf7a`) sits next to it in the gothic world as warmth and safety.
- **Heating to white-hot is the universal tell.** An enemy about to attack glows from its own colour towards near-white (every base enemy has a `hotColour`), with a rising sound (#40, #58). New enemies should use the same language.
- **Enemies are saturated; backgrounds are not.** Rooms are dark, desaturated versions of the world's colours; characters and hazards carry the saturation.

### 5.2 World palettes

Each world fuses two looks (#88, #89) and has its own palette, taken from the mockups. These are working palettes, not locked.

**Celestial Gothic Horror:** a cathedral under a wrong sky.

| Role | Colour |
|---|---|
| Room background | `#140e24` (the Breach `#1a1236`, the Sanctum `#1c1338`) |
| Stone platforms / blocks / walls | `#4a3e6a` / `#332a4c` / `#16112a` |
| Lit top edge | `#7a6ea0` |
| Timber | `#6a4a36` |
| Gold (chandelier, candles, halos) | `#c8913a`, flame `#ffcf7a` |
| Bone and pale glass | `#e8dcc8`, `#f6efe3` |
| Violet (wings, rims, shadow) | `#5b3a8a`, `#b9a6ff` |
| Void | `#07060f` |
| Starlight | `#9fd8ff`, `#cfeaff` |
| The red iris | `#b3263a` |

**Frozen Sci-fi:** a research station half-swallowed by the glacier, lights still on.

- Deep blues `#132a44`, `#2f5578`, `#5c8fb0`.
- Ice whites `#e6f7ff`, `#f4fbff`.
- Neon cyan `#4fe3ff` on dark, with a violet accent `#8a7dff`.

**Volcanic Industrial:** a forge dug into a volcano.

- Soot and iron `#1a1414`, `#2b1c18`, `#3a2a26`, `#4a3a36`, rust `#5a3a30`.
- Heat `#ff6a1f`, `#ff8a2a`, `#ffb547`, white-hot `#fff0b0`.

**Overgrown Solarpunk:** a breath of fresh air; the one place that feels almost kind.

- Greens `#3f9a55`, `#5fbf6a`.
- Warm light `#fff1b8`, `#fff8d8`, sunflower `#ffd166`.
- Blossom pink `#ff8fb0`, water teal `#2a6f86`, pale stone `#f4f0e2`.
- The only world where the darkness should ease off **(Claude)**.

**The hub:** cool, neutral night (`#0d0e18`, wall shapes in `#1b1c2a`). The portals carry the colour:

- an amber triangle
- a violet diamond (suits the cosmic horror)
- a cyan hexagon
- a pink circle
- the endless portal, a white square (the player's shape)

---

## 6. Light and darkness

- **Rooms are dark; a soft pool of light follows the player** (#31). It's a big radial gradient: clear in the middle, falling away to near-black at the screen's edges (`SCREEN.light`: radius 0.62 of the screen diagonal, clear 0.22, edge darkness 0.92).
- **Characters and effects are never darkened.** The darkness sits above the room (depth 4) and below everything that moves. You always see enemies, shots and dust; only the world falls into shadow.
- **Floating motes** catch the light: faint drifting specks under the darkness, so they only show near you.
- **Candles** light their own patches (warm additive glow, a cream stick, a flame with a bright core).
- **Light as a mechanic in Celestial Gothic Horror** (#93, still to build):
  - your pool is smaller there
  - candles can be snuffed (Motes smother them; the Ossuary eats them; the Firmament swallows them all)
  - touching a candle relights it
  - kills give light back
- **Glows are additive** (Phaser `ADD` blend): candle halos, enemy charge glows, the beam, starlight. Keep them faint and layered rather than one bright blob.

---

## 7. Environments

- **Looser than the characters** (#90). Rooms can be organic and painterly: arches, broken masonry, timber, ice, roots. Characters stay strict geometry and pop against them.
- **In the game, rooms are still built from rectangles** with a per-room style (`Level.style`):
  - background
  - one-way platforms
  - solid blocks
  - the room's own walls
  - a **3 px lit top edge** on everything you can stand on, so ledges read in the dark
- **Hazards read as hazards.**
  - Spikes are triangles, saws are toothed circles, jets show a flame.
  - Crumbling platforms are tan with cracks drawn on, and they shake before they drop.
  - Wind is a faint tinted zone with streaks moving the way it blows.
  - Moving platforms take the room's material (a gold chandelier, a stone counterweight).
- **Decoration has meaning in hand-built rooms.** Candles and eyes are placed deliberately, because they're becoming mechanics (#93).
- **Hand-built over generated** for the story rooms (#100). Hand-built rooms can be composed like the mockups; the generator stays for endless.

---

## 8. Motion and feel

The style is as much about how things move as how they look. All of this is built already.

- **Squash and stretch on everything the player does:** jump (tall and thin), land (wide and flat, scaled by impact), double jump, running lean, dash streak, wall impacts, stomps.
- **Dust:** take-off, landing, skids, wall slides. Small pale squares (`#b4b4c6`) that drift and fade.
- **Rings and bursts** (`fx.ts`) are the standard effect vocabulary.
  - **Rings:** dash ready, heal, double jump, portal pull.
  - **Bursts:** hits, deaths, impacts.
- **Hit-stop:** a few hundredths of a second of freeze on dash hits, stomps and getting hurt.
- **Screen shake: tiny,** on impacts only. Off when the device asks for reduced motion.
- **Platforms respond:** they dip and brighten when landed on.
- **Camera:** smooth follow, a little look-ahead when running, and a gentle zoom-out to keep your target in view.
- **Telegraphs are generous and visual** (Claude, from #40, #56, #58):
  - glow heating to white-hot
  - an aim line that tracks, then locks
  - a landing marker
  - a building rumble
  - the shape changing pose

  The bosses follow the same rule: the Firmament pulling its thick body back before a lunge, the Gale's tail streaming straight before a dive, the Gale folding tall and narrow when it perches.

---

## 9. Bosses

- **Compound shapes at their most ambitious** (#92), but still describable in one sentence of shapes.
- **The vulnerable state has its own silhouette** (Claude, from the Gale and Rose). When a boss can be hurt, its outline changes, not just its colour:
  - the Gale folds tall and narrow with its eye wide open
  - the Rose's rays break off one by one
  - the Ossuary loses layers
- **Damage shows on the body:** cracks, missing pieces, an eye opening. A boss should look worse as the fight goes on, so the health bar is a backup, not the main read.
- **Scale tells the story.** The minis are a few times the player's size; the Firmament doesn't fit in the room, and its body trailing back through the window does the work of saying so.
- **Each world's bosses hint at its major boss in theme only** (#107). Stained glass, bone, wind and the window all point at the Firmament.

---

## 10. How to make new art

The process used for every enemy and boss so far:

1. **Design the behaviour first** through a round of questions (#66). The look follows the role.
2. **Draw four directions** on the world mockup canvas as one board. Each option is shown:
   - in its key states (idle, attacking or telegraphing, vulnerable, broken)
   - **at true size beside the player**
3. **Pick** (Lyra, or Claude when asked to, marked as overrulable). Combinations are fine and often best (the Void Mass took C's eye; the Firmament is C thickened with D's void).
4. **Draw the chosen design** on its own board if it's a combination.
5. **Log the pick** in `GAME_DESIGN.md` with the options that were passed over.
6. **Build it from shapes** in Phaser:
   - rectangles, circles, `Polygon` or `Graphics`
   - the same palette hex values
   - outline `#1a1a26`
   - a plain hitbox

### A checklist for any new character

- [ ] Recognisable as a shape in silhouette, at true size, in the dark?
- [ ] Has a face (eyes at least), and the eyes do something?
- [ ] Ink outline, flat fills?
- [ ] Its colour isn't white, sky blue or damage red (unless it's a CGH red iris that means "awake")?
- [ ] Its tell glows towards white-hot, or changes its pose, before it attacks?
- [ ] Its vulnerable state reads at a glance?
- [ ] It dies in pieces of its own shape?
- [ ] It sits in its world's palette, and the room behind it stays darker and duller than it?

### Drawing in code: depth order

| Depth | What |
|---|---|
| below 0 | Hub backdrop |
| 0 | Room background, platforms |
| 1–2 | Platform top edges, cracks, decoration (candles, eyes) |
| 3 | Floating motes, wind streaks |
| 4 | The darkness |
| 5 | Dash afterimages |
| 7–8 | Shots, hazard glows, the beam |
| 9 | Dash and reload bars |
| 10–11 | The player and its hands |

The off-screen markers are a separate overlay scene on top.

---

## 11. Still open

- Where Celestial Gothic Horror's palette is a decision and where it's still the mockup's suggestion.
- The other three worlds' palettes are from the first mockups only; none has its enemies designed yet.
- Whether Motes' eyes count as "eyes in the room" (#99).
- How dark "smaller light" is in the gothic world, and whether Solarpunk is lighter overall.
- The base three enemies (orange circle, green triangle, red pentagon): whether they stay as a common baseline or are retired by world rosters, which decides whether their bright primaries stay part of the style.
