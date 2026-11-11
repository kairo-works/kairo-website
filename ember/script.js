/* Ember landing page — quiet interactions only:
   mobile menu, phone action bar, booking form validation. */
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
     hide on any screen that already shows a booking action. */
  var bar = document.querySelector(".actionbar");
  var heroBtn = document.querySelector(".hero-side .btn");
  var book = document.getElementById("book");
  if (bar && heroBtn && "IntersectionObserver" in window) {
    var heroGone = false;
    var bookVisible = false;
    var update = function () {
      bar.classList.toggle("visible", heroGone && !bookVisible);
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
  }

  /* Booking form: validate each field, error under its own field,
     focus the first field to fix. The form itself posts to the
     mailto: address in its action. */
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
      var name = document.getElementById("f-name");
      var email = document.getElementById("f-email");
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
      check(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()));
      check(date, date.value.trim().length > 2);
      check(guests, /^[0-9]+$/.test(guests.value.trim()) && parseInt(guests.value.trim(), 10) >= 1 && parseInt(guests.value.trim(), 10) <= 40);
      if (!ok) {
        e.preventDefault();
        if (status) status.textContent = "Please fix the fields marked above.";
        if (firstBad) firstBad.focus();
      }
    });
    form.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", function () {
        setError(input, false);
        if (status) status.textContent = "";
      });
    });
  }
})();
