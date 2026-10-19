/* Сайт тренера — рендер блоков из data/coach.json и интерактив.
   Основной текст лежит в разметке (для SEO). Из JSON берутся: расписание, оборудование,
   FAQ, опыт, образование, достижения, программы, квиз, контакты. */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");
  var DEV = /[?&]dev\b/.test(location.search);
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

  /* ---------- Загрузка данных (fetch, а для file:// — data.js) ---------- */
  function loadData() {
    if (window.COACH_DATA) return Promise.resolve(window.COACH_DATA);
    var viaScript = function () {
      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = "assets/js/data.js";
        s.onload = function () { window.COACH_DATA ? resolve(window.COACH_DATA) : reject(new Error("data.js пуст")); };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    };
    if (location.protocol === "file:") return viaScript();
    return fetch("data/coach.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(viaScript);
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

  function contactButton(label, href, goal, todoLabel, cls) {
    if (!href) {
      return '<a class="btn ' + cls + '" aria-disabled="true" role="link">' + esc(label) + todo(todoLabel) + "</a>";
    }
    var ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : "";
    return '<a class="btn ' + cls + '" href="' + esc(href) + '"' + ext + ' data-goal="' + goal + '">' + esc(label) + "</a>";
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
      var period = t.period ? esc(t.period) : todo("УТОЧНИТЬ: " + (t.todo || "годы"));
      return '<li><span class="period">' + period + "</span><b>" + esc(t.place) + '</b><span class="role">' + esc(t.role) + "</span></li>";
    }).join("");

    var prof = d.officialProfile;
    var profHtml = prof.url
      ? '<a href="' + esc(prof.url) + '" target="_blank" rel="noopener">' + esc(prof.label) + " ↗</a>"
      : esc(prof.label) + " " + todo("УТОЧНИТЬ: ссылка на профиль");
    $("#official-profile").innerHTML = profHtml;
    $("#footer-profile").innerHTML = profHtml;

    // Достижения учеников
    $("#achievements").innerHTML = d.achievements.map(function (a) {
      var more = a.anchor ? ' <a href="' + esc(a.anchor) + '">Подробнее</a>' : "";
      var t = a.todo ? "<br>" + todo("ПОДТВЕРДИТЬ: " + a.todo) : "";
      return '<li class="reveal"><h3>' + esc(a.title) + '</h3><p class="board__desc">' + esc(a.text) + more + t + "</p></li>";
    }).join("");
    if (d.competitionsCaption) $(".strip__caption").textContent = d.competitionsCaption;

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

    // FAQ
    $("#faq-list").innerHTML = d.faq.map(function (f, i) {
      var a = f.a ? esc(f.a) : todo("УТОЧНИТЬ: " + f.todo);
      return '<div class="acc__item"><h3 style="margin:0;font:inherit">' +
        '<button class="acc__btn" type="button" aria-expanded="false" aria-controls="faq-' + i + '" id="faq-btn-' + i + '">' +
        "<span>" + esc(f.q) + '</span><span class="acc__icon" aria-hidden="true"></span></button></h3>' +
        '<div class="acc__panel" id="faq-' + i + '" role="region" aria-labelledby="faq-btn-' + i + '"><div><p>' + a + "</p></div></div></div>";
    }).join("");

    // Отзывы: только реальные. Пусто — блок скрыт (в ?dev — виден TODO)
    var rev = $("#reviews");
    if (d.reviews && d.reviews.length) {
      $("#reviews-list").innerHTML = d.reviews.map(function (r) {
        return '<figure class="review"><blockquote>' + esc(r.text) + "</blockquote><figcaption>" + esc(r.author || "") + "</figcaption></figure>";
      }).join("");
      rev.hidden = false;
      $("[data-reviews-link]").hidden = false;
    } else if (DEV) {
      $("#reviews-list").innerHTML = '<p class="dev-note">TODO: собрать 3–5 реальных отзывов с согласием авторов и добавить в coach.json → reviews. Без отзывов блок скрыт.</p>';
      rev.hidden = false;
    }

    // Контакты
    var c = d.contacts;
    var L = contactLinks(c);
    $("#contact-buttons").innerHTML =
      contactButton("Telegram", L.tg, "messenger_telegram", "УТОЧНИТЬ: Telegram", "btn--gold") +
      contactButton("WhatsApp", L.wa, "messenger_whatsapp", "УТОЧНИТЬ: WhatsApp", "btn--ghost") +
      contactButton(c.phone ? "Позвонить: " + c.phone : "Позвонить", L.tel, "phone_click", "УТОЧНИТЬ: телефон", "btn--ghost");

    var fc = [];
    fc.push("<li>" + (c.phone ? '<a href="' + L.tel + '" data-goal="phone_click">' + esc(c.phone) + "</a>" : "Телефон: " + todo("УТОЧНИТЬ")) + "</li>");
    fc.push("<li>" + (L.tg ? '<a href="' + L.tg + '" target="_blank" rel="noopener" data-goal="messenger_telegram">Telegram</a>' : "Telegram: " + todo("УТОЧНИТЬ")) + "</li>");
    fc.push("<li>" + (L.wa ? '<a href="' + L.wa + '" target="_blank" rel="noopener" data-goal="messenger_whatsapp">WhatsApp</a>' : "WhatsApp: " + todo("УТОЧНИТЬ")) + "</li>");
    if (c.email) fc.push('<li><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a></li>");
    $("#footer-contacts").innerHTML = fc.join("");
    $("#requisites").innerHTML = d.legal.requisites ? esc(d.legal.requisites) : "Реквизиты: " + todo("УТОЧНИТЬ");

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
    var ticking = false;

    function onScroll() {
      var y = window.scrollY;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      header.classList.toggle("is-scrolled", y > 40);
      header.style.setProperty("--p", max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
      var heroBottom = hero.offsetTop + hero.offsetHeight - 120;
      var contacts = $("#contacts").getBoundingClientRect().top < window.innerHeight * 0.6;
      sticky.classList.toggle("is-visible", y > heroBottom && !contacts);
      ticking = false;
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
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
  // Сначала грузится только poster. Видео подключается после полной загрузки страницы
  // и только на десктопе, без prefers-reduced-motion и без экономии трафика.
  function initHeroVideo() {
    var video = $(".hero__video");
    var btn = $(".hero__toggle");
    if (!video) return;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var saveData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")));
    var mobileMq = window.matchMedia("(max-width: 767px)");
    if (reduceMotion || saveData) return;
    if (mobileMq.matches) {
      // Окно расширили до десктопа — подключаем видео тогда
      var onChange = function (e) {
        if (e.matches) return;
        if (mobileMq.removeEventListener) mobileMq.removeEventListener("change", onChange); else mobileMq.removeListener(onChange);
        initHeroVideo();
      };
      if (mobileMq.addEventListener) mobileMq.addEventListener("change", onChange); else mobileMq.addListener(onChange);
      return;
    }

    var userPaused = false;
    function sync() {
      var paused = video.paused;
      btn.setAttribute("aria-pressed", paused ? "true" : "false");
      btn.setAttribute("aria-label", paused ? "Воспроизвести фоновое видео" : "Поставить фоновое видео на паузу");
    }
    function start() {
      [["webm", "video/webm"], ["mp4", "video/mp4"]].forEach(function (t) {
        var src = document.createElement("source");
        src.src = video.getAttribute("data-" + t[0]);
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

    var later = window.requestIdleCallback || function (cb) { setTimeout(cb, 200); };
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
