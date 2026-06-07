import { MigrationInterface, QueryRunner } from "typeorm";

export class FixSms2faPhoneLength1780277985886 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "sms_2fa_phone" TYPE character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "sms_2fa_phone" TYPE character varying(20)`);
    }

}
