import type { Context } from "./context.ts";
import type { Config, ConfigInit } from "./config.ts";
import type { Router } from "./router.ts";
import type { RPCServer } from "../server/serve.ts";
import type { ChildProcess, PromiseWithChild } from "node:child_process";

export type AppState = 'created' | 'started' | 'stopped' | 'updated' | 'errored'

export interface App {
    readonly $id: string
    readonly state: AppState
    readonly endpoint: string
    readonly path: string
    config: Config
    context: Context
    router: Router
    start(server?: RPCServer): Promise<App>
    stop(): Promise<App>
    restart(): Promise<App>
    onError(error: any): Promise<void>
    update(init: ConfigInit): Promise<App>
    inspect(dev?: boolean): Promise<void>
    edit(): Promise<void>
    exec(file: string, args?: string[]): PromiseWithChild<{ stdout: string; stderr: string; }>

    isRestarting: boolean
}