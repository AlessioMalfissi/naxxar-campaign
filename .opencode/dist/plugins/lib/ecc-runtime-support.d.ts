export type HookProfile = "minimal" | "standard" | "strict";
/** Loose aliases: the runtime ctx/event shapes come from the server, not the pinned SDK. */
export type LooseRecord = Record<string, any>;
export interface ToolArgs {
    filePath?: string;
    file_path?: string;
    path?: string;
    command?: string;
    [key: string]: unknown;
}
export interface ToolInput {
    tool: string;
    callID?: string;
    args?: ToolArgs;
}
export interface PermissionEvent {
    tool: string;
    args: unknown;
}
/**
 * Artifacts that identify an ECC root, one per capability this plugin needs.
 *
 * These are required runtime files, never optional content: `skills/` belongs to
 * the optional `workflow-quality` module, so probing for a skill rejected
 * supported modular installs (e.g. `platform-configs` + `hooks-runtime` without
 * `workflow-quality`) that still ship both the plugin and the tracker — silently
 * disabling skill telemetry and the shell root export for those users.
 *
 * Each probe is the exact artifact the caller is about to use, so detection is
 * layout detection rather than an authenticity control: a directory only
 * qualifies because it contains what we are going to read.
 */
export declare const ECC_ROOT_PROBES: {
    readonly root: readonly [string];
    readonly skillTracker: readonly [string];
    readonly resolver: readonly [string];
};
/**
 * Walk upwards from `startDir` looking for an ancestor that contains every
 * relative path in `probes`.
 *
 * The plugin ships in three layouts — `<root>/plugins` (installed), `<root>/dist/plugins`
 * (compiled) and `<repo>/.opencode/plugins` (repo checkout) — so the number of
 * levels back to the root is not fixed. Probing beats a hardcoded `..`: a wrong
 * root would make every command resolve against a directory that has no scripts.
 *
 * The walk is bounded to 5 levels so it cannot wander into unrelated ancestors.
 *
 * Returns null when no ancestor qualifies, so callers can leave the capability
 * disabled instead of advertising a root that does not hold the artifact.
 */
export declare function findEccRootDir(startDir: string, probes: readonly string[]): string | null;
/**
 * Read the ECC version from package.json.
 *
 * Candidates are tried in order — the resolved ECC root first, then the two
 * plausible parent depths of the plugin — because the layout differs between an
 * installed root (`<root>/plugins`), the compiled bundle (`<root>/dist/plugins`)
 * and a repo checkout (`<repo>/.opencode/plugins`). Falls back to a default if
 * no package.json can be read.
 */
export declare function getECCVersion(eccRootDir: string | null | undefined, pluginDir: string): string;
/** Run a command, resolving with its output regardless of exit code. */
export declare function run(command: string, args: string[], options?: {
    cwd?: string;
    detached?: boolean;
}): Promise<{
    code: number;
    stdout: string;
    stderr: string;
}>;
/** Count console.log occurrences in a file with fs+regex (cross-platform grep replacement). */
export declare function countConsoleLogs(filePath: string): Promise<number>;
/**
 * Resolve a tool module by URL rather than by a literal specifier: tsc only
 * rewrites `.ts` extensions in statically-analyzable specifiers, and the
 * compiled layout ships `.js` while a repo/source install ships `.ts`.
 */
export declare function loadToolModule(name: string, pluginDir: string): Promise<{
    description: string;
    args: any;
    execute: (args: any, context: any) => Promise<unknown>;
}>;
//# sourceMappingURL=ecc-runtime-support.d.ts.map