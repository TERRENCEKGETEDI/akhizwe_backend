
-- CREATE TABLE for admin_logs
CREATE TABLE "admin_logs" (
  "log_id" character varying(50) NOT NULL,
  "admin_email" character varying(255),
  "action" text NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("log_id")
);

-- CREATE TABLE for advances
CREATE TABLE "advances" (
  "advance_id" integer DEFAULT nextval('advances_advance_id_seq'::regclass) NOT NULL,
  "transaction_ref" character varying(50),
  "user_email" character varying(255),
  "amount" numeric(10,2) NOT NULL,
  "service_fee" numeric(10,2) DEFAULT 0,
  "repaid" boolean DEFAULT false,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("advance_id"),
  FOREIGN KEY ("user_email") REFERENCES "users"("email")
);

-- CREATE TABLE for airtime_data
CREATE TABLE "airtime_data" (
  "id" integer DEFAULT nextval('airtime_data_id_seq'::regclass) NOT NULL,
  "transaction_ref" character varying(50),
  "network" character varying(50) NOT NULL,
  "bundle_type" character varying(20),
  "phone_number" character varying(15) NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "bundle_id" integer,
  "recipient_email" character varying(255),
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("transaction_ref") REFERENCES "transactions"("transaction_ref"),
  FOREIGN KEY ("bundle_id") REFERENCES "data_bundles"("bundle_id")
);

-- CREATE TABLE for comment_likes
CREATE TABLE "comment_likes" (
  "like_id" integer DEFAULT nextval('comment_likes_like_id_seq'::regclass) NOT NULL,
  "comment_id" character varying(50),
  "user_email" character varying(255),
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("like_id"),
  UNIQUE ("comment_id", "user_email"),
  FOREIGN KEY ("comment_id") REFERENCES "media_comments"("comment_id") ON DELETE CASCADE,
  FOREIGN KEY ("user_email") REFERENCES "users"("email")
);

-- CREATE TABLE for data_bundles
CREATE TABLE "data_bundles" (
  "bundle_id" integer DEFAULT nextval('data_bundles_bundle_id_seq'::regclass) NOT NULL,
  "network_id" integer,
  "name" character varying(100) NOT NULL,
  "data_size" character varying(50) NOT NULL,
  "price" numeric(10,2) NOT NULL,
  "enabled" boolean DEFAULT true,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("bundle_id"),
  FOREIGN KEY ("network_id") REFERENCES "networks"("network_id")
);

-- CREATE TABLE for media
CREATE TABLE "media" (
  "media_id" character varying(50) NOT NULL,
  "uploader_email" character varying(255),
  "media_type" character varying(20),
  "title" character varying(150) NOT NULL,
  "file_url" text NOT NULL,
  "is_approved" boolean DEFAULT false,
  "uploaded_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "view_count" integer DEFAULT 0,
  "download_count" integer DEFAULT 0,
  "file_path" text,
  "file_size" integer,
  "copyright_declared" boolean DEFAULT false,
  "monetization_enabled" boolean DEFAULT false,
  "description" text,
  "artist" character varying(255),
  "category" character varying(100),
  "release_date" date,
  PRIMARY KEY ("media_id"),
  FOREIGN KEY ("uploader_email") REFERENCES "users"("email")
);

-- CREATE TABLE for media_comments
CREATE TABLE "media_comments" (
  "comment_id" character varying(50) NOT NULL,
  "media_id" character varying(50),
  "user_email" character varying(255),
  "comment" text NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "parent_comment_id" character varying(50),
  PRIMARY KEY ("comment_id"),
  FOREIGN KEY ("media_id") REFERENCES "media"("media_id"),
  FOREIGN KEY ("user_email") REFERENCES "users"("email"),
  FOREIGN KEY ("parent_comment_id") REFERENCES "media_comments"("comment_id") ON DELETE CASCADE
);

-- CREATE TABLE for media_interactions
CREATE TABLE "media_interactions" (
  "user_email" character varying(255) NOT NULL,
  "media_id" character varying(50) NOT NULL,
  "interaction_type" character varying(20) NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_email", "media_id", "interaction_type"),
  FOREIGN KEY ("user_email") REFERENCES "users"("email"),
  FOREIGN KEY ("media_id") REFERENCES "media"("media_id")
);

-- CREATE TABLE for networks
CREATE TABLE "networks" (
  "network_id" integer DEFAULT nextval('networks_network_id_seq'::regclass) NOT NULL,
  "name" character varying(50) NOT NULL,
  "enabled" boolean DEFAULT true,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("network_id"),
  UNIQUE ("name")
);

-- CREATE TABLE for notification_deliveries
CREATE TABLE "notification_deliveries" (
  "delivery_id" character varying(50) NOT NULL,
  "notification_id" character varying(50),
  "channel" character varying(20) NOT NULL,
  "status" character varying(20) DEFAULT 'pending'::character varying,
  "attempt_count" integer DEFAULT 0,
  "last_attempt_at" timestamp without time zone,
  "delivered_at" timestamp without time zone,
  "failure_reason" text,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("delivery_id"),
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("notification_id") ON DELETE CASCADE
);

-- CREATE TABLE for notification_spam_prevention
CREATE TABLE "notification_spam_prevention" (
  "id" integer DEFAULT nextval('notification_spam_prevention_id_seq'::regclass) NOT NULL,
  "recipient_email" character varying(255),
  "actor_email" character varying(255),
  "action_type" character varying(50) NOT NULL,
  "related_media_id" character varying(50),
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("recipient_email") REFERENCES "users"("email") ON DELETE CASCADE,
  FOREIGN KEY ("actor_email") REFERENCES "users"("email") ON DELETE CASCADE,
  FOREIGN KEY ("related_media_id") REFERENCES "media"("media_id") ON DELETE CASCADE
);

-- CREATE TABLE for notifications
CREATE TABLE "notifications" (
  "notification_id" character varying(50) NOT NULL,
  "user_email" character varying(255),
  "notification_type" character varying(50) NOT NULL,
  "message" text NOT NULL,
  "related_media_id" character varying(50),
  "is_read" boolean DEFAULT false,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "notification_channel" character varying(20) DEFAULT 'in_app'::character varying,
  "priority" character varying(10) DEFAULT 'normal'::character varying,
  "actor_email" character varying(255),
  "action_type" character varying(50),
  "metadata" jsonb,
  "expires_at" timestamp without time zone,
  "read_at" timestamp without time zone,
  "read_channels" jsonb,
  PRIMARY KEY ("notification_id"),
  FOREIGN KEY ("user_email") REFERENCES "users"("email"),
  FOREIGN KEY ("related_media_id") REFERENCES "media"("media_id"),
  FOREIGN KEY ("actor_email") REFERENCES "users"("email")
);

-- CREATE TABLE for reports
CREATE TABLE "reports" (
  "report_id" character varying(50) NOT NULL,
  "reporter_email" character varying(255) NOT NULL,
  "reported_email" character varying(255),
  "media_id" character varying(50),
  "comment_id" character varying(50),
  "report_type" character varying(20) NOT NULL,
  "reason" text NOT NULL,
  "status" character varying(20) DEFAULT 'PENDING'::character varying,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("report_id"),
  FOREIGN KEY ("reporter_email") REFERENCES "users"("email"),
  FOREIGN KEY ("reported_email") REFERENCES "users"("email"),
  FOREIGN KEY ("media_id") REFERENCES "media"("media_id"),
  FOREIGN KEY ("comment_id") REFERENCES "media_comments"("comment_id")
);

-- CREATE TABLE for ticket_notifications
CREATE TABLE "ticket_notifications" (
  "notification_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_email" character varying(255) NOT NULL,
  "ticket_id" character varying(255),
  "transaction_ref" character varying(255),
  "notification_type" character varying(50) NOT NULL,
  "message" text NOT NULL,
  "sent_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "status" character varying(20) DEFAULT 'PENDING'::character varying,
  PRIMARY KEY ("notification_id")
);

-- CREATE TABLE for ticket_purchases
CREATE TABLE "ticket_purchases" (
  "transaction_ref" character varying(50) NOT NULL,
  "ticket_id" character varying(50),
  "user_email" character varying(255),
  "qr_code" text NOT NULL,
  "ticket_quantity" integer DEFAULT 1,
  "total_amount" numeric(10,2),
  "purchase_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "used_at" timestamp without time zone,
  "validated_by" character varying(255),
  "seat" character varying(50),
  "status" character varying(20) DEFAULT 'ACTIVE'::character varying,
  "qr_image" text,
  PRIMARY KEY ("transaction_ref"),
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("ticket_id"),
  FOREIGN KEY ("user_email") REFERENCES "users"("email")
);

-- CREATE TABLE for ticket_reports
CREATE TABLE "ticket_reports" (
  "report_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "report_type" character varying(50) NOT NULL,
  "report_data" jsonb,
  "generated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "date_range_start" date,
  "date_range_end" date,
  PRIMARY KEY ("report_id")
);

-- CREATE TABLE for ticket_settings
CREATE TABLE "ticket_settings" (
  "setting_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "setting_key" character varying(100) NOT NULL,
  "setting_value" text,
  "setting_type" character varying(20) DEFAULT 'STRING'::character varying,
  "description" text,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("setting_id"),
  UNIQUE ("setting_key")
);

-- CREATE TABLE for tickets
CREATE TABLE "tickets" (
  "ticket_id" character varying(50) NOT NULL,
  "ticket_type" character varying(30),
  "title" character varying(150) NOT NULL,
  "event_date" timestamp without time zone NOT NULL,
  "location" character varying(150),
  "price" numeric(10,2) NOT NULL,
  "total_quantity" integer NOT NULL,
  "available_quantity" integer NOT NULL,
  "ticket_subtype" character varying(50),
  "description" text,
  "end_date" timestamp without time zone,
  "departure_location" character varying(255),
  "arrival_location" character varying(255),
  "departure_time" time without time zone,
  "arrival_time" time without time zone,
  "max_per_user" integer DEFAULT 1,
  "sales_start_date" timestamp without time zone,
  "sales_end_date" timestamp without time zone,
  "cancellation_policy" text,
  "refund_policy" text,
  "status" character varying(20) DEFAULT 'ACTIVE'::character varying,
  "is_featured" boolean DEFAULT false,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "performers" jsonb,
  "teams" jsonb,
  "start_time" time without time zone,
  "end_time" time without time zone,
  PRIMARY KEY ("ticket_id")
);

-- CREATE TABLE for transactions
CREATE TABLE "transactions" (
  "transaction_ref" character varying(50) NOT NULL,
  "user_email" character varying(255),
  "amount" numeric(10,2) NOT NULL,
  "status" character varying(20) DEFAULT 'PENDING'::character varying,
  "transaction_type" character varying(50) NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("transaction_ref"),
  FOREIGN KEY ("user_email") REFERENCES "users"("email")
);

-- CREATE TABLE for user_notification_preferences
CREATE TABLE "user_notification_preferences" (
  "email" character varying(255) NOT NULL,
  "email_notifications" boolean DEFAULT true,
  "push_notifications" boolean DEFAULT true,
  "in_app_notifications" boolean DEFAULT true,
  "like_notifications" boolean DEFAULT true,
  "favorite_notifications" boolean DEFAULT true,
  "comment_notifications" boolean DEFAULT true,
  "reply_notifications" boolean DEFAULT true,
  "download_notifications" boolean DEFAULT true,
  "frequency_digest" boolean DEFAULT false,
  "quiet_hours_start" time without time zone DEFAULT '22:00:00'::time without time zone,
  "quiet_hours_end" time without time zone DEFAULT '08:00:00'::time without time zone,
  "min_interval_minutes" integer DEFAULT 5,
  "max_daily_notifications" integer DEFAULT 100,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("email"),
  FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE
);

-- CREATE TABLE for users
CREATE TABLE "users" (
  "email" character varying(255) NOT NULL,
  "full_name" character varying(150) NOT NULL,
  "phone" character varying(20) NOT NULL,
  "password_hash" text NOT NULL,
  "role" character varying(20) NOT NULL,
  "wallet_balance" numeric(10,2) DEFAULT 0.00,
  "is_blocked" boolean DEFAULT false,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "pin" character varying(4),
  "daily_airtime_limit" numeric DEFAULT 1000,
  "monthly_airtime_limit" numeric DEFAULT 5000,
  "last_purchase_date" date,
  "airtime_balance" numeric(10,2) DEFAULT 0,
  "data_balance" numeric(10,2) DEFAULT 0,
  PRIMARY KEY ("email"),
  UNIQUE ("phone")
);
