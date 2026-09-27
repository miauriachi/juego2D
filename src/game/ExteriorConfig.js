import exteriorBackdropData from './ExteriorBackdropData.js';

// Fixed-camera exterior plate calibration.
export const exteriorConfig = {
  id: 'exterior-prerender',
  area: 'exterior',
  aspect: 16 / 9,
  camera: {
    // High/far fixed camera to match the supplied overhead parking-lot plate.
    cameraPosition: [0, 20.0, 16.0],
    lookAt: [0, 0, -0.5],
    fov: 45,
  },
  background: {
    key: 'hospital-exterior-prerender',
    url: exteriorBackdropData,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  },

  // Calibrated against the clean parking-lot plate supplied by the user.
  // The player appears just outside the Emergency doors.
  spawn: {
    position: [-6.2, 0, 2.6],
    rotationY: -Math.PI / 2,
  },

  // Empty foreground parking space marked with the red circle.
  car: {
    position: [0.35, 0, 2.05],
    rotationY: -0.34,
    // Keep real proportions versus Bryan; distance is handled by the camera.
    scale: 0.95,
  },

  // Red route drawn on the reference: foreground space -> center aisle -> gate.
  carPath: [
    [0.35, 0, 2.05],
    [1.0, 0, 0.4],
    [-0.8, 0, -0.5],
    [-2.6, 0, -1.3],
    [-4.4, 0, -2.2],
    [-6.0, 0, -3.6],
    [-7.1, 0, -4.8],
  ],

  // Bryan is intentionally restricted to the foreground walkway from
  // the hospital doors to his parking space. The painted cars remain scenery.
  playerBounds: {
    minX: -7.0,
    maxX: 1.25,
    minZ: 1.15,
    maxZ: 3.35,
  },
};
