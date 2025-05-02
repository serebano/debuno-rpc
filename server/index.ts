import { createRouter } from "../utils/router.ts";
import { createApp } from "./app.ts";
import { defineConfig, parseRC, loadRC } from './config.ts'
import { start } from "./start.ts";
import { serve } from "./serve.ts";
export type { ConfigInit, Config } from "../types/config.ts";
export type { ServerAddr } from "../types/server.ts";
export type { RPCApp as App } from '../types/app.ts';


export {
    defineConfig,
    loadRC,
    parseRC,
    createRouter,
    createApp,
    start,
    serve
}

export default start