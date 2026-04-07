"""
ISP Orders Backup
-----------------
1. Reads all orders from Firestore
2. Writes them to Google Sheets
3. Generates a PDF summary for each order
4. Emails a daily digest with all PDFs attached via SendGrid
5. Saves JSON backup to repo backups/ folder

Uses Workload Identity Federation — no key file required.
Credentials are provided automatically by the GitHub Actions auth step.
"""

import json
import os
import sys
import datetime
import tempfile
import base64

# ---- Config ----
SHEET_ID         = '1YbU0lRGg4hTGCx7oaXuN-qre7bua65rfdLUV7j_l7zg'
FIREBASE_PROJECT = 'insignia-screen-printing'
BACKUP_EMAIL_TO  = 'blake@insigniascreenprinting.com'
BACKUP_EMAIL_FROM = 'backup@insigniascreenprinting.com'  # must be verified in SendGrid

SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')

# ---- Imports ----
import firebase_admin
from firebase_admin import firestore
import google.auth
from googleapiclient.discovery import build
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import sendgrid
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/cloud-platform',
]

# ---- Init Firebase ----
print('Connecting to Firebase...')
firebase_admin.initialize_app(options={'projectId': FIREBASE_PROJECT})
db = firestore.client()

# ---- Init Google Sheets ----
google_creds, _ = google.auth.default(scopes=SCOPES)
sheets_svc = build('sheets', 'v4', credentials=google_creds)

# ---- Fetch all orders from Firestore ----
print('Fetching orders from Firestore...')
doc = db.collection('app_data').document('orders').get()
if not doc.exists:
    print('ERROR: app_data/orders document not found in Firestore', file=sys.stderr)
    sys.exit(1)

raw    = doc.to_dict().get('data', '[]')
orders = json.loads(raw) if isinstance(raw, str) else raw
print(f'  Found {len(orders)} orders')

# ---- Helpers ----
def safe(val, default=''):
    if val is None:
        return default
    if isinstance(val, (dict, list)):
        return json.dumps(val)
    return str(val)

def fmt_price(val):
    try:
        return f'${float(val):.2f}'
    except (TypeError, ValueError):
        return '—'

def fmt_date(val):
    if not val:
        return '—'
    try:
        return datetime.datetime.fromisoformat(val[:10]).strftime('%b %d, %Y')
    except Exception:
        return str(val)[:10]

def group_summary(groups):
    parts = []
    for g in groups:
        for it in g.get('items', []):
            name  = it.get('productName', '')
            color = it.get('color', '')
            qty   = it.get('totalQty', 0)
            ppp   = it.get('pricePerPiece', '')
            parts.append(f"{name} / {color} x{qty}" + (f" @ ${ppp}" if ppp else ''))
    return ' | '.join(parts)

# ---- Generate PDF for a single order ----
def generate_order_pdf(o):
    tmp = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
    tmp.close()

    doc    = SimpleDocTemplate(tmp.name, pagesize=letter,
                               leftMargin=0.6*inch, rightMargin=0.6*inch,
                               topMargin=0.6*inch, bottomMargin=0.6*inch)
    styles = getSampleStyleSheet()
    story  = []

    title_style = ParagraphStyle('title', parent=styles['Heading1'],
                                 fontSize=16, textColor=colors.HexColor('#00c896'))
    sub_style   = ParagraphStyle('sub',   parent=styles['Normal'],
                                 fontSize=10, textColor=colors.grey)
    label_style = ParagraphStyle('label', parent=styles['Normal'],
                                 fontSize=9,  textColor=colors.grey)
    value_style = ParagraphStyle('value', parent=styles['Normal'],
                                 fontSize=10, textColor=colors.black)

    order_id = o.get('id', o.get('_docId', '—'))
    story.append(Paragraph(f'Order {order_id}', title_style))
    story.append(Paragraph(f'Insignia Screen Printing — Backup {datetime.date.today()}', sub_style))
    story.append(Spacer(1, 0.2*inch))

    # Customer + order info table
    info_data = [
        ['Customer',    safe(o.get('customerName')),   'Status',      safe(o.get('status', '—'))],
        ['Email',       safe(o.get('customerEmail')),  'Total Qty',   str(o.get('totalQty', 0)) + ' pcs'],
        ['Phone',       safe(o.get('customerPhone')),  'Price / Pc',  fmt_price(o.get('pricePerPiece'))],
        ['Company',     safe(o.get('customerCompany')),'Total Price', fmt_price(o.get('totalPrice'))],
        ['In-Hand Date',fmt_date(o.get('inHandDate')), 'Created',     fmt_date(o.get('createdAt'))],
    ]
    info_table = Table(info_data, colWidths=[1.1*inch, 2.5*inch, 1.1*inch, 2.5*inch])
    info_table.setStyle(TableStyle([
        ('FONTSIZE',    (0,0), (-1,-1), 9),
        ('TEXTCOLOR',   (0,0), (0,-1), colors.grey),
        ('TEXTCOLOR',   (2,0), (2,-1), colors.grey),
        ('FONTNAME',    (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME',    (2,0), (2,-1), 'Helvetica-Bold'),
        ('VALIGN',      (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.HexColor('#f9f9f9'), colors.white]),
        ('BOX',         (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
        ('INNERGRID',   (0,0), (-1,-1), 0.25, colors.HexColor('#eeeeee')),
        ('TOPPADDING',  (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0),(-1,-1), 5),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.2*inch))

    # Decoration groups
    groups = o.get('decorationGroups', [])
    if groups:
        story.append(Paragraph('Products & Decorations', styles['Heading2']))
        for gi, g in enumerate(groups):
            decos     = g.get('decos') or [{'type': t} for t in g.get('decorationTypes', [])]
            deco_text = ', '.join(d.get('type','') + (' · ' + d.get('location','') if d.get('location') else '') for d in decos) or '—'
            story.append(Paragraph(f'<b>Group {gi+1}</b> — {deco_text}', styles['Normal']))
            story.append(Spacer(1, 0.05*inch))

            items = g.get('items', [])
            if items:
                # Build size columns from all items in this group
                all_sizes = []
                for it in items:
                    for sz in it.get('quantities', {}).keys():
                        if sz not in all_sizes:
                            all_sizes.append(sz)

                headers = ['Product', 'Color'] + all_sizes + ['Qty', 'Price/Pc', 'Total']
                item_rows = [headers]
                for it in items:
                    qty_cells = [str(it.get('quantities', {}).get(sz, '') or '') for sz in all_sizes]
                    item_rows.append([
                        it.get('productName', '—'),
                        it.get('color', '—'),
                        *qty_cells,
                        str(it.get('totalQty', 0)),
                        fmt_price(it.get('pricePerPiece')),
                        fmt_price(it.get('totalPrice')),
                    ])

                col_w = [2.5*inch, 0.9*inch] + [0.35*inch]*len(all_sizes) + [0.45*inch, 0.7*inch, 0.7*inch]
                item_table = Table(item_rows, colWidths=col_w)
                item_table.setStyle(TableStyle([
                    ('BACKGROUND',  (0,0), (-1,0), colors.HexColor('#222222')),
                    ('TEXTCOLOR',   (0,0), (-1,0), colors.white),
                    ('FONTNAME',    (0,0), (-1,0), 'Helvetica-Bold'),
                    ('FONTSIZE',    (0,0), (-1,-1), 8),
                    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#f9f9f9'), colors.white]),
                    ('BOX',         (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
                    ('INNERGRID',   (0,0), (-1,-1), 0.25, colors.HexColor('#eeeeee')),
                    ('ALIGN',       (2,0), (-1,-1), 'CENTER'),
                    ('TOPPADDING',  (0,0), (-1,-1), 4),
                    ('BOTTOMPADDING',(0,0),(-1,-1), 4),
                ]))
                story.append(item_table)
            story.append(Spacer(1, 0.15*inch))
    elif o.get('product'):
        story.append(Paragraph('Product', styles['Heading2']))
        story.append(Paragraph(f"{o.get('product')} / {o.get('color','—')} — {o.get('totalQty',0)} pcs", styles['Normal']))
        story.append(Spacer(1, 0.15*inch))

    # Notes
    if o.get('notes'):
        story.append(Paragraph('Notes', styles['Heading2']))
        story.append(Paragraph(safe(o.get('notes')), styles['Normal']))

    doc.build(story)
    return tmp.name

# ---- Build rows for Google Sheets ----
HEADERS = [
    'Order ID', 'Status', 'Sub Status', 'Source',
    'Customer Name', 'Customer Email', 'Customer Phone', 'Company',
    'Sales Rep', 'Total Qty', 'Price / Pc', 'Total Price',
    'Products Summary', 'Decoration Types',
    'In-Hand Date', 'Hard Deadline', 'Quote Approved', 'Is Paid',
    'Customer Supplied Blanks', 'Visible to Customer',
    'Notes', 'Customer Note', 'Created At', 'Updated At',
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

# ---- Generate PDFs ----
print('Generating PDFs...')
pdf_files = []
for o in orders:
    order_id = o.get('id', o.get('_docId', 'unknown'))
    try:
        path = generate_order_pdf(o)
        pdf_files.append((order_id, path))
        print(f'  Generated PDF for {order_id}')
    except Exception as e:
        print(f'  WARNING: Could not generate PDF for {order_id}: {e}')

print(f'  {len(pdf_files)} PDFs generated')

# ---- Send daily digest email via SendGrid ----
if SENDGRID_API_KEY and pdf_files:
    print('Sending daily digest email...')
    today     = datetime.date.today().strftime('%B %d, %Y')
    timestamp = datetime.datetime.utcnow().strftime('%Y-%m-%d')

    html_body = f"""
    <h2 style="color:#00c896">ISP Daily Order Backup — {today}</h2>
    <p>This is your automated daily backup from Insignia Screen Printing.</p>
    <ul>
      <li><strong>{len(orders)} total orders</strong> backed up</li>
      <li><strong>{len(pdf_files)} PDFs</strong> attached</li>
      <li>Google Sheets also updated: <a href="https://docs.google.com/spreadsheets/d/{SHEET_ID}">View Sheet</a></li>
    </ul>
    <p style="color:#999;font-size:12px">Sent automatically every night at 9pm Central.</p>
    """

    message = Mail(
        from_email=BACKUP_EMAIL_FROM,
        to_emails=BACKUP_EMAIL_TO,
        subject=f'ISP Order Backup — {today} ({len(orders)} orders)',
        html_content=html_body,
    )

    for order_id, path in pdf_files:
        with open(path, 'rb') as f:
            encoded = base64.b64encode(f.read()).decode()
        attachment = Attachment(
            FileContent(encoded),
            FileName(f'order_{order_id}.pdf'),
            FileType('application/pdf'),
            Disposition('attachment'),
        )
        message.add_attachment(attachment)

    sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
    response = sg.send(message)
    print(f'  Email sent — status {response.status_code}')
else:
    if not SENDGRID_API_KEY:
        print('  Skipping email — SENDGRID_API_KEY not set')
    if not pdf_files:
        print('  Skipping email — no PDFs generated')

# ---- Clean up temp PDF files ----
for _, path in pdf_files:
    try:
        os.unlink(path)
    except Exception:
        pass

# ---- Save JSON backup to repo ----
print('Writing JSON backup file...')
os.makedirs('backups', exist_ok=True)
backup_path = f'backups/isp_orders_backup_{timestamp}.json'
latest_path = 'backups/latest.json'

with open(backup_path, 'w') as f:
    json.dump(orders, f, indent=2, default=str)
with open(latest_path, 'w') as f:
    json.dump(orders, f, indent=2, default=str)

print(f'  Written: {backup_path}')
print(f'  Written: {latest_path}')

print(f'\nBackup complete — {len(orders)} orders at {datetime.datetime.utcnow().isoformat()}Z')
