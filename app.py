from flask import Flask, render_template, request, jsonify
from datetime import datetime
import json
import os
import time

app = Flask(__name__)

DB_FILE = "orders_session.json"
kitchen_status = {1: 0, 2: 0}

def load_persisted_db():
    if not os.path.exists(DB_FILE):
        return [], 1, 0
    try:
        with open(DB_FILE, "r") as f:
            data = json.load(f)
            orders = data.get("orders", [])
            counter = data.get("counter", 1)
            routing_idx = data.get("routing_idx", 0)
            return orders, counter, routing_idx
    except:
        return [], 1, 0

def save_persisted_db(orders, counter, routing_idx):
    try:
        with open(DB_FILE, "w") as f:
            json.dump({
                "orders": orders,
                "counter": counter,
                "routing_idx": routing_idx
            }, f, indent=4)
    except Exception as e:
        print(f"File writing failure: {e}")

orders_db, order_id_counter, order_routing_index = load_persisted_db()

@app.route('/table/<int:table_id>')
def customer_terminal(table_id):
    return render_template('customer.html', table_id=table_id)

@app.route('/kitchen1')
def kitchen_one_terminal():
    return render_template('kitchen1.html')

@app.route('/kitchen2')
def kitchen_two_terminal():
    return render_template('kitchen2.html')

@app.route('/waiter')
def waiter_terminal():
    return render_template('waiter.html')

@app.route('/kitchen_ping', methods=['POST'])
def kitchen_ping():
    try:
        data = request.get_json()
        k_id = int(data.get('kitchen_id', 0))
        if k_id in kitchen_status:
            kitchen_status[k_id] = time.time()
        return jsonify({"success": True})
    except:
        return jsonify({"success": False}), 400

@app.route('/place_order', methods=['POST'])
def place_order():
    global orders_db, order_id_counter, order_routing_index
    try:
        data = request.get_json()
        fixed_now_epoch_ms = int(datetime.now().timestamp() * 1000)
        
        is_kitchen2_active = (time.time() - kitchen_status[2]) < 7
        if is_kitchen2_active:
            if (order_routing_index % 8) < 4:
                assigned_kitchen = 1
            else:
                assigned_kitchen = 2
        else:
            assigned_kitchen = 1
            
        processed_items = []
        for item in data.get('items', []):
            qty = int(item.get('qty', 1))
            processed_items.append({
                "name": item.get('name'),
                "qty": qty,
                "pending_qty": qty,  # TRACKS REMAINING COUNT TO SERVE
                "price": float(item.get('price', 0))
            })
            
        new_order = {
            "id": order_id_counter,
            "table_id": int(data.get('table_id', 0)),
            "customer_name": data.get('customer_name', 'Guest'),
            "customer_phone": data.get('customer_phone', 'N/A'),
            "date": datetime.now().strftime("%m/%d/%Y"), 
            "timestamp": datetime.now().strftime("%I:%M %p"),
            "placed_at_timestamp": fixed_now_epoch_ms, 
            "served_at_timestamp": None,
            "duration_string": "",
            "items": processed_items,
            "status": "Pending",
            "kitchen_id": assigned_kitchen
        }
        
        orders_db.append(new_order)
        
        order_id_counter += 1
        order_routing_index += 1
        save_persisted_db(orders_db, order_id_counter, order_routing_index)
        
        return jsonify({"success": True, "token": new_order["id"], "kitchen": assigned_kitchen}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route('/get_orders')
def get_orders():
    is_kitchen2_active = (time.time() - kitchen_status[2]) < 7
    return jsonify({
        "orders": orders_db,
        "kitchen2_active": is_kitchen2_active
    })

# RESTORED: Fetch live prep status filtering by specific table
@app.route('/get_table_orders/<int:table_id>')
def get_table_orders(table_id):
    table_orders = [o for o in orders_db if o['table_id'] == table_id]
    return jsonify({"orders": table_orders})

@app.route('/history')
def order_history():
    return jsonify(orders_db)

@app.route('/serve_item', methods=['POST'])
def serve_item():
    global orders_db, order_id_counter, order_routing_index
    try:
        data = request.get_json()
        target_order_id = int(data.get('order_id'))
        item_name = data.get('item_name')
        
        for order in orders_db:
            if order['id'] == target_order_id:
                for item in order['items']:
                    if item['name'] == item_name and item.get('pending_qty', 0) > 0:
                        item['pending_qty'] -= 1
                        break
                
                all_served = all(i.get('pending_qty', 0) == 0 for i in order['items'])
                if all_served and order['status'] != "Served":
                    order['status'] = "Served"
                    now_ms = int(datetime.now().timestamp() * 1000)
                    order['served_at_timestamp'] = now_ms
                    diff_seconds = int((now_ms - order['placed_at_timestamp']) / 1000)
                    if diff_seconds < 60:
                        order['duration_string'] = f"{diff_seconds} sec"
                    else:
                        order['duration_string'] = f"{diff_seconds // 60} min {diff_seconds % 60} sec"
                
                save_persisted_db(orders_db, order_id_counter, order_routing_index)
                return jsonify({"success": True}), 200
        return jsonify({"success": False, "error": "Order or Item not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route('/update_status', methods=['POST'])
def update_status():
    global orders_db, order_id_counter, order_routing_index
    try:
        data = request.get_json()
        target_id = int(data.get('id'))
        target_status = data.get('status')
        
        for order in orders_db:
            if order['id'] == target_id:
                order['status'] = target_status
                if target_status == "Served":
                    for item in order['items']:
                        item['pending_qty'] = 0
                        
                    if not order['served_at_timestamp']:
                        now_ms = int(datetime.now().timestamp() * 1000)
                        order['served_at_timestamp'] = now_ms
                        diff_seconds = int((now_ms - order['placed_at_timestamp']) / 1000)
                        if diff_seconds < 60:
                            order['duration_string'] = f"{diff_seconds} sec"
                        else:
                            order['duration_string'] = f"{diff_seconds // 60} min {diff_seconds % 60} sec"
                        
                save_persisted_db(orders_db, order_id_counter, order_routing_index)
                return jsonify({"success": True}), 200
        return jsonify({"success": False}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

# RESTORED: Compiles invoice data for a table AND safely deletes only those table entries on execution
@app.route('/download_invoice/<int:table_id>', methods=['POST'])
def download_invoice(table_id):
    global orders_db, order_id_counter, order_routing_index
    try:
        # 1. Isolate the orders belonging to this table
        invoice_orders = [o for o in orders_db if o['table_id'] == table_id]
        
        if not invoice_orders:
            return jsonify({"success": False, "error": "No orders found for this table layout."}), 404
            
        # 2. Clear out ONLY this specific table's orders from the active database array
        orders_db = [o for o in orders_db if o['table_id'] != table_id]
        
        # 3. Permanently write change updates back to orders_session.json
        save_persisted_db(orders_db, order_id_counter, order_routing_index)
        
        return jsonify({
            "success": True, 
            "invoice_data": invoice_orders
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route('/clear_day_logs', methods=['POST'])
def clear_day_logs():
    global orders_db, order_id_counter, order_routing_index
    payload_backup = list(orders_db)
    orders_db = []
    order_id_counter = 1
    order_routing_index = 0
    save_persisted_db(orders_db, order_id_counter, order_routing_index)
    return jsonify({"success": True, "archive": payload_backup})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)