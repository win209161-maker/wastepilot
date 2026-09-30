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

function parseRow(row: any[], sheet: string): ParsedCustomer | null {
  const [num, lastName, firstName, numAbonne, montantPayer, montantPaye, contact, quartier, dateDemande, sect, concession, ref] = row

  if (!lastName || typeof lastName !== 'string') return null
  if (!firstName || typeof firstName !== 'string') return null
  if (String(lastName).toUpperCase() === 'NOM') return null // header

  let amountDue: number | null = null
  let amountPaid: number | null = null
  let monthlyPrice: number | null = null
  let monthsBilled: number | null = null
  let rawAmount: string | null = null
  let needsReview = false
  let reviewReason: string | null = null

  // Parse amount to pay (could be "2x20000" or 20000 or a number)
  const rawPayer = montantPayer
  const rawPaye = montantPaye
  rawAmount = String(rawPayer ?? '')

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

  if (rawPaye != null && rawPaye !== '' && rawPaye !== 0) {
    const p = parseFloat(String(rawPaye))
    if (!isNaN(p)) amountPaid = p
  }

  // Parse date
  let requestDate: string | null = null
  if (dateDemande instanceof Date) {
    requestDate = dateDemande.toISOString().split('T')[0]
  } else if (typeof dateDemande === 'string' && dateDemande) {
    requestDate = dateDemande
  }

  // Subscriber ID (could be numeric or text)
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
    request_date: requestDate,
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

  // Find header row
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

    // Left table (cols 0-11)
    const leftRow = row.slice(0, 12)
    const parsed = parseRow(leftRow, name)
    if (parsed) results.push(parsed)

    // Right table if sheet has 2 tables (cols 13-24)
    if (maxCols >= 24) {
      const rightRow = row.slice(13, 25)
      const parsedRight = parseRow(rightRow, name + ' (droite)')
      if (parsedRight) results.push(parsedRight)
    }
  }

  return results
}

export function Import() {
  const { org } = useOrg()
  const [_file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedCustomer[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
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
        const ws = wb.Sheets[name]
        const rows = parseSheet(ws, name)
        allRows.push(...rows)
      }

      setParsed(allRows)
      setStep('preview')
    }
    reader.readAsBinaryString(f)
  }, [])

  async function handleImport() {
    if (!parsed) return
    setImporting(true)
    setErrors([])
    let count = 0

    // Build sector map: code, name, AND numeric order (1=first alphabetically, etc.)
    const { data: sectors } = await supabase.from('sectors').select('id, code, name').eq('org_id', org!.id).order('name')
    const sectorMap = new Map<string, string>()
    for (let i = 0; i < (sectors ?? []).length; i++) {
      const s = (sectors as any[])[i]
      sectorMap.set(s.code.toUpperCase().replace(/\s+/g, ''), s.id)
      sectorMap.set(s.name.toUpperCase().replace(/\s+/g, ''), s.id)
      sectorMap.set(String(i + 1), s.id) // numeric: 1, 2, 3 → first, second, third sector
    }

    const resolveSector = (code: string | null, neighborhood: string | null): string | null => {
      const tries = [
        code?.toUpperCase().replace(/\s+/g, ''),
        code?.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
        neighborhood?.toUpperCase().replace(/\s+/g, ''),
      ]
      for (const t of tries) if (t && sectorMap.has(t)) return sectorMap.get(t)!
      return null
    }

    const extractPeriod = (sheet: string): string | null => {
      const s = sheet.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      const yr = s.match(/20(\d{2})/); if (!yr) return null
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

    const toImport = parsed.filter(r => !r.needs_review)

    for (const row of toImport) {
      try {
        const sectorId = resolveSector(row.sector_code, row.neighborhood)
        const customerPayload: any = {
          org_id: org!.id,
          last_name: row.last_name,
          first_name: row.first_name,
          phone: row.phone,
          subscriber_id: row.subscriber_id,
          neighborhood: row.neighborhood,
          sector_id: sectorId,
          concession: row.concession,
          reference: row.reference,
          request_date: row.request_date,
          status: 'active',
        }

        let customer: any
        let custErr: any

        if (row.subscriber_id) {
          // Upsert by unique subscriber_id
          const res = await supabase
            .from('customers')
            .upsert(customerPayload, { onConflict: 'org_id,subscriber_id', ignoreDuplicates: false })
            .select().single()
          customer = res.data; custErr = res.error
        } else {
          // Check for existing customer by name+phone to prevent duplicates on re-import
          const { data: existing } = await supabase.from('customers').select('id')
            .eq('org_id', org!.id)
            .eq('last_name', row.last_name)
            .eq('first_name', row.first_name)
            .eq('phone', row.phone ?? '')
            .maybeSingle()
          if (existing) {
            customer = existing
          } else {
            const res = await supabase.from('customers').insert(customerPayload).select().single()
            customer = res.data; custErr = res.error
          }
        }

        if (custErr || !customer) {
          setErrors(e => [...e, `${row.last_name} ${row.first_name}: ${custErr?.message}`])
          continue
        }

        // Find or create subscription (avoid duplicates on re-import)
        let subscriptionId: string | null = null
        if (row.monthly_price && row.monthly_price > 0) {
          const { data: existingSub } = await supabase.from('subscriptions').select('id')
            .eq('customer_id', customer.id).eq('status', 'active').maybeSingle()
          if (existingSub) {
            subscriptionId = existingSub.id
          } else {
            const { data: newSub } = await supabase.from('subscriptions').insert({
              org_id: org!.id,
              customer_id: customer.id,
              monthly_price: row.monthly_price,
              start_date: row.request_date ?? new Date().toISOString().split('T')[0],
              status: 'active',
              service_frequency: 'monthly',
            } as any).select('id').single()
            subscriptionId = newSub?.id ?? null
          }
        }

        // Create billing charge if this sheet has a billing period
        const billingPeriod = extractPeriod(row.sheet)
        if (billingPeriod && subscriptionId && row.amount_due && row.amount_due > 0) {
          const amtPaid = row.amount_paid ?? 0
          const balance = row.amount_due - amtPaid
          const status = amtPaid >= row.amount_due ? 'paid' : amtPaid > 0 ? 'partial' : 'unpaid'
          await supabase.from('billing_charges').upsert({
            org_id: org!.id,
            customer_id: customer.id,
            subscription_id: subscriptionId,
            billing_period: billingPeriod,
            amount_due: row.amount_due,
            amount_paid: amtPaid,
            balance,
            status,
          } as any, { onConflict: 'subscription_id,billing_period', ignoreDuplicates: false })
        }

        count++
      } catch (e) {
        setErrors(err => [...err, `${row.last_name}: ${e}`])
      }
    }

    setImported(count)
    setImporting(false)
    setStep('done')
  }

  const reviewItems = parsed?.filter(r => r.needs_review) ?? []
  const okItems = parsed?.filter(r => !r.needs_review) ?? []

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
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{parsed.length}</div>
              <div className="text-xs text-gray-500">Lignes trouvées</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{okItems.length}</div>
              <div className="text-xs text-gray-500">Prêts à importer</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{reviewItems.length}</div>
              <div className="text-xs text-gray-500">À vérifier</div>
            </div>
          </div>

          {/* Needs review */}
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
                    {reviewItems.map((r, i) => (
                      <tr key={i}>
                        <td className="table-cell font-medium">{r.last_name} {r.first_name}</td>
                        <td className="table-cell text-gray-500">{r.sheet}</td>
                        <td className="table-cell text-orange-600">{r.review_reason}</td>
                        <td className="table-cell font-mono text-gray-400">{r.raw_amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview OK */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Aperçu — {okItems.length} clients à importer</h2>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="border-b border-gray-200">
                    <th className="table-header">Nom</th>
                    <th className="table-header">Téléphone</th>
                    <th className="table-header">Secteur</th>
                    <th className="table-header text-right">Montant/mois</th>
                    <th className="table-header text-right">Mois</th>
                    <th className="table-header">Feuille</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {okItems.slice(0, 100).map((r, i) => (
                    <tr key={i}>
                      <td className="table-cell font-medium">{r.last_name} {r.first_name}</td>
                      <td className="table-cell text-gray-500">{r.phone ?? '—'}</td>
                      <td className="table-cell text-gray-500">{r.sector_code ?? '—'}</td>
                      <td className="table-cell text-right">{r.monthly_price?.toLocaleString() ?? '—'} FG</td>
                      <td className="table-cell text-right text-gray-500">{r.months_billed ?? 1}</td>
                      <td className="table-cell text-gray-400">{r.sheet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => { setStep('upload'); setParsed(null); setFile(null) }}>
              Annuler
            </button>
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={importing || okItems.length === 0}
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Importation...</>
              ) : (
                <>Importer {okItems.length} clients</>
              )}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="card p-8 text-center max-w-md mx-auto">
          <div className="p-4 bg-green-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Import terminé</h2>
          <p className="text-sm text-gray-600 mb-2">{imported} clients importés avec succès</p>
          {errors.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-xs font-semibold text-red-600 mb-1">{errors.length} erreur(s):</p>
              <div className="text-xs text-red-500 space-y-1 max-h-32 overflow-y-auto">
                {errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            </div>
          )}
          <button className="btn-primary mt-6" onClick={() => { setStep('upload'); setParsed(null); setFile(null); setErrors([]) }}>
            Nouvel import
          </button>
        </div>
      )}
    </div>
  )
}
