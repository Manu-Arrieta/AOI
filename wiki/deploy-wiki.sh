#!/usr/bin/env bash
# ==============================================================================
# deploy-wiki.sh — Despliegue Automatizado de la Wiki a GitHub
# AOI (Agentic Operational Infrastructure)
# ==============================================================================
set -euo pipefail

WIKI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$WIKI_DIR")"
TEMP_WIKI_DIR="/tmp/aoi-wiki-deploy-$$"

# Detectar URL remota del repositorio padre
REMOTE_URL=$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || true)

if [[ -z "$REMOTE_URL" ]]; then
  echo "❌ Error: No se detectó un remote 'origin' en el repositorio."
  exit 1
fi

# Derivar URL de la Wiki (debe terminar en .wiki.git)
if [[ "$REMOTE_URL" == *".wiki.git" ]]; then
  WIKI_REMOTE_URL="$REMOTE_URL"
elif [[ "$REMOTE_URL" == *".git" ]]; then
  WIKI_REMOTE_URL="${REMOTE_URL%.git}.wiki.git"
else
  WIKI_REMOTE_URL="${REMOTE_URL}.wiki.git"
fi

echo "=================================================================="
echo "🚀 Desplegando Wiki Oficial de AOI a GitHub Wiki"
echo "=================================================================="
echo "📁 Directorio Fuente: $WIKI_DIR"
echo "🌐 Repositorio Remoto Wiki: $WIKI_REMOTE_URL"
echo ""

# Limpieza al salir
trap 'rm -rf "$TEMP_WIKI_DIR"' EXIT

echo "1. Clonando repositorio de GitHub Wiki..."
if git clone "$WIKI_REMOTE_URL" "$TEMP_WIKI_DIR" 2>/dev/null; then
  echo "   ✅ Repositorio de Wiki clonado exitosamente."
else
  echo "   ⚠️ Repositorio wiki aún no inicializado en GitHub. Creando inicialización local..."
  mkdir -p "$TEMP_WIKI_DIR"
  git -C "$TEMP_WIKI_DIR" init -b master
  git -C "$TEMP_WIKI_DIR" remote add origin "$WIKI_REMOTE_URL"
fi

echo "2. Copiando archivos de documentación..."
# Copiar todos los archivos .md excluyendo README.md interno si aplica
find "$WIKI_DIR" -maxdepth 1 -name "*.md" ! -name "README.md" -exec cp {} "$TEMP_WIKI_DIR/" \;

echo "3. Preparando commit..."
git -C "$TEMP_WIKI_DIR" add .
if git -C "$TEMP_WIKI_DIR" diff --cached --quiet; then
  echo "   ℹ️ No hay cambios pendientes; la Wiki ya está 100% al día."
else
  git -C "$TEMP_WIKI_DIR" commit -m "docs(wiki): sync official AOI documentation [skip ci]"
  echo "4. Publicando cambios a GitHub..."
  git -C "$TEMP_WIKI_DIR" push -u origin HEAD
  echo "   ✅ ¡Wiki publicada con éxito en GitHub!"
fi

echo ""
echo "=================================================================="
echo "🎉 Despliegue completado."
echo "=================================================================="
