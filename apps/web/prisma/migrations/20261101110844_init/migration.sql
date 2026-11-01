-- CreateEnum
CREATE TYPE "organization_type" AS ENUM ('club', 'independent');

-- CreateEnum
CREATE TYPE "organization_plan" AS ENUM ('pilot', 'free', 'pro', 'club');

-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('owner', 'coach', 'assistant', 'athlete', 'guardian');

-- CreateEnum
CREATE TYPE "member_status" AS ENUM ('active', 'invited', 'suspended');

-- CreateEnum
CREATE TYPE "group_coach_role" AS ENUM ('lead', 'assistant');

-- CreateEnum
CREATE TYPE "takeoff_foot" AS ENUM ('left', 'right');

-- CreateEnum
CREATE TYPE "invitation_kind" AS ENUM ('group_link', 'qr', 'personal_email', 'personal_sms');

-- CreateEnum
CREATE TYPE "invitation_role" AS ENUM ('athlete', 'coach', 'assistant');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('sent', 'opened', 'accepted', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "consent_status" AS ENUM ('pending', 'granted', 'refused');

-- CreateEnum
CREATE TYPE "consent_kind" AS ENUM ('terms', 'health', 'video');

-- CreateEnum
CREATE TYPE "exercise_category" AS ENUM ('strength', 'plyo', 'running_drill', 'stairs', 'cones', 'mobility', 'jump', 'warmup');

-- CreateEnum
CREATE TYPE "media_kind" AS ENUM ('upload', 'youtube');

-- CreateEnum
CREATE TYPE "session_type" AS ENUM ('strength', 'plyo', 'running', 'stairs', 'cones', 'mobility', 'jump');

-- CreateEnum
CREATE TYPE "block_variant" AS ENUM ('club', 'autonomous', 'both');

-- CreateEnum
CREATE TYPE "assignment_target" AS ENUM ('group', 'athlete');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('present', 'absent', 'unknown');

-- CreateEnum
CREATE TYPE "attendance_source" AS ENUM ('athlete', 'coach');

-- CreateEnum
CREATE TYPE "log_status" AS ENUM ('done', 'partial', 'missed', 'skipped');

-- CreateEnum
CREATE TYPE "session_variant" AS ENUM ('club', 'autonomous');

-- CreateEnum
CREATE TYPE "body_side" AS ENUM ('left', 'right', 'both', 'none');

-- CreateEnum
CREATE TYPE "injury_status" AS ENUM ('active', 'recovering', 'resolved');

-- CreateEnum
CREATE TYPE "strength_test_kind" AS ENUM ('one_rm', 'three_rm', 'estimated');

-- CreateEnum
CREATE TYPE "jump_result" AS ENUM ('O', 'X', 'pass');

-- CreateEnum
CREATE TYPE "video_status" AS ENUM ('uploading', 'processing', 'ready', 'error');

-- CreateEnum
CREATE TYPE "jump_phase" AS ENUM ('approach', 'penultimate', 'takeoff', 'clearance', 'landing');

-- CreateEnum
CREATE TYPE "annotation_kind" AS ENUM ('comment', 'line', 'arrow', 'angle');

-- CreateEnum
CREATE TYPE "comment_entity" AS ENUM ('session', 'log', 'video');

-- CreateEnum
CREATE TYPE "device_platform" AS ENUM ('ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "subscription_provider" AS ENUM ('stripe', 'revenuecat', 'manual');

-- CreateEnum
CREATE TYPE "entitlement_source" AS ENUM ('plan', 'stripe', 'revenuecat', 'admin', 'referral');

-- CreateEnum
CREATE TYPE "referral_owner_type" AS ENUM ('user', 'organization');

-- CreateEnum
CREATE TYPE "referral_status" AS ENUM ('signed_up', 'trialing', 'qualified', 'rewarded', 'rejected');

-- CreateEnum
CREATE TYPE "reward_kind" AS ENUM ('free_month', 'discount');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" UUID NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passkey" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "public_key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "credential_id" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "device_type" TEXT NOT NULL,
    "backed_up" BOOLEAN NOT NULL,
    "transports" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "aaguid" TEXT,

    CONSTRAINT "passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "last_request" BIGINT NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "birth_date" DATE,
    "avatar_url" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "units" TEXT NOT NULL DEFAULT 'kg',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "organization_type" NOT NULL DEFAULT 'independent',
    "logo_url" TEXT,
    "disciplines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "owner_id" UUID NOT NULL,
    "plan" "organization_plan" NOT NULL DEFAULT 'pilot',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "member_role" NOT NULL,
    "status" "member_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organization_id","user_id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "level" TEXT,
    "goal" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "group_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id","athlete_id")
);

-- CreateTable
CREATE TABLE "group_coaches" (
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "group_coach_role" NOT NULL DEFAULT 'lead',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_coaches_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "athletes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "birth_date" DATE,
    "disciplines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "level" TEXT,
    "takeoff_foot" "takeoff_foot",
    "approach_steps" INTEGER,
    "goals" TEXT,
    "particularities" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athletes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "group_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "kind" "invitation_kind" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "token_hash" TEXT NOT NULL,
    "role" "invitation_role" NOT NULL DEFAULT 'athlete',
    "athlete_id" UUID,
    "expires_at" TIMESTAMP(3),
    "max_uses" INTEGER,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "status" "invitation_status" NOT NULL DEFAULT 'sent',
    "invited_by" UUID NOT NULL,
    "accepted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardians" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "guardian_email" TEXT NOT NULL,
    "guardian_user_id" UUID,
    "consent_status" "consent_status" NOT NULL DEFAULT 'pending',
    "consent_at" TIMESTAMP(3),
    "consent_scope" JSONB,
    "token_hash" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "athlete_id" UUID,
    "kind" "consent_kind" NOT NULL,
    "version" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "category" "exercise_category" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_prescription" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_media" (
    "id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "kind" "media_kind" NOT NULL,
    "mux_asset_id" TEXT,
    "mux_upload_id" TEXT,
    "mux_playback_id" TEXT,
    "youtube_id" TEXT,
    "custom_title" TEXT,
    "start_s" INTEGER,
    "end_s" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "session_type" NOT NULL,
    "duration_min" INTEGER,
    "coach_note" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_blocks" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "variant" "block_variant" NOT NULL DEFAULT 'both',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_items" (
    "id" UUID NOT NULL,
    "block_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "prescription" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT,
    "location" TEXT,
    "draft" JSONB,
    "snapshot" JSONB,
    "title" TEXT NOT NULL,
    "type" "session_type" NOT NULL,
    "published_at" TIMESTAMP(3),
    "publish_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "scheduled_session_id" UUID NOT NULL,
    "target_type" "assignment_target" NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_overrides" (
    "id" UUID NOT NULL,
    "scheduled_session_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "item_ref" TEXT NOT NULL,
    "prescription" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL,
    "scheduled_session_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "status" "attendance_status" NOT NULL DEFAULT 'unknown',
    "source" "attendance_source" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_logs" (
    "id" UUID NOT NULL,
    "scheduled_session_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "client_id" TEXT,
    "status" "log_status" NOT NULL,
    "variant_done" "session_variant",
    "rpe" INTEGER,
    "duration_min" INTEGER,
    "comment" TEXT,
    "pain" JSONB,
    "completed_at" TIMESTAMP(3),
    "reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_logs" (
    "id" UUID NOT NULL,
    "session_log_id" UUID NOT NULL,
    "item_ref" TEXT NOT NULL,
    "set_index" INTEGER NOT NULL,
    "reps" INTEGER,
    "load_kg" DECIMAL(7,2),
    "distance_m" DECIMAL(9,2),
    "time_s" DECIMAL(9,2),
    "done" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "set_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "injuries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "body_area" TEXT NOT NULL,
    "side" "body_side" NOT NULL DEFAULT 'none',
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "injury_status" NOT NULL DEFAULT 'active',
    "restrictions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "injuries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wellness_checkins" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "sleep" INTEGER,
    "fatigue" INTEGER,
    "soreness" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wellness_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strength_tests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "exercise_key" TEXT NOT NULL,
    "value" DECIMAL(7,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "kind" "strength_test_kind" NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strength_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "location" TEXT,
    "level" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_athletes" (
    "competition_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_athletes_pkey" PRIMARY KEY ("competition_id","athlete_id")
);

-- CreateTable
CREATE TABLE "performances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "discipline" TEXT NOT NULL,
    "mark" DECIMAL(9,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "wind" DECIMAL(4,1),
    "date" DATE NOT NULL,
    "location" TEXT,
    "competition_id" UUID,
    "is_pb" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jump_attempts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "scheduled_session_id" UUID,
    "competition_id" UUID,
    "bar_height_cm" INTEGER NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "result" "jump_result" NOT NULL,
    "approach_steps" INTEGER,
    "takeoff_distance_cm" INTEGER,
    "video_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jump_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "scheduled_session_id" UUID,
    "mux_upload_id" TEXT,
    "mux_asset_id" TEXT,
    "mux_playback_id" TEXT,
    "status" "video_status" NOT NULL DEFAULT 'uploading',
    "fps" INTEGER,
    "duration_ms" INTEGER,
    "recorded_at" TIMESTAMP(3),
    "shared_with_athlete" BOOLEAN NOT NULL DEFAULT false,
    "shared_with_group" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_annotations" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "t_ms" INTEGER NOT NULL,
    "phase" "jump_phase",
    "kind" "annotation_kind" NOT NULL DEFAULT 'comment',
    "text" TEXT,
    "shape" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entity_type" "comment_entity" NOT NULL,
    "entity_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "deliver_after" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "push_token" TEXT NOT NULL,
    "platform" "device_platform" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateTable
CREATE TABLE "plans" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_key" TEXT NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'active',
    "provider" "subscription_provider" NOT NULL DEFAULT 'manual',
    "provider_ref" TEXT,
    "current_period_end" TIMESTAMP(3),
    "cancel_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" "entitlement_source" NOT NULL DEFAULT 'plan',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" UUID NOT NULL,
    "owner_type" "referral_owner_type" NOT NULL,
    "owner_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "code_id" UUID NOT NULL,
    "referred_user_id" UUID NOT NULL,
    "referred_org_id" UUID,
    "status" "referral_status" NOT NULL DEFAULT 'signed_up',
    "qualified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_rewards" (
    "id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "kind" "reward_kind" NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "applied_at" TIMESTAMP(3),
    "provider_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "passkey_user_id_idx" ON "passkey"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_key_key" ON "rate_limit"("key");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE INDEX "groups_organization_id_idx" ON "groups"("organization_id");

-- CreateIndex
CREATE INDEX "group_members_athlete_id_idx" ON "group_members"("athlete_id");

-- CreateIndex
CREATE INDEX "group_coaches_user_id_idx" ON "group_coaches"("user_id");

-- CreateIndex
CREATE INDEX "athletes_user_id_idx" ON "athletes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "athletes_organization_id_user_id_key" ON "athletes"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "coach_notes_athlete_id_idx" ON "coach_notes"("athlete_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_organization_id_idx" ON "invitations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardians_token_hash_key" ON "guardians"("token_hash");

-- CreateIndex
CREATE INDEX "guardians_athlete_id_idx" ON "guardians"("athlete_id");

-- CreateIndex
CREATE UNIQUE INDEX "consents_user_id_kind_key" ON "consents"("user_id", "kind");

-- CreateIndex
CREATE INDEX "exercises_organization_id_idx" ON "exercises"("organization_id");

-- CreateIndex
CREATE INDEX "exercise_media_exercise_id_idx" ON "exercise_media"("exercise_id");

-- CreateIndex
CREATE INDEX "session_templates_organization_id_idx" ON "session_templates"("organization_id");

-- CreateIndex
CREATE INDEX "session_blocks_template_id_idx" ON "session_blocks"("template_id");

-- CreateIndex
CREATE INDEX "session_items_block_id_idx" ON "session_items"("block_id");

-- CreateIndex
CREATE INDEX "scheduled_sessions_organization_id_date_idx" ON "scheduled_sessions"("organization_id", "date");

-- CreateIndex
CREATE INDEX "assignments_target_id_idx" ON "assignments"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_scheduled_session_id_target_type_target_id_key" ON "assignments"("scheduled_session_id", "target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_overrides_scheduled_session_id_athlete_id_item_ref_key" ON "athlete_overrides"("scheduled_session_id", "athlete_id", "item_ref");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_scheduled_session_id_athlete_id_key" ON "attendance"("scheduled_session_id", "athlete_id");

-- CreateIndex
CREATE INDEX "session_logs_athlete_id_idx" ON "session_logs"("athlete_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_logs_scheduled_session_id_athlete_id_key" ON "session_logs"("scheduled_session_id", "athlete_id");

-- CreateIndex
CREATE UNIQUE INDEX "set_logs_session_log_id_item_ref_set_index_key" ON "set_logs"("session_log_id", "item_ref", "set_index");

-- CreateIndex
CREATE INDEX "injuries_athlete_id_idx" ON "injuries"("athlete_id");

-- CreateIndex
CREATE UNIQUE INDEX "wellness_checkins_athlete_id_date_key" ON "wellness_checkins"("athlete_id", "date");

-- CreateIndex
CREATE INDEX "strength_tests_athlete_id_exercise_key_idx" ON "strength_tests"("athlete_id", "exercise_key");

-- CreateIndex
CREATE INDEX "competitions_organization_id_date_idx" ON "competitions"("organization_id", "date");

-- CreateIndex
CREATE INDEX "performances_athlete_id_idx" ON "performances"("athlete_id");

-- CreateIndex
CREATE INDEX "jump_attempts_athlete_id_idx" ON "jump_attempts"("athlete_id");

-- CreateIndex
CREATE INDEX "jump_attempts_scheduled_session_id_idx" ON "jump_attempts"("scheduled_session_id");

-- CreateIndex
CREATE INDEX "videos_organization_id_idx" ON "videos"("organization_id");

-- CreateIndex
CREATE INDEX "videos_athlete_id_idx" ON "videos"("athlete_id");

-- CreateIndex
CREATE INDEX "videos_mux_upload_id_idx" ON "videos"("mux_upload_id");

-- CreateIndex
CREATE INDEX "videos_mux_asset_id_idx" ON "videos"("mux_asset_id");

-- CreateIndex
CREATE INDEX "video_annotations_video_id_idx" ON "video_annotations"("video_id");

-- CreateIndex
CREATE INDEX "comments_entity_type_entity_id_idx" ON "comments"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "announcements_group_id_idx" ON "announcements"("group_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_sent_at_deliver_after_idx" ON "notifications"("sent_at", "deliver_after");

-- CreateIndex
CREATE UNIQUE INDEX "devices_push_token_key" ON "devices"("push_token");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_organization_id_at_idx" ON "audit_log"("organization_id", "at");

-- CreateIndex
CREATE INDEX "content_reports_organization_id_idx" ON "content_reports"("organization_id");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_idx" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_organization_id_key_key" ON "entitlements"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_owner_type_owner_id_key" ON "referral_codes"("owner_type", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referred_user_id_key" ON "referrals"("referred_user_id");

-- CreateIndex
CREATE INDEX "referrals_code_id_idx" ON "referrals"("code_id");

-- CreateIndex
CREATE INDEX "referral_rewards_referral_id_idx" ON "referral_rewards"("referral_id");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_coaches" ADD CONSTRAINT "group_coaches_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_notes" ADD CONSTRAINT "coach_notes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_media" ADD CONSTRAINT "exercise_media_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_templates" ADD CONSTRAINT "session_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_blocks" ADD CONSTRAINT "session_blocks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "session_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "session_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_scheduled_session_id_fkey" FOREIGN KEY ("scheduled_session_id") REFERENCES "scheduled_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_overrides" ADD CONSTRAINT "athlete_overrides_scheduled_session_id_fkey" FOREIGN KEY ("scheduled_session_id") REFERENCES "scheduled_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_overrides" ADD CONSTRAINT "athlete_overrides_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_scheduled_session_id_fkey" FOREIGN KEY ("scheduled_session_id") REFERENCES "scheduled_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_scheduled_session_id_fkey" FOREIGN KEY ("scheduled_session_id") REFERENCES "scheduled_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_session_log_id_fkey" FOREIGN KEY ("session_log_id") REFERENCES "session_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wellness_checkins" ADD CONSTRAINT "wellness_checkins_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strength_tests" ADD CONSTRAINT "strength_tests_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_athletes" ADD CONSTRAINT "competition_athletes_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_athletes" ADD CONSTRAINT "competition_athletes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performances" ADD CONSTRAINT "performances_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performances" ADD CONSTRAINT "performances_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jump_attempts" ADD CONSTRAINT "jump_attempts_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jump_attempts" ADD CONSTRAINT "jump_attempts_scheduled_session_id_fkey" FOREIGN KEY ("scheduled_session_id") REFERENCES "scheduled_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jump_attempts" ADD CONSTRAINT "jump_attempts_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jump_attempts" ADD CONSTRAINT "jump_attempts_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_scheduled_session_id_fkey" FOREIGN KEY ("scheduled_session_id") REFERENCES "scheduled_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_annotations" ADD CONSTRAINT "video_annotations_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "referral_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
