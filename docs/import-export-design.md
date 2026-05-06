# Import/Export System Design

## Status
Planned -- targeting post-v0.5.1

## Module Resolution
- File-relative paths only: `import { x } from "./path/to/module.kova"`
- No bare specifiers (no stdlib-style imports yet)
- Paths resolve relative to the importing file's directory

## What Can Be Exported
- `fn` declarations
- `let` variable declarations
- `const` is not exportable yet

## Circular Import Handling
- Detected via a loading set tracked at runtime
- Throws `RuntimeError` with a clear message identifying the cycle

## Caching
- Each resolved module path is cached after first load
- Re-imports of the same path return the cached export map

