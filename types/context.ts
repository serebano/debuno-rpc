import type { SSE } from "../server/sse/types.ts";
import type { Env } from "./env.ts";
import type { ServerAddr } from "./server.ts";

export interface Context {
    sse: SSE,
    env: Env,
    addr?: ServerAddr
}