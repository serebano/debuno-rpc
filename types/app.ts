import type { Context } from "./context.ts";
import type { Config, ConfigInit } from "./config.ts";
import type { Router } from "./router.ts";
import type { RPCServer } from "./server.ts";
import type { PromiseWithChild } from "node:child_process";

export type AppState = 'created' | 'started' | 'stopped' | 'updated' | 'errored'

export interface RPCApp {
    readonly $id: string
    readonly state: AppState
    readonly endpoint: string
    readonly dirname: string
    config: Config
    context: Context
    router: Router
    start(server?: RPCServer): Promise<RPCApp>
    stop(): Promise<RPCApp>
    restart(): Promise<RPCApp>
    onError(error: any): Promise<void>
    update(init: ConfigInit): Promise<RPCApp>
    inspect(dev?: boolean): Promise<void>
    edit(): Promise<void>
    exec(file: string, args?: string[]): PromiseWithChild<{ stdout: string; stderr: string; }>

    isRestarting: boolean
}