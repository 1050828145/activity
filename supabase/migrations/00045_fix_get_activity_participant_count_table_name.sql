CREATE OR REPLACE FUNCTION public.get_activity_participant_count(activity_uuid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$;
