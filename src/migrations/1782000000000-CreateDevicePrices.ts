import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDevicePrices1782000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Idempotent: in dev `synchronize` may have already created the table.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "device_prices" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "cache_key" character varying(300) NOT NULL,
                "min_pen" numeric(12,2) NOT NULL,
                "max_pen" numeric(12,2) NOT NULL,
                "avg_pen" numeric(12,2) NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_device_prices" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_device_prices_cache_key" ON "device_prices" ("cache_key")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_device_prices_cache_key"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "device_prices"`);
    }

}
