# Hyperframes Composition Brief: Knife Deagle Fight

## Objective
Create a short launch-style brag video for Knife Deagle Fight.

## Output
- Composition directory: `brag-output-2026-11-08-093841/knife-deagle-fight/`
- Rendered video: `brag-output-2026-11-08-093841/brag.mp4`
- Format: landscape — 1920×1080
- Duration: 20 seconds (5 scenes, durations sum to 20)

## Source Material
- Project root: `/home/a/projects/learning/unconventional/software-development/game/web/third/implementations/knife_deagle-fight`
- Primary files read: `client/src/index.html` (title/meta), `client/src/styles/redline.css` (design tokens), `README.md` (Overview/Tools), `shared/constants.js` (DEAGLE/KNIFE numbers), `client/src/javascript/World/index.js` (HUD ids)
- Product name: KNIFE DEAGLE FIGHT
- Tagline / strongest claim: "Two-hit Deagle. Swing first."
- Key UI or visual moment to recreate: title wordmark with chromatic-aberration ghosts (red displaced right, cyan left, mix-blend screen) plus the live HUD trio (HP bar + `DEAGLE ×12` + kill counter `/5`) with a shot → HP 100 → 50 → hitmarker → knife swap.
- Copy that must appear verbatim:
  - KNIFE DEAGLE FIGHT
  - Two-hit Deagle. Swing first.
  - 100 → 50 → 0
  - 120°. 2.1 METERS. NO AMMO.
  - 100×100 M. ONE ARENA.
  - Salar-prog/knife-deagle-fight

## Creative Direction
- Tone preset: chaotic
- Creative direction: overproduced mobile-game ad meets esports highlight reel
- Interpretation: hard cuts, type slams with the line, damage numbers snap in, SFX on every action; readable holds per line.
- Angle: Strict economy, deadly spacing. The Deagle is a two-hit executioner with a cooldown, the knife is the closer. Every beat demonstrates that tension and resolves it in one slash.
- Hook: Black screen. White crosshair slams center, damage 100 → 50 → 0, then "TWO HITS."
- Outro / punchline: wordmark KNIFE DEAGLE FIGHT with chromatic ghosts, tagline "Two-hit Deagle. Swing first.", cut to black with repo path.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #08080F
- Text: #F5F5FA
- Accent: #FF2E4D (redline red), secondary #00E5FF cyan, amber #FFB627
- Display font: "Space Grotesk" (shipped as `@font-face` to `assets/fonts/space-grotesk-500.woff2` / `-700.woff2`)
- Body font: "JetBrains Mono" (bundled)
- Visual references from the project: redline wordmark with chromatic ghosts; crosshair; HP bar; weapon-status `DEAGLE ×12`; kill counter `#kc-value` `/5`; flat-shaded arena plateaus; green heal zone.

## Storyboard
Use the storyboard in `brag-output-2026-11-08-093841/brag-plan.md` as the creative contract.

Scene summary:
1. Hook: crosshair and damage numbers — 3s — crosshair slams, 100 → 50 → 0, "TWO HITS."
2. The 120° arc — 4s — matcap fighter silhouette, white 120° frontal arc sweep, "120°. 2.1 METERS. NO AMMO."
3. The arena — 5s — top-down flat-shaded 100×100 m skatepark pan, labels BOWL / KICKER / HEAL, "100×100 M. ONE ARENA."
4. Working HUD duel — 5s — HP bar, `DEAGLE ×12`, counter `/5`, tracer shot → HP 100 → 50, hitmarker, swap → knife arc → HP 15, `KNIFE ∞`.
5. Punchline — 3s — wordmark with chromatic ghosts, tagline, repo path cut to black.

## Audio
- Audio role: dense rhythmic layer
- Audio arc: synthwave bed constant, dense SFX on every action, cut to silence at the end
- Music: `composition/assets/music/track.mp3` (happy-beats-business-moves-vol-1)
- Music treatment: start on frame 0, constant energy, small dip under the final payoff; volume moderate (bed under SFX)
- Music cue guidance: no bundled preset; detect beats at composition time via `npx hyperframes beats`; target strong cues near scene cuts (~3s, ~7s, ~12s, ~17s) within ±0.15s
- Audio-reactive treatment: subtle — hit-marker glow pulses on damage ticks; no waveforms
- Audio-coupled moments:
  - Scene 1 — each damage number change pinged at the cut; "TWO HITS." gets a heartbeat kick
  - Scene 2 — arc arrival syncs to a swish cue
  - Scene 4 — each HUD change lands on its own cue (shot crack, hitmarker ping, swap click, knife swish)
  - Scene 5 — final chord on the tagline fade-in; music cuts to silence
- SFX selection guidance: shot crack, knife swish, hitmarker ping, UI blips, pickup chime, swap click — motion-matched, sparse enough to stay clean.
- SFX analysis guidance: use `<skill-dir>/assets/sfx/sfx-analysis.md` if present
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any Hyperframes-selected SFX into `composition/assets/`

## Hyperframes Instructions
Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer unless audio was explicitly disabled or documented as intentionally silent.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet.
- Use SFX to support motion and interaction.
- Honor planned music treatment (dip under final payoff).
- Consider HyperFrames audio-reactive workflow for the hit-marker glow; skip if extraction unavailable.
- Use local assets for audio and any required runtime/media dependencies when possible.
- Run `hyperframes check` before render.
- Keep creation and rendering local.
