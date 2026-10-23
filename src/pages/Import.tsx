import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, Sparkles, Calendar } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { parseMultiMonthValue, formatMoney, formatBillingPeriod } from '../lib/utils'
import * as XLSX from 'xlsx'

interface ParsedCustomer {
  row_type: 'base' | 'billing'
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

interface SheetAnalysis {
  name: string
  sheetType: 'base' | 'billing'
  period: string | null
  rowCount: number
  fieldMap: Map<string, number>
  headerLabels: Map<string, string>
}

// Human-readable field labels for the detection UI
const FIELD_LABELS: Record<string, string> = {
  order_num:     'N°',
  last_name:     'Nom',
  first_name:    'Prénom',
  subscriber_id: 'N° Abonné',
  amount_due:    'Montant dû',
  amount_paid:   'Montant payé',
  phone:         'Téléphone',
  neighborhood:  'Quartier',
  sector_code:   'Secteur',
  request_date:  'Date demande',
  concession:    'Concession',
  reference:     'Référence',
}

// Handles YYYY-MM-DD, DD/MM/YYYY, D/M/YYYY, M/D/YY, DD/MM/YY
function parseDate(val: any): string | null {
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val !== 'string' || !val) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10)
  const parts = val.split('/')
  if (parts.length !== 3) return null
  const [a, b, c] = parts.map(s => parseInt(s, 10))
  if (isNaN(a) || isNaN(b) || isNaN(c)) return null
  if (parts[2].length === 4) {
    if (b >= 1 && b <= 12 && a >= 1 && a <= 31)
      return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
  }
  if (parts[2].length <= 2) {
    const y = c + 2000
    if (b > 12) return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
    if (a > 12) return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
    return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
  }
  return null
}

function toISODate(d: string | null | undefined): string | null {
  if (!d) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
  return parseDate(d)
}

// Smart column mapper — reads any header layout and maps it to our fields
// This is the "mini AI": no fixed column positions required
function mapHeaders(headers: any[]): {
  fieldMap: Map<string, number>
  headerLabels: Map<string, string>
  sheetType: 'base' | 'billing'
} {
  const norm = (s: any) =>
    String(s ?? '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '')

  // Ordered by specificity — more specific patterns before generic ones to avoid false matches
  const patterns: Array<[string, string[]]> = [
    ['amount_paid',    ['montantpaye', 'montantverse', 'montantencaisse', 'montantrecu', 'amountpaid', 'paye', 'verse', 'encaisse', 'recu']],
    ['amount_due',     ['montantapayer', 'montantpayer', 'apayer', 'amountdue', 'montantdu', 'facture', 'montant']],
    ['subscriber_id',  ['numabonne', 'nabonne', 'noabonne', 'numerabonne', 'abonne', 'subscriber', 'idabonne', 'idclient']],
    ['first_name',     ['prenom', 'firstname', 'prenoms', 'givenname']],
    ['last_name',      ['nom', 'lastname', 'surname', 'familyname']],
    ['request_date',   ['datedemande', 'dateinscription', 'datecreation', 'requestdate', 'dateabonnement', 'datedemarrage']],
    ['phone',          ['phone', 'tel', 'telephone', 'contact', 'mobile', 'portable', 'gsm', 'numertel']],
    ['sector_code',    ['codesecteur', 'codesect', 'secteur', 'sector', 'zone']],
    ['neighborhood',   ['quartier', 'neighborhood', 'localite', 'commune', 'district', 'arrondissement']],
    ['concession',     ['concession']],
    ['reference',      ['reference', 'ref']],
    ['order_num',      ['numero', 'ordre', 'rang', 'ligne']],
  ]

  const fieldMap = new Map<string, number>()
  const headerLabels = new Map<string, string>()
  const usedCols = new Set<number>()

  // Two-pass: exact match wins over partial match
  for (const pass of ['exact', 'partial'] as const) {
    for (const [fieldName, keywords] of patterns) {
      if (fieldMap.has(fieldName)) continue
      for (let i = 0; i < headers.length; i++) {
        if (usedCols.has(i)) continue
        const h = norm(headers[i])
        if (!h) continue
        const matched =
          pass === 'exact'
            ? keywords.some(kw => norm(kw) === h)
            : keywords.some(kw => h.includes(norm(kw)))
        if (matched) {
          fieldMap.set(fieldName, i)
          headerLabels.set(fieldName, String(headers[i] ?? '').trim())
          usedCols.add(i)
          break
        }
      }
    }
  }

  const sheetType: 'base' | 'billing' = fieldMap.has('amount_due') ? 'billing' : 'base'
  return { fieldMap, headerLabels, sheetType }
}

// Universal row parser — works for any column layout via the fieldMap
function parseRowWithMap(
  row: any[],
  fieldMap: Map<string, number>,
  sheetType: 'base' | 'billing',
  sheet: string
): ParsedCustomer | null {
  const get = (field: string): any => {
    const idx = fieldMap.get(field)
    return idx !== undefined ? row[idx] : undefined
  }

  const lastName = get('last_name')
  const firstName = get('first_name')
  if (!lastName || typeof lastName !== 'string') return null
  if (!firstName || typeof firstName !== 'string') return null
  const lastUpper = String(lastName).toUpperCase().trim()
  if (['NOM', 'LAST_NAME', 'LASTNAME', 'NAME', 'SURNAME'].includes(lastUpper)) return null

  const numAbonne = get('subscriber_id')
  const subscriberId =
    numAbonne && String(numAbonne).includes('/') ? String(numAbonne).trim() : null

  let amountDue: number | null = null
  let amountPaid: number | null = null
  let monthlyPrice: number | null = null
  let monthsBilled: number | null = null
  let needsReview = false
  let reviewReason: string | null = null
  let rawAmountStr: string | null = null

  if (sheetType === 'billing') {
    const rawPayer = get('amount_due')
    rawAmountStr = rawPayer != null ? String(rawPayer) : null

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

    const rawPaye = get('amount_paid')
    if (rawPaye != null && rawPaye !== '' && rawPaye !== 0) {
      const p = parseFloat(String(rawPaye).replace(/[\s]/g, '').replace(',', '.'))
      if (!isNaN(p)) amountPaid = p
    }
  }

  const orderNum = get('order_num')
  const phone = get('phone')
  const quartier = get('neighborhood')
  const sect = get('sector_code')
  const dateDemande = get('request_date')
  const concession = get('concession')
  const ref = get('reference')

  return {
    row_type: sheetType,
    order_num: typeof orderNum === 'number' ? orderNum : null,
    last_name: lastUpper,
    first_name: String(firstName).trim(),
    subscriber_id: subscriberId,
    phone: phone ? String(phone).trim() : null,
    neighborhood: quartier ? String(quartier).trim() : null,
    sector_code: sect
      ? String(sect).trim().toUpperCase().replace(/\s+/g, '')
      : quartier
        ? String(quartier).trim()
        : null,
    concession: concession ? String(concession).trim() : null,
    reference: ref ? String(ref).trim() : null,
    request_date: parseDate(dateDemande),
    amount_due: amountDue,
    amount_paid: amountPaid,
    monthly_price: monthlyPrice,
    months_billed: monthsBilled,
    raw_amount: rawAmountStr,
    sheet,
    needs_review: needsReview,
    review_reason: reviewReason,
  }
}

function parseSheet(
  ws: XLSX.WorkSheet,
  name: string,
  isCsv = false
): { rows: ParsedCustomer[]; analysis: SheetAnalysis } {
  const rawRows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    dateNF: 'YYYY-MM-DD',
  }) as any[][]

  const empty: SheetAnalysis = {
    name,
    sheetType: 'base',
    period: null,
    rowCount: 0,
    fieldMap: new Map(),
    headerLabels: new Map(),
  }

  let headerRowIdx = -1
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    if (rawRows[i]?.some((c: any) => String(c ?? '').toLowerCase().includes('nom'))) {
      headerRowIdx = i
      break
    }
  }
  if (headerRowIdx === -1) return { rows: [], analysis: empty }

  const headers = rawRows[headerRowIdx] ?? []
  const { fieldMap, headerLabels, sheetType } = mapHeaders(headers)

  // Skip sheet if we couldn't detect the two required fields
  if (!fieldMap.has('last_name') || !fieldMap.has('first_name'))
    return { rows: [], analysis: empty }

  const period = extractPeriod(name)
  const maxCols = isCsv
    ? 0
    : ws['!ref']
      ? XLSX.utils.decode_range(ws['!ref']).e.c + 1
      : 0

  const rows: ParsedCustomer[] = []
  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i]
    if (!row || row.every((c: any) => c == null || c === '')) continue

    const parsed = parseRowWithMap(row, fieldMap, sheetType, name)
    if (parsed) rows.push(parsed)

    // Double-table XLSX support (two billing tables side by side)
    if (!isCsv && maxCols >= 24 && sheetType === 'billing') {
      const rightRow = row.slice(13)
      const parsed2 = parseRowWithMap(rightRow, fieldMap, sheetType, name + ' (droite)')
      if (parsed2) rows.push(parsed2)
    }
  }

  return {
    rows,
    analysis: { name, sheetType, period, rowCount: rows.length, fieldMap, headerLabels },
  }
}

function extractPeriod(sheet: string): string | null {
  const relevant = sheet.includes(' - ') ? sheet.split(' - ').slice(-1)[0] : sheet
  const s = relevant.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const yr4 = s.match(/20(\d{2})/)
  const yr2 = !yr4 ? s.match(/(\d{2})/) : null
  const yrSuffix = yr4 ? yr4[1] : yr2 ? yr2[1] : null
  if (!yrSuffix) return null
  const year = `20${yrSuffix}`
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
  const [sheetAnalyses, setSheetAnalyses] = useState<SheetAnalysis[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ phase: string; pct: number } | null>(null)
  const [imported, setImported] = useState<{ customers: number; charges: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const isCsv = f.name.toLowerCase().endsWith('.csv')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result
      const wb = XLSX.read(data, { type: 'binary', cellDates: !isCsv })
      const allRows: ParsedCustomer[] = []
      const analyses: SheetAnalysis[] = []
      for (const xlsxSheetName of wb.SheetNames) {
        const sheetName = isCsv ? f.name.replace(/\.csv$/i, '') : xlsxSheetName
        const { rows, analysis } = parseSheet(wb.Sheets[xlsxSheetName], sheetName, isCsv)
        allRows.push(...rows)
        if (analysis.fieldMap.size >= 2) analyses.push(analysis)
      }
      setParsed(allRows)
      setSheetAnalyses(analyses)
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

    setProgress({ phase: 'Chargement des secteurs…', pct: 5 })
    const { data: sectors } = await supabase
      .from('sectors')
      .select('id, code, name')
      .eq('org_id', org.id)
      .order('name')
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

    const baseRows = parsed.filter(r => !r.needs_review && r.row_type === 'base')
    let uniqueCustomers: ParsedCustomer[]
    if (baseRows.length > 0) {
      uniqueCustomers = baseRows
    } else {
      const customerMap = new Map<string, ParsedCustomer>()
      for (const r of parsed.filter(r => r.row_type === 'billing')) {
        const key = r.subscriber_id ?? clientKey(r)
        if (!customerMap.has(key)) customerMap.set(key, r)
      }
      uniqueCustomers = [...customerMap.values()]
    }

    const billingRows = parsed.filter(
      r => r.row_type === 'billing' && r.amount_due && r.amount_due > 0 && extractPeriod(r.sheet)
    )

    setProgress({ phase: 'Clients existants…', pct: 12 })
    const { data: existingCustomers } = await supabase
      .from('wp_customers')
      .select('id, subscriber_id, last_name, first_name, phone')
      .eq('org_id', org.id)
    const existingBySubId = new Map<string, string>()
    const existingByNamePhone = new Map<string, string>()
    for (const c of (existingCustomers ?? []) as any[]) {
      if (c.subscriber_id) existingBySubId.set(c.subscriber_id, c.id)
      existingByNamePhone.set(clientKey(c), c.id)
    }

    const toInsertCustomers = uniqueCustomers.filter(r =>
      r.subscriber_id
        ? !existingBySubId.has(r.subscriber_id)
        : !existingByNamePhone.has(clientKey(r))
    )

    for (let i = 0; i < toInsertCustomers.length; i += CHUNK) {
      const chunk = toInsertCustomers.slice(i, i + CHUNK)
      setProgress({
        phase: `Clients (${i + chunk.length}/${toInsertCustomers.length})…`,
        pct: 15 + Math.round(((i + chunk.length) / Math.max(toInsertCustomers.length, 1)) * 25),
      })
      const { error } = await supabase.from('wp_customers').insert(
        chunk.map(r => ({
          org_id: org.id,
          last_name: r.last_name,
          first_name: r.first_name,
          phone: r.phone,
          subscriber_id: r.subscriber_id,
          neighborhood: r.neighborhood,
          sector_id: resolveSector(r.sector_code, r.neighborhood),
          concession: r.concession,
          reference: r.reference,
          request_date: toISODate(r.request_date),
          status: 'active',
        }))
      )
      if (error) errs.push(`Clients batch ${i}: ${error.message}`)
    }

    setProgress({ phase: 'IDs clients…', pct: 42 })
    const { data: allCustomers } = await supabase
      .from('wp_customers')
      .select('id, subscriber_id, last_name, first_name, phone')
      .eq('org_id', org.id)
    const customerIdBySubId = new Map<string, string>()
    const customerIdByNamePhone = new Map<string, string>()
    const customerIdByNameOnly = new Map<string, string>()
    for (const c of (allCustomers ?? []) as any[]) {
      if (c.subscriber_id) customerIdBySubId.set(c.subscriber_id, c.id)
      customerIdByNamePhone.set(clientKey(c), c.id)
      const nameKey = `${c.last_name}|${String(c.first_name).toUpperCase()}`
      if (!customerIdByNameOnly.has(nameKey)) customerIdByNameOnly.set(nameKey, c.id)
    }
    const resolveCustomerId = (r: ParsedCustomer): string | null => {
      if (r.subscriber_id) return customerIdBySubId.get(r.subscriber_id) ?? null
      return (
        customerIdByNamePhone.get(clientKey(r)) ??
        customerIdByNameOnly.get(`${r.last_name}|${r.first_name.toUpperCase()}`) ??
        null
      )
    }

    setProgress({ phase: 'Abonnements existants…', pct: 48 })
    const { data: existingSubs } = await supabase
      .from('subscriptions')
      .select('id, customer_id')
      .eq('org_id', org.id)
      .eq('status', 'active')
    const existingSubByCustomerId = new Map<string, string>()
    for (const s of (existingSubs ?? []) as any[]) existingSubByCustomerId.set(s.customer_id, s.id)

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
        start_date: toISODate(r.request_date) ?? new Date().toISOString().split('T')[0],
        status: 'active',
        service_frequency: 'monthly',
      })
    }

    for (let i = 0; i < toInsertSubs.length; i += CHUNK) {
      setProgress({
        phase: `Abonnements (${i + Math.min(CHUNK, toInsertSubs.length - i)}/${toInsertSubs.length})…`,
        pct: 52 + Math.round((i / Math.max(toInsertSubs.length, 1)) * 18),
      })
      const { error } = await supabase
        .from('subscriptions')
        .insert(toInsertSubs.slice(i, i + CHUNK) as any)
      if (error) errs.push(`Abonnements batch ${i}: ${error.message}`)
    }

    setProgress({ phase: 'IDs abonnements…', pct: 72 })
    const { data: allSubs } = await supabase
      .from('subscriptions')
      .select('id, customer_id')
      .eq('org_id', org.id)
      .eq('status', 'active')
    const subIdByCustomerId = new Map<string, string>()
    for (const s of (allSubs ?? []) as any[]) subIdByCustomerId.set(s.customer_id, s.id)

    setProgress({ phase: 'Charges existantes…', pct: 74 })
    const { data: existingCharges } = await supabase
      .from('billing_charges')
      .select('subscription_id, billing_period')
      .eq('org_id', org.id)
    const existingChargeKeys = new Set<string>()
    for (const c of (existingCharges ?? []) as any[])
      existingChargeKeys.add(`${c.subscription_id}|${c.billing_period}`)

    const chargeMap = new Map<string, any>()
    for (const r of billingRows) {
      const customerId = resolveCustomerId(r)
      if (!customerId) continue
      const subId = subIdByCustomerId.get(customerId)
      if (!subId) continue
      const period = extractPeriod(r.sheet)!
      const key = `${subId}|${period}`
      if (!chargeMap.has(key) && !existingChargeKeys.has(key)) {
        const amtPaid = r.amount_paid ?? 0
        const amtDue = r.amount_due ?? 0
        chargeMap.set(key, {
          org_id: org.id,
          customer_id: customerId,
          subscription_id: subId,
          billing_period: period,
          monthly_price: r.monthly_price ?? amtDue,
          months_billed: r.months_billed ?? 1,
          amount_due: amtDue,
          amount_paid: amtPaid,
          status: amtPaid >= amtDue ? 'paid' : amtPaid > 0 ? 'partial' : 'unpaid',
        })
      }
    }
    const charges = [...chargeMap.values()]

    for (let i = 0; i < charges.length; i += CHUNK) {
      setProgress({
        phase: `Charges (${i + Math.min(CHUNK, charges.length - i)}/${charges.length})…`,
        pct: 76 + Math.round((i / Math.max(charges.length, 1)) * 22),
      })
      const { error } = await supabase
        .from('billing_charges')
        .insert(charges.slice(i, i + CHUNK) as any)
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
    const baseRows = okItems.filter(r => r.row_type === 'base')
    if (baseRows.length > 0) return baseRows.length
    const seen = new Set<string>()
    for (const r of parsed.filter(r => r.row_type === 'billing'))
      seen.add(r.subscriber_id ?? clientKey(r))
    return seen.size
  })()

  const billingRowCount =
    parsed?.filter(
      r => r.row_type === 'billing' && r.amount_due && r.amount_due > 0 && extractPeriod(r.sheet)
    ).length ?? 0

  const totalAmountDue =
    parsed?.reduce((sum, r) => sum + (r.amount_due ?? 0), 0) ?? 0
  const totalAmountPaid =
    parsed?.reduce((sum, r) => sum + (r.amount_paid ?? 0), 0) ?? 0

  const detectedPeriods = Array.from(
    new Set(
      sheetAnalyses
        .filter(a => a.sheetType === 'billing' && a.period)
        .map(a => a.period!)
    )
  ).sort()

  return (
    <div>
      <PageHeader
        title="Import Excel / CSV"
        description="Importez votre fichier abonnement depuis Excel ou Google Sheets"
      />

      {step === 'upload' && (
        <div className="card p-4 sm:p-8">
          <div className="max-w-md mx-auto text-center">
            <div className="p-4 bg-green-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <FileSpreadsheet className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Importer les abonnés</h2>
            <p className="text-sm text-gray-500 mb-2">
              Formats acceptés : <strong>.xlsx</strong> (Excel, Google Sheets), <strong>.csv</strong> (Google Sheets → Télécharger).
            </p>
            <p className="text-sm text-gray-400 mb-6">
              La détection intelligente des colonnes analyse automatiquement vos en-têtes — peu importe l'ordre des colonnes ou le nom du fichier. Les montants multi-mois (2×25 000) sont normalisés.
            </p>
            <label className="btn-primary cursor-pointer">
              <Upload className="w-4 h-4" />
              Choisir le fichier
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            </label>
            <p className="text-xs text-gray-400 mt-5">
              Données de test :{' '}
              <a href="/test-data/test_abonnement.xlsx" download className="text-blue-500 hover:underline">XLSX (3 feuilles)</a>
              {' · '}
              <a href="/test-data/test_base_initiale.csv" download className="text-blue-500 hover:underline">CSV base</a>
              {' · '}
              <a href="/test-data/test_janvier_2026.csv" download className="text-blue-500 hover:underline">CSV facturation</a>
            </p>
          </div>
        </div>
      )}

      {step === 'preview' && parsed && (
        <div className="space-y-4">

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{uniqueCustomerCount}</div>
              <div className="text-xs text-gray-500">Clients</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{billingRowCount}</div>
              <div className="text-xs text-gray-500">Relevés de facturation</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-lg font-bold text-gray-800">{formatMoney(totalAmountDue)}</div>
              <div className="text-xs text-gray-500">Total facturé</div>
            </div>
            <div className="card p-4 text-center">
              <div className={`text-2xl font-bold ${reviewItems.length > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                {reviewItems.length}
              </div>
              <div className="text-xs text-gray-500">À vérifier</div>
            </div>
          </div>

          {/* AI detection panel */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-gray-700">
                Détection automatique — {sheetAnalyses.length} feuille(s) analysée(s)
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {sheetAnalyses.map((analysis, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        analysis.sheetType === 'billing'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {analysis.sheetType === 'billing' ? 'Facturation' : 'Base clients'}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{analysis.name}</span>
                      {analysis.period && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatBillingPeriod(analysis.period)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{analysis.rowCount} lignes</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(analysis.fieldMap.keys()).map(fieldName => (
                      <span
                        key={fieldName}
                        className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded px-2 py-0.5"
                      >
                        <span className="text-gray-400 italic">{analysis.headerLabels.get(fieldName) || '?'}</span>
                        <span className="text-gray-300 mx-0.5">→</span>
                        <span className="font-medium text-gray-700">{FIELD_LABELS[fieldName] || fieldName}</span>
                        <span className="text-green-500 ml-0.5">✓</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Billing periods detected */}
          {detectedPeriods.length > 0 && (
            <div className="card px-5 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Périodes</span>
              {detectedPeriods.map(p => (
                <span key={p} className="text-xs bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded-full">
                  {formatBillingPeriod(p)}
                </span>
              ))}
              {totalAmountPaid > 0 && (
                <span className="ml-auto text-xs text-gray-500">
                  {formatMoney(totalAmountPaid)} collectés sur {formatMoney(totalAmountDue)}
                </span>
              )}
            </div>
          )}

          {/* Review items */}
          {reviewItems.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-orange-100 bg-orange-50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-700">
                  {reviewItems.length} ligne(s) non importée(s) — montant non reconnu
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

          {/* Customer preview */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                Aperçu — {uniqueCustomerCount} clients
              </h2>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-200">
                    <th className="table-header">Nom</th>
                    <th className="table-header">Téléphone</th>
                    <th className="table-header">N° Abonné</th>
                    <th className="table-header">Quartier</th>
                    {billingRowCount > 0 && <th className="table-header text-right">Montant dû</th>}
                    {billingRowCount > 0 && <th className="table-header text-right">Payé</th>}
                    <th className="table-header">Feuille</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const baseRows = okItems.filter(r => r.row_type === 'base')
                    const source = baseRows.length > 0 ? baseRows : okItems
                    const seen = new Set<string>()
                    const unique: ParsedCustomer[] = []
                    for (const r of source) {
                      const key = r.subscriber_id ?? clientKey(r)
                      if (!seen.has(key)) { seen.add(key); unique.push(r) }
                    }
                    return unique.slice(0, 100).map((r, i) => (
                      <tr key={i} className={r.needs_review ? 'bg-orange-50' : ''}>
                        <td className="table-cell font-medium">{r.last_name} {r.first_name}</td>
                        <td className="table-cell text-gray-500">{r.phone ?? '—'}</td>
                        <td className="table-cell font-mono text-gray-400">{r.subscriber_id ?? '—'}</td>
                        <td className="table-cell text-gray-500">{r.neighborhood ?? '—'}</td>
                        {billingRowCount > 0 && (
                          <td className="table-cell text-right font-medium text-gray-800">
                            {r.amount_due ? formatMoney(r.amount_due) : '—'}
                          </td>
                        )}
                        {billingRowCount > 0 && (
                          <td className="table-cell text-right text-green-600">
                            {r.amount_paid ? formatMoney(r.amount_paid) : '—'}
                          </td>
                        )}
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
                <span className="ml-auto text-xs text-gray-400">{progress.pct}%</span>
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
              onClick={() => { setStep('upload'); setParsed(null); setFile(null); setSheetAnalyses([]) }}
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
        <div className="card p-4 sm:p-8 text-center max-w-md mx-auto">
          <div className="p-4 bg-green-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Import terminé</h2>
          <p className="text-sm text-gray-600 mb-1">{imported.customers} nouveaux clients créés</p>
          <p className="text-sm text-gray-600 mb-2">{imported.charges} relevés de facturation importés</p>
          {errors.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-xs font-semibold text-red-600 mb-1">{errors.length} erreur(s) :</p>
              <div className="text-xs text-red-500 space-y-1 max-h-32 overflow-y-auto">
                {errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            </div>
          )}
          <button
            className="btn-primary mt-6"
            onClick={() => {
              setStep('upload')
              setParsed(null)
              setFile(null)
              setSheetAnalyses([])
              setErrors([])
              setImported(null)
            }}
          >
            Nouvel import
          </button>
        </div>
      )}
    </div>
  )
}
