# Entrada prerenderizada: diagnóstico y reparación

## Causas identificadas

Se revisaron Game, CameraManager, CameraZone, PrerenderBackdropManager,
CollisionSystem, Player, BryanModel y HospitalOpeningSequence. Se compararon
los backups `re_noche_cero_pre_artpass_20260926_141608`,
`chatgpt_pre_visual_fix_20260926_1515`, `PrerenderBackdropManager.js.bak_pre_v4`
y las notas de las iteraciones 11/12. No hay historial Git en esta carpeta.

| Zona anterior | X | Z | Prioridad |
| --- | --- | --- | --- |
| cam-entrance | −1.25 … 1.25 | 2.45 … 3.75 | 9 |
| cam05 | −2.25 … 2.25 | 1.05 … 2.58 | 8 |
| cam-entrance-east | 3.5 … 12 | 0 … 8 | 7 |
| cam-waiting | −12 … −3 | 3 … 8 | 7 |
| cam06 | 1.7 … 5.6 | −8 … −5.7 | 5 |
| cam04 | −9.7 … −2.2 | −2.1 … 0.15 | 4 |
| cam03 | 3 … 12 | −8 … 0 | 3 |
| cam02 | −10 … 5 | −8 … 1 | 2 |
| cam01 (también fallback) | −12 … 0 | 0 … 8 | 1 |

- El supuesto walk-mesh permitía X hasta −1.86 y Z hasta 3.90, fuera de
  CAM_ENTRANCE. Ejemplo: (−1.4, 3.5) seleccionaba cam01; (−1.4, 2.5)
  seleccionaba cam05. En (0.5, 3.8) no había ninguna zona y se usaba cam01.
- `constrainPlayer` actuaba después de colisiones y dependía de la cámara del
  frame anterior. Mezclaba navegación, escala e inclinación en presentación.
  En cam05 el mínimo Z=1.10 impedía alcanzar el siguiente umbral Z=1.05.
- La cámara cercana (0,2.12,0.35), FOV 54, amplificaba el crecimiento del
  personaje. Desplazar el fondo −17.8 unidades no calibraba su perspectiva y
  podía descubrir un borde. El recorte del fondo y la proyección 3D variaban
  de manera diferente con la relación de aspecto de la ventana.
- Escala 1.10 e inclinación 3.5° alteraban el modelo; la inclinación tampoco
  se restauraba en la salida temprana del método para otras áreas.
- La promesa de entrada ignoraba un resultado `false`. Las imágenes de puerta
  también podían reportarse cargadas por `complete`, incluso rotas. El bucle
  de apertura y MainMenu enviaban renders del hospital original aunque el
  canvas permaneciera oculto. El temporizador de dos RAF no verificaba el render.
- El ocultamiento visual sólo incluía Mesh: dejaba sprites de carteles y
  otros renderizables del hospital superpuestos al fondo.

## Responsabilidades finales

- `EntranceConfig.js`: parámetros de cámara, spawn, portal y navegación
  declarados por separado. La navegación no se deriva de la CameraZone.
- `WalkMesh.js`: polígono X/Z, radio físico local de 0.22 m, cuatro obstáculos
  identificados (recepción, pared izquierda, sillas, puertas), barrido con pasos
  cortos y deslizamiento. El radio global de otros escenarios no cambia.
- `CameraManager`: portal opcional; salir al interior en Z≤3.60, regresar en
  Z≥3.85. No escribe posición ni escala. Los demás gestores no tienen portal.
- `PrerenderBackdropManager`: textura y visibilidad únicamente. Se eliminaron
  los clamps de entrada/lobby y las compensaciones del GLB.
- `Game`: usa navegación local por región espacial, independiente de la cámara.
  Al salir retoma las colisiones existentes. Los NPCs siguen simulándose, pero
  sus cuerpos invisibles no bloquean al jugador dentro de esta región.
- `HospitalOpeningSequence`: precarga puertas, entrada, siguiente fondo y GLB;
  comienza sobre negro y no avanza hasta estar lista. Durante la secuencia no
  se envía ningún render 3D. La entrega síncrona prepara cámara, visibilidad y
  textura GPU, renderiza la entrada y sólo después revela el canvas y gameplay.
- `MainMenu`: única condición adicional para omitir el render inicial cuando
  la apertura utiliza una transición DOM.

## Calibración

Se conserva `assets/references/hospital/entrance.png` sin editar ni desplazar.
Cámara (1.4,1.8,−1.6), objetivo (1.4,1.03,7.95), FOV vertical 32°.
Viewport de aspecto 1024/559 con bandas cuando hace falta; fondo y actores
comparten la misma proyección al redimensionar. Spawn (0,0,6.4), rumbo 0
(−Z), velocidad cero. El GLB sigue normalizado una sola vez a 1.78 m, pies
en Y=0 y conversión de ejes +Z a −Z ya presente antes del experimento.

Las puertas pintadas se usan como referencia aproximada de 2.45 m y el suelo
como plano horizontal. No se dispone de metadatos de la cámara que produjo
la imagen: es una calibración visual, no una reconstrucción fotogramétrica.
En esta cámara +X corresponde a la izquierda de pantalla.

Las coordenadas permiten acercarse a la salida lógica (0,0,7.2). La ruta
al mostrador lógico y a Urgencias permanece disponible atravesando el portal.
No se recolocaron NPCs ni se modificaron historia, combate, conducción,
bosque, policía, audio, diálogos o el sistema de avoidance.
Las otras imágenes/cámaras siguen requiriendo su propia calibración futura.

## Verificación reproducible

Desde esta carpeta:

```powershell
node --test tests/entrance-navigation.test.mjs
python -m http.server 8765 --bind 127.0.0.1
# En otra terminal, con Playwright y Microsoft Edge instalados:
node tests/entrance-browser.cjs
```

Dependencia de pruebas: `npm install --no-save --package-lock=false playwright three@0.160.0`.
El juego conserva su carga ES Modules e importmap original; no necesita npm.

Las pruebas cubren pasos grandes sin atravesar obstáculos, 5000 movimientos,
paso libre al lobby, desplazamientos laterales, puertas, histéresis de cámara,
arranque quieto, altura/pies/inclinación reales del GLB, movimiento mediante
Game, ruta hasta recepción, ventanas verticales/panorámicas, fallos de carga
de entrada y puerta, y ausencia de renders del hospital original al arrancar.
Capturas de revisión en `artifacts/entrance-*.png`.
