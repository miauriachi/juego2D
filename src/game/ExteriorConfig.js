// The plate/camera stay fixed. Coordinates were checked against its doorway,
// foreground bay and exit aisle in a rendered browser viewport.
export const exteriorConfig = {
  id: 'exterior-prerender', area: 'exterior', aspect: 16 / 9,
  camera: { cameraPosition: [0,20,16], lookAt: [0,0,-0.5], fov: 45 },
  background: { key: 'hospital-exterior-prerender',
    url: new URL('../../assets/references/hospital/exterior_clean.webp', import.meta.url).href,
    zoom: 1, offsetX: 0, offsetY: 0 },
  spawn: { position: [-10.6075,0,5.946], rotationY: -Math.PI/2 },
  // Presentation only; restored before returning indoors. No GLB modification.
  playerPresentation: { scale: 1.2, screenVertical: true },
  car: {
    position: [0.89221,0,3.62889], rotationY: -1.01472, scale: 0.68,
    interaction: { localPosition: [1.9,0,0.1], radius: 0.7 },
  },
  // The first point comes from car.position at sequence construction.
  carPath: [[3.21683,0,2.10641],[4.98469,0,0.84627],[3.69236,0,0.84627],
    [1.49173,0,0.45182],[-3.11878,0,-1.35285],[-6.12553,0,-3.329],[-7.89912,0,-6.5802]],
  playerBounds: { minX: -12.4, maxX: 3.5, minZ: 1.15, maxZ: 7.1 },
};
