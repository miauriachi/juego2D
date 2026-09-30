# Calibración de recepción y pasillo

Este ajuste sustituye los valores anteriores de ESCENAS_2_3_AJUSTE.md.
Cambios de juego limitados a ReceptionWideConfig.js, CorridorConfig.js y
PrerenderRoomView.js (registro opcional). Sin cambios en sistemas globales.

| Parámetro | Recepción cam05 | Pasillo cam02 |
|---|---|---|
| Cámara | [0, 1.534, 6.5] | [0.3, 1.24, 7] |
| LookAt | [0, 1.003, -4.474] | [0.3, 0.8, -2.6] |
| FOV | 36 | 44 |
| Spawn desde escena anterior | [0, 0, 1.069168] | [0.3, 0, 3.16] |
| Presencia de Bryan frente al ajuste previo | -15.5 % | +25.5 % |

Bryan conserva altura física de 1.78 m, escala [1,1,1] y pies en Y=0.
Las coordenadas locales del suelo, obstáculos y portales se recalibraron para
conservar su proyección sobre el fondo. Destinos y acciones existentes intactos.

Recepcionista estática en [4.25,0,-3.1], junto al monitor; escritorio ocultando
la parte inferior del cuerpo. Paciente de recepción visualmente idéntico:
se compensó únicamente su ancla y escala local para conservar todos sus
vértices proyectados (error máximo 3.86e-16). No cambió su pose ni silla.
Paciente del pasillo en [2.02,0,1.88], aproximadamente 25 % más grande en pantalla.

Debug de consola: abrir `http://127.0.0.1:8765/?debugPrerender=1`.
Imprime sceneId, playerSpawn, playerScale, npcAnchors y camera al entrar.
Sin ese parámetro está desactivado. F8 conserva el overlay de navegación.

Verificación realizada:

- 10 pruebas de navegación aprobadas (entrada, recepción y pasillo).
- `node tests/shots23-browser.cjs`: escala, paciente conservado, oclusión,
  NPCs estáticos, puerta, regresos, interacción y distintos tamaños de ventana.
- `node tests/entrance-browser.cjs`: regresión de entrada aprobada.
- Sin errores de navegador; captura de escena 1 idéntica por SHA-256.

Capturas: artifacts/shots23-reception.png y artifacts/shots23-corridor.png.
Registro: artifacts/latest-calibration-verification.txt.
Configuraciones anteriores: artifacts/before_latest_calibration/.
