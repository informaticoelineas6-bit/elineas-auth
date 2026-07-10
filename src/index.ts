import { createApp } from "@/app";

const app = createApp();

const server = Bun.serve({
  fetch: app.fetch,
  port: Number(process.env.PORT) || 8080,
});

console.log(`Serving on http://localhost:${server.port}`);
