# `AGENTS.md`

## General rule

- Always call me my liege

## Design guide

- Strictly follow the styling defined in the css file. Only edit the style if the user allow.
- If you have any designing tasks, design that with a simple hierarchy, don't over complicated. A workflow should be lower than 3 level of hierarchy.
- Design reusable assets that could be applied to other similar ones.

## Typescript rule

- Strictly no use for `any` types.
- Strictly follow functional programming style: reduce the mutation for the function.

## Testing rule

- ALWAYS using Playwright MCP to test for the feature on browser before return the result to user. If you saw user already open a port to test then just use that.
