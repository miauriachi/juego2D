// Shot-local calibration; Bryan keeps his physical height and unit scale.
export const corridorConfig = {
  "id": "cam02",
  "camera": {
    "cameraPosition": [
      0.3,
      1.2400000000000002,
      7
    ],
    "lookAt": [
      0.3,
      0.8,
      -2.6
    ],
    "fov": 44
  },
  "background": {
    "key": "hospital-corridor",
    "url": "assets/references/hospital/corridor.png",
    "zoom": 1,
    "offsetX": 0,
    "offsetY": 0
  },
  "aspect": 1.8318425760286225,
  "spawnFromPrevious": {
    "position": [
      0.3,
      0,
      3.16
    ],
    "rotationY": 0
  },
  "spawnFromNext": {
    "position": [
      0.74,
      0,
      -2.44
    ],
    "rotationY": 3.141592653589793
  },
  "entryAnchors": {
    "cam05": "spawnFromPrevious",
    "urgencias": "spawnFromUrgenciasReturn"
  },
  "radius": 0.22,
  "walkPolygon": [
    [
      -0.82,
      4.28
    ],
    [
      1.58,
      4.28
    ],
    [
      1.9,
      3.16
    ],
    [
      1.66,
      1
    ],
    [
      1.86,
      -3.64
    ],
    [
      0.06,
      -3.64
    ],
    [
      -0.22,
      -0.76
    ],
    [
      -1.14,
      1.64
    ],
    [
      -1.22,
      3.16
    ]
  ],
  "obstacles": [
    {
      "id": "left-chair",
      "polygon": [
        [
          -1.54,
          2.84
        ],
        [
          -0.836,
          2.84
        ],
        [
          -0.7,
          4.6
        ],
        [
          -1.54,
          4.6
        ]
      ]
    },
    {
      "id": "right-cart",
      "polygon": [
        [
          1.34,
          2.28
        ],
        [
          2.46,
          2.28
        ],
        [
          2.46,
          4.6
        ],
        [
          1.34,
          4.6
        ]
      ]
    },
    {
      "id": "right-chairs",
      "polygon": [
        [
          1.26,
          -0.76
        ],
        [
          2.06,
          -0.76
        ],
        [
          2.06,
          3.24
        ],
        [
          1.62,
          3.24
        ],
        [
          1.26,
          1.4
        ]
      ]
    },
    {
      "id": "left-wall",
      "polygon": [
        [
          -1.54,
          -3.8
        ],
        [
          0.06,
          -3.8
        ],
        [
          -0.22,
          -0.76
        ],
        [
          -1.14,
          1.64
        ],
        [
          -1.54,
          1.64
        ]
      ]
    },
    {
      "id": "rear-door",
      "polygon": [
        [
          0.06,
          -3.8
        ],
        [
          1.98,
          -3.8
        ],
        [
          1.98,
          -3.32
        ],
        [
          0.06,
          -3.32
        ]
      ]
    }
  ],
  "spawnFromUrgenciasReturn": { "position": [0.74, 0, -2.44], "rotationY": 3.141592653589793 },
  "exitPortals": [{
    "id": "to-urgencias", "trigger": "interact", "sourceId": "enter-urgencias",
    "minX": 0.35, "maxX": 1.25, "z": -3.09, "direction": -1,
    "bounds": { "minX": 0.35, "maxX": 1.25, "minZ": -3.10, "maxZ": -2.1 },
    "targetArea": "urgencias", "targetZone": "urgencias_prerender", "targetAnchor": "spawnFromCorridor"
  }],
  "returnPortal": {
    "id": "reception",
    "minX": -1.14,
    "maxX": 1.9,
    "z": 3.76,
    "direction": 1,
    "bounds": {
      "minX": -1.14,
      "maxX": 1.9,
      "minZ": 3.76,
      "maxZ": 4.36
    },
    "targetZone": "cam05",
    "targetAnchor": "spawnFromNext"
  },
  "interactionAnchors": [
    {
      "sourceId": "enter-urgencias",
      "position": [
        0.74,
        0,
        -2.88
      ],
      "radius": 0.8400000000000001
    }
  ],
  "npcAnchors": {
    "seatedPatient": {
      "sourceName": "Paciente en espera 2",
      "position": [
        2.02,
        0,
        1.88
      ],
      "rotationY": 1.5707963267948966,
      "scale": 0.8,
      "visible": true
    }
  },
  "debug": false
};
