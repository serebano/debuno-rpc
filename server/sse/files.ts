import type { File, FileEvent, SSE, SSETarget } from "./types.ts";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readDir } from "../../utils/mod.ts";
import chokidar, { type FSWatcher } from "chokidar"
import * as meta from '../meta/mod.ts'
import type { App } from "../index.ts";

const console = globalThis.console.extend('files')

export async function getFiles(app: App): Promise<File[]> {
    console.debug(`[get]`, [app.config.server.dirname, app.config.server.endpoint])

    return await readDir(app.config.server.dirname)
        .catch(() => [])
        .then(files => files
            .filter(app.config.filter)
            .map(path => {
                const base = app.config.server.base
                const file = pathToFileURL(join(app.config.server.dirname, path)).href
                const http = new URL(base + path, app.config.server.endpoint).href
                const version = meta.versions[http] || null
                const timestamp = meta.timestamps[http] || null
                const dependents = meta.dependents[http] || null
                const dependencies = meta.dependencies[http] || null
                const endpoint = app.config.server.endpoint
                const dirname = app.config.server.dirname
                // const lang = getLangFromExt(file)

                return {
                    // lang,
                    base,
                    path,
                    file,
                    http,
                    version,
                    endpoint,
                    dirname,
                    timestamp,
                    dependents,
                    dependencies
                }
            })
        )
}

export function watchFiles(app: App, listener: (event: FileEvent) => void): FSWatcher {
    console.debug(`[watch]`, app.dirname)

    const emit = (type: FileEvent['type']) => (path: string) => listener(createFileEvent({ type, path }, app))
    const watcher = chokidar.watch(app.dirname, {
        ignored: (path, stats) => (stats?.isFile() && !app.config.filter(path)) as boolean,
        persistent: true,
        ignoreInitial: true,
    });

    return watcher
        .on('unlink', emit('removed'))
        .on('add', emit('added'))
        .on('change', emit('changed'))
}


function createFileEvent(event: { type: FileEvent['type'], path: string }, app: App): FileEvent {
    const type = event.type
    const base = app.config.server.base
    const path = event.path.replace(app.dirname + "/", '')
    const file = new URL(event.path, 'file://').href
    const http = new URL(base + path, app.endpoint).href
    const version = 0
    const endpoint = app.endpoint
    const dirname = app.dirname
    const timestamp = Date.now()
    // const lang = getLangFromExt(file)


    return { type, base, path, file, http, version, endpoint, dirname, timestamp, dependents: null, dependencies: null }
}