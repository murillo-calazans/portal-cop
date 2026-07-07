/* ============================================================
   js/dashboard.js
   Dashboard com IDs fixos e utilitários internos
   ============================================================ */

// ===== UTILITÁRIOS =====
function excelDateToJSDate(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  // Caso venha número puro (serial do Excel/Sheets — usado pelo mock)
  if (typeof valor === 'number' || /^\d+(\.\d+)?$/.test(String(valor).trim())) {
    const serial = Number(valor);
    const utc = new Date((serial - 25569) * 86400 * 1000);
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  }

  const texto = String(valor).trim();

  // Formato dd/mm/aaaa ou dd-mm-aaaa
  let m = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, dia, mes, ano] = m;
    return new Date(Number(ano), Number(mes) - 1, Number(dia));
  }

  // Formato dd/mm ou dd-mm (SEM ano — usado em Aniversários, por privacidade)
  m = texto.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const [, dia, mes] = m;
    // Usa um ano fictício bissexto (aceita até 29/02); o ano real não importa
    // porque o resto do sistema já recalcula a "próxima ocorrência" sozinho
    return new Date(2000, Number(mes) - 1, Number(dia));
  }

  // Formato aaaa-mm-dd (ISO)
  m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, ano, mes, dia] = m;
    return new Date(Number(ano), Number(mes) - 1, Number(dia));
  }

  // Último recurso
  const tentativa = new Date(texto);
  return isNaN(tentativa.getTime()) ? null : tentativa;
}

function formatarDataCurta(data) {
  if (!data) return '';
  return data.toLocaleDateString('pt-BR');
}

// ===== DASHBOARD =====
function atualizarDashboard(dados) {
  console.log('🔵 atualizarDashboard chamado com dados:', dados);

  if (!dados) {
    console.error('❌ Dados não fornecidos');
    return;
  }

  const colaboradores = dados.colaboradores || [];
  const plantoes = dados.plantoes || [];
  const ferias = dados.ferias || [];
  const aniversarios = dados.aniversarios || [];
  const avisos = dados.avisos || [];

  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();

  // ---- Card 1: Colaboradores ----
  const card1 = document.getElementById('card-colaboradores');
  if (card1) {
    card1.innerHTML = `
      <div class="card-header">
        <span class="card-title"><i class="fas fa-users"></i> Colaboradores</span>
        <span class="card-icon"><i class="fas fa-user-check"></i></span>
      </div>
      <div class="card-value"><span class="kpi-number">${colaboradores.length}</span></div>
      <div class="card-sub">Ativos no sistema</div>
    `;
  }

  // ---- Card 2: Plantões no mês ----
  const plantMes = plantoes.filter(p => {
    const d = excelDateToJSDate(p.Data);
    return d && d.getMonth() === mes && d.getFullYear() === ano;
  });
  const card2 = document.getElementById('card-plantoes-mes');
  if (card2) {
    card2.innerHTML = `
      <div class="card-header">
        <span class="card-title"><i class="fas fa-calendar-alt"></i> Plantões (mês)</span>
        <span class="card-icon"><i class="fas fa-calendar-check"></i></span>
      </div>
      <div class="card-value"><span class="kpi-number">${plantMes.length}</span></div>
      <div class="card-sub">${plantMes.length > 0 ? 'Escalas registradas' : 'Nenhum plantão'}</div>
    `;
  }

  // ---- Card 3: Em férias ----
  const feriasAtivas = ferias.filter(f => {
    const inicio = excelDateToJSDate(f.Início);
    const fim = excelDateToJSDate(f.Fim);
    return inicio && fim && inicio <= hoje && hoje <= fim;
  });
  const card3 = document.getElementById('card-ferias');
  if (card3) {
    let listaNomes = feriasAtivas.map(f => f.Nome).join(', ');
    if (!listaNomes) listaNomes = 'Nenhum colaborador';
    card3.innerHTML = `
      <div class="card-header">
        <span class="card-title"><i class="fas fa-umbrella-beach"></i> Em férias</span>
        <span class="card-icon"><i class="fas fa-clock"></i></span>
      </div>
      <div class="card-value" style="font-size:1.2rem;">${feriasAtivas.length}</div>
      <div class="card-sub" style="font-size:0.85rem; margin-top:6px;">${listaNomes}</div>
    `;
  }

  // ---- Card 4: Aniversariantes ----
  const anivMes = aniversarios.filter(a => {
    const d = excelDateToJSDate(a.Data);
    return d && d.getMonth() === mes;
  });
  const card4 = document.getElementById('card-aniversariantes');
  if (card4) {
    card4.innerHTML = `
      <div class="card-header">
        <span class="card-title"><i class="fas fa-birthday-cake"></i> Aniversariantes</span>
        <span class="card-icon"><i class="fas fa-gift"></i></span>
      </div>
      <div class="card-value"><span class="kpi-number">${anivMes.length}</span></div>
      <div class="card-sub">${anivMes.length > 0 ? 'Parabéns a eles!' : 'Nenhum este mês'}</div>
    `;
  }

  // ---- Card 5: Próximo FDS ----
  const proximosPlant = plantoes
    .filter(p => excelDateToJSDate(p.Data) >= hoje)
    .sort((a, b) => excelDateToJSDate(a.Data) - excelDateToJSDate(b.Data));
  let sabado = null, domingo = null;
  let plantSab = [], plantDom = [];
  for (let p of proximosPlant) {
    const d = excelDateToJSDate(p.Data);
    if (!d) continue;
    const dia = d.getDay();
    if (dia === 6 && !sabado) {
      sabado = d;
      plantSab = proximosPlant.filter(p2 => {
        const d2 = excelDateToJSDate(p2.Data);
        return d2 && d2.toDateString() === d.toDateString();
      });
    }
    if (dia === 0 && !domingo) {
      domingo = d;
      plantDom = proximosPlant.filter(p2 => {
        const d2 = excelDateToJSDate(p2.Data);
        return d2 && d2.toDateString() === d.toDateString();
      });
    }
    if (sabado && domingo) break;
  }

  const card5 = document.getElementById('card-proximo-fds');
  if (card5) {
    let html = `
      <div class="card-header">
        <span class="card-title"><i class="fas fa-calendar-week"></i> Próximo FDS</span>
        <span class="card-icon"><i class="fas fa-clock"></i></span>
      </div>
    `;
    if (sabado || domingo) {
      html += `<div style="font-size:0.9rem; margin-top:4px;">`;
      if (sabado) {
        html += `<strong>Sábado (${formatarDataCurta(sabado)})</strong><br>`;
        html += plantSab.map(p => `${p.Colaborador} - ${p.Horário || '08:00-17:00'}`).join('<br>');
        html += `<br>`;
      }
      if (domingo) {
        html += `<strong>Domingo (${formatarDataCurta(domingo)})</strong><br>`;
        html += plantDom.map(p => `${p.Colaborador} - ${p.Horário || '08:00-17:00'}`).join('<br>');
      }
      html += `</div>`;
    } else {
      html += `<div class="card-sub">Nenhum plantão no fim de semana</div>`;
    }
    card5.innerHTML = html;
  }

  // ---- Card 6: Avisos ----
  // ---- Card 6: Avisos ----
  const card6 = document.getElementById('card-avisos');
  if (card6) {
    const avisosAtivos = avisos.filter(a => {
      const valor = (a.Ativo || '').toString().trim().toUpperCase();
      return valor === 'SIM' || valor === 'TRUE' || valor === '1';
    });

    let listaHtml = '<li class="no-data">Nenhum aviso no momento</li>';
    if (avisosAtivos.length > 0) {
      listaHtml = avisosAtivos.map(a => `<li>${a.Texto || ''}</li>`).join('');
    }

    card6.innerHTML = `
      <div class="card-header">
        <span class="card-title"><i class="fas fa-bullhorn"></i> Avisos</span>
        <span class="card-icon"><i class="fas fa-edit"></i></span>
      </div>
      <div style="font-size:0.95rem; margin-top:8px; max-height:150px; overflow-y:auto;">
        <ul>${listaHtml}</ul>
      </div>
      <div class="card-sub" style="margin-top:8px; font-size:0.75rem;">${avisosAtivos.length} aviso${avisosAtivos.length !== 1 ? 's' : ''} ativo${avisosAtivos.length !== 1 ? 's' : ''}</div>
    `;
  }
     console.log('✅ Dashboard atualizado com sucesso');
}