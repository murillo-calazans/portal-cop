/* ============================================================
   js/ferias.js
   Lógica da aba Férias (com KPIs, seções e fila de espera)
   ============================================================ */

function renderCardFerias(f, status, label) {
  const total = f._fim - f._inicio;
  const passado = new Date() - f._inicio;
  const progresso = total > 0 ? Math.min(100, Math.max(0, (passado / total) * 100)) : 0;
  return `
    <div class="feria-card">
      <div class="feria-top">
        <div class="feria-nome">${f.Nome || ''}</div>
        <span class="feria-status ${status}">${label}</span>
      </div>
      <div class="feria-periodo"><i class="fas fa-calendar-alt"></i> ${formatarDataCurta(f._inicio)} — ${formatarDataCurta(f._fim)}</div>
      <div class="feria-progress">
        <div class="progress-label">
          <span>Progresso</span>
          <span>${Math.round(progresso)}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" style="--progress-width: ${progresso}%; width: ${progresso}%;"></div>
        </div>
      </div>
    </div>
  `;
}

function atualizarFerias(ferias, colaboradores, mensagensRetorno) {
  const statsEl = document.getElementById('feriasStats');
  const kpisEl = document.getElementById('feriasKpis');
  const gridEmFerias = document.getElementById('feriasEmAndamento');
  const gridProgramadas = document.getElementById('feriasProgramadas');
  const gridFilaEspera = document.getElementById('feriasFilaEspera');
  const gridRetornaram = document.getElementById('feriasRetornaram');

  if (!gridEmFerias) return;

  const hoje = new Date();
  colaboradores = colaboradores || [];
  mensagensRetorno = mensagensRetorno || [];

  const emFerias = [], programadas = [], filaEspera = [], retornaram = [];

  (ferias || []).forEach(f => {
    const temInicio = f.Início && String(f.Início).trim() !== '';
    const temFim = f.Fim && String(f.Fim).trim() !== '';

    if (!temInicio || !temFim) {
      filaEspera.push(f);
      return;
    }

    const inicio = excelDateToJSDate(f.Início);
    const fim = excelDateToJSDate(f.Fim);

    if (!inicio || !fim) {
      filaEspera.push(f);
      return;
    }

    if (inicio <= hoje && hoje <= fim) {
      emFerias.push({ ...f, _inicio: inicio, _fim: fim });
    } else if (inicio > hoje) {
      programadas.push({ ...f, _inicio: inicio, _fim: fim });
    } else {
      const diasDesdeRetorno = Math.floor((hoje - fim) / (1000 * 60 * 60 * 24));
      if (diasDesdeRetorno <= 30) {
        retornaram.push({ ...f, _inicio: inicio, _fim: fim });
      }
    }
  });

  programadas.sort((a, b) => a._inicio - b._inicio);
  retornaram.sort((a, b) => b._fim - a._fim);

  if (statsEl) statsEl.textContent = `${emFerias.length} em andamento`;

  if (kpisEl) {
    kpisEl.innerHTML = `
      <div class="ferias-kpi-card">
        <div class="kpi-icon"><i class="fas fa-users"></i></div>
        <div class="kpi-value">${colaboradores.length}</div>
        <div class="kpi-label">Colaboradores</div>
      </div>
      <div class="ferias-kpi-card">
        <div class="kpi-icon"><i class="fas fa-umbrella-beach"></i></div>
        <div class="kpi-value">${emFerias.length}</div>
        <div class="kpi-label">Em Férias</div>
      </div>
      <div class="ferias-kpi-card">
        <div class="kpi-icon"><i class="fas fa-calendar-check"></i></div>
        <div class="kpi-value">${programadas.length}</div>
        <div class="kpi-label">Programadas</div>
      </div>
      <div class="ferias-kpi-card">
        <div class="kpi-icon"><i class="fas fa-rocket"></i></div>
        <div class="kpi-value">${retornaram.length}</div>
        <div class="kpi-label">Retornaram (30d)</div>
      </div>
      <div class="ferias-kpi-card">
        <div class="kpi-icon"><i class="fas fa-hourglass-half"></i></div>
        <div class="kpi-value">${filaEspera.length}</div>
        <div class="kpi-label">Fila de Espera</div>
      </div>
    `;
  }

  if (gridEmFerias) {
    gridEmFerias.innerHTML = emFerias.length === 0
      ? '<div class="no-data">Ninguém em férias no momento</div>'
      : emFerias.map(f => renderCardFerias(f, 'ativa', 'EM FÉRIAS')).join('');
  }

  if (gridProgramadas) {
    gridProgramadas.innerHTML = programadas.length === 0
      ? '<div class="no-data">Nenhuma férias programada</div>'
      : programadas.map(f => renderCardFerias(f, 'futura', 'PROGRAMADA')).join('');
  }

  if (gridFilaEspera) {
    gridFilaEspera.innerHTML = filaEspera.length === 0
      ? '<div class="no-data">Ninguém na fila de espera</div>'
      : filaEspera.map(f => `
          <div class="feria-card">
            <div class="feria-top">
              <div class="feria-nome">${f.Nome || ''}</div>
              <span class="feria-status espera">FILA DE ESPERA</span>
            </div>
            <div class="feria-periodo"><i class="fas fa-hourglass-half"></i> Aguardando definição de datas</div>
          </div>
        `).join('');
  }

  if (gridRetornaram) {
    gridRetornaram.innerHTML = retornaram.length === 0
      ? '<div class="no-data">Ninguém retornou recentemente</div>'
      : retornaram.map(f => {
          const msgObj = mensagensRetorno.find(m =>
            (m.Nome || '').trim().toLowerCase() === (f.Nome || '').trim().toLowerCase()
          );
          const mensagem = (msgObj && msgObj.Mensagem) ? msgObj.Mensagem : 'Bem-vindo(a) de volta à operação!';
          return `
            <div class="feria-card retorno-card">
              <div class="feria-top">
                <div class="feria-nome">${f.Nome || ''}</div>
                <span class="feria-status" style="background:rgba(0,184,148,0.12); color:#00b894;">RETORNOU</span>
              </div>
              <div class="feria-periodo"><i class="fas fa-calendar-alt"></i> Retornou em ${formatarDataCurta(f._fim)}</div>
              <div class="feria-mensagem">"${mensagem}"</div>
            </div>
          `;
        }).join('');
  }
}