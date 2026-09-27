# Iteración: cuatro escenas de hospital

Entrada ↔ cam05 (recepción) ↔ cam02 (pasillo) ↔ urgencias_prerender.
Las puertas cerradas de acceso/regreso a Urgencias conservan la interacción E
y los requisitos narrativos existentes; sus zonas válidas están declaradas
en las configuraciones. El cruce de la abertura de recepción sigue automático.

## Causa y corrección del portal

La abertura de recepción permite el centro de Bryan en X [-1.5028,-1.0932],
pero el trigger anterior solo cubría [-1.46202,-1.13398]. Con X=-1.49 se podía
pasar del plano Z=-5.359 sin activar el cambio. Una vez detrás, no existía un
nuevo cruce del plano. Se reprodujo antes de editar: posición final
[-1.49,0,-5.38], suelo válido, ninguna activación.

El portal ahora cubre el intervalo navegable completo, con volumen interior
y dirección hacia el fondo. Los obstáculos y marcos no se ampliaron ni quitaron.
No se añadieron desbloqueos al regresar de otra escena. La prueba de navegador
habla con recepción y cruza inmediatamente por X=-1.49, sin regresar a entrada.
Confirma dialogue.isOpen=false, playerInputEnabled=true, isBusy=false y
urgenciasUnlocked=true al cerrar la conversación.

## Presentación

- Recepcionista: [4.05,0,-3.25], giro 2.95; máscara del escritorio conservada.
- Paciente de recepción, cámaras y proporciones de recepción/pasillo intactos.
- Urgencias usa emergency.png, que ya contenía la referencia adjunta.
- Cámara [0,1.65,7], lookAt [0,1,-5], FOV 48, aspecto 1024/559.
- Spawn desde pasillo [-2.22979,0,2.6733], mirando al interior.
- Spawn de regreso al pasillo [0.74,0,-2.44].
- Suelo y obstáculos propios, ajustados a biombos, carritos, camas, gabinetes,
  escritorio y sillas. CameraZones no intervienen en la colisión.
- Doctor responsable, paciente acostado, paciente sentado y enfermera son
  copias visuales estáticas de NPCs existentes. No se cambiaron sus rutas lógicas.
- Los actores de pie y sentado apoyan en Y=0. El paciente acostado se apoya
  en la cama mediante supportHeight=0.85, exclusivamente en su ancla local.
- La entrega conserva su callback, diálogos, propiedad del paquete y progreso.
  El paquete transferido al doctor lógico tiene una copia visual en su ancla.
- El nivel 3D original de Urgencias permanece en memoria para su lógica,
  pero todas sus mallas y NPCs originales quedan ocultos en esta cámara.
- La textura debe estar cargada antes de cambiar de área; no se muestra un
  frame del nivel original mientras se espera el fondo.

## Archivos

Configuraciones: ReceptionWideConfig.js, CorridorConfig.js, UrgenciasConfig.js.
Integración: Game.js, PrerenderBackdropManager.js, PrerenderRoom.js,
SceneNpcAnchors.js, PrerenderRoomView.js, PrerenderRoomDebug.js y
PrerenderDebugConfig.js. También se agregaron/actualizaron pruebas locales.
No se editaron la introducción, entrada, modelos de Bryan, diálogos, secuencias
de entrega, NPCAvoidance, conducción, bosque, policía ni combate.

## Debug y validación

PRERENDER_DEBUG=false en src/game/PrerenderDebugConfig.js.
Para una sesión temporal: http://127.0.0.1:8765/?debugPrerender=1.
Muestra navegación, obstáculos, portales, spawns y anclas; registra cámara,
escala, posición del jugador, portal activo y bloqueo de diálogo.
F8 permite alternar el overlay. En la URL normal no se activa debug.

Pruebas aprobadas:

```powershell
node --test tests/*navigation.test.mjs
node tests/shots23-browser.cjs
node tests/urgencias-browser.cjs
node tests/entrance-browser.cjs
```

14 pruebas de navegación y tres suites de navegador. Recorrido real con
movimiento: nueva partida → recepción → diálogo → pasillo → Urgencias →
doctor → entrega → regreso al pasillo → reentrada con entrega conservada.
Sin avanzar al siguiente capítulo. Se verificaron proporciones, Y=0,
soporte de cama, ventanas vertical/ancha y cero mallas antiguas visibles en
todos los frames registrados de Urgencias. Sin errores de JavaScript.
La captura de entrada conserva SHA-256
58B3651D829F9D4D5A7B4C385AEA3124EE6EC1A040E782A968FBE85DB116868A.

Evidencia: artifacts/urgencias-verification.json y artifacts/urgencias-*.png.
Respaldo previo: artifacts/before_urgencias/.
