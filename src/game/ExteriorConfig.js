export const exteriorConfig = {
  id: 'exterior-prerender',
  area: 'exterior',
  aspect: 16 / 9,
  camera: {
    cameraPosition: [0, 5.2, 4],
    lookAt: [0, 0, 0],
    fov: 48,
  },
  background: {
    key: 'hospital-exterior-prerender',
    url: 'assets/references/hospital/exterior_prerender.jpg',
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  },

  // Calibrated against the clean parking-lot plate supplied by the user.
  // The player appears just outside the Emergency doors.
  spawn: {
    position: [-3.34, 0, 1.34],
    rotationY: -Math.PI / 2,
  },

  // Empty foreground parking space marked with the red circle.
  car: {
    position: [0.24, 0, 1.19],
    rotationY: -0.34,
    scale: 0.40,
  },

  // Red route drawn on the reference: foreground space -> center aisle -> gate.
  carPath: [
    [0.24, 0, 1.19],
    [0.66, 0, 0.03],
    [-0.40, 0, -0.15],
    [-1.37, 0, -0.49],
    [-2.21, 0, -0.95],
    [-2.89, 0, -1.79],
    [-3.38, 0, -2.28],
  ],

  // Bryan is intentionally restricted to the foreground walkway from
  // the hospital doors to his parking space. The painted cars remain scenery.
  playerBounds: {
    minX: -3.72,
    maxX: 0.82,
    minZ: 0.78,
    maxZ: 1.82,
  },
};
