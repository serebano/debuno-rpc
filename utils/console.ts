import * as colors from "jsr:@std/fmt@~1.0.2/colors";
import { parseArgs } from "jsr:@std/cli/parse-args";

import process from "node:process";
import { gray } from "./colors.ts";

export type ConsoleColor = 'gray' | 'red' | 'yellow' | 'blue' | 'green' | 'magenta' | 'cyan' | 'white' | 'black'
export type ConsoleLevel = 'info' | 'error' | 'warn' | 'debug'
export type ConsoleLevels = {
    debug: ["debug", "info", "warn", "error"];
    info: ["info", "warn", "error"];
    warn: ["warn", "error"];
    error: ["error"];
}

export const levelsMap: ConsoleLevels = {
    debug: ['debug', 'info', 'warn', 'error'],
    info: ['info', 'warn', 'error'],
    warn: ['warn', 'error'],
    error: ['error']
}
export interface CreateConsoleOptions {
    colors?: {
        info?: ConsoleColor,
        error?: ConsoleColor,
        warn?: ConsoleColor,
        debug?: ConsoleColor,
        group?: ConsoleColor,
    },
    showNS?: boolean,
    showLevel?: boolean,
    level?: ConsoleLevel,
    levels?: ConsoleLevel[],
    console?: Console,
}

function getLevels<L extends ConsoleLevel>(level: L): ConsoleLevels[L] {
    return levelsMap[level] as ConsoleLevels[L]
}

function createNamespaceMatcher(debugEnv: string) {
    const patterns = debugEnv
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(p => ({
            negate: p.startsWith('-'),
            pattern: p.startsWith('-') ? p.slice(1) : p
        }));

    return (namespace: string) => {
        let enabled = false;

        for (const { negate, pattern } of patterns) {
            if (matchPattern(namespace, pattern)) {
                enabled = !negate;
            }
        }

        return enabled;
    };
}

function matchPattern(ns: string, pattern: string): boolean {
    const nsParts = ns.split(':');
    const patParts = pattern.split(':');

    let i = 0, j = 0;

    while (i < patParts.length && j < nsParts.length) {
        if (patParts[i] === '*') {
            if (i === patParts.length - 1) return true;
            while (j < nsParts.length) {
                if (matchPattern(nsParts.slice(j).join(':'), patParts.slice(i + 1).join(':')))
                    return true;
                j++;
            }
            return false;
        }

        if (patParts[i] !== nsParts[j]) return false;

        i++;
        j++;
    }

    while (i < patParts.length && patParts[i] === '*') i++;

    return i === patParts.length && j === nsParts.length;
}

export interface XConsole extends Console {
    level: ConsoleLevel | undefined;
    levels: ConsoleLevel[];
    namespace: string | null;
    colors: {
        info?: ConsoleColor;
        error?: ConsoleColor;
        warn?: ConsoleColor;
        debug?: ConsoleColor;
        group?: ConsoleColor;
    };
    $console: Console;
    create(namespace: string, options?: CreateConsoleOptions): XConsole;
    extend(namespace: string, options?: CreateConsoleOptions): XConsole;
}

export function createConsole(
    namespace: string,
    opts: CreateConsoleOptions = {}
): XConsole {
    opts = opts || {}
    // opts.showNS = opts.showNS || true
    opts.console = opts.console || globalThis.console;
    opts.colors = Object.assign({
        info: 'gray',
        error: 'red',
        warn: 'yellow',
        debug: 'blue',
        group: 'cyan',
    }, opts.colors);

    const levelColors = {
        info: (s: any) => typeof s === 'string' ? colors[opts.colors?.info || 'gray'](s) : s,
        error: (s: any) => typeof s === 'string' ? colors[opts.colors?.error || 'red'](s) : s,
        warn: (s: any) => typeof s === 'string' ? colors[opts.colors?.warn || 'yellow'](s) : s,
        debug: (s: any) => typeof s === 'string' ? colors[opts.colors?.debug || 'blue'](s) : s,
        group: (s: any) => typeof s === 'string' ? colors[opts.colors?.group || 'cyan'](s) : s,
    };

    function isDebugEnabled(value?: string): boolean {
        value = value ? String(value) : value;
        if (!value || value === '0' || value === 'false')
            return false;
        return true
    }


    function parseDebugValue(value?: string) {
        if (value === '1' || value === 'true')
            return '*'
        return value
    }

    const args = parseArgs(process.argv.slice(2));
    const debug = args.debug || args.d || args["--debug"] || false
    if (debug)
        process.env.DEBUG = debug

    const DEBUG_ENABLED = isDebugEnabled(process.env.DEBUG)
    const DEBUG_VALUE = parseDebugValue(process.env.DEBUG)

    const matcher = createNamespaceMatcher(DEBUG_VALUE ?? '')
    const DEBUG_NS_ENABLED = matcher(namespace)


    if (!opts.level && DEBUG_ENABLED) {
        opts.level = 'debug'
    }
    opts.level = opts.level || 'info'

    opts.levels = opts.level ? getLevels(opts.level) : opts.levels || []

    const level = opts.level
    const levels = opts.levels
    const $console = opts.console

    const enabled = (level: ConsoleLevel) => {
        if (levels.includes(level) && DEBUG_NS_ENABLED)
            return true
        return false
    }

    // $console.log('createConsole', { namespace, level, levels, DEBUG_ENABLED, DEBUG_NS_ENABLED, DEBUG_VALUE })

    function call(level: ConsoleLevel, ...args: any[]) {
        if (level === 'debug' && !enabled(level)) return;
        if (opts.showNS && args.length) args.unshift(gray(`[${namespace}]`))
        if (opts.showLevel && args.length) args.unshift(gray(`[${level}]`))

        $console[level].call($console, ...args.map(levelColors[level]));
    }

    return {
        level: opts.level,
        levels,
        namespace,
        colors: opts.colors,
        $console,
        create(namespace: string, options?: CreateConsoleOptions) {
            return createConsole(namespace, { ...opts, ...options })
        },
        extend(ns: string, options?: CreateConsoleOptions) {
            return createConsole([namespace, ns].join(':'), { ...opts, ...options })
        },
        debug(...args: any[]): void {
            call('debug', ...args);
        },
        info(...args: any[]): void {
            call('info', ...args)
        },
        error(...args: any[]): void {
            call('error', ...args)
        },
        warn(...args: any[]): void {
            call('warn', ...args)
        },
        log(...args: any[]): void {
            call('info', ...args)
        },
        group(...args: any[]) {
            if (!levels.length) return;
            args.length
                ? $console.group(...args.map(levelColors.group))
                : $console.group();
        },
        groupCollapsed(...args: any[]) {
            if (!levels.length) return;
            args.length
                ? $console.groupCollapsed(...args.map(levelColors.group))
                : $console.groupCollapsed();
        },
        groupEnd() {
            if (!levels.length) return;
            $console.groupEnd();
        },
        time: $console.time.bind($console),
        timeEnd: $console.timeEnd.bind($console),
        timeLog: $console.timeLog.bind($console),
        timeStamp: $console.timeStamp.bind($console),
        assert: $console.assert.bind($console),
        clear: $console.clear.bind($console),
        trace: $console.trace.bind($console),
        table: $console.table.bind($console),
        count: $console.count.bind($console),
        countReset: $console.countReset.bind($console),
        dir: $console.dir.bind($console),
        dirxml: $console.dirxml.bind($console),
        profile: $console.profile.bind($console),
        profileEnd: $console.profileEnd.bind($console),
    }
}

export function installConsole(ns: string, opts: CreateConsoleOptions = {}): XConsole {
    const prevConsole = globalThis.console as any;
    if (prevConsole && 'namespace' in prevConsole)
        return prevConsole;

    // @ts-ignore .
    globalThis.$console = prevConsole

    const console = createConsole(ns, {
        // level: RPC_DEBUG_LEVEL,
        ...opts,
        console: globalThis.console
    });


    globalThis.console = console;

    return console
}

const mainConsole = installConsole('rpc', {
    showNS: true,
    showLevel: false
})

export default mainConsole

export const extendConsole = mainConsole.extend