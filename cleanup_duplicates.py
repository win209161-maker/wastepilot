"""
WastePilot — Remove duplicate customers from the database
Run:  python cleanup_duplicates.py
Enter your email + password when prompted.
"""
import requests
import getpass
import sys

SUPABASE_URL = "https://fiftiotizthtwayudpkj.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpZnRpb3RpenRodHdheXVkcGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NzA4NzgsImV4cCI6MjEwNjI0Njg3OH0.QQ1eqNdvHVOhjle-v1Gbn4Epu5WCOo7RQF0938pwN6c"


def headers(token):
    return {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def sign_in(email, password):
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": email, "password": password},
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
    )
    if r.status_code != 200:
        print(f"Login failed: {r.text}")
        sys.exit(1)
    return r.json()["access_token"]


def fetch_all_customers(token):
    """Fetch all customers in pages of 1000."""
    all_rows = []
    offset = 0
    page = 1000
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/customers",
            params={"select": "id,last_name,first_name,phone,subscriber_id,created_at,org_id"},
            headers={**headers(token), "Range": f"{offset}-{offset + page - 1}"},
        )
        r.raise_for_status()
        chunk = r.json()
        all_rows.extend(chunk)
        if len(chunk) < page:
            break
        offset += page
    return all_rows


def find_duplicate_ids(customers):
    """
    For each org, keep the OLDEST record per dedup key.
    Dedup key: subscriber_id if set, else (last_name+first_name+phone).
    Returns list of IDs to delete.
    """
    # Group by (org_id, dedup_key) → keep earliest created_at
    best = {}  # key → (created_at, id)
    for c in customers:
        org_id = c.get("org_id", "")
        sub = (c.get("subscriber_id") or "").strip()
        ln = (c.get("last_name") or "").lower().strip()
        fn = (c.get("first_name") or "").lower().strip()
        ph = (c.get("phone") or "").strip()

        if sub:
            key = (org_id, f"sub:{sub}")
        else:
            key = (org_id, f"name:{ln}|{fn}|{ph}")

        created = c.get("created_at", "")
        if key not in best or created < best[key][0]:
            best[key] = (created, c["id"])

    keep_ids = {v[1] for v in best.values()}
    return [c["id"] for c in customers if c["id"] not in keep_ids]


def delete_in_batches(token, ids, batch_size=50):
    """Delete IDs in small batches using PostgREST in= filter."""
    total = len(ids)
    deleted = 0
    for i in range(0, total, batch_size):
        chunk = ids[i:i + batch_size]
        id_list = ",".join(f'"{x}"' for x in chunk)
        r = requests.delete(
            f"{SUPABASE_URL}/rest/v1/customers",
            params={"id": f"in.({id_list})"},
            headers=headers(token),
        )
        if r.status_code not in (200, 204):
            print(f"  Error deleting batch {i}: {r.status_code} {r.text[:200]}")
            return deleted
        deleted += len(chunk)
        print(f"  Deleted {deleted}/{total}...")
    return deleted


if __name__ == "__main__":
    print("WastePilot — Duplicate customer cleanup")
    print("=" * 45)

    email = input("Email [admin@wastepilot.app]: ").strip() or "admin@wastepilot.app"
    password = getpass.getpass("Password: ")

    print("\nSigning in...")
    token = sign_in(email, password)
    print("✓ Signed in")

    print("Fetching all customers...")
    customers = fetch_all_customers(token)
    print(f"✓ {len(customers)} rows in DB")

    dup_ids = find_duplicate_ids(customers)
    unique_count = len(customers) - len(dup_ids)

    print(f"\nDuplicates found: {len(dup_ids)}")
    print(f"Unique customers to keep: {unique_count}")

    if not dup_ids:
        print("\nNo duplicates — database is already clean.")
        sys.exit(0)

    confirm = input(f"\nDelete {len(dup_ids)} duplicate rows? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("Aborted.")
        sys.exit(0)

    print(f"\nDeleting duplicates...")
    deleted = delete_in_batches(token, dup_ids)
    print(f"\n✓ Deleted {deleted} duplicate rows")
    print(f"✓ Database now has {unique_count} unique customers")
