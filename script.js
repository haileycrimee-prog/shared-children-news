"use strict";

(() => {
  document.documentElement.classList.add("js");

  const data = window.NEWS_CONTENT;
  const app = document.querySelector("#news-app");
  const statusRegion = document.querySelector("#page-status");
  const siteHeader = document.querySelector("#site-header");
  const navigationLinks = Array.from(
    document.querySelectorAll("[data-section-link]"),
  );

  if (!data || !app) {
    if (app) {
      app.innerHTML =
        '<p class="fatal-message">页面内容配置未能加载，请检查 content.js。</p>';
    }
    return;
  }

  const reduceMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  let activePerspectiveId = "elder";
  const activePersonIndices = {
    elder: 0,
    family: 0,
  };
  let personReaderController = null;
  let personPointerState = null;
  let personTransitioning = false;
  let suppressPersonClickUntil = 0;
  let mediaScroller = null;
  let progressScroller = null;
  let sectionOneVideoController = null;
  let sectionOneRevealObserver = null;
  let sectionThreeRevealObserver = null;
  let processStoryController = null;
  let sectionThreeIntroController = null;
  let sectionThreeClosingController = null;
  let activeSectionId = "section-01";
  let activeSectionPanel = null;

  const sectionIds = [
    "section-01",
    "section-02",
    "section-game",
    "section-03",
  ];
  const sectionNavigationIds = Object.freeze({
    "section-01": "section-01",
    "section-02": "section-02",
    "section-game": "section-02",
    "section-03": "section-03",
  });

  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character],
    );

  const paragraphs = (items = []) =>
    items.map((item) => `<p>${escapeHTML(item)}</p>`).join("");

  function safeUrl(value, fallback = "#") {
    if (!value) return fallback;

    try {
      const parsed = new URL(value, window.location.href);
      if (
        parsed.protocol === "http:" ||
        parsed.protocol === "https:" ||
        (parsed.protocol === "file:" &&
          window.location.protocol === "file:")
      ) {
        return escapeHTML(value);
      }
    } catch {
      return fallback;
    }

    return fallback;
  }

  function safeAspect(value) {
    return /^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(value || "")
      ? value
      : "16 / 9";
  }

  function scrollBehavior() {
    return reduceMotionQuery.matches ? "auto" : "smooth";
  }

  function setPageStatus(message) {
    if (!statusRegion) return;
    statusRegion.textContent = "";
    window.setTimeout(() => {
      statusRegion.textContent = message;
    }, 20);
  }

  function scrollToTarget(target, focusTarget = null) {
    const element =
      typeof target === "string" ? document.querySelector(target) : target;
    if (!element) return;

    element.scrollIntoView({
      behavior: scrollBehavior(),
      block: "start",
    });

    if (focusTarget) {
      window.setTimeout(() => {
        focusTarget.focus({ preventScroll: true });
      }, reduceMotionQuery.matches ? 0 : 420);
    }
  }

  function renderMedia(media, context = "media") {
    if (!media) return "";

    const aspect = escapeHTML(safeAspect(media.aspect));
    const caption = media.caption
      ? `<figcaption>${escapeHTML(media.caption)}</figcaption>`
      : "";
    const alt = escapeHTML(media.alt || `${context}占位`);

    if (media.kind === "image" && media.src) {
      return `
        <figure class="media-frame" style="--media-aspect: ${aspect}">
          <img
            src="${safeUrl(media.src)}"
            alt="${alt}"
            loading="lazy"
            decoding="async"
          />
          ${caption}
        </figure>
      `;
    }

    if (media.kind === "video" && media.src) {
      const poster = media.poster
        ? ` poster="${safeUrl(media.poster)}"`
        : "";
      return `
        <figure class="media-frame" style="--media-aspect: ${aspect}">
          <video controls playsinline preload="metadata"${poster} aria-label="${alt}">
            <source src="${safeUrl(media.src)}" />
            您的浏览器不支持视频播放。
          </video>
          ${caption}
        </figure>
      `;
    }

    const kindLabel =
      media.kind === "video"
        ? "视频占位"
        : media.kind === "infographic"
          ? "信息图占位"
          : "图片占位";

    return `
      <figure class="media-frame media-frame--placeholder" style="--media-aspect: ${aspect}">
        <div class="media-placeholder" role="img" aria-label="${alt}">
          <span class="media-placeholder__icon" aria-hidden="true"></span>
          <p class="media-placeholder__kind">${kindLabel}</p>
          <p class="media-placeholder__copy">${alt}</p>
        </div>
        ${caption}
      </figure>
    `;
  }

  function formatMediaTime(value) {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const rounded = Math.floor(value);
    const minutes = Math.floor(rounded / 60);
    const seconds = String(rounded % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function renderSectionOneVideo(video) {
    if (!video?.src) return renderMedia(video, "video");

    const aspect = escapeHTML(safeAspect(video.aspect));
    const poster = video.poster
      ? ` poster="${safeUrl(video.poster)}"`
      : "";
    const alt = escapeHTML(video.alt || "共享儿女视频");

    return `
      <figure class="media-frame section-one__video" style="--media-aspect: ${aspect}">
        <div class="section-one__video-player" data-video-player>
          <video
            playsinline
            webkit-playsinline
            preload="metadata"
            data-video-element
            data-video-src="${safeUrl(video.src)}"
            aria-label="${alt}"
            ${poster}
          >
            您的浏览器不支持视频播放。
          </video>
          <p class="section-one__video-status" data-video-status>
            视频加载中…
          </p>
          <div class="section-one__video-controls" role="group" aria-label="视频播放控制">
            <button
              class="section-one__video-button"
              type="button"
              data-video-toggle
              aria-label="播放视频"
              disabled
            >
              <span aria-hidden="true" data-video-toggle-icon>▶</span>
            </button>
            <input
              class="section-one__video-seek"
              type="range"
              min="0"
              max="0"
              step="0.01"
              value="0"
              data-video-seek
              aria-label="视频进度"
              disabled
            />
            <output class="section-one__video-time" data-video-time>0:00 / 0:00</output>
            <button
              class="section-one__video-button"
              type="button"
              data-video-mute
              aria-label="静音"
              disabled
            >
              <span aria-hidden="true">音量</span>
            </button>
            <button
              class="section-one__video-button"
              type="button"
              data-video-fullscreen
              aria-label="全屏播放"
              disabled
            >
              <span aria-hidden="true">全屏</span>
            </button>
          </div>
        </div>
      </figure>
    `;
  }

  function renderSectionHeader(section) {
    return `
      <header class="section-heading">
        <p class="section-heading__eyebrow">
          <span>${escapeHTML(section.number)}</span>
          ${escapeHTML(section.eyebrow)}
        </p>
        <h2 id="${escapeHTML(section.id)}-title" tabindex="-1">${escapeHTML(section.title)}</h2>
        <p class="section-heading__lead">${escapeHTML(section.lead)}</p>
        ${
          section.statusNote
            ? `<p class="placeholder-note"><strong>框架说明</strong>${escapeHTML(section.statusNote)}</p>`
            : ""
        }
      </header>
    `;
  }

  function renderStoryStep(step, index) {
    const reverse = step.layout === "media-right" ? " story-step--reverse" : "";
    return `
      <article
        class="story-step media-step${reverse}"
        id="${escapeHTML(step.id)}"
        data-step-index="${index}"
      >
        <div class="story-step__media">
          ${renderMedia(step.media, step.title)}
        </div>
        <div class="story-step__copy">
          <p class="step-marker">${escapeHTML(step.marker)}</p>
          <h3>${escapeHTML(step.title)}</h3>
          ${paragraphs(step.body)}
        </div>
      </article>
    `;
  }

  function renderEmphasizedText(text, phrases = []) {
    let html = escapeHTML(text);
    const uniquePhrases = [...new Set(phrases)]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    uniquePhrases.forEach((phrase) => {
      const safePhrase = escapeHTML(phrase);
      html = html
        .split(safePhrase)
        .join(`<strong>${safePhrase}</strong>`);
    });

    return html;
  }

  function renderProgress(progress, modifier = "") {
    const introBody = progress.body
      ? `<p>${escapeHTML(progress.body)}</p>`
      : "";
    const sectionClassName = ["progress-story", modifier]
      .filter(Boolean)
      .join(" ");
    const steps = progress.steps
      .map((step, index) => {
        const questionClass =
          step.variant === "question" ? " progress-step--question" : "";
        const stepTitle = step.title
          ? `<h4>${escapeHTML(step.title)}</h4>`
          : "";

        return `
          <article
            class="progress-step media-step${questionClass}"
            data-progress-index="${index}"
          >
            <p class="step-marker">${escapeHTML(step.marker)}</p>
            ${stepTitle}
            <p>${renderEmphasizedText(step.body, step.emphasis)}</p>
          </article>
        `;
      })
      .join("");
    const slides = progress.steps
      .map((step, index) => {
        const activeClass = index === 0 ? " is-active" : "";
        const activeLabel = index === 0 ? "false" : "true";

        return `
          <img
            class="progress-media__image${activeClass}"
            src="${safeUrl(step.media.src)}"
            alt="${escapeHTML(step.media.alt || "")}"
            data-progress-image="${index}"
            aria-hidden="${activeLabel}"
            loading="eager"
            decoding="async"
          />
        `;
      })
      .join("");

    return `
      <section class="${sectionClassName}" aria-labelledby="${escapeHTML(progress.id)}-title">
        <div class="progress-story__intro">
          <p class="step-marker">${escapeHTML(progress.eyebrow)}</p>
          <h3 id="${escapeHTML(progress.id)}-title">${escapeHTML(progress.title)}</h3>
          ${introBody}
        </div>
        <div class="progress-story__layout">
          <div class="progress-story__visual">
            <div class="progress-media">
              <div class="progress-media__stage">
                ${slides}
              </div>
            </div>
            <div class="progress-meter" aria-hidden="true">
              <span></span>
            </div>
          </div>
          <div class="progress-story__steps">
            ${steps}
          </div>
        </div>
      </section>
    `;
  }

  function setProgressImage(visual, index) {
    if (!visual) return;

    const images = Array.from(
      visual.querySelectorAll("[data-progress-image]"),
    );
    if (!images.length) return;

    const activeIndex = Math.max(0, Math.min(images.length - 1, index));
    images.forEach((image, imageIndex) => {
      const isActive = imageIndex === activeIndex;
      image.classList.toggle("is-active", isActive);
      image.setAttribute("aria-hidden", String(!isActive));
    });
    visual.dataset.activeImage = String(activeIndex);
  }

  function preloadProgressImages(panel) {
    const sources = new Set(
      Array.from(
        panel.querySelectorAll(".progress-media__image[src]"),
        (image) => image.getAttribute("src"),
      ).filter(Boolean),
    );

    sources.forEach((source) => {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
    });
  }

  function renderSectionNavigation(navigation) {
    return `
      <nav class="chapter-switcher" aria-label="章节入口">
        <a class="chapter-switcher__link chapter-switcher__link--previous" href="${safeUrl(navigation.previousTarget)}">
          <span aria-hidden="true">←</span>
          <span>${escapeHTML(navigation.previousLabel)}</span>
        </a>
        <a class="chapter-switcher__link chapter-switcher__link--next" href="${safeUrl(navigation.nextTarget)}">
          <span>${escapeHTML(navigation.nextLabel)}</span>
          <span aria-hidden="true">→</span>
        </a>
      </nav>
    `;
  }

  function renderSectionOne() {
    const section = data.sectionOne;
    const { hero, intro, video, caseStudy, progress } = section;

    return `
      <section
        class="story-section section-one is-cover-mode"
        id="${escapeHTML(section.id)}"
        data-section-number="${escapeHTML(section.number)}"
        aria-labelledby="${escapeHTML(section.id)}-title"
      >
        <div class="hero section-one__hero">
          <div class="hero__copy">
            <p class="hero__eyebrow">${escapeHTML(hero.eyebrow)}</p>
            <p class="hero__title">${escapeHTML(hero.title)}</p>
            <h1>${escapeHTML(hero.subtitle)}</h1>
            <p class="hero__lead">${escapeHTML(hero.lead)}</p>
            <div class="section-one__enter-wrap">
              <button
                class="button button--primary section-one__enter"
                type="button"
                data-enter-story
                aria-controls="${escapeHTML(section.id)}-body"
              >
                <span>${escapeHTML(hero.entryLabel)}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
          <div class="section-one__hero-cover">
            ${renderMedia(hero.cover, hero.title)}
          </div>
        </div>

        <div class="section-one__body" id="${escapeHTML(section.id)}-body">
          ${renderSectionHeader(section)}

          <section
            class="section-one__entry media-step"
            aria-labelledby="${escapeHTML(section.id)}-title"
          >
            <div class="section-one__entry-copy">
              <p class="step-marker">${escapeHTML(intro.marker)}</p>
              ${paragraphs(intro.body)}
            </div>
            <div class="section-one__entry-media">
              ${renderSectionOneVideo(video)}
            </div>
          </section>

          <section
            class="section-one__case media-step"
            aria-labelledby="${escapeHTML(section.id)}-case-title"
          >
            <header class="section-one__block-heading">
              <p class="step-marker">${escapeHTML(caseStudy.marker)}</p>
              <h3 id="${escapeHTML(section.id)}-case-title">${escapeHTML(caseStudy.title)}</h3>
            </header>
            <div class="section-one__case-grid">
              <div class="section-one__case-lead">
                ${paragraphs(caseStudy.lead)}
              </div>
              <div class="section-one__media">
                ${renderMedia(caseStudy.media, caseStudy.title)}
              </div>
            </div>
            <div class="section-one__case-body">
              ${paragraphs(caseStudy.body)}
            </div>
          </section>

          ${renderProgress(progress, "section-one__progress")}

          ${renderSectionNavigation(section.endNavigation)}
        </div>
      </section>
    `;
  }

  function getPerspective(id = activePerspectiveId) {
    return data.sectionTwo.perspectives.find(
      (perspective) => perspective.id === id,
    );
  }

  function getDisplayName(person) {
    return person.pseudonym ? `${person.name}（化名）` : person.name;
  }

  function renderPersonAvatar(person) {
    const position = person.avatar?.position || "center 30%";

    if (person.avatar?.src) {
      return `
        <img
          class="person-avatar person-avatar--image"
          src="${safeUrl(person.avatar.src)}"
          alt="${escapeHTML(person.avatar.alt || `${person.name}的头像`)}"
          style="--avatar-position: ${escapeHTML(position)}"
          width="120"
          height="132"
          loading="eager"
          decoding="async"
        />
      `;
    }

    return `
      <span
        class="person-avatar"
        role="img"
        aria-label="${escapeHTML(person.name)}的姓氏头像"
      >
        ${escapeHTML(person.avatarInitial)}
      </span>
    `;
  }

  function renderPerspectiveTabs() {
    return data.sectionTwo.perspectives
      .map((perspective, index) => {
        const isActive = perspective.id === activePerspectiveId;

        return `
          <button
            class="perspective-tab perspective-tab--${escapeHTML(perspective.tone)}"
            id="perspective-tab-${escapeHTML(perspective.id)}"
            type="button"
            role="tab"
            aria-selected="${isActive}"
            aria-controls="perspective-panel-${escapeHTML(perspective.id)}"
            tabindex="${isActive ? "0" : "-1"}"
            data-perspective-tab="${escapeHTML(perspective.id)}"
          >
            <span class="perspective-tab__number">${escapeHTML(perspective.number)}</span>
            <span class="perspective-tab__text">
              <strong>${escapeHTML(perspective.tabLabel)}</strong>
              <small>${perspective.people.length}位受访者</small>
            </span>
            <span class="perspective-tab__dot" aria-hidden="true"></span>
            <span class="sr-only">，第 ${index + 1} 个视角</span>
          </button>
        `;
      })
      .join("");
  }

  function formatAudioTime(value) {
    if (!Number.isFinite(value) || value < 0) return "--:--";
    const totalSeconds = Math.floor(value);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function renderPersonAudio(audio) {
    if (!audio) return "";

    if (audio.src) {
      return `
        <div
          class="person-audio"
          data-audio-player
          data-audio-label="${escapeHTML(audio.label)}"
        >
          <audio
            class="person-audio__element"
            data-audio-element
            preload="metadata"
            src="${safeUrl(audio.src)}"
          ></audio>
          <button
            class="person-audio__toggle"
            type="button"
            data-audio-toggle
            aria-label="播放${escapeHTML(audio.label)}"
            aria-pressed="false"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path class="person-audio__play-icon" d="M8 5v14l11-7Z"></path>
              <path class="person-audio__pause-icon" d="M7 5h4v14H7zm6 0h4v14h-4z"></path>
            </svg>
          </button>
          <div class="person-audio__body">
            <div class="person-audio__meta">
              <span>人物语音</span>
              <span class="person-audio__time">
                <span data-audio-current>00:00</span>
                <span aria-hidden="true"> / </span>
                <span data-audio-duration>--:--</span>
              </span>
            </div>
            <input
              class="person-audio__range"
              data-audio-range
              type="range"
              min="0"
              max="1000"
              step="1"
              value="0"
              disabled
              aria-label="调整${escapeHTML(audio.label)}播放进度"
            />
          </div>
        </div>
      `;
    }

    return `
      <div
        class="person-audio person-audio--empty"
        aria-label="${escapeHTML(audio.status || "采访语音待补充")}"
      >
        <span>${escapeHTML(audio.status || "采访语音待补充")}</span>
      </div>
    `;
  }

  function pauseAllInterviewAudio(except = null) {
    app.querySelectorAll("[data-audio-element]").forEach((audio) => {
      if (audio !== except && !audio.paused) {
        audio.pause();
      }
    });
  }

  function initInterviewAudios(root) {
    root?.querySelectorAll("[data-audio-player]").forEach((player) => {
      if (player.dataset.audioReady === "true") return;

      const audio = player.querySelector("[data-audio-element]");
      const toggle = player.querySelector("[data-audio-toggle]");
      const range = player.querySelector("[data-audio-range]");
      const currentLabel = player.querySelector("[data-audio-current]");
      const durationLabel = player.querySelector("[data-audio-duration]");
      const audioLabel = player.dataset.audioLabel || "采访语音";
      if (!audio || !toggle || !range) return;

      const update = () => {
        const duration = Number.isFinite(audio.duration)
          ? audio.duration
          : 0;
        const current = Number.isFinite(audio.currentTime)
          ? audio.currentTime
          : 0;
        const progress = duration > 0
          ? Math.max(0, Math.min(1, current / duration))
          : 0;

        range.disabled = duration <= 0;
        range.value = String(Math.round(progress * 1000));
        range.style.setProperty(
          "--audio-progress",
          `${progress * 100}%`,
        );
        range.setAttribute(
          "aria-valuetext",
          `${formatAudioTime(current)} / ${formatAudioTime(duration)}`,
        );
        if (currentLabel) {
          currentLabel.textContent = formatAudioTime(current);
        }
        if (durationLabel) {
          durationLabel.textContent =
            duration > 0 ? formatAudioTime(duration) : "--:--";
        }
      };

      const setPlaying = (playing) => {
        player.classList.toggle("is-playing", playing);
        toggle.setAttribute("aria-pressed", String(playing));
        toggle.setAttribute(
          "aria-label",
          `${playing ? "暂停" : "播放"}${audioLabel}`,
        );
      };

      toggle.addEventListener("click", async () => {
        if (!audio.paused) {
          audio.pause();
          return;
        }

        pauseAllInterviewAudio(audio);
        try {
          await audio.play();
        } catch {
          player.classList.add("has-audio-error");
          setPlaying(false);
        }
      });

      range.addEventListener("input", () => {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          return;
        }
        audio.currentTime =
          (Number(range.value) / 1000) * audio.duration;
        update();
      });

      audio.addEventListener("loadedmetadata", update);
      audio.addEventListener("durationchange", update);
      audio.addEventListener("timeupdate", update);
      audio.addEventListener("play", () => setPlaying(true));
      audio.addEventListener("pause", () => setPlaying(false));
      audio.addEventListener("ended", () => {
        setPlaying(false);
        update();
      });
      audio.addEventListener("error", () => {
        player.classList.add("has-audio-error");
        toggle.disabled = true;
        range.disabled = true;
        if (currentLabel) currentLabel.textContent = "无法播放";
      });

      player.dataset.audioReady = "true";
      update();
    });
  }

  function renderCardProgress(person) {
    return person.cards
      .map(
        (card, index) => `
          <span
            class="person-card-progress__segment${index === 0 ? " is-current" : ""}"
            data-card-progress-segment="${index}"
            aria-hidden="true"
          ></span>
        `,
      )
      .join("");
  }

  function renderInterviewExcerpt(person) {
    if (!person.transcript?.length) return "";

    return `
      <details class="interview-excerpt">
        <summary>展开采访摘录</summary>
        <div class="interview-excerpt__body">
          ${paragraphs(person.transcript)}
        </div>
      </details>
    `;
  }

  function getPersonDestination(perspective, personIndex) {
    const nextPerson = perspective.people[personIndex + 1];

    if (nextPerson) {
      return {
        kicker: "向上滑，听听下一位",
        label: `下一位 · ${nextPerson.name}`,
        action: "advance",
      };
    }

    return {
      kicker: perspective.completeLabel,
      label: perspective.completeHint,
      action: perspective.nextAction,
    };
  }

  function renderPersonDeck(perspective, personIndex) {
    const person = perspective.people[personIndex];
    const destination = getPersonDestination(perspective, personIndex);
    const isLastPerson = personIndex === perspective.people.length - 1;

    return `
      <div
        class="person-deck person-deck--${escapeHTML(perspective.tone)}"
        data-person-deck
        data-perspective="${escapeHTML(perspective.id)}"
        data-person-index="${personIndex}"
      >
        <div class="person-view" data-person-view>
          <header class="person-bar" aria-labelledby="person-${escapeHTML(person.id)}-name">
            <div class="person-bar__identity">
              ${renderPersonAvatar(person)}
              <div class="person-bar__copy">
                <div class="person-bar__title-line">
                  <h3 id="person-${escapeHTML(person.id)}-name" tabindex="-1">
                    ${escapeHTML(getDisplayName(person))}
                  </h3>
                  <span class="person-bar__ordinal">
                    ${personIndex + 1} / ${perspective.people.length}
                  </span>
                </div>
                <p class="person-bar__meta">
                  ${escapeHTML(person.age)}岁 ·
                  ${escapeHTML(person.location)} ·
                  ${escapeHTML(person.situation)}
                </p>
                <p class="person-bar__status">${escapeHTML(person.stance)}</p>
              </div>
            </div>

            <blockquote class="person-bar__quote">
              ${escapeHTML(person.quote)}
            </blockquote>

            <div class="person-bar__tools">
              ${renderPersonAudio(person.audio)}
            </div>

            <div class="person-card-progress" data-card-progress>
              <span class="person-card-progress__count">
                <strong data-card-current>01</strong>
                <span>/ ${String(person.cards.length).padStart(2, "0")}</span>
              </span>
              <span class="person-card-progress__bar">
                ${renderCardProgress(person)}
              </span>
              <span class="person-card-progress__label" data-card-label>
                ${escapeHTML(person.cards[0].navLabel)}
              </span>
            </div>
          </header>

          <div
            class="person-cards"
            tabindex="0"
            data-person-cards
            aria-label="${escapeHTML(getDisplayName(person))}的采访内容，共${person.cards.length}段"
          >
            <div class="person-cards__track">
              ${person.cards
                .map(
                  (card, index) => `
                    <article
                      class="person-card${index === 0 ? " is-current" : ""}"
                      data-person-card-index="${index}"
                      aria-label="${escapeHTML(`${card.marker}，${card.navLabel}`)}"
                    >
                      <header class="person-card__header">
                        <span>${escapeHTML(card.marker)}</span>
                        <span>${escapeHTML(card.navLabel)}</span>
                      </header>
                      ${paragraphs(card.body)}
                    </article>
                  `,
                )
                .join("")}
              ${renderInterviewExcerpt(person)}
            </div>
          </div>
        </div>

        <button
          class="person-pull${isLastPerson ? " person-pull--complete" : ""}"
          type="button"
          data-person-action="${escapeHTML(destination.action)}"
          aria-label="${escapeHTML(`${destination.kicker}，${destination.label}。向上滑动或点击继续`)}"
        >
          <span class="person-pull__meter" aria-hidden="true"><span></span></span>
          <span class="person-pull__arrow" aria-hidden="true">↑</span>
          <span class="person-pull__copy">
            <span>${escapeHTML(destination.kicker)}</span>
            <strong>${escapeHTML(destination.label)}</strong>
          </span>
          <span class="person-pull__armed">松手切换</span>
        </button>
      </div>
    `;
  }

  function renderPerspectivePanel(perspective, isActive) {
    const personIndex = activePersonIndices[perspective.id] || 0;

    return `
      <section
        class="perspective-panel"
        id="perspective-panel-${escapeHTML(perspective.id)}"
        role="tabpanel"
        aria-labelledby="perspective-tab-${escapeHTML(perspective.id)}"
        ${isActive ? "" : "hidden"}
        data-perspective-panel="${escapeHTML(perspective.id)}"
      >
        ${renderPersonDeck(perspective, personIndex)}
      </section>
    `;
  }

  function renderPerspectivePanels() {
    return data.sectionTwo.perspectives
      .map((perspective) =>
        renderPerspectivePanel(
          perspective,
          perspective.id === activePerspectiveId,
        ),
      )
      .join("");
  }

  function renderGameSection() {
    const game = data.game;
    const gameUrl = safeUrl(data.metadata.gameUrl);
    const qrUrl = safeUrl(data.metadata.gameQr);

    return `
      <section
        class="story-section section-game"
        id="${escapeHTML(game.id)}"
        data-section-number="互动"
        aria-labelledby="${escapeHTML(game.id)}-title"
      >
        <div class="game-entry">
          <div class="game-entry__copy">
            <p class="section-heading__eyebrow">${escapeHTML(game.eyebrow)}</p>
            <h2 id="${escapeHTML(game.id)}-title" tabindex="-1">${escapeHTML(game.title)}</h2>
            <p>${escapeHTML(game.body)}</p>
            <p class="game-entry__instruction">${escapeHTML(game.instruction)}</p>
          </div>
          <a class="game-entry__qr" href="${gameUrl}" aria-label="打开《共享儿女》互动体验">
            <img
              src="${qrUrl}"
              alt="《共享儿女》互动新闻小游戏二维码"
              width="1024"
              height="1024"
            />
            <span>扫码或点击二维码进入互动体验</span>
          </a>
        </div>

        <nav class="chapter-switcher" aria-label="互动体验章节入口">
          <a class="chapter-switcher__link chapter-switcher__link--previous" href="#section-02">
            <span aria-hidden="true">←</span>
            <span>返回两种视角</span>
          </a>
          <a class="chapter-switcher__link chapter-switcher__link--next" href="#section-03">
            <span>进入制度回应</span>
            <span aria-hidden="true">→</span>
          </a>
        </nav>
      </section>
    `;
  }

  function renderSectionTwo() {
    const section = data.sectionTwo;

    return `
      <section
        class="story-section section-two"
        id="${escapeHTML(section.id)}"
        data-section-number="${escapeHTML(section.number)}"
        aria-labelledby="${escapeHTML(section.id)}-title"
      >
        <header class="section-heading perspective-heading">
          <p class="section-heading__eyebrow">
            <span>${escapeHTML(section.number)}</span>
            ${escapeHTML(section.eyebrow)}
          </p>
          <h2 id="${escapeHTML(section.id)}-title" tabindex="-1">
            ${escapeHTML(section.title)}
          </h2>
          <p class="section-heading__lead">${escapeHTML(section.lead)}</p>
          <p class="perspective-heading__time">${escapeHTML(section.interviewTime)}</p>
        </header>

        <div class="perspective-reader">
          <div
            class="perspective-tabs"
            role="tablist"
            aria-label="选择受访者视角"
          >
            ${renderPerspectiveTabs()}
          </div>
          <div class="perspective-panels">
            ${renderPerspectivePanels()}
          </div>
        </div>
      </section>
    `;
  }

  function renderExpert(expert, className = "") {
    const cardClass = ["expert-card", className].filter(Boolean).join(" ");

    return `
      <blockquote class="${cardClass}">
        <p class="expert-card__label">${escapeHTML(expert.label)}</p>
        <p class="expert-card__quote">${escapeHTML(expert.quote)}</p>
        ${
          expert.attribution
            ? `<footer>${escapeHTML(expert.attribution)}</footer>`
            : ""
        }
      </blockquote>
    `;
  }

  function renderSectionThreeFigure(media, modifier) {
    if (!media?.src) return "";

    const aspect = escapeHTML(safeAspect(media.aspect));
    const caption = media.caption
      ? `<figcaption>${escapeHTML(media.caption)}</figcaption>`
      : "";

    return `
      <figure
        class="media-frame section-three__figure section-three__figure--${modifier}"
        style="--media-aspect: ${aspect}"
      >
        <a
          class="section-three__figure-link"
          href="${safeUrl(media.src)}"
          target="_blank"
          rel="noopener"
          aria-label="查看${escapeHTML(media.caption || "图片")}原图"
        >
          <img
            src="${safeUrl(media.src)}"
            alt="${escapeHTML(media.alt)}"
            loading="lazy"
            decoding="async"
          />
        </a>
        ${caption}
      </figure>
    `;
  }

  function renderProcessSubjectIcon(type) {
    const icons = {
      elder: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="16" fill="#f8e8dd"/>
          <circle cx="32" cy="22" r="11" fill="#77787b"/>
          <path d="M16 56c1-13 7-20 16-20s15 7 16 20" fill="#d9795f"/>
          <circle cx="28" cy="22" r="6" fill="#f2c4aa"/>
        </svg>
      `,
      child: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="16" fill="#e2eff8"/>
          <circle cx="27" cy="20" r="10" fill="#23485d"/>
          <path d="M10 56c1-13 7-21 17-21s16 8 17 21" fill="#638eae"/>
          <rect x="39" y="25" width="12" height="22" rx="3" fill="#f4f7f8" stroke="#345a72" stroke-width="2"/>
          <path d="M43 41h4" stroke="#345a72" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      `,
      community: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="16" fill="#e1f2ee"/>
          <path d="M9 31 32 11l23 20v24H9Z" fill="#2b978c"/>
          <rect x="23" y="34" width="18" height="21" fill="#f5fbf9"/>
          <rect x="26" y="38" width="4" height="5" fill="#1d706a"/>
          <rect x="34" y="38" width="4" height="5" fill="#1d706a"/>
          <rect x="26" y="47" width="4" height="8" fill="#1d706a"/>
        </svg>
      `,
      worker: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="16" fill="#e7edf8"/>
          <circle cx="32" cy="23" r="11" fill="#3d4a71"/>
          <path d="M14 56c1-13 8-20 18-20s17 7 18 20" fill="#5676b2"/>
          <path d="M20 17c3-8 21-10 25 1Z" fill="#293758"/>
          <rect x="38" y="38" width="12" height="9" rx="2" fill="#f6ca55"/>
          <path d="M42 42h4" stroke="#7e6420" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      `,
    };

    return icons[type] || icons.elder;
  }

  function renderSectionThreeIntro(block) {
    const { id: blockId, marker, title, intro } = block;
    if (!intro) return "";
    const heading = `
      <header class="section-three__block-heading section-three__block-heading--intro">
        <p class="step-marker">${escapeHTML(marker)}</p>
        <h4>${escapeHTML(title)}</h4>
      </header>
    `;

    if (intro.type === "layered") {
      return `
        <section
          class="section-three__intro section-three__intro--layered"
          data-text-intro
          data-intro-kind="layered"
          aria-label="陪伴关系与职责边界"
        >
          <div class="section-three__intro-sticky">
            ${heading}
            <div class="section-three__intro-body">
              <div class="section-three__layered-copy">
                ${intro.layers
                  .map(
                    (layer, index) => `
                      <p
                        class="section-three__layer section-three__layer--${escapeHTML(layer.type)}${index === 0 ? " is-visible" : ""}"
                        data-intro-layer="${index}"
                      >
                        ${escapeHTML(layer.text)}
                      </p>
                    `,
                  )
                  .join("")}
              </div>
            </div>
          </div>
        </section>
      `;
    }

    if (intro.type === "highlight") {
      const titleId = `${blockId}-intro-title`;
      let keywordIndex = 0;
      const copy = intro.lines
        .map(
          (line) => `
            <span class="section-three__highlight-line">
              ${line
                .map((segment) => {
                  if (!segment.keyword) {
                    return escapeHTML(segment.text);
                  }

                  const index = keywordIndex;
                  keywordIndex += 1;
                  return `<span class="section-three__highlight-word" data-intro-word="${index}">${escapeHTML(segment.keyword)}</span>`;
                })
                .join("")}
            </span>
          `,
        )
        .join("");

      return `
        <section
          class="section-three__intro section-three__intro--highlight"
          data-text-intro
          data-intro-kind="highlight"
          aria-labelledby="${titleId}"
        >
          <div class="section-three__intro-sticky">
            ${heading}
            <div class="section-three__intro-body">
              <h4 class="section-three__highlight-title" id="${titleId}">${escapeHTML(intro.title)}</h4>
              <p class="section-three__highlight-copy">${copy}</p>
            </div>
          </div>
        </section>
      `;
    }

    return "";
  }

  function renderProcessStory(process) {
    const processId = "section-three-service-process";
    const subjectItems = process.subjects
      .map(
        (subject) => `
          <li class="section-three__process-subject">
            <span class="section-three__process-subject-icon">
              ${renderProcessSubjectIcon(subject.icon)}
            </span>
            <strong>${escapeHTML(subject.name)}</strong>
          </li>
        `,
      )
      .join("");
    const steps = process.steps
      .map((step, index) => {
        const detailsId = `${processId}-details-${index + 1}`;

        return `
          <li
            class="section-three__process-step"
            data-process-step
            data-process-step-index="${index}"
          >
            <span class="section-three__process-marker" aria-hidden="true">
              ${escapeHTML(step.number)}
            </span>
            <article class="section-three__process-step-card">
              <button
                class="section-three__process-toggle"
                type="button"
                data-process-toggle
                aria-expanded="false"
                aria-controls="${detailsId}"
              >
                <span class="section-three__process-step-heading">
                  <strong>${escapeHTML(step.title)}</strong>
                  <span class="section-three__process-participants">${escapeHTML(step.participants)}</span>
                </span>
                <span class="section-three__process-summary">${escapeHTML(step.summary)}</span>
                <span class="section-three__process-toggle-icon" aria-hidden="true"></span>
              </button>
              <div
                class="section-three__process-details"
                id="${detailsId}"
                data-process-details
                aria-hidden="true"
              >
                <div class="section-three__process-details-inner">
                  <ul>
                    ${step.details
                      .map((detail) => `<li>${escapeHTML(detail)}</li>`)
                      .join("")}
                  </ul>
                </div>
              </div>
            </article>
          </li>
        `;
      })
      .join("");
    const safeguards = process.safeguards
      .map(
        (item, index) => `
          <article class="section-three__process-safeguard">
            <span class="section-three__process-safeguard-icon" aria-hidden="true">
              ${index === 0 ? "!" : "↔"}
            </span>
            <div>
              <h4>${escapeHTML(item.title)}</h4>
              <p>${escapeHTML(item.body)}</p>
            </div>
          </article>
        `,
      )
      .join("");

    return `
      <section
        class="section-three__process"
        data-process-story
        aria-labelledby="${processId}-title"
      >
        <div class="section-three__process-sticky">
          <header class="section-three__process-hero">
            <div>
              <p class="section-three__process-kicker">
                <span aria-hidden="true">✓</span>
                ${escapeHTML(process.badge)}
              </p>
              <h3 id="${processId}-title">${escapeHTML(process.title)}</h3>
              <p>${escapeHTML(process.lead)}</p>
            </div>
            <p class="section-three__process-counter" aria-hidden="true">
              <strong data-process-current>01</strong>
              <span>/ 06</span>
            </p>
          </header>

          <section class="section-three__process-subjects" aria-labelledby="${processId}-subjects">
            <h4 id="${processId}-subjects">参与主体</h4>
            <ul>${subjectItems}</ul>
          </section>

          <div class="section-three__process-stage">
            <div class="section-three__process-window" data-process-window>
              <div class="section-three__process-track" data-process-track>
                <span class="section-three__process-line" aria-hidden="true">
                  <span data-process-line></span>
                </span>
                <ol class="section-three__process-steps">
                  ${steps}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="section-three__process-safeguards" aria-label="服务流程补充说明">
        ${safeguards}
      </aside>
    `;
  }

  function renderSectionThreeReferences(references = []) {
    if (!references.length) return "";

    return `
      <section
        class="section-three__references"
        aria-labelledby="section-three-references-title"
      >
        <h3 id="section-three-references-title">资料来源</h3>
        <ol>
          ${references
            .map((reference) => {
              const publisher = reference.publisher
                ? `${reference.publisher}, `
                : "";
              const issue = reference.issue
                ? `(${reference.issue})`
                : "";
              const url = safeUrl(reference.url);

              return `
                <li>
                  ${escapeHTML(reference.authors)}.
                  <a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHTML(reference.title)}</a>
                  [${escapeHTML(reference.type)}].
                  ${escapeHTML(publisher)}${escapeHTML(reference.date)}${escapeHTML(issue)}
                  [引用日期 ${escapeHTML(reference.accessed)}].
                </li>
              `;
            })
            .join("")}
        </ol>
      </section>
    `;
  }

  function renderSiteFooter() {
    return `
      <footer class="site-footer">
        <p>《共享儿女：当陪伴成为一项服务》</p>
      </footer>
    `;
  }

  function renderSectionThree() {
    const section = data.sectionThree;
    const closingSentences = section.closing.body
      .flatMap(
        (paragraph) => {
          const sentences =
            paragraph
              .match(/[^。！？]+[。！？]?/g)
              ?.map((item) => item.trim()) || [];
          const grouped = [];

          sentences.forEach((sentence) => {
            const previous = grouped[grouped.length - 1];
            if (previous?.endsWith("？") && sentence.endsWith("？")) {
              grouped[grouped.length - 1] = `${previous}${sentence}`;
            } else {
              grouped.push(sentence);
            }
          });

          return grouped;
        },
      )
      .filter(Boolean);
    const emphasizedClosingSentences = new Set([
      "“共享儿女”是一个年轻的答案。",
      "养老从来不只是“养”，更是“伴”。",
      "老龄化是挑战，更是机遇。",
    ]);

    return `
      <section
        class="story-section section-three"
        id="${escapeHTML(section.id)}"
        data-section-number="${escapeHTML(section.number)}"
        aria-labelledby="${escapeHTML(section.id)}-title"
      >
        ${renderSectionHeader(section)}

        <div class="section-three__opening">
          ${renderSectionThreeFigure(section.openingMedia, "opening")}
        </div>

        <h3 class="section-three__topic">${escapeHTML(section.topicTitle)}</h3>

        <div class="section-three__blocks">
          ${section.blocks
            .map(
              (block) => `
                <article class="section-three__block" id="${escapeHTML(block.id)}">
                  ${
                    block.intro
                      ? renderSectionThreeIntro(block)
                      : `
                        <header class="section-three__block-heading">
                          <p class="step-marker">${escapeHTML(block.marker)}</p>
                          <h4>${escapeHTML(block.title)}</h4>
                        </header>
                      `
                  }
                  <div class="section-three__content-card media-step">
                    <div class="section-three__block-copy">
                      ${paragraphs(block.body)}
                    </div>
                  </div>
                  ${
                    block.process ? renderProcessStory(block.process) : ""
                  }
                  ${
                    block.advice
                      ? renderExpert(
                          {
                            label: block.advice.label,
                            quote: block.advice.body,
                          },
                          "section-three__expert-card media-step",
                        )
                      : ""
                  }
                </article>
              `,
            )
            .join("")}
        </div>

        <section
          class="closing-card section-three__closing section-three__closing-story"
          data-closing-story
          aria-labelledby="section-three-closing-title"
        >
          <div class="section-three__closing-sticky">
            <h3
              id="section-three-closing-title"
              class="section-three__closing-line"
              data-closing-line="0"
            >
              ${escapeHTML(section.closing.title)}
            </h3>
            <div class="section-three__closing-lines">
              ${closingSentences
                .map(
                  (sentence, index) => `
                    <p
                      class="section-three__closing-line${emphasizedClosingSentences.has(sentence) ? " section-three__closing-line--emphasis" : ""}"
                      data-closing-line="${index + 1}"
                    >
                      ${escapeHTML(sentence)}
                    </p>
                  `,
                )
                .join("")}
            </div>
          </div>
        </section>

        <figure class="section-three__footer-illustration">
          <img
            src="./assets/images/section-03/结尾插画.png"
            alt="三位青年在向日葵环绕中举起双手的插画"
            width="561"
            height="456"
            loading="lazy"
            decoding="async"
          />
        </figure>

        ${renderSectionThreeReferences(section.references)}
        ${renderSectionNavigation(section.endNavigation)}
        ${renderSiteFooter()}
      </section>
    `;
  }

  function renderPage() {
    app.innerHTML = `
      ${renderSectionOne()}
      ${renderSectionTwo()}
      ${renderGameSection()}
      ${renderSectionThree()}
    `;
  }

  function getInitialSectionId() {
    const hashSection = window.location.hash.replace(/^#/, "");
    return sectionIds.includes(hashSection) ? hashSection : sectionIds[0];
  }

  function updateChapterViewportHeight() {
    const viewportHeight =
      window.visualViewport?.height || window.innerHeight || 0;
    const headerHeight = siteHeader?.getBoundingClientRect().height || 0;
    const chapterHeight = Math.max(320, Math.floor(viewportHeight - headerHeight));
    document.documentElement.style.setProperty(
      "--chapter-viewport-height",
      `${chapterHeight}px`,
    );
  }

  function syncSectionHash(sectionId) {
    if (!window.history || typeof window.history.replaceState !== "function") {
      return;
    }

    try {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}#${sectionId}`,
      );
    } catch {
      // 某些本地 file:// 环境会限制 replaceState，不影响页面切换。
    }
  }

  function setActiveSection(sectionId) {
    const navigationId = sectionNavigationIds[sectionId] || sectionId;

    navigationLinks.forEach((link) => {
      const isActive = link.dataset.sectionLink === navigationId;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function setSectionOneCoverMode(panel, isLocked) {
    if (!panel?.classList.contains("section-one")) return;

    const body = panel.querySelector(".section-one__body");
    panel.classList.toggle("is-cover-mode", isLocked);
    if (body) {
      body.inert = isLocked;
      if (isLocked) {
        body.setAttribute("aria-hidden", "true");
      } else {
        body.removeAttribute("aria-hidden");
      }
    }

    if (isLocked) {
      sectionOneVideoController?.pause();
      mediaScroller?.destroy();
      progressScroller?.destroy();
      sectionOneRevealObserver?.disconnect();
      mediaScroller = null;
      progressScroller = null;
      sectionOneRevealObserver = null;
      panel.scrollTop = 0;
    }
  }

  function initSectionOneVideo(panel) {
    const player = panel?.querySelector("[data-video-player]");
    const video = player?.querySelector("[data-video-element]");
    if (!player || !video) return;
    if (sectionOneVideoController?.player === player) return;

    sectionOneVideoController?.destroy();

    const toggle = player.querySelector("[data-video-toggle]");
    const toggleIcon = player.querySelector("[data-video-toggle-icon]");
    const seek = player.querySelector("[data-video-seek]");
    const time = player.querySelector("[data-video-time]");
    const mute = player.querySelector("[data-video-mute]");
    const fullscreen = player.querySelector("[data-video-fullscreen]");
    const status = player.querySelector("[data-video-status]");
    const videoSource = video.dataset.videoSrc;
    const abortController = new AbortController();
    const { signal } = abortController;
    let isSeeking = false;
    let isReady = false;

    const listen = (target, eventName, handler, options = {}) => {
      target?.addEventListener(eventName, handler, { ...options, signal });
    };

    const syncPlaybackState = () => {
      const isPlaying = !video.paused && !video.ended;
      if (toggleIcon) {
        toggleIcon.textContent = isPlaying ? "❚❚" : "▶";
      }
      toggle?.setAttribute(
        "aria-label",
        isPlaying ? "暂停视频" : "播放视频",
      );
      if (toggle) toggle.disabled = !isReady;
    };

    const syncProgress = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const current = Number.isFinite(video.currentTime)
        ? video.currentTime
        : 0;
      const progress = duration > 0
        ? Math.max(0, Math.min(1, current / duration))
        : 0;

      if (!isSeeking && seek) {
        seek.max = String(duration);
        seek.value = String(Math.min(current, duration));
      }
      if (seek) seek.disabled = !isReady;
      if (mute) mute.disabled = !isReady;
      if (fullscreen) fullscreen.disabled = !isReady;
      seek?.style.setProperty(
        "--seek-progress",
        `${progress * 100}%`,
      );
      seek?.setAttribute(
        "aria-valuetext",
        `${formatMediaTime(current)} / ${formatMediaTime(duration)}`,
      );
      if (time) {
        time.textContent =
          `${formatMediaTime(current)} / ${formatMediaTime(duration)}`;
      }
    };

    const togglePlayback = () => {
      if (video.paused || video.ended) {
        const playback = video.play();
        playback?.catch(() => {});
      } else {
        video.pause();
      }
    };

    const toggleMute = () => {
      video.muted = !video.muted;
      mute?.setAttribute(
        "aria-label",
        video.muted ? "取消静音" : "静音",
      );
      const label = mute?.querySelector("span");
      if (label) {
        label.textContent = video.muted ? "静音" : "音量";
      }
    };

    const toggleFullscreen = async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await player.requestFullscreen?.();
        }
      } catch {
        // 浏览器可能禁止全屏；播放与拖动进度不受影响。
      }
    };

    listen(video, "loadedmetadata", () => {
      isReady = true;
      player.classList.remove("is-loading");
      player.classList.add("is-ready");
      if (status) status.hidden = true;
      syncPlaybackState();
      syncProgress();
    });
    listen(video, "waiting", () => {
      player.classList.add("is-buffering");
    });
    listen(video, "playing", () => {
      player.classList.remove("is-buffering");
    });
    listen(video, "error", () => {
      if (status) {
        status.hidden = false;
        status.textContent = "视频加载失败，请刷新重试。";
      }
    });
    listen(video, "timeupdate", syncProgress);
    listen(video, "durationchange", syncProgress);
    listen(video, "seeking", syncProgress);
    listen(video, "seeked", syncProgress);
    listen(video, "play", syncPlaybackState);
    listen(video, "pause", syncPlaybackState);
    listen(video, "ended", syncPlaybackState);
    listen(toggle, "click", togglePlayback);
    listen(video, "click", togglePlayback);
    listen(mute, "click", toggleMute);
    listen(fullscreen, "click", toggleFullscreen);

    listen(seek, "pointerdown", () => {
      isSeeking = true;
      player.classList.add("is-seeking");
    });
    listen(seek, "input", () => {
      isSeeking = true;
      const nextTime = Number(seek.value);
      if (Number.isFinite(video.duration) && Number.isFinite(nextTime)) {
        video.currentTime = Math.max(
          0,
          Math.min(video.duration, nextTime),
        );
        syncProgress();
      }
    });
    const finishSeeking = () => {
      isSeeking = false;
      player.classList.remove("is-seeking");
      syncProgress();
    };
    listen(seek, "change", finishSeeking);
    listen(seek, "pointerup", finishSeeking);
    listen(seek, "pointercancel", finishSeeking);

    const loadVideo = () => {
      if (!videoSource) return;
      player.classList.add("is-loading");
      video.src = videoSource;
      video.load();
    };

    syncPlaybackState();
    syncProgress();
    loadVideo();

    sectionOneVideoController = {
      player,
      destroy() {
        abortController.abort();
        video.pause();
      },
      pause() {
        video.pause();
      },
    };
  }

  function enterSectionOneStory(button) {
    const panel = button.closest("#section-01");
    if (!panel) return;

    setSectionOneCoverMode(panel, false);
    panel.scrollTop = 0;
    initSectionScrollytelling(panel);
    initSectionOneVideo(panel);

    const headingGroup = panel.querySelector(".section-heading");
    const heading = headingGroup?.querySelector("h2");
    window.requestAnimationFrame(() => {
      scrollToTarget(headingGroup, heading);
    });
    setPageStatus("已进入第一章正文。");
  }

  /**
   * 章节之间使用显式切换，而不是连续页面滚动。
   * 未激活的 Section 同时设置 hidden，确保鼠标、触屏和键盘都无法滚动穿越边界。
   */
  function activateSection(
    sectionId,
    { focus = true, updateHistory = true } = {},
  ) {
    const nextSection = document.getElementById(sectionId);
    if (!nextSection) return;

    pauseAllInterviewAudio();
    if (sectionId !== "section-01") {
      sectionOneVideoController?.pause();
    }
    activeSectionId = sectionId;

    sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (!section) return;
      const isActive = id === sectionId;
      section.hidden = !isActive;
      section.classList.toggle("is-current", isActive);
    });

    activeSectionPanel = nextSection;
    nextSection.scrollTop = 0;
    setActiveSection(sectionId);
    setSectionOneCoverMode(nextSection, sectionId === "section-01");

    if (sectionId === "section-02") {
      resetPerspectiveStage(nextSection);
    }

    if (updateHistory) {
      syncSectionHash(sectionId);
    }

    updateChapterViewportHeight();
    if (!nextSection.classList.contains("is-cover-mode")) {
      initSectionScrollytelling(nextSection);
    }

    if (focus) {
      const focusTarget = nextSection.classList.contains("is-cover-mode")
        ? nextSection.querySelector("[data-enter-story]")
        : nextSection.querySelector(".section-heading h2, .game-entry h2");
      focusTarget?.focus({ preventScroll: true });
    }

    setPageStatus(
      nextSection.classList.contains("is-cover-mode")
        ? "专题封面已加载，点击进入正文。"
        : `已进入章节 ${nextSection.dataset.sectionNumber || ""}。`,
    );
  }

  function updatePerspectiveTabs() {
    const tabs = Array.from(
      document.querySelectorAll("[data-perspective-tab]"),
    );

    tabs.forEach((tab) => {
      const isActive = tab.dataset.perspectiveTab === activePerspectiveId;
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
  }

  function initPersonReader(panel = activeSectionPanel) {
    personReaderController?.destroy();
    personReaderController = null;

    const deck =
      panel?.querySelector(
        `.perspective-panel:not([hidden]) [data-person-deck]`,
      ) || panel?.querySelector("[data-person-deck]");
    const cardsScroller = deck?.querySelector("[data-person-cards]");
    const cards = Array.from(
      deck?.querySelectorAll("[data-person-card-index]") || [],
    );
    if (!deck || !cardsScroller || !cards.length) return;

    const cardCurrent = deck.querySelector("[data-card-current]");
    const cardLabel = deck.querySelector("[data-card-label]");
    const segments = Array.from(
      deck.querySelectorAll("[data-card-progress-segment]"),
    );
    const section = panel.closest(".section-two");
    const heading = section?.querySelector(".perspective-heading");
    const mobileReaderQuery = window.matchMedia("(max-width: 860px)");
    let frame = 0;
    let destroyed = false;

    const syncHeadingVisibility = (measureHeading = false) => {
      if (!section || !heading) return;

      if (measureHeading) {
        const headingHeight = Math.max(
          heading.offsetHeight,
          heading.scrollHeight,
        );
        heading.style.setProperty(
          "--perspective-heading-height",
          `${headingHeight}px`,
        );
      }

      section.classList.toggle(
        "is-reading",
        mobileReaderQuery.matches && cardsScroller.scrollTop > 14,
      );
    };

    const update = () => {
      if (destroyed) return;

      const scrollerRect = cardsScroller.getBoundingClientRect();
      const focusLine = scrollerRect.top + scrollerRect.height * 0.38;
      let activeIndex = 0;

      cards.forEach((card, index) => {
        const cardRect = card.getBoundingClientRect();
        if (cardRect.top <= focusLine) {
          activeIndex = index;
        }
      });

      cards.forEach((card, index) => {
        card.classList.toggle("is-current", index === activeIndex);
        card.classList.toggle("is-passed", index < activeIndex);
      });
      segments.forEach((segment, index) => {
        segment.classList.toggle("is-current", index === activeIndex);
        segment.classList.toggle("is-complete", index < activeIndex);
      });

      if (cardCurrent) {
        cardCurrent.textContent = String(activeIndex + 1).padStart(2, "0");
      }
      if (cardLabel) {
        cardLabel.textContent =
          cards[activeIndex]?.querySelector(".person-card__header span:last-child")
            ?.textContent || "";
      }

      deck.style.setProperty(
        "--card-progress",
        String((activeIndex + 1) / cards.length),
      );
      syncHeadingVisibility();
    };

    const scheduleUpdate = () => {
      if (destroyed || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    cardsScroller.addEventListener("scroll", scheduleUpdate, {
      passive: true,
    });
    const handleResize = () => {
      syncHeadingVisibility(true);
      scheduleUpdate();
    };
    window.addEventListener("resize", handleResize, { passive: true });
    window.visualViewport?.addEventListener("resize", handleResize, {
      passive: true,
    });

    personReaderController = {
      update,
      destroy() {
        destroyed = true;
        if (frame) window.cancelAnimationFrame(frame);
        cardsScroller.removeEventListener("scroll", scheduleUpdate);
        window.removeEventListener("resize", handleResize);
        window.visualViewport?.removeEventListener(
          "resize",
          handleResize,
        );
      },
    };

    initInterviewAudios(deck);
    syncHeadingVisibility(true);
    update();
  }

  function setPersonPullProgress(deck, progress) {
    if (!deck) return;
    const clamped = Math.max(0, Math.min(1, progress));
    deck.style.setProperty("--pull-progress", String(clamped));
    deck.classList.toggle("is-armed", clamped >= 0.96);
  }

  function resetPersonPull(deck, rebound = true) {
    if (!deck) return;
    if (!rebound || reduceMotionQuery.matches) {
      deck.classList.remove("is-dragging", "is-armed", "is-rebounding");
      setPersonPullProgress(deck, 0);
      return;
    }

    deck.classList.remove("is-dragging", "is-armed");
    deck.classList.add("is-rebounding");
    setPersonPullProgress(deck, 0);
    window.setTimeout(() => {
      deck.classList.remove("is-rebounding");
    }, 520);
  }

  function resetPerspectiveStage(panel) {
    const heading = panel?.querySelector(".perspective-heading");
    if (heading) {
      heading.style.transition = "none";
    }

    panel?.classList.remove("is-reading");
    panel
      ?.querySelectorAll(".perspective-panel, .person-deck")
      .forEach((element) => {
        element.classList.remove(
          "is-entering-next",
          "is-entering-previous",
          "is-dragging",
          "is-armed",
          "is-rebounding",
          "is-switching",
          "is-arriving",
        );
      });

    panel
      ?.querySelectorAll("[data-person-deck]")
      .forEach((deck) => setPersonPullProgress(deck, 0));
    panel
      ?.querySelectorAll("[data-person-cards]")
      .forEach((cards) => {
        cards.scrollTop = 0;
      });

    if (heading) {
      heading.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        heading.style.removeProperty("transition");
      });
    }
  }

  function focusActivePersonName() {
    const panel = document.querySelector(
      `.perspective-panel:not([hidden])`,
    );
    const name = panel?.querySelector(".person-bar h3");
    name?.focus({ preventScroll: true });
  }

  function activatePerspective(
    perspectiveId,
    { focus = false } = {},
  ) {
    if (!getPerspective(perspectiveId)) return;

    const previousId = activePerspectiveId;
    if (
      perspectiveId === activePerspectiveId &&
      document.querySelector(".perspective-panel:not([hidden])")
    ) {
      if (focus) focusActivePersonName();
      return;
    }

    pauseAllInterviewAudio();
    activePerspectiveId = perspectiveId;
    activePersonIndices[perspectiveId] = 0;
    updatePerspectiveTabs();

    const panels = Array.from(
      document.querySelectorAll("[data-perspective-panel]"),
    );
    panels.forEach((panel) => {
      const isActive = panel.dataset.perspectivePanel === perspectiveId;
      panel.hidden = !isActive;
      panel.classList.remove(
        "is-entering-next",
        "is-entering-previous",
      );

      if (isActive) {
        const perspective = getPerspective(perspectiveId);
        panel.innerHTML = renderPersonDeck(perspective, 0);
        const perspectiveOrder = data.sectionTwo.perspectives.findIndex(
          (item) => item.id === perspectiveId,
        );
        const previousOrder = data.sectionTwo.perspectives.findIndex(
          (item) => item.id === previousId,
        );
        panel.classList.add(
          perspectiveOrder >= previousOrder
            ? "is-entering-next"
            : "is-entering-previous",
        );
        window.setTimeout(() => {
          panel.classList.remove(
            "is-entering-next",
            "is-entering-previous",
          );
        }, reduceMotionQuery.matches ? 0 : 520);
      }
    });

    initPersonReader(document.getElementById("section-02"));
    const perspective = getPerspective(perspectiveId);
    setPageStatus(`已切换至${perspective.tabLabel}。`);

    if (focus) {
      window.setTimeout(focusActivePersonName, reduceMotionQuery.matches ? 0 : 220);
    }
  }

  function advancePerson() {
    if (personTransitioning) return;

    const perspective = getPerspective();
    const panel = document.querySelector(
      `.perspective-panel[data-perspective-panel="${activePerspectiveId}"]`,
    );
    if (!perspective || !panel) return;

    const personIndex = activePersonIndices[perspective.id] || 0;
    const person = perspective.people[personIndex];
    const destination = getPersonDestination(perspective, personIndex);
    const deck = panel.querySelector("[data-person-deck]");
    if (!person || !deck) return;

    pauseAllInterviewAudio();
    personTransitioning = true;
    setPersonPullProgress(deck, 1);
    deck.classList.add("is-switching");

    const delay = reduceMotionQuery.matches ? 0 : 190;
    window.setTimeout(() => {
      if (destination.action.startsWith("perspective:")) {
        activatePerspective(destination.action.split(":")[1], {
          focus: true,
        });
        personTransitioning = false;
        return;
      }

      if (destination.action === "game") {
        activateSection("section-game");
        personTransitioning = false;
        return;
      }

      const nextIndex = personIndex + 1;
      if (nextIndex >= perspective.people.length) {
        personTransitioning = false;
        return;
      }

      activePersonIndices[perspective.id] = nextIndex;
      panel.innerHTML = renderPersonDeck(perspective, nextIndex);
      const nextDeck = panel.querySelector("[data-person-deck]");
      nextDeck?.classList.add("is-arriving");
      initPersonReader(panel);
      setPageStatus(
        `已进入${perspective.tabLabel}第${nextIndex + 1}位受访者：${perspective.people[nextIndex].name}。`,
      );

      window.setTimeout(() => {
        nextDeck?.classList.remove("is-arriving");
        personTransitioning = false;
        focusActivePersonName();
      }, reduceMotionQuery.matches ? 0 : 560);
    }, delay);
  }

  function handleTabKeydown(event) {
    const currentTab = event.target.closest("[data-perspective-tab]");
    if (!currentTab) return;

    const tabs = Array.from(
      document.querySelectorAll("[data-perspective-tab]"),
    );
    const currentIndex = tabs.indexOf(currentTab);
    let nextIndex = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const target = tabs[nextIndex];
    target.focus();
    activatePerspective(target.dataset.perspectiveTab);
  }

  function initSectionScrollytelling(panel) {
    mediaScroller?.destroy();
    progressScroller?.destroy();
    personReaderController?.destroy();
    sectionOneRevealObserver?.disconnect();
    sectionThreeRevealObserver?.disconnect();
    processStoryController?.destroy();
    sectionThreeIntroController?.destroy();
    sectionThreeClosingController?.destroy();
    mediaScroller = null;
    progressScroller = null;
    personReaderController = null;
    sectionOneRevealObserver = null;
    sectionThreeRevealObserver = null;
    processStoryController = null;
    sectionThreeIntroController = null;
    sectionThreeClosingController = null;

    const mediaSteps = Array.from(panel.querySelectorAll(".media-step"));
    const progressSteps = Array.from(panel.querySelectorAll(".progress-step"));
    const progressVisual = panel.querySelector(".progress-story__visual");

    setProgressImage(progressVisual, 0);
    preloadProgressImages(panel);

    if (!window.scrollama) {
      mediaSteps.forEach((step) => step.classList.add("is-visible"));
      initSectionOneReveals(panel);
      initSectionThreeReveals(panel);
      initSectionThreeProcess(panel);
      initSectionThreeTextIntros(panel);
      initSectionThreeClosing(panel);
      initPersonReader(panel);
      return;
    }

    if (mediaSteps.length) {
      // 当前 Section 是独立滚动容器，因此同时指定观察根节点和滚动容器。
      mediaScroller = window
        .scrollama()
        .setup({
          step: mediaSteps,
          offset: 0.72,
          once: false,
          root: panel,
          container: panel,
        })
        .onStepEnter(({ element }) => {
          element.classList.add("is-visible");
        });
    }

    if (progressSteps.length) {
      // Progress 仅更新一个 CSS 变量，不执行逐帧 DOM 重排。
      progressScroller = window
        .scrollama()
        .setup({
          step: progressSteps,
          offset: 0.52,
          progress: true,
          threshold: 2,
          root: panel,
          container: panel,
        })
        .onStepEnter(({ element }) => {
          const stepIndex = Number(element.dataset.progressIndex);
          if (Number.isInteger(stepIndex)) {
            setProgressImage(progressVisual, stepIndex);
          }
        })
        .onStepProgress(({ progress }) => {
          if (progressVisual) {
            progressVisual.style.setProperty(
              "--scroll-progress",
              String(Math.max(0, Math.min(1, progress))),
            );
          }
        });
    }

    initPersonReader(panel);
    initSectionOneReveals(panel);
    initSectionThreeReveals(panel);
    initSectionThreeProcess(panel);
    initSectionThreeTextIntros(panel);
    initSectionThreeClosing(panel);
  }

  /**
   * 快速滚动时补充捕捉 Section 01 的长图文区块，避免内容停留半透明。
   */
  function initSectionOneReveals(panel) {
    if (!panel?.classList.contains("section-one") || !window.IntersectionObserver) {
      return;
    }

    const cards = Array.from(
      panel.querySelectorAll(
        ".media-step, .section-one__case-lead p, .section-one__case-body p",
      ),
    );
    sectionOneRevealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      {
        root: panel,
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.02,
      },
    );

    cards.forEach((card) => sectionOneRevealObserver.observe(card));
  }

  /**
   * basic 滚动叙事由 Scrollama 驱动；Section 03 再补充视口检测，
   * 防止快速跨屏滚动时整张文本卡被观察器跳过。
   */
  function initSectionThreeReveals(panel) {
    if (!panel?.classList.contains("section-three") || !window.IntersectionObserver) {
      return;
    }

    const cards = Array.from(panel.querySelectorAll(".media-step"));
    sectionThreeRevealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      {
        root: panel,
        rootMargin: "0px 0px -18% 0px",
        threshold: 0.08,
      },
    );

    cards.forEach((card) => sectionThreeRevealObserver.observe(card));
  }

  function initSectionThreeProcess(panel) {
    const story = panel?.querySelector("[data-process-story]");
    if (!story) return;

    const sticky = story.querySelector(".section-three__process-sticky");
    const windowElement = story.querySelector("[data-process-window]");
    const track = story.querySelector("[data-process-track]");
    const line = story.querySelector("[data-process-line]");
    const steps = Array.from(story.querySelectorAll("[data-process-step]"));
    const currentLabel = story.querySelector("[data-process-current]");
    if (!sticky || !windowElement || !track || !line || !steps.length) {
      return;
    }

    let frame = 0;
    let maxShift = 0;
    let destroyed = false;

    const clamp = (value, min, max) =>
      Math.max(min, Math.min(max, value));

    const update = () => {
      if (destroyed) return;
      const panelTop = panel.getBoundingClientRect().top;
      const storyTop = story.getBoundingClientRect().top;
      const available = Math.max(1, story.offsetHeight - sticky.offsetHeight);
      const progress = clamp(
        (panelTop - storyTop) / available,
        0,
        1,
      );
      const activeIndex = Math.min(
        steps.length - 1,
        Math.floor(progress * steps.length),
      );

      track.style.setProperty("--process-shift", `${-progress * maxShift}px`);
      line.style.setProperty("--process-line-progress", String(progress));

      steps.forEach((step, index) => {
        step.classList.toggle("is-current", index === activeIndex);
        step.classList.toggle("is-passed", index < activeIndex);
        const toggle = step.querySelector("[data-process-toggle]");
        if (index === activeIndex) {
          toggle?.setAttribute("aria-current", "step");
        } else {
          toggle?.removeAttribute("aria-current");
        }
      });

      if (currentLabel) {
        currentLabel.textContent =
          steps[activeIndex]?.querySelector(
            ".section-three__process-marker",
          )?.textContent.trim() || "01";
      }
    };

    const scheduleUpdate = () => {
      if (destroyed || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    const measure = () => {
      if (destroyed) return;

      const details = steps.map((step) =>
        step.querySelector("[data-process-details]"),
      );
      const expandedHeight = details.reduce(
        (total, detail) => total + (detail?.offsetHeight || 0),
        0,
      );
      const maxDetailsHeight = details.reduce((maxHeight, detail) => {
        const inner = detail?.querySelector(
          ".section-three__process-details-inner",
        );
        return Math.max(maxHeight, inner?.scrollHeight || 0);
      }, 0);
      const collapsedTrackHeight = Math.max(
        1,
        track.scrollHeight - expandedHeight,
      );
      const projectedTrackHeight =
        collapsedTrackHeight + maxDetailsHeight;

      maxShift = Math.max(
        0,
        projectedTrackHeight - windowElement.clientHeight,
      );
      story.style.height = `${sticky.offsetHeight + maxShift}px`;
      scheduleUpdate();
    };

    const scheduleMeasure = () => {
      if (destroyed) return;
      window.requestAnimationFrame(measure);
    };

    const onToggle = (event) => {
      const toggle = event.target.closest("[data-process-toggle]");
      if (!toggle || !sticky.contains(toggle)) return;

      const selectedStep = toggle.closest("[data-process-step]");
      const shouldOpen = !selectedStep.classList.contains("is-open");

      steps.forEach((step) => {
        const isOpen = step === selectedStep && shouldOpen;
        const stepToggle = step.querySelector("[data-process-toggle]");
        const details = step.querySelector("[data-process-details]");
        step.classList.toggle("is-open", isOpen);
        stepToggle?.setAttribute("aria-expanded", String(isOpen));
        details?.setAttribute("aria-hidden", String(!isOpen));
      });

      scheduleUpdate();
    };

    sticky.addEventListener("click", onToggle);
    panel.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleMeasure, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleMeasure, {
      passive: true,
    });

    processStoryController = {
      destroy() {
        destroyed = true;
        if (frame) window.cancelAnimationFrame(frame);
        sticky.removeEventListener("click", onToggle);
        panel.removeEventListener("scroll", scheduleUpdate);
        window.removeEventListener("resize", scheduleMeasure);
        window.visualViewport?.removeEventListener(
          "resize",
          scheduleMeasure,
        );
      },
    };

    measure();
  }

  function initSectionThreeTextIntros(panel) {
    const intros = Array.from(
      panel?.querySelectorAll("[data-text-intro]") || [],
    );
    if (!intros.length) return;

    let frame = 0;
    let destroyed = false;

    const update = () => {
      if (destroyed) return;

      const panelTop = panel.getBoundingClientRect().top;
      intros.forEach((intro) => {
        const sticky = intro.querySelector(
          ".section-three__intro-sticky",
        );
        const introTop = intro.getBoundingClientRect().top;
        const available = Math.max(
          1,
          intro.offsetHeight - (sticky?.offsetHeight || 0),
        );
        const progress = Math.max(
          0,
          Math.min(1, (panelTop - introTop) / available),
        );

        intro.style.setProperty("--intro-progress", String(progress));
        intro.classList.toggle("is-started", progress > 0.01);

        if (intro.dataset.introKind === "layered") {
          const layers = Array.from(
            intro.querySelectorAll("[data-intro-layer]"),
          );
          const thresholds = [null, 0.28, 0.62];
          layers.forEach((layer, index) => {
            if (index === 0 || progress >= thresholds[index]) {
              layer.classList.add("is-visible");
            }
          });
        }

        if (intro.dataset.introKind === "highlight") {
          const words = Array.from(
            intro.querySelectorAll("[data-intro-word]"),
          );
          const thresholds = [0.16, 0.36, 0.56, 0.76];
          words.forEach((word, index) => {
            if (progress >= thresholds[index]) {
              word.classList.add("is-highlighted");
            }
          });
        }
      });
    };

    const scheduleUpdate = () => {
      if (destroyed || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    panel.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleUpdate, {
      passive: true,
    });

    sectionThreeIntroController = {
      destroy() {
        destroyed = true;
        if (frame) window.cancelAnimationFrame(frame);
        panel.removeEventListener("scroll", scheduleUpdate);
        window.removeEventListener("resize", scheduleUpdate);
        window.visualViewport?.removeEventListener(
          "resize",
          scheduleUpdate,
        );
      },
    };

    update();
  }

  function initSectionThreeClosing(panel) {
    const story = panel?.querySelector("[data-closing-story]");
    if (!story) return;

    const sticky = story.querySelector(
      ".section-three__closing-sticky",
    );
    const lines = Array.from(story.querySelectorAll("[data-closing-line]"));
    if (!sticky || !lines.length) return;

    let frame = 0;
    let destroyed = false;

    const update = () => {
      if (destroyed) return;

      const panelRect = panel.getBoundingClientRect();
      const revealLine =
        panelRect.top + panel.clientHeight * 0.82;

      lines.forEach((line) => {
        if (line.getBoundingClientRect().top <= revealLine) {
          line.classList.add("is-visible");
        }
      });
    };

    const scheduleUpdate = () => {
      if (destroyed || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    panel.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleUpdate, {
      passive: true,
    });

    sectionThreeClosingController = {
      destroy() {
        destroyed = true;
        if (frame) window.cancelAnimationFrame(frame);
        panel.removeEventListener("scroll", scheduleUpdate);
        window.removeEventListener("resize", scheduleUpdate);
        window.visualViewport?.removeEventListener(
          "resize",
          scheduleUpdate,
        );
      },
    };

    update();
  }

  function handlePersonPointerDown(event) {
    const pull = event.target.closest("[data-person-action]");
    if (!pull || event.button !== 0 || personTransitioning) return;

    const deck = pull.closest("[data-person-deck]");
    if (!deck) return;

    personPointerState = {
      pointerId: event.pointerId,
      pull,
      deck,
      startY: event.clientY,
      progress: 0,
      dragging: false,
    };
    pull.setPointerCapture?.(event.pointerId);
  }

  function handlePersonPointerMove(event) {
    const state = personPointerState;
    if (!state || state.pointerId !== event.pointerId) return;

    const distance = Math.max(0, state.startY - event.clientY);
    if (distance > 6) {
      state.dragging = true;
      state.deck.classList.remove("is-rebounding");
      state.deck.classList.add("is-dragging");
      event.preventDefault();
    }

    const threshold = Math.max(82, Math.min(112, window.innerHeight * 0.14));
    state.progress = Math.min(1, distance / threshold);
    setPersonPullProgress(state.deck, state.progress);
  }

  function finishPersonPointer(event, cancelled = false) {
    const state = personPointerState;
    if (!state || state.pointerId !== event.pointerId) return;
    personPointerState = null;
    state.pull.releasePointerCapture?.(event.pointerId);

    if (!state.dragging) {
      state.deck.classList.remove("is-dragging");
      setPersonPullProgress(state.deck, 0);
      return;
    }

    state.deck.classList.remove("is-dragging");

    if (!cancelled && state.progress >= 0.96) {
      suppressPersonClickUntil = performance.now() + 520;
      advancePerson();
      return;
    }

    suppressPersonClickUntil = performance.now() + 360;
    resetPersonPull(state.deck, true);
  }

  function handlePersonPointerUp(event) {
    finishPersonPointer(event);
  }

  function handlePersonPointerCancel(event) {
    finishPersonPointer(event, true);
  }

  function handleAppClick(event) {
    const sectionLink = event.target.closest('a[href^="#section-"]');
    if (sectionLink) {
      event.preventDefault();
      const sectionId = sectionLink.getAttribute("href").slice(1);
      if (sectionIds.includes(sectionId)) {
        activateSection(sectionId);
      }
      return;
    }

    const enterButton = event.target.closest("[data-enter-story]");
    if (enterButton) {
      enterSectionOneStory(enterButton);
      return;
    }

    const perspectiveTab = event.target.closest("[data-perspective-tab]");
    if (perspectiveTab) {
      activatePerspective(perspectiveTab.dataset.perspectiveTab);
      return;
    }

    const personButton = event.target.closest("[data-person-action]");
    if (!personButton) return;
    if (performance.now() < suppressPersonClickUntil) return;
    advancePerson();
  }

  renderPage();
  updatePerspectiveTabs();
  updateChapterViewportHeight();
  activateSection(getInitialSectionId(), { focus: false, updateHistory: true });
  setPageStatus("专题页面已加载。");

  document.addEventListener("click", handleAppClick);
  document.addEventListener("pointerdown", handlePersonPointerDown);
  document.addEventListener("pointermove", handlePersonPointerMove, {
    passive: false,
  });
  document.addEventListener("pointerup", handlePersonPointerUp);
  document.addEventListener("pointercancel", handlePersonPointerCancel);
  document.addEventListener("keydown", (event) => {
    if (event.target.closest('[role="tablist"]')) {
      handleTabKeydown(event);
    }
  });

  window.addEventListener("resize", () => {
    updateChapterViewportHeight();
    mediaScroller?.resize();
    progressScroller?.resize();
    personReaderController?.update();
  });

  window.visualViewport?.addEventListener("resize", () => {
    updateChapterViewportHeight();
  });

  if (window.ResizeObserver && siteHeader) {
    const headerObserver = new ResizeObserver(updateChapterViewportHeight);
    headerObserver.observe(siteHeader);
  }

  window.addEventListener("hashchange", () => {
    const nextSectionId = window.location.hash.replace(/^#/, "");
    if (
      sectionIds.includes(nextSectionId) &&
      nextSectionId !== activeSectionId
    ) {
      activateSection(nextSectionId, { updateHistory: false });
    }
  });
})();
