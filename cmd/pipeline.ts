#!/usr/bin/env tsx

import { runPipeline } from "~/pipeline";
import { createLogger } from "~/logger";

const logger = createLogger({ context: "pipeline-cmd" });

async function main() {
  try {
    await runPipeline();
  } catch (error) {
    logger.error(`💥 Pipeline execution failed: ${error}`);
    console.error(error);
    process.exit(1);
  }
}

// Execute the pipeline
main();
