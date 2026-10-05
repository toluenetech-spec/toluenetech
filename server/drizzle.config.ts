import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Drizzle Kit uses this for migrations/generate/studio.
    // Set DATABASE_URL in your shell or in a .env file next to this config.
    url: process.env.DATABASE_URL ?? 'postgres://localhost/toluene',
  },
});
