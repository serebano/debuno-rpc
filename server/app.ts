import { createAppRouter } from "./appRouter.ts";
import { watchFiles } from "./sse/files.ts";
import { addEndpoint, watchEndpointsConfig, removeEndpoint } from "./sse/endpoints.ts";
import { createSSE } from "./sse/create.ts";
import meta from "./meta/mod.ts";
import type { Config, ConfigInit } from "../types/config.ts";
import { defineConfig } from "./config.ts";
import type { Context } from "../types/context.ts";
import { createEnv } from "./env.ts";
import * as colors from "../utils/colors.ts";
import type { App } from "../types/app.ts";
import { createConsole, type ConsoleLevel } from "../utils/console.ts";



function createContext(config: Config, opts?: { consoleLevels?: ConsoleLevel[] }): Context {
    return {
        env: createEnv(),
        sse: createSSE({
            space: 2,
            keepAlive: true,
            consoleLevels: opts?.consoleLevels,
            consoleName: `[sse][${config.server.url}]`
        })
    };
}

export function createApp(init: ConfigInit, opts?: { consoleLevels?: ConsoleLevel[] }): App {
    const console = createConsole(`[app][${init.server.url}]`, { levels: opts?.consoleLevels });
    const config = defineConfig(init)
    const context = createContext(config, opts);
    const router = createAppRouter(config, context, {
        consoleLevels: opts?.consoleLevels,
        consoleName: `[router][${init.server.url}]`
    });

    return {
        config,
        context,
        router,
        async onStart(addr) {
            const { url } = context.addr = addr;

            await addEndpoint(config, url.origin);
            watchEndpointsConfig(context.sse);

            watchFiles({
                path: config.server.path,
                base: config.server.base,
                origin: url.origin,
                filter: config.filter,
                target: context.sse
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

                target.emit('file', event);
            }
            );

            console.log()
            console.group(`${colors.gray('[')}${colors.cyan('rpc.serve')}${colors.gray(']')} ${colors.yellow('{ ')} ${colors.red('"' + config.server.port + config.server.base + '"')}${(': ')}${colors.gray('"' + config.server.path + '"')}${colors.gray(' }')}`)
            console.log([
                url.origin + config.server.base,
                url.origin + config.server.base + '?event',
                url.origin + config.server.base + '?json',
                url.origin + config.server.base + '?dash',
                url.origin + config.server.base + '?dash=dev'
            ]);
            console.groupEnd()
            console.log()
        },
        async onStop() {
            if (!context.addr) return;
            const endpoints = await removeEndpoint(config, context.addr.url.origin, (e) => context.sse.emit('endpoint', e))

            context.sse.emit('endpoints', endpoints);
        },
        async onError(error) {
            console.error(colors.red('[rpc.serve]'), error);
            context.sse.emit('error', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                type: error.type,
                code: error.code,
                errno: error.errno,
                syscall: error.syscall,
            });
        }
    };
}