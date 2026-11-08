# Brag Plan: Knife Deagle Fight

## What is this app?
A browser-based multiplayer knife + Deagle arena duel: first to 5 kills in a 100×100 m
skatepark. Two hits kill, one knife swing doesn't — so you Deagle, close, and finish.

## The angle
Strict economy, deadly spacing: the funniest honest claim is the tagline itself —
"Two-hit Deagle. Swing first." The video dramatizes the tug between two weapons that
solve opposite problems: the Deagle is a two-hit executioner with a cooldown, the knife
is the closer. Every beat demonstrates that tension and then resolves it in one slash.

## Hook (first 2–3 seconds)
Black screen. A single white crosshair cross slams center screen, then the Deagle's
two-hit damage numbers count down: `100 → 50 → 0`. Final line: "TWO HITS."

## Key moments (the middle)
- The knife swing arc — a white 120° frontal arc sweeps across a low-poly fighter
  silhouette (static pose, no anim). Line: "FOUR SLASHES. NO AMMO."
- The arena cutaway — matcap-shaded 100×100 m skatepark plateaus, ramps, bowl, south
  healing zone glowing green. Line: "ONE ARENA. FIVE KILLS."
- The loop in one frame — spawn slots, pickups, heal zone, and kill counter `/5` sync
  in with beat cadence. Line: "SPAWN. DODGE. EXECUTE."

## Outro / punchline
Full-bleed wordmark: `KNIFE DEAGLE FIGHT` — `Two-hit Deagle. Swing first.` — then
a hard cut to black with the repo link. Beat lands on the final word.

## User flow worth showing
Entry → key action → result: title screen ("PRESS ANY KEY") → lobby (name, color) →
on-foot duel → the counter goes `/5` → VICTORY overlay. Central scene recreates the
working HUD (HP bar + ammo read `DEAGLE ×12`, kill counter) with a simulated fire
action — crosshair shot tracer hits the opponent silhouette, `50` ticks HP down.

## Tone
- Preset: chaotic
- Creative direction: overproduced mobile-game ad meets esports highlight reel
- Interpretation: fast hard cuts, type slams with the line, damage numbers snap in,
  sound effects on every action; never let text flash too fast to read.

## Format: landscape — 1920×1080
## Duration: 20 seconds (5 scenes)

## Visual identity (from the project)
- Background: #08080F
- Surface: #1A1A2D
- Accent: #FF2E4D (redline red)
- Text: #F5F5FA
- Accent 2: #00E5FF (cyan secondary), #FFB627 (amber)
- Display font: "Space Grotesk"
- Body/mono font: "JetBrains Mono"
- Strongest visual element: the redline title wordmark with chromatic-aberration ghosts
  (red shifted right / cyan shifted left, mix-blend screen) plus the centered crosshair
  and HP/ammo HUD blocks.

## Share copy (draft)
I built a multiplayer knife + Deagle arena duel in the browser. Two hits kill.
Swing first.

## Audio direction
- Role: dense rhythmic layer with motion-matched SFX
- Music: hyperdrive synthwave bed picked by Hyperframes from its library; start on frame 0,
  constant energy, small dip under the final payoff
- Music cue guidance: bundled track cues to be read at composition time; strong cues target
  the scene cuts at ~4s / ~8s / ~12s; beat-grid windows for damage number ticks
- Audio-reactive treatment: subtle — hit-marker glow pulses on the damage ticks; no wild
  waveform visuals
- SFX posture: dense but precise — shot crack, knife swish, hitmarker ping, pickup chime,
  UI blips on name/color selection, heal zone shimmer
- Audio-coupled moments: each damage number tick gets a ping; weapon swap click
  corresponds to the arc reveal; kill counter tick sounds
- Restraint rule: no voiceover; SFX never stack on top of each other longer than
  half a second

## Storyboard

### Scene 1 — Hook: crosshair and damage numbers — 3s
Black screen. White crosshair cross slams to center. Damage counter types "100" above
the reticle — a shot crack, "50" — a knife swish, "0". Final flash: "TWO HITS."
Sequential/interaction: crosshair slams in, damage numbers tick down 100 → 50 → 0.
Audio intent: statty crack → swish → ping, building tension.
Audio-coupled idea: each number change pinged at the cut; final word gets heartbeat kick.
Music: synthwave bed starts on frame 0, high energy.
Transition mood: hard cut → Scene 2

### Scene 2 — The 120° arc — 4s
Matcap palette fighter silhouette stands center-frame on dark ground. A white
120-degree frontal arc sweeps left-to-right with an afterglow. Line below (Space
Grotesk): "120°. 2.1 METERS. NO AMMO."
Sequential/interaction: arc sweeps once, holds.
Audio intent: swish across the pan with a low whoom.
Audio-coupled idea: arc arrival syncs to a swish cue.
Music: continues, pulse 4/4 steady.
Transition mood: hard cut → Scene 3

### Scene 3 — The arena — 5s
Top-down isometric-ish reveal of the flat-shaded 100×100 m skatepark — central plateau
with four ramps, skate bowl NE, stairs NW, green healing glow south. Camera pans
south→north. Line: "100×100 M. ONE ARENA."
Sequential/interaction: locations labeled as the camera moves: BOWL / KICKER / HEAL.
Audio intent: rising sonic bed under the reveal.
Audio-coupled idea: label ticks on each stop.
Music: beat continues; a filter gap before lineup.
Transition mood: hard cut → Scene 4

### Scene 4 — Working HUD duel — 5s
Recreate the in-game HUD: HP bar full, `DEAGLE ×12`, kill counter `/5`, crosshair
center, opponent silhouette ahead. "Shot fires" (tracer line snaps to the silhouette),
HP 100 → 50, hitmarker X pops, ammo `×11`. Match cut within the scene: knife swap —
arc hits, HP 50 → 15, ammo readout switches `KNIFE ∞`.
Sequential/interaction: crosshair fires → ammo decrements → hitmarker → swap.
Audio intent: crack, ping, arc swish, swap click — dense and immediate.
Audio-coupled idea: each HUD change lands on its own cue; ammo tick is a key blip.
Music: back in full after the gap.
Transition mood: dramatic wipe → Scene 5

### Scene 5 — Punchline — 3s
Full-bleed wordmark `KNIFE DEAGLE FIGHT` with chromatic aberration ghosts (red offset
right, cyan offset left, blend screen). Under it, tagline: "Two-hit Deagle. Swing
first." Hard cut to black; repo path `Salar-prog/knife-deagle-fight` types once.
Sequential/interaction: wordmark letters slam in with chromatic ghosts; tagline fades
in under it.
Audio intent: cinematic swell to a hard stop on the cut.
Audio-coupled idea: final chord on the tagline fade-in.
Music: final hit, then silence for the last half-second.
Transition mood: end.

**Music mood for this video:** chaotic electronic.
**Audio summary:** synthwave bed constant, dense SFX on every action, cut to silence at the end.
