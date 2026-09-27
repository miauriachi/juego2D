// Fixed-camera exterior plate calibration.
export const exteriorConfig = {
  id: 'exterior-prerender',
  area: 'exterior',
  aspect: 16 / 9,

  camera: {
    // Keep the same high/far camera used by the supplied hospital parking-lot plate.
    cameraPosition: [0, 20.0, 16.0],
    lookAt: [0, 0, -0.5],
    fov: 45,
  },

  background: {
    key: 'hospital-exterior-prerender',
    url: new URL('../../assets/references/hospital/exterior_clean.webp', import.meta.url).href,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  },

  // Bryan exits through the illuminated Emergency doors.
  spawn: {
    position: [-10.8, 0, 4.55],
    rotationY: -Math.PI / 2,
  },

  // Presentation correction is visual-only; physics and GLB source stay untouched.
  playerPresentation: {
    screenVertical: true,
    maxRollCorrection: 0.34,
  },

  car: {
    // Calibrated to the foreground empty bay. Heading matches the baked parked cars.
    position: [0.72, 0, 3.72],
    rotationY: -1.02,
    scale: 0.58,

    // Door-side interaction point, outside the collision footprint.
    interaction: {
      localPosition: [1.25, 0, 0.15],
      radius: 1.0,
    },
  },

  // User-marked departure route:
  // bay -> central aisle -> sweep up-left -> guard booth / exit barrier.
  // ParkingDepartureSequence prepends the car's actual current position.
  carPath: [
    [2.35, 0, 2.55],
    [4.35, 0, 1.20],
    [4.85, 0, 0.55],
    [3.55, 0, 0.42],
    [1.20, 0, -0.10],
    [-1.40, 0, -0.85],
    [-3.85, 0, -1.85],
    [-5.95, 0, -3.10],
    [-7.55, 0, -4.75],
    [-8.20, 0, -5.75],
  ],

  playerBounds: {
    minX: -12.4,
    maxX: 3.5,
    minZ: 1.15,
    maxZ: 6.2,
  },
};
