import { createRoute } from "../../utils/router.ts";
import distRoute from "./distRoute.ts";
import genRoute from "./genRoute.ts";

export default createRoute((app) => app.config.dev
    ? genRoute(app)
    : distRoute(app))