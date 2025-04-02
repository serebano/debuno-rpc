import { createRoute } from "../../utils/router.ts";
import distRoute from "./distRoute.ts";
import genRoute from "./genRoute.ts";

export default createRoute((config, context) => config.dev
    ? genRoute(config, context)
    : distRoute(config, context))