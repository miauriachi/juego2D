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


## Latest visual corrections from user (2026-09-27)
Use the user's newest screenshot as the calibration reference.

### Bryan
- Bryan still looks visually tilted compared with the vertical hospital doorway.
- Do NOT solve this by arbitrarily rotating the GLB.
- Calibrate `HospitalExterior.applyPlayerPresentation()` so his projected body reads screen-vertical against the door jambs.
- Keep feet grounded at the doorway exit, just outside the illuminated Emergency doors.
- Preserve his normal world heading for movement.

### Car
- The 3D car is still not aligned with the baked cars/parking geometry.
- Recalibrate `exteriorConfig.car.position`, `rotationY`, and `scale` until it visually matches the perspective and heading of the nearby parked cars.
- The car should sit naturally inside the foreground parking bay, between the white lines, with no floating or oversized/toy appearance.
- Recompute the interaction offset only after final car placement so `[E] Subir al auto` remains reachable.

### Departure path
- Once Bryan enters the car, keep THIS SAME fixed camera and THIS SAME prerendered plate.
- The car must move across the visible parking lot, not transition immediately to another 3D scene.
- Follow this route visually: leave the foreground bay -> merge into the central driving aisle -> curve diagonally up-left -> continue toward the guard booth / exit barrier in the upper-left.
- Use a smooth spline/path and rotate the car progressively with the tangent; no teleport and no heading snap.
- The first point of the path MUST come from the car's actual final parked position.

### Snow particles
- Keep animated snowfall visible over the prerender while Bryan is outside AND while the car drives away.
- Reuse `src/environment/Snowfall.js`; do not bake new snow into the background.
- Instantiate snowfall in `src/levels/HospitalExterior.js` and update it every frame.
- During `ParkingDepartureSequence`, continue updating/rendering the same snowfall so flakes visibly cross in front of Bryan/car/background.
- Keep the particle count/performance reasonable and preserve the current dark snowy look.

### Validate
Before finishing, visually verify:
1. Bryan appears upright relative to the hospital door frame.
2. Car perspective/rotation matches nearby baked parked cars.
3. `[E] Subir al auto` works from a sensible position.
4. Car visibly traverses the red-route equivalent across the parking lot under the fixed camera.
5. Snow continues animating during the entire departure.
