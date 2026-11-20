#!/usr/bin/env bash
# Arma el sitio que publica GitHub Pages: el front nuevo (preaviso/) en la raíz y la primera versión del sitio (la raíz
# de este repo, copia de web/ del front de José) en /v1/. Los enlaces viejos (/beta/..., plataforma.html, producto.html,
# movil.html) llevan a su equivalente con las páginas de preaviso/public/.
# Primero compilar el front nuevo con BASE_PATH (por ejemplo /hackaton-nasa-2026-front/).
# Uso: BASE_PATH=/hackaton-nasa-2026-front/ bash .github/armar-sitio.sh <carpeta de salida>
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SALIDA="${1:?Falta la carpeta de salida}"
BASE_PATH="${BASE_PATH:?Falta BASE_PATH, por ejemplo /hackaton-nasa-2026-front/}"
COMPILADO="$RAIZ/preaviso/build/client"
ANTERIOR="v1"

# React Router deja las páginas generadas bajo la ruta completa (hackaton-nasa-2026-front/...); con BASE_PATH=/ quedan
# directo en build/client.
PREFIJO="${BASE_PATH#/}"
PREFIJO="${PREFIJO%/}"
PAGINAS="$COMPILADO${PREFIJO:+/$PREFIJO}"
[ -f "$PAGINAS/index.html" ] || { echo "No está $PAGINAS/index.html: compila preaviso con BASE_PATH=$BASE_PATH" >&2; exit 1; }
[ ! -e "$COMPILADO/$ANTERIOR" ] && [ ! -e "$PAGINAS/$ANTERIOR" ] || { echo "El front nuevo no puede tener una ruta /$ANTERIOR/: es la de la primera versión" >&2; exit 1; }
case "$SALIDA" in /|"$RAIZ"|"$RAIZ/") echo "Carpeta de salida no válida: $SALIDA" >&2; exit 1 ;; esac

rm -rf "$SALIDA"
mkdir -p "$SALIDA/$ANTERIOR"

# 1. Front nuevo en la raíz: recursos compilados (assets, favicon, páginas de public/) y las páginas generadas.
if [ -n "$PREFIJO" ]; then
  for f in "$COMPILADO"/*; do
    nombre="$(basename "$f")"
    [ "$nombre" = "index.html" ] && continue          # respaldo de la app; el inicio está entre las páginas generadas
    [ "$nombre" = "${PREFIJO%%/*}" ] && continue      # las páginas van en el paso siguiente
    cp -r "$f" "$SALIDA/"
  done
fi
cp -r "$PAGINAS/." "$SALIDA/"

# 2. Primera versión del sitio en /v1/: la raíz del repo, sin lo que no es parte del sitio. Sus enlaces son relativos,
# así que funciona igual dentro de la subcarpeta.
tar -C "$RAIZ" --exclude=./.git --exclude=./.github --exclude=./preaviso --exclude=./actualizar.sh \
  --exclude="./${SALIDA#"$RAIZ"/}" -cf - . | tar -C "$SALIDA/$ANTERIOR" -xf -

touch "$SALIDA/.nojekyll"

paginas="$(find "$SALIDA" -path "$SALIDA/$ANTERIOR" -prune -o -name index.html -print | wc -l | tr -d ' ')"
[ "$paginas" -ge 348 ] || { echo "Solo $paginas páginas del front nuevo (se esperaban 348: inicio, mapa, quiénes somos y 345 comunas)" >&2; exit 1; }
for f in 404.html plataforma.html producto.html movil.html "$ANTERIOR/index.html" "$ANTERIOR/plataforma.html"; do
  [ -f "$SALIDA/$f" ] || { echo "Falta $f en el sitio armado" >&2; exit 1; }
done
echo "Sitio armado en $SALIDA: $(find "$SALIDA" -type f | wc -l | tr -d ' ') archivos; front nuevo con $paginas páginas en la raíz y primera versión en /$ANTERIOR/"
