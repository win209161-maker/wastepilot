import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('./node_modules/xlsx/xlsx.js')

const SUPABASE_URL = 'https://fiftiotizthtwayudpkj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpZnRpb3RpenRodHdheXVkcGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NzA4NzgsImV4cCI6MjEwNjI0Njg3OH0.QQ1eqNdvHVOhjle-v1Gbn4Epu5WCOo7RQF0938pwN6c'

const ADMIN_EMAIL = 'admin@wastepilot.app'
const ADMIN_PASSWORD = 'WastePilot2026!'
const EXCEL_PATH = 'C:/Users/user/Barry_project/trash project/abonnement2026.xlsx'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function main() {
  // 1. Sign in
  console.log('Signing in as admin...')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })
  if (authError) { console.error('Auth error:', authError.message); process.exit(1) }
  console.log('Signed in:', authData.user.email)

  // 2. Get org
  const { data: memberships } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', authData.user.id)
  if (!memberships?.length) { console.error('No org found'); process.exit(1) }
  const orgId = memberships[0].org_id
  console.log('Org ID:', orgId)

  // 3. Get sectors for this org
  const { data: sectors } = await supabase
    .from('sectors')
    .select('id, name')
    .eq('org_id', orgId)
  const sectorMap = {}
  ;(sectors || []).forEach(s => { sectorMap[s.name.toLowerCase()] = s.id })
  console.log('Sectors in DB:', Object.keys(sectorMap))

  // 4. Delete all test data
  console.log('\nDeleting test data...')
  const { data: customers } = await supabase.from('customers').select('id').eq('org_id', orgId)
  const customerIds = customers?.map(c => c.id) ?? []
  console.log(`Found ${customerIds.length} existing customers`)

  if (customerIds.length > 0) {
    const { data: payments } = await supabase.from('payments').select('id').in('customer_id', customerIds)
    const paymentIds = payments?.map(p => p.id) ?? []
    if (paymentIds.length > 0) {
      const { error: e } = await supabase.from('payment_allocations').delete().in('payment_id', paymentIds)
      if (e) console.error('  payment_allocations:', e.message)
      else console.log(`  Deleted payment_allocations`)
    }
    for (const [table, col] of [['payments','customer_id'],['billing_charges','customer_id'],['collection_schedules','customer_id'],['subscriptions','customer_id']]) {
      const { error: e } = await supabase.from(table).delete().in(col, customerIds)
      if (e) console.error(`  ${table}:`, e.message)
      else console.log(`  Deleted ${table}`)
    }
    const { error: e } = await supabase.from('customers').delete().eq('org_id', orgId)
    if (e) console.error('  customers:', e.message)
    else console.log(`  Deleted ${customerIds.length} customers`)
  }

  // 5. Read Excel
  console.log('\nReading Excel...')
  const wb = XLSX.readFile(EXCEL_PATH)
  const ws = wb.Sheets['Base initiale']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

  // Parse
  const toImport = []
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[1]) continue
    const lastName = (row[1] || '').toString().trim()
    const firstName = (row[2] || '').toString().trim()
    const phone = (row[3] || '').toString().trim().replace(/\s+/g, '')
    const neighborhood = (row[4] || '').toString().trim()
    const sectorName = (row[6] || '').toString().trim()
    const concession = (row[7] || '').toString().trim()
    const reference = (row[8] || '').toString().trim()
    const subscriberId = (row[9] || '').toString().trim()

    // Find sector_id (case-insensitive)
    const sectorId = sectorMap[sectorName.toLowerCase()] || null

    toImport.push({
      org_id: orgId,
      last_name: lastName,
      first_name: firstName,
      phone: phone || null,
      neighborhood: neighborhood || null,
      sector_id: sectorId,
      concession: concession || null,
      reference: reference || null,
      subscriber_id: subscriberId || null,
      status: 'active',
    })
  }
  console.log(`Parsed ${toImport.length} customers`)

  // Log sector match stats
  const withSector = toImport.filter(c => c.sector_id).length
  console.log(`Sector matched: ${withSector}/${toImport.length}`)
  if (withSector < toImport.length) {
    const unmatchedSectors = [...new Set(toImport.filter(c => !c.sector_id).map((_, i) => rows[i+2]?.[6]))]
    console.log('Unmatched sectors:', unmatchedSectors.slice(0, 5))
  }

  // 6. Insert customers in batches of 50
  const BATCH = 50
  let inserted = 0
  for (let i = 0; i < toImport.length; i += BATCH) {
    const batch = toImport.slice(i, i + BATCH)
    const { data: created, error: err } = await supabase.from('customers').insert(batch).select('id')
    if (err) {
      console.error(`  Batch ${Math.floor(i/BATCH)+1} error:`, err.message)
      // Try one by one
      for (const c of batch) {
        const { error: e } = await supabase.from('customers').insert(c)
        if (e) console.error(`  Failed ${c.last_name} ${c.first_name}: ${e.message}`)
        else inserted++
      }
    } else {
      inserted += created?.length ?? batch.length
      process.stdout.write(`\r  ${inserted}/${toImport.length} inserted...`)
    }
  }
  console.log(`\n  Inserted ${inserted} customers`)

  // 7. Create subscriptions for all new customers
  console.log('\nCreating subscriptions...')
  const { data: newCustomers } = await supabase.from('customers').select('id').eq('org_id', orgId)
  const newIds = newCustomers?.map(c => c.id) ?? []

  const subs = newIds.map(customerId => ({
    customer_id: customerId,
    org_id: orgId,
    monthly_price: 20000,
    billing_day: 1,
    service_frequency: 'monthly',
    status: 'active',
    start_date: '2026-01-01',
  }))

  let subInserted = 0
  for (let i = 0; i < subs.length; i += BATCH) {
    const batch = subs.slice(i, i + BATCH)
    const { error: err } = await supabase.from('subscriptions').insert(batch)
    if (err) console.error(`  Sub batch ${Math.floor(i/BATCH)+1}:`, err.message)
    else subInserted += batch.length
    process.stdout.write(`\r  ${Math.min(subInserted, subs.length)}/${subs.length} subscriptions...`)
  }
  console.log(`\n  Created ${subInserted} subscriptions`)

  console.log('\n✅ Done!')
  console.log(`   ${inserted} customers imported`)
  console.log(`   ${subInserted} subscriptions at 20,000 FG/month`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
