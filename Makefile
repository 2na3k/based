.PHONY: dev web typecheck build install start

install:
	bun install

web:
	bun run dev

dev:
	bun run dev

start:
	bun run start

typecheck:
	bun run typecheck

build:
	bun run build

kill:
	lsof -ti:3000 | xargs kill -9 2>/dev/null; echo "done"
