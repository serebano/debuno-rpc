// #!/usr/bin/env debuno deno --watch
import { createServer } from "./server/index.ts";
import { getCliArgs } from "./utils/mod.ts";

createServer({
    dev: false,
    server: getCliArgs()
})