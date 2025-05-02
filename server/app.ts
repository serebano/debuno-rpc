// deno-lint-ignore-file
import { createAppRouter } from "./appRouter.ts";
import { getFiles, watchFiles } from "./sse/files.ts";
import { addEndpoint, watchEndpointsConfig, removeEndpoint, readEndpoints } from "./sse/endpoints.ts";
import { createSSE } from "./sse/create.ts";
import meta from "./meta/mod.ts";
import type { ConfigInit } from "../types/config.ts";
import { defineConfig, parseRC } from "./config.ts";
import type { Context } from "../types/context.ts";
import { createEnv } from "./env.ts";
import type { RPCApp, AppState } from "../types/app.ts";
import type { FSWatcher } from "npm:chokidar";
import { extendConsole } from "../utils/console.ts";
import type { RPCServer } from "../types/server.ts"
import { readJSON } from "../utils/json.ts";
import { open } from "../utils/mod.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FileEvent } from "../types/file.ts";


export function createAppFrom(endpoint: string, path: string): RPCApp {
    const init = parseRC({ [endpoint]: path })[0]

    return createApp(init)
}

createApp.from = createAppFrom

export interface AppOptions {
    getApps?(app: RPCApp): RPCApp[]
    onStateChanged?(app: RPCApp): void | Promise<void>
}

class State<T> {
    #value: T
    constructor(value: T, private onChange?: (state: T) => void | Promise<void>) {
        this.#value = value
    }
    async set(value: T) {
        this.#value = value
        await this.onChange?.(this.#value)
    }
    get value() {
        return this.#value
    }
    set value(value) {
        this.#value = value
        this.onChange?.(this.#value)
    }
}

const remoteImportsWatchers = new Map<string, EventSource>()
const remoteEndpointsMap = new Map<string, Set<string>>()
const remoteImportersMap = new Map<string, Set<string>>()
const remoteImportsMap = new Map<string, Set<string>>()
const remoteImportToEndpointMap = new Map<string, string>()

function unwatchRemoteImport(remoteImport: string) {
    const endpoint = remoteImportToEndpointMap.get(remoteImport)
    if (endpoint) {
        const remoteEndpointImports = remoteEndpointsMap.get(endpoint)
        if (remoteEndpointImports) {
            remoteEndpointImports.delete(remoteImport)
            if (remoteEndpointImports.size === 0) {
                remoteEndpointsMap.delete(endpoint)
                remoteImportToEndpointMap.delete(remoteImport)
                remoteImportsWatchers.get(endpoint)?.close()
                remoteImportsWatchers.delete(endpoint)
            }
        }
    }
}

function createContext(app: RPCApp, opts?: AppOptions): Context {
    let files: any
    let importMap: any
    let importMapFile: any

    const context: Context = {
        get remotes() {
            return {
                watchers: remoteImportsWatchers,
                endpoints: remoteEndpointsMap,
                importers: remoteImportersMap,
                imports: remoteImportsMap,
                unwatchImport: unwatchRemoteImport,
                toJSON() {
                    const state = context.remotes;
                    const watchers: Record<string, number> = {};
                    for (const [, es] of state.watchers) {
                        watchers[es.url] = es.readyState;
                    }
                    return {
                        watchers, // Can't serialize EventSource directly
                        endpoints: Object.fromEntries(
                            Array.from(state.endpoints.entries()).map(([k, v]) => [k, Array.from(v)])
                        ),
                        importers: Object.fromEntries(
                            Array.from(state.importers.entries()).map(([k, v]) => [k, Array.from(v)])
                        ),
                        imports: Object.fromEntries(
                            Array.from(state.imports.entries()).map(([k, v]) => [k, Array.from(v)])
                        )
                    }
                }
            }
        },
        get apps() {
            return opts?.getApps?.(app) ?? []
        },
        get state() {
            return app.state
        },
        async getFiles(force) {
            if (!files || force)
                files = await getFiles({
                    path: app.config.server.path,
                    base: app.config.server.base,
                    filter: app.config.filter,
                    origin: app.config.server.endpoint,
                    endpoint: app.config.server.endpoint
                })
            return files
        },
        async getImportMap(force) {
            if (!importMap || force) {
                importMap = {}
                const files = await this.getFiles()
                const denoConfigFile = files.find(file => file.path === 'deno.json')
                if (denoConfigFile) {
                    importMapFile = denoConfigFile.file
                    const denoConfig = await readJSON(denoConfigFile.file)
                    if (denoConfig.imports) {
                        importMap = denoConfig.imports
                    }
                }
            }
            return importMap
        },
        get files() {
            return files
        },
        get importMap() {
            return importMap
        },
        get importMapFile() {
            return importMapFile
        },
        watchRemoteImport(endpoint, importUrl, importerUrl) {
            if (!remoteImportsWatchers.has(endpoint)) {
                const es = new EventSource(endpoint)
                es.addEventListener('file', e => {
                    const data = JSON.parse(e.data) as FileEvent
                    const url = data.http
                    if (remoteImportsMap.has(url)) {
                        if (data.type === 'changed') {
                            meta.incVersion(url);
                            context.sse.emit('change', meta.getDependents(url, true))
                        }
                        if (data.type === 'removed') {
                            meta.rm(url)
                        }
                    }
                })
                remoteImportsWatchers.set(endpoint, es)
            }

            remoteImportToEndpointMap.set(importUrl, endpoint)

            if (!remoteEndpointsMap.has(endpoint)) {
                remoteEndpointsMap.set(endpoint, new Set())
            }

            if (!remoteImportersMap.has(importerUrl)) {
                remoteImportersMap.set(importerUrl, new Set())
            }

            if (!remoteImportsMap.has(importUrl)) {
                remoteImportsMap.set(importUrl, new Set())
            }

            remoteEndpointsMap.get(endpoint)?.add(importUrl)
            remoteImportersMap.get(importerUrl)?.add(importUrl)
            remoteImportsMap.get(importUrl)?.add(importerUrl)

            console.debug(`[watchRemoteImport]`, { endpoint, importUrl, importerUrl })
        },
        endpoints: [],
        start: app.start,
        stop: app.stop,
        restart: app.restart,
        env: createEnv(),
        sse: createSSE({
            space: 2,
            keepAlive: true,
            async onTargetCreated(target) {
                // const apps = opts?.getApps?.(app) ?? []

                target.emit('state', {
                    state: app.state,
                    endpoint: app.endpoint,
                    path: app.config.server.path
                })

                // if (apps.length)
                //     target.emit('endpoints', apps.map(app => app.endpoint))

                target.emit('endpoints', context.endpoints.filter(e => e !== app.endpoint))


                target.emit('files', await context.getFiles(true))
                target.emit('imports', await context.getImportMap(true))
            }
        })
    };
    return context
}

export function createApp(init: ConfigInit, opts?: AppOptions): RPCApp {

    const state = new State<AppState>('created', async () => {
        app.context.sse.emit('state', {
            $id: app.$id,
            state: app.state,
            endpoint: app.endpoint,
            path: app.config.server.path
        })

        for (const a of app.context.apps) {
            a.context.sse.emit('state', {
                $id: app.$id,
                state: app.state,
                endpoint: app.endpoint,
                path: app.config.server.path
            })
        }

        await opts?.onStateChanged?.(app)
    })

    let appConfig = defineConfig(init)

    const app = {
        get $id() {
            return app.config.$id
        },
        get endpoint() {
            return app.config.server.endpoint
        },
        get dirname() {
            return app.config.server.path
        },
        get state() {
            return state.value
        },
        get config() {
            return appConfig
        },
        isRestarting: false
    } as RPCApp

    app.start = start
    app.stop = stop
    app.restart = restart
    app.onError = onError
    app.update = update
    app.context = createContext(app, opts);
    app.router = createAppRouter(app);


    app.exec = (file: string, args?: []) => promisify(execFile)(file, args) // (file: string, args?: []) => execFile(file, args)
    app.inspect = async (dev?: boolean) => {
        const inspectorConfig = await app.config.inspector(dev)
        const inspectorUris = [
            [inspectorConfig.scheme, app.config.server.host, app.config.server.base].join(''),
            [inspectorConfig.url, app.config.server.host, app.config.server.base].join('')
        ]

        for (const uri of inspectorUris) {
            try {
                await open(uri)
                console.info(`open(${uri}) => Done`)
                break;
            } catch (e: any) {
                const message = `No application knows how to open URL`
                console.warn(`open(${uri}) => Failed:`, e.message.includes(message) ? message : e.message)
            }
        }
    }

    app.edit = () => {
        if (app.context.importMapFile)
            return open(`vscode://file${app.context.importMapFile.replace('file://', '')}`)
        const fileNames = ['index.html', 'index.tsx', 'index.ts', 'index.jsx', 'index.js', 'deno.json']
        for (const fileName of fileNames) {
            const file = app.context.files.find(file => file.path === fileName)
            if (file) {
                return open(`vscode://file${file.file.replace('file://', '')}`)
            }
        }

        const file = app.context.files.at(0)
        if (file) {
            return open(`vscode://file${file.file.replace('file://', '')}`)
        }

        return open(`vscode://file${app.config.server.path.replace('file://', '')}`)
    }


    const console = extendConsole('app').extend(app.config.$id)

    const watchers = {
        endpoints: undefined,
        files: undefined
    } as {
        endpoints: FSWatcher | undefined,
        files: FSWatcher | undefined
    }

    async function update(init: ConfigInit) {
        await removeEndpoint(app.config)
        const pathChanged = app.config.server.path !== init.server.path
        appConfig = defineConfig(init)
        // app.router = createAppRouter(app);

        await addEndpoint(app.config)
        await state.set('updated')

        if (pathChanged) {
            app.context.sse.emit('files', await app.context.getFiles(true))
            app.context.sse.emit('imports', await app.context.getImportMap(true))
        }

        await startFilesWatcher()

        return app
    }

    async function startEndpointsWatcher() {
        await watchers.endpoints?.close()
        watchers.endpoints = watchEndpointsConfig(app)
    }

    async function startFilesWatcher() {
        await watchers.files?.close()
        watchers.files = watchFiles({
            path: app.config.server.path,
            base: app.config.server.base,
            origin: app.config.server.url.origin,
            filter: app.config.filter,
            endpoint: app.config.server.endpoint,
            target: app.context.sse
        }, (target, event) => {
            const url = event.http;

            if (event.type === 'changed') {

                meta.incVersion(url);
                Object.assign(event, meta.get(url));

                if (url.endsWith('.html')) {
                    target.emit('reload', url);
                } else {
                    target.emit('change', meta.getDependents(url, true));
                }
            }

            if (event.type === 'removed') {
                meta.rm(url)



                const remoteImports = remoteImportersMap.get(url)
                if (remoteImports) {
                    for (const remoteImport of remoteImports) {
                        const remoteImporters = remoteImportsMap.get(remoteImport)
                        if (remoteImporters) {
                            remoteImporters.delete(url)
                            if (remoteImporters.size === 0) {
                                remoteImportsMap.delete(remoteImport)
                                unwatchRemoteImport(remoteImport)
                            }
                        }
                    }
                }
                remoteImportersMap.delete(url)
            }

            target.emit('file', event);
        });

    }

    async function start(server?: RPCServer) {
        if (['started', 'updated'].includes(app.state))
            return app
        app.isRestarting = false
        if (server)
            app.context.server = server

        await addEndpoint(app.config); // (e) => app.context.sse.emit('endpoint', e)
        await app.context.getFiles(true)
        await app.context.getImportMap(true)
        await startFilesWatcher()
        await startEndpointsWatcher()
        app.context.endpoints = (await readEndpoints()).map(e => e.endpoint)

        await state.set('started')

        console.group()
        console.debug([
            app.config.server.endpoint,
            app.config.server.endpoint + '?event',
            app.config.server.endpoint + '?json',
            app.config.server.endpoint + '?dash',
            app.config.server.endpoint + '?dash=dev'
        ]);
        console.groupEnd()

        return app
    }

    async function stop() {
        if (app.state !== 'started' && app.state !== 'updated')
            return app

        if (app.isRestarting) {
            app.context.sse.emit('restart', 'app')
        }

        await watchers.endpoints?.close()
        await watchers.files?.close()
        await state.set('stopped')

        await removeEndpoint(app.config) // (e) => app.context.sse.emit('endpoint', e)
        // if (!app.isRestarting) {
        await app.context.sse.close()
        // }

        return app
    }

    async function restart() {
        app.isRestarting = true
        await stop()
        await start()

        return app
    }

    async function onError(error: any) {
        // state.value = 'errored'
        await state.set('errored')
        console.error(error);

        app.context.sse.emit('error', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            type: error.type,
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
        });
    }

    return app
}