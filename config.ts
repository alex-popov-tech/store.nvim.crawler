import { cleanEnv, str, bool } from "envalid";

const env = cleanEnv(process.env, {
  AUTH_TOKEN: str(),
  OUTPUT_FILENAME: str({ default: "crawler_results.json" }),
  UPDATE_FS: bool({ default: true }),
  UPDATE_GIST: bool({ default: false }),
  GIST_ID: str({ default: "" }),
});

export const config = env;
