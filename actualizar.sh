#!/usr/bin/env bash
# Copia web/ del main del front (RemLover68/aivital-nasa-2026-front) a este repo, sin hacer commit. Se detiene ante errores.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
FRONT="$AQUI/../revision-front"
git -C "$FRONT" fetch -q origin +refs/heads/main:refs/remotes/origin/main
REV=$(git -C "$FRONT" rev-parse --short origin/main)
TMP=$(mktemp -d)
git -C "$FRONT" archive origin/main web ':(exclude)web/presentaciones' | tar -x -C "$TMP"
# No tocar el front nuevo (preaviso/, con su LICENSE) ni la publicación (.github/).
find "$AQUI" -mindepth 1 -maxdepth 1 ! -name .git ! -name .github ! -name preaviso ! -name README.md ! -name actualizar.sh ! -name .nojekyll -exec rm -rf {} +
cp -r "$TMP"/web/. "$AQUI"/
rm -rf "$TMP"
echo "Copiado web/ del front en $REV. Revisa con: git -C \"$AQUI\" status ; luego commit y push."
