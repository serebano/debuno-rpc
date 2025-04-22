import { createAppRouter } from "./appRouter.ts";
import { getFiles, watchFiles } from "./sse/files.ts";
import { addEndpoint, watchEndpointsConfig, removeEndpoint } from "./sse/endpoints.ts";
import { createSSE } from "./sse/create.ts";
import meta from "./meta/mod.ts";
import type { ConfigInit } from "../types/config.ts";
import { defineConfig, parseRC } from "./config.ts";
import type { Context } from "../types/context.ts";
import { createEnv } from "./env.ts";
// import * as colors from "../utils/colors.ts";
import type { App, AppState } from "../types/app.ts";
import type { FSWatcher } from "npm:chokidar";
import { extendConsole } from "../utils/console.ts";
import type { RPCServer } from "./serve.ts";



export function createAppFrom(endpoint: string, path: string): App {
    const init = parseRC({ [endpoint]: path })[0]

    return createApp(init)
}

createApp.from = createAppFrom

export interface AppOptions {
    getApps?(app: App): App[]
    onStateChanged?(app: App): void | Promise<void>
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

function createContext(app: App, opts?: AppOptions): Context {
    return {
        get apps() {
            return opts?.getApps?.(app) ?? []
        },
        get state() {
            return app.state
        },
        start: app.start,
        stop: app.stop,
        restart: app.restart,
        env: createEnv(),
        sse: createSSE({
            space: 2,
            keepAlive: true,
            async onTargetCreated(target) {
                const apps = opts?.getApps?.(app) ?? []

                target.emit('state', {
                    state: app.state,
                    endpoint: app.endpoint,
                    path: app.config.server.path
                })

                if (apps.length)
                    target.emit('endpoints', apps.map(app => app.endpoint))


                // target.emit('apps', apps.map(app => ({
                //     $id: app.$id,
                //     state: app.state,
                //     endpoint: app.endpoint,
                //     path: app.config.server.path
                // })))

                target.emit('files', await getFiles({
                    path: app.config.server.path,
                    base: app.config.server.base,
                    filter: app.config.filter,
                    origin: app.config.server.endpoint,
                    endpoint: app.config.server.endpoint
                }))
            }
        })
    };
}

export function createApp(init: ConfigInit, opts?: AppOptions): App {

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
        get state() {
            return state.value
        },
        get config() {
            return appConfig
        },
    } as App

    app.start = start
    app.stop = stop
    app.restart = restart
    app.onError = onError
    app.update = update

    app.context = createContext(app, opts);
    app.router = createAppRouter(app);

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
            app.context.sse.emit('files', await getFiles({
                path: app.config.server.path,
                base: app.config.server.base,
                filter: app.config.filter,
                origin: app.config.server.url.origin,
                endpoint: app.config.server.endpoint
            }))
        }

        await startFilesWatcher()

        return app
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
            if (event.type === 'changed') {
                const url = event.http;

                meta.incVersion(url);
                Object.assign(event, meta.get(url));

                if (url.endsWith('.html')) {
                    target.emit('reload', url);
                } else {
                    target.emit('change', meta.getDependents(url, true));
                }
            }

            if (event.type === 'removed') {
                meta.rm(event.http)
            }

            target.emit('file', event);
        });

    }
    async function start(server?: RPCServer) {
        if (['started', 'updated'].includes(app.state))
            return app

        if (server)
            app.context.server = server

        await addEndpoint(app.config); // (e) => app.context.sse.emit('endpoint', e)
        await startFilesWatcher()

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

        await watchers.endpoints?.close()
        await watchers.files?.close()
        await state.set('stopped')

        await removeEndpoint(app.config) // (e) => app.context.sse.emit('endpoint', e)
        app.context.sse.close()

        return app
    }

    async function restart() {
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