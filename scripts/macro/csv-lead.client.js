// Download da série do Indicador de Buffett com captura de e-mail. Grava em iacoes_email_leads
// (RLS: anon só insere, só admin lê) com source "buffett-csv" e dispara o CSV.
// Embutido inline pelo render.tsx. É .js de propósito: dentro de template literal do TS as barras
// invertidas da regex sumiriam (ver a regra regex-escaping do validate-html).
(function () {
  var form = document.getElementById('csv-lead');
  if (!form) return;
  var input = document.getElementById('csv-email');
  var msg = document.getElementById('csv-msg');
  var button = form.querySelector('button[type="submit"]');
  var trap = form.querySelector('input[name="website"]');
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var INVALID = 'Digite um e-mail válido para baixar.';
  var sent = {}; // e-mails já gravados nesta visita: baixar de novo não duplica o lead

  function track(ev) { try { _iaTrack(ev); } catch (e) { /* tracking nunca bloqueia o download */ } }

  function download() {
    var a = document.createElement('a');
    a.href = form.getAttribute('data-csv');
    a.setAttribute('download', '');
    document.body.appendChild(a);
    a.click();
    a.remove();
    msg.textContent = 'Download iniciado. Obrigado!';
    button.disabled = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = (input.value || '').trim().toLowerCase();
    input.value = email; // valida o valor limpo (o trim do JS tira NBSP/BOM que o navegador mantém)
    if (email.length > 254 || !EMAIL.test(email) || (input.validity && input.validity.typeMismatch)) {
      input.setAttribute('aria-invalid', 'true');
      // Alterna um espaço inseparável no fim para o leitor de tela anunciar o erro de novo.
      msg.textContent = msg.textContent === INVALID ? INVALID + ' ' : INVALID;
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    button.disabled = true;
    msg.textContent = 'Preparando o download…';
    // Campo invisível preenchido = robô: entrega o arquivo, mas não grava lead.
    if ((trap && trap.value) || sent[email]) { download(); return; }

    // O download sai assim que a gravação responde, ou em no máximo 2,5 s; com keepalive o insert
    // termina mesmo depois. Se a gravação falhar, a pessoa recebe o arquivo e vai o evento de erro.
    var done = false;
    var go = function () { if (!done) { done = true; download(); } };
    var timer = setTimeout(go, 2500);
    var finish = function (ok) {
      clearTimeout(timer);
      if (ok) sent[email] = true;
      track(ok ? 'lead_buffett_csv' : 'lead_buffett_csv_erro');
      go();
    };
    try {
      fetch(_iaB + '/rest/v1/iacoes_email_leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: _iaK, Authorization: 'Bearer ' + _iaK, Prefer: 'return=minimal' },
        keepalive: true,
        body: JSON.stringify({ name: '', email: email, source: 'buffett-csv' })
      }).then(function (r) { finish(r.ok); }, function () { finish(false); });
    } catch (err) {
      finish(false);
    }
  });

  // Só agora o botão funciona: sem JS ele fica desabilitado e o e-mail nunca vai para a URL.
  button.disabled = false;
})();
