import time
from flask import Flask, render_template, request, jsonify
from itsdangerous import URLSafeSerializer

app = Flask(__name__)

# ==============================================================================
# SECURITY CONFIGURATION 
# ==============================================================================
app.config['SECRET_KEY'] = 'kadamba_super_secret_key_123'
serializer = URLSafeSerializer(app.config['SECRET_KEY'])

# ==============================================================================
# SIMULATED DATABASE
# ==============================================================================
orders = []
order_id_counter = 1
kitchen_heartbeats = {1: 0, 2: 0}

# ==============================================================================
# STRICT SERVER-SIDE HTML RENDERING
# ==============================================================================
@app.route('/')
@app.route('/customer.html')
def customer_view():
    table_id = request.args.get('table_id', type=int)
    token = request.args.get('token')
    
    # STRICT BLOCK 1: Missing ID or Token
    if not table_id or not token:
        return "<body style='background:#111; color:#e74c3c; text-align:center; padding:15vh 20px; font-family:sans-serif;'><h1>⚠️ Access Denied</h1><p style='color:#ccc; font-size:18px;'>Please scan the official QR code on your table to view the menu.</p></body>", 403
        
    # STRICT BLOCK 2: Tampered or Fake Token
    try:
        payload = serializer.loads(token)
        if int(payload['table_id']) != table_id:
            raise ValueError("ID Mismatch")
    except Exception:
        return "<body style='background:#111; color:#e74c3c; text-align:center; padding:15vh 20px; font-family:sans-serif;'><h1>⚠️ Security Alert</h1><p style='color:#ccc; font-size:18px;'>Invalid or expired QR code. Access Blocked.</p></body>", 403

    # If it passes, render the page normally
    return render_template('customer.html', table_id=table_id)

# Staff pages have NO security blocks, they will always open.
@app.route('/kitchen1.html')
def kitchen1_view(): return render_template('kitchen1.html')

@app.route('/kitchen2.html')
def kitchen2_view(): return render_template('kitchen2.html')

@app.route('/waiter.html')
def waiter_view(): return render_template('waiter.html')

@app.route('/owner')
@app.route('/owner.html')
def owner_view(): return render_template('owner.html')

# ==============================================================================
# SECURITY LINK GENERATOR
# ==============================================================================
@app.route('/get_qr_links')
def get_qr_links():
    html = """
    <html>
    <head>
        <title>Kadamba Security Panel</title>
        <style>
            body { font-family: sans-serif; padding: 30px; background: #111; color: #fff; }
            h2 { color: #C5A059; border-bottom: 2px solid #C5A059; padding-bottom: 10px; }
            .link-card { background: #222; border: 1px solid #333; padding: 12px; margin-bottom: 10px; border-radius: 6px; }
            a { color: #27ae60; font-weight: bold; font-size: 14px; word-break: break-all; text-decoration: none; }
            a:hover { color: #2ecc71; text-decoration: underline; }
        </style>
    </head>
    <body>
        <h2>🔒 Encrypted Table QR Links (Click to test / Copy for QR)</h2>
    """
    for table_num in range(1, 21): 
        token = serializer.dumps({'table_id': table_num})
        url = f"/customer.html?table_id={table_num}&token={token}"
        html += f'<div class="link-card"><strong>Table {table_num}:</strong><br><a href="{url}" target="_blank">{url}</a></div>'
    html += "</body></html>"
    return html

# ==============================================================================
# CORE API ENDPOINTS
# ==============================================================================
@app.route('/place_order', methods=['POST'])
def place_order():
    global order_id_counter
    req = request.json
    submitted_token = req.get('token')
    
    if not submitted_token:
        return jsonify({"success": False, "error": "Missing Security Token"}), 403
        
    try:
        decrypted_payload = serializer.loads(submitted_token)
        real_table_id = int(decrypted_payload['table_id'])
    except Exception:
        return jsonify({"success": False, "error": "Invalid or Tampered Token"}), 403

    items_list = []
    for item in req.get('items', []):
        items_list.append({
            "name": item.get('name'),
            "price": item.get('price'),
            "qty": item.get('qty'),
            "pending_qty": item.get('qty') 
        })
        
    is_k2_online = (time.time() - kitchen_heartbeats[2]) < 6.0
    assigned_kitchen = 2 if (is_k2_online and real_table_id % 2 == 0) else 1

    current_time = time.strftime("%I:%M %p")
    current_date = time.strftime("%d/%m/%Y")

    new_order = {
        "id": order_id_counter,
        "table_id": real_table_id,
        "customer_name": req.get('customer_name', 'Guest'),
        "customer_phone": req.get('customer_phone', 'N/A'),
        "items": items_list,
        "status": "Pending",
        "timestamp": current_time,
        "date": current_date,
        "placed_at_timestamp": int(time.time() * 1000),
        "kitchen_id": assigned_kitchen,
        "duration_string": ""
    }
    
    orders.append(new_order)
    order_id_counter += 1
    return jsonify({"success": True, "message": "Order processed successfully."})

@app.route('/get_orders', methods=['GET'])
def get_orders():
    k2_active = (time.time() - kitchen_heartbeats[2]) < 6.0
    return jsonify({"orders": orders, "kitchen2_active": k2_active})

@app.route('/update_status', methods=['POST'])
def update_status():
    req = request.json
    order_id = req.get('id')
    new_status = req.get('status')
    
    for o in orders:
        if o['id'] == order_id:
            o['status'] = new_status
            if new_status == "Served":
                start_ms = o.get('placed_at_timestamp', 0)
                if start_ms > 0:
                    diff_seconds = int((time.time() * 1000 - start_ms) / 1000)
                    if diff_seconds < 60: o['duration_string'] = f"{diff_seconds}s"
                    else: o['duration_string'] = f"{diff_seconds // 60}m {diff_seconds % 60}s"
                for item in o['items']: item['pending_qty'] = 0
            break
    return jsonify({"success": True})

@app.route('/serve_item', methods=['POST'])
def serve_item():
    req = request.json
    order_id = req.get('order_id')
    item_name = req.get('item_name')
    
    for o in orders:
        if o['id'] == order_id:
            all_done = True
            for item in o['items']:
                if item['name'] == item_name:
                    p_qty = item.get('pending_qty', item['qty'])
                    if p_qty > 0: item['pending_qty'] = p_qty - 1
                if item.get('pending_qty', 0) > 0: all_done = False
                    
            if all_done:
                o['status'] = "Served"
                start_ms = o.get('placed_at_timestamp', 0)
                if start_ms > 0:
                    diff_seconds = int((time.time() * 1000 - start_ms) / 1000)
                    o['duration_string'] = f"{diff_seconds // 60}m {diff_seconds % 60}s" if diff_seconds >= 60 else f"{diff_seconds}s"
            break
    return jsonify({"success": True})

@app.route('/kitchen_ping', methods=['POST'])
def kitchen_ping():
    kitchen_id = request.json.get('kitchen_id', 1)
    if kitchen_id in kitchen_heartbeats: kitchen_heartbeats[kitchen_id] = time.time()
    return jsonify({"success": True})

@app.route('/print_to_wifi', methods=['POST'])
def print_to_wifi():
    print(f"--- OUTBOUND WIFI TICKET LOG [{request.json.get('ip')}] ---\n{request.json.get('text')}")
    return jsonify({"success": True})

@app.route('/wipe_system_archive', methods=['POST'])
def wipe_system_archive():
    global orders, order_id_counter
    archive_copy = list(orders)
    orders = []
    order_id_counter = 1
    return jsonify({"success": True, "archive": archive_copy})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)