# GAME_DESIGN.md

Authoritative, living record of the game's design. Timestamps are Europe/London, ISO 8601 with UTC offset, recorded at the time the decision was confirmed in conversation unless marked otherwise.

---

## A. Project Overview

A **simple shooter** (History #1). Nothing else about the game has been decided yet. Working title: none yet; the repository is `simple-shooter`.

**Where the project stands (as of 2026-11-14T04:09:54+00:00):**
- Repository set up with GitHub Pages deployment from `main` (History #2) and these living documents (History #3).
- No design decisions beyond the concept. No game code.

**Stack:** not decided. Deployment is GitHub Pages (History #2).

**Guiding principles** *(carried over from Lyra's previous project's design document; flag if any don't apply here)*:
- Discuss → Decide → Document → Implement → Test → Expand.
- Small, polished and functional beats large and placeholder-filled.
- The creative director (Lyra) makes design decisions; recommendations are not decisions until approved.

---

## B. Confirmed Design Decisions

### Concept
- **A simple shooter.** *(2026-11-14T04:09:54+00:00 — History #1)*

### Technical architecture / platform
- **Deployed on GitHub Pages**, built and published by GitHub Actions on every push to `main`. *(2026-11-14T04:09:54+00:00 — History #2)*

### Documentation
- **Living `GAME_DESIGN.md`** in the format of Lyra's previous project's design document, plus `TODO.md`, kept updated as decisions are made and work is done. *(2026-11-14T04:09:54+00:00 — History #3)*

---

## C. Current Development Scope

### Repository setup — **DONE** *(2026-11-14T04:09:54+00:00)*
**In scope (done):** GitHub Pages workflow, placeholder `index.html`, `GAME_DESIGN.md`, `TODO.md`.

**Out of scope:** any game design or game code.

---

## D. Future Possibilities

*Proposals only — not confirmed features.*

- None yet.

---

## E. Open Questions

1. **Title.**
2. **Everything about the game itself** beyond "simple shooter".
3. **Stack** (plain HTML/JS, a framework, an engine…). GitHub Pages serves static files, so whatever is chosen needs to build to static output.
4. **Target devices** (desktop, phone, both).

---

## F. Implementation Status

*Updated 2026-11-14T04:09:54+00:00.*

| Feature | Status | Notes |
|---|---|---|
| Design docs | Done | `GAME_DESIGN.md`, `TODO.md`. |
| GitHub Pages deployment | Implemented | `.github/workflows/pages.yml`: on push to `main` (or run by hand), uploads the repository root and deploys it. Pages source is set to GitHub Actions (done by Lyra in the repo settings). |
| Placeholder page | Done | `index.html` says there's nothing here yet, so the Pages site isn't a 404. To be replaced by the game. |

### Known issues and limitations
- The workflow publishes the repository root as-is. Once the game has a build step, the workflow needs a build job and should upload the build output instead.

### Implementation interpretations (technical, not design decisions — flag if wrong)
- The guiding principles in §A and the workflow standing order in §H were carried over from Lyra's previous design document rather than restated for this project.

---

## G. Decision History

*Append-only. Changed decisions are recorded as new entries; earlier entries are preserved.*

| # | Timestamp (Europe/London) | Category | Decision |
|---|---|---|---|
| 1 | 2026-11-14T04:09:54+00:00 | Concept | A simple shooter. |
| 2 | 2026-11-14T04:09:54+00:00 | Deployment | GitHub Pages, deployed by GitHub Actions on push to `main`. |
| 3 | 2026-11-14T04:09:54+00:00 | Documentation | Living `GAME_DESIGN.md` (format of Lyra's previous project) and `TODO.md`. |

---

## H. Technical Notes

- **Repository:** `evanstom273/simple-shooter`. Working branch `ccr-fd64429e-dgca91`.
- **Workflow (Lyra's standing order across all her projects, from the previous design document):** after committing to the working branch, always merge straight to `main` as well; no need to ask each time.
- **Deployment:** `.github/workflows/pages.yml` uses `actions/configure-pages`, `actions/upload-pages-artifact` (path `.`) and `actions/deploy-pages`. Can also be run manually from the Actions tab (`workflow_dispatch`). Site URL: https://evanstom273.github.io/simple-shooter/
