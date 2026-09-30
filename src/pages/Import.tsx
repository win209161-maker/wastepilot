import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { parseMultiMonthValue } from '../lib/utils'
import * as XLSX from 'xlsx'

interface ParsedCustomer {
  order_num: number | null
  last_name: string
  first_name: string
  subscriber_id: string | null
  phone: string | null
  neighborhood: string | null
  sector_code: string | null
  concession: string | null
  reference: string | null
  request_date: string | null
  amount_due: number | null
  amount_paid: number | null
  monthly_price: number | null
  months_billed: number | null
  raw_amount: string | null
  sheet: string
  needs_review: boolean
  review_reason: string | null
}

function parseDate(val: any): string | null {
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'string' && val) return val
  return null
}

// Base initiale has different column order:
// [N°, Nom, Prénoms, Phone, Quartier, DateDemande, SectorName, ?, ?, SubscriberID]
function parseBaseRow(row: any[], sheet: string): ParsedCustomer | null {
  const [num, lastName, firstName, phone, quartier, dateDemande, sectorName] = row
  const subscriberId = row[9]

  if (!lastName || typeof lastName !== 'string') return null
  if (!firstName || typeof firstName !== 'string') return null
  if (String(lastName).toUpperCase() === 'NOM') return null

  return {
    order_num: typeof num === 'number' ? num : null,
    last_name: String(lastName).toUpperCase().trim(),
    first_name: String(firstName).trim(),
    subscriber_id: subscriberId && String(subscriberId).includes('/') ? String(subscriberId).trim() : null,
    phone: phone ? String(phone).trim() : null,
    neighborhood: quartier ? String(quartier).trim() : null,
    sector_code: sectorName ? String(sectorName).trim() : (quartier ? String(quartier).trim() : null),
    concession: null,
    reference: null,
    request_date: parseDate(dateDemande),
    amount_due: null,
    amount_paid: null,
    monthly_price: null,
    months_billed: null,
    raw_amount: null,
    sheet,
    needs_review: false,
    review_reason: null,
  }
}

// Monthly/billing sheets: [N°, Nom, Prénoms, NumAbonne?, MontantPayer, MontantPaye, Contact, Quartier, DateDemande, Secteur, Concession, Ref]
function parseRow(row: any[], sheet: string): ParsedCustomer | null {
  const [num, lastName, firstName, numAbonne, montantPayer, montantPaye, contact, quartier, dateDemande, sect, concession, ref] = row

  if (!lastName || typeof lastName !== 'string') return null
  if (!firstName || typeof firstName !== 'string') return null
  if (String(lastName).toUpperCase() === 'NOM') return null

  let amountDue: number | null = null
  let amountPaid: number | null = null
  let monthlyPrice: number | null = null
  let monthsBilled: number | null = null
  let needsReview = false
  let reviewReason: string | null = null

  const rawPayer = montantPayer
  const rawAmount = String(rawPayer ?? '')

  if (rawPayer != null && rawPayer !== '') {
    const parsed = parseMultiMonthValue(rawPayer)
    if (parsed) {
      monthlyPrice = parsed.monthlyPrice
      monthsBilled = parsed.monthsBilled
      amountDue = parsed.totalAmount
    } else {
      needsReview = true
      reviewReason = `Montant non parsable: ${rawPayer}`
    }
  }

  if (montantPaye != null && montantPaye !== '' && montantPaye !== 0) {
    const p = parseFloat(String(montantPaye))
    if (!isNaN(p)) amountPaid = p
  }

  let subscriberId: string | null = null
  if (numAbonne && typeof numAbonne === 'string' && numAbonne.includes('/')) {
    subscriberId = numAbonne
  }

  return {
    order_num: typeof num === 'number' ? num : null,
    last_name: String(lastName).toUpperCase().trim(),
    first_name: String(firstName).trim(),
    subscriber_id: subscriberId,
    phone: contact ? String(contact).trim() : null,
    neighborhood: quartier ? String(quartier).trim() : null,
    sector_code: sect ? String(sect).trim().toUpperCase().replace(' ', '') : null,
    concession: concession ? String(concession).trim() : null,
    reference: ref ? String(ref).trim() : null,
    request_date: parseDate(dateDemande),
    amount_due: amountDue,
    amount_paid: amountPaid,
    monthly_price: monthlyPrice,
    months_billed: monthsBilled,
    raw_amount: rawAmount || null,
    sheet,
    needs_review: needsReview,
    review_reason: reviewReason,
  }
}

function parseSheet(ws: XLSX.WorkSheet, name: string): ParsedCustomer[] {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'YYYY-MM-DD' }) as any[][]
  const results: ParsedCustomer[] = []
  const isBase = name.toLowerCase().replace(/\s+/g, '').includes('base') || name.toLowerCase().includes('initiale')

  let headerRow = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i]?.some((c: any) => String(c ?? '').toLowerCase().includes('nom'))) {
      headerRow = i
      break
    }
  }
  if (headerRow === -1) return []

  const maxCols = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).e.c + 1 : 12

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c: any) => c == null || c === '')) continue

    if (isBase) {
      const parsed = parseBaseRow(row, name)
      if (parsed) results.push(parsed)
    } else {
      const left = parseRow(row.slice(0, 12), name)
      if (left) results.push(left)
      if (maxCols >= 24) {
        const right = parseRow(row.slice(13, 25), name + ' (droite)')
        if (right) results.push(right)
      }
    }
  }

  return results
}

function extractPeriod(sheet: string): string | null {
  const s = sheet.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const yr = s.match(/20(\d{2})/)
  if (!yr) return null
  const year = `20${yr[1]}`
  const months: Record<string, string> = {
    jan: '01', fev: '02', mar: '03', avr: '04', mai: '05', juin: '06',
    jul: '07', juil: '07', aou: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    janvier: '01', fevrier: '02', mars: '03', avril: '04', juillet: '07',
    aout: '08', septembre: '09', octobre: '10', novembre: '11', decembre: '12',
  }
  for (const [k, v] of Object.entries(months)) if (s.includes(k)) return `${year}-${v}`
  return null
}

function clientKey(r: { last_name: string; first_name: string; phone?: string | null }) {
  return `${r.last_name}|${r.first_name.toUpperCase()}|${r.phone ?? ''}`
}

export function Import() {
  const { org } = useOrg()
  const [_file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedCustomer[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ phase: string; pct: number } | null>(null)
  const [imported, setImported] = useState<{ customers: number; charges: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result
      const wb = XLSX.read(data, { type: 'binary', cellDates: true })
      const allRows: ParsedCustomer[] = []
      for (const name of wb.SheetNames) {
        allRows.push(...parseSheet(wb.Sheets[name], name))
      }
      setParsed(allRows)
      setStep('preview')
    }
    reader.readAsBinaryString(f)
  }, [])

  async function handleImport() {
    if (!parsed || !org) return
    setImporting(true)
    setErrors([])
    const errs: string[] = []
    const CHUNK = 250

    // Sector lookup map
    setProgress({ phase: 'Chargement des secteurs…', pct: 5 })
    const { data: sectors } = await supabase.from('sectors').select('id, code, name').eq('org_id', org.id).order('name')
    const sectorMap = new Map<string, string>()
    for (let i = 0; i < (sectors ?? []).length; i++) {
      const s = (sectors as any[])[i]
      sectorMap.set(s.code.toUpperCase().replace(/\s+/g, ''), s.id)
      sectorMap.set(s.name.toUpperCase().replace(/\s+/g, ''), s.id)
      sectorMap.set(String(i + 1), s.id)
    }
    const resolveSector = (code: string | null, nbhd: string | null): string | null => {
      for (const t of [
        code?.toUpperCase().replace(/\s+/g, ''),
        code?.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
        nbhd?.toUpperCase().replace(/\s+/g, ''),
      ]) if (t && sectorMap.has(t)) return sectorMap.get(t)!
      return null
    }

    // Base initiale rows = unique customer list (264 rows)
    const baseRows = parsed.filter(r =>
      !r.needs_review && (r.sheet.toLowerCase().replace(/\s+/g, '').includes('base') || r.sheet.toLowerCase().includes('initiale'))
    )
    // Fall back to all-sheets dedup if no Base initiale sheet found
    let uniqueCustomers: ParsedCustomer[]
    if (baseRows.length > 0) {
      uniqueCustomers = baseRows
    } else {
      const customerMap = new Map<string, ParsedCustomer>()
      for (const r of parsed) {
        if (r.needs_review) continue
        const key = r.subscriber_id ?? clientKey(r)
        if (!customerMap.has(key)) customerMap.set(key, r)
      }
      uniqueCustomers = [...customerMap.values()]
    }

    // Billing rows: monthly sheets only (have amount_due + extractable period)
    const billingRows = parsed.filter(r => !r.needs_review && r.amount_due && r.amount_due > 0 && extractPeriod(r.sheet))

    // Load existing customers
    setProgress({ phase: 'Clients existants…', pct: 12 })
    const { data: existingCustomers } = await supabase.from('customers').select('id, subscriber_id, last_name, first_name, phone').eq('org_id', org.id)
    const existingBySubId = new Map<string, string>()
    const existingByNamePhone = new Map<string, string>()
    for (const c of (existingCustomers ?? []) as any[]) {
      if (c.subscriber_id) existingBySubId.set(c.subscriber_id, c.id)
      existingByNamePhone.set(clientKey(c), c.id)
    }

    const toInsertCustomers = uniqueCustomers.filter(r =>
      r.subscriber_id ? !existingBySubId.has(r.subscriber_id) : !existingByNamePhone.has(clientKey(r))
    )

    // Batch insert new customers
    for (let i = 0; i < toInsertCustomers.length; i += CHUNK) {
      const chunk = toInsertCustomers.slice(i, i + CHUNK)
      setProgress({ phase: `Clients (${i}/${toInsertCustomers.length})…`, pct: 15 + Math.round(i / Math.max(toInsertCustomers.length, 1) * 25) })
      const { error } = await supabase.from('customers').insert(chunk.map(r => ({
        org_id: org.id,
        last_name: r.last_name,
        first_name: r.first_name,
        phone: r.phone,
        subscriber_id: r.subscriber_id,
        neighborhood: r.neighborhood,
        sector_id: resolveSector(r.sector_code, r.neighborhood),
        concession: r.concession,
        reference: r.reference,
        request_date: r.request_date,
        status: 'active',
      })))
      if (error) errs.push(`Clients batch ${i}: ${error.message}`)
    }

    // Reload all customers → ID map
    setProgress({ phase: 'IDs clients…', pct: 42 })
    const { data: allCustomers } = await supabase.from('customers').select('id, subscriber_id, last_name, first_name, phone').eq('org_id', org.id)
    const customerIdBySubId = new Map<string, string>()
    const customerIdByNamePhone = new Map<string, string>()
    const customerIdByNameOnly = new Map<string, string>()
    for (const c of (allCustomers ?? []) as any[]) {
      if (c.subscriber_id) customerIdBySubId.set(c.subscriber_id, c.id)
      customerIdByNamePhone.set(clientKey(c), c.id)
      // Name-only fallback (first match wins — fine for non-duplicate names)
      const nameKey = `${c.last_name}|${String(c.first_name).toUpperCase()}`
      if (!customerIdByNameOnly.has(nameKey)) customerIdByNameOnly.set(nameKey, c.id)
    }
    const resolveCustomerId = (r: ParsedCustomer): string | null => {
      if (r.subscriber_id) return customerIdBySubId.get(r.subscriber_id) ?? null
      return customerIdByNamePhone.get(clientKey(r))
        ?? customerIdByNameOnly.get(`${r.last_name}|${r.first_name.toUpperCase()}`)
        ?? null
    }

    // Load existing subscriptions
    setProgress({ phase: 'Abonnements existants…', pct: 48 })
    const { data: existingSubs } = await supabase.from('subscriptions').select('id, customer_id').eq('org_id', org.id).eq('status', 'active')
    const existingSubByCustomerId = new Map<string, string>()
    for (const s of (existingSubs ?? []) as any[]) existingSubByCustomerId.set(s.customer_id, s.id)

    // Infer monthly price from billing rows if not on customer record
    const monthlyPriceByKey = new Map<string, number>()
    for (const r of billingRows) {
      if (r.monthly_price && r.monthly_price > 0) {
        const key = r.subscriber_id ?? clientKey(r)
        if (!monthlyPriceByKey.has(key)) monthlyPriceByKey.set(key, r.monthly_price)
      }
    }

    const toInsertSubs: any[] = []
    for (const r of uniqueCustomers) {
      const customerId = resolveCustomerId(r)
      if (!customerId || existingSubByCustomerId.has(customerId)) continue
      const key = r.subscriber_id ?? clientKey(r)
      const price = r.monthly_price ?? monthlyPriceByKey.get(key) ?? null
      if (!price) continue
      toInsertSubs.push({
        org_id: org.id,
        customer_id: customerId,
        monthly_price: price,
        start_date: r.request_date ?? new Date().toISOString().split('T')[0],
        status: 'active',
        service_frequency: 'monthly',
      })
    }

    for (let i = 0; i < toInsertSubs.length; i += CHUNK) {
      setProgress({ phase: `Abonnements (${i}/${toInsertSubs.length})…`, pct: 52 + Math.round(i / Math.max(toInsertSubs.length, 1) * 18) })
      const { error } = await supabase.from('subscriptions').insert(toInsertSubs.slice(i, i + CHUNK) as any)
      if (error) errs.push(`Abonnements batch ${i}: ${error.message}`)
    }

    // Reload subscriptions → map by customer_id
    setProgress({ phase: 'IDs abonnements…', pct: 72 })
    const { data: allSubs } = await supabase.from('subscriptions').select('id, customer_id').eq('org_id', org.id).eq('status', 'active')
    const subIdByCustomerId = new Map<string, string>()
    for (const s of (allSubs ?? []) as any[]) subIdByCustomerId.set(s.customer_id, s.id)

    // Build billing charges (dedup by sub + period)
    const chargeMap = new Map<string, any>()
    for (const r of billingRows) {
      const customerId = resolveCustomerId(r)
      if (!customerId) continue
      const subId = subIdByCustomerId.get(customerId)
      if (!subId) continue
      const period = extractPeriod(r.sheet)!
      const key = `${subId}|${period}`
      if (!chargeMap.has(key)) {
        const amtPaid = r.amount_paid ?? 0
        const amtDue = r.amount_due ?? 0
        chargeMap.set(key, {
          org_id: org.id,
          customer_id: customerId,
          subscription_id: subId,
          billing_period: period,
          amount_due: amtDue,
          amount_paid: amtPaid,
          balance: amtDue - amtPaid,
          status: amtPaid >= amtDue ? 'paid' : amtPaid > 0 ? 'partial' : 'unpaid',
        })
      }
    }
    const charges = [...chargeMap.values()]

    for (let i = 0; i < charges.length; i += CHUNK) {
      setProgress({ phase: `Charges (${i}/${charges.length})…`, pct: 76 + Math.round(i / Math.max(charges.length, 1) * 22) })
      const { error } = await supabase.from('billing_charges').upsert(
        charges.slice(i, i + CHUNK),
        { onConflict: 'subscription_id,billing_period', ignoreDuplicates: false }
      )
      if (error) errs.push(`Charges batch ${i}: ${error.message}`)
    }

    setProgress(null)
    setErrors(errs)
    setImported({ customers: toInsertCustomers.length, charges: charges.length })
    setImporting(false)
    setStep('done')
  }

  const reviewItems = parsed?.filter(r => r.needs_review) ?? []
  const okItems = parsed?.filter(r => !r.needs_review) ?? []

  const uniqueCustomerCount = (() => {
    if (!parsed) return 0
    const baseRows = okItems.filter(r =>
      r.sheet.toLowerCase().replace(/\s+/g, '').includes('base') || r.sheet.toLowerCase().includes('initiale')
    )
    if (baseRows.length > 0) return baseRows.length
    // Fallback: dedup by subscriber_id or name+phone
    const seen = new Set<string>()
    for (const r of okItems) seen.add(r.subscriber_id ?? clientKey(r))
    return seen.size
  })()

  const billingRowCount = okItems.filter(r => r.amount_due && r.amount_due > 0 && extractPeriod(r.sheet)).length

  return (
    <div>
      <PageHeader title="Import Excel" description="Importez votre fichier abonnement existant" />

      {step === 'upload' && (
        <div className="card p-8">
          <div className="max-w-md mx-auto text-center">
            <div className="p-4 bg-green-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <FileSpreadsheet className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Importer abonnement2026.xlsx</h2>
            <p className="text-sm text-gray-500 mb-6">
              Le fichier sera analysé automatiquement. Toutes les feuilles mensuelles seront lues,
              les tableaux doubles détectés, et les valeurs multi-mois (2×20000) normalisées.
            </p>
            <label className="btn-primary cursor-pointer">
              <Upload className="w-4 h-4" />
              Choisir le fichier Excel
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {step === 'preview' && parsed && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{uniqueCustomerCount}</div>
              <div className="text-xs text-gray-500">Clients uniques</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{billingRowCount}</div>
              <div className="text-xs text-gray-500">Relevés de facturation</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{reviewItems.length}</div>
              <div className="text-xs text-gray-500">À vérifier</div>
            </div>
          </div>

          {reviewItems.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-orange-100 bg-orange-50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-700">
                  {reviewItems.length} ligne(s) nécessitent une vérification — non importées
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="table-header">Client</th>
                      <th className="table-header">Feuille</th>
                      <th className="table-header">Problème</th>
                      <th className="table-header">Valeur brute</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reviewItems.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td className="table-cell font-medium">{r.last_name} {r.first_name}</td>
                        <td className="table-cell text-gray-500">{r.sheet}</td>
                        <td className="table-cell text-orange-600">{r.review_reason}</td>
                        <td className="table-cell font-mono text-gray-400">{r.raw_amount}</td>
                      </tr>
                    ))}
                    {reviewItems.length > 20 && (
                      <tr>
                        <td colSpan={4} className="table-cell text-center text-gray-400 py-2">
                          +{reviewItems.length - 20} autres…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Aperçu — {uniqueCustomerCount} clients uniques</h2>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="table-header">Nom</th>
                    <th className="table-header">Téléphone</th>
                    <th className="table-header">N° Abonné</th>
                    <th className="table-header">Quartier</th>
                    <th className="table-header">Feuille</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const seen = new Set<string>()
                    const unique: ParsedCustomer[] = []
                    for (const r of okItems) {
                      const key = r.subscriber_id ?? clientKey(r)
                      if (!seen.has(key)) { seen.add(key); unique.push(r) }
                    }
                    return unique.slice(0, 100).map((r, i) => (
                      <tr key={i}>
                        <td className="table-cell font-medium">{r.last_name} {r.first_name}</td>
                        <td className="table-cell text-gray-500">{r.phone ?? '—'}</td>
                        <td className="table-cell font-mono text-gray-400">{r.subscriber_id ?? '—'}</td>
                        <td className="table-cell text-gray-500">{r.neighborhood ?? '—'}</td>
                        <td className="table-cell text-gray-400">{r.sheet}</td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {importing && progress && (
            <div className="card p-4">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                <span className="text-sm text-gray-700">{progress.phase}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              className="btn-secondary"
              onClick={() => { setStep('upload'); setParsed(null); setFile(null) }}
              disabled={importing}
            >
              Annuler
            </button>
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={importing || uniqueCustomerCount === 0}
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Importation...</>
              ) : (
                <>Importer {uniqueCustomerCount} clients</>
              )}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && imported && (
        <div className="card p-8 text-center max-w-md mx-auto">
          <div className="p-4 bg-green-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Import terminé</h2>
          <p className="text-sm text-gray-600 mb-1">{imported.customers} nouveaux clients créés</p>
          <p className="text-sm text-gray-600 mb-2">{imported.charges} relevés de facturation importés</p>
          {errors.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-xs font-semibold text-red-600 mb-1">{errors.length} erreur(s):</p>
              <div className="text-xs text-red-500 space-y-1 max-h-32 overflow-y-auto">
                {errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            </div>
          )}
          <button
            className="btn-primary mt-6"
            onClick={() => { setStep('upload'); setParsed(null); setFile(null); setErrors([]); setImported(null) }}
          >
            Nouvel import
          </button>
        </div>
      )}
    </div>
  )
}
