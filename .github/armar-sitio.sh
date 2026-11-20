#!/usr/bin/env bash
# Arma el sitio que publica GitHub Pages: el sitio actual en la raíz y el front nuevo (preaviso/) en /beta/.
# Primero compilar el front nuevo con BASE_PATH (por ejemplo /hackaton-nasa-2026-front/beta/).
# Uso: BASE_PATH=/hackaton-nasa-2026-front/beta/ bash .github/armar-sitio.sh <carpeta de salida>
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SALIDA="${1:?Falta la carpeta de salida}"
BASE_PATH="${BASE_PATH:?Falta BASE_PATH, por ejemplo /hackaton-nasa-2026-front/beta/}"
COMPILADO="$RAIZ/preaviso/build/client"

# React Router deja las páginas generadas bajo la ruta completa (hackaton-nasa-2026-front/beta/...).
PREFIJO="${BASE_PATH#/}"
PREFIJO="${PREFIJO%/}"
SUB="${PREFIJO##*/}"
[ -d "$COMPILADO/$PREFIJO" ] || { echo "No está $COMPILADO/$PREFIJO: compila preaviso con BASE_PATH=$BASE_PATH" >&2; exit 1; }
case "$SALIDA" in /|"$RAIZ"|"$RAIZ/") echo "Carpeta de salida no válida: $SALIDA" >&2; exit 1 ;; esac

rm -rf "$SALIDA"
mkdir -p "$SALIDA/$SUB"

# 1. Sitio actual: la raíz del repo, sin lo que no es parte del sitio.
tar -C "$RAIZ" --exclude=./.git --exclude=./.github --exclude=./preaviso --exclude=./actualizar.sh \
  --exclude="./${SALIDA#"$RAIZ"/}" -cf - . | tar -C "$SALIDA" -xf -

# 2. Front nuevo: recursos compilados (assets, favicon) y las páginas generadas.
for f in "$COMPILADO"/*; do
  nombre="$(basename "$f")"
  [ "$nombre" = "index.html" ] && continue          # el index de la raíz es solo el respaldo de la app
  [ "$nombre" = "${PREFIJO%%/*}" ] && continue      # las páginas van en el paso siguiente
  cp -r "$f" "$SALIDA/$SUB/"
done
cp -r "$COMPILADO/$PREFIJO/." "$SALIDA/$SUB/"

touch "$SALIDA/.nojekyll"

paginas="$(find "$SALIDA/$SUB" -name index.html | wc -l | tr -d ' ')"
[ "$paginas" -ge 347 ] || { echo "Solo $paginas páginas en /$SUB/ (se esperaban 347: inicio, mapa y 345 comunas)" >&2; exit 1; }
[ -f "$SALIDA/index.html" ] || { echo "Falta el index.html del sitio actual" >&2; exit 1; }
echo "Sitio armado en $SALIDA: $(find "$SALIDA" -type f | wc -l | tr -d ' ') archivos; /$SUB/ con $paginas páginas"
