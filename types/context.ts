import type { RPCServer } from "../server/serve.ts";
import type { SSE } from "../server/sse/types.ts";
import type { App, AppState } from "./app.ts";
import type { Env } from "./env.ts";

export interface Context {
    sse: SSE
    env: Env
    server?: RPCServer
    get apps(): App[]
    get state(): AppState
    start(): Promise<App>
    stop(): Promise<App>
    restart(): Promise<App>
}