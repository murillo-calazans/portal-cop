/* ============================================================
   js/relatorio.js
   Relatório/escala do mês (plantões + feriados + férias)
   Abre em nova aba com opções: imprimir/PDF, copiar p/ e-mail, baixar HTML
   ============================================================ */

function escaparHTML(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Monta o corpo do relatório com estilos inline (para colar no Outlook/Gmail sem perder formatação)
function montarCorpoRelatorio(mesRef, dados) {
  const year = mesRef.getFullYear();
  const month = mesRef.getMonth();
  const primeiroDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);
  const noMes = d => d && d.getMonth() === month && d.getFullYear() === year;

  const nomeMes = mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const tituloMes = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

  // Feriados do mês (nome por dia) e escalados (plantões + escalas lançadas na aba feriados)
  const feriadoPorDia = new Map();
  const escalados = [];
  (dados.feriados || []).forEach(f => {
    const d = excelDateToJSDate(f.Data);
    if (!noMes(d)) return;
    const key = d.toDateString();
    if (!feriadoPorDia.has(key)) feriadoPorDia.set(key, (f.Tipo || f.Nome || f.Feriado || 'Feriado').trim());
    if (f.Colaborador) escalados.push({ data: d, nome: f.Colaborador.trim(), horario: f.Horário });
  });
  (dados.plantoes || []).forEach(p => {
    const d = excelDateToJSDate(p.Data);
    if (noMes(d) && p.Colaborador) escalados.push({ data: d, nome: p.Colaborador.trim(), horario: p.Horário });
  });

  // Dias exibidos: todo sábado/domingo do mês + feriados + qualquer dia com escala lançada
  const dias = new Map();
  for (let d = new Date(primeiroDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6 || feriadoPorDia.has(d.toDateString())) {
      dias.set(d.toDateString(), { data: new Date(d), pessoas: [] });
    }
  }
  escalados.forEach(e => {
    const key = e.data.toDateString();
    if (!dias.has(key)) dias.set(key, { data: e.data, pessoas: [] });
    dias.get(key).pessoas.push(e);
  });
  const listaDias = [...dias.values()].sort((a, b) => a.data - b.data);

  // Estilos inline reutilizados
  const th = 'padding:8px 10px;background:#1e3a6e;color:#fff;font-size:13px;text-align:left;border:1px solid #1e3a6e;';
  const td = 'padding:7px 10px;font-size:13px;border:1px solid #d5dbe5;vertical-align:top;';
  const h2 = 'font-size:16px;color:#1e3a6e;margin:26px 0 8px;';

  let linhasEscala = '';
  listaDias.forEach((dia, i) => {
    const feriado = feriadoPorDia.get(dia.data.toDateString());
    const fds = dia.data.getDay() === 0 || dia.data.getDay() === 6;
    const fundo = feriado ? '#fff6e0' : (i % 2 ? '#f5f7fb' : '#ffffff');
    const ocasiao = feriado ? `<b style="color:#a86500;">★ ${escaparHTML(feriado)}</b>` : (fds ? 'Fim de semana' : '');
    const pessoas = dia.pessoas.length
      ? dia.pessoas.map(p => `<b>${escaparHTML(p.nome)}</b> <span style="color:#555;">— ${escaparHTML(p.horario || '08:00 às 17:00')}</span>`).join('<br>')
      : '<span style="color:#b00020;">A definir</span>';
    linhasEscala += `<tr style="background:${fundo};">
      <td style="${td}white-space:nowrap;">${formatarDataCurta(dia.data)}</td>
      <td style="${td}white-space:nowrap;">${DIAS_SEMANA[dia.data.getDay()]}</td>
      <td style="${td}">${ocasiao}</td>
      <td style="${td}">${pessoas}</td>
    </tr>`;
  });

  const totalEscalados = new Set(escalados.map(e => e.nome)).size;

  // Férias que cruzam o mês
  const feriasMes = (dados.ferias || [])
    .map(f => ({ nome: f.Nome, inicio: excelDateToJSDate(f.Início), fim: excelDateToJSDate(f.Fim) }))
    .filter(f => f.inicio && f.fim && f.inicio <= ultimoDia && f.fim >= primeiroDia)
    .sort((a, b) => a.inicio - b.inicio);
  const linhasFerias = feriasMes.map((f, i) => `<tr style="background:${i % 2 ? '#f5f7fb' : '#fff'};">
      <td style="${td}"><b>${escaparHTML(f.nome)}</b></td>
      <td style="${td}">${formatarDataCurta(f.inicio)} a ${formatarDataCurta(f.fim)}</td>
    </tr>`).join('');

  // A aba férias usa o nome completo ("MARIA ISABELLY ...") e a de colaboradores o curto ("Maria Isabelly"):
  // casa quando todas as palavras do nome curto aparecem no nome completo
  const palavras = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/\s+/).filter(Boolean);
  const feriasDe = nome => {
    const curto = palavras(nome);
    return feriasMes.find(f => { const completo = palavras(f.nome); return curto.length && curto.every(w => completo.includes(w)); });
  };
  const diaMes = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const temCargo = (dados.colaboradores || []).some(c => c.Cargo && c.Cargo.trim());

  // Horário de segunda a sexta (aba colaboradores: "Seg. a Qui.|07:00 às 17:00|  Sexta |07:00 às 16:00|")
  const linhasHorarios = (dados.colaboradores || [])
    .filter(c => c.Nome)
    .map((c, i) => {
      const partes = String(c.Horário || '').split('|').map(s => s.trim()).filter(Boolean);
      const faixas = [];
      for (let k = 0; k < partes.length; k += 2) {
        faixas.push(partes[k + 1]
          ? `<span style="color:#555;">${escaparHTML(partes[k])}</span> <b>${escaparHTML(partes[k + 1])}</b>`
          : escaparHTML(partes[k]));
      }
      const ferias = feriasDe(c.Nome);
      const fundo = ferias ? '#e8f4ff' : (i % 2 ? '#f5f7fb' : '#fff');
      const situacao = ferias
        ? `<b style="color:#0b63b6;">Férias ${diaMes(ferias.inicio)} a ${diaMes(ferias.fim)}</b>`
        : '<span style="color:#2e7d32;">Ativo</span>';
      return `<tr style="background:${fundo};">
      <td style="${td}"><b>${escaparHTML(c.Nome)}</b></td>
      ${temCargo ? `<td style="${td}">${escaparHTML(c.Cargo || '')}</td>` : ''}
      <td style="${td}">${faixas.join('<br>') || '<span style="color:#777;">Não informado</span>'}</td>
      <td style="${td}white-space:nowrap;">${situacao}</td>
    </tr>`;
    }).join('');

  // Avisos do mês: os que citam uma data do mês (dd/mm ou dd/mm/aaaa, mesmo inativos — servem de registro
  // de folgas/consultas) + os ativos sem data. Ordenados pela primeira data citada.
  const avisosMes = [];
  (dados.avisos || []).forEach(a => {
    const texto = (a.Texto || '').trim();
    if (!texto) return;
    const datas = [...texto.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)]
      .map(m => new Date(m[3] ? Number(m[3]) : year, Number(m[2]) - 1, Number(m[1])));
    const ativo = ['SIM', 'TRUE', '1'].includes((a.Ativo || '').toString().trim().toUpperCase());
    const doMes = datas.filter(noMes);
    if (doMes.length) avisosMes.push({ texto, ordem: Math.min(...doMes) });
    else if (!datas.length && ativo) avisosMes.push({ texto, ordem: Infinity });
  });
  const vistos = new Set();
  const linhasAvisos = avisosMes
    .filter(a => !vistos.has(a.texto) && vistos.add(a.texto))
    .sort((a, b) => a.ordem - b.ordem)
    .map((a, i) => `<tr style="background:${i % 2 ? '#f5f7fb' : '#fff'};"><td style="${td}">${escaparHTML(a.texto)}</td></tr>`)
    .join('');

  const totalFeriados = feriadoPorDia.size;
  const semEscala = listaDias.filter(d => d.pessoas.length === 0).length;
  const geradoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const corpo = `
<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2733;max-width:760px;">
  <h1 style="font-size:22px;color:#1e3a6e;margin:0 0 4px;">Escala COP — ${tituloMes}</h1>
  <p style="font-size:13px;color:#555;margin:0 0 14px;">COP — Controle de Operações · gerado em ${geradoEm}</p>
  <p style="font-size:13px;margin:0 0 6px;">
    <b>${listaDias.length}</b> dias com plantão/feriado · <b>${totalEscalados}</b> colaboradores escalados ·
    <b>${totalFeriados}</b> feriado(s)${semEscala ? ` · <b style="color:#b00020;">${semEscala} dia(s) a definir</b>` : ''}
  </p>

  <h2 style="${h2}">Horários de segunda a sexta</h2>
  <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
    <tr><th style="${th}">Colaborador</th>${temCargo ? `<th style="${th}">Cargo</th>` : ''}<th style="${th}">Horário</th><th style="${th}">No mês</th></tr>
    ${linhasHorarios || `<tr><td style="${td}" colspan="4">Nenhum colaborador cadastrado</td></tr>`}
  </table>

  <h2 style="${h2}">Plantões — fins de semana e feriados</h2>
  <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
    <tr><th style="${th}">Data</th><th style="${th}">Dia</th><th style="${th}">Ocasião</th><th style="${th}">Plantonista(s) — horário</th></tr>
    ${linhasEscala || `<tr><td style="${td}" colspan="4">Nenhum plantão neste mês</td></tr>`}
  </table>

  <h2 style="${h2}">Avisos do mês</h2>
  <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
    ${linhasAvisos || `<tr><td style="${td}">Nenhum aviso neste mês</td></tr>`}
  </table>

  <h2 style="${h2}">Férias no mês</h2>
  <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
    <tr><th style="${th}">Colaborador</th><th style="${th}">Período</th></tr>
    ${linhasFerias || `<tr><td style="${td}" colspan="2">Ninguém de férias neste mês</td></tr>`}
  </table>

  <p style="font-size:12px;color:#777;margin-top:22px;">Consulte a escala atualizada no Portal COP: <a href="https://murillo-calazans.github.io/portal-cop/" style="color:#1e3a6e;">murillo-calazans.github.io/portal-cop</a></p>
</div>`;

  return { corpo, tituloMes };
}

function gerarRelatorioEscala(mesRef) {
  const dados = window.dados;
  if (!dados || !dados.plantoes) {
    alert('Os dados ainda estão carregando. Tente novamente em alguns segundos.');
    return;
  }

  const { corpo, tituloMes } = montarCorpoRelatorio(mesRef, dados);
  const titulo = `Escala COP — ${tituloMes}`;
  const arquivo = `escala-cop-${mesRef.getFullYear()}-${String(mesRef.getMonth() + 1).padStart(2, '0')}.html`;
  const docBase = (extra) => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titulo}</title>
<style>body{margin:0;padding:24px 16px;background:#fff;}@media print{.barra{display:none!important;}body{padding:0;}@page{margin:14mm;}}</style>
</head><body>${extra}<div id="relatorio">${corpo}</div></body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('O navegador bloqueou a nova aba. Permita pop-ups para este site e tente de novo.');
    return;
  }

  const btn = 'padding:9px 16px;border-radius:8px;border:1px solid #1e3a6e;background:#1e3a6e;color:#fff;font:600 14px Segoe UI,Arial,sans-serif;cursor:pointer;';
  const barra = `<div class="barra" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;max-width:760px;margin:0 0 22px;padding:12px;background:#eef3fb;border-radius:10px;font:13px Segoe UI,Arial,sans-serif;">
    <button id="bImprimir" style="${btn}">Imprimir / Salvar PDF</button>
    <button id="bCopiar" style="${btn}">Copiar para e-mail</button>
    <button id="bBaixar" style="${btn}background:#fff;color:#1e3a6e;">Baixar HTML</button>
    <span id="msg" style="color:#1e3a6e;"></span>
  </div>`;

  win.document.open();
  win.document.write(docBase(barra));
  win.document.close();

  const $ = id => win.document.getElementById(id);
  const avisar = texto => { $('msg').textContent = texto; };

  $('bImprimir').onclick = () => win.print();

  $('bBaixar').onclick = () => {
    const blob = new Blob([docBase('')], { type: 'text/html;charset=utf-8' });
    const a = win.document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = arquivo;
    win.document.body.appendChild(a);
    a.click();
    a.remove();
    avisar('Arquivo baixado — anexe no e-mail ou publique onde quiser.');
  };

  $('bCopiar').onclick = async () => {
    const el = $('relatorio');
    try {
      await win.navigator.clipboard.write([new win.ClipboardItem({
        'text/html': new Blob([el.innerHTML], { type: 'text/html' }),
        'text/plain': new Blob([el.innerText], { type: 'text/plain' })
      })]);
    } catch (e) {
      // Fallback para navegadores sem ClipboardItem
      const range = win.document.createRange();
      range.selectNodeContents(el);
      const sel = win.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      win.document.execCommand('copy');
      sel.removeAllRanges();
    }
    avisar('Copiado! Cole (Ctrl+V) no corpo do e-mail ou no Teams.');
  };
}
