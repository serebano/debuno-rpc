// #!/usr/bin/env debuno deno --watch

import { serve } from "file:///Users/serebano/dev/debuno-serve/mod.ts";
import { handler, onListen, onAbort } from "./mod.ts";
import process from "node:process";
import config from "./server/config.ts";

const controller = new AbortController()
const serverAddr: { url: URL, hostname: string, port: number } = {} as any

await serve({
    fetch: handler,
    port: config.port,
    signal: controller.signal,
    async onListen(addr) {
        Object.assign(serverAddr, addr)
        await onListen(addr)
    }
});

process.on('SIGINT', async () => {
    console.log("Caught SIGINT, shutting down...");
    await onAbort(serverAddr)
    controller.abort(); // Gracefully shut down server
    process.exit(0)
})