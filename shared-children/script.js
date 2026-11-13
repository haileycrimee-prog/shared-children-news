"use strict";

const GAME_CONFIG = Object.freeze({
  // 游戏完成后返回完整新闻专题首页。
  NEWS_URL: "https://haileycrimee-prog.github.io/shared-children-news/",
});

const INITIAL_STATE = Object.freeze({
  scene: "opening",
  elderTrust: 0,
  familyTrust: 0,
  acceptedGift: false,
  serviceActive: true,
});

const gameState = { ...INITIAL_STATE };

const root = document.querySelector("#game-root");
const header = document.querySelector("#game-header");
const progressLabel = document.querySelector("#progress-label");
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const trustDock = document.querySelector("#trust-dock");
const trustStars = document.querySelector("#trust-stars");
const trustCount = document.querySelector("#trust-count");
const trustDelta = document.querySelector("#trust-delta");
const liveRegion = document.querySelector("#scene-live");
let pendingTrustChange = null;

const SCENE_PROGRESS = {
  opening: null,
  firstVisit: 1,
  visitFailedPlatform: 1,
  visitFailedCare: 1,
  trustDay3: 2,
  trustDay3Duck: 2,
  trustDay3Dish: 2,
  trustDay3Travel: 2,
  trustDay7: 2,
  trustDay7Gaming: 2,
  trustDay7Cats: 2,
  trustDay7Tea: 2,
  trustDay12: 2,
  trustDay12Accepted: 2,
  gift: 3,
  giftAccepted: 3,
  giftRejected: 3,
  giftConsulted: 3,
  boundaryDirect: 3,
  replacementAccepted: 4,
  replacementRejected: 4,
  replacementConsulted: 4,
  replacementBoundary: 4,
  endingAccepted: 5,
  endingRejected: 5,
  endingConsulted: 5,
  endingBoundary: 5,
};

const SCENE_ANNOUNCEMENTS = {
  opening: "体验开场。你将扮演一名共享儿女服务人员。",
  firstVisit: "第一次上门。王奶奶隔着门问：谁啊？请选择如何介绍自己。",
  visitFailedPlatform: "王奶奶不熟悉平台服务人员，服务未能开始。",
  visitFailedCare: "王奶奶拒绝接受照顾，服务未能开始。",
  trustDay3: "第三次服务。王奶奶开始记住你的细心。",
  trustDay3Duck: "你给王奶奶带了酱鸭，她记住了你的细心。",
  trustDay3Dish: "你买了王奶奶爱吃的菜，她记住了你的细心。",
  trustDay3Travel: "你网购了王奶奶旅游时尝过的美食，她记住了你的细心。",
  trustDay7: "第七次服务。王奶奶想知道你喜欢什么。",
  trustDay7Gaming: "你告诉王奶奶自己喜欢打游戏，她试着理解年轻人的喜好。",
  trustDay7Cats: "你告诉王奶奶自己喜欢小猫，她试着理解年轻人的喜好。",
  trustDay7Tea: "你告诉王奶奶自己喜欢喝茶，她说要送一些老家茶叶。",
  trustDay12: "第十二次服务。王奶奶问能不能在有事时直接给你打电话。",
  trustDay12Accepted: "你答应王奶奶可以随时打电话，她把你当成自己的孩子。",
  gift: "服务结束后，王奶奶拿出一袋茶叶，请你收下。",
  giftAccepted: "你接受了茶叶。家属信任下降，服务被终止。",
  giftRejected: "你拒绝了茶叶。服务边界得到保持，王奶奶有些失落。",
  giftConsulted: "你询问了家属。沟通后，服务继续。",
  boundaryDirect: "你请王奶奶有事联系女儿，王女士明确了服务时间之外的边界。",
  replacementAccepted: "服务人员由小陈更换为小李。王奶奶需要重新建立信任。",
  replacementRejected: "平台调整服务人员。王奶奶需要和新服务人员小李重新建立信任。",
  replacementConsulted: "平台调整服务人员。王奶奶需要和新服务人员小李重新建立信任。",
  replacementBoundary: "平台调整服务人员。王奶奶需要和新服务人员小李重新建立信任。",
  endingAccepted: "体验结束。你经历了信任、边界和服务关系中断。",
  endingRejected: "体验结束。你经历了信任、边界和服务关系中断。",
  endingConsulted: "体验结束。你经历了信任、边界和服务关系中断。",
  endingBoundary: "体验结束。你经历了信任、边界和服务关系中断。",
};

function stars(value) {
  const safeValue = Math.max(0, Math.min(5, Number(value) || 0));
  return "★".repeat(safeValue) + "☆".repeat(5 - safeValue);
}

function setElderTrust(value) {
  const from = gameState.elderTrust;
  const to = Math.max(0, Math.min(5, Number(value) || 0));
  gameState.elderTrust = to;
  pendingTrustChange = { from, to, delta: to - from };
}

function changeElderTrust(delta) {
  setElderTrust(gameState.elderTrust + delta);
}

function art(src, alt, options = {}) {
  const classes = ["scene-art"];
  if (options.opening) classes.push("scene-art--opening");
  if (options.wide) classes.push("scene-art--wide");
  const imageSource = src.startsWith("data:") ? src : `./assets/images/${src}`;

  return `
    <figure class="${classes.join(" ")}">
      <img src="${imageSource}" alt="${alt}" />
      <figcaption class="art-caption">${options.caption || "场景示意"}</figcaption>
    </figure>
  `;
}

function dialogue(speaker, lines) {
  const lineHtml = lines.map((line) => `<p class="dialogue__line">${line}</p>`).join("");
  return `
    <div class="dialogue">
      <p class="dialogue__speaker">${speaker}</p>
      ${lineHtml}
    </div>
  `;
}

function choiceList(action, choices) {
  return `
    <div class="choice-list" aria-label="请选择回应">
      ${choices
        .map(
          ({ key, label, choice }) => `
            <button
              class="choice-button"
              type="button"
              data-action="${action}"
              data-choice="${choice}"
              aria-label="${key}，${label}"
            >
              <span class="choice-key" aria-hidden="true">${key}</span>
              <span>${label}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function giftChoiceList() {
  const choices = [
    ["A", "谢谢奶奶，那我就收下了。", "accept"],
    ["B", "谢谢奶奶，但是这个我不能收。", "reject"],
    ["C", "如果您一定要送，我先问问您女儿。", "consult"],
  ];

  return `
    <div class="choice-list" aria-label="请选择怎样处理茶叶">
      ${choices
        .map(
          ([key, label, choice]) => `
            <button
              class="choice-button"
              type="button"
              data-action="gift-choice"
              data-choice="${choice}"
              aria-label="${key}，${label}"
            >
              <span class="choice-key" aria-hidden="true">${key}</span>
              <span>${label}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function trustRow(label, value, transition) {
  const change =
    transition && transition.from !== transition.to
      ? `<span class="trust-change">${stars(transition.from)} → ${stars(transition.to)}</span>`
      : "";

  return `
    <div class="trust-row">
      <span class="trust-label">${label}</span>
      <span class="trust-value">
        <span class="trust-stars" aria-hidden="true">${stars(value)}</span>
        <span class="sr-only">${value} 星，共 5 星</span>
        ${change}
      </span>
    </div>
  `;
}

function trustPanel({ elder, family = null, elderTransition = null, familyTransition = null }) {
  return `
    <div class="card trust-panel" aria-label="当前信任状态">
      ${elder !== null ? trustRow("老人信任度", elder, elderTransition) : ""}
      ${family !== null ? trustRow("家属信任度", family, familyTransition) : ""}
    </div>
  `;
}

function statusStrip(text, tone = "neutral", label = "服务状态") {
  return `
    <div class="status-strip status-strip--${tone}">
      <span class="status-strip__label">${label}</span>
      <span>${text}</span>
    </div>
  `;
}

function newsCard({ title, body }) {
  return `
    <article class="news-card">
      <p class="news-card__eyebrow">新闻提示</p>
      <h3 class="news-card__title">${title}</h3>
      <p class="news-card__body">${body}</p>
    </article>
  `;
}

function primaryButton(action, label) {
  return `<button class="primary-button" type="button" data-action="${action}">${label}</button>`;
}

function pageShell(className, content) {
  return `
    <section class="scene-page ${className}">
      <div class="scene-main">${content}</div>
    </section>
  `;
}

function renderOpening() {
  return pageShell(
    "scene-page--opening",
    `
      ${art(
        "v3-home.svg",
        "安静的老人住宅，桌上有一杯茶、药盒、老花镜和手机，窗边留着一把空椅子。",
        { opening: true, caption: "一个普通的下午" },
      )}
      <div class="opening-heading">
        <h1 class="opening-title" tabindex="-1">共享儿女</h1>
        <p class="opening-subtitle">一次关于信任的服务体验</p>
      </div>
      <div class="opening-copy">
        <p>
          近年来，一些年轻人开始成为老年人身边的“共享儿女”“社区儿女”。
          他们提供陪伴、买菜、家务、陪诊等帮助，也为传统家庭养老提供了一种补充。
        </p>
        <p>
          但当陌生人开始承担“儿女”的角色，信任和边界，也成为新的问题。
        </p>
        <p class="question">今天，你将走进王奶奶的家。</p>
      </div>
      <div class="action-row">
        ${primaryButton("start-game", "开始体验 <span aria-hidden=\"true\">▶</span>")}
        <p class="scene-footer-note">约 3–5 分钟 · 虚构人物与服务场景</p>
      </div>
    `,
  );
}

function renderFirstVisit() {
  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 01 · 第一次上门</p>
        <h2 class="scene-title" tabindex="-1">你是谁？</h2>
      </div>
      ${art(
        "v3-first-visit.svg",
        "第一次上门，小陈站在王奶奶家门口，王奶奶从门内谨慎地看向他。",
        { caption: "王奶奶家门外" },
      )}
      <section class="card service-card" aria-label="今日服务订单">
        <div class="service-card__top">
          <div>
            <p class="service-card__eyebrow">今日服务订单</p>
            <h3 class="service-card__name">王奶奶 · 78 岁</h3>
          </div>
          <span class="service-card__tag">独居</span>
        </div>
        <dl class="service-card__details">
          <div>
            <dt>服务内容</dt>
            <dd>陪伴聊天、买菜、简单家务</dd>
          </div>
          <div>
            <dt>委托人</dt>
            <dd>王女士</dd>
          </div>
          <div>
            <dt>服务时长</dt>
            <dd>2 小时</dd>
          </div>
          <div>
            <dt>你的身份</dt>
            <dd>服务人员小陈</dd>
          </div>
        </dl>
      </section>
      ${dialogue("王奶奶", ["谁啊？"])}
      <p class="prompt">你该怎么回答？</p>
      ${choiceList("first-visit-choice", [
        { key: "A", label: "您好，我是平台安排的服务人员。", choice: "platform" },
        { key: "B", label: "您好，我是您女儿的朋友。", choice: "friend" },
        { key: "C", label: "您好，我是来照顾您的。", choice: "care" },
      ])}
    `,
  );
}

function renderVisitFailure(kind) {
  const content =
    kind === "platform"
      ? {
          title: "门没有打开",
          lines: ["平台？我不认识你。", "不用了，我不需要。"],
        }
      : {
          title: "谨慎没有消失",
          lines: ["我不需要别人照顾。", "你找错地方了吧？"],
        };

  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 01 · 服务未能开始</p>
        <h2 class="scene-title" tabindex="-1">${content.title}</h2>
      </div>
      ${art(
        "v3-first-visit.svg",
        "王奶奶没有开门，仍然在门内谨慎地向外看。",
        { caption: "第一次见面" },
      )}
      ${dialogue("王奶奶", content.lines)}
      ${statusStrip("× 服务未能开始", "warning")}
      ${newsCard({
        title: "信任难建立",
        body:
          "对部分老人来说，“共享儿女”仍然是一种陌生的服务身份。即使服务由子女安排，老人也可能因为不熟悉、不信任陌生人而拒绝服务。",
      })}
      <div class="action-row">
        ${primaryButton("retry-first-visit", "重新尝试")}
      </div>
    `,
  );
}

function renderTrustDay3() {
  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 02 · 逐渐建立信任</p>
        <h2 class="scene-title" tabindex="-1">慢慢熟悉</h2>
      </div>
      <div class="day-marker"><span>03</span> 第 3 次服务</div>
      ${art(
        "v3-food.svg",
        "小陈提着装有饭菜的纸袋来到王奶奶家，准备询问她喜欢吃什么。",
        { wide: true, caption: "第三次服务" },
      )}
      ${dialogue("王奶奶", ["小陈，你来了。"])}
      <p class="prompt">这次上门，你给王奶奶带了什么？</p>
      ${choiceList("food-choice", [
        { key: "A", label: "我给您带了酱鸭。", choice: "duck" },
        { key: "B", label: "我买了您爱吃的菜。", choice: "dish" },
        {
          key: "C",
          label: "上次您说去旅游吃的美食吃不到了，我给您网购了一些。",
          choice: "travel",
        },
      ])}
    `,
  );
}

function renderTrustDay3Response(choice) {
  const playerLines = {
    duck: "我给您带了酱鸭。",
    dish: "我买了您爱吃的菜。",
    travel: "上次您说去旅游吃的美食吃不到了，我给您网购了一些。",
  };

  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 02 · 逐渐建立信任</p>
        <h2 class="scene-title" tabindex="-1">慢慢熟悉</h2>
      </div>
      <div class="day-marker"><span>03</span> 第 3 次服务</div>
      ${art(
        "v3-food.svg",
        "小陈带来的食物放在桌上，王奶奶因他记得自己的口味而露出笑意。",
        { wide: true, caption: "第三次服务" },
      )}
      ${dialogue("小陈", [playerLines[choice]])}
      ${dialogue("王奶奶", ["你还记得我喜欢吃什么，挺细心的。"])}
      <div class="action-row">${primaryButton("trust-next-day3", "继续服务")}</div>
    `,
  );
}

function renderTrustDay7() {
  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 02 · 逐渐建立信任</p>
        <h2 class="scene-title" tabindex="-1">一点点靠近</h2>
      </div>
      <div class="day-marker"><span>07</span> 第 7 次服务</div>
      ${art(
        "v3-hobbies.svg",
        "王奶奶和小陈坐在桌边，桌上摆着游戏手柄、猫咪杯垫和茶叶罐。",
        { wide: true, caption: "第七次服务" },
      )}
      ${dialogue("王奶奶", ["小陈，你问了这么多我的喜好，我还不知道你喜欢什么？"])}
      <p class="prompt">你会怎么回答？</p>
      ${choiceList("preference-choice", [
        { key: "A", label: "我喜欢打游戏。", choice: "gaming" },
        { key: "B", label: "我喜欢小猫猫。", choice: "cats" },
        { key: "C", label: "我喜欢喝茶。", choice: "tea" },
      ])}
    `,
  );
}

function renderTrustDay7Response(choice) {
  const playerLines = {
    gaming: "我喜欢打游戏。",
    cats: "我喜欢小猫猫。",
    tea: "我喜欢喝茶。",
  };
  const elderLines =
    choice === "tea"
      ? ["我这有一些老家寄来的茶叶，改天给你拿一点。"]
      : ["哦，是你们年轻人喜欢的……挺好。"];

  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 02 · 逐渐建立信任</p>
        <h2 class="scene-title" tabindex="-1">一点点靠近</h2>
      </div>
      <div class="day-marker"><span>07</span> 第 7 次服务</div>
      ${art(
        "v3-hobbies.svg",
        "王奶奶听小陈讲自己的喜好，两人在桌边继续聊天。",
        { wide: true, caption: "第七次服务" },
      )}
      ${dialogue("小陈", [playerLines[choice]])}
      ${dialogue("王奶奶", elderLines)}
      <div class="action-row">${primaryButton("trust-next-day7", "继续服务")}</div>
    `,
  );
}

function renderTrustDay12() {
  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 02 · 逐渐建立信任</p>
        <h2 class="scene-title" tabindex="-1">“像自己孩子一样”</h2>
      </div>
      <div class="day-marker"><span>12</span> 第 12 次服务</div>
      ${art(
        "v3-phone-ask.svg",
        "王奶奶坐在窗边拿着手机，询问小陈以后能否直接给他打电话。",
        { wide: true, caption: "第十二次服务" },
      )}
      ${dialogue("王奶奶", ["以后如果我有什么事情，可以直接给你打电话吗？"])}
      <p class="prompt">你会怎么回应？</p>
      ${choiceList("contact-choice", [
        { key: "A", label: "当然了，您直接打给我就行。", choice: "call" },
        {
          key: "B",
          label: "我平时也挺忙的，您有事还是找您女儿吧。",
          choice: "daughter",
        },
      ])}
    `,
  );
}

function renderTrustDay12Accepted() {
  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 02 · 逐渐建立信任</p>
        <h2 class="scene-title" tabindex="-1">“像自己孩子一样”</h2>
      </div>
      <div class="day-marker"><span>12</span> 第 12 次服务</div>
      ${art(
        "v3-phone-trust.svg",
        "王奶奶听到小陈愿意随时接电话，神情明显安心下来。",
        { wide: true, caption: "第十二次服务" },
      )}
      ${dialogue("小陈", ["当然了，您直接打给我就行。"])}
      ${dialogue("王奶奶", ["那就好。", "我现在觉得你就跟自己孩子一样。"])}
      <div class="notice">你已经获得王奶奶的高度信任。信任继续加深，也会让下一步变得复杂。</div>
      <div class="action-row">${primaryButton("trust-next-day12", "继续")}</div>
    `,
  );
}

function renderBoundaryDirect() {
  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 03 · 关系需要边界</p>
        <h2 class="scene-title" tabindex="-1">关系需要边界</h2>
      </div>
      ${art(
        "v3-family-boundary.svg",
        "王奶奶理解了小陈的忙碌，桌上的手机显示王女士正在联系。",
        { wide: true, caption: "服务时间之外" },
      )}
      ${dialogue("王奶奶", ["哦，我理解。你们年轻人都是很忙的。"])}
      ${dialogue("王女士", ["您服务时间之外的事交给我们就行。"])}
      ${trustPanel({ elder: null, family: 4 })}
      ${statusStrip("✓ 服务继续", "success")}
      ${newsCard({
        title: "关系需要边界",
        body:
          "当服务涉及老人的私人生活时，老人、家属和服务人员之间需要更多沟通。但现实中，哪些事情属于正常服务，哪些事情需要家属同意，并不总是十分明确。",
      })}
      <div class="action-row">${primaryButton("boundary-next", "继续")}</div>
    `,
  );
}

function renderGift() {
  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 03 · 送茶与服务边界</p>
        <h2 class="scene-title" tabindex="-1">一份特产</h2>
      </div>
      ${art(
        "v3-tea-gift.svg",
        "服务结束时，王奶奶把一盒老家寄来的茶叶递给小陈。",
        { caption: "服务结束前" },
      )}
      ${dialogue("王奶奶", [
        "这是我老家寄来的茶叶，你拿一点回去吧。",
        "你照顾我这么久，不能空着手走。",
      ])}
      <p class="prompt">你准备怎么做？</p>
      ${giftChoiceList()}
    `,
  );
}

function renderGiftAccepted() {
  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 03 · 关系越过界线</p>
        <h2 class="scene-title" tabindex="-1">三天后</h2>
      </div>
      ${dialogue("王奶奶", ["这就对了嘛。"])}
      ${statusStrip("× 服务关系异常", "warning", "平台提醒")}
      <div class="message-stack" aria-label="王女士发来的消息">
        <p class="chat-line">你和我父母走得太近了。</p>
        <p class="chat-line">我知道你对他们不错，但你已经超出了正常的服务关系。</p>
        <p class="chat-line">以后不要再私下联系他们。如果平台不处理，我会投诉。</p>
      </div>
      ${trustPanel({ elder: null, family: 0 })}
      ${statusStrip("× 已终止", "warning")}
      ${newsCard({
        title: "当服务变成“亲情”",
        body:
          "长期陪伴可能让老人和服务人员形成较强的情感联系。但老人、家属和服务人员对“合适的关系距离”可能有不同理解。服务人员应该和老人亲近到什么程度？目前并没有一个简单答案。",
      })}
      <div class="action-row">${primaryButton("gift-next", "继续")}</div>
    `,
  );
}

function renderGiftRejected() {
  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 03 · 保持服务边界</p>
        <h2 class="scene-title" tabindex="-1">留下的距离</h2>
      </div>
      ${dialogue("王奶奶", ["就是一点茶叶，又不是什么贵重东西。", "好吧。"])}
      ${dialogue("小陈", ["这是我的工作，我还是不收了。"])}
      ${trustPanel({ elder: null, family: 4 })}
      ${statusStrip("✓ 服务继续", "success")}
      ${newsCard({
        title: "保持服务边界",
        body:
          "拒绝私人馈赠可以降低部分家庭矛盾，但也可能让老人感受到服务关系的“距离”。对服务人员来说，保持边界并不意味着没有情感；但对老人来说，这种边界有时并不容易理解。",
      })}
      <div class="action-row">${primaryButton("gift-next", "继续")}</div>
    `,
  );
}

function renderGiftConsulted() {
  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 03 · 把选择告诉家属</p>
        <h2 class="scene-title" tabindex="-1">关系需要边界</h2>
      </div>
      ${dialogue("王奶奶", ["送你一点东西，还要问她吗？"])}
      ${dialogue("小陈", ["我只是想让大家都放心。"])}
      <div class="message-stack" aria-label="王女士发来的消息">
        <p class="chat-line">谢谢你提前告诉我。</p>
        <p class="chat-line">以后如果还有类似情况，先和我们沟通就好。</p>
      </div>
      ${trustPanel({ elder: null, family: 4 })}
      ${statusStrip("✓ 服务继续", "success")}
      ${newsCard({
        title: "关系需要边界",
        body:
          "当服务涉及老人的私人生活时，老人、家属和服务人员之间需要更多沟通。但现实中，哪些事情属于正常服务，哪些事情需要家属同意，并不总是十分明确。",
      })}
      <div class="action-row">${primaryButton("gift-next", "继续")}</div>
    `,
  );
}

function renderReplacement(variant) {
  const familyVisible = variant !== "Accepted";
  const familyValue =
    variant === "Rejected" || variant === "Consulted" || variant === "Boundary" ? 4 : null;

  return pageShell(
    "",
    `
      <div>
        <p class="scene-kicker">场景 04 · 服务人员更换</p>
        <h2 class="scene-title" tabindex="-1">又是一张陌生面孔</h2>
      </div>
      ${art(
        "v3-replacement.svg",
        "新服务人员小李来到王奶奶家门前，王奶奶问起原来的服务人员小陈。",
        { caption: "服务人员已更换" },
      )}
      <section class="card handoff" aria-label="服务人员由小陈更换为小李">
        <div class="handoff-person">
          <span class="avatar" aria-hidden="true"></span>
          <span>小陈</span>
          <small>原服务人员</small>
        </div>
        <span class="handoff-arrow" aria-hidden="true">→</span>
        <div class="handoff-person">
          <span class="avatar avatar--new" aria-hidden="true"></span>
          <span>小李</span>
          <small>新服务人员</small>
        </div>
      </section>
      ${dialogue("王奶奶", ["小陈呢？", "怎么又换人了？"])}
      ${dialogue("小李", ["您好，我是小李。以后由我负责您的服务。"])}
      ${familyVisible ? trustPanel({ elder: null, family: familyValue }) : ""}
      ${statusStrip("服务人员已更换", "neutral")}
      ${newsCard({
        title: "重新建立信任",
        body:
          "对平台而言，更换服务人员可能只是一次正常的人员调整。但对老人而言，每次更换都意味着重新认识陌生人、重新建立信任。如果服务关系频繁中断，老人可能很难获得稳定陪伴。",
      })}
      <div class="action-row">${primaryButton("replacement-next", "继续")}</div>
    `,
  );
}

function renderEnding(variant) {
  const branchText = {
    Accepted: "你接受了私人馈赠，服务关系因家属投诉而终止。",
    Rejected: "你拒绝了私人馈赠，守住了边界，也让王奶奶感到了一点距离。",
    Consulted: "你主动询问了家属，沟通让服务关系继续下去。",
    Boundary: "你请王奶奶有事联系女儿，王女士明确了服务时间之外的边界。",
  }[variant];

  return pageShell(
    "",
    `
      <div class="ending-intro">
        <p class="scene-kicker">体验结束</p>
        <h2 class="scene-title" tabindex="-1">“共享儿女”能成为真正的家人吗？</h2>
        <p class="lede">${branchText}</p>
      </div>
      ${art(
        "v3-ending.svg",
        "老人住宅窗边留着一把空椅子，晨光照进屋内，像在等待下一次有人来访。",
        { wide: true, caption: "王奶奶家" },
      )}
      ${trustPanel({ elder: null, family: gameState.familyTrust })}
      ${statusStrip(
        gameState.serviceActive ? "✓ 已有后续服务安排" : "× 原服务已终止",
        gameState.serviceActive ? "success" : "warning",
      )}
      <section class="issues" aria-labelledby="issues-title">
        <h2 class="scene-title" id="issues-title">你刚刚遇到</h2>
        <article class="card issue">
          <span class="issue__number" aria-hidden="true">01</span>
          <div>
            <h3>信任难建立</h3>
            <p>老人可能因为陌生而拒绝服务。</p>
          </div>
        </article>
        <article class="card issue">
          <span class="issue__number" aria-hidden="true">02</span>
          <div>
            <h3>服务边界模糊</h3>
            <p>长期陪伴可能让服务关系私人化，也可能引发家属的不信任。</p>
          </div>
        </article>
        <article class="card issue">
          <span class="issue__number" aria-hidden="true">03</span>
          <div>
            <h3>关系难以稳定</h3>
            <p>服务人员更换后，老人需要重新建立信任。</p>
          </div>
        </article>
      </section>
      ${dialogue("新闻结语", [
        "“共享儿女”不是简单地“找一个人照顾老人”。当陌生人开始承担“儿女”的角色，信任、情感和服务之间的边界，也变得更加复杂。",
      ])}
      <section class="card expert">
        <h3>共享儿女，如何走得更远？</h3>
        <p>
          专家建议：明确服务中的法律关系和权责边界；加强养老服务人才队伍建设；建立更加统一的行业服务规范。
        </p>
      </section>
      <div class="ending-actions">
        <button class="primary-button" type="button" data-action="read-article">
          继续阅读
        </button>
        <button class="secondary-button" type="button" data-action="restart-game">重新体验</button>
        <p class="inline-feedback" id="news-feedback" role="status"></p>
      </div>
    `,
  );
}

function renderScene() {
  let content;

  switch (gameState.scene) {
    case "opening":
      content = renderOpening();
      break;
    case "firstVisit":
      content = renderFirstVisit();
      break;
    case "visitFailedPlatform":
      content = renderVisitFailure("platform");
      break;
    case "visitFailedCare":
      content = renderVisitFailure("care");
      break;
    case "trustDay3":
      content = renderTrustDay3();
      break;
    case "trustDay3Duck":
      content = renderTrustDay3Response("duck");
      break;
    case "trustDay3Dish":
      content = renderTrustDay3Response("dish");
      break;
    case "trustDay3Travel":
      content = renderTrustDay3Response("travel");
      break;
    case "trustDay7":
      content = renderTrustDay7();
      break;
    case "trustDay7Gaming":
      content = renderTrustDay7Response("gaming");
      break;
    case "trustDay7Cats":
      content = renderTrustDay7Response("cats");
      break;
    case "trustDay7Tea":
      content = renderTrustDay7Response("tea");
      break;
    case "trustDay12":
      content = renderTrustDay12();
      break;
    case "trustDay12Accepted":
      content = renderTrustDay12Accepted();
      break;
    case "gift":
      content = renderGift();
      break;
    case "giftAccepted":
      content = renderGiftAccepted();
      break;
    case "giftRejected":
      content = renderGiftRejected();
      break;
    case "giftConsulted":
      content = renderGiftConsulted();
      break;
    case "boundaryDirect":
      content = renderBoundaryDirect();
      break;
    case "replacementAccepted":
      content = renderReplacement("Accepted");
      break;
    case "replacementRejected":
      content = renderReplacement("Rejected");
      break;
    case "replacementConsulted":
      content = renderReplacement("Consulted");
      break;
    case "replacementBoundary":
      content = renderReplacement("Boundary");
      break;
    case "endingAccepted":
      content = renderEnding("Accepted");
      break;
    case "endingRejected":
      content = renderEnding("Rejected");
      break;
    case "endingConsulted":
      content = renderEnding("Consulted");
      break;
    case "endingBoundary":
      content = renderEnding("Boundary");
      break;
    default:
      content = renderOpening();
  }

  root.innerHTML = content;
  updateHeader();
  moveFocus();
  announce(SCENE_ANNOUNCEMENTS[gameState.scene] || "");
}

function updateHeader() {
  const progress = SCENE_PROGRESS[gameState.scene];
  if (progress === null || progress === undefined) {
    header.hidden = true;
    return;
  }

  header.hidden = false;
  progressLabel.textContent = `${progress}/5`;
  progressTrack.setAttribute("aria-valuenow", String(progress));
  progressFill.style.width = `${progress * 20}%`;
  updateTrustDock();
}

function updateTrustDock() {
  const value = gameState.elderTrust;
  trustStars.textContent = stars(value);
  trustCount.textContent = `${value}/5`;
  trustDock.setAttribute("aria-label", `老人信任度：${value} 星，共 5 星`);
  trustDock.classList.remove("is-gain", "is-loss");

  const change = pendingTrustChange;
  pendingTrustChange = null;

  if (!change || change.delta === 0) {
    trustDelta.textContent = "";
    return;
  }

  const direction = change.delta > 0 ? "+" : "";
  trustDelta.textContent = `${direction}${change.delta}`;
  trustDock.classList.add(change.delta > 0 ? "is-gain" : "is-loss");
}

function moveFocus() {
  window.requestAnimationFrame(() => {
    const heading = root.querySelector("h1, h2");
    if (heading) heading.focus({ preventScroll: true });

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });
}

function announce(message) {
  liveRegion.textContent = "";
  window.setTimeout(() => {
    liveRegion.textContent = message;
  }, 40);
}

function setScene(scene) {
  gameState.scene = scene;
  renderScene();
}

function handleFirstVisitChoice(choice) {
  if (choice === "friend") {
    gameState.serviceActive = true;
    setScene("trustDay3");
    return;
  }

  gameState.serviceActive = false;
  setScene(choice === "platform" ? "visitFailedPlatform" : "visitFailedCare");
}

function handleFoodChoice(choice) {
  const responseScenes = {
    duck: "trustDay3Duck",
    dish: "trustDay3Dish",
    travel: "trustDay3Travel",
  };
  setElderTrust(1);
  setScene(responseScenes[choice]);
}

function handlePreferenceChoice(choice) {
  const responseScenes = {
    gaming: "trustDay7Gaming",
    cats: "trustDay7Cats",
    tea: "trustDay7Tea",
  };
  changeElderTrust(choice === "tea" ? 2 : 1);
  setScene(responseScenes[choice]);
}

function handleContactChoice(choice) {
  if (choice === "call") {
    changeElderTrust(3);
    setScene("trustDay12Accepted");
    return;
  }

  gameState.familyTrust = 4;
  setScene("boundaryDirect");
}

function handleGiftChoice(choice) {
  if (choice === "accept") {
    gameState.familyTrust = 0;
    gameState.acceptedGift = true;
    gameState.serviceActive = false;
    setScene("giftAccepted");
    return;
  }

  if (choice === "reject") {
    changeElderTrust(-2);
    gameState.familyTrust = 4;
    gameState.acceptedGift = false;
    gameState.serviceActive = true;
    setScene("giftRejected");
    return;
  }

  changeElderTrust(-1);
  gameState.familyTrust = 4;
  gameState.acceptedGift = false;
  gameState.serviceActive = true;
  setScene("giftConsulted");
}

function handleBoundaryNext() {
  setElderTrust(1);
  setScene("replacementBoundary");
}

function handleGiftNext() {
  const currentScene = gameState.scene;
  setElderTrust(1);

  if (currentScene === "giftAccepted") {
    setScene("replacementAccepted");
  } else if (currentScene === "giftRejected") {
    setScene("replacementRejected");
  } else {
    setScene("replacementConsulted");
  }
}

function handleReplacementNext() {
  const replacementScene = gameState.scene;
  if (replacementScene === "replacementAccepted") {
    setScene("endingAccepted");
  } else if (replacementScene === "replacementRejected") {
    setScene("endingRejected");
  } else if (replacementScene === "replacementBoundary") {
    setScene("endingBoundary");
  } else {
    setScene("endingConsulted");
  }
}

function resetGame() {
  Object.assign(gameState, INITIAL_STATE);
  pendingTrustChange = null;
  setScene("opening");
}

function openGiftScene() {
  if (gameState.elderTrust !== 5) return false;
  setScene("gift");
  return true;
}

function isNewsUrlConfigured() {
  const value = GAME_CONFIG.NEWS_URL.trim();
  if (!value) return false;

  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function handleNewsLink() {
  const feedback = document.querySelector("#news-feedback");

  if (!isNewsUrlConfigured()) {
    if (feedback) {
      feedback.textContent = "新闻正文地址尚未配置。请在 script.js 的 GAME_CONFIG.NEWS_URL 中填写。";
    }
    return;
  }

  window.location.assign(new URL(GAME_CONFIG.NEWS_URL, window.location.href).href);
}

root.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, choice } = button.dataset;

  switch (action) {
    case "start-game":
      setScene("firstVisit");
      break;
    case "first-visit-choice":
      handleFirstVisitChoice(choice);
      break;
    case "food-choice":
      handleFoodChoice(choice);
      break;
    case "preference-choice":
      handlePreferenceChoice(choice);
      break;
    case "contact-choice":
      handleContactChoice(choice);
      break;
    case "retry-first-visit":
      setElderTrust(0);
      gameState.serviceActive = true;
      setScene("firstVisit");
      break;
    case "trust-next-day3":
      setScene("trustDay7");
      break;
    case "trust-next-day7":
      setScene("trustDay12");
      break;
    case "trust-next-day12":
      openGiftScene();
      break;
    case "gift-choice":
      handleGiftChoice(choice);
      break;
    case "gift-next":
      handleGiftNext();
      break;
    case "boundary-next":
      handleBoundaryNext();
      break;
    case "replacement-next":
      handleReplacementNext();
      break;
    case "restart-game":
      resetGame();
      break;
    case "read-article":
      handleNewsLink();
      break;
    default:
      break;
  }
});

renderScene();
