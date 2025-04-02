#!/usr/bin/env -S deno -A
import { parseArgs } from "jsr:@std/cli/parse-args";
import { start } from "./server/start.ts";

const args = parseArgs(process.argv.slice(2));
const command = args._[0];


switch (command) {
    case "start":
        console.group(`[rpc][start]`)

        console.log(`Starting rpc server at ${process.cwd()}`);
        try {
            await start()
            console.groupEnd()
        } catch (e: any) {
            console.log(e.message)
            console.groupEnd()
        }
        break;
    case "sum": {
        const numbers = args._.slice(1).map(Number);
        console.log(`Sum: ${numbers.reduce((a, b) => a + b, 0)}`);
        break;
    }
    default:
        console.log("Usage: cli.ts [command] [options]");
        console.log("Commands:");
        console.log("  start");
        console.log("  sum NUM1 NUM2 ...");
}
