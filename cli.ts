#!/usr/bin/env -S deno -A
import { parseArgs } from "jsr:@std/cli/parse-args";
import { loadRC, start } from "./server/start.ts";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));
const command = args._[0];

console.group(`[rpc][${command}]`)
console.log(`cwd: ${process.cwd()}`)

switch (command) {
    case "start":
        try {
            await start()
        } catch (e: any) {
            console.log(e.message)
        }
        break;
    case "config":
        try {
            await loadRC().then(console.log)
        } catch (e: any) {
            console.log(e.message)
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

console.groupEnd()