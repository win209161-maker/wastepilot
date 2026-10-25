// backup.mjs — Export all WastePilot data to a timestamped JSON file.
// Run manually: node backup.mjs
// Or schedule via Windows Task Scheduler (see below).

import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs'
import fs from 'fs'
import path from 'path'

const NEW_URL = 'https://adngsfaatzeuhycsiixl.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkbmdzZmFhdHpldWh5Y3NpaXhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5Mjc1NjY1MCwiZXhwIjoyMTA4MzMyNjUwfQ.ixDWpB6XnW9Fj05j3WuIgUEyiCKGgyeY-a3MLfbwxXY'
const BACKUP_DIR = 'C:/Users/user/Barry_project/trash project/wastepilot/backups'

const supabase = createClient(NEW_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function fetchAll(table, filter = {}) {
  let query = supabase.from(table).select('*')
  if (filter.eq) query = query.eq(filter.eq[0], filter.eq[1])
  const { data, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return data ?? []
}

async function main() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })

  console.log('Fetching data...')
  const [orgs, members, sectors, customers, subs, charges, payments, allocs, schedules] = await Promise.all([
    fetchAll('organizations'),
    fetchAll('org_members'),
    fetchAll('sectors'),
    fetchAll('wp_customers'),
    fetchAll('subscriptions'),
    fetchAll('billing_charges'),
    fetchAll('payments'),
    fetchAll('payment_allocations'),
    fetchAll('collection_schedules'),
  ])

  const backup = {
    exported_at: new Date().toISOString(),
    supabase_project: 'adngsfaatzeuhycsiixl',
    counts: {
      organizations: orgs.length,
      org_members: members.length,
      sectors: sectors.length,
      wp_customers: customers.length,
      subscriptions: subs.length,
      billing_charges: charges.length,
      payments: payments.length,
      payment_allocations: allocs.length,
      collection_schedules: schedules.length,
    },
    data: { organizations: orgs, org_members: members, sectors, wp_customers: customers,
            subscriptions: subs, billing_charges: charges, payments, payment_allocations: allocs,
            collection_schedules: schedules },
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = path.join(BACKUP_DIR, `wastepilot-backup-${ts}.json`)
  fs.writeFileSync(file, JSON.stringify(backup, null, 2))

  console.log(`\n✅ Backup saved: ${file}`)
  console.log(`   Customers : ${customers.length}`)
  console.log(`   Payments  : ${payments.length}`)
  console.log(`   Charges   : ${charges.length}`)
  console.log(`   File size : ${(fs.statSync(file).size / 1024).toFixed(1)} KB`)

  // Keep only the 10 most recent backups
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('wastepilot-backup-') && f.endsWith('.json'))
    .sort().reverse()
  for (const old of files.slice(10)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old))
    console.log(`   Deleted old backup: ${old}`)
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
