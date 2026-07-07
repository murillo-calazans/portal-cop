/* ============================================================
   js/theme.js
   Controle de tema claro/escuro
   ============================================================ */

(function() {
  const themeToggle = document.getElementById('themeToggle');
  const icon = themeToggle.querySelector('i');

  // Verifica preferência salva
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    icon.classList.replace('fa-moon', 'fa-sun');
  }

  // Alterna tema
  themeToggle.addEventListener('click', function() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    icon.classList.toggle('fa-moon', !isDark);
    icon.classList.toggle('fa-sun', isDark);
  });
})();