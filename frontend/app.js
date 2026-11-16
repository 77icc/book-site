const API = (() => {
  let path = window.location.pathname.replace(/index\.html$/, "");
  path = path.replace(/\/+$/, "");
  return path + "/api";
})();

let reviews = [];
let rating = 5;
let adminPassword = null;

const starPicker = document.getElementById("starPicker");
const reviewForm = document.getElementById("reviewForm");
const titleInput = document.getElementById("titleInput");
const contentInput = document.getElementById("contentInput");
const submitBtn = document.getElementById("submitBtn");
const bookList = document.getElementById("bookList");
const emptyState = document.getElementById("emptyState");
const statsEl = document.getElementById("stats");
const toastEl = document.getElementById("toast");
const adminBtn = document.getElementById("adminBtn");
const adminBadge = document.getElementById("adminBadge");
const adminModal = document.getElementById("adminModal");
const adminPasswordInput = document.getElementById("adminPassword");
const adminError = document.getElementById("adminError");
const loginBtn = document.getElementById("loginBtn");
const cancelAdmin = document.getElementById("cancelAdmin");

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

function renderStars(value) {
  const filled = "★".repeat(value);
  const empty = '<span class="off">' + "★".repeat(5 - value) + "</span>";
  return filled + empty;
}

function renderStarPicker() {
  starPicker.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "★";
    btn.className = i <= rating ? "active" : "";
    btn.title = i + " 星";
    btn.addEventListener("click", () => {
      rating = i;
      renderStarPicker();
    });
    starPicker.appendChild(btn);
  }
}

function groupByBook(list) {
  const books = new Map();
  list.forEach((review) => {
    if (!books.has(review.title)) {
      books.set(review.title, []);
    }
    books.get(review.title).push(review);
  });
  return books;
}

function render() {
  if (reviews.length === 0) {
    bookList.innerHTML = "";
    emptyState.classList.remove("hidden");
    statsEl.textContent = "";
    return;
  }
  emptyState.classList.add("hidden");

  const books = groupByBook(reviews);
  statsEl.textContent = `${books.size} 本书 · ${reviews.length} 条评价`;

  let html = "";
  books.forEach((items, title) => {
    const avg = (items.reduce((sum, item) => sum + item.rating, 0) / items.length).toFixed(1);
    const deleteBook = adminPassword
      ? `<button class="delete-btn" data-action="delete-book" data-title="${escapeHtml(title)}">删除整本书</button>`
      : "";
    const reviewsHtml = items
      .map(
        (item) => `
        <div class="review">
          <div class="review-top">
            <span class="review-stars">${renderStars(item.rating)}</span>
            <span class="review-time">${escapeHtml(item.created_at)}</span>
          </div>
          <p class="review-content">${escapeHtml(item.content)}</p>
          ${
            adminPassword
              ? `<div class="review-actions"><button class="delete-btn" data-action="delete-review" data-id="${item.id}">删除这条</button></div>`
              : ""
          }
        </div>`
      )
      .join("");

    const repliesHtml = `
      <div class="reply">
        <button class="reply-toggle" type="button" data-action="toggle-reply">我也要写一点</button>
        <form class="reply-form hidden" data-title="${escapeHtml(title)}" data-rating="5" autocomplete="off">
          <div class="star-picker reply-stars">
            ${[1, 2, 3, 4, 5]
              .map(
                (i) =>
                  `<button type="button" class="active" data-action="set-rating" data-value="${i}" title="${i} 星">★</button>`
              )
              .join("")}
          </div>
          <textarea rows="3" maxlength="2000" placeholder="写下你对《${escapeHtml(title)}》的评价……" required></textarea>
          <div class="reply-actions">
            <button class="ghost-btn" type="button" data-action="cancel-reply">取消</button>
            <button class="primary-btn" type="submit">提交评价</button>
          </div>
        </form>
      </div>`;

    html += `
      <article class="book">
        <div class="book-head">
          <div class="book-title">${escapeHtml(title)}</div>
          <div class="book-meta">
            <span>${items.length} 条 · 平均 ${avg} 星</span>
            ${deleteBook}
          </div>
        </div>
        ${reviewsHtml}
        ${repliesHtml}
      </article>`;
  });

  bookList.innerHTML = html;
}

async function loadReviews() {
  try {
    const res = await fetch(`${API}/reviews`);
    if (!res.ok) throw new Error();
    reviews = await res.json();
    render();
  } catch (err) {
    toast("加载失败，请刷新重试");
  }
}

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  if (!title || !content) {
    toast("请填写书名和内容");
    return;
  }

  submitBtn.disabled = true;
  try {
    const res = await fetch(`${API}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, rating }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "提交失败");

    reviews.unshift(data);
    render();
    titleInput.value = "";
    contentInput.value = "";
    rating = 5;
    renderStarPicker();
    toast("评价已提交");
  } catch (err) {
    toast(err.message || "提交失败");
  } finally {
    submitBtn.disabled = false;
  }
});

async function adminDelete(payload) {
  try {
    const res = await fetch(`${API}/admin/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, password: adminPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "删除失败");
    await loadReviews();
    toast("已删除");
  } catch (err) {
    toast(err.message || "删除失败");
  }
}

bookList.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) return;

  if (action.dataset.action === "toggle-reply") {
    const form = action.parentElement.querySelector(".reply-form");
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) form.querySelector("textarea").focus();
    return;
  }

  if (action.dataset.action === "cancel-reply") {
    const form = action.closest(".reply-form");
    form.classList.add("hidden");
    form.querySelector("textarea").value = "";
    return;
  }

  if (action.dataset.action === "set-rating") {
    const form = action.closest(".reply-form");
    const value = Number(action.dataset.value);
    form.dataset.rating = String(value);
    form.querySelectorAll("[data-action='set-rating']").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.value) <= value);
    });
    return;
  }

  const btn = action.closest("button[data-action]");
  if (!btn || !adminPassword) return;

  if (btn.dataset.action === "delete-review") {
    if (!confirm("确定删除这条评价吗？")) return;
    adminDelete({ type: "review", id: Number(btn.dataset.id) });
  }

  if (btn.dataset.action === "delete-book") {
    if (!confirm(`确定删除《${btn.dataset.title}》的全部评价吗？`)) return;
    adminDelete({ type: "book", title: btn.dataset.title });
  }
});

bookList.addEventListener("submit", async (event) => {
  const form = event.target.closest(".reply-form");
  if (!form) return;
  event.preventDefault();

  const content = form.querySelector("textarea").value.trim();
  if (!content) {
    toast("请写下评价内容");
    return;
  }

  const title = form.dataset.title;
  const rating = Number(form.dataset.rating);
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;

  try {
    const res = await fetch(`${API}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, rating }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "提交失败");

    reviews.unshift(data);
    render();
    toast("评价已提交");
  } catch (err) {
    toast(err.message || "提交失败");
    submit.disabled = false;
  }
});

function openAdminModal() {
  adminPasswordInput.value = "";
  adminError.classList.add("hidden");
  adminModal.classList.remove("hidden");
  adminPasswordInput.focus();
}

function closeAdminModal() {
  adminModal.classList.add("hidden");
}

adminBtn.addEventListener("click", () => {
  if (adminPassword) {
    adminPassword = null;
    adminBadge.classList.add("hidden");
    adminBtn.textContent = "管理员";
    render();
    toast("已退出管理员模式");
    return;
  }
  openAdminModal();
});

cancelAdmin.addEventListener("click", closeAdminModal);

adminModal.addEventListener("click", (event) => {
  if (event.target === adminModal) closeAdminModal();
});

async function login() {
  const password = adminPasswordInput.value;
  if (!password) {
    adminError.textContent = "请输入密码";
    adminError.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`${API}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error("密码不正确");
    adminPassword = password;
    closeAdminModal();
    adminBadge.classList.remove("hidden");
    adminBtn.textContent = "退出管理";
    render();
    toast("已进入管理员模式");
  } catch (err) {
    adminError.textContent = err.message;
    adminError.classList.remove("hidden");
  }
}

loginBtn.addEventListener("click", login);
adminPasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});

renderStarPicker();
loadReviews();
