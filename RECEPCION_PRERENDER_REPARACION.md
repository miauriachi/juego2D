# Segundo escenario: CAM 05

## Identificación y causa

El portal existente de CAM_ENTRANCE selecciona **cam05**, nombre
`CAM 05 - LOBBY INTERIOR`, al avanzar hasta Z≤3.60. Su fondo es
`reception-wide`, archivo `assets/references/hospital/reception_wide.png`.
cam01 comparte la imagen, pero no recibe ese primer cruce.

Configuración anterior de cam05: posición (0,2.25,−1.15), lookAt
(0,1.05,2.35), FOV 52°, prioridad 8, cobertura X −2.25…3.5 y Z 0.9…3.85.
No tenía navegación propia: se aplicaban los colliders del hospital original,
sin correspondencia con las sillas y el mostrador pintados. Su cámara miraba
hacia +Z aunque avanzar hacia el interior mueve al jugador hacia −Z.

## Configuración propia

`src/game/ReceptionWideConfig.js` declara por separado:

- Cámara (0,1.8,8.5), lookAt (0,1.2,−3.5), FOV 42°.
- Fondo original, conservando zoom 1.04 y offset vertical 0.02.
- Aspecto 1024/559, con bandas para mantener fondo y proyección alineados.
- Ancla desde entrada (0,0,3), mirando hacia −Z; no depende del X de llegada.
- Ancla desde WARDS (−1.2,0,−4.7).
- Polígono de suelo X/Z y radio de navegación de 0.22 m.
- Obstáculos separados para sillas, dispensador, mostrador y paredes laterales.
- Portal WARDS: X −2.4…−0.2, cruce hacia −Z por Z=−5.05. Conecta con
  cam02 en (0,0,−1.4), dentro de su área transitable existente.
- Portal de regreso: X −0.65…0.65, cruce hacia +Z por Z=4. Se restaura
  el punto válido de CAM_ENTRANCE guardado antes del corte original.

El suelo termina en Z=4.4; el radio mantiene los pies dentro del borde visible.
La pared del fondo tiene una abertura real en el polígono para WARDS.
La cámara no se cambia por alcanzar un borde lateral o acercarse a un mueble.
Los portales requieren cruzar en la dirección indicada y dentro de su anchura.

La calibración se hizo contra la imagen y capturas del navegador. No existen
metadatos de la cámara que generó el fondo. La altura del GLB sigue siendo
1.78 m, escala constante, Y=0; no se alteraron sus transformaciones originales.
Una sombra de contacto local refuerza visualmente el apoyo en el suelo.

## Separación de responsabilidades

`PrerenderRoom` controla anclas, navegación y detección de portales. Reutiliza
`WalkMesh` sin modificarlo. `Game` despacha el movimiento y aplica el destino
de cada portal. Las coordenadas locales no se entregan al selector de zonas
globales mientras esta sala está activa. La CameraZone conserva su cobertura
de acceso existente; sus límites no se usan como colliders del escenario.

`PrerenderBackdropManager` sólo recibe la configuración visual de cam05.
`PrerenderRoomView` presenta la sombra y `PrerenderRoomDebug` dibuja la geometría.
Los NPCs mantienen su simulación y rutas; la política visual existente los
oculta en cam05. Sus cuerpos invisibles no bloquean esta navegación local.
Esta toma todavía no tiene anclas de interacción: los avisos de NPCs globales
no se muestran aquí. La interacción original con recepción sigue accesible
tras continuar por WARDS; no se cambió su diálogo ni la progresión.

## Debug

Pulsa **F8 estando en cam05** para mostrar/ocultar:

- Verde: contorno del suelo.
- Rojo: obstáculos.
- Azul: anclas y radio del jugador.
- Amarillo: portales y dirección de salida.

También puede cambiarse `debug: false` a `true` en ReceptionWideConfig.
El debug y la sombra se ocultan automáticamente al abandonar esta cámara.

## Preservación y pruebas

CAM_ENTRANCE conserva su configuración, cámara, navegación, fondo, spawn,
transición de puertas y funciones de preparación/viewport. Las capturas de
su aparición inicial antes y después resultaron idénticas (SHA-256 coincidente).
La prueba de navegador verifica hashes de archivos protegidos y los bloques
de entrada de Game.js. No se modificaron NPCManager, NPCAvoidance, Player,
BryanModel, CameraManager, CameraZone, WalkMesh ni los sistemas de historia,
Urgencias, conducción, bosque o combate.

Respaldo de los dos archivos existentes modificados:
`backups/before_reception_wide_fix/`.

Con el servidor local en el puerto 8765:

```powershell
node --test tests/entrance-navigation.test.mjs tests/reception-navigation.test.mjs
node tests/reception-browser.cjs
node tests/entrance-browser.cjs
```

Dependencias de pruebas ya instaladas: Playwright, Three.js 0.160.0 y Edge.
Las pruebas sirven la misma versión de Three.js localmente para no depender
de la disponibilidad del CDN. El juego conserva su importmap original.

Resultado: siete pruebas de navegación aprobadas y ambas suites de navegador
sin errores. Se comprobó movimiento real con input, muebles, paredes, anclas,
perspectiva, NPCs ocultos, F8, ida/vuelta por ambos portales, teclas mantenidas,
acceso a la interacción original y tamaños de ventana vertical/panorámico.
Capturas: `artifacts/reception-*.png`.

Para jugar: abrir http://127.0.0.1:8765 y recargar con Ctrl+F5.
