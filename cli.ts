#!/usr/bin/env deno -A
import { parseArgs } from "jsr:@std/cli/parse-args";
import { start } from "./server/start.ts";
import process from "node:process";
import { loadRC } from "./server/config.ts";
import path from "node:path";
import pkg from "./package.json" with { type: "json" };
import { gray, green, yellow, blue, magenta, red, bold, white, italic, underline, cyan, brightRed, brightWhite, bgBrightBlack } from "./utils/colors.ts";
import { fileExists } from "./utils/mod.ts";
import { rm } from "node:fs/promises";
import { copyFolder } from "./utils/fs.ts";
import { extendConsole } from "./utils/console.ts";
import type { RPCServeInstance } from "./server/serve.ts";
import { colors } from "jsr:@cliffy/ansi@1.0.0-rc.7/colors";

const console = extendConsole('cli', { showNS: false, colors: { info: 'white', debug: 'white' } })
console.clear()

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
const inspectDev = args.idev || args["--idev"] || false
// const argsRc = args.rc || args.r || args["--rc"] || false

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

let instance: RPCServeInstance | undefined
const shutdown = async () => {
    console.log()
    try {
        await instance?.shutdown()
    } catch (e: any) {
        console.error(e)
    }
    process.exit()
}

process.on('SIGINT', shutdown)

function shortcutsListener() {
    process.stdin.on('data', async data => {
        const value = data.toString('utf8', 0, 2).trim()
        const input = value.split('') as unknown as [cmd?: string, idx?: number]

        let [key, idx] = input as [key?: SKeys, idx?: number]

        key = key || 'h'
        idx = Number(idx || 0)

        type SMaps = typeof shortcuts

        type SIdxs = number[]
        type SKeys = keyof SMaps

        type SHint = { [P in SKeys]: SMaps[P]['hint'] }
        type SDesc = { [P in SKeys]: SMaps[P]['desc'] }
        type SDefs = { [P in SKeys]: { hint: SMaps[P]['hint'], desc: SMaps[P]['desc'] } }


        const valid = {
            get keys(): SKeys {
                return Object.keys(shortcuts) as any
            },
            get idxs(): SIdxs {
                return instance?.apps.map((_, idx) => idx) || []
            }
        } as const

        const shortcuts = {
            get x() {
                return {
                    hint: `e${bold(brightWhite('x'))}it`,
                    get desc() {
                        return `Shutdown all ${yellow(valid.idxs.length.toString())} apps` as const
                    }
                } as const
            },
            get i() {
                return {
                    hint: `${bold(brightWhite('i'))}nspect`,
                    get desc() {
                        return `Inspect app#${yellow(idx.toString())} ${green(instance?.apps.at(idx)?.endpoint ?? '')}`
                    }
                } as const
            },
            get e() {
                return {
                    hint: `${bold(brightWhite('e'))}dit`,
                    get desc() {
                        return `Edit app#${yellow(idx.toString())} ${green(instance?.apps.at(idx)?.endpoint ?? '')} ${gray(instance?.apps.at(idx)?.path ?? '')}`
                    }
                } as const
            },
            get c() {
                return {
                    hint: `${bold(brightWhite('c'))}ode`,
                    get desc() {
                        return `Code app#${yellow(idx.toString())} ${green(instance?.apps.at(idx)?.endpoint ?? '')} ${gray(instance?.apps.at(idx)?.path ?? '')}`
                    }
                } as const
            },
            get u() {
                return {
                    hint: `${bold(brightWhite('u'))}ris`,
                    desc: `Show available uris`
                } as const
            },
            get r() {
                const app = instance?.apps.at(idx)
                const hasIdx = input.length === 2 && app

                return {
                    hint: `${bold(brightWhite('r'))}estart`,
                    get desc() {
                        return hasIdx
                            ? `Restart app[${yellow(idx.toString())}] { ${colors.brightYellow(app.endpoint)}: ${colors.brightGreen(app.path)} }`
                            : `Restart instance (servers & apps)`
                    }
                } as const
            },
            get s() {
                const app = instance?.apps.at(idx)
                const hasIdx = input.length === 2 && app

                return {
                    hint: `${bold(brightWhite('s'))}top`,
                    get desc() {
                        return hasIdx
                            ? `Stop app[${yellow(idx.toString())}] { ${colors.brightYellow(app.endpoint)}: ${colors.brightGreen(app.path)} }`
                            : `Stop instance (servers & apps)`
                    }
                } as const
            },
            get h() {
                return {
                    hint: `${bold(brightWhite('h'))}elp`,
                    desc: `Usage info to help you quick start`
                } as const
            }
        } as const


        const desc = Object.fromEntries(Object.entries(shortcuts).map(([key, val]) => [key, val.desc])) as SDesc
        const hints = Object.fromEntries(Object.entries(shortcuts).map(([key, val]) => [key, val.hint])) as SHint

        function showHelp() {
            console.log(Object.entries(hints).map(([cmd, desc]) => gray(`press ${colors.brightWhite(bold(`${cmd} + enter`))} to ${desc}`)).join('\n'))
        }

        console.group((`$ [${hints[key]}] ${desc[key] ? gray((desc[key])) : ''}`))

        if (!valid.keys.includes(key)) {
            console.warn(italic(`Invalid shortcut key: ${brightRed(key)}`))
            showHelp()
            console.groupEnd()
            return
        }

        if (!valid.idxs.includes(idx)) {
            console.warn(italic(`Invalid app index: ${brightRed(String(idx))}`))
            showHelp()
            console.groupEnd()
            return
        }

        let last$s = 'start' as 'start' | 'stop'
        switch (key) {
            case "x":
                // await shutdown()
                process.exit()
                break
            case "r":
                if (input.length === 1)
                    await instance?.reload()
                else
                    await instance?.apps.at(idx)?.restart()
                break
            case "s": {
                last$s = last$s === 'start' ? 'stop' : 'start'
                if (input.length === 1)
                    if (last$s === 'start')
                        await instance?.shutdown()
                    else (instance = await start())
                else
                    if (instance?.apps.at(idx)?.state === 'started')
                        await instance?.apps.at(idx)?.stop()
                    else
                        await instance?.apps.at(idx)?.start()
                console.log(`state`, instance?.apps.at(idx)?.state)
            }
                break
            case "i":
                await instance?.apps.at(idx)?.inspect(inspectDev)
                break
            case "c": {
                const app = instance?.apps.at(idx)
                if (app)
                    await app.exec('code', [app.path])
            }
                break
            case "e":
                await instance?.apps.at(idx)?.edit()
                break
            case "u":
                console.log(
                    gray(instance?.apps.map((app, idx) => [
                        'index: ' + yellow(idx.toString()),
                        'state: ' + magenta(app.state),
                        'endpoint: ' + green(app.endpoint),
                        'path: ' + cyan(app.path),
                    ]
                        .join('\n'))
                        .join('\n-----------\n') || '')
                )
                break
            default:
                showHelp()
                break
        }

        console.groupEnd()
    })


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
            instance = await start()
            shortcutsListener()
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