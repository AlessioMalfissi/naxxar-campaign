import type { LooseRecord } from "./ecc-runtime-support.ts";
/** The shared runtime: every hook body lives here exactly once. */
interface EccRuntime {
    /** V1-shaped hook map (also used by the V2 adapters below). */
    hooks: Record<string, any>;
    /** V1-shaped custom tool record. */
    tool: Record<string, unknown>;
    /** ECC context block preserved through compaction (V2 registration uses it). */
    buildCompactionContext: () => string;
    /** The project directory this runtime was built for. */
    worktreePath: string;
}
export declare function createEccRuntime(input: {
    client?: {
        app?: {
            log?: (event: {
                body: LooseRecord;
            }) => unknown;
        };
    };
    $?: unknown;
    directory?: string;
    worktree?: string;
}, pluginDir: string): Promise<EccRuntime>;
export {};
//# sourceMappingURL=ecc-runtime.d.ts.map