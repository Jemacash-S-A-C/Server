import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Full base schema. Generated from the entities so a clean production database
 * (migrationsRun) gets every table/enum/FK. In development `synchronize` builds
 * the schema instead, so this migration only runs in production.
 */
export class Baseline1780191585886 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "full_name" character varying(200) NOT NULL, "email" character varying(254) NOT NULL, "password_hash" character varying, "phone" character varying(20), "google_id" character varying(100), "totp_secret" character varying(64), "totp_enabled" boolean NOT NULL DEFAULT false, "sms_2fa_phone" character varying(255), "sms_2fa_enabled" boolean NOT NULL DEFAULT false, "sms_otp_hash" character varying(64), "sms_otp_expires_at" TIMESTAMP WITH TIME ZONE, "notification_email" boolean NOT NULL DEFAULT true, "pref_currency" character varying(10) NOT NULL DEFAULT 'pen', "pref_language" character varying(10) NOT NULL DEFAULT 'es', "pref_timezone" character varying(50) NOT NULL DEFAULT 'lima', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_0bd5012aeb82628e07f6a1be53b" UNIQUE ("google_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."guarantees_status_enum" AS ENUM('draft', 'pending_evaluation', 'active', 'pledged', 'released', 'seized')`);
        await queryRunner.query(`CREATE TABLE "guarantees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" character varying(100) NOT NULL, "name" character varying(200) NOT NULL, "description" text, "estimated_value" numeric(12,2) NOT NULL, "status" "public"."guarantees_status_enum" NOT NULL DEFAULT 'pending_evaluation', "device_category" character varying(50), "brand" character varying(100), "model" character varying(200), "manufacture_year" character varying(4), "serial_number" character varying(100), "condition" character varying(20), "specs" jsonb, "photo_urls" jsonb, "ai_market_value" numeric(12,2), "ai_resale_value" numeric(12,2), "ai_max_loan" numeric(12,2), "ai_condition_score" numeric(4,2), "ai_depreciation_factors" jsonb, "ai_confidence" numeric(3,2), "ai_reasoning" text, "ai_visual_condition" character varying(20), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0952d3cdbdaa3d2a5d2089ceed3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."loan_applications_status_enum" AS ENUM('draft', 'submitted', 'signed', 'approved', 'disbursed', 'defaulted', 'cancelled', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "loan_applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "guarantee_id" uuid, "amount" numeric(12,2) NOT NULL, "term_months" integer NOT NULL, "status" "public"."loan_applications_status_enum" NOT NULL DEFAULT 'draft', "disbursed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a40270ea2f2b1fbc185b0f5684a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."evaluations_status_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "evaluations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "status" "public"."evaluations_status_enum" NOT NULL DEFAULT 'pending', "approved_amount" numeric(12,2), "risk_score" numeric(5,2), "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_42613ea05dd223da68e45d77ed" UNIQUE ("application_id"), CONSTRAINT "PK_f683b433eba0e6dae7e19b29e29" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "signatures" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "signature_base64" text NOT NULL, "document_urls" json, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_643ddc170bb4bb5c9440ec5dc6" UNIQUE ("application_id"), CONSTRAINT "PK_f56eb3cd344ce7f9ae28ce814eb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."payments_payment_method_enum" AS ENUM('bcp', 'bbva', 'yape', 'plin', 'efectivo', 'mercadopago')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('completed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "application_id" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "payment_method" "public"."payments_payment_method_enum" NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'completed', "cuota_number" integer NOT NULL, "reference_number" character varying(32) NOT NULL, "mp_payment_id" character varying(64), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c6269f7102a646b1d242205641d" UNIQUE ("reference_number"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "mp_pending_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" character varying NOT NULL, "application_id" character varying NOT NULL, "cuota_number" integer NOT NULL, "preference_id" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_093ff18dda8e8ce8c7ce766c76b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."loan_documents_document_type_enum" AS ENUM('dni', 'passport', 'pay_stub', 'utility_bill', 'soat', 'vehicle_card', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."loan_documents_status_enum" AS ENUM('pending', 'reviewing', 'verified', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "loan_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" character varying NOT NULL, "application_id" character varying, "document_type" "public"."loan_documents_document_type_enum" NOT NULL, "original_name" character varying NOT NULL, "file_size" integer NOT NULL, "mime_type" character varying NOT NULL, "content_base64" text NOT NULL, "status" "public"."loan_documents_status_enum" NOT NULL DEFAULT 'verified', "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_10ce89ea05668cea82900f60e7a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" character varying NOT NULL, "token" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "used" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ab673f0e63eac966762155508ee" UNIQUE ("token"), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "device_prices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cache_key" character varying(300) NOT NULL, "min_pen" numeric(12,2) NOT NULL, "max_pen" numeric(12,2) NOT NULL, "avg_pen" numeric(12,2) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6f2ee6b7d32aa2f555f45dea02f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_60496ec443ad679216d1ed9de5" ON "device_prices" ("cache_key")`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "guarantees" ADD CONSTRAINT "FK_2373476f7a2f9e57c92e9c015c4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "loan_applications" ADD CONSTRAINT "FK_675fc88c789366e3f362ebbccb3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "loan_applications" ADD CONSTRAINT "FK_6de21dd0365d712e1d17e246a6d" FOREIGN KEY ("guarantee_id") REFERENCES "guarantees"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "evaluations" ADD CONSTRAINT "FK_42613ea05dd223da68e45d77ed1" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "signatures" ADD CONSTRAINT "FK_643ddc170bb4bb5c9440ec5dc6c" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_427785468fb7d2733f59e7d7d39" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_3b379ebb0e5d8ac17f998b932e7" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_3b379ebb0e5d8ac17f998b932e7"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_427785468fb7d2733f59e7d7d39"`);
        await queryRunner.query(`ALTER TABLE "signatures" DROP CONSTRAINT "FK_643ddc170bb4bb5c9440ec5dc6c"`);
        await queryRunner.query(`ALTER TABLE "evaluations" DROP CONSTRAINT "FK_42613ea05dd223da68e45d77ed1"`);
        await queryRunner.query(`ALTER TABLE "loan_applications" DROP CONSTRAINT "FK_6de21dd0365d712e1d17e246a6d"`);
        await queryRunner.query(`ALTER TABLE "loan_applications" DROP CONSTRAINT "FK_675fc88c789366e3f362ebbccb3"`);
        await queryRunner.query(`ALTER TABLE "guarantees" DROP CONSTRAINT "FK_2373476f7a2f9e57c92e9c015c4"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_60496ec443ad679216d1ed9de5"`);
        await queryRunner.query(`DROP TABLE "device_prices"`);
        await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
        await queryRunner.query(`DROP TABLE "loan_documents"`);
        await queryRunner.query(`DROP TYPE "public"."loan_documents_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."loan_documents_document_type_enum"`);
        await queryRunner.query(`DROP TABLE "mp_pending_payments"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_payment_method_enum"`);
        await queryRunner.query(`DROP TABLE "signatures"`);
        await queryRunner.query(`DROP TABLE "evaluations"`);
        await queryRunner.query(`DROP TYPE "public"."evaluations_status_enum"`);
        await queryRunner.query(`DROP TABLE "loan_applications"`);
        await queryRunner.query(`DROP TYPE "public"."loan_applications_status_enum"`);
        await queryRunner.query(`DROP TABLE "guarantees"`);
        await queryRunner.query(`DROP TYPE "public"."guarantees_status_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
    }

}
