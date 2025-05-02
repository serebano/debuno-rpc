import type { RPCApp } from "./app.ts";
import type { ConfigInit } from "./config.ts";
import type * as debunoServe from "@debuno/serve";
import type { FSWatcher } from "chokidar";

export interface ServerAddr {
    port: number;
    hostname: string;
    url: URL;
}

export type RPCServerState = 'created' | 'starting' | 'listening' | 'closed' | 'errored'
export interface RPCServer {
    $id: string;
    config: ConfigInit['server']
    /** debuno-serve server instance */
    server?: debunoServe.Server;
    error?: Error | string;

    addr?: ServerAddr;
    apps: RPCApp[];

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
    onAppStateChanged?: (app: RPCApp) => void;
}

export interface RPCServeInstance {
    get configs(): ConfigInit[]
    get options(): RPCServeOptions
    get apps(): RPCApp[]
    servers: Map<string, RPCServer>
    watcher: FSWatcher | null
    shutdown: () => Promise<void>
    reload(): Promise<void>
}
