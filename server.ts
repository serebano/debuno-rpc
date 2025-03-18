// #!/usr/bin/env debuno deno --watch
import { defineConfig } from "./config.ts";
import { getCliArgs } from "./utils/mod.ts";
import serve from "./server/server.ts";


const config = defineConfig({
    dev: false,
    server: getCliArgs()
})

serve(config)