from flask import Flask, render_template, request, jsonify
from datetime import datetime

app = Flask(__name__)

# Master in-memory data store
orders = []
order_id_counter = 1

@app.route('/')
def home():
    # Defaults to Table 1 if no specific table URL is hit
    return render_template('customer.html', table_id=1)

@app.route('/table/<int:table_id>')
def customer_table(table_id):
    # Dynamically maps any infinite table index seamlessly
    return render_template('customer.html', table_id=table_id)

@app.route('/kitchen')
def kitchen_dashboard():
    return render_template('kitchen.html')

@app.route('/place_order', methods=['POST'])
def place_order():
    global order_id_counter
    data = request.get_json() or {}
    items = data.get('items', [])
    table_id = data.get('table_id', 1) 
    customer_name = data.get('customer_name', 'Guest')
    customer_phone = data.get('customer_phone', 'N/A')
    
    if not items:
        return jsonify({"success": False, "message": "Cart is empty"}), 400
        
    order_total = sum(item['price'] * item['qty'] for item in items)
    
    # Injects live clock timestamp right at the moment of creation
    current_time = datetime.now().strftime("%d-%b-%Y | %I:%M %p")
    
    new_order = {
        "id": order_id_counter,
        "table_id": table_id,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "items": items,
        "total": order_total,
        "status": "Pending",
        "timestamp": current_time
    }
    orders.append(new_order)
    order_id_counter += 1
    return jsonify({"success": True})

@app.route('/get_orders')
def get_orders():
    return jsonify(orders)

@app.route('/history')
def get_history():
    return jsonify(orders)

@app.route('/update_status', methods=['POST'])
def update_status():
    data = request.get_json() or {}
    order_id = data.get('id')
    new_status = data.get('status')
    
    for order in orders:
        if order['id'] == order_id:
            order['status'] = new_status
            break
            
    return jsonify({"success": True})

@app.route('/invoice/<int:table_id>')
def generate_invoice(table_id):
    order_ids_str = request.args.get('ids')
    customer_name = request.args.get('name', 'Guest')
    customer_phone = request.args.get('phone', 'N/A')
    
    if order_ids_str:
        allowed_ids = [int(x) for x in order_ids_str.split(',') if x.isdigit()]
        table_orders = [o for o in orders if o['id'] in allowed_ids]
    else:
        table_orders = [o for o in orders if o['table_id'] == table_id and o['status'] == 'Served']
        
    if not table_orders:
        return f"""
        <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
            <h2>❌ No active served orders found for Table {table_id}</h2>
            <a href="/table/{table_id}" style="color:#C5A059; font-weight:bold;">Return to Menu</a>
        </div>
        """, 404
    
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Kadamba Receipt - Table 0{table_id}</title>
        <style>
            body {{ font-family: 'Courier New', Courier, monospace; padding: 20px; background: #f8f6f0; color: #231F20; }}
            .receipt-box {{ max-width: 360px; margin: auto; background: #fff; padding: 25px 20px; border: 1px solid #e8e2d5; }}
            .center {{ text-align: center; }}
            .right {{ text-align: right; }}
            table {{ width: 100%; margin-top: 20px; border-collapse: collapse; }}
            th, td {{ padding: 6px 0; font-size: 14px; }}
            th {{ border-bottom: 2px dashed #231F20; text-align: left; }}
            .total-row {{ border-top: 2px dashed #231F20; font-weight: bold; font-size: 16px; }}
            .btn-print {{ display: block; width: 100%; padding: 12px; background: #231F20; color: #C5A059; text-align: center; border: 1px solid #C5A059; font-weight: bold; margin-top: 25px; cursor: pointer; text-decoration: none; border-radius: 6px; }}
            @media print {{ .no-print {{ display: none !important; }} }}
        </style>
    </head>
    <body>
        <div class="receipt-box">
            <h2 class="center" style="margin-bottom: 4px;">ಕದಂಬ / KADAMBA</h2>
            <p class="center" style="margin-top: 0; font-size: 13px;">Classic Tradition<br>Moodbidri, Karnataka</p>
            <div style="border-top: 1px dashed #231F20; margin: 15px 0;"></div>
            <p><strong>TABLE NO:</strong> 0{table_id}</p>
            <p><strong>CUSTOMER:</strong> {customer_name.upper()}</p>
            <p><strong>PHONE NO:</strong> {customer_phone}</p>
            <table>
                <thead>
                    <tr><th>Item</th><th class="center">Qty</th><th class="right">Amt</th></tr>
                </thead>
                <tbody>
    """
    grand_total = 0
    for order in table_orders:
        for item in order['items']:
            grand_total += item['price'] * item['qty']
            html += f"<tr><td>{item['name']}</td><td class='center'>{item['qty']}</td><td class='right'>Rs. {item['price'] * item['qty']}</td></tr>"
            
    html += f"""
                    <tr class="total-row"><td colspan="2" style="padding-top:10px;">GRAND TOTAL</td><td class="right" style="padding-top:10px;">Rs. {grand_total}</td></tr>
                </tbody>
            </table>
            <div style="border-top: 1px dashed #231F20; margin: 20px 0 15px 0;"></div>
            <button class="btn-print no-print" onclick="window.print()">🖨️ Print Thermal Bill</button>
        </div>
    </body>
    </html>
    """
    return html

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)