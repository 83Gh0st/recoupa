import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Use the WebSocket-based Neon driver rather than the plain-HTTP one. Both
// work on Vercel; this one also works from networks (some corporate
// firewalls/AV) that interfere with plain HTTPS fetch to Neon's query
// endpoint but allow WebSocket traffic through.
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string."
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
export { schema };
