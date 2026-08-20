/* ============================================================
   js/plantoes.js
   Lógica da aba Plantões
   ============================================================ */

let currentMonth = new Date();

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function criarBlocoDia(label, data, plantoesDoDia, feriadoNome) {
  const block = document.createElement('div');
  block.className = 'plantao-day-block';
  const badge = feriadoNome ? ` <span class="holiday-badge"><i class="fas fa-star"></i> ${feriadoNome}</span>` : '';
  block.innerHTML = `
    <h4><i class="fas fa-calendar-day"></i> ${label}${badge}</h4>
    <div class="day-date">${formatarDataCurta(data)}</div>
    <ul>
      ${plantoesDoDia.length === 0 ? '<li class="no-data">Sem plantão</li>' :
        plantoesDoDia.map(p => `<li><span class="colab-name">${p.Colaborador}</span> <span class="colab-time">${p.Horário || '08:00 às 17:00'}</span></li>`).join('')}
    </ul>
  `;
  return block;
}

function atualizarPlantao(todosPlantoes, todosFeriados) {
  const container = document.getElementById('plantaoContainer');
  const title = document.getElementById('plantMonthTitle');
  const prevBtn = document.getElementById('plantPrev');
  const nextBtn = document.getElementById('plantNext');
  const todayBtn = document.getElementById('plantToday');

  if (!container || !title) return;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  title.textContent = monthName;

  // Filtra plantões do mês
  const plantMes = todosPlantoes.filter(p => {
    const d = excelDateToJSDate(p.Data);
    return d && d.getMonth() === month && d.getFullYear() === year;
  });

  // Filtra feriados do mês (aba própria: Data, Tipo = nome do feriado, Colaborador, Horário)
  const feriadosMes = (todosFeriados || []).filter(f => {
    const d = excelDateToJSDate(f.Data);
    return d && d.getMonth() === month && d.getFullYear() === year;
  });

  // Nome do feriado por dia (para exibir mesmo quando ninguém foi escalado ainda)
  const feriadoPorData = new Map();
  feriadosMes.forEach(f => {
    const d = excelDateToJSDate(f.Data);
    if (!d) return;
    const key = d.toDateString();
    if (!feriadoPorData.has(key)) {
      feriadoPorData.set(key, { data: d, nome: (f.Tipo || f.Nome || f.Feriado || 'Feriado').trim() });
    }
  });

  // Plantonistas de um dia = lançamentos na aba plantoes + escalas lançadas direto na aba feriados
  const plantoesNoDia = (dia) => {
    const key = dia.toDateString();
    const doPlantoes = plantMes.filter(p => {
      const d = excelDateToJSDate(p.Data);
      return d && d.toDateString() === key;
    });
    const doFeriados = feriadosMes.filter(f => {
      const d = excelDateToJSDate(f.Data);
      return d && d.toDateString() === key && f.Colaborador;
    });
    return [...doPlantoes, ...doFeriados];
  };

  // Encontra todos os sábados que intersectam o mês
  const primeiroDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);

  let sabadoInicio = new Date(primeiroDia);
  while (sabadoInicio.getDay() !== 6) {
    sabadoInicio.setDate(sabadoInicio.getDate() - 1);
  }

  // Monta a lista de "grupos" a exibir: fins de semana + feriados em dia de semana
  const grupos = [];

  let current = new Date(sabadoInicio);
  while (current <= ultimoDia) {
    const domingo = new Date(current);
    domingo.setDate(domingo.getDate() + 1);
    const temIntersecao = (current >= primeiroDia && current <= ultimoDia) ||
                          (domingo >= primeiroDia && domingo <= ultimoDia);
    if (temIntersecao) {
      grupos.push({ tipo: 'fds', data: new Date(current), sabado: new Date(current), domingo });
    }
    current.setDate(current.getDate() + 7);
  }

  // Feriados do mês que caem em dia de semana (sáb/dom já são cobertos pelo fim de semana)
  feriadoPorData.forEach(({ data, nome }) => {
    if (data.getDay() === 0 || data.getDay() === 6) return;
    grupos.push({ tipo: 'feriado', data, nome });
  });

  grupos.sort((a, b) => a.data - b.data);

  container.innerHTML = '';

  let weekendIndex = 1;
  grupos.forEach(grupo => {
    if (grupo.tipo === 'fds') {
      const plantSab = plantoesNoDia(grupo.sabado);
      const plantDom = plantoesNoDia(grupo.domingo);
      if (plantSab.length === 0 && plantDom.length === 0) return;

      const group = document.createElement('div');
      group.className = 'plantao-weekend-group';

      const h3 = document.createElement('h3');
      h3.innerHTML = `<i class="fas fa-calendar-week"></i> Fim de semana ${weekendIndex}`;
      group.appendChild(h3);

      const infoSab = feriadoPorData.get(grupo.sabado.toDateString());
      const infoDom = feriadoPorData.get(grupo.domingo.toDateString());

      const row = document.createElement('div');
      row.className = 'plantao-weekend-row';
      row.appendChild(criarBlocoDia('Sábado', grupo.sabado, plantSab, infoSab && infoSab.nome));
      row.appendChild(criarBlocoDia('Domingo', grupo.domingo, plantDom, infoDom && infoDom.nome));

      group.appendChild(row);
      container.appendChild(group);
      weekendIndex++;
    } else {
      // Feriado em dia de semana: sempre exibe, mesmo sem plantonista definido ainda
      const plantFer = plantoesNoDia(grupo.data);

      const group = document.createElement('div');
      group.className = 'plantao-weekend-group plantao-holiday-group';

      const h3 = document.createElement('h3');
      h3.innerHTML = `<i class="fas fa-star"></i> Feriado — ${grupo.nome}`;
      group.appendChild(h3);

      const row = document.createElement('div');
      row.className = 'plantao-weekend-row single-day';
      row.appendChild(criarBlocoDia(DIAS_SEMANA[grupo.data.getDay()], grupo.data, plantFer));

      group.appendChild(row);
      container.appendChild(group);
    }
  });

  if (container.children.length === 0) {
    container.innerHTML = '<div class="no-data">Nenhum plantão em fins de semana ou feriados neste mês</div>';
  }

  // Navegação
  prevBtn.onclick = () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    if (window.dados && window.dados.plantoes) {
      atualizarPlantao(window.dados.plantoes, window.dados.feriados);
    } else {
      console.warn('Dados de plantões não disponíveis');
    }
  };
  nextBtn.onclick = () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    if (window.dados && window.dados.plantoes) {
      atualizarPlantao(window.dados.plantoes, window.dados.feriados);
    } else {
      console.warn('Dados de plantões não disponíveis');
    }
  };
  todayBtn.onclick = () => {
    currentMonth = new Date();
    if (window.dados && window.dados.plantoes) {
      atualizarPlantao(window.dados.plantoes, window.dados.feriados);
    } else {
      console.warn('Dados de plantões não disponíveis');
    }
  };
}