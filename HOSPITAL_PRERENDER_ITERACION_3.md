# Recepción y pasillo prerenderizados

Esta iteración reemplaza la calibración y los portales descritos en
RECEPCION_PRERENDER_REPARACION.md. CAM_ENTRANCE y la secuencia de puertas
conservan su configuración y comportamiento.

- Segundo escenario: cam05 / reception_wide.png. Cámara (0,1.44,6.8),
  lookAt (0,0.96,−2.8), FOV 42°. Las distancias del suelo se recalibraron
  conjuntamente con sus obstáculos y anclas. Bryan conserva altura 1.78 m,
  escala (1,1,1) y Y=0. Su altura proyectada aumenta un 25.5 % en el ancla
  inicial, sin desplazar los pies en la imagen.
- Retorno: franja inferior completa, Z≥3.02, con intención de movimiento
  hacia +Z. Funciona desde ambos lados y después de haber rebasado el borde
  de activación. El destino declarado de entrada es (0,0,4.05).
- Tercer escenario: cam02 / corridor.png. Cámara, suelo, silla izquierda,
  sillas derechas, carrito, pared y puerta tienen configuración propia en
  CorridorConfig.js. El portal de recepción entra en (0.3,0,2.2). La franja
  inferior del pasillo devuelve a recepción en (−0.96,0,−3.76).
- Los dos escenarios usan spawnFromPrevious, spawnFromNext, entryAnchors,
  exitPortals y returnPortal. No se guardan posiciones ad hoc de salida.
  La orientación se conserva durante los cortes para permitir W/S sin rebotes.
- corridor.png se precarga con los otros fondos. Ningún frame del recorrido
  entrada–recepción–pasillo muestra el hospital original. Una carga fallida
  mantiene el mensaje de error sobre negro, sin fallback 3D.
- SceneNpcAnchors reutiliza las mallas de la recepcionista existente en un
  grupo visual estático y exclusivo de cam05. Sus materiales son independientes;
  el recorte inferior oculta el cuerpo detrás del mostrador. No se modifican
  posición lógica, rutas, materiales originales ni NPCManager/NPCAvoidance.
- Las anclas de interacción reutilizan los callbacks originales de recepción,
  documento y acceso a Urgencias. No se cambian diálogos ni condiciones de
  historia. Urgencias permanece en su implementación actual: sólo se conserva
  su acceso con E desde el pasillo y el retorno al ancla del corredor.

F8 activa/desactiva la geometría de depuración en recepción y pasillo.
Los fondos conservan su aspecto con bandas en ventanas verticales/panorámicas.

Verificación:

```powershell
node --test tests/entrance-navigation.test.mjs tests/reception-navigation.test.mjs tests/corridor-navigation.test.mjs
node tests/hospital-prerender-browser.cjs
node tests/entrance-browser.cjs
```

Diez pruebas de navegación aprobadas. La suite conectada verificó 454 frames,
retornos laterales, paso bidireccional al corredor, NPC, perspectiva, fallos de
carga, diálogo y acceso existente a Urgencias, sin errores del navegador.
La captura inicial de CAM_ENTRANCE conserva el mismo SHA-256 que antes de
esta iteración. Capturas nuevas: artifacts/hospital-v3-*.png.

Respaldo previo: backups/before_corridor_iteration/.
Prueba manual: http://127.0.0.1:8765, recargar con Ctrl+F5 y Nueva partida.
