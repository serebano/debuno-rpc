import type { App } from "../types/app.ts";
import { getChanges, groupByDeep } from "../utils/mod.ts";
import { createApp, type AppOptions } from "./app.ts";
import { watchRC } from "./config/watch.ts";
import { loadRC, parseRC, type ConfigInit, type ServerAddr } from "./index.ts";
import * as debunoServe from "/Users/serebano/dev/debuno-serve/mod.ts";
import { extendConsole } from "../utils/console.ts";
import defaultRouter from "./defaultRouter.ts";
import type { FSWatcher } from "npm:chokidar";
import { blue } from "../utils/colors.ts";

const console = extendConsole('serve')

const defaultRoute = defaultRouter().fetch

export type RPCServerState = 'created' | 'starting' | 'listening' | 'closed' | 'errored'
export interface RPCServer {
    $id: string;
    config: ConfigInit['server']
    /** debuno-serve server instance */
    server?: debunoServe.Server;
    error?: Error | string;

    addr?: ServerAddr;
    apps: App[];

    state: RPCServerState;
    closed: Promise<void>
    listening: Promise<void>
    finished: Promise<void>
    start: () => Promise<RPCServer>;
    stop: () => Promise<RPCServer>;
    restart: () => Promise<RPCServer>;
}

export interface RPCServeOptions {
    throwIfError?: boolean;
    onServerStateChanged?: (server: RPCServer) => void;
    onAppStateChanged?: (app: App) => void;
}

export interface RPCServeInstance {
    get configs(): ConfigInit[]
    get options(): RPCServeOptions
    get apps(): App[]
    servers: Map<string, RPCServer>
    watcher: FSWatcher | null
    shutdown: () => Promise<void>
    reload(): Promise<void>
}

export async function serve(): Promise<RPCServeInstance>
export async function serve(rcFilePath?: string, options?: RPCServeOptions): Promise<RPCServeInstance>
export async function serve(map: Record<string | number, string>, options?: RPCServeOptions): Promise<RPCServeInstance>
export async function serve(init: ConfigInit[], options?: RPCServeOptions): Promise<RPCServeInstance>

export async function serve(
    configs?: ConfigInit[] | Record<string | number, string> | undefined | string,
    options?: RPCServeOptions
) {

    if (!configs || typeof configs === 'string')
        configs = await loadRC(configs)

    if (!Array.isArray(configs)) {
        configs = parseRC(configs)
    }

    if (!configs.length) {
        throw new Error('No configs found')
    }

    const instance = {
        get configs() {
            return configs
        },
        get options() {
            return options
        },
        get apps() {
            return getApps()
        },
        servers: new Map<string, RPCServer>(),
        watcher: null,
        shutdown,
        reload
    } as RPCServeInstance

    const appOptions: AppOptions = {
        getApps(app) {
            return getApps().filter(a => a.$id !== app.$id)
        },
        onStateChanged(app) {
            instance.options.onAppStateChanged?.(app)
        }
    }

    function getApps(): App[] {
        let apps = [] as App[]
        for (const config of instance.configs) {
            const _apps = instance.servers.get(config.server.$id)?.apps //.find(app => app.config.$uid === config.$uid)
            if (_apps)
                apps = [...new Set([...apps, ..._apps])]
        }
        return apps
    }

    async function stopWatcher() {
        await instance.watcher?.close()
        console.debug(`stopWatcher(${instance.watcher?.closed})`)
    }

    async function startWatcher() {
        const configFile = instance.configs[0].$file

        if (!configFile)
            return null

        await instance.watcher?.close()

        console.debug(`startWatcher(${configFile})`)

        console.log(`Watching config`, blue(configFile))

        const pid = (c: ConfigInit) => c.$uid
        const aid = (c: ConfigInit) => c.$id
        const sid = (c: ConfigInit) => c.server.$id

        instance.watcher = watchRC(configFile, async (e) => {
            const newConfigs = await loadRC(configFile)

            const serversChanged = getChanges(instance.configs.map(sid), newConfigs.map(sid))
            const appsChanged = getChanges(instance.configs.map(aid), newConfigs.map(aid))
            const pathsChanged = getChanges(instance.configs.map(pid), newConfigs.map(pid))

            console.clear()
            console.log(`Config changed`, blue(configFile))

            if (appsChanged.removed.length || appsChanged.added.length) {
                console.debug(`[watcher][appsChanged]`, {
                    removed: appsChanged.removed.length,
                    added: appsChanged.added.length
                })
            }

            if (pathsChanged.removed.length || pathsChanged.added.length) {
                pathsChanged.added = pathsChanged.added.filter($uid => !appsChanged.added.includes($uid.split(',').shift()!))
                pathsChanged.removed = pathsChanged.removed.filter($uid => !appsChanged.removed.includes($uid.split(',').shift()!))

                console.debug(`[watcher][pathsChanged]`, {
                    removed: pathsChanged.removed.length,
                    added: pathsChanged.added.length
                })
            }

            if (serversChanged.removed.length || serversChanged.added.length) {
                console.debug(`[watcher][serversChanged]`, {
                    removed: serversChanged.removed.length,
                    added: serversChanged.added.length
                })
            }

            if (pathsChanged.added.length) {
                const apps = getApps()
                for (const $uid of pathsChanged.added) {
                    const config = newConfigs.find(config => config.$uid === $uid)
                    if (config) {
                        const app = apps.find(app => app.$id === config?.$id)

                        console.debug(`(((pathsChanged)))`, { $uid, x: app?.config.$uid })

                        if (app) {
                            await app.update(config)
                        }
                    }
                }
            }

            if (appsChanged.added.length) {
                for (const $id of appsChanged.added) {
                    const config = newConfigs.find(config => config.$id === $id)
                    if (config) {
                        const app = createApp(config, appOptions)
                        const server = instance.servers.get(config.server.$id)
                        if (server) {
                            server.apps = [...server.apps, app]
                            await app.start()
                        } else {
                            const server = createServer(config.server, [app], instance.options)
                            instance.servers.set(server.$id, server)
                            await server.start()
                        }
                    }
                }
            }

            if (appsChanged.removed.length) {
                for (const $id of appsChanged.removed) {
                    const config = instance.configs.find(config => config.$id === $id)
                    if (config) {
                        const server = instance.servers.get(config.server.$id)
                        if (server) {
                            const app = server.apps.find(app => app.$id === $id)
                            if (app) {
                                await app.stop()
                                server.apps = server.apps.filter(a => a.$id !== $id)
                            }
                        }
                    }
                }
            }

            if (serversChanged.removed.length || serversChanged.added.length) {

                if (serversChanged.removed.length) {
                    for (const serverId of serversChanged.removed) {
                        const removedServer = instance.servers.get(serverId)
                        if (removedServer) {
                            await removedServer.stop()
                            instance.servers.delete(serverId)
                        }
                    }
                }

                if (serversChanged.added.length) {
                    const grouped = groupByDeep(newConfigs, 'server.$id')
                    for (const $id of serversChanged.added) {
                        if (!instance.servers.has($id)) {
                            const configs = grouped[$id]
                            const config = configs.at(0)!.server
                            const apps = configs.map(config => createApp(config, appOptions))
                            const server = createServer(config, apps, instance.options)
                            instance.servers.set($id, server)
                            await server.start()
                        }
                    }
                }
            }

            configs = newConfigs

            // await reload()
        })
    }

    function createServers() {
        instance.servers.clear()
        console.debug(`createServers()`)
        const grouped = groupByDeep(instance.configs, 'server.$id')
        for (const $id in grouped) {
            const config = grouped[$id].at(0)!.server
            const apps = grouped[$id].map(config => createApp(config, appOptions))
            const server = createServer(config, apps, instance.options)
            instance.servers.set($id, server)
        }
    }

    async function startServers() {
        console.debug(`startServers()`)
        for (const [_, server] of instance.servers) {
            try {
                await server.start()
            } catch (e: any) {
                console.warn('[startServers]', server.$id, server.state, e.message)
            }
        }
    }

    async function stopServers() {
        console.debug(`stopServers()`)
        for (const [_, server] of instance.servers) {
            try {
                await server.stop()
            } catch (e: any) {
                console.warn('[stopServers]', server.$id, server.state, e.message)
            }
        }
    }

    async function stopApps() {
        for (const app of getApps()) {
            await app.stop()
        }
    }

    async function reload() {
        for (const app of instance.apps) {
            app.isRestarting = true
            // app.context.sse.emit('restart', 'instance')
        }
        await stopServers()
        createServers()
        await startServers()
    }

    async function shutdown() {
        await stopWatcher()
        await stopApps()
        await stopServers()
    }

    createServers()
    await startServers()
    await startWatcher()

    return instance
}

function createServer(
    config: ConfigInit['server'],
    apps: App[],
    options?: RPCServeOptions
): RPCServer {
    const $id = config.$id

    let serverState: RPCServerState
    let serverListening: PromiseWithResolvers<void>
    let serverFinished: PromiseWithResolvers<void>

    options = options || {}

    const server = {
        $id,
        apps,
        config,
        get listening() {
            return serverListening.promise
        },
        get finished() {
            return serverFinished.promise
        },
        async start() {
            if (['listening', 'starting'].includes(server.state) === false)
                await startServer()

            await serverListening.promise

            return server
        },
        async stop(reason?: any) {
            if (server.state !== 'listening')
                throw new Error('Server is not listening. state: ' + server.state)

            for (const app of server.apps) {
                await app.stop();
            }

            server.server?.close(reason)
            await serverFinished.promise

            return server
        },
        async restart() {
            for (const app of server.apps) {
                app.isRestarting = true
                // app.context.sse.emit('restart', 'server')
            }

            await this.stop()
            await this.start()

            return server
        },
        get state() {
            return serverState
        },
        set state(state: RPCServerState) {
            serverState = state;
            options.onServerStateChanged?.(server);
        },
    } as RPCServer

    server.state = 'created'

    function fetch(request: Request): Promise<Response> | Response {
        const url = new URL(request.url)

        for (const app of server.apps) {
            if (['started', 'updated'].includes(app.state) && url.pathname.startsWith(app.config.server.base)) {
                return app.router.fetch(request)
            }
        }

        return defaultRoute(request)
    }

    async function onListen(addr: ServerAddr) {
        server.addr = addr;
        server.error = undefined;
        server.state = 'listening';

        for (const app of server.apps) {
            await app.start(server);
        }

        serverListening.resolve()
    }

    async function onClose() {
        server.state = 'closed';
        server.addr = undefined;
        server.server = undefined;

        for (const app of server.apps) {
            await app.stop();
        }

        serverFinished.resolve();
    }

    async function onError(error: any) {
        server.state = 'errored';
        server.error = error;

        for (const app of server.apps) {
            app.onError(error);
        }

        await onClose();

        if (options?.throwIfError) {
            throw error;
        }
    }

    async function startServer() {
        try {
            serverListening = Promise.withResolvers<void>()
            serverFinished = Promise.withResolvers<void>()

            server.state = 'starting'

            server.server = await debunoServe.serve({
                port: config.port,
                hostname: config.hostname,
                fetch,
                onListen,
                onClose,
                onError
            })
        } catch (e: any) {
            await onError(e)
        }
    }

    return server
}
