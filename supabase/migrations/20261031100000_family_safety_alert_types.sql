-- Expand family safety alert types for Feature Scope (Family Dashboard).
-- Additive: keeps existing rows valid; adds suspicious_link + excessive_usage.

ALTER TABLE public.safety_alerts
  DROP CONSTRAINT IF EXISTS safety_alerts_alert_type_check;

ALTER TABLE public.safety_alerts
  ADD CONSTRAINT safety_alerts_alert_type_check CHECK (alert_type IN (
    'suspicious_contact',
    'reported_content',
    'bullying',
    'harassment',
    'sexual_content',
    'self_harm_risk',
    'dangerous_content',
    'multiple_reports',
    'account_compromise',
    'suspicious_link',
    'excessive_usage'
  ));
