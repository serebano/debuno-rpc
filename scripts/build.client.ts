import * as esbuild from "npm:esbuild@0.25.1";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11.1";

const context = await esbuild.context({
    plugins: [...denoPlugins()],
    entryPoints: [
        "./client/hot.ts",
        "./client/rpc.ts",
        "./client/env.ts"
    ],
    outdir: "./dist/client",
    bundle: true,
    format: "esm",
    sourcemap: 'inline'
});

context.watch()
// context.cancel();