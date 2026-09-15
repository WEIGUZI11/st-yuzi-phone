import { buildPhoneNavBar, buildPhoneBackButton, buildPhoneSwitchButton } from '../../phone-core/navigation-ui.js';
import { escapeHtml } from '../../utils/dom-escape.js';
const escapeRecord = record => Object.fromEntries(Object.entries(record).map(([key,value]) => [key, typeof value === 'string' ? escapeHtml(value) : value]));
// pages/yuzi-theater-forum/mount.js
var FIELDS = ["分区/版面名", "发帖账号名", "账号标签", "帖子标题", "帖子正文", "附加信息", "评论串", "热度/回应数据", "时间文本"];
var clean = (value) => String(value ?? "").normalize("NFKC").trim();
var split = (value) => clean(value).split(/[;；]/).map(clean).filter(Boolean);
var initials = (value) => [...clean(value)][0] || "匿";
var interaction = (value) => clean(value).match(/\d+(?:\.\d+)?[wk万千]?/i)?.[0] || "0";
var icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
var SAFE_TOP_STYLE = "";
var FORUM_LAYOUT_STYLE = "";
const FEED_NAV = buildPhoneNavBar({
  className: 'yuzi-phone-theater-nav yuzi-theater-forum-feed-nav',
  leadingHtml: buildPhoneBackButton({action:'back', label:'返回上一层'}),
  centerHtml: '<nav class="yuzi-theater-forum-tabs">'
    + buildPhoneSwitchButton('previous', {action:'previousTable', label:'上一张表', attributes:{id:'yuzi-theater-forum-prev'}})
    + '<button class="yuzi-theater-forum-tab is-active" data-feed-tab type="button">发现</button><button class="yuzi-theater-forum-tab" data-feed-tab type="button">关注</button>'
    + buildPhoneSwitchButton('next', {action:'nextTable', label:'下一张表', attributes:{id:'yuzi-theater-forum-next'}})
    + '</nav>',
  trailingHtml: '<div class="yuzi-theater-forum-actions">'
    + '<button class="yuzi-theater-forum-icon" data-action="editCurrentTable" type="button" aria-label="编辑当前表">' + icon('M12 20H4v-8 M16 4l4 4-9 9-4 1 1-4Z') + '</button>'
    + '<button class="yuzi-theater-forum-icon" data-local-action type="button" aria-label="搜索">' + icon('M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14Z M16 16l4 4') + '</button></div>',
});
var TEMPLATE = `<section class="yuzi-theater-forum"><section id="yuzi-theater-forum-feed" class="yuzi-theater-forum-feed"><header class="yuzi-theater-forum-top">${FEED_NAV}<div class="yuzi-theater-forum-categories"><button class="yuzi-theater-forum-category is-active" data-category type="button">推荐</button><button class="yuzi-theater-forum-category" data-category type="button">视频</button><button class="yuzi-theater-forum-category" data-category type="button">直播</button><button class="yuzi-theater-forum-category" data-category type="button">短剧</button><button class="yuzi-theater-forum-category" data-category type="button">游戏</button><button class="yuzi-theater-forum-category" data-category type="button">情感</button></div></header><main class="yuzi-theater-forum-main"><section id="yuzi-theater-forum-grid" class="yuzi-theater-forum-grid"></section></main><nav class="yuzi-theater-forum-bottom"><button class="yuzi-theater-forum-bottom-item is-active" data-local-action type="button">${icon("M3 11l9-7 9 7v9h-6v-6H9v6H3z")}<span>首页</span></button><button class="yuzi-theater-forum-bottom-item" data-local-action type="button">${icon("M4 7h16l-1 13H5z M8 7V4h8v3")}<span>市集</span></button><button class="yuzi-theater-forum-bottom-item" data-local-action type="button"><span class="yuzi-theater-forum-add">${icon("M12 6v12 M6 12h12")}</span></button><button class="yuzi-theater-forum-bottom-item" data-local-action type="button">${icon("M4 5h16v12H8l-4 3z")}<span>消息</span></button><button class="yuzi-theater-forum-bottom-item" data-local-action type="button">${icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0")}<span>我</span></button></nav></section><section id="yuzi-theater-forum-detail" class="yuzi-theater-forum-detail" hidden></section></section>`;
function records(state) {
  const map = new Map((state?.headers || []).map((header, index) => [clean(header), index]));
  return (state?.rows || []).map((row, index) => ({ index, ...Object.fromEntries(FIELDS.map((field) => [field, clean(row[map.get(field)] ?? "")])) }));
}
function comments(value) {
  return split(value).map((item) => {
    const point = item.search(/[:：]/);
    return point < 0 ? { author: "网友", body: item } : { author: clean(item.slice(0, point)) || "网友", body: clean(item.slice(point + 1)) || "..." };
  });
}
function renderCard(record) {
  record = escapeRecord(record);
  const card = document.createElement("article");
  card.tabIndex = 0; card.setAttribute("role", "button");
  card.className = "yuzi-theater-forum-card";
  card.type = "button";
  card.dataset.postIndex = String(record.index);
  card.innerHTML = `<div class="yuzi-theater-forum-cover" data-image-canvas="cover" data-record-index="${record.index}">${record["分区/版面名"] || "DISCOVER"}</div><h2 class="yuzi-theater-forum-card-title">${record["帖子标题"] || "未命名帖子"}</h2><div class="yuzi-theater-forum-card-meta"><span class="yuzi-theater-forum-avatar">${initials(record["发帖账号名"])}</span><span class="yuzi-theater-forum-author">${record["发帖账号名"] || "匿名用户"}</span><span class="yuzi-theater-forum-like">${icon("M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z")}${interaction(record["热度/回应数据"])}</span></div>`;
  return card;
}
function detailMarkup(record) {
  record = escapeRecord(record);
  const replies = comments(record["评论串"]);
  const topics = split(record["附加信息"]).map((value) => `<span class="yuzi-theater-forum-topic">${value.startsWith("#") ? value : `#${value}`}</span>`).join("");
  const commentList = replies.map((reply) => `<article class="yuzi-theater-forum-comment"><span class="yuzi-theater-forum-avatar">${initials(reply.author)}</span><div><strong>${reply.author}</strong><p>${reply.body}</p></div></article>`).join("");
  return `${buildPhoneNavBar({className:'yuzi-phone-theater-nav yuzi-theater-forum-detail-nav',leadingHtml:buildPhoneBackButton({label:'返回帖子列表',attributes:{'data-detail-back':''}}),centerHtml:`<div class="yuzi-theater-forum-detail-author"><span class="yuzi-theater-forum-avatar">${initials(record["发帖账号名"])}</span><span class="yuzi-theater-forum-detail-name"><strong>${record["发帖账号名"] || "匿名用户"}</strong><span>${record["账号标签"] || record["时间文本"] || "论坛用户"}</span></span></div>`,trailingHtml:'<button class="yuzi-theater-forum-follow" data-local-action type="button">关注</button>'})}<div class="yuzi-theater-forum-hero" data-image-canvas="cover" data-record-index="${record.index}">${record["分区/版面名"] || "图文主图"}</div><article class="yuzi-theater-forum-article"><h1 class="yuzi-theater-forum-detail-title">${record["帖子标题"] || "未命名帖子"}</h1><p class="yuzi-theater-forum-detail-body">${record["帖子正文"] || "暂无正文内容"}</p><div class="yuzi-theater-forum-topics">${topics}</div><p class="yuzi-theater-forum-detail-stats">${[record["热度/回应数据"], record["时间文本"]].filter(Boolean).join(" · ")}</p></article><section class="yuzi-theater-forum-comments"><h3>评论 ${replies.length}</h3><div class="yuzi-theater-forum-comment-list">${commentList}</div></section><footer class="yuzi-theater-forum-detail-bottom"><button class="yuzi-theater-forum-comment-input" data-detail-action="comment" type="button">${icon("M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z")}<span>说点什么</span></button><div class="yuzi-theater-forum-detail-social"><button class="yuzi-theater-forum-social-button" data-detail-action="like" type="button" aria-label="点赞">${icon("M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z")}<span data-social-count>${interaction(record["热度/回应数据"])}</span></button><button class="yuzi-theater-forum-social-button" data-detail-action="collect" type="button" aria-label="收藏">${icon("M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z")}<span>收藏</span></button><button class="yuzi-theater-forum-social-button" data-detail-action="comment" type="button" aria-label="评论">${icon("M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z")}<span>${replies.length}</span></button></div></footer>`;
}
export function mount(context) {
  const root = context.root;
  root.innerHTML = TEMPLATE + SAFE_TOP_STYLE + FORUM_LAYOUT_STYLE;
  const page = root.querySelector(".yuzi-theater-forum");
  const feed = root.querySelector("#yuzi-theater-forum-feed");
  const detail = root.querySelector("#yuzi-theater-forum-detail");
  const grid = root.querySelector("#yuzi-theater-forum-grid");
  const categories = root.querySelector(".yuzi-theater-forum-categories");
  ["穿搭", "美食", "音乐"].forEach((label) => {
    const button = document.createElement("button");
    button.className = "yuzi-theater-forum-category";
    button.dataset.category = "";
    button.type = "button";
    button.textContent = label;
    categories.append(button);
  });
  let data = [];
  let disposed = false;
  page.dataset.theme = context.theme.mode;
  const render = (state = context.getState()) => {
    if (disposed || !state) return;
    data = records(state);
    root.querySelector("#yuzi-theater-forum-prev").disabled = !state.canPrevious;
    root.querySelector("#yuzi-theater-forum-next").disabled = !state.canNext;
    detail.hidden = true;
    detail.replaceChildren();
    feed.hidden = false;
    grid.replaceChildren(...data.length ? data.map(renderCard) : [Object.assign(document.createElement("p"), { className: "yuzi-theater-forum-empty", textContent: "暂无论坛帖子" })]);
    context.mountImages();
  };
  const click = (event) => {
    const action = event.target.closest?.("[data-action]");
    if (action && !action.disabled) {
      void context.actions[action.dataset.action]?.();
      return;
    }
    const tab = event.target.closest?.("[data-feed-tab]");
    if (tab) {
      page.querySelectorAll("[data-feed-tab]").forEach((item) => item.classList.toggle("is-active", item === tab));
      return;
    }
    const category = event.target.closest?.("[data-category]");
    if (category) {
      page.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("is-active", item === category));
      return;
    }
    const card = event.target.closest?.("[data-post-index]");
    if (card) {
      const record = data.find((item) => item.index === Number(card.dataset.postIndex));
      if (record) {
        detail.innerHTML = detailMarkup(record);
        feed.hidden = true;
        detail.hidden = false;
        detail.scrollTop = 0;
        context.mountImages();
      }
      return;
    }
    if (event.target.closest?.("[data-detail-back]")) {
      detail.hidden = true;
      detail.replaceChildren();
      feed.hidden = false;
      context.mountImages();
      return;
    }
  };
  const keydown = event => { if(event.key === 'Enter' && event.target.matches('[data-post-index]')) { event.preventDefault(); event.target.click(); } };
  page.addEventListener('keydown', keydown);
  page.addEventListener("click", click);
  const unsubscribe = context.subscribe(render);
  render();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    page.removeEventListener('keydown', keydown);
    page.removeEventListener("click", click);
    context.signal.removeEventListener("abort", dispose);
    unsubscribe();
  };
  context.signal.addEventListener("abort", dispose, { once: true });
  return dispose;
}
