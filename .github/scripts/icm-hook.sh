#!/usr/bin/env bash
# icm-hook.sh — ICM hook wrapper: `icm-hook.sh <modo> [claude]`.
#
# Called by: .github/hooks/icm.json (Copilot, sin dialecto) y por
# .claude/settings.json con `claude` (lo traduce install-hooks.mjs).
#
# Con `claude`, el modo se omite si el settings de USUARIO de Claude Code ya
# dispara `icm hook <modo>` en el mismo evento. `setup.sh` corre
# `icm init --mode hook`, que registra start, pre, post, prompt, compact y end
# en ese scope; el proyecto llamaba al mismo modo con otra cadena y Claude Code
# no lo deduplicaba: UserPromptSubmit inyectó 270 164 B duplicados en 155
# prompts (~67k tokens) sobre los 111 transcripts de este repositorio. Sacar
# los modos del .claude/settings.json versionado según el scope de la máquina
# que corría install-hooks dejaba un archivo distinto en cada máquina y, en un
# clon sin `icm init`, Claude Code sin ICM. Por eso se decide acá, al disparar:
# el archivo versionado es el mismo en todas partes y la inyección ocurre una
# vez en cada una. El settings de usuario sólo se lee.

set -euo pipefail

MODE="${1:-}"
DIALECT="${2:-}"

if [ -z "$MODE" ]; then
  echo "Usage: $0 <start|pre|post|prompt|compact|end> [claude]" >&2
  exit 1
fi

case "$DIALECT" in
  ''|claude) ;;
  *)
    # exit 1 y no 2: en Claude Code un exit 2 en PreToolUse BLOQUEA la tool.
    echo "[icm-hook] dialecto desconocido: $DIALECT (claude o nada)" >&2
    exit 1
    ;;
esac

# Los comandos que el settings de usuario corre para un evento cuyo matcher
# cubre al del proyecto. jq viene con macOS 15; node es requisito de AOI y
# cuesta ~40 ms más por disparo, así que sólo es el respaldo.
user_commands() {
  local file="$1" event="$2" matcher="$3"
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg ev "$event" --arg m "$matcher" '
      .hooks[$ev][]?
      | select((.matcher // "") as $u
          | $u == "" or $u == "*"
            or ($m != "" and (try ($m | test("^(?:" + $u + ")$")) catch ($u == $m))))
      | .hooks[]? | select((.type // "command") == "command") | .command // empty
    ' "$file"
  elif command -v node >/dev/null 2>&1; then
    node -e '
      const [f, ev, m] = process.argv.slice(1)
      const s = JSON.parse(require("fs").readFileSync(f, "utf8"))
      for (const g of [].concat(s?.hooks?.[ev] ?? [])) {
        const u = g?.matcher
        let ok = !u || u === "*"
        if (!ok && m) { try { ok = new RegExp("^(?:" + u + ")$").test(m) } catch { ok = u === m } }
        if (ok) for (const h of g?.hooks ?? []) if (h?.command && (!h.type || h.type === "command")) console.log(h.command)
      }
    ' "$file" "$event" "$matcher"
  else
    return 1
  fi
}

# ¿El scope de usuario ya dispara `icm hook <modo>` para este evento? Cuenta
# sólo el binario directo: otra copia de este wrapper con `claude` se omitiría
# por la misma razón y la inyección no la haría nadie. Una entrada que apunta a
# un binario que ya no está (por eso existe `icm init --force`) no cubre nada.
user_scope_fires() {
  local mode="$1" event matcher='' file cmds c bin
  case "$mode" in
    start) event=SessionStart ;;
    pre) event=PreToolUse; matcher=Bash ;;
    post) event=PostToolUse; matcher=Bash ;;
    prompt) event=UserPromptSubmit ;;
    compact) event=PreCompact ;;
    end) event=SessionEnd ;;
    *) return 1 ;;
  esac
  file="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
  [ -r "$file" ] || return 1
  # Ilegible o sin parser: se inyecta. Dos veces es el defecto de antes; cero
  # sería peor.
  cmds=$(user_commands "$file" "$event" "$matcher" 2>/dev/null) || return 1
  while IFS= read -r c; do
    c=${c//\"/}
    c=${c//\'/}
    # Hasta el token `icm` y no hasta el primer espacio: un HOME con espacios.
    [[ "$c" =~ ^(.*/)?icm([[:space:]].*)?[[:space:]]hook[[:space:]]+${mode}([[:space:]]|$) ]] || continue
    bin="${BASH_REMATCH[1]}icm"
    case "$bin" in /*) [ -x "$bin" ] || continue ;; esac
    return 0
  done <<<"$cmds"
  return 1
}

if [ "$DIALECT" = claude ] && user_scope_fires "$MODE"; then
  # Sin leer el stdin, un PostToolUse con salida grande deja a Claude Code
  # escribiendo en un pipe cerrado.
  cat >/dev/null 2>&1 || true
  exit 0
fi

ICM_BIN=""

for candidate in \
  "$(command -v icm 2>/dev/null)" \
  "/opt/homebrew/bin/icm" \
  "/usr/local/bin/icm" \
  "$HOME/.local/bin/icm"
do
  if [ -x "$candidate" ]; then
    ICM_BIN="$candidate"
    break
  fi
done

if [ -z "$ICM_BIN" ]; then
  echo "[icm-hook] WARNING: icm binary not found in PATH or known locations. ICM hooks inactive." >&2
  exit 0
fi

exec "$ICM_BIN" hook "$MODE"
