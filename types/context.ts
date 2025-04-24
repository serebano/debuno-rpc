import type { RPCServer } from "../server/serve.ts";
import type { SSE } from "../server/sse/types.ts";
import type { App, AppState } from "./app.ts";
import type { Env } from "./env.ts";

export interface Context {
    sse: SSE
    env: Env
    server?: RPCServer
    get files(): import("../server/sse/types.ts").File[]
    get importMap(): Record<string, string>
    get importMapFile(): string

    getFiles(force?: boolean): Promise<import("../server/sse/types.ts").File[]>
    getImportMap(force?: boolean): Promise<Record<string, string>>
    get apps(): App[]
    get state(): AppState
    start(): Promise<App>
    stop(): Promise<App>
    restart(): Promise<App>
}