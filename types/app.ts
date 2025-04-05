import type { Context } from "vm";
import type { Config } from "./config.ts";
import type { Router } from "./router.ts";
import type { ServerAddr } from "./server.ts";

export interface App {
    config: Config
    context: Context
    router: Router
    onError(error: any): Promise<void>
    onStart(addr: ServerAddr): Promise<void>
    onStop(error?: any): Promise<void>
}