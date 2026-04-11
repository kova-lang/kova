# lab/

Isolated subsystem experiments. Nothing here goes into `src/` until it is
understood cold.

Each subfolder is a standalone unit: one concept, one runnable file, one README.
No build step, no imports from `src/`. Just Node.

## Layout

```
lab/
  expression/     Pratt parser && Function chain approach folder
```

## Rules for adding a new lab unit

1. One concept per folder.
2. The JS file must be runnable with `node <file>.js` and print observable output.
3. Write the README before you consider the unit done. Explaining it is part of learning it.
4. If the subsystem proves sound, note at the top of the README which `src/` module it targets.

## What belongs here

- Anything you want to understand before committing it to the real compiler
