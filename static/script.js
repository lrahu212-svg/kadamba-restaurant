let cart = [];
let total = 0;

// VOLATILE MEMORY STORAGE: Automatically drops all data instantly on any page refresh
let customerName = "";
let customerPhone = "";
let currentActiveOrders = []; 
let currentKitchenTab = "active"; 

const TABLE_ID = parseInt(document.body.getAttribute("data-table")) || 0;

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

// Kitchen Tab Interface Logic Toggler
function switchKitchenView(targetTab) {
    currentKitchenTab = targetTab;
    let activeBox = document.getElementById("activeQueueContainer");
    let historyBox = document.getElementById("historyQueueContainer");
    let activeBtn = document.getElementById("tabActiveBtn");
    let historyBtn = document.getElementById("tabHistoryBtn");

    if (!activeBox || !historyBox) return;

    if (targetTab === "active") {
        activeBox.style.display = "block";
        historyBox.style.display = "none";
        activeBtn.classList.add("active");
        historyBtn.classList.remove("active");
    } else {
        activeBox.style.display = "none";
        historyBox.style.display = "block";
        activeBtn.classList.remove("active");
        historyBtn.classList.add("active");
    }
    loadOrders();
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
    if (item) { item.qty++; } else { cart.push({ name: name, price: price, qty: 1 }); }
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
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.padding = "8px 0";
        li.style.borderBottom = "1px solid #e8e2d5";
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

    let name = customerName || "Guest";
    let phone = customerPhone || "N/A";

    fetch('/place_order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            items: cart, 
            table_id: TABLE_ID,
            customer_name: name,
            customer_phone: phone
        })
    })
    .then(r => r.json())
    .then(() => {
        showToast("Order sent to kitchen! 👍");
        cart = [];
        renderCart();
        loadHistory();
    });
}

// BILL LOGOUT TRIGGER: Opens bill path inside a separate tab & executes immediate memory wipe via parent frame refresh
function downloadBillAndClear() {
    if (currentActiveOrders.length === 0) {
        showToast("❌ No active orders to bill yet.");
        return;
    }
    
    let allServed = currentActiveOrders.every(o => o.status === "Served");
    if (!allServed) {
        showToast("⚠️ Cannot print bill! Some orders are still being prepared in the kitchen.");
        return;
    }

    let orderIds = currentActiveOrders.map(o => o.id).join(",");
    let customerNameEncoded = encodeURIComponent(customerName || "Guest");
    let customerPhoneEncoded = encodeURIComponent(customerPhone || "N/A");

    window.open(`/invoice/${TABLE_ID}?ids=${orderIds}&name=${customerNameEncoded}&phone=${customerPhoneEncoded}`, '_blank');
    
    customerName = "";
    customerPhone = "";
    window.location.reload();
}

function loadHistory() {
    let box = document.getElementById("history");
    if (!box || TABLE_ID === 0) return;

    if (!customerName || !customerPhone) {
        box.innerHTML = '<p class="empty-state">Please enter your details to track orders.</p>';
        currentActiveOrders = [];
        return;
    }

    fetch('/history')
    .then(r => r.json())
    .then(data => {
        if (!data || data.length === 0) {
            box.innerHTML = '<p class="empty-state">No active orders placed.</p>';
            currentActiveOrders = [];
            return;
        }

        let activeOrders = data.filter(o => 
            parseInt(o.table_id) === parseInt(TABLE_ID) &&
            o.customer_name.toLowerCase() === customerName.toLowerCase() &&
            o.customer_phone === customerPhone
        );
        
        currentActiveOrders = activeOrders; 

        if (activeOrders.length === 0) {
            box.innerHTML = '<p class="empty-state">No active orders found for this session.</p>';
            return;
        }

        box.innerHTML = "";
        activeOrders.forEach(o => {
            let summary = o.items.map(i => `${i.name} (${i.qty})`).join(", ");
            let statusClass = o.status.toLowerCase(); 
            
            let div = document.createElement("div");
            div.className = "order-card";
            div.style.marginBottom = "10px";
            div.innerHTML = `
                <h4>
                    <span>Order #0${o.id}</span> 
                    <span class="status-badge ${statusClass}">${o.status}</span>
                </h4>
                <div style="font-size:13px; color:#747d8c; margin:4px 0;">${summary}</div>
                <div class="timestamp-badge">🕒 ${o.timestamp || 'Just Now'}</div>
            `;
            box.appendChild(div);
        });
    });
}

// SEGREGATION ENGINE: Dispatches raw array slices dynamically based on 'Served' status fields
function loadOrders() {
    let activeBox = document.getElementById("orders");
    let historyBox = document.getElementById("kitchenHistoryGrid");
    if (!activeBox && !historyBox) return; 

    fetch('/get_orders')
    .then(r => r.json())
    .then(data => {
        // Mode A: Active Production View Port
        if (activeBox) {
            let activeQueue = data.filter(o => o.status !== "Served");
            if (activeQueue.length === 0) {
                activeBox.innerHTML = '<p class="empty-state">Waiting for orders...</p>';
            } else {
                activeBox.innerHTML = "";
                activeQueue.forEach(o => {
                    let items = o.items.map(i => `<strong>${i.name}</strong> x ${i.qty}`).join("<br>");
                    let div = document.createElement("div");
                    div.className = "order-card";
                    div.innerHTML = `
                        <h4 style="border-bottom:2px dashed #e8e2d5; padding-bottom:8px; margin-bottom:10px;">
                            <span style="color:#e74c3c; font-size:24px; font-weight:900;">TABLE ${o.table_id}</span>
                            <span class="status-badge pending">TKT #${o.id}</span>
                        </h4>
                        <div style="background:#fcfbfa; border:1px solid #e8e2d5; padding:8px 12px; border-radius:6px; margin-bottom:12px; font-size:14px; color:#231F20;">
                            👤 <strong>${o.customer_name.toUpperCase()}</strong><br>
                            📞 <span style="font-family:monospace; color:#747d8c;">${o.customer_phone}</span><br>
                            <div class="timestamp-badge">📅 ${o.timestamp}</div>
                        </div>
                        <div style="margin:10px 0; line-height:1.6; font-size:15px; color:#231F20;">${items}</div>
                        <div style="margin-top:15px;">
                            ${o.status === "Pending" ? `<button class="btn-accept" onclick="update(${o.id},'Accepted')">Accept Order</button>` : ''}
                            ${o.status === "Accepted" ? `<button class="btn-serve" onclick="update(${o.id},'Served')">Mark Served</button>` : ''}
                        </div>
                    `;
                    activeBox.appendChild(div);
                });
            }
        }

        // Mode B: Long Term History Ledger View Port
        if (historyBox) {
            let servedHistory = data.filter(o => o.status === "Served");
            if (servedHistory.length === 0) {
                historyBox.innerHTML = '<p class="empty-state">No past orders documented yet.</p>';
            } else {
                historyBox.innerHTML = "";
                // Reverses timeline arrays to position latest metrics at the uppermost view
                servedHistory.reverse().forEach(o => { 
                    let items = o.items.map(i => `• ${i.name} x ${i.qty}`).join("<br>");
                    let div = document.createElement("div");
                    div.className = "order-card";
                    div.style.opacity = "0.85";
                    div.innerHTML = `
                        <h4 style="border-bottom:1px solid #e8e2d5; padding-bottom:6px; margin-bottom:8px;">
                            <span style="color:#2ecc71; font-weight:800;">TABLE ${o.table_id}</span>
                            <span class="status-badge served" style="float:right;">SERVED</span>
                        </h4>
                        <div style="font-size:13px; color:var(--text-dark); margin-bottom:6px;">
                            👤 <strong>${o.customer_name.toUpperCase()}</strong> (#${o.id})<br>
                            <span class="timestamp-badge">✓ ${o.timestamp}</span>
                        </div>
                        <div style="font-size:14px; color:#555; line-height:1.4;">${items}</div>
                    `;
                    historyBox.appendChild(div);
                });
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
    verifyUserSession(); 
    renderCart();
    loadOrders();
    if (TABLE_ID > 0) { 
        loadHistory(); 
        setInterval(loadHistory, 3000); 
    }
    setInterval(loadOrders, 3000);
};