---
name: typescript
description: Typescript rules for the project Applies to files matching: *.tsx,*.ts.
---

## Typing Guidelines

- Avoid `any` at all cost. The types should work or they indicate a problem.
- Never use `as "any"` or `as unknown as` to solve/avoid type errors. The types should work or they indicate a problem.
- Avoid using `as` to cast to a specific type. The types should work or they indicate a problem.

## Exports / Imports

- Never create index barrel files (index.ts, index.js)
- Always use direct imports with named exports
- Always use inline interfaces with function parameters

## Examples

### Good - Inline interface with function:

```typescript
export function processData({
  id,
  name,
  options,
}: {
  id: string;
  name: string;
  options: ProcessingOptions;
}): ProcessedResult {
  // implementation
}
```

### Bad - Separated interface:

```typescript
interface ProcessDataProps {
  id: string;
  name: string;
  options: ProcessingOptions;
}

export function processDAta({
  id,
  name,
  options,
}: ProcessDataProps): ProcessResult {
  // Implementation
}
```
