#!/usr/bin/env bash
# Push dei file di stato (bot, automazione) con riallineamento sicuro.
# Uso: già fatto `git commit`; poi  bash tools/push_state.sh
# Se un altro workflow ha salvato nel frattempo:
#   1. rebase normale (i file diversi si uniscono da soli, i .jsonl in coda pure);
#   2. se c'è un conflitto: rebase annullato (prima restava a metà e i tentativi dopo fallivano tutti)
#      e rifatto tenendo, nei punti in conflitto, la versione di questo giro (la più recente);
#   3. ogni .json toccato deve restare JSON valido, altrimenti si rimette per intero quello di questo giro.
set -u
BRANCH="${GITHUB_REF_NAME:-main}"
MINE="$(git rev-parse HEAD)"
for i in 1 2 3 4 5; do
  git fetch -q origin "$BRANCH" || { sleep $((i * 5)); continue; }
  if ! git rebase -q "origin/$BRANCH" 2>/dev/null; then
    git rebase --abort 2>/dev/null || true
    git reset -q --hard "$MINE"
    if ! git rebase -q -X theirs "origin/$BRANCH"; then
      git rebase --abort 2>/dev/null || true
      git reset -q --hard "$MINE"
      echo "Riallineamento non riuscito (tentativo $i), riprovo..."; sleep $((i * 5)); continue
    fi
    echo "Conflitto risolto tenendo i dati di questo giro."
  fi
  bad=""
  for f in $(git diff --name-only "origin/$BRANCH" HEAD -- '*.json'); do
    python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$f" 2>/dev/null || bad="$bad $f"
  done
  if [ -n "$bad" ]; then
    echo "JSON non valido dopo l'unione:$bad — rimetto la versione di questo giro."
    git checkout "$MINE" -- $bad && git commit -q --amend --no-edit
  fi
  git push -q origin "HEAD:$BRANCH" && { echo "Stato salvato."; exit 0; }
  echo "Push rifiutato (tentativo $i), riprovo..."
  git reset -q --hard "$MINE"
  sleep $((i * 5))
done
echo "Impossibile salvare lo stato aggiornato."
exit 1
