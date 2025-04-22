import { serve } from "./serve.ts";
import * as colors from "../utils/colors.ts";
import { extendConsole } from "../utils/console.ts";

const console = extendConsole('serve:start', { showNS: false })

export function start(rcFilePath?: string) {
    return serve(rcFilePath, {
        onServerStateChanged(server) {
            if (['listening', 'closed'].includes(server.state))
                console.log(`${colors.cyan(`[${server.$id}]`)}`, colors.gray('(server)'), colors.magenta(server.state))
        },
        onAppStateChanged(app) {
            if (app.state === 'started')
                console.log(`${colors.cyan(`[${app.config.server.$id}]`)}${colors.white(`[${app.config.server.base}]`)}`, colors.gray('(app)'), colors.green(app.state), app.config.server.endpoint)
            if (app.state === 'stopped')
                console.log(`${colors.gray(`[${app.config.server.$id}]`)}${colors.white(`[${app.config.server.base}]`)}`, colors.gray('(app)'), colors.yellow(app.state))

            if (app.state === 'updated')
                console.log(`${colors.yellow(`[${app.config.server.$id}]`)}${colors.white(`[${app.config.server.base}]`)}`, colors.gray('(app)'), colors.green(app.state), app.config.server.path)

        }
    });
}
