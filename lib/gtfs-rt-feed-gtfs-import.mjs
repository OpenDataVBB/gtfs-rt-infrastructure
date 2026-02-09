#!/usr/bin/env zx

import 'zx/globals'
import {ok} from 'node:assert/strict'
import {
	dirname,
	sep as pathSeparator,
} from 'node:path/posix'
import {
	readdir,
	rm,
	writeFile,
} from 'node:fs/promises'

if (argv.help === true || argv.h === true) {
	process.stdout.write(`\
Usage:
    gtfs-rt-feed-gtfs-import [options] [--] <systemd-config-path> <number-of-schedule-feed-variants>

This tool reads the most recent \`number-of-schedule-feed-variants\` imports from a
bookkeeping PostgreSQL database written by postgis-gtfs-importer v5 [1] and generates a
systemd service (override) config for each, setting
- $PGDATABASE to the name of the database
- $GTFS_FEED_DIGEST to the digest of the GTFS feed's file (and custom import files).

Arguments:
    systemd-config-path
        Path to write the systemd service (override) config to.
    number-of-schedule-feed-variants
        Out of the most recent Schedule feed variants/imports, how many to create systemd services for.
Options:
    --keep-obsolete-and-unknown       Keep systemd config files whose path fits the specified template,
                                        even if they are not part of the now-new config files.
Examples:
    gtfs-rt-feed-gtfs-import /etc/systemd/system/gtfs-rt-feed.service.d/pgdatabase.conf 3

[1] https://github.com/mobidata-bw/postgis-gtfs-importer/blob/v5/README.md
`)
	process.exit()
}

const SYSTEMD_CONFIG_PATH_TEMPLATE = argv._[0]
ok(SYSTEMD_CONFIG_PATH_TEMPLATE, 'missing/empty systemd-config-path (1st argument)')

// todo: support >1 simutaneous Schedule feed variants (imports)
ok(argv._[1], 'missing/empty number-of-schedule-feed-variants (2nd argument)')
const NUMBER_OF_SCHEDULE_FEED_VARIANTS = parseInt(argv._[1])
ok(Number.isInteger(NUMBER_OF_SCHEDULE_FEED_VARIANTS), 'number-of-schedule-feed-variants (2nd argument) must be an integer')

const keepObsoleteAndUnknown = argv['keep-obsolete-and-unknown'] === true

const _placeholder = '$db_name'
ok(SYSTEMD_CONFIG_PATH_TEMPLATE.includes(_placeholder), 'systemd-config-path (1st argument) must contain a "$db_name" placeholder')
const _iPlaceholder = SYSTEMD_CONFIG_PATH_TEMPLATE.indexOf(_placeholder)
const _tplBefore = SYSTEMD_CONFIG_PATH_TEMPLATE.slice(0, _iPlaceholder)
const _tplAfter = SYSTEMD_CONFIG_PATH_TEMPLATE.slice(_iPlaceholder + _placeholder.length)
const parseSystemdConfigPath = (cfgPath) => {
	if (cfgPath.slice(0, _tplBefore.length) !== _tplBefore) return null
	if (cfgPath.slice(-_tplAfter.length) !== _tplAfter) return null
	const dbName = cfgPath.slice(_tplBefore.length, -_tplAfter.length)
	if (!dbName) return null
	return {dbName}
}

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

if (!keepObsoleteAndUnknown) {
	const dir = dirname(SYSTEMD_CONFIG_PATH_TEMPLATE)
	const _files = (await readdir(dir, {withFileTypes: true}))
		.filter(file => file.isFile())
	const oldImports = new Map(
		_files
		.map(file => {
			const systemdCfgPath = file.parentPath + pathSeparator + file.name
			const _import = parseSystemdConfigPath(systemdCfgPath)
			return [systemdCfgPath, _import]
		})
		// ignore those that don't match SYSTEMD_CONFIG_PATH_TEMPLATE
		.filter(([_, _import]) => _import !== null)
	)

	for (const [systemdCfgPath, _import] of oldImports.entries()) {
		if (imports.has(systemdCfgPath)) {
			// we have the same import in the new set of imports
			console.debug('not deleting', systemdCfgPath, 'with', _import)
		} else {
			console.info('deleting', systemdCfgPath, 'with', _import)
			await rm(systemdCfgPath)
		}
	}
}

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
