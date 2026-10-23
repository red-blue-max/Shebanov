/* Сайт тренера — рендер блоков из data/coach.json и интерактив.
   Основной текст лежит в разметке (для SEO). Из JSON берутся: расписание, оборудование,
   FAQ, опыт, образование, достижения, программы, квиз, контакты. */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Утилиты ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function todo(label) { return '<span class="todo" data-todo>[' + esc(label) + "]</span>"; }
  function get(obj, path) { return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }

  function track(goal) {
    if (typeof window.ym === "function" && window.METRIKA_ID) window.ym(window.METRIKA_ID, "reachGoal", goal);
  }

  /* ---------- Загрузка данных: встроены в страницу сборкой; запасной вариант — data/coach.json ---------- */
  function loadData() {
    var inline = document.getElementById("coach-data");
    if (inline) {
      try { return Promise.resolve(JSON.parse(inline.textContent)); } catch (e) { /* ниже — запасной путь */ }
    }
    return fetch("data/coach.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  /* ---------- Ссылки на мессенджеры ---------- */
  function contactLinks(c, extra) {
    var text = encodeURIComponent(c.message + (extra || ""));
    var tg = c.telegram ? "https://t.me/" + c.telegram.replace(/^@/, "") + "?text=" + text : "";
    var phoneDigits = (c.whatsapp || c.phone || "").replace(/\D/g, "");
    var wa = c.whatsapp ? "https://wa.me/" + phoneDigits + "?text=" + text : "";
    var tel = c.phone ? "tel:+" + c.phone.replace(/\D/g, "") : "";
    return { tg: tg, wa: wa, tel: tel, primary: tg || wa || tel || "" };
  }

  /* ---------- Иконки контактов (монохромные, цвет — currentColor) ---------- */
  var ICONS = {
    telegram: "M21.94 4.3 18.7 19.6c-.24 1.07-.88 1.34-1.78.83l-4.93-3.63-2.38 2.29c-.26.26-.48.48-.99.48l.35-5.02 9.14-8.26c.4-.35-.09-.55-.62-.2L6.2 13.2l-4.86-1.52c-1.06-.33-1.08-1.06.22-1.57L20.55 2.8c.88-.32 1.65.2 1.39 1.5z",
    whatsapp: "M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.5 9.5 0 0 1-4.84-1.33l-.35-.21-3.6.94.96-3.5-.23-.36A9.46 9.46 0 0 1 2.5 12C2.5 6.75 6.78 2.5 12.05 2.5c2.55 0 4.95 1 6.75 2.8a9.45 9.45 0 0 1 2.79 6.72c0 5.25-4.28 9.48-9.54 9.48zm8.12-17.6A11.4 11.4 0 0 0 12.05.5C5.7.5.53 5.65.53 12c0 2.03.53 4.01 1.54 5.76L.43 23.5l5.88-1.54A11.5 11.5 0 0 0 12.05 23.5c6.34 0 11.52-5.16 11.52-11.5 0-3.07-1.2-5.96-3.4-8.1z",
    phone: "M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z",
    mail: "M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"
  };
  function icon(name) {
    return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + ICONS[name] + '"/></svg>';
  }

  function contactButton(label, href, goal, todoLabel, cls, ico) {
    if (!href) {
      return '<a class="btn ' + cls + '" aria-disabled="true" role="link">' + (ico ? icon(ico) : "") + esc(label) + todo(todoLabel) + "</a>";
    }
    var ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : "";
    return '<a class="btn ' + cls + '" href="' + esc(href) + '"' + ext + ' data-goal="' + goal + '">' + (ico ? icon(ico) : "") + esc(label) + "</a>";
  }

  /* ---------- Рендер ---------- */
  function render(d) {
    // Простые подстановки
    $$("[data-bind]").forEach(function (el) {
      var v = get(d, el.getAttribute("data-bind"));
      if (v) { el.textContent = v; }
      else if (el.hasAttribute("data-todo-label")) { el.outerHTML = todo(el.getAttribute("data-todo-label")); }
    });

    // Образование
    $("#education").innerHTML = d.education.map(function (e) {
      var detail = e.detail ? esc(e.detail) : "";
      if (e.todo) detail += (detail ? " " : "") + todo("УТОЧНИТЬ: " + e.todo);
      return "<li><b>" + esc(e.title) + "</b><span>" + detail + "</span></li>";
    }).join("");

    // Опыт
    $("#timeline").innerHTML = d.timeline.map(function (t) {
      var period = t.period ? esc(t.period) : (t.todo ? todo("УТОЧНИТЬ: " + t.todo) : "");
      return "<li>" + (period ? '<span class="period">' + period + "</span>" : "") + "<b>" + esc(t.place) + "</b>" +
        (t.role ? '<span class="role">' + esc(t.role) + "</span>" : "") + "</li>";
    }).join("");

    // Достижения учеников (блок может отсутствовать в разметке)
    if ($("#achievements")) {
      $("#achievements").innerHTML = d.achievements.map(function (a) {
        return '<li class="reveal"><h3>' + esc(a.title) + '</h3><p class="board__desc">' + esc(a.text) + "</p></li>";
      }).join("");
    }

    // Методика
    $("#method-steps").innerHTML = d.method.steps.map(function (s) {
      return '<li class="reveal"><h3>' + esc(s.title) + "</h3><p>" + esc(s.text) + "</p></li>";
    }).join("");
    $("#principles").innerHTML = d.method.principles.map(esc).join('<i aria-hidden="true"></i>');

    // Программы
    $("#programs-list").innerHTML = d.programs.map(function (p, i) {
      return '<article class="program reveal' + (i === 0 ? " program--lead" : "") + '" id="program-' + esc(p.id) + '">' +
        '<p class="program__n">0' + (i + 1) + "</p><h3>" + esc(p.title) + "</h3><p>" + esc(p.text) + "</p>" +
        '<p class="program__meta">' + esc(p.meta) + "</p></article>";
    }).join("");

    // Расписание
    $(".schedule h2").textContent = d.schedule.title;
    $("#schedule-body").innerHTML = d.schedule.rows.map(function (r) {
      return "<tr><td>" + esc(r.days) + "</td><td>" + esc(r.time) + "</td><td>" + esc(r.age) + "</td></tr>";
    }).join("");
    $("#schedule-notes").innerHTML = (d.schedule.notes || []).map(function (n) { return "<p>" + esc(n) + "</p>"; }).join("");
    if (d.location.mapUrl) $("#map-link").href = d.location.mapUrl;
    if (d.location.routeUrl && $("#route-link")) $("#route-link").href = d.location.routeUrl;

    // FAQ
    $("#faq-list").innerHTML = d.faq.map(function (f, i) {
      var a = f.a ? esc(f.a) : todo("УТОЧНИТЬ: " + f.todo);
      return '<div class="acc__item"><h3 style="margin:0;font:inherit">' +
        '<button class="acc__btn" type="button" aria-expanded="false" aria-controls="faq-' + i + '" id="faq-btn-' + i + '">' +
        "<span>" + esc(f.q) + '</span><span class="acc__icon" aria-hidden="true"></span></button></h3>' +
        '<div class="acc__panel" id="faq-' + i + '" role="region" aria-labelledby="faq-btn-' + i + '"><div><p>' + a + "</p></div></div></div>";
    }).join("");

    // Отзывы: блок в разметке пока не нужен (отзывов нет). Если появится <section id="reviews">, заполнится из coach.json
    var rev = $("#reviews");
    if (rev && d.reviews && d.reviews.length) {
      $("#reviews-list").innerHTML = d.reviews.map(function (r) {
        return '<figure class="review"><blockquote>' + esc(r.text) + "</blockquote><figcaption>" + esc(r.author || "") + "</figcaption></figure>";
      }).join("");
      rev.hidden = false;
    }

    // Контакты
    var c = d.contacts;
    var L = contactLinks(c);
    $("#contact-buttons").innerHTML =
      contactButton("Telegram", L.tg, "messenger_telegram", "УТОЧНИТЬ: Telegram", "btn--gold", "telegram") +
      contactButton("WhatsApp", L.wa, "messenger_whatsapp", "УТОЧНИТЬ: WhatsApp", "btn--ghost", "whatsapp") +
      contactButton(c.phone ? "Позвонить: " + c.phone : "Позвонить", L.tel, "phone_click", "УТОЧНИТЬ: телефон", "btn--ghost", "phone");

    var fc = [];
    if (c.phone) fc.push('<li><a href="' + L.tel + '" data-goal="phone_click">' + icon("phone") + esc(c.phone) + "</a></li>");
    if (L.tg) fc.push('<li><a href="' + L.tg + '" target="_blank" rel="noopener" data-goal="messenger_telegram">' + icon("telegram") + "Telegram</a></li>");
    if (L.wa) fc.push('<li><a href="' + L.wa + '" target="_blank" rel="noopener" data-goal="messenger_whatsapp">' + icon("whatsapp") + "WhatsApp</a></li>");
    if (c.email) fc.push('<li><a href="mailto:' + esc(c.email) + '">' + icon("mail") + esc(c.email) + "</a></li>");
    $("#footer-contacts").innerHTML = fc.join("");

    // Все кнопки «Записаться»: сразу в мессенджер, если контакты есть
    if (L.primary) {
      $$("[data-cta]").forEach(function (a) {
        a.href = L.primary;
        if (/^https?:/.test(L.primary)) { a.target = "_blank"; a.rel = "noopener"; }
      });
    }

    $("#year").textContent = new Date().getFullYear();

    initQuiz(d);
    initAccordion();
    initReveal();
  }

  /* ---------- Квиз ---------- */
  function initQuiz(d) {
    var box = $("#quiz .quiz__body");
    var prog = $("#quiz .quiz__progress");
    var qs = d.quiz.questions;
    var answers = {};
    var labels = [];
    var byId = {};
    d.programs.forEach(function (p) { byId[p.id] = p; });

    function pick(a) {
      var basic = a.level === "no" || a.level === "some";
      if (a.goal === "openwater") return { id: "openwater", why: basic
        ? "Сначала уверенно освоим технику и дыхание в бассейне, затем — специальная подготовка к открытой воде."
        : "Работаем над ритмом, навигацией, стартом в группе и выносливостью на длинной дистанции." };
      if (a.goal === "compete") return basic
        ? { id: "individual", why: "Для стартов нужна крепкая база: начнём с техники персонально, затем перейдём к соревновательной подготовке." }
        : { id: "competition", why: "Уже есть база — можно работать на старты, повороты, темп и разряды." };
      if (a.who === "small") return { id: "individual", why: "Группы — от 6 лет, поэтому малышей начинаем персонально: спокойно, с игр и знакомства с водой." };
      if (a.who === "adult") return { id: "individual", why: "Для взрослых — персональные тренировки под вашу цель и график." };
      if (a.format === "individual") return { id: "individual", why: "Персонально — быстрее всего: всё внимание тренера на технике и слабых местах." };
      if (a.level === "no" && a.format !== "group") return { id: "individual", why: "С нуля спокойнее и быстрее начать персонально, а потом перейти в группу." };
      return { id: "groups", why: "Группа даёт регулярность, технику и командный дух." };
    }

    function tips(a, id) {
      var t = [];
      if (a.start === "soon") t.push("До старта немного времени — лучше заниматься 2–3 раза в неделю, план выстроим под дату соревнований.");
      if (id === "groups" && a.freq === "3") t.push("Группы занимаются 2 раза в неделю; третью тренировку можно добавить персонально.");
      if (id === "groups" && a.freq === "1") t.push("Группы занимаются 2 раза в неделю — так прогресс заметнее.");
      if (id !== "groups" && a.format === "group" && (a.who === "kid" || a.who === "teen")) t.push("Позже можно перейти в группу по возрасту.");
      return t;
    }

    function groupsFor(who) {
      return d.schedule.rows.filter(function (r) {
        var m = r.age.match(/(\d+)\D+(\d+)/);
        if (!m) return true;
        return who === "teen" ? +m[2] >= 15 : +m[1] <= 8;
      }).map(function (r) { return r.days + " " + r.time + " (" + r.age + ")"; }).join("; ");
    }

    function step() {
      var i = labels.length;
      if (i < qs.length) {
        prog.textContent = "Вопрос " + (i + 1) + " из " + qs.length;
        box.innerHTML = '<p class="quiz__q">' + esc(qs[i].q) + '</p><div class="quiz__opts">' +
          qs[i].options.map(function (o, k) { return '<button type="button" class="quiz__opt" data-k="' + k + '">' + esc(o.label) + "</button>"; }).join("") + "</div>";
        return;
      }
      var r = pick(answers);
      var p = byId[r.id];
      var times = r.id === "groups" ? groupsFor(answers.who) : "";
      var extra = tips(answers, r.id);
      var summary = "\nПодбор программы: " + p.title + "\n" + labels.join("\n");
      var L = contactLinks(d.contacts, summary);
      prog.textContent = "Готово";
      box.innerHTML = '<div class="quiz__result"><p class="quiz__q" style="margin-bottom:6px">Вам подойдёт:</p><h4>' + esc(p.title) + "</h4><p>" + esc(r.why) + "</p>" +
        extra.map(function (x) { return "<p>" + esc(x) + "</p>"; }).join("") +
        (times ? "<p>Подходящие группы: " + esc(times) + ".</p>" : "") +
        '<div class="quiz__actions">' +
        (L.primary
          ? '<a class="btn btn--gold" href="' + esc(L.primary) + '" target="_blank" rel="noopener" data-goal="cta_signup">Записаться с этими ответами</a>'
          : '<a class="btn btn--gold" href="#contacts" data-goal="cta_signup">Записаться</a>') +
        '<button type="button" class="quiz__restart">Пройти заново</button></div></div>';
    }

    box.addEventListener("click", function (e) {
      var opt = e.target.closest(".quiz__opt");
      if (opt) {
        var q = qs[labels.length], o = q.options[+opt.getAttribute("data-k")];
        answers[q.id] = o.value;
        labels.push(q.q + " " + o.label);
        step();
        var f = box.querySelector("button, a"); if (f) f.focus({ preventScroll: true });
        return;
      }
      if (e.target.closest(".quiz__restart")) { answers = {}; labels = []; step(); }
    });
    step();
  }

  /* ---------- Аккордеон ---------- */
  function initAccordion() {
    $("#faq-list").addEventListener("click", function (e) {
      var btn = e.target.closest(".acc__btn");
      if (!btn) return;
      btn.setAttribute("aria-expanded", btn.getAttribute("aria-expanded") === "true" ? "false" : "true");
    });
  }

  /* ---------- Появление блоков ---------- */
  function initReveal() {
    var els = $$(".reveal, .section h2, .stat, .start__steps li, .gallery__grid li");
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    els.forEach(function (el) { el.classList.add("reveal"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Шапка, прогресс, липкая кнопка, меню ---------- */
  function initChrome() {
    var header = $(".header");
    var sticky = $(".sticky-cta");
    var hero = $(".hero");
    var heroWave = $(".hero > .wave");
    var heroMedia = $(".hero__media");
    var ticking = false;

    function onScroll() {
      var y = window.scrollY;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      // Шапка прозрачная, пока под ней видео; синий фон — когда под ней уже текст или следующий блок.
      // На компьютере видео — фон всего первого экрана (граница — волна внизу),
      // на телефоне вертикально видео — отдельный блок сверху (граница — начало текста под ним).
      var videoIsBlock = heroMedia && getComputedStyle(heroMedia).position === "relative";
      var heroEdge = videoIsBlock ? $(".hero__text").getBoundingClientRect().top - 10
        : (heroWave ? heroWave.getBoundingClientRect().top : hero.getBoundingClientRect().bottom);
      header.classList.toggle("is-scrolled", heroEdge <= header.offsetHeight);
      header.style.setProperty("--p", max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
      var heroBottom = hero.offsetTop + hero.offsetHeight - 120;
      var contacts = $("#contacts").getBoundingClientRect().top < window.innerHeight * 0.6;
      sticky.classList.toggle("is-visible", y > heroBottom && !contacts);
      ticking = false;
    }
    var schedule = function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    onScroll();

    var burger = $(".burger");
    var nav = $("#nav");
    function setMenu(open) {
      burger.setAttribute("aria-expanded", open);
      burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      nav.classList.toggle("is-open", open);
      header.classList.toggle("menu-open", open);
    }
    burger.addEventListener("click", function () { setMenu(burger.getAttribute("aria-expanded") !== "true"); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); burger.focus(); } });

    // Активный пункт меню
    if ("IntersectionObserver" in window) {
      var links = {};
      $$(".nav a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var a = links[en.target.id];
          if (a && en.isIntersecting) { $$(".nav a.is-active").forEach(function (x) { x.classList.remove("is-active"); }); a.classList.add("is-active"); }
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
    }

    // Цели Метрики
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      if (a.hasAttribute("data-cta")) track("cta_signup");
      var g = a.getAttribute("data-goal");
      if (g) track(g);
    });
  }

  /* ---------- Счётчики ---------- */
  function initCounters() {
    var els = $$(".count");
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target, to = +el.getAttribute("data-count"), t0 = performance.now();
        (function tick(now) {
          var k = Math.min(1, (now - t0) / 1200);
          el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(tick);
        })(t0);
      });
    });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Lightbox ---------- */
  function initLightbox() {
    var dlg = $("#lightbox");
    var img = $("img", dlg);
    var items = $$(".g-item");
    var idx = 0;
    function show(i) {
      idx = (i + items.length) % items.length;
      var it = items[idx];
      img.src = it.getAttribute("data-full");
      img.width = +it.getAttribute("data-w");
      img.height = +it.getAttribute("data-h");
      img.alt = $("img", it).alt;
    }
    items.forEach(function (it, i) {
      it.setAttribute("aria-label", "Открыть фото: " + $("img", it).alt);
      it.addEventListener("click", function () {
        show(i);
        if (typeof dlg.showModal === "function") dlg.showModal(); else window.open(it.getAttribute("data-full"), "_blank");
      });
    });
    $(".lightbox__close", dlg).addEventListener("click", function () { dlg.close(); });
    $(".lightbox__prev", dlg).addEventListener("click", function () { show(idx - 1); });
    $(".lightbox__next", dlg).addEventListener("click", function () { show(idx + 1); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
    dlg.addEventListener("close", function () { if (items[idx]) items[idx].focus(); });
  }

  /* ---------- Видео-фон hero ---------- */
  // Сначала грузится только poster. Видео подключается после полной загрузки страницы,
  // кроме prefers-reduced-motion и экономии трафика. На телефоне и планшете — версия 720p.
  function initHeroVideo() {
    var video = $(".hero__video");
    var btn = $(".hero__toggle");
    if (!video) return;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var saveData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")));
    // Телефон и планшет (короткая сторона экрана < 1100 px) — лёгкая 720p-версия, подходит для обеих ориентаций
    var phone = window.matchMedia("(max-width: 1099px)").matches;
    var suffix = phone ? "-mobile" : "";
    var poster = video.getAttribute(phone ? "data-poster-mobile" : "data-poster");
    if (poster) video.poster = poster;
    if (reduceMotion || saveData) return;

    var userPaused = false;
    function sync() {
      var paused = video.paused;
      btn.setAttribute("aria-pressed", paused ? "true" : "false");
      btn.setAttribute("aria-label", paused ? "Воспроизвести фоновое видео" : "Поставить фоновое видео на паузу");
    }
    function start() {
      [["mp4", "video/mp4"]].forEach(function (t) {
        var url = video.getAttribute("data-" + t[0] + suffix);
        if (!url) return;
        var src = document.createElement("source");
        src.src = url;
        src.type = t[1];
        video.appendChild(src);
      });
      video.load();
      var p = video.play();
      if (p && p.catch) p.catch(function () { sync(); });
      btn.hidden = false;
    }
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("error", function () { btn.hidden = true; }, true);
    btn.addEventListener("click", function () {
      if (video.paused) { userPaused = false; video.play(); } else { userPaused = true; video.pause(); }
    });

    // Не крутить видео, когда hero вне экрана
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!video.currentSrc) return;
          if (en.isIntersecting) { if (!userPaused) video.play().catch(function () {}); }
          else if (!video.paused) video.pause();
        });
      }).observe($(".hero"));
    }

    // В простое после загрузки, но не позже чем через 1,5 с (rIC может долго не срабатывать)
    var later = function (cb) {
      if (window.requestIdleCallback) window.requestIdleCallback(cb, { timeout: 1500 }); else setTimeout(cb, 200);
    };
    if (document.readyState === "complete") later(start);
    else window.addEventListener("load", function () { later(start); }, { once: true });
  }

  initChrome();
  initCounters();
  initLightbox();
  initHeroVideo();
  loadData().then(render).catch(function (err) {
    console.warn("Не удалось загрузить данные тренера:", err);
  });
})();
