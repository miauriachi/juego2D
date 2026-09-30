// Image-space calibration for the unmodified 1024 x 559 entrance plate.
// Metres; +Z points toward the doors. With this camera +X is screen-left.
export const ENTRANCE_CAMERA = {
  cameraPosition: [1.4, 1.8, -1.6],
  lookAt: [1.4, 1.03, 7.95],
  fov: 32,
};
export const ENTRANCE_SPAWN = [0, 0, 6.4];
export const ENTRANCE_ASPECT = 1024 / 559;

// Camera selection only. The overlap is intentional hysteresis, not a collider.
export const ENTRANCE_GATE = {
  minX: -1.8, maxX: 3.5, maxZ: 8.3,
  exitZ: 3.6, returnZ: 3.85,
};

// Navigation is authored independently of both the camera and the legacy meshes.
// The polygon extends past the camera cut, leaving an open route into the lobby.
export const ENTRANCE_NAVIGATION = {
  radius: 0.22,
  domain: { minX: -1.8, maxX: 3.5, minZ: 3.5, maxZ: 8.3 },
  polygon: [[-0.55, 3.0], [2.8, 3.0], [2.2, 5.8], [1.85, 6.3],
    [0.75, 8.3], [-1.5, 8.3], [-1.5, 6.1]],
  obstacles: [
    { id: 'reception', polygon: [[1.6, 6.1], [2.6, 5.8], [2.6, 8.5], [0.55, 8.5]] },
    { id: 'left-wall', polygon: [[2.65, 3], [4, 3], [4, 8.5], [2.65, 8.5]] },
    { id: 'right-chairs', polygon: [[-2, 3], [-0.35, 3], [-1.15, 6.15], [-1.15, 8.5], [-2, 8.5]] },
    { id: 'rear-doors', polygon: [[-2, 7.95], [3, 7.95], [3, 8.5], [-2, 8.5]] },
  ],
};
