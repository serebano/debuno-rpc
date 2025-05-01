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
import * as  colors from "./utils/colors.ts";
import { atomicWriteJSON, readJSON } from "./utils/json.ts";

const console = extendConsole('cli', { showNS: false, colors: { info: 'white', debug: 'white' } })
// console.clear()

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
const rcDir = rcFileArgs?.length === 1 && rcFileNames?.length === 0 ? rcFileArgs.at(0) : undefined
// console.log(`rcDir`, { rcFileArgs, rcFileNames, rcDir, cwd: cwd() })

const options = {
    "--debug": {
        type: "boolean",
        description: "Enable debug mode",
        default: false,
    },
}
let inspectDev = args.idev || args["--idev"] || false
// const argsRc = args.rc || args.r || args["--rc"] || false
// console.log({ args })
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
    clean: {
        description: "Clean the RPC cache",
        options: {},
    },
    help: {
        description: "Show help",
        options: {
            "--rc": {
                type: "string",
                description: "Path to the RPC config file",
            },
        },
    }
}

const RPC_MOD_DIR = import.meta.url.endsWith('.js')
    ? path.resolve(import.meta.dirname!, "../../")
    : import.meta.dirname!

const CREATE_TEMPLATES = {
    "basic": {
        name: "basic",
        description: "Basic RPC App",
        src: path.join(RPC_MOD_DIR, "templates/basic")
    },
}

async function create(endpoint: string, dirname: string, opts?: { force: boolean }) {
    console.debug(`creating: ${endpoint} => ${dirname}`)
    if (!dirname)
        throw new Error("Path is required")

    const force = opts?.force || false
    const resolvedRpcDir = path.resolve(dirname)

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

    const denoConfigMod = {
        "rpc": { [endpoint]: "." },
        "imports": {
            "@debuno/rpc/client": path.resolve(RPC_MOD_DIR, 'client.d.ts'),
            "@debuno/rpc": path.resolve(RPC_MOD_DIR, 'index.ts')
        }
    }
    const denoConfigPath = path.join(resolvedRpcDir, 'deno.json')
    const denoConfig = await readJSON(denoConfigPath)
    await atomicWriteJSON(denoConfigPath, {
        ...denoConfig,
        rpc: denoConfigMod.rpc,
        imports: {
            ...denoConfig.imports,
            ...denoConfigMod.imports
        }
    })

    console.debug(`${CREATE_TEMPLATES.basic.description} created: ${resolvedRpcDir} (${CREATE_TEMPLATES.basic.src})`)

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


type SIdxs = number[]
type SKeys = "x" | "i" | "e" | "c" | "u" | "r" | "s" | "h" //keyof SMaps


function shortcutsListener() {
    process.stdin.on('data', async data => {
        const value = data.toString('utf8', 0, 2).trim()
        if (value === 'id') {
            if (inspectDev === false) {
                inspectDev = true
                console.log(`Enabled inspector dev`)
            } else {
                inspectDev = false
                console.log(`Disabled inspector dev`)
            }
            return
        }
        const input = value.split('') as unknown as [cmd?: string, idx?: number]

        let [key, idx] = input as [key?: SKeys, idx?: number]

        key = key || 'h'
        idx = Number(idx || 0)

        const { desc, hints, showHelp, valid } = initCmds(input, key, idx)

        console.group((`${colors.brightMagenta(`[${hints[key]}]`)} ${desc[key] ? gray((desc[key])) : ''}`))

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

        // let last$s = 'start' as 'start' | 'stop'
        await runCmd(input, key, idx)

        console.groupEnd()
    })


}

function initCmds(input: [cmd?: string | undefined, idx?: number | undefined], key: SKeys, idx: number) {
    type SMaps = typeof shortcuts
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

    return { valid, shortcuts, desc, hints, showHelp }
}

async function runCmd(input: [cmd?: string | undefined, idx?: number | undefined], key: SKeys, idx: number, log?: boolean) {
    const { showHelp, hints, desc } = initCmds(input, key, idx)
    if (log)
        console.group((`${colors.brightMagenta(`[${hints[key]}]`)} ${desc[key] ? gray((desc[key])) : ''}`))

    async function _run() {
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
                if (input.length === 1)
                    if (instance)
                        await instance?.shutdown()
                    else
                        (instance = await start(rcDir || rcFileNames?.at(0)))
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
    }

    await _run()

    if (log)
        console.groupEnd()
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
            const endpoint = String(args._[0]) as string
            const dirname = String(args._[1]) as string

            const opts = {
                force: args.force || args.f || false
            }
            const rpcDir = await create(endpoint, dirname, opts)
            const relativeDir = path.relative(process.cwd(), rpcDir)
            console.group()
            console.log()
            console.log(`${colors.brightCyan(endpoint)} => ${brightWhite(dirname)}`)
            console.log(`${BIN} start ${relativeDir}`)
            console.log()
            console.groupEnd()

            if (args.s) {
                try {
                    instance = await start(dirname)
                    shortcutsListener()
                    if (args.i) {
                        await runCmd(['i'], 'i', 0, true)
                    }
                    if (args.c) {
                        await runCmd(['c'], 'c', 0, true)
                    }
                } catch (e: any) {
                    console.error(e)
                }
            }

        } catch (e: any) {
            console.error(e)
        }
        break;
    case "start":
        try {
            instance = await start(rcDir || rcFileNames?.at(0))
            shortcutsListener()
        } catch (e: any) {
            console.error(e)
        }
        break;
    case "config":
        try {
            const rc = await loadRC(rcDir || rcFileNames);
            const map = rc.reduce((acc, { server }) => {
                // acc[`${server.$addr}`] = server.endpoint
                acc[`${server.endpoint}`] = server.path
                return acc
            }, {} as Record<string, any>)
            console.log(map)
        } catch (e: any) {
            console.error(e.message)
        }
        break;
    default:
        console.group(`${blue(pkg.displayName)}/${gray(VERSION)} ${navigator.userAgent} ${gray(`(${RPC_MOD_DIR})`)}`)
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
        console.log(`  ${BIN} start [rpc.json|deno.json|dirname]`);
        console.log(`  ${BIN} config [rpc.json|deno.json|dirname]`);
        console.log(`  ${BIN} create [endpoint] [dirname]`);

        console.groupEnd()

        console.groupEnd()
        console.log()
        break;
}

console.groupEnd()