// --- ESTADO Y DATOS LOCALES ---
let currentUser = 'Elvis (Administrador)';
let currentRole = 'admin';
let shiftClosedByStaff = false;
let activeSelectedClientId = null;
let selectedProdForCart = null;
let cart = [];
let lastProcessedInvoice = null;


let creditClients = JSON.parse(localStorage.getItem('ferre_credit_clients')) || [
    { 
        id: 1, 
        name: "Juan Pérez (Contratista)", 
        debt: 1200.00, 
        phone: "8888-1111", 
        history: [
            { date: "2026-06-01 10:30", items: [ { qty: 1, name: "Martillo Mango Fibra 16oz", price: 220.00 }, { qty: 2, name: "Manguera Riego", price: 490.00 } ], total: 1200.00, user: "Elvis (Admin)" }
        ] 
    },
    { 
        id: 2, 
        name: "Constructora Rivas", 
        debt: 3400.00, 
        phone: "8777-2222", 
        history: [
            { date: "2026-06-02 14:15", items: [ { qty: 10, name: "Disco de Corte 4.5'", price: 340.00 } ], total: 3400.00, user: "Cajero" }
        ] 
    }
];

let products = JSON.parse(localStorage.getItem('ferre_products')) || [
    { id: 1, code: "7501001", name: "Manguera de Riego 1/2' 15m", price: 350.00, stock: 12, minStock: 5, unit: "m" },
    { id: 2, code: "7501002", name: "Martillo Mango Fibra 16oz", price: 220.00, stock: 8, minStock: 5, unit: "Unid" },
    { id: 3, code: "7501003", name: "Niple Galvanizado 3/4'", price: 45.00, stock: 40, minStock: 10, unit: "Unid" },
    { id: 4, code: "7501004", name: "Disco de Corte 4.5'", price: 45.00, stock: 15, minStock: 8, unit: "Unid" },
    { id: 5, code: "7501005", name: "Clavos 2\"", price: 45.00, stock: 50, minStock: 10, unit: "Lb" }
];

let invoices = JSON.parse(localStorage.getItem('ferre_invoices')) || [];
let shiftSales = { cash: 0, credit: 0, abonos: 0, egress: 0, ingress: 0 };
let adminAlerts = JSON.parse(localStorage.getItem('ferre_admin_alerts')) || [];
let cashMovements = [];
let totalCashSalesToday = 0;
let totalAbonosToday = 0;

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    renderProducts();
    renderInventory();
    renderCreditClientsList();
    updateCartUI();
});

function setupEventListeners() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userSelect = document.getElementById('login-user').value;

            currentUser = userSelect;
            currentRole = userSelect.toLowerCase().includes('administrador') ? 'admin' : 'cajero';

            const nameBadge = document.getElementById('active-user-name');
            const roleBadge = document.getElementById('header-role-badge');
            const drawerRole = document.getElementById('drawer-user-role');

            if (nameBadge) nameBadge.textContent = currentUser;
            if (roleBadge) roleBadge.textContent = `Rol: ${currentRole === 'admin' ? 'Admin' : 'Empleado'}`;
            if (drawerRole) drawerRole.textContent = currentUser;

            const viewLogin = document.getElementById('view-login');
            if (viewLogin) viewLogin.classList.add('hidden');

            applyRolePermissions();
            renderProducts();
            updateCartUI();
        });
    }

    const toggleMenuBtn = document.getElementById('btn-toggle-menu');
    const closeDrawerBtn = document.getElementById('btn-close-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');

    if (toggleMenuBtn) toggleMenuBtn.addEventListener('click', toggleDrawer);
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', toggleDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', toggleDrawer);

    const navDashboard = document.getElementById('nav-dashboard');
    const navPos = document.getElementById('nav-pos');
    const navPayments = document.getElementById('nav-payments');
    const navInventory = document.getElementById('nav-inventory');
    const navInvoices = document.getElementById('nav-invoices');
    const navHardware = document.getElementById('nav-hardware-settings');

    if (navDashboard) navDashboard.addEventListener('click', () => switchView('dashboard', 'nav-dashboard', 'Dashboard General'));
    if (navPos) navPos.addEventListener('click', () => switchView('pos', 'nav-pos', 'Caja & Ventas'));
    if (navPayments) navPayments.addEventListener('click', () => {
        switchView('payments', 'nav-payments', 'Abonos & Cuentas Crédito');
        renderCreditClientsList();
    });
    if (navInventory) navInventory.addEventListener('click', () => {
        switchView('inventory', 'nav-inventory', 'Inventario & Stock');
        renderInventory();
    });
    if (navInvoices) navInvoices.addEventListener('click', () => {
        switchView('invoices', 'nav-invoices', 'Historial de Facturas');
        renderInvoices();
    });
    if (navHardware) navHardware.addEventListener('click', () => switchView('hardware-settings', 'nav-hardware-settings', 'Ajustes de Hardware'));

    const searchCreditClient = document.getElementById('search-credit-client');
    if (searchCreditClient) searchCreditClient.addEventListener('input', (e) => renderCreditClientsList(e.target.value));

    const addClientForm = document.getElementById('add-client-form');
    if (addClientForm) addClientForm.addEventListener('submit', handleAddNewClient);

    const detailAbonoForm = document.getElementById('detail-abono-form');
    if (detailAbonoForm) detailAbonoForm.addEventListener('submit', handleAbonoSubmit);

    const addProductForm = document.getElementById('add-product-form');
    if (addProductForm) addProductForm.addEventListener('submit', handleAddNewProduct);

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', handleLogoutAttempt);
    
    const searchInput = document.getElementById('search-product');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => renderProducts(e.target.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                const found = products.find(p => p.code === query || p.name.toLowerCase().includes(query.toLowerCase()));
                if (found) {
                    addToCart(found.id);
                    searchInput.value = '';
                    renderProducts();
                }
            }
        });
    }

    const btnClearCart = document.getElementById('btn-clear-cart');
    if (btnClearCart) btnClearCart.addEventListener('click', () => { cart = []; updateCartUI(); });

    const btnCashMove = document.getElementById('btn-trigger-cash-move');
    if (btnCashMove) btnCashMove.addEventListener('click', () => openModal('modal-cash-move'));

    const cashMoveForm = document.getElementById('cash-move-form');
    if (cashMoveForm) cashMoveForm.addEventListener('submit', handleCashMove);

    const btnCloseShift = document.getElementById('btn-trigger-close-shift');
    if (btnCloseShift) btnCloseShift.addEventListener('click', openCloseShiftModal);

    document.querySelectorAll('.bill-input').forEach(input => {
        input.addEventListener('input', calculateCountedCash);
    });
}

function toggleDrawer() {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.toggle('-translate-x-full');
    if (overlay) overlay.classList.toggle('hidden');
}

function switchView(viewName, activeNavId, title) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active', 'bg-slate-800', 'text-emerald-400'));
    const activeBtn = document.getElementById(activeNavId);
    if (activeBtn) activeBtn.classList.add('active', 'bg-slate-800', 'text-emerald-400');

    const headerTitle = document.getElementById('header-title');
    if (headerTitle) headerTitle.textContent = title;
    toggleDrawer();

    if (viewName === 'dashboard') updateDashboard();
    if (viewName === 'inventory') renderInventory();
}

function applyRolePermissions() {
    document.querySelectorAll('.nav-btn').forEach(el => {
        el.classList.remove('hidden');
    });

    const cashMoveBtn = document.getElementById('btn-trigger-cash-move');
    const closeShiftBtn = document.getElementById('btn-trigger-close-shift');
    if (cashMoveBtn) cashMoveBtn.classList.remove('hidden');
    if (closeShiftBtn) closeShiftBtn.classList.remove('hidden');

    if (currentRole === 'admin') {
        switchView('dashboard', 'nav-dashboard', 'Dashboard General');
        const logoutText = document.getElementById('logout-text');
        if (logoutText) logoutText.textContent = "Cerrar Sesión (Libre)";
    } else {
        const dashNav = document.getElementById('nav-dashboard');
        const hwNav = document.getElementById('nav-hardware-settings');
        if (dashNav) dashNav.classList.add('hidden');
        if (hwNav) hwNav.classList.add('hidden');

        switchView('pos', 'nav-pos', 'Caja & Ventas');
        const logoutText = document.getElementById('logout-text');
        if (logoutText) logoutText.textContent = "Cerrar Sesión";
    }

    renderActionButtons();
}

function renderActionButtons() {
    const container = document.getElementById('pos-action-buttons');
    if (!container) return;
    container.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
            <button onclick="initPaymentProcess('Pago Normal')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition">
                <i class="fa-solid fa-money-bill-wave mr-1"></i> Pago Normal
            </button>
            <button onclick="openCreditModal()" class="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl text-xs transition">
                <i class="fa-solid fa-user-clock mr-1"></i> Venta a Crédito
            </button>
        </div>
    `;
}

function renderProducts(filter = '') {
    const container = document.getElementById('products-list');
    if (!container) return;
    container.innerHTML = '';

    const query = filter.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(query) || (p.code && p.code.toLowerCase().includes(query)));

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No se encontraron productos</p>';
        return;
    }

    filtered.forEach(p => {
        let unitClean = p.unit || 'Unid';
        if (unitClean.includes('(')) unitClean = unitClean.split(' ')[0];

        const item = document.createElement('div');
        item.className = 'bg-slate-800/80 border border-slate-700/60 p-2.5 rounded-xl flex items-center justify-between';
        item.innerHTML = `
            <div>
                <p class="text-[10px] text-emerald-400 font-mono font-bold">Cód: ${p.code || 'S/C'}</p>
                <h4 class="text-xs font-bold text-white">${p.name}</h4>
                <p class="text-[11px] text-slate-300 font-semibold">C$ ${p.price.toFixed(2)} / ${unitClean} <span class="text-slate-400 font-normal">| Stock: ${p.stock}</span></p>
            </div>
            <button onclick="addToCart(${p.id})" ${p.stock <= 0 ? 'disabled' : ''} class="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
                + Agregar
            </button>
        `;
        container.appendChild(item);
    });
}

function addToCart(id) {
    const prod = products.find(p => p.id === id);
    if (!prod || prod.stock <= 0) return;

    selectedProdForCart = prod;

    let unitClean = prod.unit || 'Unid';
    if (unitClean.includes('(')) unitClean = unitClean.split(' ')[0];

    const modalTitle = document.getElementById('modal-qty-title');
    const modalUnit = document.getElementById('modal-qty-unit');
    const inputCustom = document.getElementById('input-qty-custom');

    if (modalTitle) modalTitle.textContent = prod.name;
    if (modalUnit) modalUnit.textContent = `Precio: C$ ${prod.price.toFixed(2)} por ${unitClean}`;
    if (inputCustom) inputCustom.value = 1;

    openModal('modal-select-qty');
}

function setQtyPreset(val) {
    const input = document.getElementById('input-qty-custom');
    if (input) input.value = val;
}

function confirmAddToCart() {
    if (!selectedProdForCart) return;

    const inputQty = parseFloat(document.getElementById('input-qty-custom').value);
    
    if (isNaN(inputQty) || inputQty <= 0) {
        alert("Por favor ingresa una cantidad válida mayor a 0.");
        return;
    }

    if (inputQty > selectedProdForCart.stock) {
        alert(`Stock insuficiente. Disponible en bodega: ${selectedProdForCart.stock} ${selectedProdForCart.unit || 'Unid'}`);
        return;
    }

    const existing = cart.find(item => item.id === selectedProdForCart.id);
    if (existing) {
        if ((existing.qty + inputQty) <= selectedProdForCart.stock) {
            existing.qty += inputQty;
        } else {
            alert("La cantidad acumulada supera el stock disponible en bodega.");
            return;
        }
    } else {
        cart.push({ ...selectedProdForCart, qty: inputQty });
    }

    closeModal('modal-select-qty');
    updateCartUI();
}

function setExactQuantity(id) {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    let inputQty = prompt(`Ingresa la cantidad exacta para "${item.name}" (${item.unit || 'Unid'}):\n(Ej. 1.5 para 1 y media):`, item.qty);
    if (inputQty === null) return;

    let newQty = parseFloat(inputQty);
    const prod = products.find(p => p.id === id);

    if (isNaN(newQty) || newQty <= 0) {
        removeFromCart(id);
        return;
    }

    if (prod && newQty > prod.stock) {
        alert(`Stock insuficiente. Máximo disponible: ${prod.stock} ${prod.unit || 'Unid'}`);
        return;
    }

    item.qty = newQty;
    updateCartUI();
}

function adjustQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    const prod = products.find(p => p.id === id);
    let newQty = item.qty + delta;

    if (newQty <= 0) {
        removeFromCart(id);
        return;
    }

    if (prod && newQty > prod.stock) {
        alert(`Stock máximo disponible alcanzado: ${prod.stock}`);
        return;
    }

    item.qty = newQty;
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    container.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">El carrito está vacío</p>';
        const cartTotal = document.getElementById('cart-total');
        if (cartTotal) cartTotal.textContent = 'C$ 0.00';
        return;
    }

    cart.forEach(item => {
        const subtotal = item.price * item.qty;
        total += subtotal;

        let unitLabel = item.unit || 'Unid';
        if (unitLabel.includes('(')) unitLabel = unitLabel.split(' ')[0];

        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl text-xs space-x-2';
        row.innerHTML = `
            <div class="flex-1 min-w-0">
                <p class="font-bold text-white truncate">${item.name}</p>
                <p class="text-[10px] text-slate-400">C$ ${item.price.toFixed(2)} / ${unitLabel}</p>
            </div>

            <div class="flex items-center space-x-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
                <button onclick="adjustQty(${item.id}, -1)" class="text-slate-400 hover:text-white px-1 text-sm font-bold">-</button>
                <span onclick="setExactQuantity(${item.id})" class="text-emerald-400 font-bold px-1.5 cursor-pointer underline decoration-dotted" title="Toca para ingresar decimales">
                    ${item.qty} ${unitLabel}
                </span>
                <button onclick="adjustQty(${item.id}, 1)" class="text-slate-400 hover:text-white px-1 text-sm font-bold">+</button>
            </div>

            <span class="font-extrabold text-white text-right w-16">C$ ${subtotal.toFixed(2)}</span>

            <button onclick="removeFromCart(${item.id})" class="text-rose-400 hover:text-rose-300 p-1">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        container.appendChild(row);
    });

    const cartTotal = document.getElementById('cart-total');
    if (cartTotal) cartTotal.textContent = `C$ ${total.toFixed(2)}`;
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id !== id);
    updateCartUI();
}

function renderInventory() {
    const container = document.getElementById('inventory-list');
    if (!container) return;
    container.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <h4 class="text-xs font-bold text-slate-300">Existencias y Códigos en Bodega</h4>
            <button onclick="openModal('modal-add-product')" class="bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1">
                <i class="fa-solid fa-plus"></i>
                <span>+ Nuevo Producto</span>
            </button>
        </div>
        <div id="inventory-items-container" class="space-y-2"></div>
    `;

    const itemsContainer = document.getElementById('inventory-items-container');
    products.forEach(p => {
        let unitClean = p.unit || 'Unid';
        if (unitClean.includes('(')) unitClean = unitClean.split(' ')[0];

        const div = document.createElement('div');
        div.className = 'bg-slate-800/80 border border-slate-700 p-3 rounded-xl flex items-center justify-between';
        div.innerHTML = `
            <div>
                <p class="text-[10px] text-emerald-400 font-mono font-bold">Cód: ${p.code || 'S/C'}</p>
                <p class="text-xs font-bold text-white">${p.name}</p>
                <p class="text-[10px] text-slate-400">Precio: C$ ${p.price.toFixed(2)} / ${unitClean} | Stock: <strong class="${p.stock <= p.minStock ? 'text-rose-400' : 'text-emerald-400'}">${p.stock} ${unitClean}</strong></p>
            </div>
        `;
        itemsContainer.appendChild(div);
    });
}

function handleAddNewProduct(e) {
    if (e) e.preventDefault();

    const nameInput = document.getElementById('new-prod-name');
    const priceInput = document.getElementById('new-prod-price');
    const stockInput = document.getElementById('new-prod-stock');
    const unitInput = document.getElementById('product-unit');
    const codeInput = document.getElementById('new-prod-code');

    const name = nameInput ? nameInput.value.trim() : '';
    const price = priceInput ? parseFloat(priceInput.value) : 0;
    const stock = stockInput ? parseFloat(stockInput.value) : 0;
    const rawUnit = unitInput ? unitInput.value : 'Unid';
    const code = codeInput ? codeInput.value.trim() : '';

    if (!name) {
        alert('Por favor ingresa el nombre del producto.');
        return;
    }

    if (isNaN(price) || price < 0) {
        alert('Ingresa un precio válido.');
        return;
    }

    if (isNaN(stock) || stock < 0) {
        alert('Ingresa una cantidad de stock válida.');
        return;
    }

    let unitDisplay = rawUnit;
    if (rawUnit === 'm') unitDisplay = 'm (Metro)';
    else if (rawUnit === 'Yd') unitDisplay = 'Yd (Yarda)';
    else if (rawUnit === 'Lb') unitDisplay = 'Lb (Libra)';
    else if (rawUnit === 'Paq') unitDisplay = 'Paq (Paquete)';
    else if (rawUnit === 'Unid') unitDisplay = 'Unid (Unidad)';

    const newProd = {
        id: Date.now(),
        code: code || '',
        name: name,
        unit: unitDisplay,
        price: price,
        stock: stock,
        minStock: 5
    };

    products.push(newProd);
    saveData();

    alert(`¡Producto "${name}" guardado exitosamente!`);

    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
    if (stockInput) stockInput.value = '';
    if (codeInput) codeInput.value = '';

    closeModal('modal-add-product');
    renderInventory();
    renderProducts();
}

function renderCreditClientsList(filter = '') {
    const container = document.getElementById('credit-clients-list');
    if (!container) return;
    container.innerHTML = '';

    const filtered = creditClients.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No se encontraron clientes</p>';
        return;
    }

    filtered.forEach(c => {
        const div = document.createElement('div');
        div.className = 'bg-slate-800/80 border border-slate-700 p-3.5 rounded-xl space-y-1 cursor-pointer hover:border-emerald-500 transition';
        div.onclick = () => openClientDetailModal(c.id);
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <h4 class="text-xs font-bold text-white"><i class="fa-solid fa-user mr-1.5 text-emerald-400"></i>${c.name}</h4>
                <span class="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-md">${c.phone}</span>
            </div>
            <div class="flex justify-between text-xs pt-1">
                <span class="text-slate-400">Deuda Pendiente:</span>
                <span class="font-bold ${c.debt > 0 ? 'text-amber-400' : 'text-emerald-400'}">C$ ${c.debt.toFixed(2)}</span>
            </div>
            <p class="text-[10px] text-slate-500 text-right">Toca para ver ficha y abonar</p>
        `;
        container.appendChild(div);
    });
}

function openClientDetailModal(id) {
    activeSelectedClientId = id;
    const client = creditClients.find(c => c.id === id);
    if (!client) return;

    const detailName = document.getElementById('detail-client-name');
    const detailPhone = document.getElementById('detail-client-phone');
    const detailDebt = document.getElementById('detail-client-debt');

    if (detailName) detailName.textContent = client.name;
    if (detailPhone) detailPhone.textContent = `Tel: ${client.phone}`;
    if (detailDebt) detailDebt.textContent = `C$ ${client.debt.toFixed(2)}`;

    const historyContainer = document.getElementById('detail-client-history');
    if (!historyContainer) return;
    historyContainer.innerHTML = '';

    if (!client.history || client.history.length === 0) {
        historyContainer.innerHTML = '<p class="text-slate-500 py-2">Cuenta limpia. No hay consumos pendientes.</p>';
    } else {
        client.history.forEach(h => {
            const card = document.createElement('div');
            card.className = 'bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1';
            
            let itemsHtml = '';
            if (Array.isArray(h.items)) {
                itemsHtml = h.items.map(i => `<div class="flex justify-between"><span>${i.qty}x ${i.name}</span><span>C$ ${(i.price * i.qty).toFixed(2)}</span></div>`).join('');
            } else {
                itemsHtml = `<p>${h.items}</p>`;
            }

            card.innerHTML = `
                <div class="flex justify-between text-[10px] text-slate-400">
                    <span>${h.date}</span>
                    <span>Atendió: ${h.user}</span>
                </div>
                <div class="space-y-0.5 text-slate-200 font-medium py-1 border-y border-slate-800/80">${itemsHtml}</div>
                <div class="flex justify-between font-bold text-emerald-400 pt-0.5">
                    <span>Subtotal:</span>
                    <span>C$ ${h.total.toFixed(2)}</span>
                </div>
            `;
            historyContainer.appendChild(card);
        });
    }

    const abonoAmount = document.getElementById('detail-abono-amount');
    if (abonoAmount) abonoAmount.value = '';
    openModal('modal-client-detail');
}

function handleAbonoSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('detail-abono-amount').value);
    const client = creditClients.find(c => c.id === activeSelectedClientId);

    if (!client || isNaN(amount) || amount <= 0) return alert('Ingresa un monto válido');

    client.debt -= amount;
    totalAbonosToday += amount;

    if (client.debt <= 0) {
        client.debt = 0;
        client.history = [];
        alert(`¡Felicidades! ${client.name} ha CANCELADO la totalidad de su deuda.`);
    } else {
        alert(`¡Abono de C$ ${amount.toFixed(2)} registrado! Deuda restante: C$ ${client.debt.toFixed(2)}`);
    }

    saveData();
    closeModal('modal-client-detail');
    renderCreditClientsList();
}

function handleAddNewClient(e) {
    e.preventDefault();
    const name = document.getElementById('new-client-name').value.trim();
    const phone = document.getElementById('new-client-phone').value.trim() || 'S/N';

    if (!name) return;

    const newClient = {
        id: Date.now(),
        name,
        phone,
        debt: 0.00,
        history: []
    };

    creditClients.push(newClient);
    saveData();

    alert(`¡Cliente ${name} registrado con éxito!`);
    document.getElementById('new-client-name').value = '';
    document.getElementById('new-client-phone').value = '';
    closeModal('modal-add-client');
    renderCreditClientsList();
}

function openCreditModal() {
    if (cart.length === 0) return alert('El carrito está vacío');

    const select = document.getElementById('credit-client-select');
    if (!select) return;
    select.innerHTML = '';

    creditClients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (Deuda: C$ ${c.debt.toFixed(2)})`;
        select.appendChild(opt);
    });

    openModal('modal-select-credit-client');
}

function confirmCreditPayment() {
    const clientId = parseInt(document.getElementById('credit-client-select').value);
    const client = creditClients.find(c => c.id === clientId);

    if (!client) return alert('Selecciona un cliente válido');

    const total = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    client.debt += total;

    client.history.unshift({
        date: new Date().toLocaleString(),
        items: [...cart],
        total: total,
        user: currentUser
    });

    closeModal('modal-select-credit-client');
    processPayment('Crédito', client.name);
}

function initPaymentProcess(method) {
    if (cart.length === 0) return alert('El carrito está vacío');
    const clientInput = document.getElementById('client-name');
    const client = clientInput ? clientInput.value.trim() : 'Cliente Contado';
    processPayment(method, client);
}

function processPayment(method, clientName) {
    const total = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);

    cart.forEach(item => {
        const p = products.find(prod => prod.id === item.id);
        if (p) p.stock -= item.qty;
    });

    if (method === 'Pago Normal') totalCashSalesToday += total;

    lastProcessedInvoice = {
        id: `FAC-${Date.now().toString().slice(-4)}`,
        date: new Date().toLocaleString(),
        user: currentUser,
        client: clientName,
        method,
        items: [...cart],
        total
    };

    invoices.unshift(lastProcessedInvoice);
    saveData();

    cart = [];
    updateCartUI();
    renderProducts();

    openModal('modal-print-prompt');
}

function executePrint(shouldPrint) {
    closeModal('modal-print-prompt');
    if (shouldPrint && lastProcessedInvoice) {
        showReceipt(lastProcessedInvoice);
    }
}

function showReceipt(inv) {
    const container = document.getElementById('receipt-content');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center font-bold border-b border-slate-300 pb-2">
            <h3 class="text-sm">MINI FERRETERÍA GONZÁLEZ</h3>
            <p class="text-[10px] text-slate-500">Ticket No: ${inv.id}</p>
        </div>
        <div class="text-[10px] py-1 border-b border-slate-200 space-y-0.5">
            <p><strong>Fecha:</strong> ${inv.date}</p>
            <p><strong>Atendió:</strong> ${inv.user}</p>
            <p><strong>Cliente:</strong> ${inv.client}</p>
            <p><strong>Pago:</strong> ${inv.method}</p>
        </div>
        <div class="py-2 space-y-1">
            ${inv.items.map(i => {
                const qty = parseFloat(i.qty) || 0;
                const unitPrice = parseFloat(i.price || i.unitPrice) || 0;
                const subtotal = Math.round(qty * unitPrice); // Redondeo a entero
                
                // Detectar la unidad del producto (ej. 'metro', 'yarda', 'libra') o usar 'c/u' por defecto
                const unitText = i.unit ? `x ${i.unit.toLowerCase()}` : 'c/u';
                
                return `
                    <div class="flex justify-between items-center text-[11px] py-1 border-b border-dashed border-slate-200">
                        <div>
                            <span class="font-bold">${qty}x ${i.name}</span>
                            <span class="text-[9px] text-slate-500 block">(C$ ${Math.round(unitPrice)} ${unitText})</span>
                        </div>
                        <span class="font-bold">C$ ${subtotal}</span>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="border-t border-slate-300 pt-2 flex justify-between font-bold text-xs">
            <span>TOTAL:</span>
            <span class="text-emerald-700">C$ ${Math.round(inv.total)}</span>
        </div>
    `;
    openModal('modal-receipt');
}

function saveHardwareSettings() {
    alert('¡Configuración de hardware guardada con éxito!');
}

function renderInvoices() {
    const container = document.getElementById('invoices-list');
    if (!container) return;
    container.innerHTML = '';

    if (invoices.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No hay facturas registradas</p>';
        return;
    }

    invoices.forEach(inv => {
        const div = document.createElement('div');
        div.className = 'bg-slate-800/80 border border-slate-700 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:border-emerald-500 transition';
        div.onclick = () => showInvoiceDetail(inv.id);
        div.innerHTML = `
            <div>
                <p class="text-xs font-bold text-white">${inv.id} - ${inv.client}</p>
                <p class="text-[10px] text-slate-400">${inv.date} | ${inv.method} <span class="text-emerald-400 font-semibold">| Toca para ver detalle</span></p>
            </div>
            <p class="text-xs font-extrabold text-emerald-400">C$ ${inv.total.toFixed(2)}</p>
        `;
        container.appendChild(div);
    });
}

function showInvoiceDetail(invoiceId) {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    lastProcessedInvoice = inv;
    showReceipt(inv);
}

function saveData() {
    localStorage.setItem('ferre_products', JSON.stringify(products));
    localStorage.setItem('ferre_credit_clients', JSON.stringify(creditClients));
    localStorage.setItem('ferre_invoices', JSON.stringify(invoices));
    localStorage.setItem('ferre_admin_alerts', JSON.stringify(adminAlerts));
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
}

// --- CÁLCULO DE ARQUEO CON DÓLARES (TASA 36) ---
function calculateCountedCash() {
    let totalNIO = 0;
    let totalUSD = 0;

    document.querySelectorAll('.bill-input').forEach(input => {
        const qty = parseFloat(input.value) || 0;
        const val = parseFloat(input.dataset.val) || 0;
        const curr = input.dataset.currency;

        if (curr === 'NIO') totalNIO += qty * val;
        if (curr === 'USD') totalUSD += qty * val;
    });

    const totalNIOFromUSD = totalUSD * 36.00;
    const granTotal = totalNIO + totalNIOFromUSD;

    const nioDisplay = document.getElementById('counted-nio-display');
    const usdDisplay = document.getElementById('counted-usd-display');

    if (nioDisplay) nioDisplay.textContent = `C$ ${granTotal.toFixed(2)} (C$ ${totalNIO.toFixed(2)} + $${totalUSD.toFixed(2)} a tasa 36)`;
    if (usdDisplay) usdDisplay.textContent = `$ ${totalUSD.toFixed(2)}`;
}

function openCloseShiftModal() {
    const cashTotalEl = document.getElementById('close-cash-total');
    const abonosTotalEl = document.getElementById('close-abonos-total');
    const expectedEl = document.getElementById('close-expected-total');

    let expected = totalCashSalesToday + totalAbonosToday;

    if (cashTotalEl) cashTotalEl.textContent = `C$ ${totalCashSalesToday.toFixed(2)}`;
    if (abonosTotalEl) abonosTotalEl.textContent = `C$ ${totalAbonosToday.toFixed(2)}`;
    if (expectedEl) expectedEl.textContent = `C$ ${expected.toFixed(2)}`;

    openModal('modal-close-shift');
}

function handleCashMove(e) {
    e.preventDefault();
    const type = document.getElementById('move-type').value;
    const amount = parseFloat(document.getElementById('move-amount').value);
    const reason = document.getElementById('move-reason').value;

    if (isNaN(amount) || amount <= 0) return alert('Ingresa un monto válido');

    cashMovements.push({ type, amount, reason });
    closeModal('modal-cash-move');
    document.getElementById('cash-move-form').reset();
    alert("Movimiento de caja registrado con éxito.");
}

function handleLogoutAttempt() {
    location.reload();
}
// --- ACTUALIZACIÓN DEL DASHBOARD GENERAL ---
function updateDashboard() {
    if (currentRole !== 'admin') return;

    const now = new Date();
    const todayStr = now.toLocaleDateString();

    let totalDay = 0;
    let totalWeek = 0;
    let totalMonth = 0;

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Cálculo del inicio de la semana (Lunes)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    invoices.forEach(inv => {
        const invDate = new Date(inv.date);
        const invTotal = parseFloat(inv.total) || 0;

        // Venta del día
        if (invDate.toLocaleDateString() === todayStr) {
            totalDay += invTotal;
        }

        // Venta de la semana
        if (invDate >= startOfWeek) {
            totalWeek += invTotal;
        }

        // Venta del mes
        if (invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear) {
            totalMonth += invTotal;
        }
    });

    // Actualizar contadores en pantalla
    const dayEl = document.getElementById('dash-sales-day');
    const weekEl = document.getElementById('dash-sales-week');
    const monthEl = document.getElementById('dash-sales-month');
    const transEl = document.getElementById('dash-trans-count');

    if (dayEl) dayEl.textContent = `C$ ${totalDay.toFixed(2)}`;
    if (weekEl) weekEl.textContent = `C$ ${totalWeek.toFixed(2)}`;
    if (monthEl) monthEl.textContent = `C$ ${totalMonth.toFixed(2)}`;
    if (transEl) transEl.textContent = invoices.length;

    renderDashboardInvoices();
}

// --- RENDERIZAR HISTORIAL DETALLADO EN EL DASHBOARD ---
function renderDashboardInvoices() {
    const container = document.getElementById('dash-detailed-invoices');
    if (!container) return;
    container.innerHTML = '';

    if (invoices.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No hay facturas registradas en el sistema.</p>';
        return;
    }

    invoices.forEach((inv, index) => {
        const item = document.createElement('div');
        item.className = 'bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl space-y-1.5 text-xs';

        // Detalle de los artículos vendidos
        let itemsSummary = '';
        if (Array.isArray(inv.items)) {
            itemsSummary = inv.items.map(i => `${i.qty}x ${i.name}`).join(', ');
        }

        item.innerHTML = `
            <div class="flex justify-between items-center font-bold">
                <span class="text-emerald-400">${inv.id} - C$ ${parseFloat(inv.total).toFixed(2)}</span>
                <span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">${inv.method}</span>
            </div>
            <div class="flex justify-between text-[11px] text-slate-300">
                <span><i class="fa-solid fa-user text-slate-400 mr-1"></i><strong>Vendido por:</strong> ${inv.user}</span>
                <span><i class="fa-solid fa-clock text-slate-400 mr-1"></i>${inv.date}</span>
            </div>
            <p class="text-[10px] text-slate-400 truncate"><strong>Prod:</strong> ${itemsSummary}</p>
            
            ${currentRole === 'admin' ? `
                <div class="flex justify-end pt-1 border-t border-slate-800">
                    <button onclick="deleteSingleInvoice('${inv.id}')" class="text-rose-400 hover:text-rose-300 text-[10px] font-bold flex items-center space-x-1">
                        <i class="fa-solid fa-trash"></i>
                        <span>Eliminar Registro</span>
                    </button>
                </div>
            ` : ''}
        `;
        container.appendChild(item);
    });
}

// --- ELIMINAR UNA SOLA FACTURA (SOLO ADMIN) ---
function deleteSingleInvoice(invoiceId) {
    if (currentRole !== 'admin') {
        alert("Acceso denegado: Solo el Administrador puede borrar facturas.");
        return;
    }

    if (confirm(`¿Estás seguro de eliminar la factura ${invoiceId}? Esta acción liberará espacio de memoria.`)) {
        invoices = invoices.filter(inv => inv.id !== invoiceId);
        saveData();
        updateDashboard();
        if (typeof renderInvoices === 'function') renderInvoices();
        alert("Factura eliminada correctamente.");
    }
}

// --- DEPURAR HISTORIAL COMPLETO / ESPACIO (SOLO ADMIN) ---
function clearOldInvoices() {
    if (currentRole !== 'admin') {
        alert("Acceso denegado: Solo el Administrador puede borrar el historial.");
        return;
    }

    if (confirm("¿Deseas depurar las facturas antiguas para liberar espacio en el dispositivo?")) {
        // Mantiene solo las últimas 100 facturas más recientes
        if (invoices.length > 100) {
            invoices = invoices.slice(0, 100);
            saveData();
            updateDashboard();
            if (typeof renderInvoices === 'function') renderInvoices();
            alert("Se han depurado las facturas antiguas manteniendo las 100 más recientes.");
        } else {
            alert("El historial aún es pequeño. No requiere depuración.");
        }
    }
}
// --- RENDERIZAR HISTORIAL DETALLADO EN EL DASHBOARD ---
function renderDashboardInvoices() {
    const container = document.getElementById('dash-detailed-invoices');
    if (!container) return;
    container.innerHTML = '';

    if (invoices.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No hay facturas registradas en el sistema.</p>';
        return;
    }

    invoices.forEach((inv) => {
        const item = document.createElement('div');
        item.className = 'bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl space-y-1.5 text-xs hover:border-emerald-500/50 transition';

        // Detalle de los artículos vendidos
        let itemsSummary = '';
        if (Array.isArray(inv.items)) {
            itemsSummary = inv.items.map(i => `${i.qty}x ${i.name}`).join(', ');
        }

        item.innerHTML = `
            <div class="flex justify-between items-center font-bold cursor-pointer" onclick="showInvoiceDetail('${inv.id}')" title="Toca para ver factura">
                <span class="text-emerald-400 hover:underline"><i class="fa-solid fa-receipt mr-1"></i>${inv.id} - C$ ${parseFloat(inv.total).toFixed(2)}</span>
                <span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">${inv.method}</span>
            </div>
            <div class="flex justify-between text-[11px] text-slate-300">
                <span><i class="fa-solid fa-user text-slate-400 mr-1"></i><strong>Vendido por:</strong> ${inv.user}</span>
                <span><i class="fa-solid fa-clock text-slate-400 mr-1"></i>${inv.date}</span>
            </div>
            <p class="text-[10px] text-slate-400 truncate"><strong>Prod:</strong> ${itemsSummary}</p>
            
            ${currentRole === 'admin' ? `
                <div class="flex justify-end pt-1 border-t border-slate-800">
                    <button onclick="deleteSingleInvoice('${inv.id}')" class="text-rose-400 hover:text-rose-300 text-[10px] font-bold flex items-center space-x-1">
                        <i class="fa-solid fa-trash"></i>
                        <span>Eliminar Registro</span>
                    </button>
                </div>
            ` : ''}
        `;
        container.appendChild(item);
    });

}
// ==========================================
// ACTUALIZAR PRECIO Y STOCK DE PRODUCTO EXISTENTE
// ==========================================
function actualizarMercaderiaExistente(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Pedir el nuevo costo de compra y la cantidad que llegó
    const nuevoCostoInput = prompt(`Actualizar costo para: ${product.name}\nCosto actual: C$ ${product.cost || 0}\nIngrese el NUEVO costo unitario de compra (C$):`);
    if (nuevoCostoInput === null) return; // Cancelado
    const nuevoCosto = parseFloat(nuevoCostoInput);
    if (isNaN(nuevoCosto) || nuevoCosto < 0) {
        alert("Costo no válido.");
        return;
    }

    const cantidadLlegadaInput = prompt(`¿Cuántas unidades/metros/libras de "${product.name}" llegaron con este nuevo costo?`);
    if (cantidadLlegadaInput === null) return;
    const cantidadLlegada = parseFloat(cantidadLlegadaInput);
    if (isNaN(cantidadLlegada) || cantidadLlegada <= 0) {
        alert("Cantidad no válida.");
        return;
    }

    // Pedir el margen de ganancia (por defecto 35% o el que ya tenía)
    const margenInput = prompt("Ingrese el porcentaje de margen de ganancia deseado (Ej: 35):", "35");
    const margen = parseFloat(margenInput) || 35;

    // Calcular nuevo precio de venta redondeado a entero
    const precioCalculado = nuevoCosto * (1 + (margen / 100));
    const nuevoPrecioVenta = Math.round(precioCalculado);

    // Actualizar el producto en el inventario
    product.cost = nuevoCosto;
    product.price = nuevoPrecioVenta; // Se actualiza al nuevo precio entero calculado
    product.stock += cantidadLlegada; // Se suma al stock actual

    saveData();
    renderProducts();

    alert(`¡Mercadería actualizada con éxito!\n- Nuevo Costo: C$ ${nuevoCosto}\n- Margen: ${margen}%\n- Nuevo Precio de Venta: C$ ${nuevoPrecioVenta}\n- Stock Total Actualizado: ${product.stock}`);
    // Dentro de tu renderizado de productos para el Administrador, puedes agregar este botón:
if (currentRole === 'admin') {
    // Agregas este botón junto al de editar/borrar:
    `
    <button onclick="actualizarMercaderiaExistente('${p.id}')" class="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2 py-1 rounded text-[10px] font-bold transition" title="Llegó mercadería nueva de este producto">
        <i class="fa-solid fa-boxes-stacked mr-1"></i> Recibir Mercadería
    </button>
    `
}
}
// ==========================================
// CONVERTIDOR DE ROLLO/PAQUETE A UNIDAD DE VENTA
// ==========================================
function calcularPrecioDesdePaquete() {
    const costoPaquete = parseFloat(document.getElementById('pack-cost')?.value) || 0;
    const unidadesEnPaquete = parseFloat(document.getElementById('pack-qty')?.value) || 1; // Para evitar división entre 0
    const porcentajeGanancia = parseFloat(document.getElementById('product-markup')?.value) || 0;

    // 1. Calcular cuánto cuesta realmente cada metro / yarda / unidad individual
    const costoUnitarioReal = costoPaquete / unidadesEnPaquete;

    // 2. Aplicar el margen de ganancia
    const precioVentaSugerido = costoUnitarioReal * (1 + (porcentajeGanancia / 100));

    // 3. Redondear a número entero exacto
    const precioEntero = Math.round(precioVentaSugerido);

    // 4. Mostrar en pantalla
    const lblUnitCost = document.getElementById('lbl-unit-cost');
    if (lblUnitCost) {
        lblUnitCost.textContent = `C$ ${costoUnitarioReal.toFixed(2)}`;
    }

    const inputPrice = document.getElementById('product-price');
    if (inputPrice) {
        inputPrice.value = isNaN(precioEntero) ? 0 : precioEntero;
    }
}
