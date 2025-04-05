#!/usr/bin/env -S deno -A
import { parseArgs } from "jsr:@std/cli/parse-args";
import { start } from "./server/start.ts";
import process from "node:process";
import { loadRC } from "./server/config.ts";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const command = args._.shift() as string;
const rcFileArg = args._.length > 0
    ? args._[args._.length - 1] as string
    : undefined
const isRCFile = rcFileArg && (rcFileArg?.endsWith('.json') || rcFileArg?.endsWith('.js') || rcFileArg?.endsWith('.ts'));
const rcFilePath = isRCFile
    ? path.resolve(process.cwd(), rcFileArg)
    : undefined

console.group(`[rpc][${command}]`, { isRCFile, rcFilePath: rcFileArg })
console.log(`cwd: ${process.cwd()}`)
console.log(`cfg: ${rcFileArg}`)
console.log(`rcFilePath: ${rcFilePath}`)



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
            await loadRC(rcFilePath)
                .then(rc => rc.reduce((acc, { server }) => {
                    acc[`${server.url}`] = server.path
                    return acc
                }, {} as Record<string, string>))
                .then(console.log)
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