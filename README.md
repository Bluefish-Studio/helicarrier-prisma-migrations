# Prisma migrations on Helicarrier

A small, read-only Node.js application for learning how a release migration fails, how to inspect its effects, and how to recover without deleting data. It uses Prisma 7, PostgreSQL, and three fictional release notes. It has no public write endpoint.

Use a **new, disposable database** for this exercise. Never point the intentionally failed version at an existing application database.

## Three versions

| Git tag | Database change | Expected result |
| --- | --- | --- |
| `01-baseline` | Creates the table and three records | App shows the base schema |
| `02-failed-migration` | Tries to add a required column to populated rows | Release command fails; new app is not released |
| `03-add-summary` | Adds a nullable column and backfills the three records | App shows the summaries after recovery |

The failed and corrected scripts have the same migration name because the failed migration **never applied successfully**. This is a recovery exercise, not permission to edit a previously applied migration. The explicit SQL transaction ensures this particular failure leaves no schema change; inspect the database to verify that before resolving anything.

The default `main` branch contains the corrected application. For the complete exercise, start with `01-baseline` and disable automatic deployment so a push cannot skip a step.

## Deploy from GitHub

1. Create a dedicated project and a PostgreSQL 16 database on Helicarrier. Keep external database access off. The example does not require optional extensions.
2. Create a **web service from this GitHub repository**, internal port `3000`. Leave the root directory blank. Use the included Dockerfile and keep the read-only filesystem enabled.
3. Add a service reference from PostgreSQL's **Connection URL** to the app variable `DATABASE_URL`. Do not copy a password into the repository or a public environment variable.
4. Set the normal **Release command** to `npm run db:migrate`. Disable auto-deploy, then use **Deployments → Deploy a specific ref** to deploy `01-baseline`. Verify `/health` returns HTTP 200 and the board shows three records.
5. Deploy `02-failed-migration`. Its release command must fail. Check that the running board still shows the baseline and three records.
6. Inspect the database using the read-only queries below. Continue only if the three original rows are intact, the summary column is absent, and the expected migration has exactly one unresolved failed attempt.
7. For **one deployment only**, set the release command to `npm run db:recover-demo && npm run db:migrate` and deploy `03-add-summary`. The recovery script first checks the known tutorial rows, columns, and history, then marks the failed migration rolled back so the corrected SQL can run. It refuses other states.
8. Restore the normal release command, `npm run db:migrate`, and deploy `03-add-summary` again. Confirm the three summaries remain and `/health` still returns 200.

The first deployment may happen before the reference and release command are configured. A setup failure at that point is expected; finish the settings and deploy the baseline tag explicitly. Do not treat a homepage response as database readiness: `/health` performs an actual database query.

The smallest plans are sufficient for this demonstration, not a production sizing recommendation. Review current prices before creation and remove the demo app and database after the exercise. Back up any data you intend to keep before removing a database.

## Inspect before recovery

Run these read-only queries in the **tutorial database's** query console:

```sql
SELECT id, title FROM guide_release_notes ORDER BY id;

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'guide_release_notes'
ORDER BY ordinal_position;

SELECT migration_name,
       finished_at IS NOT NULL AS finished,
       rolled_back_at IS NOT NULL AS rolled_back
FROM _prisma_migrations ORDER BY started_at;
```

After the deliberate failure, expect `id` and `title` only, three original rows, a completed baseline migration, and an unfinished, not-rolled-back `20261021000200_add_summary` attempt. The failed SQL is `ADD COLUMN summary TEXT NOT NULL`; existing rows have no value for that new column. Depending on Prisma's error handling, the release log can report `P3018` or an aborted PostgreSQL transaction. A retry without resolving the failure reports `P3009`.

If the state differs, stop. This repository's recovery command is specifically for its disposable demo; it is not a general production repair tool. `migrate resolve --rolled-back` only changes migration history. It does not undo SQL or recover lost data.

## Local development

Use Node.js **22.12 or newer in the 22.x series**, Docker Compose, and a free local port `15441`:

```sh
npm ci
docker compose up -d --wait
export DATABASE_URL='postgresql://guide:local-demo-only@127.0.0.1:15441/helicarrier_prisma_guide'
npm run build
npm run db:migrate
npm start
```

Open `http://localhost:3000`. The credentials above belong only to the disposable loopback database in `compose.yaml`. Production credentials must come from a private service reference. Prisma Client is generated during the image build; that build does not require a database connection.

For the three-stage exercise locally, check out each tag and rebuild before starting its version. Stop the old local process before restarting on the same port. Run `npm run db:inspect` to print the known tutorial state without connection details. Use `npm run db:recover-demo` only after reviewing the failure as described above.

## Verification

The integration test refuses non-loopback connections, other database names, extra URL settings, and non-empty databases. Use a fresh disposable Compose database **before running migrations**:

```sh
export TEST_DATABASE_URL='postgresql://guide:local-demo-only@127.0.0.1:15441/helicarrier_prisma_guide'
npm test
```

It tests repeat deployments, atomic failure, rejection of unexpected recovery states, Prisma's failed-migration guard, correction and backfill, and a write from the old schema. It removes only its two test tables on completion. GitHub Actions also builds the image, runs the release command with a read-only root, and checks the public read-only routes.

`docker compose down --volumes` removes the disposable local database. Do not use that cleanup command for a database whose contents you need.

## What this demonstrates

- A failed release prevents the **new application version** from taking traffic. It does not undo database changes already committed by a migration.
- A nullable schema expansion can support both old and new application versions. For large tables, plan a separate batched backfill rather than updating every row in a release transaction.
- Application rollback does not roll back the schema. Wait until older writers have retired before making a formerly optional column required or removing old columns.
- Keep migration tooling in the runtime image when it is used by the release command. Never run `migrate reset` against shared or production data.

References: [Prisma migrate deploy](https://www.prisma.io/docs/cli/v7/migrate/deploy), [failed migration recovery](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/patching-and-hotfixing), [customizing migrations](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/customizing-migrations).
