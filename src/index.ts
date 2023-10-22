import { router } from "./router";
import { putDevelopmentObject } from "./development";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const app = router(env, ctx);

    if (env.ENVIRONMENT === "development") {
      console.log(
        `env.ENVIRONMENT=${env.ENVIRONMENT}, env.SHARD_NAME=${env.SHARD_NAME}`,
      );

      app.put("/put/*", putDevelopmentObject(env));
      app.options("/put/*", putDevelopmentObject(env));
    }

    return app.handle(request);
  },
};
