let db;
let productsLoaded = false;

const SHEET_ID = "1jZoAzytMejjdPgRlpgDkOasQHXUAwGJEsvk1UCI9Qcc";

const request = indexedDB.open("ReceiptDB", 3);

request.onupgradeneeded = e => {
  db = e.target.result;
  db.createObjectStore("clients", { keyPath: "id" });
  db.createObjectStore("products", { keyPath: "id" });
  db.createObjectStore("receipts", { keyPath: "id" });
};

request.onsuccess = e => {
  db = e.target.result;
  loadClients();
  loadProducts();
};

// ---------- LOAD ----------

function loadClients() {
  db.transaction("clients").objectStore("clients").getAll().onsuccess = e => {
    const clients = e.target.result;

    const select = document.getElementById("client");
    select.innerHTML = clients.map(c => `<option>${c.name}</option>`).join("");

    new TomSelect("#client");
  };
}

function loadProducts() {
  db.transaction("products").objectStore("products").getAll().onsuccess = e => {
    products = e.target.result || [];

    productsLoaded = true; // ✅ ADD THIS LINE

    console.log("Products loaded:", products);
  };
}

// ---------- ITEMS ----------

function addItem() {
  if (!productsLoaded) {
    alert("Products are still loading. Try syncing or wait a second.");
    return;
  }

  // rest of your function continues below...

  div.innerHTML = `
    <select>
      ${products.map(p => `
        <option data-price="${p.price}">
          ${p.name}
        </option>
      `).join("")}
    </select>

    <input type="number" value="1" min="1">
    <span class="lineTotal">$0.00</span>
  `;

  document.getElementById("items").appendChild(div);

  const select = div.querySelector("select");
  const input = div.querySelector("input");

  select.addEventListener("change", updateTotal);
  input.addEventListener("input", updateTotal);

  updateTotal();
}

// ---------- TOTAL ----------

function updateTotal() {
  let total = 0;

  document.querySelectorAll(".item").forEach(item => {
    const select = item.querySelector("select");
    const input = item.querySelector("input");

    // 🛑 skip broken rows safely
    if (!select || !input) return;

    const qty = Number(input.value) || 0;

    const option = select.options[select.selectedIndex];
    const price = Number(option?.dataset?.price || 0);

    const lineTotal = price * qty;

    const lineEl = item.querySelector(".lineTotal");
    if (lineEl) {
      lineEl.textContent = `$${lineTotal.toFixed(2)}`;
    }

    total += lineTotal;
  });

  const totalEl = document.getElementById("total");
  if (totalEl) {
    totalEl.textContent = `Total: $${total.toFixed(2)}`;
  }
}
// ---------- SAVE ----------

function saveReceipt() {
  const items = [];

  document.querySelectorAll(".item").forEach(item => {
    items.push({
      name: item.querySelector("select").selectedOptions[0].text,
      price: item.querySelector("select").value,
      qty: item.querySelector("input").value
    });
  });

  const receipt = {
    id: Date.now(),
    client: document.getElementById("client").value,
    items,
    total: document.getElementById("total").innerText,
    date: new Date().toLocaleString()
  };

  db.transaction("receipts", "readwrite")
    .objectStore("receipts")
    .add(receipt);

  alert("Saved!");
}

// ---------- PDF ----------

function generateReceiptHTML() {
  let html = `<h2>Receipt</h2>`;
  html += `<p>${document.getElementById("client").value}</p><hr>`;

  document.querySelectorAll(".item").forEach(item => {
    html += `<p>
      ${item.querySelector("select").selectedOptions[0].text}
      x ${item.querySelector("input").value}
    </p>`;
  });

  html += `<hr><h3>${document.getElementById("total").innerText}</h3>`;
  return html;
}

function downloadPDF() {
  const element = document.createElement("div");
  element.innerHTML = generateReceiptHTML();

  html2pdf().from(element).save("receipt.pdf");
}

// ---------- SYNC ----------

async function syncData() {
  const clientsRes = await fetch(`https://opensheet.elk.sh/${SHEET_ID}/Clients`);
  const productsRes = await fetch(`https://opensheet.elk.sh/${SHEET_ID}/Products`);

  const clients = await clientsRes.json();
  const productsData = await productsRes.json();

  const tx = db.transaction(["clients", "products"], "readwrite");

  clients.forEach(c => {
    tx.objectStore("clients").put({ id: c.Name, name: c.Name });
  });

productsData.forEach(p => {
  tx.objectStore("products").put({
    id: p.Name,
    name: p.Name,
    price: Number(p.Price)
  });
});

  alert("Synced!");
  loadClients();
  loadProducts();
}

// ---------- BACKUP ----------

function exportData() {
  const tx = db.transaction(["clients", "products", "receipts"], "readonly");

  Promise.all([
    tx.objectStore("clients").getAll(),
    tx.objectStore("products").getAll(),
    tx.objectStore("receipts").getAll()
  ]).then(data => {
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "backup.json";
    a.click();
  });
}

function importData(event) {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = () => {
    const [clients, productsData, receipts] = JSON.parse(reader.result);

    const tx = db.transaction(["clients","products","receipts"], "readwrite");

    clients.forEach(c => tx.objectStore("clients").put(c));
    productsData.forEach(p => tx.objectStore("products").put(p));
    receipts.forEach(r => tx.objectStore("receipts").put(r));

    alert("Restored!");
  };

  reader.readAsText(file);
}
