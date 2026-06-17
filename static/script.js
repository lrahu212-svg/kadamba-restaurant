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

    fetch('/history')
    .then(r => r.json())
    .then(data => {
        if (!data || data.length === 0) {
            box.innerHTML = '<p class="empty-state">No active orders placed.</p>';
            return;
        }

        // Retrieve any previously billed/cleared order IDs from LocalStorage
        let existingCleared = JSON.parse(localStorage.getItem('clearedOrders') || '[]');

        // Filter out orders that belong to this customer but have already been billed
        let activeOrders = data.filter(o => 
            parseInt(o.table_id) === parseInt(TABLE_ID) &&
            o.customer_name.toLowerCase() === customerName.toLowerCase() &&
            o.customer_phone === customerPhone &&
            !existingCleared.includes(o.id)
        );
        
        currentActiveOrders = activeOrders; 
        
        // This naturally clears the section visually without destroying the DOM tab!
        if (activeOrders.length === 0) {
            box.innerHTML = '<p class="empty-state">No active orders found. Ready for new orders.</p>';
            return;
        }

        box.innerHTML = "";
        let allOrdersServed = true; 

        activeOrders.forEach(o => {
            let summary = o.items.map(i => `${i.name} (${i.qty})`).join(", ");
            let statusClass = o.status.toLowerCase(); 
            let durationLabel = o.status === "Served" ? `<span style="color:#2ecc71; font-weight:bold; display:block; margin-top:4px;">⏱️ Served in ${o.duration_string || 'N/A'}</span>` : '';

            if (o.status !== "Served") {
                allOrdersServed = false;
            }

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

        if (activeOrders.length > 0) {
            let combinedBtnDiv = document.createElement("div");
            combinedBtnDiv.style.cssText = "margin-top: 20px; padding-top: 15px; border-top: 2px dashed #C5A059;";
            
            if (allOrdersServed) {
                combinedBtnDiv.innerHTML = `
                    <button onclick="generateCombinedCustomerInvoicePDF()" style="width:100%; background:#C5A059; color:#231F20; border:2px solid #231F20; padding:12px; font-weight:bold; font-size:14px; border-radius:6px; cursor:pointer; box-shadow: 0px 4px 6px rgba(0,0,0,0.1);">
                        🖨️ PRINT ALL ORDERS COMBINED BILL
                    </button>
                `;
            } else {
                combinedBtnDiv.innerHTML = `
                    <div style="background:#f1f2f6; border:1px solid #ced6e0; padding:10px; border-radius:6px; text-align:center; font-size:12px; color:#57606f; font-weight:600;">
                        🔒 Bill compilation locked. Available after all food items are served.
                    </div>
                `;
            }
            box.appendChild(combinedBtnDiv);
        }
    });
}

// ========================================================
// COMBINED ALL-ORDERS COMPLETE SESSION THERMAL BILL
// ========================================================
function generateCombinedCustomerInvoicePDF() {
    if (currentActiveOrders.length === 0) { alert("No order items available to compute."); return; }

    // --- EDITED PART: Store these order IDs in local storage to clear them from view ---
    let existingCleared = JSON.parse(localStorage.getItem('clearedOrders') || '[]');
    currentActiveOrders.forEach(o => {
        if (!existingCleared.includes(o.id)) existingCleared.push(o.id);
    });
    // Keep local storage from getting infinitely large
    if (existingCleared.length > 500) existingCleared = existingCleared.slice(-500); 
    localStorage.setItem('clearedOrders', JSON.stringify(existingCleared));
    // ----------------------------------------------------------------------------------

    let invoiceWindow = window.open('', '_blank');
    let combinedItemsMap = {};
    let grandRunningSum = 0;

    currentActiveOrders.forEach(order => {
        order.items.forEach(item => {
            if (combinedItemsMap[item.name]) {
                combinedItemsMap[item.name].qty += parseInt(item.qty);
            } else {
                combinedItemsMap[item.name] = {
                    price: parseFloat(item.price),
                    qty: parseInt(item.qty)
                };
            }
        });
    });

    let linesHTML = Object.keys(combinedItemsMap).map(itemName => {
        let details = combinedItemsMap[itemName];
        let sub = details.price * details.qty;
        grandRunningSum += sub;
        return `
            <tr>
                <td style="padding: 5px 0;">${itemName}<br><small>${details.qty} x Rs. ${details.price}</small></td>
                <td style="text-align: right; vertical-align: bottom; padding: 5px 0;">Rs. ${sub.toFixed(2)}</td>
            </tr>`;
    }).join("");

    let currentSystemTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    buildThermalHTMLTemplate(invoiceWindow, `Combined_Final_Bill`, `FINAL COMBINED RECEIPT`, currentSystemTime, linesHTML, grandRunningSum);

    // Refresh history box immediately to cleanly empty the UI without destroying it
    setTimeout(loadHistory, 300);
}

// Helper template structure to write printable thermal layouts
function buildThermalHTMLTemplate(winObj, docTitle, invoiceScopeLabel, timestampStr, itemsLinesHTML, netAmountValue) {
    let thermalHTML = `
    <html>
    <head>
        <title>Receipt_${docTitle}</title>
        <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
                font-family: 'Courier New', Courier, monospace; 
                width: 72mm; 
                margin: 0 auto; 
                padding: 10px 0; 
                color: #000; 
                background: #fff; 
                font-size: 13px; 
                line-height: 1.3;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
            @media print { .no-print { display: none; } }
        </style>
    </head>
    <body>
        <div class="no-print" style="background:#231F20; color:#C5A059; padding:8px; font-family:sans-serif; text-align:center; font-size:11px; font-weight:bold; margin-bottom:10px;">
            🖨️ Thermal Layout: Click print or save as PDF
        </div>
        <div class="center">
            <h2 style="margin: 0 0 5px 0; font-size: 18px; text-transform: uppercase;">WELCOME RESTAURANT</h2>
            <p style="margin: 2px 0;">Digital Table Ordering Terminal</p>
            <p style="margin: 2px 0; font-size: 11px;">Track Loop System Ledger Counter</p>
        </div>
        
        <div class="divider"></div>
        
        <div>
            <strong>SCOPE ID:</strong> ${invoiceScopeLabel}<br>
            <strong>TABLE NUM:</strong> TABLE ${TABLE_ID}<br>
            <strong>CUSTOMER:</strong> ${customerName.toUpperCase()}<br>
            <strong>PHONE REF:</strong> ${customerPhone}<br>
            <strong>DATE BLOCK:</strong> ${new Date().toLocaleDateString()}<br>
            <strong>TIME REF:</strong> ${timestampStr}
        </div>
        
        <div class="divider"></div>
        
        <table style="font-size: 12px;">
            <thead>
                <th style="text-align: left; border-bottom: 1px solid #000; padding-bottom: 4px;">ITEM SUMMARY</th>
                <th style="text-align: right; border-bottom: 1px solid #000; padding-bottom: 4px;">PRICE</th>
            </thead>
            <tbody>
                ${itemsLinesHTML}
            </tbody>
        </table>
        
        <div class="divider"></div>
        
        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; padding: 4px 0;">
            <span>NET GRAND TOTAL:</span>
            <span>Rs. ${netAmountValue.toFixed(2)}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="center" style="margin-top: 15px; font-size: 11px;">
            <p style="margin: 2px 0; font-weight: bold;">THANK YOU FOR YOUR VISIT! 🙏</p>
            <p style="margin: 5px 0 0 0; font-size: 9px; color: #555;">Processed via All-In-One Node Architecture</p>
        </div>

        <script>
            window.onload = function() {
                setTimeout(function() { window.print(); }, 300);
            }
        <\/script>
    </body>
    </html>`;

    winObj.document.write(thermalHTML);
    winObj.document.close();
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

function generateArchivePDFAndClearData() {
    const doubleCheck = confirm("⚠️ WARNING!\nYou are about to wipe out all active entries on the feed.\n\nClick OK to fetch data records, save your PDF invoice report, and clear the database.");
    if (!doubleCheck) return;

    fetch('/clear_day_logs', { method: 'POST' })
    .then(r => r.json())
    .then(response => {
        if (!response.success) { alert("Server reject cleanup hook operation."); return; }
        
        let targetLogArray = response.archive || [];
        if (targetLogArray.length === 0) {
            alert("Database was completely clean. No offline logging document generated.");
            window.location.reload();
            return;
        }

        let printWindow = window.open('', '_blank');
        
        let reportHTML = `
        <html>
        <head>
            <title>Master Food Service Report Summary</title>
            <style>
                body { font-family: Courier, monospace; padding: 30px; color: #000; background: #fff; }
                .heading { text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 25px; }
                .report-meta { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 30px; background: #f5f5f5; padding: 10px; border: 1px solid #000; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #000; padding: 10px; text-align: left; font-size: 13px; }
                th { background: #e0e0e0; text-transform: uppercase; }
                .total-row { font-weight: bold; font-size: 16px; background: #f9f9f9; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="no-print" style="background:#e74c3c; color:white; padding:12px; font-weight:bold; text-align:center; margin-bottom:20px; border-radius:5px; font-family:sans-serif;">
                🖨️ Action Required: Save as PDF inside the print window or print hardcopy to save these cleared daily records.
            </div>
            <div class="heading">
                <h1 style="margin:0; font-size:26px;">MASTER SALES & DISPATCH ARCHIVE REPORT</h1>
                <p style="margin:5px 0 0 0; font-size:14px;">All-In-One Restaurant System Engine Logs</p>
            </div>
            <div class="report-meta">
                <span><strong>Report Generation Date:</strong> ${new Date().toLocaleDateString()}</span>
                <span><strong>Records count processed:</strong> ${targetLogArray.length} Orders</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Token</th>
                        <th>Table</th>
                        <th>Customer Details</th>
                        <th>Date & Time Block</th>
                        <th>Kitchen ID</th>
                        <th>Items Break-down Summary</th>
                        <th>Total Val</th>
                    </tr>
                </thead>
                <tbody>;`

        let netGrandTotalRevenue = 0;

        targetLogArray.forEach(o => {
            let innerTotal = 0;
            let itemLines = o.items.map(i => {
                let s = i.price * i.qty;
                innerTotal += s;
                return `${i.name} x${i.qty} (@ Rs.${i.price})`;
            }).join("<br>");

            netGrandTotalRevenue += innerTotal;

            reportHTML += `
                <tr>
                    <td>#0${o.id}</td>
                    <td><strong>Table ${o.table_id}</strong></td>
                    <td>${o.customer_name.toUpperCase()}<br><span style="font-size:11px; color:#555;">Ph: ${o.customer_phone}</span></td>
                    <td>📅 ${o.date || 'N/A'}<br>🕒 ${o.timestamp}</td>
                    <td>Station ${o.kitchen_id}</td>
                    <td>${itemLines}</td>
                    <td><strong>Rs. ${innerTotal}</strong></td>
                </tr>`;
        });

        reportHTML += `
                <tr class="total-row">
                    <td colspan="6" style="text-align:right; padding-right:15px;">NET GRAND REVENUE RECOVERED VALUE:</td>
                    <td>Rs. ${netGrandTotalRevenue}</td>
                </tr>
            </tbody>
            </table>
            <div style="margin-top:40px; text-align:center; font-size:12px; border-top:1px dashed #000; padding-top:10px;">
                --- End of Saved Archive Log Ledger ---
            </div>
            <script>
                window.onload = function() { 
                    setTimeout(function() { window.print(); }, 500); 
                }
            <\/script>
        </body>
        </html>`;

        printWindow.document.write(reportHTML);
        printWindow.document.close();
        
        showToast("Database safely wiped. Archive PDF dispatched!");
        setTimeout(() => { window.location.reload(); }, 1500);
    });
}

function loadOrders() {
    let kitchenGrid = document.getElementById("kitchenGrid");
    let waiterBox = document.getElementById("waiterActiveQueue");
    let waiterHistoryBox = document.getElementById("waiterMasterHistoryLog");
    let headingTextNode = document.getElementById("stationHeadingText");
    let ordersPendingBadge = document.getElementById("ordersPendingCountText");

    fetch('/get_orders').then(r => r.json()).then(payload => {
        let allOrders = payload.orders || [];
        let isKitchen2Online = payload.kitchen2_active;

        if (IS_WAITER_PAGE) {
            let unserved = allOrders.filter(o => o.status !== "Served");
            if (waiterBox) {
                if (unserved.length === 0) {
                    waiterBox.innerHTML = '<p style="color:#888; padding:10px;">No incoming food requests require delivery right now.</p>';
                } else {
                    waiterBox.innerHTML = "";
                    unserved.forEach(o => {
                        let orderTotal = 0;
                        let itemsHtml = o.items.map(i => {
                            let itemPrice = parseFloat(i.price) || 0;
                            let itemQty = parseInt(i.qty) || 1;
                            let itemTotal = itemPrice * itemQty;
                            orderTotal += itemTotal;
                            
                            return `<div class="item-row" style="display:flex; justify-content:space-between; margin: 4px 0; font-size:14px;">
                                        <span>• <strong>${i.name}</strong> x ${itemQty}</span>
                                        <span style="color:#777;">(Rs. ${itemPrice} ea) = <strong>Rs. ${itemTotal}</strong></span>
                                    </div>`;
                        }).join("");

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
                                    <div style="text-align:right; font-size:18px; margin-bottom:12px; color:#2c3e50;">
                                        Total Amount: <strong style="font-size:22px; color:#27ae60;">Rs. ${orderTotal}</strong>
                                    </div>
                                    <button class="btn-serve-action" style="width:100%; cursor:pointer;" onclick="update(${o.id}, 'Served')">🍽️ MARK SERVED & STOP CLOCK</button>
                                </div>
                            </div>
                        `;
                        waiterBox.appendChild(div);
                    });
                }
            }

            if (waiterHistoryBox) {
                let served = allOrders.filter(o => o.status === "Served");
                if (served.length === 0) {
                    waiterHistoryBox.innerHTML = '<p style="color:#888; padding:10px;">No historical orders archived for this loop period.</p>';
                } else {
                    waiterHistoryBox.innerHTML = "";
                    served.slice().reverse().forEach(o => {
                        let orderTotal = 0;
                        let itemsHtml = o.items.map(i => {
                            let itemPrice = parseFloat(i.price) || 0;
                            let itemQty = parseInt(i.qty) || 1;
                            let itemTotal = itemPrice * itemQty;
                            orderTotal += itemTotal;
                            
                            return `<div class="item-row" style="display:flex; justify-content:space-between; font-size:13px; color:#555;">
                                        <span>• ${i.name} x ${itemQty}</span>
                                        <span>Rs. ${itemTotal}</span>
                                    </div>`;
                        }).join("");

                        let div = document.createElement("div");
                        div.className = "waiter-card served-card";
                        div.innerHTML = `
                            <div>
                                <span class="badge-station" style="background:#27ae60;">SERVED</span>
                                <h3 style="margin:0; color:#27ae60;">TABLE ${o.table_id}</h3>
                                <div class="meta-line">👤 ${o.customer_name.toUpperCase()} | Token #0${o.id}<br>🕒 Placed: ${o.date || ''} @ ${o.timestamp}</div>
                                <div style="margin:10px 0; border-top:1px solid #f5f5f5; border-bottom:1px solid #f5f5f5; padding:4px 0;">${itemsHtml}</div>
                                <div style="text-align:right; font-weight:bold; margin: 4px 0; font-size:15px; color:#27ae60;">Paid Total: Rs. ${orderTotal}</div>
                            </div>
                            <div style="font-weight:bold; color:#27ae60; font-size:13px; border-top:1px dashed #ccc; padding-top:8px; margin-top:5px;">
                                ⏱️ Performance Speed: ${o.duration_string || 'N/A'}
                            </div>
                        `;
                        waiterHistoryBox.appendChild(div);
                    });
                }
            }
            return;
        }

        if (kitchenGrid) {
            let targetQueue = [];
            
            if (KITCHEN_ID_TARGET === 1) {
                if (!isKitchen2Online) {
                    targetQueue = allOrders.filter(o => o.status !== "Served");
                    if (headingTextNode) headingTextNode.innerText = "KITCHEN 1 (ALL-IN-ONE)";
                } else {
                    targetQueue = allOrders.filter(o => o.status !== "Served" && o.kitchen_id === 1);
                    if (headingTextNode) headingTextNode.innerText = "KITCHEN 1";
                }
            } else if (KITCHEN_ID_TARGET === 2) {
                targetQueue = allOrders.filter(o => o.status !== "Served" && o.kitchen_id === 2);
                if (headingTextNode) headingTextNode.innerText = "KITCHEN 2";
            }

            if (ordersPendingBadge) {
                ordersPendingBadge.innerText = `Pending Orders: ${targetQueue.length}`;
            }

            let displayQueue = targetQueue.slice(0, 4);

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

                let itemsSummary = o.items.map(item => 
                    `<div class="item-line" style="font-size: ${fontSize}; padding: ${paddingSize} 0;">• <strong>${item.name}</strong> x ${item.qty}</div>`
                ).join("");

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
            slot.className = "order-block";
            slot.style.background = "#141414";
            slot.style.borderColor = "#222";
            slot.innerHTML = '<div style="color:#333; font-size:20px; text-align:center; padding-top:45px; font-weight:bold; text-transform:uppercase;">[ Empty Slot ]</div>';
            kitchenGrid.appendChild(slot);
        }
    }

    verifyUserSession(); 
    renderCart();
    loadOrders();
    
    if (KITCHEN_ID_TARGET > 0) {
        transmitKitchenHeartbeat();
        setInterval(transmitKitchenHeartbeat, 3000);
    }
    if (TABLE_ID > 0) { 
        loadHistory(); 
        setInterval(loadHistory, 4000); 
    }
    
    setInterval(loadOrders, 2000);
    setInterval(() => {
        document.querySelectorAll(".timer-large").forEach(badge => {
            let start = parseInt(badge.getAttribute("data-start"));
            if (start && !isNaN(start)) badge.innerText = calculateDurationText(start);
        });
    }, 1000);
};

function completeInvoiceDownload() {
    // Left intact for external calling, but the destruct function is removed.
 
    loadHistory(); 
}