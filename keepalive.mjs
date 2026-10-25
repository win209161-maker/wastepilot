// keepalive.mjs — Lightweight ping to keep Supabase project active.
// Scheduled every 3 days via Windows Task Scheduler.
import https from 'https'

const url = 'https://adngsfaatzeuhycsiixl.supabase.co/rest/v1/organizations?select=id&limit=1'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkbmdzZmFhdHpldWh5Y3NpaXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTY2NTAsImV4cCI6MjEwODMzMjY1MH0.2-AK1Bje9qRuVzq3hySS7Cxjj1WcsPvkGdsZv98i8aA'

const req = https.request(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } }, res => {
  console.log(`[${new Date().toISOString()}] Supabase ping → ${res.statusCode}`)
  process.exit(res.statusCode < 500 ? 0 : 1)
})
req.on('error', e => { console.error('Ping failed:', e.message); process.exit(1) })
req.end()
