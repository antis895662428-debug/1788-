# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
Includes a Telegram bot for managing profile cards (анкеты) with an anonymous review system.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Telegram bot**: node-telegram-bot-api

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Telegram Bot

The bot is started automatically alongside the Express server in `artifacts/api-server/src/index.ts`.

### Role Hierarchy

- **Main Admin** (`@domlk`): Full access — add/remove profiles, manage staff, all settings
- **Admins/Moderators**: Can moderate comments (delete reviews/comments), cannot manage profiles
- **Visitors**: Can browse catalog, rate profiles, leave anonymous reviews

### Features

- Fully anonymous reviews — `user_id` stored in DB for deduplication but never displayed
- One vote per user per profile, with ability to update
- Rating (1–5 stars) + optional comment
- Moderation panel for deleting comments (keeps rating) or full review deletion
- Staff management (add/remove moderators by Telegram ID)

### Bot Files

- `artifacts/api-server/src/bot/index.ts` — bot entry point
- `artifacts/api-server/src/bot/handlers.ts` — all message/callback handlers
- `artifacts/api-server/src/bot/keyboards.ts` — inline and reply keyboards
- `artifacts/api-server/src/bot/state.ts` — in-memory user state machine
- `artifacts/api-server/src/bot/db.ts` — database access layer for bot

### Database Schema

- `profiles` — profile cards (name, photo file_id)
- `admins` — moderators/admins (telegram_id, username, role)
- `reviews` — reviews (profile_id, user_id, rating, comment, comment_deleted)

### Environment Variables

- `TELEGRAM_BOT_TOKEN` — Telegram bot token from @BotFather
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
