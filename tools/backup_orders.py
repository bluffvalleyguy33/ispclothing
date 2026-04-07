"""
ISP Orders Backup
-----------------
Reads all orders from Firestore, writes them to Google Sheets, and saves
a timestamped JSON file to Google Drive.

Uses Workload Identity Federation — no key file required.
Credentials are provided automatically by the GitHub Actions auth step.
"""

import json
import os
import sys
import datetime
import tempfile

# ---- Config ----
SHEET_ID        = '1YbU0lRGg4hTGCx7oaXuN-qre7bua65rfdLUV7j_l7zg'
DRIVE_FOLDER_ID = '1W9-ON3IhMIvCpM2Edp58XvoMg30lHHCY'
FIREBASE_PROJECT = 'insignia-screen-printing'

# ---- Imports ----
import firebase_admin
from firebase_admin import credentials, firestore
import google.auth
from googleapiclient.discovery import build

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/cloud-platform',
]

# ---- Init Firebase using Application Default Credentials ----
print('Connecting to Firebase...')
firebase_admin.initialize_app(options={'projectId': FIREBASE_PROJECT})
db = firestore.client()

# ---- Init Google APIs using Application Default Credentials ----
google_creds, _ = google.auth.default(scopes=SCOPES)
sheets_svc = build('sheets', 'v4', credentials=google_creds)

# ---- Fetch all orders from Firestore ----
# Orders are stored as a JSON string in app_data/orders.data
print('Fetching orders from Firestore...')
doc = db.collection('app_data').document('orders').get()
if not doc.exists:
    print('ERROR: app_data/orders document not found in Firestore', file=sys.stderr)
    sys.exit(1)

raw = doc.to_dict().get('data', '[]')
orders = json.loads(raw) if isinstance(raw, str) else raw
print(f'  Found {len(orders)} orders')

# ---- Helpers ----
def safe(val, default=''):
    if val is None:
        return default
    if isinstance(val, (dict, list)):
        return json.dumps(val)
    return str(val)

def group_summary(groups):
    if not groups:
        return ''
    parts = []
    for g in groups:
        for it in g.get('items', []):
            name  = it.get('productName', '')
            color = it.get('color', '')
            qty   = it.get('totalQty', 0)
            ppp   = it.get('pricePerPiece', '')
            parts.append(f"{name} / {color} x{qty}" + (f" @ ${ppp}" if ppp else ''))
    return ' | '.join(parts)

# ---- Build rows for Google Sheets ----
HEADERS = [
    'Order ID', 'Status', 'Sub Status', 'Source',
    'Customer Name', 'Customer Email', 'Customer Phone', 'Company',
    'Sales Rep',
    'Total Qty', 'Price / Pc', 'Total Price',
    'Products Summary', 'Decoration Types',
    'In-Hand Date', 'Hard Deadline',
    'Quote Approved', 'Is Paid', 'Customer Supplied Blanks',
    'Visible to Customer',
    'Notes', 'Customer Note',
    'Created At', 'Updated At',
]

rows = [HEADERS]
for o in sorted(orders, key=lambda x: x.get('createdAt', ''), reverse=True):
    groups     = o.get('decorationGroups', [])
    deco_types = o.get('decorationTypes', [])
    rows.append([
        safe(o.get('id') or o.get('_docId')),
        safe(o.get('status')),
        safe(o.get('subStatus')),
        safe(o.get('source', 'manual')),
        safe(o.get('customerName')),
        safe(o.get('customerEmail')),
        safe(o.get('customerPhone')),
        safe(o.get('customerCompany')),
        safe(o.get('salesRepName')),
        safe(o.get('totalQty', 0)),
        safe(o.get('pricePerPiece')),
        safe(o.get('totalPrice')),
        group_summary(groups) or safe(o.get('product')),
        ', '.join(deco_types) if deco_types else safe(o.get('decorationType')),
        safe(o.get('inHandDate')),
        'Yes' if o.get('isHardDeadline') else 'No',
        'Yes' if o.get('quoteApproved') else 'No',
        'Yes' if o.get('isPaid') else 'No',
        'Yes' if o.get('customerSuppliedBlanks') else 'No',
        'Yes' if o.get('visibleToCustomer', True) else 'No',
        safe(o.get('notes')),
        safe(o.get('customerNote')),
        safe(o.get('createdAt')),
        safe(o.get('updatedAt')),
    ])

# ---- Write to Google Sheets ----
print(f'Writing {len(rows)-1} orders to Google Sheets...')
sheet = sheets_svc.spreadsheets()

sheet.values().clear(spreadsheetId=SHEET_ID, range='Sheet1').execute()
sheet.values().update(
    spreadsheetId=SHEET_ID,
    range='Sheet1!A1',
    valueInputOption='RAW',
    body={'values': rows},
).execute()

# Format header row
sheet.batchUpdate(
    spreadsheetId=SHEET_ID,
    body={'requests': [
        {'repeatCell': {
            'range': {'sheetId': 0, 'startRowIndex': 0, 'endRowIndex': 1},
            'cell': {'userEnteredFormat': {
                'backgroundColor': {'red': 0.1, 'green': 0.1, 'blue': 0.1},
                'textFormat': {'bold': True, 'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}},
            }},
            'fields': 'userEnteredFormat(backgroundColor,textFormat)',
        }},
        {'updateSheetProperties': {
            'properties': {'sheetId': 0, 'gridProperties': {'frozenRowCount': 1}},
            'fields': 'gridProperties.frozenRowCount',
        }},
    ]},
).execute()
print('  Google Sheets updated.')

# ---- Save JSON backup to file (committed to repo by the workflow) ----
print('Writing JSON backup file...')
os.makedirs('backups', exist_ok=True)
timestamp   = datetime.datetime.utcnow().strftime('%Y-%m-%d_%H-%M-%S')
backup_path = f'backups/isp_orders_backup_{timestamp}.json'
latest_path = 'backups/latest.json'

with open(backup_path, 'w') as f:
    json.dump(orders, f, indent=2, default=str)

with open(latest_path, 'w') as f:
    json.dump(orders, f, indent=2, default=str)

print(f'  Written: {backup_path}')
print(f'  Written: {latest_path} (always current)')

print(f'\nBackup complete — {len(orders)} orders backed up at {datetime.datetime.utcnow().isoformat()}Z')
