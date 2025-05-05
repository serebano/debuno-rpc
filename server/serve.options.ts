import type { RPCServeOptions } from "../types/server.ts";
import { colors } from "../utils/colors.ts";
import { extendConsole } from "../utils/console.ts";

const console = extendConsole('serve', { showNS: false })

export default {
    onServerStateChanged(server) {
        if (server.state === 'listening')
            console.log(colors.gray('(srv)'), colors.brightBlue('started'), `${colors.green(`[${server.$id}]`)}`)
        if (server.state === 'closed')
            console.log(colors.gray('(srv)'), colors.brightYellow('stopped'), `${colors.gray(`[${server.$id}]`)}`)
    },
    onAppStateChanged(app) {
        if (app.state === 'started')
            console.log(colors.brightWhite('(app)'), colors.brightBlue(app.state), `${colors.green(`[${app.config.server.$id}]`)}${colors.white(`[${app.config.server.base}]`)}`, '{', colors.brightWhite('endpoint:'), app.endpoint, colors.brightWhite('dirname:'), app.dirname, '}')
        if (app.state === 'stopped')
            console.log(colors.brightWhite('(app)'), colors.brightYellow(app.state), `${colors.gray(`[${app.config.server.$id}]`)}${colors.white(`[${app.config.server.base}]`)}`)
        if (app.state === 'updated')
            console.log(colors.brightWhite('(app)'), colors.brightGreen(app.state), `${colors.yellow(`[${app.config.server.$id}]`)}${colors.white(`[${app.config.server.base}]`)}`, app.config.server.dirname)

    }
} satisfies RPCServeOptions