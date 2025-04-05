import { createRouter } from "../utils/router.ts";
import { createApp } from "./app.ts";
import { defineConfig, parseRC, loadRC, resolveRC } from './config.ts'
import { start } from "./start.ts";
import { serve } from "./serve.ts";
export type { ConfigInit, Config } from "../types/config.ts";
export type { ServerAddr } from "../types/server.ts";
export type { App } from '../types/app.ts';


export {
    defineConfig,
    parseRC,
    createRouter,
    createApp,
    loadRC,
    resolveRC,
    start,
    serve
}

export default start