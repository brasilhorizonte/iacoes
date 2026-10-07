/* Script inline das páginas /ferramentas/ (lido de arquivo: nada de template literal do TS em
   volta, regra regex-escaping do validate-html). ES5 de propósito (in-app browsers).
   Scroll depth: cada [data-scroll="scroll_NN"] dispara _iaTrack uma vez quando entra na tela.
   Os widgets ficam no bundle de widgets (carregado com defer no head de cada ferramenta). */
(function () {
  if (!('IntersectionObserver' in window) || typeof window._iaTrack !== 'function') return;
  var seen = {};
  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].isIntersecting) continue;
      var key = entries[i].target.getAttribute('data-scroll');
      io.unobserve(entries[i].target);
      if (!key || seen[key]) continue;
      seen[key] = 1;
      try { window._iaTrack(key); } catch (e) { /* tracking nunca quebra a página */ }
    }
  }, { threshold: 0.1 });
  var els = document.querySelectorAll('[data-scroll]');
  for (var j = 0; j < els.length; j++) io.observe(els[j]);
})();
