-- Configuration defaults (not sample data): integration rows and notification templates.
set local search_path = bolt, pg_temp;

insert into integration_settings (key, enabled, config) values
  ('app', true, '{"organisation": "Bolt Academy", "support_contact": "", "appointment_reminder_hours": 2, "event_reminder_hours": 24}'),
  ('email', false, '{}'), ('whatsapp', false, '{}'), ('aisensy', false, '{}'), ('pabbly', false, '{}'), ('meta', false, '{}');

insert into notification_templates (type, channel, subject, body)
select t.type::notif_type, c.channel::notif_channel, case when c.channel = 'email' then t.subject else '' end, t.body
from (values
  ('booking_confirmation', 'Booking confirmed: {{event_name}} ({{reference}})',
   E'Hi {{participant_name}},\n\nYour appointment for {{event_name}} is confirmed.\n\nBooking ID: {{reference}}\nDate: {{date}}\nTime: {{time}}\nLocation: {{location}}\n\nManage your booking: {{manage_link}}\n\nBolt Academy'),
  ('booking_cancellation', 'Booking cancelled: {{event_name}} ({{reference}})',
   E'Hi {{participant_name}},\n\nYour booking {{reference}} for {{event_name}} on {{date}}, {{time}} has been cancelled.\n\nBolt Academy'),
  ('booking_rescheduling', 'Booking rescheduled: {{event_name}} ({{reference}})',
   E'Hi {{participant_name}},\n\nYour booking {{reference}} for {{event_name}} has moved to {{date}}, {{time}}.\n\nManage your booking: {{manage_link}}\n\nBolt Academy'),
  ('appointment_reminder', 'Reminder: {{event_name}} at {{time}}',
   E'Hi {{participant_name}},\n\nThis is a reminder of your {{event_name}} appointment on {{date}}, {{time}}.\nLocation: {{location}}\n\nManage your booking: {{manage_link}}'),
  ('event_reminder', 'Coming up: {{event_name}} on {{date}}',
   E'Hi {{participant_name}},\n\n{{event_name}} is coming up. Your appointment is on {{date}}, {{time}}.\nLocation: {{location}}\n\nManage your booking: {{manage_link}}'),
  ('staff_assignment', 'New assignment: {{event_name}} ({{reference}})',
   E'Hi {{staff_name}},\n\nYou have been assigned booking {{reference}} for {{event_name}} on {{date}}, {{time}}.\n\nPlease sign in to Bolt Events for details.')
) t(type, subject, body) cross join (values ('email'), ('whatsapp'), ('aisensy'), ('pabbly')) c(channel);
