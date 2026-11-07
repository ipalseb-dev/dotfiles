#!/usr/bin/env bash
# Envía la statusline de Claude Code al pie del tablero de Herdr.
# Úsalo desde tu propia statusline: si corre dentro de Herdr ($HC_TERMINAL_ID),
#   [ -n "$HC_TERMINAL_ID" ] && { echo "$INPUT" | bash ~/.config/herdr-app/mods/tablero-pie/claude-statusline.sh; exit 0; }
# Lee el JSON de Claude por stdin. $ACCOUNT (opcional) se muestra tal cual en el pie.
set -u
INPUT=$(cat)
j() { echo "$INPUT" | jq -r "$1" 2>/dev/null; }

CWD=$(j '.cwd // ""')
DIR=${CWD/#$HOME/\~}
MODEL=$(j '.model.display_name // "?"')
CTX=$(printf "%.0f" "$(j '.context_window.used_percentage // 0')" 2>/dev/null || echo 0)
Q_USED=$(j '.rate_limits.five_hour.used_percentage // empty')
Q_RESET=$(j '.rate_limits.five_hour.resets_at // empty')

BRANCH=""; DIRTY=""
if [ -n "$CWD" ] && [ -d "$CWD" ]; then
  BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null)
  [ -n "$BRANCH" ] && { git -C "$CWD" diff --quiet --ignore-submodules HEAD 2>/dev/null || DIRTY="*"; }
fi
Q_REM=""; R_TIME=""
if [ -n "$Q_USED" ] && [ -n "$Q_RESET" ]; then
  Q_REM=$(awk -v u="$Q_USED" 'BEGIN{printf "%.0f", 100-u}')
  R_TIME=$(date -r "$Q_RESET" +%H:%M 2>/dev/null || echo "")
fi

SDIR="$HOME/.config/herdr-app/data/tablero-status"
mkdir -p "$SDIR"
F="$SDIR/${HC_TERMINAL_ID:?fuera de Herdr}.json"
jq -n --arg dir "$DIR" --arg branch "$BRANCH" --arg dirty "$DIRTY" --arg account "${ACCOUNT:-}" \
      --arg model "$MODEL" --arg ctx "$CTX" --arg qrem "$Q_REM" --arg reset "$R_TIME" \
      '{dir:$dir, branch:$branch, dirty:($dirty=="*"), account:$account, model:$model, ctx:($ctx|tonumber),
        qrem:(if $qrem=="" then null else ($qrem|tonumber) end), reset:$reset, at:(now*1000|floor)}' \
      > "$F.tmp" && mv "$F.tmp" "$F"
