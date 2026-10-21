import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generation at image-build time needs no database credential.
  datasource: { url: process.env.DATABASE_URL },
});
