#!/usr/bin/env bash
set -euo pipefail

# B7 — Moria pull-deploy för nimloth-legacy-sim. Körs PÅ Moria, mot en
# färsk scp:ad kopia av denna fil + docker-compose.moria.yml —
# /opt/nimloth-deploy/nimloth-legacy-sim/ är en engångskopia, redigera
# aldrig på plats. Se deploy/RUNBOOK_DEPLOY.md.
#
# Användning (på Moria, efter scp):
#   IMAGE_TAG=sha-abc1234 DEPLOY_SOURCE_SHA=$(git rev-parse HEAD) ./deploy.sh
#
# Rollback: kör om med IMAGE_TAG satt till den föregående taggen som
# skrivs ut av varje körning.

: "${IMAGE_TAG:?Sätt IMAGE_TAG, t.ex. IMAGE_TAG=sha-abc1234}"
DEPLOY_SOURCE_SHA="${DEPLOY_SOURCE_SHA:-okänd — sattes inte vid körning}"

cd "$(dirname "$0")"

COMPOSE_FILE="docker-compose.moria.yml"
COMPOSE_HASH=$(sha256sum "$COMPOSE_FILE" | cut -d' ' -f1)

echo "=== nimloth-legacy-sim deploy (B7, isolerad B4-kedja) ==="
echo "Käll-SHA (git):      $DEPLOY_SOURCE_SHA"
echo "Compose-fil sha256:  $COMPOSE_HASH"
echo "Ny image-tagg:       $IMAGE_TAG"
echo

ENV_FILE="/opt/nimloth-deploy/.env"
# Fynd (Fas C, 2026-08-28): katalogen ägs av nsf-agent, 0700 — inte
# läsbar för anderscarlius trots docker/sudo-gruppmedlemskap. sudo cat
# + eval i stället för ett vanligt `source`, som skulle misslyckas tyst.
if ! sudo test -f "$ENV_FILE"; then
  echo "FEL: $ENV_FILE saknas eller är oåtkomlig ens via sudo. Se deploy/RUNBOOK_DEPLOY.md." >&2
  exit 1
fi
eval "$(sudo cat "$ENV_FILE")"
: "${GHCR_USER:?GHCR_USER saknas i $ENV_FILE}"
: "${GHCR_PAT:?GHCR_PAT saknas i $ENV_FILE}"

echo "$GHCR_PAT" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

docker network inspect b4-chain >/dev/null 2>&1 || docker network create b4-chain

PREVIOUS_IMAGE=$(docker inspect nimloth-legacy-sim --format '{{.Config.Image}}' 2>/dev/null || echo "(ingen körande container — första deploy)")
echo "Föregående image (rollback-referens): $PREVIOUS_IMAGE"
echo

export IMAGE_TAG
docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d

echo
echo "--- Väntar 15s och kontrollerar status ---"
sleep 15
docker compose -f "$COMPOSE_FILE" ps

echo
echo "--- Klart. Rollback vid behov: IMAGE_TAG=<föregående-tagg-ovan> ./deploy.sh ---"
