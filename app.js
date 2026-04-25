let db;
let products = [];
let productsLoaded = false;

const SHEET_ID = "1jZoAzytMejjdPgRlpgDkOasQHXUAwGJEsvk1UCI9Qcc";

const request = indexedDB.open("ReceiptDB", 3);

request.onupgradeneeded = e => {
  db = e.target.result;
  // create object stores only if they don't exist
  if (!db.objectStoreNames.contains("clients")) {
    db.createObjectStore("clients", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("products")) {
    db.createObjectStore("products", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("receipts")) {
    db.createObjectStore("receipts", { keyPath: "id" });
  }
};

request.onsuccess = e => {
  db = e.target.result;
  loadClients();
  loadProducts();
};

request.onerror = e => {
  console.error("IndexedDB open error:", e);
};

// ---------- LOAD ----------

function loadClients() {
  const tx = db.transaction("clients", "readonly");
  tx.objectStore("clients").getAll().onsuccess = e => {
    const clients = e.target.result || [];
    const select = document.getElementById("client");
    if (!select) return;
    select.innerHTML = clients.map(c => <option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>).join("");
    // initialize TomSelect (if available)
    try {
      new TomSelect("#client");
    } catch (err) { /* ignore if TomSelect not loaded */ }
  };
}

function loadProducts() {
  const tx = db.transaction("products", "readonly");
  tx.objectStore("products").getAll().onsuccess = e => {
    products = e.target.result || [];
    productsLoaded = true;
    console.log("Products loaded:", products);
  };
}

// helper to avoid HTML injection in option values/text
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "'");
}

// ---------- ITEMS ----------

function addItem() {
  if (!productsLoaded) {
    alert("Products not loaded yet. Please wait and try again.");
    return;
  }

  const div = document.createElement("div");
  div.className = "item";

  div.innerHTML =     <select class="product">       ${products.map(p =>
        ${escapeHtml(p.name)}
      `).join("")}
    

text

Collapse


 Copy

<input type="number" min="0" value="1">
<span class="lineTotal">$0.00</span>
  `;

  document.getElementById("items").appendChild(div);

  const select = div.querySelector("select");

  try {
    // initialize TomSelect on the element instance if available
    if (typeof TomSelect !== "undefined") {
      new TomSelect(select);
    }
  } catch (err) {
    console.warn("TomSelect init failed:", err);
  }

  const qtyInput = div.querySelector("input");
  if (qtyInput) qtyInput.addEventListener("input", updateTotal);
  if (select) select.addEventListener("change", updateTotal);

  updateTotal();
}

// ---------- TOTAL ----------

function updateTotal() {
  let total = 0;

  document.querySelectorAll(".item").forEach(item => {
    const select = item.querySelector("select.product");
    const input = item.querySelector("input[type='number']");

text

Collapse


 Copy

if (!select || !input) {
  console.warn("Broken item detected:", item);
  return;
}

const qty = Number(input.value || 0);
const selectedOption = select.options[select.selectedIndex];
const price = Number(selectedOption?.dataset?.price || 0);

const lineTotal = price * qty;

const lineEl = item.querySelector(".lineTotal");
if (lineEl) {
  lineEl.textContent = `$${lineTotal.toFixed(2)}`;
}

total += lineTotal;
  });

  const totalEl = document.getElementById("total");
  if (totalEl) {
    totalEl.textContent = Total: $${total.toFixed(2)};
  }
}

// ---------- SAVE ----------

function saveReceipt() {
  const items = [];

  document.querySelectorAll(".item").forEach(item => {
    const select = item.querySelector("select.product");
    const input = item.querySelector("input[type='number']");
    if (!select || !input) return;

text

Collapse


 Copy

const selectedOption = select.options[select.selectedIndex];
items.push({
  id: select.value,
  name: selectedOption ? selectedOption.text.trim() : "",
  price: Number(selectedOption?.dataset?.price || 0),
  qty: Number(input.value || 0)
});
  });

  const clientEl = document.getElementById("client");
  const totalEl = document.getElementById("total");

  const receipt = {
    id: Date.now(),
    client: clientEl ? clientEl.value : "",
    items,
    total: totalEl ? totalEl.textContent : "",
    date: new Date().toLocaleString()
  };

  const tx = db.transaction("receipts", "readwrite");
  tx.objectStore("receipts").add(receipt);
  tx.onerror = e => console.error("Save receipt error:", e);
  tx.oncomplete = () => alert("Saved!");
}

// ---------- PDF ----------

function generateReceiptHTML() {
  const clientEl = document.getElementById("client");
  let html = <h2>Receipt</h2>;
  html += <p>${clientEl ? escapeHtml(clientEl.value) : ""}</p><hr>;

  document.querySelectorAll(".item").forEach(item => {
    const select = item.querySelector("select.product");
    const input = item.querySelector("input[type='number']");
    if (!select || !input) return;
    const name = select.options[select.selectedIndex]?.text || "";
    html += <p>${escapeHtml(name)} x ${escapeHtml(input.value)}</p>;
  });

  const totalEl = document.getElementById("total");
  html += <hr><h3>${totalEl ? escapeHtml(totalEl.textContent) : ""}</h3>;
  return html;
}

function downloadPDF() {
  const element = document.createElement("div");
  element.innerHTML = generateReceiptHTML();
  if (typeof html2pdf === "function") {
    html2pdf().from(element).save("receipt.pdf");
  } else {
    alert("html2pdf not available.");
  }
}

// ---------- SYNC ----------

async function syncData() {
  try {
    const clientsRes = await fetch(https://opensheet.elk.sh/${SHEET_ID}/Clients);
    const productsRes = await fetch(https://opensheet.elk.sh/${SHEET_ID}/Products);

text

Collapse


 Copy

const clients = await clientsRes.json();
const productsData = await productsRes.json();

const tx = db.transaction(["clients", "products"], "readwrite");
const clientsStore = tx.objectStore("clients");
const productsStore = tx.objectStore("products");

clients.forEach(c => {
  clientsStore.put({ id: c.Name, name: c.Name });
});

productsData.forEach(p => {
  productsStore.put({
    id: p.Name,
    name: p.Name,
    price: Number(p.Price) || 0
  });
});

tx.oncomplete = () => {
  alert("Synced!");
  loadClients();
  loadProducts();
};
tx.onerror = e => console.error("Sync transaction error:", e);
  } catch (err) {
    console.error("Sync error:", err);
    alert("Sync failed. See console for details.");
  }
}

// ---------- BACKUP ----------

function exportData() {
  const tx = db.transaction(["clients", "products", "receipts"], "readonly");
  const pClients = tx.objectStore("clients").getAll();
  const pProducts = tx.objectStore("products").getAll();
  const pReceipts = tx.objectStore("receipts").getAll();

  Promise.all([pClients, pProducts, pReceipts].map(p => new Promise(res => p.onsuccess = e => res(e.target.result))))
    .then(data => {
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "backup.json";
      a.click();
    }).catch(err => console.error("Export error:", err));
}

function importData(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const [clients, productsData, receipts] = JSON.parse(reader.result);
      const tx = db.transaction(["clients", "products", "receipts"], "readwrite");
      const cs = tx.objectStore("clients");
      const ps = tx.objectStore("products");
      const rs = tx.objectStore("receipts");

text

Collapse


 Copy

  (clients || []).forEach(c => cs.put(c));
  (productsData || []).forEach(p => ps.put(p));
  (receipts || []).forEach(r => rs.put(r));

  tx.oncomplete = () => {
    alert("Restored!");
    loadClients();
    loadProducts();
  };
  tx.onerror = e => console.error("Import transaction error:", e);
} catch (err) {
  console.error("Import parse error:", err);
  alert("Failed to import file.");
}
  };

  reader.readAsText(file);
}
