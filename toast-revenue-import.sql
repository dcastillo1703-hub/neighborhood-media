alter table weekly_metrics add column if not exists net_sales numeric(12,2);
alter table weekly_metrics add column if not exists total_orders integer;

update client_settings
set average_check = 49.79,
    monthly_covers = 1011,
    weekly_covers = 233,
    guests_per_table = 2.78
where client_id = 'client-meama';

delete from weekly_metrics
where client_id = 'client-meama';

insert into weekly_metrics (id, client_id, week_label, covers, net_sales, total_orders, notes, created_at)
values
  ('wm-toast-1', 'client-meama', 'Sep 29', 780, 8759.55, 97, 'Toast import · 97 orders · $8,759.55 net sales.', '2025-10-05T00:00:00.000Z'),
  ('wm-toast-2', 'client-meama', 'Oct 6', 672, 11396.70, 103, 'Toast import · 103 orders · $11,396.70 net sales.', '2025-10-12T00:00:00.000Z'),
  ('wm-toast-3', 'client-meama', 'Oct 13', 314, 14769.50, 113, 'Toast import · 113 orders · $14,769.50 net sales.', '2025-10-19T00:00:00.000Z'),
  ('wm-toast-4', 'client-meama', 'Oct 20', 297, 14533.80, 110, 'Toast import · 110 orders · $14,533.80 net sales.', '2025-10-26T00:00:00.000Z'),
  ('wm-toast-5', 'client-meama', 'Oct 27', 146, 6693.68, 62, 'Toast import · 62 orders · $6,693.68 net sales.', '2025-11-02T00:00:00.000Z'),
  ('wm-toast-6', 'client-meama', 'Nov 3', 214, 9707.80, 73, 'Toast import · 73 orders · $9,707.80 net sales.', '2025-11-09T00:00:00.000Z'),
  ('wm-toast-7', 'client-meama', 'Nov 10', 182, 9833.70, 70, 'Toast import · 70 orders · $9,833.70 net sales.', '2025-11-16T00:00:00.000Z'),
  ('wm-toast-8', 'client-meama', 'Nov 17', 142, 6941.15, 56, 'Toast import · 56 orders · $6,941.15 net sales.', '2025-11-23T00:00:00.000Z'),
  ('wm-toast-9', 'client-meama', 'Nov 24', 84, 3977.00, 28, 'Toast import · 28 orders · $3,977.00 net sales.', '2025-11-30T00:00:00.000Z'),
  ('wm-toast-10', 'client-meama', 'Dec 1', 224, 11394.90, 80, 'Toast import · 80 orders · $11,394.90 net sales.', '2025-12-07T00:00:00.000Z'),
  ('wm-toast-11', 'client-meama', 'Dec 8', 303, 14675.28, 97, 'Toast import · 97 orders · $14,675.28 net sales.', '2025-12-14T00:00:00.000Z'),
  ('wm-toast-12', 'client-meama', 'Dec 15', 166, 7787.95, 58, 'Toast import · 58 orders · $7,787.95 net sales.', '2025-12-21T00:00:00.000Z'),
  ('wm-toast-13', 'client-meama', 'Dec 22', 54, 2299.44, 21, 'Toast import · 21 orders · $2,299.44 net sales.', '2025-12-28T00:00:00.000Z'),
  ('wm-toast-14', 'client-meama', 'Dec 29', 169, 8154.20, 56, 'Toast import · 56 orders · $8,154.20 net sales.', '2026-01-04T00:00:00.000Z'),
  ('wm-toast-15', 'client-meama', 'Jan 5', 142, 6323.95, 60, 'Toast import · 60 orders · $6,323.95 net sales.', '2026-01-11T00:00:00.000Z'),
  ('wm-toast-16', 'client-meama', 'Jan 12', 206, 9485.03, 66, 'Toast import · 66 orders · $9,485.03 net sales.', '2026-01-18T00:00:00.000Z'),
  ('wm-toast-17', 'client-meama', 'Jan 19', 137, 6647.20, 54, 'Toast import · 54 orders · $6,647.20 net sales.', '2026-01-25T00:00:00.000Z'),
  ('wm-toast-18', 'client-meama', 'Jan 26', 142, 6749.00, 57, 'Toast import · 57 orders · $6,749.00 net sales.', '2026-02-01T00:00:00.000Z'),
  ('wm-toast-19', 'client-meama', 'Feb 2', 556, 6560.52, 54, 'Toast import · 54 orders · $6,560.52 net sales.', '2026-02-08T00:00:00.000Z'),
  ('wm-toast-20', 'client-meama', 'Feb 9', 660, 12664.13, 86, 'Toast import · 86 orders · $12,664.13 net sales.', '2026-02-15T00:00:00.000Z'),
  ('wm-toast-21', 'client-meama', 'Feb 16', 224, 10601.30, 73, 'Toast import · 73 orders · $10,601.30 net sales.', '2026-02-22T00:00:00.000Z'),
  ('wm-toast-22', 'client-meama', 'Feb 23', 220, 11487.15, 76, 'Toast import · 76 orders · $11,487.15 net sales.', '2026-03-01T00:00:00.000Z'),
  ('wm-toast-23', 'client-meama', 'Mar 2', 209, 10119.85, 77, 'Toast import · 77 orders · $10,119.85 net sales.', '2026-03-08T00:00:00.000Z'),
  ('wm-toast-24', 'client-meama', 'Mar 9', 201, 9650.30, 82, 'Toast import · 82 orders · $9,650.30 net sales.', '2026-03-15T00:00:00.000Z'),
  ('wm-toast-25', 'client-meama', 'Mar 16', 286, 15764.00, 88, 'Toast import · 88 orders · $15,764.00 net sales.', '2026-03-22T00:00:00.000Z'),
  ('wm-toast-26', 'client-meama', 'Mar 23', 272, 12868.25, 96, 'Toast import · 96 orders · $12,868.25 net sales.', '2026-03-29T00:00:00.000Z'),
  ('wm-toast-27', 'client-meama', 'Mar 30', 31, 1154.19, 14, 'Toast import · 14 orders · $1,154.19 net sales.', '2026-04-05T00:00:00.000Z');
