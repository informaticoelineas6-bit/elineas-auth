import type { auth } from "../lib/auth.js";

export type SessionResult = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type AppEnv = {
  Variables: {
    user: SessionResult["user"];
    session: SessionResult["session"];
  };
};
