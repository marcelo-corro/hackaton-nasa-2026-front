# Preaviso · front nuevo

Publicado en la raíz del sitio: https://marcelo-corro.github.io/hackaton-nasa-2026-front/ (antes en `/beta/`).

Riesgo de incendio por comuna (24 h, 48 h y 7 días) e incendios activos en Chile. Lee los datos que publica el
back en <https://marcelo-corro.github.io/hackaton-nasa-2026-datos/> (contrato v0.8) al cargar la página: el sitio
no se recompila cuando cambian los datos.

## Stack
React 19 + TypeScript + Vite + React Router (modo framework, sin servidor) · Tailwind CSS 4 · MapLibre GL
(vía react-map-gl, mapa base de OpenFreeMap) · TanStack Query + zod (validación del contrato) · Motion · Lucide.

## Vistas
- `/` inicio: buscador de comunas, cifras del día, dónde está el riesgo e incendios activos por región.
- `/comuna/:slug` ficha: nivel del día, pronóstico 24 h / 48 h / 7 días, incendios activos, por qué (motivos y
  clima), qué hacer (con su fuente), mapa de la comuna, números de emergencia, seguir y compartir.
- `/mapa` mapa de Chile: comunas por nivel según el horizonte, incendios activos con zona probable de avance,
  prioridades y panel de la comuna elegida (`/mapa?comuna=05101`).

## Comandos
Requiere Node 22 o más nuevo. En PowerShell con la política de ejecución restringida, usar `npm.cmd`.

```bash
npm install
npm run dev          # http://localhost:5180
npm run typecheck
npm run build        # build/client (SPA estático)
npm run preview      # sirve build/client en http://localhost:5181
npm run indice       # regenera app/lib/comunas-indice.json desde regiones.geojson
```

Para publicar en una subcarpeta (GitHub Pages), compilar con `BASE_PATH=/hackaton-nasa-2026-front/`. En Git
Bash de Windows anteponer `MSYS_NO_PATHCONV=1` (si no, convierte la ruta en `C:/Program Files/Git/...`).

`public/` tiene, además del ícono, las páginas que mantienen los enlaces viejos: `404.html` (lleva `/beta/...` a la
raíz y muestra "no encontramos esta página" para lo demás), `plataforma.html`, `producto.html` y `movil.html` (de la
primera versión del sitio, que sigue en `/v1/`).

## Notas
- `app/lib/esquemas.ts` describe el contrato; si el back cambia la forma de un archivo, la vista muestra un error
  en vez de datos equivocados.
- `app/componentes/mapa/maplibre.ts` fija la URL del worker de MapLibre 6 (sin eso, el mapa compilado queda en
  blanco).
- Los textos de recomendaciones, motivos y notas vienen del back; el front no los inventa.
