import { processReadme } from "./readme";
import { processRepositories } from "./repository";

export const processors = {
  repositories: processRepositories,
  readme: processReadme,
};
