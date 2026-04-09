import type { DayOfWeek, WeeklyMetric } from "@/types";

export const meamaToastMonthlySnapshots = [
  {
    monthKey: "2025-10",
    monthLabel: "Oct 2025",
    covers: 2124,
    orders: 448,
    revenue: 52995.43,
    averageCheck: 24.95,
    guestsPerTable: 4.74
  },
  {
    monthKey: "2025-11",
    monthLabel: "Nov 2025",
    covers: 707,
    orders: 264,
    revenue: 33617.45,
    averageCheck: 47.55,
    guestsPerTable: 2.68
  },
  {
    monthKey: "2025-12",
    monthLabel: "Dec 2025",
    covers: 825,
    orders: 282,
    revenue: 39781.87,
    averageCheck: 48.22,
    guestsPerTable: 2.93
  },
  {
    monthKey: "2026-01",
    monthLabel: "Jan 2026",
    covers: 707,
    orders: 261,
    revenue: 33398.08,
    averageCheck: 47.24,
    guestsPerTable: 2.71
  },
  {
    monthKey: "2026-02",
    monthLabel: "Feb 2026",
    covers: 1659,
    orders: 288,
    revenue: 40865.1,
    averageCheck: 24.63,
    guestsPerTable: 5.76
  },
  {
    monthKey: "2026-03",
    monthLabel: "Mar 2026",
    covers: 1011,
    orders: 364,
    revenue: 50341.59,
    averageCheck: 49.79,
    guestsPerTable: 2.78
  }
] as const;

export const meamaLatestToastSnapshot =
  meamaToastMonthlySnapshots[meamaToastMonthlySnapshots.length - 1];

export const meamaToastWeekdayBaseline: Array<{
  day: DayOfWeek;
  averageCovers: number;
  averageOrders: number;
  averageRevenue: number;
}> = [
  { day: "Monday", averageCovers: 13.87, averageOrders: 5.391, averageRevenue: 637.58 },
  { day: "Tuesday", averageCovers: 47.038, averageOrders: 5.731, averageRevenue: 702.24 },
  { day: "Wednesday", averageCovers: 24.36, averageOrders: 9, averageRevenue: 1190.44 },
  { day: "Thursday", averageCovers: 21.435, averageOrders: 8.043, averageRevenue: 1055.97 },
  { day: "Friday", averageCovers: 44.654, averageOrders: 15.654, averageRevenue: 2266.82 },
  { day: "Saturday", averageCovers: 82.038, averageOrders: 23.154, averageRevenue: 3133.42 },
  { day: "Sunday", averageCovers: 43.8, averageOrders: 8.6, averageRevenue: 944.89 }
];

export const meamaToastWeeklyMetrics: WeeklyMetric[] = [
  {
    id: "wm-toast-1",
    clientId: "client-meama",
    weekLabel: "Sep 29",
    covers: 780,
    netSales: 8759.55,
    totalOrders: 97,
    notes: "Toast import · 97 orders · $8,759.55 net sales.",
    createdAt: "2025-10-05T00:00:00.000Z"
  },
  {
    id: "wm-toast-2",
    clientId: "client-meama",
    weekLabel: "Oct 6",
    covers: 672,
    netSales: 11396.7,
    totalOrders: 103,
    notes: "Toast import · 103 orders · $11,396.70 net sales.",
    createdAt: "2025-10-12T00:00:00.000Z"
  },
  {
    id: "wm-toast-3",
    clientId: "client-meama",
    weekLabel: "Oct 13",
    covers: 314,
    netSales: 14769.5,
    totalOrders: 113,
    notes: "Toast import · 113 orders · $14,769.50 net sales.",
    createdAt: "2025-10-19T00:00:00.000Z"
  },
  {
    id: "wm-toast-4",
    clientId: "client-meama",
    weekLabel: "Oct 20",
    covers: 297,
    netSales: 14533.8,
    totalOrders: 110,
    notes: "Toast import · 110 orders · $14,533.80 net sales.",
    createdAt: "2025-10-26T00:00:00.000Z"
  },
  {
    id: "wm-toast-5",
    clientId: "client-meama",
    weekLabel: "Oct 27",
    covers: 146,
    netSales: 6693.68,
    totalOrders: 62,
    notes: "Toast import · 62 orders · $6,693.68 net sales.",
    createdAt: "2025-11-02T00:00:00.000Z"
  },
  {
    id: "wm-toast-6",
    clientId: "client-meama",
    weekLabel: "Nov 3",
    covers: 214,
    netSales: 9707.8,
    totalOrders: 73,
    notes: "Toast import · 73 orders · $9,707.80 net sales.",
    createdAt: "2025-11-09T00:00:00.000Z"
  },
  {
    id: "wm-toast-7",
    clientId: "client-meama",
    weekLabel: "Nov 10",
    covers: 182,
    netSales: 9833.7,
    totalOrders: 70,
    notes: "Toast import · 70 orders · $9,833.70 net sales.",
    createdAt: "2025-11-16T00:00:00.000Z"
  },
  {
    id: "wm-toast-8",
    clientId: "client-meama",
    weekLabel: "Nov 17",
    covers: 142,
    netSales: 6941.15,
    totalOrders: 56,
    notes: "Toast import · 56 orders · $6,941.15 net sales.",
    createdAt: "2025-11-23T00:00:00.000Z"
  },
  {
    id: "wm-toast-9",
    clientId: "client-meama",
    weekLabel: "Nov 24",
    covers: 84,
    netSales: 3977,
    totalOrders: 28,
    notes: "Toast import · 28 orders · $3,977.00 net sales.",
    createdAt: "2025-11-30T00:00:00.000Z"
  },
  {
    id: "wm-toast-10",
    clientId: "client-meama",
    weekLabel: "Dec 1",
    covers: 224,
    netSales: 11394.9,
    totalOrders: 80,
    notes: "Toast import · 80 orders · $11,394.90 net sales.",
    createdAt: "2025-12-07T00:00:00.000Z"
  },
  {
    id: "wm-toast-11",
    clientId: "client-meama",
    weekLabel: "Dec 8",
    covers: 303,
    netSales: 14675.28,
    totalOrders: 97,
    notes: "Toast import · 97 orders · $14,675.28 net sales.",
    createdAt: "2025-12-14T00:00:00.000Z"
  },
  {
    id: "wm-toast-12",
    clientId: "client-meama",
    weekLabel: "Dec 15",
    covers: 166,
    netSales: 7787.95,
    totalOrders: 58,
    notes: "Toast import · 58 orders · $7,787.95 net sales.",
    createdAt: "2025-12-21T00:00:00.000Z"
  },
  {
    id: "wm-toast-13",
    clientId: "client-meama",
    weekLabel: "Dec 22",
    covers: 54,
    netSales: 2299.44,
    totalOrders: 21,
    notes: "Toast import · 21 orders · $2,299.44 net sales.",
    createdAt: "2025-12-28T00:00:00.000Z"
  },
  {
    id: "wm-toast-14",
    clientId: "client-meama",
    weekLabel: "Dec 29",
    covers: 169,
    netSales: 8154.2,
    totalOrders: 56,
    notes: "Toast import · 56 orders · $8,154.20 net sales.",
    createdAt: "2026-01-04T00:00:00.000Z"
  },
  {
    id: "wm-toast-15",
    clientId: "client-meama",
    weekLabel: "Jan 5",
    covers: 142,
    netSales: 6323.95,
    totalOrders: 60,
    notes: "Toast import · 60 orders · $6,323.95 net sales.",
    createdAt: "2026-01-11T00:00:00.000Z"
  },
  {
    id: "wm-toast-16",
    clientId: "client-meama",
    weekLabel: "Jan 12",
    covers: 206,
    netSales: 9485.03,
    totalOrders: 66,
    notes: "Toast import · 66 orders · $9,485.03 net sales.",
    createdAt: "2026-01-18T00:00:00.000Z"
  },
  {
    id: "wm-toast-17",
    clientId: "client-meama",
    weekLabel: "Jan 19",
    covers: 137,
    netSales: 6647.2,
    totalOrders: 54,
    notes: "Toast import · 54 orders · $6,647.20 net sales.",
    createdAt: "2026-01-25T00:00:00.000Z"
  },
  {
    id: "wm-toast-18",
    clientId: "client-meama",
    weekLabel: "Jan 26",
    covers: 142,
    netSales: 6749,
    totalOrders: 57,
    notes: "Toast import · 57 orders · $6,749.00 net sales.",
    createdAt: "2026-02-01T00:00:00.000Z"
  },
  {
    id: "wm-toast-19",
    clientId: "client-meama",
    weekLabel: "Feb 2",
    covers: 556,
    netSales: 6560.52,
    totalOrders: 54,
    notes: "Toast import · 54 orders · $6,560.52 net sales.",
    createdAt: "2026-02-08T00:00:00.000Z"
  },
  {
    id: "wm-toast-20",
    clientId: "client-meama",
    weekLabel: "Feb 9",
    covers: 660,
    netSales: 12664.13,
    totalOrders: 86,
    notes: "Toast import · 86 orders · $12,664.13 net sales.",
    createdAt: "2026-02-15T00:00:00.000Z"
  },
  {
    id: "wm-toast-21",
    clientId: "client-meama",
    weekLabel: "Feb 16",
    covers: 224,
    netSales: 10601.3,
    totalOrders: 73,
    notes: "Toast import · 73 orders · $10,601.30 net sales.",
    createdAt: "2026-02-22T00:00:00.000Z"
  },
  {
    id: "wm-toast-22",
    clientId: "client-meama",
    weekLabel: "Feb 23",
    covers: 220,
    netSales: 11487.15,
    totalOrders: 76,
    notes: "Toast import · 76 orders · $11,487.15 net sales.",
    createdAt: "2026-03-01T00:00:00.000Z"
  },
  {
    id: "wm-toast-23",
    clientId: "client-meama",
    weekLabel: "Mar 2",
    covers: 209,
    netSales: 10119.85,
    totalOrders: 77,
    notes: "Toast import · 77 orders · $10,119.85 net sales.",
    createdAt: "2026-03-08T00:00:00.000Z"
  },
  {
    id: "wm-toast-24",
    clientId: "client-meama",
    weekLabel: "Mar 9",
    covers: 201,
    netSales: 9650.3,
    totalOrders: 82,
    notes: "Toast import · 82 orders · $9,650.30 net sales.",
    createdAt: "2026-03-15T00:00:00.000Z"
  },
  {
    id: "wm-toast-25",
    clientId: "client-meama",
    weekLabel: "Mar 16",
    covers: 286,
    netSales: 15764,
    totalOrders: 88,
    notes: "Toast import · 88 orders · $15,764.00 net sales.",
    createdAt: "2026-03-22T00:00:00.000Z"
  },
  {
    id: "wm-toast-26",
    clientId: "client-meama",
    weekLabel: "Mar 23",
    covers: 272,
    netSales: 12868.25,
    totalOrders: 96,
    notes: "Toast import · 96 orders · $12,868.25 net sales.",
    createdAt: "2026-03-29T00:00:00.000Z"
  },
  {
    id: "wm-toast-27",
    clientId: "client-meama",
    weekLabel: "Mar 30",
    covers: 31,
    netSales: 1154.19,
    totalOrders: 14,
    notes: "Toast import · 14 orders · $1,154.19 net sales.",
    createdAt: "2026-04-05T00:00:00.000Z"
  }
];
