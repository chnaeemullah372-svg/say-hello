-- A customer can have a second WhatsApp number (e.g. accountant/owner) that
-- invoices and reminders should also go to, alongside the primary one.
alter table public.customers add column if not exists whatsapp2 text;
