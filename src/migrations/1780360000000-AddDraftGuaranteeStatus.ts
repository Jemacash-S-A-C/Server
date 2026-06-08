import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDraftGuaranteeStatus1780360000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL 9.6+ supports IF NOT EXISTS for ADD VALUE
        await queryRunner.query(`ALTER TYPE "guarantees_status_enum" ADD VALUE IF NOT EXISTS 'draft'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support removing enum values without recreating the type.
        // In production, leave the value in place — it is simply never assigned again.
    }

}
