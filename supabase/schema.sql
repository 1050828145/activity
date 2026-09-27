-- ============================================================
-- SECTION: SCHEMA
-- ============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";


--
-- Name: EXTENSION "pg_graphql"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pg_graphql" IS 'pg_graphql: GraphQL support';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'admin'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: acquire_scheduler_lock("text", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."acquire_scheduler_lock"("p_instance_id" "text", "p_lock_duration_seconds" integer DEFAULT 60) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_acquired BOOLEAN;
BEGIN
  -- 尝试获取锁（如果锁已过期或未被持有）
  UPDATE scheduler_locks
  SET 
    locked_by = p_instance_id,
    locked_at = NOW(),
    expires_at = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL
  WHERE id = 'scheduler'
    AND (expires_at < NOW() OR locked_by = p_instance_id OR locked_by = 'none');
  
  -- 检查是否成功获取锁
  SELECT locked_by = p_instance_id INTO v_acquired
  FROM scheduler_locks
  WHERE id = 'scheduler';
  
  RETURN COALESCE(v_acquired, FALSE);
END;
$$;


--
-- Name: FUNCTION "acquire_scheduler_lock"("p_instance_id" "text", "p_lock_duration_seconds" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."acquire_scheduler_lock"("p_instance_id" "text", "p_lock_duration_seconds" integer) IS '获取调度器锁';


--
-- Name: exec_sql("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."exec_sql"("sql" "text") RETURNS TABLE("result" json)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY EXECUTE 'SELECT row_to_json(t) FROM (' || sql || ') t';
END;
$$;


--
-- Name: get_activity_participant_count("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_activity_participant_count"("activity_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  activity_type_name TEXT;
  participant_count INTEGER;
BEGIN
  -- 获取活动类型名称
  SELECT at.name INTO activity_type_name
  FROM activities a
  LEFT JOIN activity_types at ON a.activity_type_id = at.id
  WHERE a.id = activity_uuid;
  
  -- 如果是线上活动，返回领队拉人数总和
  IF activity_type_name = '线上' THEN
    SELECT COALESCE(SUM(lp.participant_count), 0) INTO participant_count
    FROM leader_participants lp
    WHERE lp.activity_id = activity_uuid;
  ELSE
    -- 其他类型活动，返回实际参与人员记录数
    SELECT COUNT(*) INTO participant_count
    FROM activity_participants ap
    WHERE ap.activity_id = activity_uuid;
  END IF;
  
  RETURN participant_count;
END;
$$;


--
-- Name: get_pending_tasks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_pending_tasks"() RETURNS TABLE("id" "uuid", "name" "text", "task_type" "text", "cron_expression" "text", "task_config" "jsonb", "last_execution_time" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.task_type,
    t.cron_expression,
    t.task_config,
    t.last_execution_time
  FROM scheduled_tasks t
  WHERE t.enabled = TRUE
  ORDER BY t.created_at;
END;
$$;


--
-- Name: FUNCTION "get_pending_tasks"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."get_pending_tasks"() IS '获取所有启用的任务';


--
-- Name: get_table_structure("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_table_structure"("table_name_param" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result json;
BEGIN
  -- 获取表的列信息和主键信息
  SELECT json_build_object(
    'columns', (
      SELECT json_agg(
        json_build_object(
          'column_name', column_name,
          'data_type', data_type,
          'character_maximum_length', character_maximum_length,
          'is_nullable', is_nullable,
          'column_default', column_default
        ) ORDER BY ordinal_position
      )
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = table_name_param
    ),
    'primary_keys', (
      SELECT json_agg(a.attname ORDER BY array_position(i.indkey, a.attnum))
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = table_name_param::regclass 
        AND i.indisprimary
    )
  ) INTO result;
  
  RETURN result;
END;
$$;


--
-- Name: get_user_tables(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_user_tables"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(table_name ORDER BY table_name)
  INTO result
  FROM information_schema.tables
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT IN (
      'pg_stat_statements',
      'pg_stat_statements_info',
      'schema_migrations',
      'supabase_functions',
      'supabase_migrations',
      'storage',
      'auth',
      'realtime',
      'extensions',
      'graphql',
      'graphql_public',
      'net',
      'pgsodium',
      'pgsodium_masks',
      'pgtle',
      'vault',
      'supabase_functions_schema',
      'backup_logs'
    );
  
  RETURN result;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_count int;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- 插入用户资料，第一个用户为管理员
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE WHEN user_count = 0 THEN 'admin'::public.user_role ELSE 'user'::public.user_role END
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;


--
-- Name: is_admin("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."is_admin"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'admin'
  );
$$;


--
-- Name: is_root_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."is_root_user"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'username') = 'root',
      false
    )
  );
END;
$$;


--
-- Name: FUNCTION "is_root_user"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."is_root_user"() IS '检查当前用户是否是root用户';


--
-- Name: release_scheduler_lock("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."release_scheduler_lock"("p_instance_id" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE scheduler_locks
  SET 
    locked_by = 'none',
    expires_at = NOW()
  WHERE id = 'scheduler'
    AND locked_by = p_instance_id;
  
  RETURN FOUND;
END;
$$;


--
-- Name: FUNCTION "release_scheduler_lock"("p_instance_id" "text"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."release_scheduler_lock"("p_instance_id" "text") IS '释放调度器锁';


--
-- Name: update_activity_leader_count("uuid", integer, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."update_activity_leader_count"("p_activity_leader_id" "uuid", "p_change_amount" integer, "p_note" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_activity_leader activity_leaders%ROWTYPE;
  v_previous_count integer;
  v_new_count integer;
  v_activity_id uuid;
  v_leader_id uuid;
  v_user_id uuid;
  v_change_id uuid;
BEGIN
  -- 获取当前用户
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  -- 获取领队信息
  SELECT * INTO v_activity_leader
  FROM activity_leaders
  WHERE id = p_activity_leader_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '领队记录不存在';
  END IF;

  -- 检查权限
  IF NOT EXISTS (
    SELECT 1 FROM activities 
    WHERE id = v_activity_leader.activity_id 
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION '无权限修改此活动';
  END IF;

  -- 计算新人数
  v_previous_count := v_activity_leader.participant_count;
  v_new_count := v_previous_count + p_change_amount;

  -- 检查新人数不能为负数
  IF v_new_count < 0 THEN
    RAISE EXCEPTION '人数不能为负数';
  END IF;

  v_activity_id := v_activity_leader.activity_id;
  v_leader_id := v_activity_leader.leader_id;

  -- 更新领队人数
  UPDATE activity_leaders
  SET 
    participant_count = v_new_count,
    updated_at = now()
  WHERE id = p_activity_leader_id;

  -- 记录变更
  INSERT INTO activity_leader_changes (
    activity_leader_id,
    activity_id,
    leader_id,
    change_amount,
    previous_count,
    new_count,
    changed_by,
    note
  ) VALUES (
    p_activity_leader_id,
    v_activity_id,
    v_leader_id,
    p_change_amount,
    v_previous_count,
    v_new_count,
    v_user_id,
    p_note
  ) RETURNING id INTO v_change_id;

  -- 更新活动总人数
  UPDATE activities
  SET 
    total_participants = (
      SELECT COALESCE(SUM(participant_count), 0)
      FROM activity_leaders
      WHERE activity_id = v_activity_id
    ),
    updated_at = now()
  WHERE id = v_activity_id;

  RETURN json_build_object(
    'success', true,
    'change_id', v_change_id,
    'previous_count', v_previous_count,
    'new_count', v_new_count,
    'change_amount', p_change_amount
  );
END;
$$;


--
-- Name: update_activity_leaders_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."update_activity_leaders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_activity_participants_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."update_activity_participants_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_activity_total_participants(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."update_activity_total_participants"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 更新活动总人数
  UPDATE activities
  SET 
    total_participants = (
      SELECT COALESCE(SUM(participant_count), 0)
      FROM activity_leaders
      WHERE activity_id = COALESCE(NEW.activity_id, OLD.activity_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.activity_id, OLD.activity_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_leader_participants_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."update_leader_participants_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_leaders_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."update_leaders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_task_execution_time("uuid", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."update_task_execution_time"("p_task_id" "uuid", "p_execution_time" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE scheduled_tasks
  SET 
    last_execution_time = p_execution_time,
    updated_at = NOW()
  WHERE id = p_task_id;
END;
$$;


--
-- Name: FUNCTION "update_task_execution_time"("p_task_id" "uuid", "p_execution_time" timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."update_task_execution_time"("p_task_id" "uuid", "p_execution_time" timestamp with time zone) IS '更新任务最后执行时间';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT '待确认'::"text" NOT NULL,
    "start_date" "date",
    "location" "text" NOT NULL,
    "content" "text",
    "required_people" integer DEFAULT 0 NOT NULL,
    "requirements" "text",
    "profit" numeric(10,2),
    "part_time_salary" numeric(10,2),
    "per_head_fee" numeric(10,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deposit" numeric(10,2) DEFAULT 0,
    "summary" "text",
    "end_date" "date",
    "payment_date" "date",
    "user_id" "uuid",
    "type" "text" DEFAULT '短期'::"text" NOT NULL,
    "activity_type_id" "uuid",
    "registration_method" "text",
    "total_participants" integer DEFAULT 0 NOT NULL
);


--
-- Name: COLUMN "activities"."start_date"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activities"."start_date" IS '开始日期';


--
-- Name: COLUMN "activities"."profit"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activities"."profit" IS '利润';


--
-- Name: COLUMN "activities"."summary"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activities"."summary" IS '活动概要';


--
-- Name: COLUMN "activities"."end_date"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activities"."end_date" IS '结束日期';


--
-- Name: COLUMN "activities"."payment_date"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activities"."payment_date" IS '发薪日期';


--
-- Name: COLUMN "activities"."type"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activities"."type" IS '活动类型: 长期, 短期';


--
-- Name: COLUMN "activities"."registration_method"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activities"."registration_method" IS '报名方式（如：微信报名、电话报名、现场报名等）';


--
-- Name: COLUMN "activities"."total_participants"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activities"."total_participants" IS '活动总参与人数（缓存字段）';


--
-- Name: activity_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."activity_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: activities_with_details; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW "public"."activities_with_details" AS
 SELECT "a"."id",
    "a"."name",
    "a"."status",
    "a"."start_date",
    "a"."location",
    "a"."content",
    "a"."required_people",
    "a"."requirements",
    "a"."profit",
    "a"."part_time_salary",
    "a"."per_head_fee",
    "a"."notes",
    "a"."created_at",
    "a"."updated_at",
    "a"."deposit",
    "a"."summary",
    "a"."end_date",
    "a"."payment_date",
    "a"."user_id",
    "a"."type",
    "a"."activity_type_id",
    "a"."registration_method",
    "at"."name" AS "activity_type_name",
    "public"."get_activity_participant_count"("a"."id") AS "participant_count"
   FROM ("public"."activities" "a"
     LEFT JOIN "public"."activity_types" "at" ON (("a"."activity_type_id" = "at"."id")));


--
-- Name: activities_with_participant_count; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW "public"."activities_with_participant_count" AS
 SELECT "id",
    "name",
    "status",
    "start_date",
    "location",
    "content",
    "required_people",
    "requirements",
    "profit",
    "part_time_salary",
    "per_head_fee",
    "notes",
    "created_at",
    "updated_at",
    "deposit",
    "summary",
    "end_date",
    "payment_date",
    "user_id",
    "type",
    "activity_type_id",
    "registration_method",
    "public"."get_activity_participant_count"("id") AS "participant_count"
   FROM "public"."activities" "a";


--
-- Name: activity_leader_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."activity_leader_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_leader_id" "uuid" NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "leader_id" "uuid" NOT NULL,
    "change_amount" integer NOT NULL,
    "previous_count" integer NOT NULL,
    "new_count" integer NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "activity_leader_changes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."activity_leader_changes" IS '活动领队人数变更记录表';


--
-- Name: COLUMN "activity_leader_changes"."change_amount"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activity_leader_changes"."change_amount" IS '变更数量（正数=增加，负数=减少）';


--
-- Name: COLUMN "activity_leader_changes"."previous_count"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activity_leader_changes"."previous_count" IS '变更前的人数';


--
-- Name: COLUMN "activity_leader_changes"."new_count"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activity_leader_changes"."new_count" IS '变更后的人数';


--
-- Name: activity_leaders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."activity_leaders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "leader_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "participant_count" integer DEFAULT 0 NOT NULL
);


--
-- Name: COLUMN "activity_leaders"."participant_count"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activity_leaders"."participant_count" IS '该领队带的参与人数';


--
-- Name: activity_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."activity_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT '待确认'::"text",
    "salary" numeric(10,2),
    "deposit" numeric(10,2) DEFAULT 0,
    "per_head_fee" numeric(10,2),
    "introducer_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_paid" boolean DEFAULT false NOT NULL,
    "registration_source" character varying(50) DEFAULT 'manual'::character varying,
    "is_viewed" boolean DEFAULT true,
    "viewed_at" timestamp with time zone,
    "added_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: COLUMN "activity_participants"."is_paid"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activity_participants"."is_paid" IS '是否发薪';


--
-- Name: COLUMN "activity_participants"."registration_source"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activity_participants"."registration_source" IS '报名来源: manual(手动添加), qrcode(二维码报名)';


--
-- Name: COLUMN "activity_participants"."is_viewed"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activity_participants"."is_viewed" IS '是否已查看: true(已查看), false(待查看)';


--
-- Name: COLUMN "activity_participants"."viewed_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activity_participants"."viewed_at" IS '查看时间';


--
-- Name: COLUMN "activity_participants"."added_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."activity_participants"."added_at" IS '参与人员添加时间（精确到分钟）';


--
-- Name: backup_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."backup_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "filename" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'success'::"text",
    "file_content" "text"
);


--
-- Name: email_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."email_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resend_api_key" "text" NOT NULL,
    "from_email" "text" NOT NULL,
    "from_name" "text" DEFAULT '活动与人员管理系统'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: TABLE "email_config"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."email_config" IS 'Resend 邮箱配置表（仅 root 用户可访问）';


--
-- Name: COLUMN "email_config"."resend_api_key"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."email_config"."resend_api_key" IS 'Resend API 密钥';


--
-- Name: COLUMN "email_config"."from_email"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."email_config"."from_email" IS '发件人邮箱（需在 Resend 后台验证）';


--
-- Name: COLUMN "email_config"."from_name"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."email_config"."from_name" IS '发件人名称';


--
-- Name: email_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."email_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "schedule_type" "text" NOT NULL,
    "schedule_time" "text" NOT NULL,
    "schedule_days" "jsonb",
    "content_types" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_notifications_schedule_type_check" CHECK (("schedule_type" = ANY (ARRAY['daily'::"text", 'weekdays'::"text", 'custom'::"text"])))
);


--
-- Name: email_send_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."email_send_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid",
    "user_email" "text" NOT NULL,
    "status" "text" NOT NULL,
    "error_message" "text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_send_logs_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'failed'::"text"])))
);


--
-- Name: TABLE "email_send_logs"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."email_send_logs" IS '邮件发送日志表';


--
-- Name: COLUMN "email_send_logs"."notification_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."email_send_logs"."notification_id" IS '关联的通知任务ID';


--
-- Name: COLUMN "email_send_logs"."user_email"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."email_send_logs"."user_email" IS '收件人邮箱';


--
-- Name: COLUMN "email_send_logs"."status"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."email_send_logs"."status" IS '发送状态：success=成功, failed=失败';


--
-- Name: COLUMN "email_send_logs"."error_message"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."email_send_logs"."error_message" IS '错误信息（如果失败）';


--
-- Name: COLUMN "email_send_logs"."sent_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."email_send_logs"."sent_at" IS '发送时间';


--
-- Name: leader_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."leader_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "leader_id" "uuid" NOT NULL,
    "participant_count" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "leader_participants_participant_count_check" CHECK (("participant_count" >= 0))
);


--
-- Name: leaders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."leaders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "gender" "text",
    "contact" "text" NOT NULL,
    "wechat" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "age" integer,
    "status" "text" DEFAULT '在职'::"text" NOT NULL,
    "user_id" "uuid"
);


--
-- Name: COLUMN "leaders"."age"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."leaders"."age" IS '年龄';


--
-- Name: persons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."persons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact" "text" NOT NULL,
    "gender" "text",
    "age" integer,
    "id_number" "text",
    "photo_url" "text",
    "expertise" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "height" integer,
    "weight" numeric(5,2),
    "user_id" "uuid"
);


--
-- Name: COLUMN "persons"."height"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."persons"."height" IS '身高(cm)';


--
-- Name: COLUMN "persons"."weight"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."persons"."weight" IS '体重(kg)';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "email" "text",
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auto_backup" boolean DEFAULT true,
    "last_login_at" timestamp with time zone,
    "last_login_ip" "text",
    "avatar_url" "text"
);


--
-- Name: COLUMN "profiles"."last_login_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."profiles"."last_login_at" IS '最近登录时间';


--
-- Name: COLUMN "profiles"."last_login_ip"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."profiles"."last_login_ip" IS '最近登录IP地址';


--
-- Name: promotion_task_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."promotion_task_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "record_id" "uuid" NOT NULL,
    "actual_time" timestamp with time zone,
    "activity_ids" "text" DEFAULT ''::"text",
    "channel" "text",
    "conversions" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: promotion_task_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."promotion_task_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "record_date" "date" NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: promotion_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."promotion_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_common" boolean DEFAULT false NOT NULL,
    "activity_list" "text",
    "promotion_time" time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    "status" "text" DEFAULT '启用'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cycle_type" "text" DEFAULT '长期任务'::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "cycle_interval" integer,
    CONSTRAINT "promotion_tasks_status_check" CHECK (("status" = ANY (ARRAY['启用'::"text", '停用'::"text"])))
);


--
-- Name: public_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW "public"."public_profiles" AS
 SELECT "id",
    "username",
    "role"
   FROM "public"."profiles";


--
-- Name: scheduled_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."scheduled_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "task_type" "text" NOT NULL,
    "cron_expression" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "task_config" "jsonb",
    "last_execution_time" timestamp with time zone,
    "next_execution_time" timestamp with time zone,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "scheduled_tasks_task_type_check" CHECK (("task_type" = ANY (ARRAY['send_email'::"text", 'data_cleanup'::"text", 'report_generation'::"text", 'custom'::"text", 'email_notification'::"text", 'sms_notification'::"text", 'wechat_notification'::"text"])))
);


--
-- Name: TABLE "scheduled_tasks"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."scheduled_tasks" IS '定时任务配置表';


--
-- Name: COLUMN "scheduled_tasks"."name"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."scheduled_tasks"."name" IS '任务名称';


--
-- Name: COLUMN "scheduled_tasks"."description"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."scheduled_tasks"."description" IS '任务描述';


--
-- Name: COLUMN "scheduled_tasks"."task_type"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."scheduled_tasks"."task_type" IS '任务类型：send_email=发送邮件, data_cleanup=数据清理, report_generation=报表生成, custom=自定义';


--
-- Name: COLUMN "scheduled_tasks"."cron_expression"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."scheduled_tasks"."cron_expression" IS 'Cron 表达式';


--
-- Name: COLUMN "scheduled_tasks"."enabled"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."scheduled_tasks"."enabled" IS '是否启用';


--
-- Name: COLUMN "scheduled_tasks"."task_config"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."scheduled_tasks"."task_config" IS '任务配置（JSON格式）';


--
-- Name: COLUMN "scheduled_tasks"."last_execution_time"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."scheduled_tasks"."last_execution_time" IS '最后执行时间';


--
-- Name: COLUMN "scheduled_tasks"."next_execution_time"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."scheduled_tasks"."next_execution_time" IS '下次执行时间';


--
-- Name: scheduler_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."scheduler_locks" (
    "id" "text" DEFAULT 'scheduler'::"text" NOT NULL,
    "locked_by" "text" NOT NULL,
    "locked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


--
-- Name: TABLE "scheduler_locks"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."scheduler_locks" IS '调度器分布式锁表';


--
-- Name: short_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."short_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_url" "text" NOT NULL,
    "short_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: TABLE "system_settings"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."system_settings" IS '系统配置表';


--
-- Name: COLUMN "system_settings"."setting_key"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."system_settings"."setting_key" IS '配置键名';


--
-- Name: COLUMN "system_settings"."setting_value"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."system_settings"."setting_value" IS '配置值';


--
-- Name: COLUMN "system_settings"."description"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."system_settings"."description" IS '配置描述';


--
-- Name: table_column_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."table_column_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_name" "text" NOT NULL,
    "column_key" "text" NOT NULL,
    "column_label" "text" NOT NULL,
    "visible" boolean DEFAULT true,
    "order_index" integer NOT NULL,
    "width" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: TABLE "table_column_configs"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."table_column_configs" IS '表格列配置表';


--
-- Name: COLUMN "table_column_configs"."page_name"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."table_column_configs"."page_name" IS '页面名称（如：activities、persons、leaders等）';


--
-- Name: COLUMN "table_column_configs"."column_key"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."table_column_configs"."column_key" IS '列键名（对应数据字段）';


--
-- Name: COLUMN "table_column_configs"."column_label"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."table_column_configs"."column_label" IS '列标签（显示名称）';


--
-- Name: COLUMN "table_column_configs"."visible"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."table_column_configs"."visible" IS '是否显示';


--
-- Name: COLUMN "table_column_configs"."order_index"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."table_column_configs"."order_index" IS '排序索引';


--
-- Name: COLUMN "table_column_configs"."width"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."table_column_configs"."width" IS '列宽度（像素），NULL表示使用默认宽度';


--
-- Name: task_execution_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."task_execution_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "error_message" "text",
    "execution_details" "jsonb",
    CONSTRAINT "task_execution_logs_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'failed'::"text", 'running'::"text"])))
);


--
-- Name: TABLE "task_execution_logs"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."task_execution_logs" IS '任务执行日志表';


--
-- Name: COLUMN "task_execution_logs"."task_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."task_execution_logs"."task_id" IS '关联的任务ID';


--
-- Name: COLUMN "task_execution_logs"."status"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."task_execution_logs"."status" IS '执行状态：success=成功, failed=失败, running=运行中';


--
-- Name: COLUMN "task_execution_logs"."started_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."task_execution_logs"."started_at" IS '开始时间';


--
-- Name: COLUMN "task_execution_logs"."completed_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."task_execution_logs"."completed_at" IS '完成时间';


--
-- Name: COLUMN "task_execution_logs"."error_message"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."task_execution_logs"."error_message" IS '错误信息';


--
-- Name: COLUMN "task_execution_logs"."execution_details"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."task_execution_logs"."execution_details" IS '执行详情（JSON格式）';


--
-- Name: activities activities_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activities_name_unique'
      AND n.nspname = 'public'
      AND c.relname = 'activities'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_name_unique" UNIQUE ("name");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: CONSTRAINT "activities_name_unique" ON "activities"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT "activities_name_unique" ON "public"."activities" IS '活动名称必须唯一';


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activities_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'activities'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_leader_changes activity_leader_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_leader_changes_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_leader_changes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_leader_changes"
    ADD CONSTRAINT "activity_leader_changes_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_leaders activity_leaders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_leaders_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_leaders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_leaders"
    ADD CONSTRAINT "activity_leaders_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_participants activity_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_participants_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "activity_participants_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_types activity_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_types_name_key'
      AND n.nspname = 'public'
      AND c.relname = 'activity_types'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_types"
    ADD CONSTRAINT "activity_types_name_key" UNIQUE ("name");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_types activity_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_types_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_types'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_types"
    ADD CONSTRAINT "activity_types_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: backup_logs backup_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'backup_logs_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'backup_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."backup_logs"
    ADD CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_config email_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'email_config_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'email_config'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."email_config"
    ADD CONSTRAINT "email_config_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_notifications email_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'email_notifications_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'email_notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."email_notifications"
    ADD CONSTRAINT "email_notifications_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_send_logs email_send_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'email_send_logs_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'email_send_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."email_send_logs"
    ADD CONSTRAINT "email_send_logs_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leader_participants leader_participants_activity_id_leader_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'leader_participants_activity_id_leader_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'leader_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."leader_participants"
    ADD CONSTRAINT "leader_participants_activity_id_leader_id_key" UNIQUE ("activity_id", "leader_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leader_participants leader_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'leader_participants_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'leader_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."leader_participants"
    ADD CONSTRAINT "leader_participants_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leaders leaders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'leaders_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'leaders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."leaders"
    ADD CONSTRAINT "leaders_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'persons_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'persons'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."persons"
    ADD CONSTRAINT "persons_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_details promotion_task_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'promotion_task_details_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_details'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."promotion_task_details"
    ADD CONSTRAINT "promotion_task_details_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_details promotion_task_details_record_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'promotion_task_details_record_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_details'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."promotion_task_details"
    ADD CONSTRAINT "promotion_task_details_record_id_key" UNIQUE ("record_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_records promotion_task_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'promotion_task_records_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."promotion_task_records"
    ADD CONSTRAINT "promotion_task_records_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_records promotion_task_records_task_id_record_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'promotion_task_records_task_id_record_date_key'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."promotion_task_records"
    ADD CONSTRAINT "promotion_task_records_task_id_record_date_key" UNIQUE ("task_id", "record_date");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_tasks promotion_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'promotion_tasks_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."promotion_tasks"
    ADD CONSTRAINT "promotion_tasks_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduled_tasks scheduled_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'scheduled_tasks_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'scheduled_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."scheduled_tasks"
    ADD CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduler_locks scheduler_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'scheduler_locks_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'scheduler_locks'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."scheduler_locks"
    ADD CONSTRAINT "scheduler_locks_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: short_links short_links_original_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'short_links_original_url_key'
      AND n.nspname = 'public'
      AND c.relname = 'short_links'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."short_links"
    ADD CONSTRAINT "short_links_original_url_key" UNIQUE ("original_url");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: short_links short_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'short_links_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'short_links'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."short_links"
    ADD CONSTRAINT "short_links_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'system_settings_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'system_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: system_settings system_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'system_settings_setting_key_key'
      AND n.nspname = 'public'
      AND c.relname = 'system_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_setting_key_key" UNIQUE ("setting_key");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: table_column_configs table_column_configs_page_name_column_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'table_column_configs_page_name_column_key_key'
      AND n.nspname = 'public'
      AND c.relname = 'table_column_configs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."table_column_configs"
    ADD CONSTRAINT "table_column_configs_page_name_column_key_key" UNIQUE ("page_name", "column_key");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: table_column_configs table_column_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'table_column_configs_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'table_column_configs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."table_column_configs"
    ADD CONSTRAINT "table_column_configs_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: task_execution_logs task_execution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'task_execution_logs_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'task_execution_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."task_execution_logs"
    ADD CONSTRAINT "task_execution_logs_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: idx_activities_activity_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_activities_activity_type_id" ON "public"."activities" USING "btree" ("activity_type_id");


--
-- Name: idx_activities_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_activities_date" ON "public"."activities" USING "btree" ("start_date" DESC);


--
-- Name: idx_activities_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_activities_status" ON "public"."activities" USING "btree" ("status");


--
-- Name: idx_activity_leader_changes_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_activity_leader_changes_activity" ON "public"."activity_leader_changes" USING "btree" ("activity_id");


--
-- Name: idx_activity_leader_changes_activity_leader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_activity_leader_changes_activity_leader" ON "public"."activity_leader_changes" USING "btree" ("activity_leader_id");


--
-- Name: idx_activity_leader_changes_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_activity_leader_changes_changed_at" ON "public"."activity_leader_changes" USING "btree" ("changed_at" DESC);


--
-- Name: idx_activity_leader_changes_leader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_activity_leader_changes_leader" ON "public"."activity_leader_changes" USING "btree" ("leader_id");


--
-- Name: idx_activity_leaders_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_activity_leaders_activity" ON "public"."activity_leaders" USING "btree" ("activity_id");


--
-- Name: idx_activity_leaders_leader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_activity_leaders_leader" ON "public"."activity_leaders" USING "btree" ("leader_id");


--
-- Name: idx_activity_participants_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_activity_participants_activity" ON "public"."activity_participants" USING "btree" ("activity_id");


--
-- Name: idx_activity_participants_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_activity_participants_person" ON "public"."activity_participants" USING "btree" ("person_id");


--
-- Name: idx_email_notifications_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_email_notifications_enabled" ON "public"."email_notifications" USING "btree" ("enabled");


--
-- Name: idx_email_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_email_notifications_user_id" ON "public"."email_notifications" USING "btree" ("user_id");


--
-- Name: idx_email_send_logs_notification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_email_send_logs_notification_id" ON "public"."email_send_logs" USING "btree" ("notification_id");


--
-- Name: idx_email_send_logs_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_email_send_logs_sent_at" ON "public"."email_send_logs" USING "btree" ("sent_at");


--
-- Name: idx_leader_participants_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_leader_participants_activity_id" ON "public"."leader_participants" USING "btree" ("activity_id");


--
-- Name: idx_leader_participants_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_leader_participants_created_by" ON "public"."leader_participants" USING "btree" ("created_by");


--
-- Name: idx_leader_participants_leader_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_leader_participants_leader_id" ON "public"."leader_participants" USING "btree" ("leader_id");


--
-- Name: idx_leaders_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_leaders_name" ON "public"."leaders" USING "btree" ("name");


--
-- Name: idx_participants_introducer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_participants_introducer" ON "public"."activity_participants" USING "btree" ("introducer_id");


--
-- Name: idx_participants_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_participants_pending" ON "public"."activity_participants" USING "btree" ("is_viewed", "registration_source") WHERE (("is_viewed" = false) AND (("registration_source")::"text" = 'qrcode'::"text"));


--
-- Name: idx_persons_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_persons_name" ON "public"."persons" USING "btree" ("name");


--
-- Name: idx_scheduled_tasks_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_scheduled_tasks_enabled" ON "public"."scheduled_tasks" USING "btree" ("enabled");


--
-- Name: idx_scheduled_tasks_next_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_scheduled_tasks_next_execution" ON "public"."scheduled_tasks" USING "btree" ("next_execution_time");


--
-- Name: idx_system_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_system_settings_key" ON "public"."system_settings" USING "btree" ("setting_key");


--
-- Name: idx_table_column_configs_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_table_column_configs_order" ON "public"."table_column_configs" USING "btree" ("page_name", "order_index");


--
-- Name: idx_table_column_configs_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_table_column_configs_page" ON "public"."table_column_configs" USING "btree" ("page_name");


--
-- Name: idx_task_execution_logs_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_task_execution_logs_started_at" ON "public"."task_execution_logs" USING "btree" ("started_at" DESC);


--
-- Name: idx_task_execution_logs_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_task_execution_logs_task_id" ON "public"."task_execution_logs" USING "btree" ("task_id");


--
-- Name: leaders_name_contact_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS "leaders_name_contact_unique" ON "public"."leaders" USING "btree" ("name", "contact") WHERE (("contact" IS NOT NULL) AND ("contact" <> ''::"text"));


--
-- Name: INDEX "leaders_name_contact_unique"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX "public"."leaders_name_contact_unique" IS '领队的姓名和联系方式组合必须唯一';


--
-- Name: persons_name_contact_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS "persons_name_contact_unique" ON "public"."persons" USING "btree" ("name", "contact") WHERE (("contact" IS NOT NULL) AND ("contact" <> ''::"text"));


--
-- Name: INDEX "persons_name_contact_unique"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX "public"."persons_name_contact_unique" IS '人员的姓名和电话组合必须唯一';


--
-- Name: activity_leaders activity_leaders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "activity_leaders_updated_at" BEFORE UPDATE ON "public"."activity_leaders" FOR EACH ROW EXECUTE FUNCTION "public"."update_activity_leaders_updated_at"();


--
-- Name: activity_participants activity_participants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "activity_participants_updated_at" BEFORE UPDATE ON "public"."activity_participants" FOR EACH ROW EXECUTE FUNCTION "public"."update_activity_participants_updated_at"();


--
-- Name: leaders leaders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "leaders_updated_at" BEFORE UPDATE ON "public"."leaders" FOR EACH ROW EXECUTE FUNCTION "public"."update_leaders_updated_at"();


--
-- Name: activity_leaders trigger_update_activity_total_participants_on_leader_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trigger_update_activity_total_participants_on_leader_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."activity_leaders" FOR EACH ROW EXECUTE FUNCTION "public"."update_activity_total_participants"();


--
-- Name: leader_participants trigger_update_leader_participants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trigger_update_leader_participants_updated_at" BEFORE UPDATE ON "public"."leader_participants" FOR EACH ROW EXECUTE FUNCTION "public"."update_leader_participants_updated_at"();


--
-- Name: activities update_activities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "update_activities_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: persons update_persons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "update_persons_updated_at" BEFORE UPDATE ON "public"."persons" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: activities activities_activity_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activities_activity_type_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'activities'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_activity_type_id_fkey" FOREIGN KEY ("activity_type_id") REFERENCES "public"."activity_types"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_leader_changes activity_leader_changes_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_leader_changes_activity_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_leader_changes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_leader_changes"
    ADD CONSTRAINT "activity_leader_changes_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_leader_changes activity_leader_changes_activity_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_leader_changes_activity_leader_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_leader_changes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_leader_changes"
    ADD CONSTRAINT "activity_leader_changes_activity_leader_id_fkey" FOREIGN KEY ("activity_leader_id") REFERENCES "public"."activity_leaders"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_leader_changes activity_leader_changes_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_leader_changes_changed_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_leader_changes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_leader_changes"
    ADD CONSTRAINT "activity_leader_changes_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_leader_changes activity_leader_changes_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_leader_changes_leader_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_leader_changes'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_leader_changes"
    ADD CONSTRAINT "activity_leader_changes_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."leaders"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_leaders activity_leaders_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_leaders_activity_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_leaders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_leaders"
    ADD CONSTRAINT "activity_leaders_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_leaders activity_leaders_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_leaders_leader_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_leaders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_leaders"
    ADD CONSTRAINT "activity_leaders_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."leaders"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_participants activity_participants_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_participants_activity_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "activity_participants_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_participants activity_participants_introducer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_participants_introducer_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "activity_participants_introducer_id_fkey" FOREIGN KEY ("introducer_id") REFERENCES "public"."leaders"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_participants activity_participants_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'activity_participants_person_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'activity_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "activity_participants_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: backup_logs backup_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'backup_logs_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'backup_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."backup_logs"
    ADD CONSTRAINT "backup_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_notifications email_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'email_notifications_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'email_notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."email_notifications"
    ADD CONSTRAINT "email_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_send_logs email_send_logs_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'email_send_logs_notification_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'email_send_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."email_send_logs"
    ADD CONSTRAINT "email_send_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."email_notifications"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leader_participants leader_participants_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'leader_participants_activity_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'leader_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."leader_participants"
    ADD CONSTRAINT "leader_participants_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leader_participants leader_participants_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'leader_participants_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'leader_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."leader_participants"
    ADD CONSTRAINT "leader_participants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leader_participants leader_participants_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'leader_participants_leader_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'leader_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."leader_participants"
    ADD CONSTRAINT "leader_participants_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."leaders"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_details promotion_task_details_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'promotion_task_details_record_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_details'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."promotion_task_details"
    ADD CONSTRAINT "promotion_task_details_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."promotion_task_records"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_records promotion_task_records_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'promotion_task_records_task_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."promotion_task_records"
    ADD CONSTRAINT "promotion_task_records_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."promotion_tasks"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduled_tasks scheduled_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'scheduled_tasks_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'scheduled_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."scheduled_tasks"
    ADD CONSTRAINT "scheduled_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: task_execution_logs task_execution_logs_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'task_execution_logs_task_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'task_execution_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."task_execution_logs"
    ADD CONSTRAINT "task_execution_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."scheduled_tasks"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: backup_logs Admins can view all backup logs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins can view all backup logs'
      AND n.nspname = 'public'
      AND c.relname = 'backup_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins can view all backup logs" ON "public"."backup_logs" FOR SELECT TO "authenticated" USING (("public"."is_admin"("auth"."uid"()) OR ("auth"."uid"() = "user_id")));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Admins have full access to profiles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins have full access to profiles'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins have full access to profiles" ON "public"."profiles" TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_types Anyone can view activity types; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can view activity types'
      AND n.nspname = 'public'
      AND c.relname = 'activity_types'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can view activity types" ON "public"."activity_types" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_details Anyone can view promotion task details; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can view promotion task details'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_details'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can view promotion task details" ON "public"."promotion_task_details" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_records Anyone can view promotion task records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can view promotion task records'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can view promotion task records" ON "public"."promotion_task_records" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_tasks Anyone can view promotion tasks; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can view promotion tasks'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can view promotion tasks" ON "public"."promotion_tasks" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_types Authenticated users can delete activity types; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can delete activity types'
      AND n.nspname = 'public'
      AND c.relname = 'activity_types'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can delete activity types" ON "public"."activity_types" FOR DELETE USING (("auth"."uid"() IS NOT NULL));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_details Authenticated users can delete promotion task details; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can delete promotion task details'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_details'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can delete promotion task details" ON "public"."promotion_task_details" FOR DELETE USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_records Authenticated users can delete promotion task records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can delete promotion task records'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can delete promotion task records" ON "public"."promotion_task_records" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_tasks Authenticated users can delete promotion tasks; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can delete promotion tasks'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can delete promotion tasks" ON "public"."promotion_tasks" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_types Authenticated users can insert activity types; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can insert activity types'
      AND n.nspname = 'public'
      AND c.relname = 'activity_types'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can insert activity types" ON "public"."activity_types" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_details Authenticated users can insert promotion task details; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can insert promotion task details'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_details'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can insert promotion task details" ON "public"."promotion_task_details" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_records Authenticated users can insert promotion task records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can insert promotion task records'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can insert promotion task records" ON "public"."promotion_task_records" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_tasks Authenticated users can insert promotion tasks; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can insert promotion tasks'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can insert promotion tasks" ON "public"."promotion_tasks" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_types Authenticated users can update activity types; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can update activity types'
      AND n.nspname = 'public'
      AND c.relname = 'activity_types'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can update activity types" ON "public"."activity_types" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_details Authenticated users can update promotion task details; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can update promotion task details'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_details'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can update promotion task details" ON "public"."promotion_task_details" FOR UPDATE USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_records Authenticated users can update promotion task records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can update promotion task records'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_task_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can update promotion task records" ON "public"."promotion_task_records" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_tasks Authenticated users can update promotion tasks; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can update promotion tasks'
      AND n.nspname = 'public'
      AND c.relname = 'promotion_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can update promotion tasks" ON "public"."promotion_tasks" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_notifications Users can create their own email notifications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can create their own email notifications'
      AND n.nspname = 'public'
      AND c.relname = 'email_notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can create their own email notifications" ON "public"."email_notifications" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_notifications Users can delete their own email notifications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can delete their own email notifications'
      AND n.nspname = 'public'
      AND c.relname = 'email_notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can delete their own email notifications" ON "public"."email_notifications" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leader_participants Users can delete their own leader participants; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can delete their own leader participants'
      AND n.nspname = 'public'
      AND c.relname = 'leader_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can delete their own leader participants" ON "public"."leader_participants" FOR DELETE USING (("created_by" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: backup_logs Users can insert their own backup logs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can insert their own backup logs'
      AND n.nspname = 'public'
      AND c.relname = 'backup_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can insert their own backup logs" ON "public"."backup_logs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leader_participants Users can insert their own leader participants; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can insert their own leader participants'
      AND n.nspname = 'public'
      AND c.relname = 'leader_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can insert their own leader participants" ON "public"."leader_participants" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_notifications Users can update their own email notifications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can update their own email notifications'
      AND n.nspname = 'public'
      AND c.relname = 'email_notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can update their own email notifications" ON "public"."email_notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leader_participants Users can update their own leader participants; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can update their own leader participants'
      AND n.nspname = 'public'
      AND c.relname = 'leader_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can update their own leader participants" ON "public"."leader_participants" FOR UPDATE USING (("created_by" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can update their own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK ((NOT ("role" IS DISTINCT FROM ( SELECT "profiles_1"."role"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."id" = "auth"."uid"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_notifications Users can view their own email notifications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view their own email notifications'
      AND n.nspname = 'public'
      AND c.relname = 'email_notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view their own email notifications" ON "public"."email_notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leader_participants Users can view their own leader participants; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view their own leader participants'
      AND n.nspname = 'public'
      AND c.relname = 'leader_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view their own leader participants" ON "public"."leader_participants" FOR SELECT USING (("created_by" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view their own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;

--
-- Name: activities activities_auth_policy; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'activities_auth_policy'
      AND n.nspname = 'public'
      AND c.relname = 'activities'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "activities_auth_policy" ON "public"."activities" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activities activities_read_anon_policy; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'activities_read_anon_policy'
      AND n.nspname = 'public'
      AND c.relname = 'activities'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "activities_read_anon_policy" ON "public"."activities" FOR SELECT TO "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_leader_changes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."activity_leader_changes" ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_leaders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."activity_leaders" ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_leaders activity_leaders_auth_all_policy; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'activity_leaders_auth_all_policy'
      AND n.nspname = 'public'
      AND c.relname = 'activity_leaders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "activity_leaders_auth_all_policy" ON "public"."activity_leaders" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_leaders"."activity_id") AND (("a"."user_id" = "auth"."uid"()) OR "public"."is_admin"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_leaders"."activity_id") AND (("a"."user_id" = "auth"."uid"()) OR "public"."is_admin"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."activity_participants" ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."activity_types" ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."backup_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: email_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."email_config" ENABLE ROW LEVEL SECURITY;

--
-- Name: email_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."email_notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."email_send_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: leader_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."leader_participants" ENABLE ROW LEVEL SECURITY;

--
-- Name: leaders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."leaders" ENABLE ROW LEVEL SECURITY;

--
-- Name: leaders leaders_auth_policy; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'leaders_auth_policy'
      AND n.nspname = 'public'
      AND c.relname = 'leaders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "leaders_auth_policy" ON "public"."leaders" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_participants participants_anon_insert_policy; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'participants_anon_insert_policy'
      AND n.nspname = 'public'
      AND c.relname = 'activity_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "participants_anon_insert_policy" ON "public"."activity_participants" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_participants participants_auth_all_policy; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'participants_auth_all_policy'
      AND n.nspname = 'public'
      AND c.relname = 'activity_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "participants_auth_all_policy" ON "public"."activity_participants" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_participants"."activity_id") AND (("a"."user_id" = "auth"."uid"()) OR "public"."is_admin"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_participants"."activity_id") AND (("a"."user_id" = "auth"."uid"()) OR "public"."is_admin"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_participants participants_auth_read_policy; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'participants_auth_read_policy'
      AND n.nspname = 'public'
      AND c.relname = 'activity_participants'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "participants_auth_read_policy" ON "public"."activity_participants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_participants"."activity_id") AND (("a"."user_id" = "auth"."uid"()) OR "public"."is_admin"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: persons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."persons" ENABLE ROW LEVEL SECURITY;

--
-- Name: persons persons_auth_policy; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'persons_auth_policy'
      AND n.nspname = 'public'
      AND c.relname = 'persons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "persons_auth_policy" ON "public"."persons" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: promotion_task_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."promotion_task_details" ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_task_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."promotion_task_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."promotion_tasks" ENABLE ROW LEVEL SECURITY;

--
-- Name: table_column_configs root用户可以修改列配置; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'root用户可以修改列配置'
      AND n.nspname = 'public'
      AND c.relname = 'table_column_configs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "root用户可以修改列配置" ON "public"."table_column_configs" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."username" = 'root'::"text")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_send_logs root用户可以查看所有邮件发送日志; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'root用户可以查看所有邮件发送日志'
      AND n.nspname = 'public'
      AND c.relname = 'email_send_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "root用户可以查看所有邮件发送日志" ON "public"."email_send_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."username" = 'root'::"text")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduled_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."scheduled_tasks" ENABLE ROW LEVEL SECURITY;

--
-- Name: short_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."short_links" ENABLE ROW LEVEL SECURITY;

--
-- Name: short_links short_links_insert_service; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'short_links_insert_service'
      AND n.nspname = 'public'
      AND c.relname = 'short_links'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "short_links_insert_service" ON "public"."short_links" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: short_links short_links_select_all; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'short_links_select_all'
      AND n.nspname = 'public'
      AND c.relname = 'short_links'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "short_links_select_all" ON "public"."short_links" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: table_column_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."table_column_configs" ENABLE ROW LEVEL SECURITY;

--
-- Name: task_execution_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."task_execution_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings 只有root用户可以修改系统配置; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '只有root用户可以修改系统配置'
      AND n.nspname = 'public'
      AND c.relname = 'system_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "只有root用户可以修改系统配置" ON "public"."system_settings" TO "authenticated" USING ("public"."is_root_user"()) WITH CHECK ("public"."is_root_user"());
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_config 只有root用户可以访问邮箱配置; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '只有root用户可以访问邮箱配置'
      AND n.nspname = 'public'
      AND c.relname = 'email_config'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "只有root用户可以访问邮箱配置" ON "public"."email_config" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."username" = 'root'::"text")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: table_column_configs 所有用户可以查看列配置; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '所有用户可以查看列配置'
      AND n.nspname = 'public'
      AND c.relname = 'table_column_configs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "所有用户可以查看列配置" ON "public"."table_column_configs" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: system_settings 所有用户可以查看系统配置; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '所有用户可以查看系统配置'
      AND n.nspname = 'public'
      AND c.relname = 'system_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "所有用户可以查看系统配置" ON "public"."system_settings" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: persons 用户可以创建人员; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以创建人员'
      AND n.nspname = 'public'
      AND c.relname = 'persons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以创建人员" ON "public"."persons" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activities 用户可以创建活动; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以创建活动'
      AND n.nspname = 'public'
      AND c.relname = 'activities'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以创建活动" ON "public"."activities" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_leader_changes 用户可以创建自己活动的变更记录; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以创建自己活动的变更记录'
      AND n.nspname = 'public'
      AND c.relname = 'activity_leader_changes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以创建自己活动的变更记录" ON "public"."activity_leader_changes" FOR INSERT WITH CHECK (("activity_id" IN ( SELECT "activities"."id"
   FROM "public"."activities"
  WHERE ("activities"."user_id" = "auth"."uid"()))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduled_tasks 用户可以创建自己的定时任务; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以创建自己的定时任务'
      AND n.nspname = 'public'
      AND c.relname = 'scheduled_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以创建自己的定时任务" ON "public"."scheduled_tasks" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leaders 用户可以创建领队; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以创建领队'
      AND n.nspname = 'public'
      AND c.relname = 'leaders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以创建领队" ON "public"."leaders" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: persons 用户可以删除自己的人员; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以删除自己的人员'
      AND n.nspname = 'public'
      AND c.relname = 'persons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以删除自己的人员" ON "public"."persons" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduled_tasks 用户可以删除自己的定时任务; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以删除自己的定时任务'
      AND n.nspname = 'public'
      AND c.relname = 'scheduled_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以删除自己的定时任务" ON "public"."scheduled_tasks" FOR DELETE USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role"))))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activities 用户可以删除自己的活动; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以删除自己的活动'
      AND n.nspname = 'public'
      AND c.relname = 'activities'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以删除自己的活动" ON "public"."activities" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leaders 用户可以删除自己的领队; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以删除自己的领队'
      AND n.nspname = 'public'
      AND c.relname = 'leaders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以删除自己的领队" ON "public"."leaders" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: persons 用户可以更新自己的人员; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以更新自己的人员'
      AND n.nspname = 'public'
      AND c.relname = 'persons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以更新自己的人员" ON "public"."persons" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduled_tasks 用户可以更新自己的定时任务; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以更新自己的定时任务'
      AND n.nspname = 'public'
      AND c.relname = 'scheduled_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以更新自己的定时任务" ON "public"."scheduled_tasks" FOR UPDATE USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role"))))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activities 用户可以更新自己的活动; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以更新自己的活动'
      AND n.nspname = 'public'
      AND c.relname = 'activities'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以更新自己的活动" ON "public"."activities" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles 用户可以更新自己的资料; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以更新自己的资料'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以更新自己的资料" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK ((NOT ("role" IS DISTINCT FROM ( SELECT "profiles_1"."role"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."id" = "auth"."uid"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leaders 用户可以更新自己的领队; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以更新自己的领队'
      AND n.nspname = 'public'
      AND c.relname = 'leaders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以更新自己的领队" ON "public"."leaders" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activity_leader_changes 用户可以查看自己创建的活动的变更记录; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以查看自己创建的活动的变更记录'
      AND n.nspname = 'public'
      AND c.relname = 'activity_leader_changes'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以查看自己创建的活动的变更记录" ON "public"."activity_leader_changes" FOR SELECT USING (("activity_id" IN ( SELECT "activities"."id"
   FROM "public"."activities"
  WHERE ("activities"."user_id" = "auth"."uid"()))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: persons 用户可以查看自己的人员; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以查看自己的人员'
      AND n.nspname = 'public'
      AND c.relname = 'persons'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以查看自己的人员" ON "public"."persons" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduled_tasks 用户可以查看自己的定时任务; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以查看自己的定时任务'
      AND n.nspname = 'public'
      AND c.relname = 'scheduled_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以查看自己的定时任务" ON "public"."scheduled_tasks" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role"))))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: activities 用户可以查看自己的活动; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以查看自己的活动'
      AND n.nspname = 'public'
      AND c.relname = 'activities'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以查看自己的活动" ON "public"."activities" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles 用户可以查看自己的资料; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以查看自己的资料'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以查看自己的资料" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: email_send_logs 用户可以查看自己的邮件发送日志; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以查看自己的邮件发送日志'
      AND n.nspname = 'public'
      AND c.relname = 'email_send_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以查看自己的邮件发送日志" ON "public"."email_send_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."email_notifications"
  WHERE (("email_notifications"."id" = "email_send_logs"."notification_id") AND ("email_notifications"."user_id" = "auth"."uid"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leaders 用户可以查看自己的领队; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户可以查看自己的领队'
      AND n.nspname = 'public'
      AND c.relname = 'leaders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户可以查看自己的领队" ON "public"."leaders" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduled_tasks 管理员可以创建定时任务; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '管理员可以创建定时任务'
      AND n.nspname = 'public'
      AND c.relname = 'scheduled_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "管理员可以创建定时任务" ON "public"."scheduled_tasks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduled_tasks 管理员可以删除定时任务; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '管理员可以删除定时任务'
      AND n.nspname = 'public'
      AND c.relname = 'scheduled_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "管理员可以删除定时任务" ON "public"."scheduled_tasks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduled_tasks 管理员可以更新定时任务; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '管理员可以更新定时任务'
      AND n.nspname = 'public'
      AND c.relname = 'scheduled_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "管理员可以更新定时任务" ON "public"."scheduled_tasks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: task_execution_logs 管理员可以查看所有任务执行日志; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '管理员可以查看所有任务执行日志'
      AND n.nspname = 'public'
      AND c.relname = 'task_execution_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "管理员可以查看所有任务执行日志" ON "public"."task_execution_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: scheduled_tasks 管理员可以查看所有定时任务; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '管理员可以查看所有定时任务'
      AND n.nspname = 'public'
      AND c.relname = 'scheduled_tasks'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "管理员可以查看所有定时任务" ON "public"."scheduled_tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles 管理员可以访问所有用户资料; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '管理员可以访问所有用户资料'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "管理员可以访问所有用户资料" ON "public"."profiles" TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- PostgreSQL database dump complete
--




-- ============================================================
-- SECTION: DIFF FILTER OBJECTS
-- ============================================================
-- Objects that match diff-filter.json but cannot be represented
-- precisely by pg_dump --filter.

-- auth.users trigger: on_auth_user_confirmed
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND t.tgname = 'on_auth_user_confirmed'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_confirmed AFTER UPDATE ON auth.users FOR EACH ROW WHEN (old.confirmed_at IS NULL AND new.confirmed_at IS NOT NULL) EXECUTE FUNCTION public.handle_new_user();';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow public delete" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public delete'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow public delete" ON storage.objects AS PERMISSIVE FOR DELETE TO PUBLIC USING ((bucket_id = ''app-99gqsi7u251d_person_images''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow public read" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public read'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow public read" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''app-99gqsi7u251d_person_images''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow public upload" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public upload'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow public upload" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((bucket_id = ''app-99gqsi7u251d_person_images''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Anyone can view avatars" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can view avatars'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can view avatars" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''app-99gqsi7u251d_user_avatars''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Users can delete their own avatars" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can delete their own avatars'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their own avatars" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = ''app-99gqsi7u251d_user_avatars''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Users can update their own avatars" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can update their own avatars'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own avatars" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = ''app-99gqsi7u251d_user_avatars''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Users can upload their own avatars" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can upload their own avatars'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can upload their own avatars" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = ''app-99gqsi7u251d_user_avatars''::text));';
  END IF;
END
$pg_schema_restore$;

-- ============================================================
-- SECTION: STORAGE BUCKETS DATA
-- ============================================================

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('app-99gqsi7u251d_person_images', 'app-99gqsi7u251d_person_images', NULL, '2026-01-29 08:38:00.512268+00', '2026-01-29 08:38:00.512268+00', 'true', 'false', '1048576', '{image/jpeg,image/png,image/gif,image/webp,image/avif}', NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('app-99gqsi7u251d_user_avatars', 'app-99gqsi7u251d_user_avatars', NULL, '2026-03-24 09:47:13.724634+00', '2026-03-24 09:47:13.724634+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";

-- ============================================================
-- SECTION: CRON JOBS
-- ============================================================
-- 用户自定义 pg_cron 任务。

