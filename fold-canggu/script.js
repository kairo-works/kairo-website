/* Fold Canggu landing page — quiet interactions only:
   mobile menu, phone action bar, booking form validation that
   opens WhatsApp with a prefilled booking message. */
(function () {
  "use strict";

  /* Mobile menu */
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* Phone action bar: show once the hero button has scrolled away,
     hide on any screen that already shows a booking action — the booking
     form and the footer — so the bar never covers text or a form. */
  var bar = document.querySelector(".actionbar");
  var heroBtn = document.querySelector(".hero-cta .btn");
  var book = document.getElementById("book");
  var footer = document.querySelector(".site-footer");
  if (bar && heroBtn && "IntersectionObserver" in window) {
    var heroGone = false;
    var bookVisible = false;
    var footerVisible = false;
    var update = function () {
      bar.classList.toggle("visible", heroGone && !bookVisible && !footerVisible);
    };
    new IntersectionObserver(function (entries) {
      heroGone = !entries[0].isIntersecting;
      update();
    }).observe(heroBtn);
    if (book) {
      new IntersectionObserver(function (entries) {
        bookVisible = entries[0].isIntersecting;
        update();
      }, { threshold: 0.05 }).observe(book);
    }
    if (footer) {
      new IntersectionObserver(function (entries) {
        footerVisible = entries[0].isIntersecting;
        update();
      }, { threshold: 0.02 }).observe(footer);
    }
  }

  /* Booking form: validate each field, error under its own field,
     focus the first field to fix. On success, open WhatsApp with a
     prefilled booking message to the restaurant's number. */
  var form = document.querySelector(".booking-form");
  if (form) {
    var status = form.querySelector("[data-form-status]");
    var setError = function (input, hasError) {
      var err = document.getElementById(input.getAttribute("aria-describedby"));
      if (err) err.hidden = !hasError;
      input.setAttribute("aria-invalid", String(hasError));
      return !hasError;
    };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("f-name");
      var date = document.getElementById("f-date");
      var guests = document.getElementById("f-guests");
      var firstBad = null;
      var ok = true;
      var check = function (input, valid) {
        if (!setError(input, !valid)) {
          ok = false;
          if (!firstBad) firstBad = input;
        }
      };
      check(name, name.value.trim().length > 1);
      check(date, date.value.trim().length > 2);
      check(guests, /^[0-9]+$/.test(guests.value.trim()) && parseInt(guests.value.trim(), 10) >= 1 && parseInt(guests.value.trim(), 10) <= 40);
      if (!ok) {
        if (status) status.textContent = "Please fix the fields marked above.";
        if (firstBad) firstBad.focus();
        return;
      }
      var msg = "Hi Fold! I'd like to book a table.\nName: " + name.value.trim() +
        "\nDate: " + date.value.trim() +
        "\nGuests: " + guests.value.trim();
      if (status) status.textContent = form.getAttribute("data-sent") || "Opening WhatsApp…";
      window.open("https://wa.me/6287777276634?text=" + encodeURIComponent(msg), "_blank", "noopener");
    });
    form.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", function () {
        setError(input, false);
        if (status) status.textContent = "";
      });
    });
  }
})();
