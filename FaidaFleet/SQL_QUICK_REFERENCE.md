# FaidaFleet SQL Quick Reference

## 📄 Complete Schema File
**Location:** `FaidaFleet/COMPLETE_SCHEMA.sql`

This single SQL file contains the entire database schema for all 5 fleet owner features.

---

## 🚀 Quick Commands

### View All Tables
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

### Get Vehicle Compliance Status
```sql
SELECT 
  registration_number,
  insurance_expiry,
  mot_expiry,
  CASE 
    WHEN insurance_expiry < NOW()::DATE THEN 'Insurance Expired'
    WHEN mot_expiry < NOW()::DATE THEN 'MOT Expired'
    WHEN insurance_expiry < NOW()::DATE + INTERVAL '30 days' THEN 'Insurance Expiring Soon'
    WHEN mot_expiry < NOW()::DATE + INTERVAL '30 days' THEN 'MOT Expiring Soon'
    ELSE 'Compliant'
  END AS status
FROM public.vehicles
WHERE tenant_id = ? AND is_active = TRUE;
```

### Get Daily Financial Summary
```sql
SELECT 
  date,
  total_collections,
  total_expenses,
  net_profit,
  ROUND((net_profit::NUMERIC / total_collections::NUMERIC * 100), 2) AS profit_margin_pct
FROM public.kpi_daily
WHERE tenant_id = ?
ORDER BY date DESC
LIMIT 30;
```

### Get Driver Earnings Report
```sql
SELECT 
  d.full_name,
  COUNT(DISTINCT t.id) AS trips,
  COALESCE(SUM(c.amount), 0) AS total_earnings,
  COALESCE(SUM(e.amount), 0) AS total_expenses,
  COALESCE(SUM(c.amount), 0) - COALESCE(SUM(e.amount), 0) AS profit
FROM public.drivers d
LEFT JOIN public.collections c ON c.driver_id = d.id
LEFT JOIN public.expenses e ON e.driver_id = d.id AND e.date = c.date
LEFT JOIN public.trips t ON t.driver_id = d.id
WHERE d.tenant_id = ?
GROUP BY d.id, d.full_name
ORDER BY profit DESC;
```

### Get Trip Profitability
```sql
SELECT 
  trip_date,
  v.registration_number,
  d.full_name,
  distance_km,
  earnings,
  expenses,
  earnings - expenses AS profit,
  ROUND(((earnings - expenses) / earnings * 100)::NUMERIC, 2) AS margin_pct
FROM public.trips
JOIN public.vehicles v ON trips.vehicle_id = v.id
JOIN public.drivers d ON trips.driver_id = d.id
WHERE trips.tenant_id = ?
ORDER BY trip_date DESC;
```

### Get Maintenance Due Soon
```sql
SELECT 
  registration_number,
  type,
  next_service_date,
  EXTRACT(DAY FROM next_service_date::TIMESTAMP - NOW()) AS days_until_service
FROM public.maintenance_logs ml
JOIN public.vehicles v ON ml.vehicle_id = v.id
WHERE ml.tenant_id = ?
  AND ml.next_service_date IS NOT NULL
  AND ml.next_service_date <= NOW()::DATE + INTERVAL '30 days'
ORDER BY next_service_date ASC;
```

### Revenue by Payment Method
```sql
SELECT 
  payment_method,
  COUNT(*) AS transactions,
  SUM(amount) AS total
FROM public.collections
WHERE tenant_id = ? AND date >= NOW()::DATE - INTERVAL '30 days'
GROUP BY payment_method
ORDER BY total DESC;
```

### Expense Breakdown by Category
```sql
SELECT 
  category,
  COUNT(*) AS count,
  SUM(amount) AS total,
  ROUND((SUM(amount)::NUMERIC / (SELECT SUM(amount) FROM public.expenses WHERE tenant_id = ?) * 100), 2) AS pct_of_total
FROM public.expenses
WHERE tenant_id = ?
GROUP BY category
ORDER BY total DESC;
```

### Vehicle Utilization
```sql
SELECT 
  v.registration_number,
  COUNT(DISTINCT c.id) AS collections,
  COUNT(DISTINCT t.id) AS trips,
  COALESCE(SUM(c.amount), 0) AS revenue,
  COALESCE(SUM(e.amount), 0) AS costs,
  COALESCE(SUM(c.amount), 0) - COALESCE(SUM(e.amount), 0) AS profit
FROM public.vehicles v
LEFT JOIN public.collections c ON c.vehicle_id = v.id
LEFT JOIN public.trips t ON t.vehicle_id = v.id
LEFT JOIN public.expenses e ON e.vehicle_id = v.id
WHERE v.tenant_id = ?
GROUP BY v.id, v.registration_number
ORDER BY profit DESC;
```

### Active Drivers with Current Assignments
```sql
SELECT 
  d.full_name,
  d.phone,
  d.license_number,
  d.license_expiry,
  v.registration_number,
  da.start_date
FROM public.drivers d
LEFT JOIN public.driver_assignments da ON da.driver_id = d.id AND da.is_current = TRUE
LEFT JOIN public.vehicles v ON da.vehicle_id = v.id
WHERE d.tenant_id = ? AND d.is_active = TRUE
ORDER BY d.full_name;
```

---

## 📊 All Tables Summary

| Feature | Tables | Purpose |
|---------|--------|---------|
| Vehicles | `vehicles` | Fleet registration & compliance tracking |
| Financial | `collections`, `expenses` | Revenue & cost tracking |
| Trips | `trips` | Individual trip records & profitability |
| Maintenance | `maintenance_logs` | Service history & scheduling |
| Drivers | `drivers`, `driver_assignments` | Driver roster & history |
| Analytics | `kpi_daily` (view) | Daily metrics summary |

---

## 🔒 Security Features

✅ Row Level Security (RLS) enabled on all tables  
✅ Role-based access control (owner, admin, accountant, driver)  
✅ Multi-tenant data isolation  
✅ Audit timestamps (created_at, updated_at) on all tables  
✅ Referential integrity with cascading deletes  

---

## 📈 Performance Indexes

- `vehicles_tenant_active` - Quick vehicle lookups
- `collections_date` - Historical analytics
- `trips_vehicle_id`, `trips_driver_id`, `trips_trip_date` - Trip filtering
- `maintenance_next_service` - Maintenance scheduling
- `drivers_license_expiry` - Compliance alerts
- `kpi_daily_unique` - Materialized view performance

---

## 🔄 Materialized View

**`kpi_daily`** - Automatically aggregates daily metrics:
- Total collections
- Total expenses  
- Net profit
- Reconciliation counts
- Payment method breakdown

**Refresh:** `SELECT public.refresh_kpi_daily();`

---

## 📝 Migration History

1. `001_initial_schema.sql` - Core tables
2. `002_fix_onboarding.sql` - Onboarding fixes
3. `003_admin_tables.sql` - Admin features
4. `004_add_trips_table.sql` - Trips + vehicle compliance
5. `COMPLETE_SCHEMA.sql` - Full schema (consolidated)

