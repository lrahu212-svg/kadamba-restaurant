let cart = [];
let total = 0;
let customerName = "";
let customerPhone = "";
let currentActiveOrders = []; 

const TABLE_ID = parseInt(document.body.getAttribute("data-table")) || 0;
const IS_WAITER_PAGE = document.body.getAttribute("data-page") === "waiter";
const KITCHEN_ID_TARGET = parseInt(document.body.getAttribute("data-kitchen")) || 0;

function verifyUserSession() {
    if (TABLE_ID === 0) return; 
    let welcomeBox = document.getElementById("welcomeModal");
    if (customerName && customerPhone) {
        if (welcomeBox) {
            welcomeBox.style.display = "none";
            document.body.style.overflow = "auto"; 
        }
    } else {
        if (welcomeBox) {
            welcomeBox.style.display = "flex";
            document.body.style.overflow = "hidden"; 
        }
    }
}

function saveCustomerDetails() {
    let nameInput = document.getElementById("custNameInput").value.trim();
    let phoneInput = document.getElementById("custPhoneInput").value.trim();
    
    if (!nameInput) { alert("Please enter your name to proceed."); return; }
    if (!phoneInput || phoneInput.length !== 10 || isNaN(phoneInput)) {
        alert("Please enter a valid 10-digit mobile number."); return;
    }
    
    customerName = nameInput;
    customerPhone = phoneInput;
    
    let welcomeBox = document.getElementById("welcomeModal");
    if (welcomeBox) {
        welcomeBox.style.display = "none";
        document.body.style.overflow = "auto"; 
    }
    showToast(`Logged in as ${customerName}! 🙏`);
    loadHistory(); 
}

function openCartOverlay() {
    let overlay = document.getElementById("appModalOverlay");
    if (overlay) {
        overlay.style.display = "flex";
        document.body.style.overflow = "hidden"; 
        loadHistory(); 
    }
}

function closeCartOverlay() {
    let overlay = document.getElementById("appModalOverlay");
    if (overlay) {
        overlay.style.display = "none";
        document.body.style.overflow = "auto"; 
    }
}

function showToast(message) {
    let toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "90px"; 
    toast.style.right = "25px";
    toast.style.background = "#231F20";
    toast.style.color = "#C5A059";
    toast.style.border = "1px solid #C5A059";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = "2000";
    toast.style.fontWeight = "600";
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

function addItem(name, price) {
    let item = cart.find(i => i.name === name);
    if (!item) {
        if (cart.length >= 20) { alert("Cart Limit Reached!"); return; }
        cart.push({ name: name, price: price, qty: 1 });
    } else {
        item.qty++;
    }
    renderCart();
    showToast(`${name} added!`);
}

function increase(name) {
    let item = cart.find(i => i.name === name);
    if (item) item.qty++;
    renderCart();
}

function decrease(name) {
    let item = cart.find(i => i.name === name);
    if (item) {
        if (item.qty > 1) { item.qty--; } else { cart = cart.filter(i => i.name !== name); }
    }
    renderCart();
}

function renderCart() {
    let cartBox = document.getElementById("cart");
    let trayBadge = document.getElementById("trayCount");
    if (!cartBox) return;
    
    cartBox.innerHTML = "";
    total = 0;

    let totalItemsCount = cart.reduce((acc, item) => acc + item.qty, 0);
    if (trayBadge) {
        trayBadge.innerText = totalItemsCount === 1 ? "1 Item" : `${totalItemsCount} Items`;
    }

    if (cart.length === 0) {
        cartBox.innerHTML = '<p class="empty-state">Your cart is empty</p>';
        let totalElement = document.getElementById("total");
        if (totalElement) totalElement.innerText = "0";
        return;
    }

    cart.forEach(item => {
        total += item.price * item.qty;
        let li = document.createElement("li");
        li.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #e8e2d5;";
        li.innerHTML = `
            <div><strong>${item.name}</strong><br><span style="color:#C5A059; font-size:13px;">Rs. ${item.price}</span></div>
            <div>
                <button onclick="decrease('${item.name}')" style="padding:4px 10px; background:#231F20; color:#C5A059; border:none; font-weight:bold; border-radius:4px; cursor:pointer;">-</button>
                <span style="margin:0 8px; font-weight:bold; font-size:15px;">${item.qty}</span>
                <button onclick="increase('${item.name}')" style="padding:4px 10px; background:#231F20; color:#C5A059; border:none; font-weight:bold; border-radius:4px; cursor:pointer;">+</button>
            </div>
        `;
        cartBox.appendChild(li);
    });
    
    let totalElement = document.getElementById("total");
    if (totalElement) totalElement.innerText = total;
}

function placeOrder() {
    if (cart.length === 0) return;
    fetch('/place_order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            items: cart, 
            table_id: TABLE_ID,
            customer_name: customerName || "Guest",
            customer_phone: customerPhone || "N/A"
        })
    })
    .then(r => r.json())
    .then(() => {
        showToast(`Order dispatched! 👍`);
        cart = [];
        renderCart();
        loadHistory();
    });
}

function loadHistory() {
    let box = document.getElementById("history"); if (!box || TABLE_ID === 0) return;
    if (!customerName || !customerPhone) {
        box.innerHTML = '<p class="empty-state">Please enter details to track orders.</p>';
        return;
    }

    fetch(`/get_orders`) 
    .then(r => r.json())
    .then(res => {
        let allOrders = res.orders || [];
        
        // Safety Clean: If owner wiped database logs, reset local view storage lists
        let maxBackendID = allOrders.length > 0 ? Math.max(...allOrders.map(o => o.id)) : 0;
        let invoicedIDs = JSON.parse(localStorage.getItem('invoiced_order_ids')) || [];
        if (invoicedIDs.length > 0 && maxBackendID < Math.max(...invoicedIDs)) {
            invoicedIDs = [];
            localStorage.setItem('invoiced_order_ids', JSON.stringify([]));
        }

        // Exclude orders flagged locally as invoiced on this client browser
        let activeOrders = allOrders.filter(o => 
            o.table_id === TABLE_ID && 
            o.customer_phone === customerPhone && 
            o.status !== "Paid" &&
            !invoicedIDs.includes(o.id)
        );
        currentActiveOrders = activeOrders; 
        
        if (activeOrders.length === 0) {
            box.innerHTML = '<p class="empty-state">No active orders found. Ready for new orders.</p>';
            return;
        }

        box.innerHTML = "";
        let allOrdersServed = true;

        activeOrders.forEach(o => {
            if (o.status !== "Served") {
                allOrdersServed = false;
            }
            
            let summary = o.items.map(i => `${i.name} (${i.qty})`).join(", ");
            let statusClass = o.status.toLowerCase(); 
            let durationLabel = o.status === "Served" ? `<span style="color:#2ecc71; font-weight:bold; display:block; margin-top:4px;">⏱️ Served in ${o.duration_string || 'N/A'}</span>` : '';
            
            let div = document.createElement("div");
            div.className = "order-card";
            div.style.marginBottom = "10px";
            div.innerHTML = `
                <h4><span>TOKEN #0${o.id}</span> <span class="status-badge ${statusClass}">${o.status}</span></h4>
                <div style="font-size:13px; color:#747d8c; margin:4px 0;">${summary}</div>
                <div class="timestamp-badge">🕒 Placed: ${o.date || ''} @ ${o.timestamp}</div>
                ${durationLabel}
            `; 
            box.appendChild(div);
        });

        let masterBtnDiv = document.createElement("div");
        masterBtnDiv.style.marginTop = "20px";
        masterBtnDiv.style.paddingTop = "15px";
        masterBtnDiv.style.borderTop = "2px dashed #C5A059";
        
        if (allOrdersServed) {
            masterBtnDiv.innerHTML = `
                <button onclick="printTableInvoiceAndClear()" style="width: 100%; padding: 15px; background: #C5A059; color: #111; border: none; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 14px; box-shadow: 0 4px 10px rgba(197, 160, 89, 0.3);">
                    🧾 DOWNLOAD MASTER INVOICE & CLEAR TABLE
                </button>
            `;
        } else {
            masterBtnDiv.innerHTML = `
                <div style="background:#f1f2f6; border:1px solid #ced6e0; padding:12px; border-radius:6px; text-align:center; font-size:12px; color:#57606f; font-weight:600;">
                    🔒 Bill downloading is locked. Available once all items are served.
                </div>
            `;
        }
        box.appendChild(masterBtnDiv);
    });
}

function printTableInvoiceAndClear() {
    if (currentActiveOrders.length === 0) return;

    let invoiceWindow = window.open('', '_blank');
    let grandTotal = 0;
    let allItems = [];

    currentActiveOrders.forEach(o => {
        o.items.forEach(i => {
            allItems.push(i);
            grandTotal += (parseFloat(i.price) * parseInt(i.qty));
        });
    });
    
    let html = `<html>
    <head>
        <title>Table ${TABLE_ID} Master Invoice</title>
        <style>
            body { font-family: monospace; padding: 20px; color: #000; background: #fff; max-width: 300px; margin: 0 auto; }
            .center { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 5px 0; text-align: left; font-size: 13px; }
            .text-right { text-align: right; }
            .line { border-top: 1px dashed #000; margin: 10px 0; }
        </style>
    </head>
    <body>
        <h3 class="center">RESTAURANT RECEIPT</h3>
        <p class="center">Table: ${TABLE_ID}</p>
        <p>Date: ${new Date().toLocaleDateString()}<br>Time: ${new Date().toLocaleTimeString()}</p>
        <p>Customer: ${customerName || 'Guest'}</p>
        <div class="line"></div>
        <table>
            <thead>
                <tr><th>Item</th><th>Qty</th><th class="text-right">Price</th></tr>
            </thead>
            <tbody>`;

    allItems.forEach(i => {
        html += `<tr><td>${i.name}</td><td>x${i.qty}</td><td class="text-right">Rs.${i.price * i.qty}</td></tr>`;
    });

    html += `</tbody></table>
        <div class="line"></div>
        <h4 class="text-right" style="margin: 5px 0;">GRAND TOTAL: Rs. ${grandTotal}</h4>
        <div class="line"></div>
        <p class="center" style="font-size: 11px;">Thank You! Visit Again 🙏</p>
        <script>
            window.onload = function() { 
                setTimeout(function() { 
                    window.print(); 
                    window.close(); 
                }, 300); 
            }
        <\/script>
    </body></html>`;

    invoiceWindow.document.write(html);
    invoiceWindow.document.close();

    // Store order IDs to hide them locally from this client's view
    let invoicedIDs = JSON.parse(localStorage.getItem('invoiced_order_ids')) || [];
    currentActiveOrders.forEach(o => {
        if (!invoicedIDs.includes(o.id)) invoicedIDs.push(o.id);
    });
    localStorage.setItem('invoiced_order_ids', JSON.stringify(invoicedIDs));

    // CHANGED: Empty the local active cart/orders but KEEP customerName and customerPhone intact
    cart = [];
    currentActiveOrders = [];
    renderCart();
    
    showToast("Invoice Generated & History Cleared! 🧾");
    loadHistory(); // Updates history view to "No active orders found" instead of forcing user re-registration
}

function calculateDurationText(startTimeMs) {
    if (!startTimeMs || isNaN(startTimeMs)) return "1s";
    let diffSecs = Math.floor((Date.now() - startTimeMs) / 1000);
    if (diffSecs <= 0) return "1s"; 
    if (diffSecs < 60) return `${diffSecs}s`;
    return `${Math.floor(diffSecs / 60)}m ${diffSecs % 60}s`;
}

function transmitKitchenHeartbeat() {
    if (KITCHEN_ID_TARGET === 0) return;
    fetch('/kitchen_ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchen_id: KITCHEN_ID_TARGET })
    }).catch(e => console.log("Ping error", e));
}

function serveSingleFoodItem(orderId, itemName) {
    fetch('/serve_item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, item_name: itemName })
    }).then(() => {
        loadOrders();
        if (TABLE_ID > 0) loadHistory();
    });
}

function loadOrders() {
    let kitchenGrid = document.getElementById("kitchenGrid");
    let waiterBox = document.getElementById("waiterActiveQueue");
    let headingTextNode = document.getElementById("stationHeadingText");
    let ordersPendingBadge = document.getElementById("ordersPendingCountText");

    fetch('/get_orders').then(r => r.json()).then(payload => {
        let allOrders = payload.orders || [];
        let isKitchen2Online = payload.kitchen2_active;

        if (IS_WAITER_PAGE) {
            let unserved = allOrders.filter(o => o.status !== "Served" && o.status !== "Paid");
            if (waiterBox) {
                if (unserved.length === 0) {
                    waiterBox.innerHTML = '<p style="color:#888; padding:10px;">No incoming food requests require delivery right now.</p>';
                } else {
                    waiterBox.innerHTML = "";
                    unserved.forEach(o => {
                        let orderTotal = 0;
                        let validActiveRowsCount = 0;

                        let itemsHtml = o.items.map(i => {
                            let itemPrice = parseFloat(i.price) || 0;
                            let itemQty = parseInt(i.qty) || 1;
                            let pendingQty = i.pending_qty !== undefined ? parseInt(i.pending_qty) : itemQty;
                            
                            let servedQty = itemQty - pendingQty;
                            orderTotal += itemPrice * itemQty;
                            
                            if (pendingQty <= 0) return ""; 
                            validActiveRowsCount++;

                            return `<div class="item-row" style="display:flex; justify-content:space-between; align-items:center; margin: 8px 0; font-size:14px; padding: 4px 0; border-bottom:1px solid #f9f9f9;">
                                        <span>
                                            • <strong>${i.name}</strong> 
                                            <span style="background:#27ae60; color:white; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px; margin-left:6px;">${servedQty} Served</span>
                                            <span style="background:#e67e22; color:white; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px; margin-left:4px;">${pendingQty} Left</span>
                                        </span>
                                        <button onclick="serveSingleFoodItem(${o.id}, '${i.name}')" style="padding:4px 10px; background:#27ae60; color:white; border:none; font-weight:bold; border-radius:4px; cursor:pointer; font-size:12px;">✔️ SERVE 1</button>
                                    </div>`;
                        }).join("");

                        if (validActiveRowsCount === 0) return;

                        let div = document.createElement("div");
                        div.className = "waiter-card active-card";
                        div.innerHTML = `
                            <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
                                <div>
                                    <span class="badge-station">KITCHEN ${o.kitchen_id}</span>
                                    <h3 style="margin:0; color:#e67e22; font-size:24px;">TABLE ${o.table_id}</h3>
                                    <div class="meta-line" style="margin-bottom:8px;">👤 ${o.customer_name.toUpperCase()} (#0${o.id})<br>🕒 Placed: ${o.date || ''} @ ${o.timestamp}</div>
                                    <div style="margin:10px 0; border-top:1px dashed #eee; border-bottom:1px dashed #eee; padding: 6px 0;">${itemsHtml}</div>
                                </div>
                                <div>
                                    <div style="text-align:right; font-size:16px; margin-bottom:8px; color:#2c3e50;">
                                        Total Order Amount: <strong style="font-size:18px; color:#27ae60;">Rs. ${orderTotal}</strong>
                                    </div>
                                    <button class="btn-serve-action" style="width:100%; cursor:pointer; background:#27ae60; color:white; border:none; padding:10px; font-weight:bold; border-radius:4px;" onclick="update(${o.id}, 'Served')">⏹️ ALL SERVED</button>
                                </div>
                            </div>
                        `;
                        waiterBox.appendChild(div);
                    });
                }
            }
            return;
        }

        if (kitchenGrid) {
            let targetQueue = [];
            
            if (KITCHEN_ID_TARGET === 1) {
                if (!isKitchen2Online) {
                    targetQueue = allOrders.filter(o => o.status !== "Served" && o.status !== "Paid");
                    if (headingTextNode) headingTextNode.innerText = "KITCHEN 1 (ALL-IN-ONE)";
                } else {
                    targetQueue = allOrders.filter(o => o.status !== "Served" && o.status !== "Paid" && o.kitchen_id === 1);
                    if (headingTextNode) headingTextNode.innerText = "KITCHEN 1";
                }
            } else if (KITCHEN_ID_TARGET === 2) {
                targetQueue = allOrders.filter(o => o.status !== "Served" && o.status !== "Paid" && o.kitchen_id === 2);
                if (headingTextNode) headingTextNode.innerText = "KITCHEN 2";
            }

            if (ordersPendingBadge) {
                ordersPendingBadge.innerText = `Pending Orders: ${targetQueue.length}`;
            }

            let displayQueue = targetQueue.filter(o => {
                return o.items.some(i => (i.pending_qty !== undefined ? i.pending_qty : i.qty) > 0);
            }).slice(0, 4);

            for (let i = 0; i < 4; i++) {
                let slotId = `kitchen-slot-${i}`;
                let existingSlot = document.getElementById(slotId);
                let o = displayQueue[i];

                if (!o) {
                    if (existingSlot) {
                        existingSlot.innerHTML = '<div style="color:#333; font-size:20px; text-align:center; padding-top:45px; font-weight:bold; text-transform:uppercase;">[ Empty Slot ]</div>';
                        existingSlot.removeAttribute('data-id');
                        existingSlot.style.borderColor = "#222";
                        existingSlot.style.background = "#141414";
                    }
                    continue;
                }

                let itemCount = o.items.length;
                let fontSize = "19px";
                let paddingSize = "4px";
                if (itemCount > 15) { fontSize = "13px"; paddingSize = "1px"; }
                else if (itemCount > 8) { fontSize = "15px"; paddingSize = "2px"; }

                let itemsSummary = o.items.map(item => {
                    let pendingQty = item.pending_qty !== undefined ? parseInt(item.pending_qty) : parseInt(item.qty);
                    if (pendingQty <= 0) return ""; 
                    return `<div class="item-line" style="font-size: ${fontSize}; padding: ${paddingSize} 0;">• <strong>${item.name}</strong> x ${pendingQty}</div>`;
                }).join("");

                let borderTheme = (KITCHEN_ID_TARGET === 1 && isKitchen2Online) ? "#e74c3c" : 
                                  (KITCHEN_ID_TARGET === 2) ? "#3498db" : "#f1c40f"; 

                if (existingSlot) {
                    let currentActiveId = existingSlot.getAttribute('data-id');
                    if (currentActiveId === o.id.toString()) {
                        let itemsListDiv = existingSlot.querySelector('.items-list');
                        if (itemsListDiv && itemsListDiv.innerHTML !== itemsSummary) {
                            itemsListDiv.innerHTML = itemsSummary;
                        }
                    } else {
                        existingSlot.setAttribute('data-id', o.id);
                        existingSlot.style.borderColor = borderTheme;
                        existingSlot.style.background = "#1e1e1e";
                        existingSlot.innerHTML = `
                            <div class="card-top">
                                <span class="table-title" style="color:${borderTheme};">TABLE ${o.table_id}</span>
                                <span class="timer-large" data-start="${o.placed_at_timestamp}">${calculateDurationText(o.placed_at_timestamp)}</span>
                            </div>
                            <div class="items-list">${itemsSummary}</div>
                            <div class="meta-text">👤 Client: ${o.customer_name.toUpperCase()} | Token: #0${o.id}</div>
                        `;
                    }
                }
            }
        }
    });
}

function update(id, status) {
    fetch('/update_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, status: status })
    }).then(() => {
        loadOrders();
        if (TABLE_ID > 0) loadHistory();
    });
}

function filterMenu() {
    let query = document.getElementById("menuSearch").value.toLowerCase().trim();
    document.querySelectorAll(".card").forEach(card => {
        let name = card.querySelector("h3").innerText.toLowerCase();
        card.style.display = name.includes(query) ? "flex" : "none";
    });
}

window.onload = function() {
    let kitchenGrid = document.getElementById("kitchenGrid");
    if (kitchenGrid) {
        kitchenGrid.innerHTML = "";
        for (let i = 0; i < 4; i++) {
            let slot = document.createElement("div");
            slot.id = `kitchen-slot-${i}`;
            slot.className = "kitchen-card-slot";
            kitchenGrid.appendChild(slot);
        }
    }
    verifyUserSession();
    loadOrders();
    
    if (TABLE_ID > 0) {
        loadHistory();
        setInterval(loadHistory, 3000); 
    }
    
    setInterval(loadOrders, 3000);
    setInterval(transmitKitchenHeartbeat, 2000);
};