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

# ── Recall por sesión ────────────────────────────────────────────────────────
# Medido sobre 110 sesiones reales de este repositorio: el 82,2 % de las líneas
# que `icm hook prompt` inyectó (527 KB de 634 KB) ya se habían inyectado antes
# en la MISMA sesión, y cada una se relee en todos los requests posteriores.
# ICM no lo evita: `icm hook prompt` ignora `[recall] enabled` y `limit`.
# Cuando este wrapper ES el inyector, recuerda por sesión qué líneas ya entraron
# y no las repite. Sin id de sesión no hay registro: se inyecta sin filtrar.
# Todo en builtins de bash 3.2 (el /bin/bash de macOS) y un único awk, porque
# corre en cada prompt.
RECALL_DIR="${TMPDIR:-/tmp}"
RECALL_DIR="${RECALL_DIR%/}/aoi-recall-seen"
RECALL_FILE=''

# Valor de un campo string del JSON de stdin, en REPLY. Sin jq ni node.
json_field() {
  local re='"'"$1"'"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)"'
  REPLY=''
  if [[ $INPUT =~ $re ]]; then REPLY=${BASH_REMATCH[1]}; fi
}

# Claude Code y VS Code mandan session_id; otras variantes, sessionId o
# conversationId. Sin ninguno, el transcript identifica la sesión igual.
recall_key() {
  local f c
  for f in session_id sessionId conversationId; do
    json_field "$f"
    if [ -n "$REPLY" ]; then
      RECALL_FILE="$RECALL_DIR/s-${REPLY//[^A-Za-z0-9._-]/_}"
      return 0
    fi
  done
  json_field transcript_path
  [ -n "$REPLY" ] || json_field transcriptPath
  [ -n "$REPLY" ] || return 1
  c=$(printf '%s' "$REPLY" | cksum)
  RECALL_FILE="$RECALL_DIR/t-${c%% *}"
}

# Después de compactar, o en una sesión nueva o limpiada, lo inyectado ya no
# está en el contexto y vuelve a valer: el registro se vacía. Un resume
# conserva el contexto, así que conserva el registro. VS Code manda siempre
# source "new".
recall_maintain() {
  [ -n "$RECALL_FILE" ] || return 0
  case "$MODE" in
    start)
      json_field source
      [ "$REPLY" = resume ] && return 0
      # Registros de sesiones que nunca dispararon SessionEnd (VS Code no lo tiene).
      [ -d "$RECALL_DIR" ] && find "$RECALL_DIR" -type f -mtime +2 -delete 2>/dev/null || true
      ;;
    compact|end) ;;
    *) return 0 ;;
  esac
  [ -e "$RECALL_FILE" ] && rm -f "$RECALL_FILE" 2>/dev/null || true
}

# Prompts de pura continuación: una lista cerrada, nunca por largo. El recall de
# "continua" es el de cualquier consulta vacía (55 de esos en el historial).
is_continuation() {
  local p w sep re r=1
  json_field prompt
  p=${REPLY//\\n/ }
  p=${p//\\u00fa/ú}
  p=${p//\\u00ed/í}
  p=${p//\\u00e9/é}
  w='(continua|continúa|continuá|continuar|continue|sigue|seguí|segui|siga|procede|procedé|proceed|dale|ok|okay|okey|sí|si|yes|yep|go on|go ahead|keep going|adelante)'
  sep='[[:space:][:punct:]]'
  re="^${sep}*${w}(${sep}+${w}){0,2}${sep}*\$"
  shopt -s nocasematch
  if [[ $p =~ $re ]]; then r=0; fi
  shopt -u nocasematch
  return $r
}

recall_inject() {
  local out rc=0
  is_continuation && return 0
  # La `x` conserva los saltos finales que `$(...)` borraría: lo que no se
  # filtra sale byte por byte como lo dio icm.
  out=$("$ICM_BIN" hook prompt <<<"$INPUT"; r=$?; printf x; exit "$r") || rc=$?
  out=${out%x}
  # Sin registro, con error, o sin líneas "- " (no es el formato del recall):
  # pasa entera.
  if [ "$rc" -ne 0 ] || [ -z "$RECALL_FILE" ] || [[ $'\n'$out != *$'\n- '* ]] ||
    ! { [ -d "$RECALL_DIR" ] || mkdir -p "$RECALL_DIR" 2>/dev/null; }; then
    printf '%s' "$out"
    return "$rc"
  fi
  # Si ninguna línea es nueva, tampoco va el encabezado.
  awk -v state="$RECALL_FILE" '
    BEGIN { while ((getline l < state) > 0) seen[l] = 1; close(state) }
    { line[++n] = $0
      if (substr($0, 1, 2) != "- ") { keep[n] = 1; next }
      items++
      if (!($0 in seen)) { keep[n] = 1; seen[$0] = 1; fresh[++m] = $0 } }
    END {
      if (m == 0) exit
      for (i = 1; i <= n; i++) if (keep[i]) print line[i]
      for (j = 1; j <= m; j++) print fresh[j] >> state
    }' <<<"$out" || true
}

# start, prompt, compact y end leen su stdin acá (es chico: no trae salida de
# herramientas) porque el registro de recall necesita el id de sesión aunque
# el modo se omita después. pre y post lo pasan intacto a icm.
INPUT=''
STDIN_READ=0
case "$MODE" in
  start|prompt|compact|end)
    IFS= read -r -d '' INPUT || true
    STDIN_READ=1
    recall_key || true
    recall_maintain
    ;;
esac

if [ "$DIALECT" = claude ] && user_scope_fires "$MODE"; then
  # Sin leer el stdin, un PostToolUse con salida grande deja a Claude Code
  # escribiendo en un pipe cerrado.
  [ "$STDIN_READ" = 1 ] || cat >/dev/null 2>&1 || true
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

if [ "$MODE" = prompt ]; then
  recall_inject
  exit 0
fi

if [ "$STDIN_READ" = 1 ]; then
  exec "$ICM_BIN" hook "$MODE" <<<"$INPUT"
fi
exec "$ICM_BIN" hook "$MODE"
