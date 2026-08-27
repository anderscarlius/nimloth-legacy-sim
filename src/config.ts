export interface SimConfig {
  port: number;
  db: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

export function loadConfig(): SimConfig {
  return {
    port: Number(process.env.PORT ?? 11601),
    db: {
      host: process.env.PGHOST ?? "localhost",
      port: Number(process.env.PGPORT ?? 5433),
      database: process.env.PGDATABASE ?? "legacy_sim",
      user: process.env.PGUSER ?? "legacy_sim",
      password: process.env.PGPASSWORD ?? "legacy_sim",
    },
  };
}
