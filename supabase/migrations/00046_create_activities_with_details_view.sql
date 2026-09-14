DROP VIEW IF EXISTS activities_with_details;
CREATE VIEW activities_with_details AS
 SELECT a.*,
    at.name AS activity_type_name,
    get_activity_participant_count(a.id) AS participant_count
   FROM activities a
   LEFT JOIN activity_types at ON a.activity_type_id = at.id;
