// #!/usr/bin/env deno -A --watch
import { parseArgs } from "jsr:@std/cli/parse-args";
import { start } from "./server/start.ts";
import process from "node:process";
import { loadRC } from "./server/config.ts";
import path from "node:path";
import pkg from "./package.json" with { type: "json" };
import { gray, green, yellow, blue } from "./utils/colors.ts";
import { fileExists } from "./utils/mod.ts";
import { rm } from "node:fs/promises";
import { copyFolder } from "./utils/fs.ts";
import { extendConsole } from "./utils/console.ts";

const console = extendConsole('cli')

const BIN = Object.keys(pkg.bin)[0];
const VERSION = pkg.version

const args = parseArgs(process.argv.slice(2));
const command = args._.shift() as string;
const rcFileArgs = args._.length > 0
    ? args._.filter(a => typeof a === 'string') // args._[args._.length - 1] as string
    : undefined
const rcFileNames = rcFileArgs
    ? rcFileArgs.filter((arg: string) => arg.endsWith('.json') || arg.endsWith('.js') || arg.endsWith('.ts'))
    : undefined


const options = {
    "--debug": {
        type: "boolean",
        description: "Enable debug mode",
        default: false,
    },
}
const argsForce = args.force || args.f || false
const argsRc = args.rc || args.r || args["--rc"] || false

const commands = {
    start: {
        description: "Start the RPC server",
        options: {
            "--rc": {
                type: "string",
                description: "Path to the RPC config file",
            },
        },
    },
    config: {
        description: "Show the RPC config",
        options: {
            "--rc": {
                type: "string",
                description: "Path to the RPC config file",
            },
        },
    },
    create: {
        description: "Create a new RPC App",
        options: {
            "--rc": {
                type: "string",
                description: "Path to the RPC config file",
            },
        },
    },
    help: {
        description: "Show help",
        options: {
            "--rc": {
                type: "string",
                description: "Path to the RPC config file",
            },
        },
    },
    clean: {
        description: "Clean the RPC cache",
        options: {},
    },
}


const CREATE_TEMPLATES = {
    "basic": {
        name: "basic",
        description: "Basic RPC App",
        src: "/Users/serebano/dev/debuno-rpc-templates/basic"
    },
}

async function create(rpcDir: string, opts?: { force: boolean }) {
    console.debug(`create ${rpcDir}`)
    if (!rpcDir)
        throw new Error("Path is required")

    const force = opts?.force || false
    const resolvedRpcDir = path.resolve(rpcDir)

    const pathExists = await fileExists(resolvedRpcDir)
    if (pathExists) {
        if (force) {
            console.debug(`Path already exists: ${resolvedRpcDir}, force create`)
        } else {
            throw new Error(`Path already exists: ${resolvedRpcDir}`)
        }
    }

    await copyFolder(CREATE_TEMPLATES.basic.src, resolvedRpcDir)
    await rm(path.join(resolvedRpcDir, '.rpc'), { recursive: true, force: true })

    console.debug(`${CREATE_TEMPLATES.basic.description} created: ${resolvedRpcDir}`)

    return resolvedRpcDir

}

switch (command) {
    case "clean":
        try {
            console.debug(`Cleaning...`)
            const destDir = args._[0]
                ? path.resolve(args._[0] as string, '.rpc')
                : path.resolve(process.cwd(), '.rpc')
            const exists = await fileExists(destDir)
            if (!exists) {
                console.debug(`Nothing to clean: ${destDir}`)
                break;
            }
            console.debug(`Cleaning: ${destDir}`)
            await rm(destDir, { recursive: true, force: true })
            console.debug(`Cleaned: ${destDir}`)
        } catch (e: any) {
            console.error(e.message)
        }
        break;
    case "create":
        try {
            const destDir = args._[0] as string
            const opts = {
                force: args.force || args.f || false
            }
            const rpcDir = await create(destDir, opts)
            const relativeDir = path.relative(process.cwd(), rpcDir)
            console.group()
            console.log(`Created: ${rpcDir}`)
            console.log(`Run: ${BIN} start ${relativeDir}`)
            console.log(`   or`)
            console.log(`Run: cd ${relativeDir} && ${BIN} start`)
            console.groupEnd()
        } catch (e: any) {
            console.error(e.message)
        }
        break;
    case "start":
        try {
            const instance = await start()

            process.on('SIGINT', async () => {
                try {
                    await instance.shutdown()
                } catch (e: any) {
                    console.error(e)
                }

                process.exit()
            })
        } catch (e: any) {
            console.error(e)
        }
        break;
    case "config":
        try {
            const rc = await loadRC(rcFileNames);
            const map = rc.reduce((acc, { server }) => {
                // acc[`${server.$addr}`] = server.endpoint
                acc[`${server.endpoint}`] = path.resolve(server.path)
                return acc
            }, {} as Record<string, any>)
            console.log(map)
        } catch (e: any) {
            console.error(e.message)
        }
        break;
    default:
        console.group(`${blue(pkg.displayName)} ${gray(VERSION)}`)
        console.log()
        console.log(gray('Usage:'), BIN, gray(`[command] [options] [RC_FILE_ARG]...`));
        console.log()
        // commands
        console.group(yellow("Commands:"));
        Object.entries(commands).forEach(([name, { description }]) => {
            console.log(`  ${green(name)} - ${gray(description)}`);
        });
        console.groupEnd()
        console.log()
        // options
        console.group(yellow("Options:"));
        Object.entries(options).forEach(([name, { description }]) => {
            console.log(`  ${green(name)} - ${gray(description)}`);
        });
        console.groupEnd()
        console.log()
        // arguments
        console.group(yellow(`Arguments:`))
        console.log(`   [RC_FILE_ARG] Config file`)
        console.groupEnd()
        console.log()
        // examples
        console.group(yellow(`Examples:`));
        console.log(`  ${BIN} start ./rpc.json`);
        console.log(`  ${BIN} config ./rpc.json`);
        console.groupEnd()

        console.groupEnd()
        console.log()
        break;
}

console.groupEnd()