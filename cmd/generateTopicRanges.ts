import * as fs from "fs/promises";
import { searchRepositories } from "../src/sdk/github";
import { config } from "../src/config";
import { createLogger } from "../src/logger";

const logger = createLogger({ context: "topic ranges generator" });

/**
 * Generate half-yearly date ranges from start year to current date
 */
function generateHalfYearlyRanges(
  startYear: number = 2013,
): Array<{ from: Date; to: Date; label: string }> {
  const ranges: Array<{ from: Date; to: Date; label: string }> = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  for (let year = startYear; year <= currentYear; year++) {
    // First half: Jan-Jun (months 0-5)
    const h1From = new Date(year, 0, 1); // Jan 1
    const h1To = new Date(year, 5, 30); // Jun 30

    // Second half: Jul-Dec (months 6-11)
    const h2From = new Date(year, 6, 1); // Jul 1
    const h2To = new Date(year, 11, 31); // Dec 31

    // Add H1 if it's not in the future
    if (h1From <= currentDate) {
      ranges.push({
        from: h1From,
        to: h1To,
        label: `${year}-H1`,
      });
    }

    // Add H2 if it's not in the future and we're past July
    if (h2From <= currentDate && (year < currentYear || currentMonth >= 6)) {
      ranges.push({
        from: h2From,
        to: h2To,
        label: `${year}-H2`,
      });
    }
  }

  return ranges;
}

/**
 * Fetch repository count for a specific topic and date range
 */
async function getTopicRangeCount(
  topic: string,
  dateRange: { from: Date; to: Date; label: string },
): Promise<number> {
  try {
    // Calculate last update cutoff date to match crawler filter
    const lastUpdateCutoff = new Date();
    lastUpdateCutoff.setDate(
      lastUpdateCutoff.getDate() - config.crawler.lastUpdateAllowedInDays,
    );
    
    const result = await searchRepositories(1, 1, {
      topic,
      yearStart: dateRange.from,
      yearEnd: dateRange.to,
      lastUpdateAfter: lastUpdateCutoff,
    });

    if ("error" in result) {
      logger.error(
        `Failed to fetch data for ${topic} ${dateRange.label}: ${result.error}`,
      );
      return 0;
    }

    return result.data.total_count;
  } catch (error) {
    logger.error(`Error fetching ${topic} ${dateRange.label}: ${error}`);
    throw error;
  }
}

/**
 * Main function to generate topic ranges data
 */
async function main() {
  const topics = config.crawler.topics;
  const ranges = generateHalfYearlyRanges(2013);

  const results: Record<string, Record<string, number>> = {};

  for (const topic of topics) {
    results[topic] = {};

    for (const range of ranges) {
      const count = await getTopicRangeCount(topic, range);
      results[topic][range.label] = count;
    }
  }

  // Output as JSON
  console.log(JSON.stringify(results, null, 2));
  fs.writeFile(
    `${config.output.dir}/${config.output.topicRanges}`,
    JSON.stringify(results, null, 2),
  );
}

// Run the script
main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});

