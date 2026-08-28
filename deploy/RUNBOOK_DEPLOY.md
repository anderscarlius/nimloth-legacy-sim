# Deploy-runbook — nimloth-legacy-sim till Moria

**Sedan:** B7, 2026-08-19/28. Deployas som steg 1 av en tvårepo-enhet —
se den fullständiga sekvensen (inkl. migration-gateway, EHRbase-bootstrap,
verifiering, S9-kontroller) i
`nimloth-core/services/migration-gateway/deploy/moria/RUNBOOK_DEPLOY.md`.
Denna fil täcker bara detta repots egen del.

## Drift-regel

Filerna på Moria (`/opt/nimloth-deploy-b4/nimloth-legacy-sim/`) är
**engångskopior**, redigeras aldrig på plats. Källan är alltid detta
repo. `deploy.sh` loggar käll-SHA + compose-filens sha256 vid varje
körning.

## Deploy

**Fynd, Fas C (2026-08-28, provkört live):** `/opt/nimloth-deploy` ägs
av `nsf-agent`, 0700. Att `chown`:a en underkatalog räcker INTE — 0700
på FÖRÄLDERN blockerar all traversering för `anderscarlius` in i
NÅGOT under den, oavsett underkatalogens egna rättigheter (bekräftat:
`scp`/`chmod` gav "Permission denied" trots en korrekt `anderscarlius`-
ägd underkatalog). Lösning: en helt NY, syskon-katalog
`/opt/nimloth-deploy-b4/` (inte nästlad under den begränsade), skapad
en gång, helt `anderscarlius`-ägd — `/opt/nimloth-deploy` självt rörs
aldrig (S3, inte vårt att ändra). Det delade `.env`-token-filen ligger
kvar där den alltid legat och läses via `sudo cat` (redan inbyggt i
`deploy.sh`, `anderscarlius` har passwordless sudo).

**Engångsförberedelse (körd 2026-08-28, behöver inte köras om):**
```bash
ssh anderscarlius@192.168.1.220 "sudo mkdir -p /opt/nimloth-deploy-b4 && sudo chown anderscarlius:anderscarlius /opt/nimloth-deploy-b4 && chmod 755 /opt/nimloth-deploy-b4"
```

```bash
GIT_SHA=$(git rev-parse --short=7 HEAD)
IMAGE_TAG="sha-${GIT_SHA}"

ssh anderscarlius@192.168.1.220 "mkdir -p /opt/nimloth-deploy-b4/nimloth-legacy-sim"
scp deploy/docker-compose.moria.yml deploy/deploy.sh \
    anderscarlius@192.168.1.220:/opt/nimloth-deploy-b4/nimloth-legacy-sim/
ssh anderscarlius@192.168.1.220 "chmod +x /opt/nimloth-deploy-b4/nimloth-legacy-sim/deploy.sh"

ssh anderscarlius@192.168.1.220 "cd /opt/nimloth-deploy-b4/nimloth-legacy-sim && IMAGE_TAG=${IMAGE_TAG} DEPLOY_SOURCE_SHA=$(git rev-parse HEAD) ./deploy.sh"
```

## Verifiering

```bash
ssh anderscarlius@192.168.1.220 "curl -sS http://127.0.0.1:11601/healthz"
```

## Rollback

**Provkörd live 2026-08-28** — `docker-compose.moria.yml` kräver
`IMAGE_TAG` även för `down` (fynd, samma klass som det ursprungliga
CI-jobbsfelet); värdet spelar ingen roll för nedrivning.

```bash
ssh anderscarlius@192.168.1.220 "cd /opt/nimloth-deploy-b4/nimloth-legacy-sim && IMAGE_TAG=rollback docker compose -f docker-compose.moria.yml down -v"
```

Säkert (S5) — volymen är ny, skapad av denna deploy.
