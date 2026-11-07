ALTER TABLE organizations ADD COLUMN last_business_activity_at TIMESTAMP(3), ADD COLUMN retention_review_at TIMESTAMP(3);

-- Reprise fondée sur les contributions : ni connexion du propriétaire, ni exécution d'une tâche.
UPDATE organizations o SET last_business_activity_at = a.last_activity
FROM (
 SELECT organization_id, MAX(activity_at) AS last_activity FROM (
  SELECT organization_id, created_at AS activity_at FROM scheduled_sessions
  UNION ALL SELECT s.organization_id, l.completed_at FROM session_logs l JOIN scheduled_sessions s ON s.id = l.scheduled_session_id WHERE l.completed_at IS NOT NULL
  UNION ALL SELECT s.organization_id, a.updated_at FROM attendance a JOIN scheduled_sessions s ON s.id = a.scheduled_session_id
  UNION ALL SELECT organization_id, updated_at FROM strength_tests
  UNION ALL SELECT organization_id, updated_at FROM performances
  UNION ALL SELECT organization_id, created_at FROM comments
  UNION ALL SELECT organization_id, created_at FROM announcements
 ) contributions GROUP BY organization_id
) a WHERE o.id = a.organization_id;

CREATE FUNCTION record_workspace_activity() RETURNS trigger AS $$
DECLARE target_id UUID;
BEGIN
 IF TG_TABLE_NAME = 'scheduled_sessions' THEN
  -- Publication automatique et rafraîchissement de timestamp ne sont pas une contribution.
  IF TG_OP = 'UPDATE' AND ROW(NEW.draft, NEW.title, NEW.date, NEW.start_time, NEW.location)
    IS NOT DISTINCT FROM ROW(OLD.draft, OLD.title, OLD.date, OLD.start_time, OLD.location) THEN RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME = 'session_logs' THEN
  -- Le cron crée les « manquées » et renseigne les relances, sans prolonger la conservation.
  IF NEW.completed_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - ARRAY['updated_at','reminder_sent_at'])
    IS NOT DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at','reminder_sent_at']) THEN RETURN NEW; END IF;
 ELSIF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - ARRAY['updated_at','is_pb'])
    IS NOT DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at','is_pb']) THEN RETURN NEW;
 END IF;
 IF TG_TABLE_NAME IN ('session_logs','attendance') THEN
  SELECT organization_id INTO target_id FROM scheduled_sessions WHERE id = NEW.scheduled_session_id;
 ELSE target_id := NEW.organization_id;
 END IF;
 UPDATE organizations SET last_business_activity_at = CURRENT_TIMESTAMP WHERE id = target_id;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_session_activity AFTER INSERT OR UPDATE ON scheduled_sessions FOR EACH ROW EXECUTE FUNCTION record_workspace_activity();
CREATE TRIGGER workspace_log_activity AFTER INSERT OR UPDATE ON session_logs FOR EACH ROW EXECUTE FUNCTION record_workspace_activity();
CREATE TRIGGER workspace_attendance_activity AFTER INSERT OR UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION record_workspace_activity();
CREATE TRIGGER workspace_strength_activity AFTER INSERT OR UPDATE ON strength_tests FOR EACH ROW EXECUTE FUNCTION record_workspace_activity();
CREATE TRIGGER workspace_performance_activity AFTER INSERT OR UPDATE ON performances FOR EACH ROW EXECUTE FUNCTION record_workspace_activity();
CREATE TRIGGER workspace_comment_activity AFTER INSERT OR UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION record_workspace_activity();
CREATE TRIGGER workspace_announcement_activity AFTER INSERT OR UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION record_workspace_activity();
