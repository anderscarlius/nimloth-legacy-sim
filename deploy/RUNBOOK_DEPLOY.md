# Deploy-runbook — nimloth-legacy-sim till Moria

**Sedan:** B7, 2026-08-19/28. Deployas som steg 1 av en tvårepo-enhet —
se den fullständiga sekvensen (inkl. migration-gateway, EHRbase-bootstrap,
verifiering, S9-kontroller) i
`nimloth-core/services/migration-gateway/deploy/moria/RUNBOOK_DEPLOY.md`.
Denna fil täcker bara detta repots egen del.

## Drift-regel

Filerna på Moria (`/opt/nimloth-deploy/nimloth-legacy-sim/`) är
**engångskopior**, redigeras aldrig på plats. Källan är alltid detta
repo. `deploy.sh` loggar käll-SHA + compose-filens sha256 vid varje
körning.

## Deploy

```bash
GIT_SHA=$(git rev-parse --short=7 HEAD)
IMAGE_TAG="sha-${GIT_SHA}"

ssh anderscarlius@192.168.1.220 "mkdir -p /opt/nimloth-deploy/nimloth-legacy-sim"
scp deploy/docker-compose.moria.yml deploy/deploy.sh \
    anderscarlius@192.168.1.220:/opt/nimloth-deploy/nimloth-legacy-sim/
ssh anderscarlius@192.168.1.220 "chmod +x /opt/nimloth-deploy/nimloth-legacy-sim/deploy.sh"

ssh anderscarlius@192.168.1.220 "cd /opt/nimloth-deploy/nimloth-legacy-sim && IMAGE_TAG=${IMAGE_TAG} DEPLOY_SOURCE_SHA=$(git rev-parse HEAD) ./deploy.sh"
```

## Verifiering

```bash
ssh anderscarlius@192.168.1.220 "curl -sS http://127.0.0.1:11601/healthz"
```

## Rollback

```bash
ssh anderscarlius@192.168.1.220 "cd /opt/nimloth-deploy/nimloth-legacy-sim && docker compose -f docker-compose.moria.yml down -v"
```

Säkert (S5) — volymen är ny, skapad av denna deploy.
