import { buildBuiltinTheaterNav } from './navigation.js';
// pages/yuzi-theater-diary/mount.js
var FIELDS = ["日期", "角色", "内容"];
var clean = (value) => String(value ?? "").normalize("NFKC").trim();
var icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
var avatarSlot = (name) => `character-avatar-${encodeURIComponent(clean(name) || "unnamed")}`;
var surname = (name) => [...clean(name).split(/[\s·•_-]+/).filter(Boolean)[0] || "人"][0] || "人";
var DIARY_LAYOUT_STYLE = '';
var TEMPLATE = `<section class="yuzi-theater-diary">${buildBuiltinTheaterNav('diary', '小日记表')}<main class="yuzi-theater-diary-content"><section id="yuzi-theater-diary-list" class="yuzi-theater-diary-list"></section></main></section>`;
function records(state) {
  const map = new Map((state?.headers || []).map((header, index) => [clean(header), index]));
  return (state?.rows || []).map((row) => Object.fromEntries(FIELDS.map((field) => [field, clean(row[map.get(field)] ?? "")]))).filter((record) => record["内容"]);
}
function parseContent(value) {
  const source = clean(value);
  const marker = /(?<![A-Za-z])(PS|PPS)\s*[:：]\s*/gi;
  const matches = [...source.matchAll(marker)];
  if (!matches.length) return { body: source, postscripts: [] };
  const body = source.slice(0, matches[0].index).trim();
  const postscripts = matches.map((match, index) => ({
    label: match[1].toUpperCase(),
    value: source.slice(match.index + match[0].length, matches[index + 1]?.index ?? source.length).trim()
  })).filter((item) => item.value);
  return { body, postscripts };
}
function appendRichText(parent, value) {
  clean(value).split(/(~~.*?~~)/g).filter(Boolean).forEach((part) => {
    if (part.startsWith("~~") && part.endsWith("~~")) parent.append(Object.assign(document.createElement("del"), { textContent: part.slice(2, -2) }));
    else parent.append(document.createTextNode(part));
  });
}
function card(record, key, liked, saved) {
  const parsed = parseContent(record["内容"]);
  const node = document.createElement("article");
  node.className = "yuzi-theater-diary-card";
  node.dataset.diaryKey = key;
  node.dataset.bindBody = "{{内容}}";
  node.dataset.bindTime = "{{日期}}";
  node.dataset.bindAuthor = "{{角色}}";
  node.append(Object.assign(document.createElement("header"), { className: "yuzi-theater-diary-card-header", textContent: "Whispers of Time" }));
  const content = document.createElement("div");
  content.className = "yuzi-theater-diary-card-content";
  const avatar = Object.assign(document.createElement("span"), { className: "yuzi-theater-diary-avatar", role: "img", ariaLabel: record["角色"] || "角色头像", textContent: surname(record["角色"]) });
  avatar.dataset.avatarName = clean(record["角色"]);
  avatar.dataset.hasImage = "false";
  content.append(avatar);
  const copy = document.createElement("div");
  copy.className = "yuzi-theater-diary-copy";
  copy.append(Object.assign(document.createElement("strong"), { className: "yuzi-theater-diary-author", textContent: record["角色"] || "匿名" }));
  const body = document.createElement("div");
  body.className = "yuzi-theater-diary-body";
  appendRichText(body, parsed.body);
  const time = document.createElement("time");
  time.className = "yuzi-theater-diary-time";
  time.innerHTML = icon("M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z");
  time.append(document.createTextNode(record["日期"] || "今日"));
  copy.append(body, time);
  content.append(copy);
  if (parsed.postscripts.length) {
    const postscripts = document.createElement("section");
    postscripts.className = "yuzi-theater-diary-postscripts";
    parsed.postscripts.forEach((item) => {
      const postscript = document.createElement("div");
      postscript.className = "yuzi-theater-diary-postscript";
      postscript.append(Object.assign(document.createElement("strong"), { textContent: `${item.label}:` }), Object.assign(document.createElement("span"), { textContent: item.value }));
      postscripts.append(postscript);
    });
    content.append(postscripts);
  }
  const footer = document.createElement("footer");
  footer.className = "yuzi-theater-diary-card-footer";
  footer.innerHTML = `<button class="yuzi-theater-diary-footer-button" type="button" data-local-action="like">${icon("M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z")}<span>喜欢</span></button><span class="yuzi-theater-diary-footer-separator"></span><button class="yuzi-theater-diary-footer-button" type="button" data-local-action="save">${icon("M12 17.3l-6.2 3.3 1.2-7-5-4.9 7-1 3-6.3 3.1 6.3 7 1-5 4.9 1.2 7Z")}<span>收藏</span></button><button class="yuzi-theater-diary-footer-button yuzi-theater-diary-more" type="button" data-local-action="more" aria-label="更多" title="更多">···</button>`;
  const likeButton = footer.querySelector('[data-local-action="like"]');
  const saveButton = footer.querySelector('[data-local-action="save"]');
  likeButton.classList.toggle("is-active", liked);
  saveButton.classList.toggle("is-active", saved);
  likeButton.setAttribute("aria-pressed", String(liked));
  saveButton.setAttribute("aria-pressed", String(saved));
  if (saved) saveButton.querySelector("span").textContent = "已置顶";
  node.append(content, footer);
  return node;
}
export function mount(context) {
  const root = context.root;
  root.innerHTML = TEMPLATE + DIARY_LAYOUT_STYLE;
  const page = root.querySelector(".yuzi-theater-diary");
  const list = root.querySelector("#yuzi-theater-diary-list");
  let disposed = false;
  let currentData = [];
  const liked = /* @__PURE__ */ new Set();
  const saved = /* @__PURE__ */ new Set();
  const hydrateAvatars = () => root.querySelectorAll(".yuzi-theater-diary-avatar").forEach((avatar) => {
    const name = avatar.dataset.avatarName;
    if (!name) return;
    context.presetAssets.getUrl(avatarSlot(name)).then((url) => {
      if (disposed || !avatar.isConnected) return;
      avatar.dataset.hasImage = url ? "true" : "false";
      avatar.style.backgroundImage = url ? `url("${url}")` : "";
      avatar.textContent = url ? "" : surname(name);
    }).catch(() => {
    });
  });
  page.dataset.theme = context.theme.mode;
  const render = (state = context.getState()) => {
    if (disposed || !state) return;
    root.querySelector("#yuzi-theater-diary-prev").disabled = !state.canPrevious;
    root.querySelector("#yuzi-theater-diary-next").disabled = !state.canNext;
    currentData = records(state).map((record, index) => ({ record, key: `${clean(record["角色"]) || "匿名"}|${clean(record["日期"]) || "无日期"}|${clean(record["内容"])}|${index}` }));
    const ordered = [...currentData].sort((a, b) => Number(saved.has(b.key)) - Number(saved.has(a.key)));
    list.replaceChildren();
    if (ordered.length) {
      const groups = /* @__PURE__ */ new Map();
      ordered.forEach((item) => {
        const name = clean(item.record["角色"]) || "匿名";
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(item);
      });
      groups.forEach((items, name) => {
        const group = document.createElement("section");
        group.className = "yuzi-theater-diary-person-group";
        group.dataset.diaryPerson = name;
        group.append(Object.assign(document.createElement("h2"), { className: "yuzi-theater-diary-person-title", textContent: `${name}的小日记` }));
        items.forEach((item) => group.append(card(item.record, item.key, liked.has(item.key), saved.has(item.key))));
        list.append(group);
      });
    } else list.append(Object.assign(document.createElement("p"), { className: "yuzi-theater-diary-empty", textContent: "暂无小日记内容" }));
    hydrateAvatars();
  };
  const click = (event) => {
    const action = event.target.closest?.("[data-action]");
    if (action && !action.disabled) void context.actions[action.dataset.action]?.();
  };
  page.addEventListener("click", click);
  const avatarChange = () => hydrateAvatars();
  globalThis.addEventListener?.("yuzi-character-avatar-change", avatarChange);
  globalThis.addEventListener?.("focus", avatarChange);
  const unsubscribe = context.subscribe(render);
  render();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    page.removeEventListener("click", click);
    globalThis.removeEventListener?.("yuzi-character-avatar-change", avatarChange);
    globalThis.removeEventListener?.("focus", avatarChange);
    context.signal.removeEventListener("abort", dispose);
    unsubscribe();
  };
  context.signal.addEventListener("abort", dispose, { once: true });
  return dispose;
}
