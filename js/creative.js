'use strict';

// Smooth scroll for nav links
document.querySelectorAll('a.page-scroll').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            window.scrollTo({ top: target.offsetTop - 56, behavior: 'smooth' });
        }
        const navCollapse = document.querySelector('.navbar-collapse.show');
        if (navCollapse) {
            bootstrap.Collapse.getInstance(navCollapse).hide();
        }
    });
});

// Toggle scrolled class on navbar: white at top, transparent when scrolled
const mainNav = document.getElementById('mainNav');
const updateNav = () => mainNav.classList.toggle('scrolled', window.scrollY <= 100);
updateNav();
window.addEventListener('scroll', updateNav, { passive: true });
