// Authored against emergency.png. All standing actors use Y=0; the bed has an explicit support height.
export const urgenciasConfig = {
  "id": "urgencias_prerender",
  "area": "urgencias",
  "camera": {
    "cameraPosition": [
      0,
      1.65,
      7
    ],
    "lookAt": [
      0,
      1,
      -5
    ],
    "fov": 48
  },
  "aspect": 1.8318425760286225,
  "background": {
    "key": "urgencias-prerender",
    "url": "assets/references/hospital/emergency.png",
    "zoom": 1,
    "offsetX": 0,
    "offsetY": 0,
    "hideOriginalNPCs": true
  },
  "spawnFromPrevious": {
    "position": [
      -2.22979,
      0,
      2.6733
    ],
    "rotationY": 0
  },
  "spawnFromCorridor": {
    "position": [
      -2.22979,
      0,
      2.6733
    ],
    "rotationY": 0
  },
  "spawnPoints": {
    "fromCorridor": {
      "position": [
        -2.22979,
        0,
        2.6733
      ],
      "rotationY": 0
    }
  },
  "entryAnchors": {
    "cam02": "spawnFromCorridor"
  },
  "radius": 0.22,
  "walkPolygon": [
    [
      -2.41235,
      3.68462
    ],
    [
      -6.69572,
      -3.18777
    ],
    [
      -7.02771,
      -6.39401
    ],
    [
      -0.20757,
      -5.65433
    ],
    [
      5.7699,
      -0.96164
    ],
    [
      2.6619,
      3.68462
    ]
  ],
  "obstacles": [
    { "id": "doctor-standing", "polygon": [[-0.17,0.63733],[0.17,0.63733],[0.17,0.97733],[-0.17,0.97733]] },
    { "id": "nurse-standing", "polygon": [[-1.74,-1.9],[-1.42,-1.9],[-1.42,-1.57],[-1.74,-1.57]] },
    {
      "id": "privacy-screen",
      "polygon": [
        [
          -9.37034,
          -7.11543
        ],
        [
          -8.16724,
          -7.11543
        ],
        [
          -5.6426,
          -2.75236
        ],
        [
          -6.21135,
          -2.25738
        ]
      ]
    },
    {
      "id": "rear-cart",
      "polygon": [
        [
          -6.92813,
          -7.67987
        ],
        [
          -5.31638,
          -7.67987
        ],
        [
          -4.17368,
          -4.61128
        ],
        [
          -5.22048,
          -4.11737
        ]
      ]
    },
    {
      "id": "treatment-cart",
      "polygon": [
        [
          -4.56842,
          -6.59254
        ],
        [
          -3.09761,
          -6.59254
        ],
        [
          -2.21216,
          -2.75236
        ],
        [
          -2.98254,
          -2.54821
        ]
      ]
    },
    {
      "id": "beds-curtains-cabinets",
      "polygon": [
        [
          0.08598,
          -6.10678
        ],
        [
          8.81245,
          -6.10678
        ],
        [
          5.15325,
          -0.62734
        ],
        [
          2.43872,
          -0.79094
        ],
        [
          1.92925,
          -2.1643
        ],
        [
          0.66957,
          -3.18777
        ]
      ]
    },
    {
      "id": "station-desk-crt",
      "polygon": [
        [
          1.56121,
          0.69933
        ],
        [
          6.03307,
          -0.62734
        ],
        [
          2.64468,
          3.77569
        ],
        [
          0.75562,
          3.77569
        ],
        [
          0.79121,
          2.6733
        ]
      ]
    },
    {
      "id": "waiting-chairs",
      "polygon": [
        [
          0.91439,
          0.07198
        ],
        [
          4.67904,
          -0.47039
        ],
        [
          2.86967,
          2.45295
        ],
        [
          0.80798,
          2.7758
        ],
        [
          0.36614,
          3.52119
        ],
        [
          0.21629,
          2.93955
        ]
      ]
    }
  ],
  "exitPortals": [],
  "npcAnchors": {
    "doctorDelivery": {
      "attachedProps": [{ "name": "medicalKit", "parent": "forearm" }],
      "sourceName": "Doctor responsable",
      "position": [
        0,
        0,
        0.80733
      ],
      "rotationY": 2.2,
      "visible": true
    },
    "patientBed01": {
      "sourceName": "Paciente en camilla 0",
      "position": [
        1.94487,
        0,
        0.40968
      ],
      "supportHeight": 0.85,
      "rotationY": 1.5707963267948966,
      "scale": 0.8,
      "visible": true
    },
    "patientWaiting01": {
      "sourceName": "Paciente sentado 2",
      "position": [
        0.54942,
        0,
        3.25625
      ],
      "rotationY": 1.5707963267948966,
      "scale": 0.8,
      "visible": true
    },
    "nurse": {
      "sourceName": "Enfermera de observación",
      "position": [
        -1.57987,
        0,
        -1.73683
      ],
      "rotationY": 3.141592653589793,
      "scale": 0.9,
      "visible": true
    }
  },
  "interactionAnchors": [
    {
      "sourceId": "chief-doctor",
      "position": [
        -0.42457,
        0,
        1.29685
      ],
      "radius": 1.05
    },
    {
      "sourceId": "return-reception",
      "position": [
        -2.48426,
        0,
        2.96716
      ],
      "radius": 0.9
    }
  ],
  "debug": false,
  "returnPortal": {
    "id": "to-corridor",
    "trigger": "interact",
    "sourceId": "return-reception",
    "minX": -2.78445,
    "maxX": -2.28897,
    "z": 3.55512,
    "direction": 1,
    "bounds": {
      "minX": -2.78445,
      "maxX": -2.28897,
      "minZ": 1.93898,
      "maxZ": 3.55512
    },
    "targetArea": "reception",
    "targetZone": "cam02",
    "targetAnchor": "spawnFromUrgenciasReturn"
  }
};
