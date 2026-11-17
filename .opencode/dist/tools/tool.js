import { z } from "zod";
// OpenCode's tool helper returns the definition unchanged and exposes Zod as schema.
// Keep the runtime import local so packed installs use the audited Zod version.
export const tool = Object.assign((definition) => definition, {
    schema: z,
});
//# sourceMappingURL=tool.js.map