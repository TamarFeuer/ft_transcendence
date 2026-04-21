import { navigate } from "../routes/route_helpers.js";

export function initLegalPage() {
  const navLinks = document.querySelectorAll("[data-nav-path]");
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const path = link.getAttribute("data-nav-path");
      if (path) {
        navigate(path);
      }
    });
  });
}
