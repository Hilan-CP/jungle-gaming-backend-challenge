import { defineConfig, PostgreSqlDriver } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";

export default defineConfig({
    driver: PostgreSqlDriver,
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    dbName: process.env.DB_NAME || "wager_db",
    entities: ["./dist/entity/*.js", "./dist/entity/**/*.js"],
    entitiesTs: ["./src/entity/*.ts", "./src/entity/**/*.ts"],
    extensions: [Migrator],
    migrations: {
        path: "./src/migrations",
        pathTs: "./src/migrations",
        emit: "ts"
    },
    debug: process.env.NODE_ENV !== "production"
});
