"""
ISP Orders Backup
-----------------
Reads all orders from Firestore, writes them to Google Sheets, and saves
a timestamped JSON file to Google Drive.

Requires these environment variables (set as GitHub Secrets):
  FIREBASE_SERVICE_ACCOUNT_KEY  — full JSON content of the Firebase service account key
  GOOGLE_DRIVE_FOLDER_ID        — ID of the Google Drive folder to upload backups to

Sheet ID is hardcoded since it never changes.
"""

import json
import os
import sys
import datetime
import tempfile

# ---- Config ----
SHEET_ID         = '1YbU0lRGg4hTGCx7oaXuN-qre7bua65rfdLUV7j_l7zg'
DRIVE_FOLDER_ID  = '1W9-ON3IhMIvCpM2Edp58XvoMg30lHHCY'
FIREBASE_PROJECT = 'insignia-screen-printing'

# ---- Bootstrap credentials from env ----
raw_key = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')
if not raw_key:
    print('ERROR: FIREBASE_SERVICE_ACCOUNT_KEY not set', file=sys.stderr)
    sys.exit(1)

drive_folder_id = DRIVE_FOLDER_ID

# Write the service account key to a temp file so the SDKs can find it
_key_data = json.loads(raw_key)
_tmp_key = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
json.dump(_key_data, _tmp_key)
_tmp_key.close()
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = _tmp_key.name

# ---- Imports (after creds are ready) ----
import firebase_admin
from firebase_admin import credentials, firestore
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
]

# ---- Init Firebase ----
cred = credentials.Certificate(_tmp_key.name)
firebase_admin.initialize_app(cred)
db = firestore.client()

# ---- Init Google APIs ----
google_creds = service_account.Credentials.from_service_account_info(
    _key_data, scopes=SCOPES
)
sheets_svc = build('sheets', 'v4', credentials=google_creds)
drive_svc  = build('drive',  'v3', credentials=google_creds)

# ---- Fetch all orders from Firestore ----
print('Fetching orders from Firestore...')
orders_ref = db.collection('orders')
docs = orders_ref.stream()
orders = []
for doc in docs:
    o = doc.to_dict()
    o['_docId'] = doc.id
    orders.append(o)

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
        items = g.get('items', [])
        for it in items:
            name = it.get('productName', '')
            color = it.get('color', '')
            qty = it.get('totalQty', 0)
            ppp = it.get('pricePerPiece', '')
            parts.append(f"{name} / {color} x{qty}" + (f" @ ${ppp}" if ppp else ''))
    return ' | '.join(parts)

def group_price_summary(groups):
    if not groups:
        return ''
    totals = []
    for g in groups:
        items = g.get('items', [])
        for it in items:
            tp = it.get('totalPrice')
            if tp:
                totals.append(f"${tp:.2f}")
    return ' + '.join(totals)

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
    row = [
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
    ]
    rows.append(row)

# ---- Write to Google Sheets ----
print(f'Writing {len(rows)-1} orders to Google Sheets...')
sheet = sheets_svc.spreadsheets()

# Clear existing content
sheet.values().clear(
    spreadsheetId=SHEET_ID,
    range='Sheet1',
).execute()

# Write all rows
sheet.values().update(
    spreadsheetId=SHEET_ID,
    range='Sheet1!A1',
    valueInputOption='RAW',
    body={'values': rows},
).execute()

# Format header row bold + freeze it
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

# ---- Save JSON backup to Google Drive ----
if drive_folder_id:
    print('Uploading JSON backup to Google Drive...')
    timestamp = datetime.datetime.utcnow().strftime('%Y-%m-%d_%H-%M-%S')
    filename  = f'isp_orders_backup_{timestamp}.json'

    # Write orders to a temp JSON file
    tmp_json = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
    json.dump(orders, tmp_json, indent=2, default=str)
    tmp_json.close()

    file_meta = {
        'name':    filename,
        'parents': [drive_folder_id],
    }
    media = MediaFileUpload(tmp_json.name, mimetype='application/json')
    uploaded = drive_svc.files().create(
        body=file_meta, media_body=media, fields='id,name'
    ).execute()
    print(f'  Uploaded: {uploaded["name"]} (id: {uploaded["id"]})')
    os.unlink(tmp_json.name)
else:
    print('  GOOGLE_DRIVE_FOLDER_ID not set — skipping Drive backup.')

# ---- Done ----
os.unlink(_tmp_key.name)
print(f'\nBackup complete — {len(orders)} orders backed up at {datetime.datetime.utcnow().isoformat()}Z')
