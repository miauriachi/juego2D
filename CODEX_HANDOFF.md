# CODEX HANDOFF — RE Noche Cero

Snapshot branch: `codex-handoff-2026-09-27`
Base commit copied from main: `b3916ee59f02b6b807cbc945689e385a24bfa608`

## Current goal
Fix the hospital exterior prerender scene. The correct background is already in:
`assets/references/hospital/exterior_clean.webp`

Current visible problems reported by the user:
1. Bryan is poorly positioned/angled when spawning outside.
2. The 3D car is poorly positioned/aligned relative to the baked parking bay.
3. The user could not reliably trigger `[E] Subir al auto`.
4. Preserve the fixed high camera and the prerendered exterior background.
5. Do not revert the hospital interior fixes.

## Important files
- `src/game/ExteriorConfig.js`
- `src/levels/HospitalExterior.js`
- `src/game/Game.js`
- `src/game/ParkingDepartureSequence.js`
- `src/game/Vehicle.js`
- `assets/references/hospital/exterior_clean.webp`

## Interior work that should remain intact
- Receptionist calibration/interactions.
- Urgencias prerender scene.
- Moving/pain NPC animations.
- Doctor departure sequence.
- Left Urgencias exit prompt.
- Delivery nurse sequence after forged signature.

## Visual target
Classic Resident Evil fixed-camera prerender presentation:
- Bryan should appear just outside the Emergency doors.
- Bryan must be upright and grounded.
- The 3D car should visually sit inside the intended foreground parking bay, aligned with the white lines and scaled consistently with Bryan/background perspective.
- Interaction with the car must be reachable and reliable.
