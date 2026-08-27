import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Alla testfiler delar samma fysiska Postgres och TRUNCATE:ar tabellen
    // i beforeEach — parallella filer skulle kunna trunkera varandras rader
    // mitt i en pågående test. En liten svit, ingen kostnad av att köra
    // filerna sekventiellt.
    fileParallelism: false,
  },
});
