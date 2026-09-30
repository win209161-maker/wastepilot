"""
WastePilot — Full reset and reimport from Excel.
Only Base initiale defines the 264 customers.
Billing sheets only provide billing amounts — matched to existing customers.
"""
import requests, sys, re, openpyxl
from datetime import datetime
from collections import Counter

SUPABASE_URL = 'https://fiftiotizthtwayudpkj.supabase.co'
ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpZnRpb3RpenRodHdheXVkcGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NzA4NzgsImV4cCI6MjEwNjI0Njg3OH0.QQ1eqNdvHVOhjle-v1Gbn4Epu5WCOo7RQF0938pwN6c'
EXCEL = r'C:\Users\user\Barry_project\trash project\abonnement2026.xlsx'
CHUNK = 50

def hdrs(t):
    return {'apikey': ANON_KEY, 'Authorization': f'Bearer {t}',
            'Content-Type': 'application/json', 'Prefer': 'return=representation'}
def mhdrs(t):
    return {'apikey': ANON_KEY, 'Authorization': f'Bearer {t}',
            'Content-Type': 'application/json', 'Prefer': 'return=minimal'}

def clean(v):
    if v is None: return ''
    s = str(v).strip()
    while s.startswith("'"): s = s[1:]
    return s.strip()

def norm(s):
    return re.sub(r'\s+', ' ', str(s or '').upper().strip())

def extract_period(text):
    if not text: return None
    t = text.lower()
    for s, d in [('à','a'),('á','a'),('â','a'),('è','e'),('é','e'),('ê','e'),
                 ('ù','u'),('û','u'),('ô','o'),('î','i'),('ç','c')]:
        t = t.replace(s, d)
    MMAP = {'janvier':'01','fevrier':'02','mars':'03','avril':'04','mai':'05','juin':'06',
            'juillet':'07','aout':'08','septembre':'09','octobre':'10','novembre':'11','decembre':'12',
            'jan':'01','fev':'02','avr':'04','juil':'07','aou':'08','sep':'09',
            'oct':'10','nov':'11','dec':'12'}
    pat = r'(' + '|'.join(sorted(MMAP, key=len, reverse=True)) + r')\s*(\d{4})'
    m = re.search(pat, t)
    if m: return f'{m.group(2)}-{MMAP[m.group(1)]}'
    yr = re.search(r'20(\d{2})', t)
    if not yr: return None
    year = f'20{yr.group(1)}'
    for k in sorted(MMAP, key=len, reverse=True):
        if k in t: return f'{year}-{MMAP[k]}'
    return None

def parse_amt(v):
    if v is None or v == '': return None
    s = str(v).strip()
    m = re.match(r'(\d[\d\s]*)\s*[xX*]\s*(\d[\d\s]*)', s)
    if m:
        try: return int(m.group(1).replace(' ','')) * int(m.group(2).replace(' ',''))
        except: pass
    try: return int(float(s.replace(' ', '')))
    except: return None

def fix_date(v):
    if isinstance(v, datetime): return v.strftime('%Y-%m-%d')
    if not v: return None
    s = str(v).strip()
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', s)
    if m: return f'{m.group(3)}-{m.group(2)}-{m.group(1)}'
    return s[:10] if len(s) >= 10 else None

# ── Auth ──────────────────────────────────────────────────────────────────────
print('Signing in...')
r = requests.post(f'{SUPABASE_URL}/auth/v1/token?grant_type=password',
    json={'email': 'admin@wastepilot.app', 'password': 'WastePilot2026!'},
    headers={'apikey': ANON_KEY, 'Content-Type': 'application/json'})
if r.status_code != 200: print('Login failed:', r.text); sys.exit(1)
TOKEN = r.json()['access_token']
print('OK')

r = requests.get(f'{SUPABASE_URL}/rest/v1/organizations', params={'select': 'id,name'}, headers=hdrs(TOKEN))
ORG_ID = r.json()[0]['id']
print(f'Org: {r.json()[0]["name"]}')

# ── Clear ─────────────────────────────────────────────────────────────────────
print('\nClearing...')
requests.delete(f'{SUPABASE_URL}/rest/v1/customers', params={'org_id': f'eq.{ORG_ID}'}, headers=mhdrs(TOKEN))
requests.delete(f'{SUPABASE_URL}/rest/v1/sectors', params={'org_id': f'eq.{ORG_ID}'}, headers=mhdrs(TOKEN))

# ── Sectors ───────────────────────────────────────────────────────────────────
print('Creating sectors...')
r = requests.post(f'{SUPABASE_URL}/rest/v1/sectors', headers=hdrs(TOKEN), json=[
    {'org_id': ORG_ID, 'name': 'Alpha Yaya',   'code': 'AY',  'active': True},
    {'org_id': ORG_ID, 'name': 'Koloma 1 Est', 'code': 'K1E', 'active': True},
    {'org_id': ORG_ID, 'name': 'Koloma 2',     'code': 'K2',  'active': True},
])
SECTORS = r.json()
SMAP = {}
for i, s in enumerate(SECTORS, 1):
    SMAP[s['code'].upper()] = s['id']
    SMAP[norm(s['name'])] = s['id']
    SMAP[norm(s['name']).replace(' ', '')] = s['id']
    SMAP[str(i)] = s['id']
print(f'  {[s["code"] for s in SECTORS]}')

def resolve_sector(a, b=None):
    for v in [a, b]:
        if not v: continue
        k = norm(str(v)).replace(' ', '')
        if k in SMAP: return SMAP[k]
    return None

# ── Parse Excel ───────────────────────────────────────────────────────────────
print('\nParsing Excel...')
wb = openpyxl.load_workbook(EXCEL)

# Base initiale: only source of customer records
# Cols: N°, Nom, Prénoms, Contacts, Quartier, Date demande, Secteur, Concession, Réf/Foyer, Numéro abonné
base_list = []
ws = wb['Base initiale']
for row in ws.iter_rows(min_row=3, values_only=True):
    if not row or row[1] is None: continue
    ln = norm(clean(row[1])); fn = clean(row[2]).strip()
    if not ln or ln == 'NOM': continue
    phone = clean(row[3]) or None
    neighborhood = clean(row[4]) or None
    req_date = fix_date(row[5])
    sector_name = clean(row[6])
    concession = clean(row[7]) or None
    reference = clean(row[8]) or None
    subscriber_id = clean(row[9]) or None
    sector_id = resolve_sector(sector_name, neighborhood)
    base_list.append({
        'org_id': ORG_ID, 'last_name': ln, 'first_name': fn, 'phone': phone,
        'subscriber_id': subscriber_id, 'neighborhood': neighborhood, 'sector_id': sector_id,
        'concession': concession, 'reference': reference, 'request_date': req_date, 'status': 'active',
    })

print(f'  Base initiale: {len(base_list)} customers')

# Parse billing sheets: produce rows with amount data, no new customers
billing = {}  # period -> list of billing rows
for sheet_name in wb.sheetnames:
    if sheet_name == 'Base initiale': continue
    ws = wb[sheet_name]
    all_rows = list(ws.iter_rows(min_row=1, values_only=True))
    period = None
    for r in all_rows[:2]:
        if r and r[0]:
            period = extract_period(str(r[0]))
            if period: break
    if not period: period = extract_period(sheet_name)
    print(f'  Sheet "{sheet_name}" -> period: {period}')
    if period not in billing: billing[period] = []

    header_row = -1
    for i, r in enumerate(all_rows[:5]):
        if r and any(norm(str(v or '')) in ('NOM', 'N° O', 'N°O', 'N°', 'NO') for v in r[:3]):
            header_row = i; break
    if header_row == -1: continue

    for row in all_rows[header_row + 1:]:
        if not row: continue
        for offset in [0, 13]:
            if offset >= len(row): continue
            r = row[offset:offset + 12]
            if not r or r[1] is None: continue
            ln = norm(clean(r[1])); fn = (clean(r[2]) if len(r) > 2 else '').strip()
            if not ln or ln in ('NOM', 'N°', 'N° O'): continue
            sub_id = clean(r[3]) if len(r) > 3 else ''
            sub_id = sub_id if '/' in sub_id else None
            amt_due = parse_amt(r[4] if len(r) > 4 else None)
            amt_paid = parse_amt(r[5] if len(r) > 5 else None) or 0
            phone = clean(r[6]) if len(r) > 6 else None
            billing[period].append({
                'last_name': ln, 'first_name': fn, 'subscriber_id': sub_id,
                'phone': phone or None, 'amount_due': amt_due, 'amount_paid': amt_paid,
            })

# ── Insert customers (Base initiale only) ─────────────────────────────────────
print(f'\nInserting {len(base_list)} customers...')
CUST_MAP = {}   # sub_id -> cust_id
NAME_MAP = {}   # "LAST|FIRST" -> cust_id (for billing matching)
PHONE_MAP = {}  # phone -> cust_id

for i in range(0, len(base_list), CHUNK):
    chunk = base_list[i:i + CHUNK]
    r = requests.post(f'{SUPABASE_URL}/rest/v1/customers', json=chunk, headers=hdrs(TOKEN))
    if r.status_code not in (200, 201):
        print(f'  ERR {i}: {r.status_code} {r.text[:200]}'); continue
    for c in r.json():
        if c.get('subscriber_id'):
            CUST_MAP[c['subscriber_id']] = c['id']
        nk = f"{c['last_name']}|{c['first_name']}"
        NAME_MAP[nk] = c['id']
        if c.get('phone'):
            PHONE_MAP[c['phone']] = c['id']

print(f'  Inserted {len(NAME_MAP)} customers')

def find_customer(last, first, sub_id, phone):
    # 1. Exact subscriber_id
    if sub_id and sub_id in CUST_MAP:
        return CUST_MAP[sub_id]
    # 2. Last + First + Phone
    if phone:
        nk = f'{norm(last)}|{first.strip()}'
        if nk in NAME_MAP and PHONE_MAP.get(phone) == NAME_MAP[nk]:
            return NAME_MAP[nk]
    # 3. Last + First name only
    nk = f'{norm(last)}|{first.strip()}'
    if nk in NAME_MAP:
        return NAME_MAP[nk]
    # 4. Phone only (last resort)
    if phone and phone in PHONE_MAP:
        return PHONE_MAP[phone]
    return None

# ── Subscriptions: gather best monthly price per customer ─────────────────────
cust_prices = {}
for period, rows in billing.items():
    for row in rows:
        if not row['amount_due']: continue
        cid = find_customer(row['last_name'], row['first_name'], row['subscriber_id'], row['phone'])
        if cid and cid not in cust_prices:
            cust_prices[cid] = row['amount_due']

print(f'\nCreating {len(cust_prices)} subscriptions...')
subs_payload = [
    {'org_id': ORG_ID, 'customer_id': cid, 'monthly_price': price,
     'start_date': '2025-01-01', 'status': 'active', 'service_frequency': 'monthly'}
    for cid, price in cust_prices.items()
]
SUB_MAP = {}
for i in range(0, len(subs_payload), CHUNK):
    chunk = subs_payload[i:i + CHUNK]
    r = requests.post(f'{SUPABASE_URL}/rest/v1/subscriptions', json=chunk, headers=hdrs(TOKEN))
    if r.status_code not in (200, 201):
        print(f'  ERR subs {i}: {r.status_code} {r.text[:200]}'); continue
    for s in r.json():
        SUB_MAP[s['customer_id']] = s['id']
print(f'  Created {len(SUB_MAP)} subscriptions')

# ── Billing charges ────────────────────────────────────────────────────────────
print('\nCreating billing charges...')
charges = []
seen = set()
unmatched = 0
for period, rows in billing.items():
    if period is None: continue
    for row in rows:
        if not row['amount_due']: continue
        cid = find_customer(row['last_name'], row['first_name'], row['subscriber_id'], row['phone'])
        if not cid:
            unmatched += 1; continue
        sid = SUB_MAP.get(cid)
        if not sid: continue
        ck = (cid, period)
        if ck in seen: continue
        seen.add(ck)
        monthly_price = cust_prices.get(cid, row['amount_due'])
        months_billed = max(1, round(row['amount_due'] / monthly_price)) if monthly_price else 1
        amt_paid = min(row['amount_paid'] or 0, row['amount_due'])
        status = 'paid' if amt_paid >= row['amount_due'] else ('partial' if amt_paid > 0 else 'unpaid')
        charges.append({
            'org_id': ORG_ID, 'customer_id': cid, 'subscription_id': sid,
            'billing_period': period, 'monthly_price': monthly_price,
            'months_billed': months_billed, 'amount_due': row['amount_due'],
            'amount_paid': amt_paid, 'status': status,
        })

charges_created = 0
for i in range(0, len(charges), CHUNK):
    chunk = charges[i:i + CHUNK]
    r = requests.post(f'{SUPABASE_URL}/rest/v1/billing_charges', json=chunk, headers=hdrs(TOKEN))
    if r.status_code not in (200, 201):
        print(f'  ERR charges {i}: {r.status_code} {r.text[:200]}'); continue
    charges_created += len(chunk)

print(f'  Created {charges_created} charges ({unmatched} billing rows unmatched to any base customer)')

# ── Final summary ──────────────────────────────────────────────────────────────
print('\nFinal DB state:')
for table in ['customers', 'subscriptions', 'billing_charges']:
    r = requests.get(f'{SUPABASE_URL}/rest/v1/{table}', params={'select': 'id', 'limit': '1'},
        headers={**hdrs(TOKEN), 'Range': '0-4999', 'Prefer': 'count=exact'})
    print(f'  {table}: {r.headers.get("content-range","?").split("/")[-1]}')

r = requests.get(f'{SUPABASE_URL}/rest/v1/billing_charges',
    params={'select': 'billing_period,status,amount_due,amount_paid'},
    headers={**hdrs(TOKEN), 'Range': '0-4999'})
ch = r.json()
by_period = Counter(c['billing_period'] for c in ch)
by_status = Counter(c['status'] for c in ch)
total_due = sum(c['amount_due'] for c in ch if c['billing_period'] == max(by_period))
total_paid = sum(c['amount_paid'] for c in ch if c['billing_period'] == max(by_period))
latest = max(by_period) if by_period else '-'
print(f'  By period: {dict(sorted(by_period.items()))}')
print(f'  By status: {dict(by_status)}')
print(f'  Latest period ({latest}): due={total_due:,} FG  paid={total_paid:,} FG  balance={total_due-total_paid:,} FG')
print('\nDone.')
