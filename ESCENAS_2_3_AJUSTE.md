# Ajuste exclusivo de cam05 y cam02

Archivos de juego modificados: ReceptionWideConfig.js, CorridorConfig.js,
SceneNpcAnchors.js y PrerenderRoomDebug.js. No se modificaron Game.js,
CameraManager, Player, WalkMesh, NPCManager, NPCAvoidance, la entrada,
la secuencia de puertas ni los sistemas de historia/audio/otros niveles.

## Recepción — cam05

- Cámara (0,1.3,6.5), objetivo (0,0.85,−2.8), FOV 36°.
- Spawn desde entrada (0,0,1.8976). Bryan conserva 1.78 m, escala unitaria
  y pies en Y=0. Frente al mostrador su altura proyectada aumenta un 23.8 %
  respecto a la iteración anterior; en el spawn aumenta un 13.4 %.
- Polígono y obstáculos quedan calibrados para esa proyección. No se usan
  CameraZones como colliders.
- La puerta abierta ocupa el intervalo físico X −1.46…−0.74. Los obstáculos
  cierran la pared izquierda, los marcos y la hoja derecha cerrada. El portal
  sólo admite el centro del jugador en X −1.239…−0.961, al cruzar Z=−3.55
  hacia el fondo. Ese margen considera el radio físico de 0.22 m.
- Spawn desde el pasillo (−1.1,0,−3.05). La franja inferior conserva el
  retorno a la entrada con su destino declarado (0,0,4.05).
- Recepcionista estática en (2.4,0,−2.5), detrás del mostrador. Se reutiliza
  el modelo existente sin modificar su actor lógico. La máscara sigue la
  silueta del escritorio en la imagen; el cuerpo completo tiene pies en Y=0.
  Se eliminó el recorte horizontal que dejaba el torso separado del escritorio.
- Un paciente sentado, con ancla, orientación y tamaño visual constantes.
  No se añade un tercer NPC innecesario.

## Pasillo — cam02

Conserva corridor.png, cámara fija, navegación, obstáculos y portales propios.
Se añade un paciente sentado con ancla estática en una silla derecha. Los
regresos al segundo escenario y el acceso existente a la siguiente área
mantienen sus destinos y acciones. No se remodela Urgencias.

## Debug

F8 alterna el overlay en cualquiera de estas dos cámaras. También puede
habilitarse con `debug: true` en su configuración:

- Verde: walkPolygon.
- Rojo: obstáculos.
- Amarillo: portales.
- Azul: spawns.
- Rosa: npcAnchors y orientación.

## Verificación

```powershell
node --test tests/entrance-navigation.test.mjs tests/reception-navigation.test.mjs tests/corridor-navigation.test.mjs
node tests/shots23-browser.cjs
node tests/entrance-browser.cjs
```

Diez pruebas de navegación y ambas suites de navegador aprobadas. Se probó
la abertura, paredes y marcos desde ambos lados, colisiones con pasos grandes,
regresos laterales, transiciones 1↔2↔3, NPCs estáticos, geometría en Y=0,
interacción original de recepción, debug y ventanas de distintos tamaños.

La comparación del framebuffer con recepcionista visible/oculta detectó
8,130 píxeles de su silueta y ningún píxel alterado sobre el frente inferior
del mostrador. No se registraron errores de shaders o JavaScript. Los frames
del recorrido prerenderizado mantienen el hospital original oculto.
La captura de entrada conserva su SHA-256 anterior.

Capturas: artifacts/shots23-*.png.
Respaldo: backups/before_shots_2_3_polish/.
Para probar: http://127.0.0.1:8765, Ctrl+F5 y Nueva partida.
