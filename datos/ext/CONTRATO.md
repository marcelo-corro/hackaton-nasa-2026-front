# Contrato de predicción por periodo (propuesta del front, versión "prediccion-1.0")

Lo que el front necesita que el back publique para la plataforma de Preaviso. Hoy `web/datos/ext/prediccion-*.json` son
**ejemplos inventados** (`"ejemplo": true`), generados con `scripts/generar_prediccion.py`. Cuando el back los publique con
`"ejemplo": false`, el aviso de "datos de ejemplo" desaparece solo.

## Dónde se leen
- Base configurable: `BASE_PREDICCION` en `web/js/config.js` (por defecto `https://marcelo-corro.github.io/aivital-incendios-datos/prediccion/`; se cambia con `?pred=https://.../`).
- Si la petición falla, el front usa la copia local `web/datos/ext/`. Mismos nombres de archivo en las dos partes.
- Si tampoco está en la copia local (comunas sin archivo de ejemplo), el front arma un detalle sintético en el navegador (`web/js/sintetico.js`) con esta misma forma y `"ejemplo": true`.
- Los contornos siguen siendo `regiones.geojson` del contrato 0.2 (con `region_id`, `nombre`, `region`).

## Rangos (ids fijos)
`esta-semana`, `proxima-semana`, `dentro-2-semanas`, `este-mes`, `proximo-mes`. El back decide las fechas exactas y las pone en `periodo`;
el front las muestra tal cual. Cada rango es un periodo completo: la probabilidad es la de **al menos un incendio en todo el periodo**, no por día.

## Archivos
| Archivo | Contenido |
|---|---|
| `prediccion-chile-<rango>.json` | riesgo de las 345 comunas |
| `prediccion-comuna-<codigo>-<rango>.json` | detalle de una comuna (grilla, tamaño, causas, recomendaciones). Si no existe, el front muestra solo el riesgo de la comuna y lo avisa |
| `prediccion-rangos.json` | opcional, lista de rangos y supuestos sugeridos (el front hoy lleva los suyos) |

## `prediccion-chile-<rango>.json`
```json
{ "contrato": "prediccion-1.0", "ejemplo": false, "generado_utc": "2026-11-14T03:00:00Z", "modelo": "nombre y versión",
  "rango": "este-mes", "periodo": { "desde": "2026-11-14", "hasta": "2026-11-30" },
  "items": [ { "region_id": "05801", "p": 0.299, "ha": 18.2, "detalle": true } ] }
```
- `p`: probabilidad (0 a 1) de al menos un incendio en la comuna en el periodo. `ha`: hectáreas esperadas si ocurre uno.
- `detalle: true` cuando existe el archivo de comuna (el front la marca con borde oscuro).

## `prediccion-comuna-<codigo>-<rango>.json`
```json
{ "contrato": "prediccion-1.0", "ejemplo": false, "generado_utc": "...", "modelo": "...", "rango": "este-mes",
  "periodo": { "desde": "...", "hasta": "..." },
  "comuna": { "region_id": "05801", "nombre": "Quilpué", "region": "Región de Valparaíso" },
  "catalogo": {
    "causas":   [ { "id": "pasto", "nombre": "Pasto y vegetación seca (combustible)", "modificable": true } ],
    "acciones": [ { "id": "cortafuegos", "nombre": "Cortafuegos y limpieza de pasto en los bordes", "causa": "pasto" } ] },
  "resumen": {
    "prob": 0.299,
    "ha": [4.6, 18.2, 58.2],
    "personas_expuestas": 689,
    "vidas_si_incendio": 0.0069,
    "causas": [ { "id": "pasto", "pct": 22.3 } ],
    "recomendaciones": [ { "accion": "cortafuegos", "reduccion_pp": 3.66, "costo_clp": 10885000 } ] },
  "supuestos_sugeridos": { "vsl_clp": 1500000000, "valor_propiedad_ha_clp": 15000000, "costo_combate_ha_clp": 2500000 },
  "grilla": {
    "bbox": [oeste, sur, este, norte], "filas": 6, "columnas": 10,
    "celdas": [ { "f": 0, "c": 3, "p": 0.0121, "ha": [1.1, 4.4, 14.1], "ex": 20, "ca": [22.3, ...], "rc": [[0.4, 300000], ...] } ] }
}
```
- **`resumen.prob`**: probabilidad de al menos un incendio en la comuna. **`ha`**: `[percentil 10, esperado, percentil 90]` de las hectáreas si ocurre un incendio.
- **`causas`**: contribución porcentual de cada variable a la salida del modelo de ML (por ejemplo valores de Shapley agregados por variable). **Deben sumar 100.** `catalogo.causas[].modificable` dice si el municipio puede actuar sobre ella.
  Causas usadas en el ejemplo: `pasto`, `interfaz`, `basurales`, `quemas` (modificables) y `temperatura`, `sequia`, `viento`, `caminos`, `relieve` (no modificables).
- **`recomendaciones`**: una por acción, **solo de causas modificables**. `reduccion_pp` son puntos porcentuales que baja `prob` si se hace la acción; `costo_clp` es el costo para el municipio.
  El front **no recibe el beneficio**: lo calcula con los supuestos editables por el usuario:
  `beneficio = reduccion_pp/100 x (vidas_si_incendio x vsl_clp + ha[1] x (valor_propiedad_ha_clp + costo_combate_ha_clp))` y `razon = beneficio / costo_clp`.
  Por eso el back debe entregar `vidas_si_incendio` (muertes esperadas si ocurre un incendio) y `ha`.
- **Grilla**: de 8x8 a 12x12 celdas según el tamaño de la comuna, rectangular sobre `bbox` (grados). `f=0` es la fila del norte, `c=0` la columna del oeste. Se entregan solo las celdas que tocan la comuna.
  Cada celda: `p` (probabilidad de incendio **dentro de la celda** en el periodo; por ser más chica que la comuna es menor que `prob`), `ha` (igual que arriba), `ex` (personas expuestas),
  `ca` (porcentajes de causas, en el orden de `catalogo.causas`, suman 100) y `rc` (`[reduccion_pp, costo_clp]` por acción, en el orden de `catalogo.acciones`).
  Las vidas de una celda se reparten en proporción a `ex` sobre `resumen.personas_expuestas`.

## Riesgo de un día
La plataforma pide el riesgo de un solo día con los mismos formatos de arriba: `prediccion-chile-<AAAA-MM-DD>.json` y `prediccion-comuna-<codigo>-<AAAA-MM-DD>.json`,
con `periodo.desde` igual a `periodo.hasta`. La probabilidad es la de al menos un incendio ese día. Si el back no los publica, el front los calcula sintéticos en el navegador.

## Triaje del primer ataque (`triaje-<AAAA-MM-DD>.json`)
Un archivo por día, descrito en `guia-front-mvp.md` §5. Base configurable: `BASE_TRIAJE` en `config.js` (o `?triaje=`); si falla, el front usa la copia local.
Cada incendio trae `id`, `nombre`, `comuna`, `region`, `reg_id` (dos dígitos), `lat`, `lon`, `f_inicio`, `comb_inicial` (registro de CONAF) y, del back,
`p_no_control_dia` (0 a 1), `factores` (`nombre`, `aporte_pct` que suma 100, `valor`), `avance` (`direccion_grados` hacia donde avanza, `radio_km_1h`, `radio_km_3h`),
`activos` (`tipo`, `nombre`, `lat`, `lon`, `dist_km`, `eta_h`, `personas_est`) y `prioridad` del día completo. En modo repetición trae `real`
(`sup_total_ha`, `controlado_mismo_dia`). `modelo.umbral` es el umbral de precisión y recall. `acierto` (`auc_pr`, `base_azar`, `precision`, `recall`) puede
venir en `null`: el front lo calcula con `real`. La cola y la prioridad que ve el usuario se recalculan en el front entre los incendios ya conocidos a la hora elegida.

## Reglas que el front da por hechas
- Todo archivo trae `"ejemplo"` (booleano): si es `true`, la pantalla lo marca.
- Cambiar de rango vuelve a pedir los dos archivos con el mismo `<codigo>` y otro `<rango>`.
- Los valores monetarios son pesos chilenos (CLP) enteros.
- Los supuestos de la pantalla (valor de vida estadística, valor de propiedad y costo de combate por hectárea) son una propuesta del equipo sin fuente. No son del back.
