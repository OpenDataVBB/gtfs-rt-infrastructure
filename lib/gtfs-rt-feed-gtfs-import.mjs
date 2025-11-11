#!/usr/bin/env zx

import 'zx/globals'
import {ok} from 'node:assert/strict'
import {
	writeFile,
} from 'node:fs/promises'

if (argv.help === true || argv.h === true) {
	process.stdout.write(`\
Usage:
    gtfs-rt-feed-gtfs-import <systemd-config-path>

This tool reads the most recent import from a
bookkeeping PostgreSQL database written by postgis-gtfs-importer v5 [1] and generates a
systemd service (override) config for it, setting
- $PGDATABASE to the name of the database
- $GTFS_FEED_DIGEST to the digest of the GTFS feed's file (and custom import files).

Arguments:
    systemd-config-path
        Path to write the systemd service (override) config to.
Examples:
    gtfs-rt-feed-gtfs-import /etc/systemd/system/gtfs-rt-feed.service.d/pgdatabase.conf

[1] https://github.com/mobidata-bw/postgis-gtfs-importer/blob/v5/README.md
`)
	process.exit()
}

const SYSTEMD_CONFIG_PATH_TEMPLATE = argv._[0]
ok(SYSTEMD_CONFIG_PATH_TEMPLATE, 'missing/empty systemd-config-path (1st argument)')

// todo: support >1 simutaneous Schedule feed variants (imports)
const NUMBER_OF_SCHEDULE_FEED_VARIANTS = 1

const formatSystemdConfigPath = (dbName) => {
	return SYSTEMD_CONFIG_PATH_TEMPLATE.replace('$db_name', dbName)
}

const readImports = async () => {
	const query = `SELECT db_name, feed_digest FROM latest_successful_imports ORDER BY imported_at DESC LIMIT ${NUMBER_OF_SCHEDULE_FEED_VARIANTS}`
	const rows = await $`psql --tuples-only --no-align --field-separator-zero -c ${query}`.lines()
	return rows
		.map(line => line.split('\0'))
		.map(([dbName, feedDigest]) => ({dbName, feedDigest}))
}

const imports = new Map(
	(await readImports()).map((_import) => {
		const systemdCfgPath = formatSystemdConfigPath(_import.dbName)
		return [systemdCfgPath, _import]
	})
)

{
	const [[systemdCfgPath, _import]] = imports.entries()
	const {dbName, feedDigest} = _import
	console.info('generating', systemdCfgPath, 'with', _import)

	const systemdCfgContent = `\
[Service]
Environment=PGDATABASE=${dbName}
Environment=GTFS_FEED_DIGEST=${feedDigest}
`
	// todo: do this atomically?
	await writeFile(systemdCfgPath, systemdCfgContent)
}
