import type { Config } from "../../types/config.ts";
import distRoute from "./distRoute.ts";
import genRoute from "./genRoute.ts";

export default (config: Config) => config.dev
    ? genRoute(config)
    : distRoute(config)