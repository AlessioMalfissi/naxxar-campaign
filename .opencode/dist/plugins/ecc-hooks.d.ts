/**
 * ECC Plugin Hooks for OpenCode (V2 plugin API, V1-compatible factory surface)
 *
 * Migrated from the OpenCode V1 plugin format for OpenCode 2.x.
 * V1 plugins default-exported an async function that returned a map of
 * string-keyed hooks; V2 requires a default-exported definition object with
 * an `id` and a `setup(ctx)` function, and hooks are registered on their
 * owning domain instead of being returned by key.
 *
 * ## Active Plugin: ECC v2.2.3
 * (kept in sync with package.json — enforced by tests/plugin-manifest.test.js)
 *
 * This module intentionally exposes BOTH surfaces:
 * - `ECCHooksPlugin` (named): the retained V1 factory used by behavioral
 *   tests and explicit migration callers. The default module is V2-only:
 *   OpenCode 1.x's function-only module loader cannot load this entry.
 * - default export: the V2 definition `{ id, setup(ctx) }` that OpenCode 2.x
 *   actually loads. `setup` builds the same runtime once and adapts its hook
 *   map onto the V2 domains.
 *
 * Hook Event Mapping (V1 key -> V2 registration):
 * - tool.execute.before        -> ctx.tool.hook("execute.before")
 * - tool.execute.after         -> ctx.tool.hook("execute.after")
 *   (V2 tool id `shell` is matched as V1 `bash`)
 * - file.edited                -> completed write/edit in execute.after
 *                                 (V2 publishes no file.edited event)
 * - file.watcher / session.* / todo.updated
 *                              -> ctx.event.subscribe() filtered by type
 * - shell.env                  -> ctx.shell.hook("create.before")
 * - experimental.session.compacting -> ctx.session.hook("compaction")
 * - permission.ask             -> ctx.permission.hook("evaluate")
 * - tool record                -> ctx.tool.transform(editor => editor.add)
 *
 * The Bun `$` shell helper is not part of the V2 context, so every command
 * here runs through `child_process.spawn` instead, and the console.log audit
 * uses `fs` + regex rather than `grep` so it works on Windows too. The `$`
 * parameter is still accepted by the factory for V1 call-signature parity,
 * but is never invoked (asserted by tests/opencode-plugin-hooks.test.js).
 */
/**
 * V1 factory surface. OpenCode 1.x (and ECC's own discovery tests) call this
 * with { client, $, directory, worktree } and receive the keyed hook map.
 * OpenCode 2.x never calls it — it loads the default-exported V2 definition
 * below, whose setup() builds this very runtime.
 *
 * `input.$` is accepted for signature parity and deliberately unused: V2 has
 * no Bun shell, and spawning through `$` broke on Windows.
 */
export declare const ECCHooksPlugin: (input: {
    client: any;
    $?: any;
    directory?: string;
    worktree?: string;
}) => Promise<Record<string, unknown>>;
export declare const ECCHooksPluginDefinition: {
    id: string;
    setup(ctx: any): Promise<() => void>;
};
export default ECCHooksPluginDefinition;
//# sourceMappingURL=ecc-hooks.d.ts.map