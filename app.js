/* MoMo Expense Tracker
   Core data structure: transactions is an array of transaction objects.
   This demo stores data locally in the current browser using localStorage. */
const STORAGE_KEY = "momo-expense-tracker-v1";
let transactions = loadTransactions(); // ARRAY: add, search, filter, summarize and delete records
let pendingDeleteId = null;

const $ = (id) => document.getElementById(id);
const money = (amount) => new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(amount);
const today = new Date();
const dateInput = $("date");
dateInput.value = dateToLocalISO(today);
$("monthLabel").textContent = today.toLocaleDateString("en-GH", { month: "long", year: "numeric" });

function dateToLocalISO(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function loadTransactions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter(isValidTransaction) : [];
  } catch (error) { return []; }
}
function isValidTransaction(item) {
  return item && typeof item.id === "string" && ["income", "expense"].includes(item.type)
    && Number.isFinite(Number(item.amount)) && Number(item.amount) > 0
    && typeof item.description === "string" && typeof item.date === "string";
}
function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch (error) {
    showMessage("Could not save. Your browser storage may be full or disabled.", true);
    return false;
  }
}
function showMessage(message, isError = false) {
  $("formMessage").textContent = message;
  $("formMessage").style.color = isError ? "#c2414b" : "#0f766e";
}
function monthKey(dateString) { return dateString.slice(0, 7); }
function currentMonthTransactions() {
  const current = dateToLocalISO(new Date()).slice(0, 7);
  return transactions.filter((t) => monthKey(t.date) === current); // ARRAY.filter()
}
function renderSummary() {
  const monthItems = currentMonthTransactions();
  const income = monthItems.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = monthItems.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  $("netTotal").textContent = money(income - expenses);
  $("incomeTotal").textContent = money(income);
  $("expenseTotal").textContent = money(expenses);
  $("incomeCount").textContent = `${monthItems.filter((t) => t.type === "income").length} income record(s)`;
  $("expenseCount").textContent = `${monthItems.filter((t) => t.type === "expense").length} expense record(s)`;
  $("transactionCount").textContent = monthItems.length;
}
function renderBreakdown() {
  const expenses = currentMonthTransactions().filter((t) => t.type === "expense");
  const totals = expenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {});
  const categories = Object.entries(totals).sort((a, b) => b[1] - a[1]); // derived array, sorted highest first
  const total = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const container = $("breakdown");
  if (!categories.length) {
    container.innerHTML = '<div class="empty-state">Add expenses this month to see your spending breakdown.</div>';
  } else {
    container.innerHTML = categories.map(([category, amount]) => `
      <div class="breakdown-row">
        <div class="breakdown-label"><span>${escapeHTML(category)}</span><span>${money(amount)} · ${Math.round(amount / total * 100)}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, amount / total * 100)}%"></div></div>
      </div>`).join("");
  }
  renderInsight(expenses, categories, total);
}
function renderInsight(expenses, categories, total) {
  const node = $("insightText");
  if (!expenses.length) {
    node.textContent = "Add expenses to get a simple spending summary. This uses built-in rules, not an external AI service.";
    return;
  }
  const biggest = categories[0];
  const average = total / expenses.length;
  const todayKey = dateToLocalISO(new Date()).slice(0, 7);
  const income = currentMonthTransactions().filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  let text = `You recorded ${expenses.length} expense(s) totaling ${money(total)} this month.`;
  if (biggest) text += ` Your largest category is ${biggest[0]} at ${money(biggest[1])} (${Math.round(biggest[1] / total * 100)}% of spending).`;
  text += ` Your average expense is ${money(average)}.`;
  if (income > 0) {
    const rate = total / income * 100;
    text += rate > 80 ? ` Expenses use ${Math.round(rate)}% of recorded income—review non-essential spending if you can.` : ` Expenses use ${Math.round(rate)}% of recorded income.`;
  } else text += " Record income too to compare your spending with money received.";
  node.textContent = text;
}
function renderMonthOptions() {
  const select = $("filterMonth");
  const previous = select.value;
  const months = [...new Set(transactions.map((t) => monthKey(t.date)))].sort().reverse();
  select.innerHTML = '<option value="all">All months</option>' + months.map((m) => {
    const [year, month] = m.split("-");
    const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GH", { month: "long", year: "numeric" });
    return `<option value="${m}">${escapeHTML(label)}</option>`;
  }).join("");
  if ([...select.options].some((o) => o.value === previous)) select.value = previous;
}
function getVisibleTransactions() {
  const query = $("search").value.trim().toLowerCase();
  const type = $("filterType").value;
  const month = $("filterMonth").value;
  return transactions
    .filter((t) => type === "all" || t.type === type)
    .filter((t) => month === "all" || monthKey(t.date) === month)
    .filter((t) => !query || `${t.description} ${t.category} ${t.method}`.toLowerCase().includes(query))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)); // ARRAY.filter(), slice(), sort()
}
function renderTransactions() {
  const visible = getVisibleTransactions();
  $("visibleCount").textContent = `${visible.length} record${visible.length === 1 ? "" : "s"}`;
  $("transactionRows").innerHTML = visible.map((t) => `
    <tr>
      <td><div class="transaction-name">${escapeHTML(t.description)}</div><div class="transaction-sub">${t.type === "income" ? "Money received" : "Money spent"}</div></td>
      <td><span class="category-tag">${escapeHTML(t.category)}</span><div class="method-text">${escapeHTML(t.method)}</div></td>
      <td>${escapeHTML(formatDate(t.date))}</td>
      <td class="right amount ${t.type}">${t.type === "income" ? "+" : "−"}${money(Number(t.amount))}</td>
      <td><button class="delete-btn" data-delete="${escapeHTML(t.id)}" aria-label="Delete ${escapeHTML(t.description)}" title="Delete transaction">×</button></td>
    </tr>`).join("");
  $("emptyTransactions").classList.toggle("hidden", visible.length > 0);
  if (!visible.length) $("emptyTransactions").textContent = transactions.length ? "No records match these filters." : "No transactions yet. Add your first transaction above.";
}
function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
function render() {
  renderSummary();
  renderBreakdown();
  renderMonthOptions();
  renderTransactions();
}
$("transactionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number($("amount").value);
  const description = $("description").value.trim();
  if (!Number.isFinite(amount) || amount <= 0 || !description) {
    showMessage("Enter a valid amount greater than zero and a description.", true);
    return;
  }
  const transaction = {
    id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: $("type").value,
    amount: Math.round(amount * 100) / 100,
    description,
    category: $("category").value,
    method: $("method").value,
    date: $("date").value
  };
  transactions.push(transaction); // ARRAY.push(): add a transaction
  if (!saveTransactions()) { transactions.pop(); return; }
  $("transactionForm").reset();
  dateInput.value = dateToLocalISO(new Date());
  showMessage("Transaction saved successfully.");
  render();
});
$("transactionRows").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  pendingDeleteId = button.dataset.delete;
  $("confirmDialog").showModal();
});
$("confirmDelete").addEventListener("click", (event) => {
  event.preventDefault();
  if (!pendingDeleteId) return;
  const previous = transactions;
  transactions = transactions.filter((t) => t.id !== pendingDeleteId); // ARRAY.filter(): remove the chosen record
  saveTransactions();
  pendingDeleteId = null;
  $("confirmDialog").close();
  render();
});
["search", "filterType", "filterMonth"].forEach((id) => $(id).addEventListener(id === "search" ? "input" : "change", renderTransactions));
$("type").addEventListener("change", () => {
  const category = $("category");
  if ($("type").value === "income") {
    category.value = "Salary";
  } else if (category.value === "Salary" || category.value === "Sales") {
    category.value = "Food";
  }
});
$("exportBtn").addEventListener("click", () => {
  if (!transactions.length) { alert("There are no transactions to export yet."); return; }
  const headers = ["Date", "Type", "Description", "Category", "Payment Method", "Amount (GHS)"];
  const rows = transactions.map((t) => [t.date, t.type, t.description, t.category, t.method, Number(t.amount).toFixed(2)]);
  const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `momo-transactions-${dateToLocalISO(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
render();
