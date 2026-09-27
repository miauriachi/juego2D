// Shot-local calibration; Bryan keeps his physical height and unit scale.
export const receptionWideConfig = {
  "id": "cam05",
  "camera": {
    "cameraPosition": [
      0,
      1.534,
      6.5
    ],
    "lookAt": [
      0,
      1.003,
      -4.474
    ],
    "fov": 36
  },
  "background": {
    "key": "reception-wide",
    "url": "assets/references/hospital/reception_wide.png",
    "zoom": 1.04,
    "offsetX": 0,
    "offsetY": 0.02
  },
  "aspect": 1.8318425760286225,
  "spawnFromPrevious": {
    "position": [
      0,
      0,
      1.069168
    ],
    "rotationY": 0
  },
  "spawnFromNext": {
    "position": [
      -1.298,
      0,
      -4.769
    ],
    "rotationY": 3.141592653589793
  },
  "radius": 0.22,
  "walkPolygon": [
    [
      -4.023446,
      2.425342
    ],
    [
      2.849936,
      2.425342
    ],
    [
      2.95,
      -4.946
    ],
    [
      -0.8732,
      -4.946
    ],
    [
      -0.8732,
      -6.185
    ],
    [
      -1.7228,
      -6.185
    ],
    [
      -1.7228,
      -4.946
    ],
    [
      -4.012,
      -4.946
    ]
  ],
  "obstacles": [
    {
      "id": "left-chairs",
      "polygon": [
        [
          -4.199266,
          2.913272
        ],
        [
          -1.688108,
          2.913272
        ],
        [
          -1.812362,
          1.532436
        ],
        [
          -2.29274,
          0.185938
        ],
        [
          -2.404486,
          -0.272374
        ],
        [
          -2.076328,
          -1.82549
        ],
        [
          -2.272916,
          -4.579728
        ],
        [
          -2.275394,
          -5.176336
        ],
        [
          -4.06333,
          -5.176336
        ]
      ]
    },
    {
      "id": "water-dispenser",
      "polygon": [
        [
          -2.980326,
          -0.652924
        ],
        [
          -2.193856,
          -0.652924
        ],
        [
          -2.200582,
          0.109474
        ],
        [
          -2.98953,
          0.109474
        ]
      ]
    },
    {
      "id": "reception-counter",
      "polygon": [
        [
          1.350392,
          -4.919686
        ],
        [
          1.000404,
          -0.985094
        ],
        [
          1.171622,
          0.272078
        ],
        [
          1.972724,
          1.745426
        ],
        [
          2.546794,
          2.289052
        ],
        [
          3.769864,
          2.289052
        ],
        [
          3.6521,
          -5.496234
        ],
        [
          1.347206,
          -5.496234
        ]
      ]
    },
    {
      "id": "left-wall",
      "polygon": [
        [
          -4.057902,
          -5.496234
        ],
        [
          -3.6521,
          -5.496234
        ],
        [
          -3.780838,
          3.011094
        ],
        [
          -4.200918,
          3.011094
        ]
      ]
    },
    {
      "id": "right-wall",
      "polygon": [
        [
          2.597062,
          -5.496234
        ],
        [
          3.246298,
          -5.496234
        ],
        [
          3.360758,
          3.011094
        ],
        [
          2.688512,
          3.011094
        ]
      ]
    },
    {
      "id": "wards-left-frame",
      "polygon": [
        [
          -4.248,
          -6.48
        ],
        [
          -1.7228,
          -6.48
        ],
        [
          -1.7228,
          -4.9224
        ],
        [
          -4.248,
          -4.9224
        ]
      ]
    },
    {
      "id": "wards-closed-leaf-and-right-frame",
      "polygon": [
        [
          -0.8732,
          -6.48
        ],
        [
          3.068,
          -6.48
        ],
        [
          3.068,
          -4.9224
        ],
        [
          -0.8732,
          -4.9224
        ]
      ]
    }
  ],
  "entryAnchors": {
    "cam-entrance": "spawnFromPrevious",
    "cam02": "spawnFromNext"
  },
  "exitPortals": [
    {
      "id": "wards",
      "minX": -1.5028,
      "maxX": -1.0932,
      "z": -5.359,
      "bounds": { "minX": -1.5028, "maxX": -1.0932, "minZ": -5.965, "maxZ": -5.359 },
      "direction": -1,
      "targetZone": "cam02",
      "targetAnchor": "spawnFromPrevious"
    }
  ],
  "returnPortal": {
    "id": "entrance",
    "minX": -4.13,
    "maxX": 3.304,
    "z": 1.818114,
    "direction": 1,
    "bounds": {
      "minX": -4.13,
      "maxX": 3.304,
      "minZ": 1.818114,
      "maxZ": 3.078
    },
    "targetZone": "cam-entrance",
    "target": {
      "position": [
        0,
        0,
        4.05
      ],
      "rotationY": 0
    }
  },
  "npcAnchors": {
    "receptionist": {
      "sourceName": "Recepcionista",
      "position": [
        4.18,
        0,
        -2.05
      ],
      "rotationY": 3.141592653589793,
      "presentationYOffset": -0.12,
      "visible": true,
      "occlusionPolygon": [
        [
          0.597,
          0.518
        ],
        [
          0.7,
          0.51
        ],
        [
          0.88,
          0.55
        ],
        [
          1,
          0.56
        ],
        [
          1,
          1
        ],
        [
          0.84,
          0.92
        ],
        [
          0.65,
          0.8
        ],
        [
          0.6,
          0.73
        ]
      ]
    },
    "seatedPatient": {
      "sourceName": "Paciente en espera 1",
      "position": [
        -2.596,
        0,
        -0.462
      ],
      "rotationY": -1.5707963267948966,
      "visible": true,
      "scale": 0.944
    }
  },
  "interactionAnchors": [
    {
      "sourceId": "Recepcionista",
      "position": [
        0.48,
        0,
        -0.55
      ],
      "radius": 1.8
    },
    {
      "sourceId": "reception-document",
      "position": [
        0.87556,
        0,
        -1.787848
      ],
      "radius": 0.767
    }
  ],
  "debug": false
};
