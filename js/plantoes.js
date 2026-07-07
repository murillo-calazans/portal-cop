/* ============================================================
   js/plantoes.js
   Lógica da aba Plantões
   ============================================================ */

let currentMonth = new Date();

function atualizarPlantao(todosPlantoes) {
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

  // Ordena
  plantMes.sort((a, b) => excelDateToJSDate(a.Data) - excelDateToJSDate(b.Data));

  // Encontra todos os sábados que intersectam o mês
  const primeiroDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);

  let sabadoInicio = new Date(primeiroDia);
  while (sabadoInicio.getDay() !== 6) {
    sabadoInicio.setDate(sabadoInicio.getDate() - 1);
  }

  const sabados = [];
  let current = new Date(sabadoInicio);
  while (current <= ultimoDia || (current.getDay() === 6 && current <= ultimoDia)) {
    const domingo = new Date(current);
    domingo.setDate(domingo.getDate() + 1);
    const temIntersecao = (current >= primeiroDia && current <= ultimoDia) ||
                          (domingo >= primeiroDia && domingo <= ultimoDia);
    if (temIntersecao) {
      sabados.push(new Date(current));
    }
    current.setDate(current.getDate() + 7);
  }

  container.innerHTML = '';

  if (sabados.length === 0) {
    container.innerHTML = '<div class="no-data">Nenhum fim de semana com plantão neste mês</div>';
    return;
  }

  let weekendIndex = 1;
  sabados.forEach(sabado => {
    const domingo = new Date(sabado);
    domingo.setDate(domingo.getDate() + 1);

    const plantSab = plantMes.filter(p => {
      const d = excelDateToJSDate(p.Data);
      return d && d.toDateString() === sabado.toDateString();
    });
    const plantDom = plantMes.filter(p => {
      const d = excelDateToJSDate(p.Data);
      return d && d.toDateString() === domingo.toDateString();
    });

    if (plantSab.length === 0 && plantDom.length === 0) return;

    const group = document.createElement('div');
    group.className = 'plantao-weekend-group';

    const h3 = document.createElement('h3');
    h3.innerHTML = `<i class="fas fa-calendar-week"></i> Fim de semana ${weekendIndex}`;
    group.appendChild(h3);

    const row = document.createElement('div');
    row.className = 'plantao-weekend-row';

    // Sábado
    const sabBlock = document.createElement('div');
    sabBlock.className = 'plantao-day-block';
    sabBlock.innerHTML = `
      <h4><i class="fas fa-calendar-day"></i> Sábado</h4>
      <div class="day-date">${formatarDataCurta(sabado)}</div>
      <ul>
        ${plantSab.length === 0 ? '<li class="no-data">Sem plantão</li>' :
          plantSab.map(p => `<li><span class="colab-name">${p.Colaborador}</span> <span class="colab-time">${p.Horário || '08:00 às 17:00'}</span></li>`).join('')}
      </ul>
    `;

    // Domingo
    const domBlock = document.createElement('div');
    domBlock.className = 'plantao-day-block';
    domBlock.innerHTML = `
      <h4><i class="fas fa-calendar-day"></i> Domingo</h4>
      <div class="day-date">${formatarDataCurta(domingo)}</div>
      <ul>
        ${plantDom.length === 0 ? '<li class="no-data">Sem plantão</li>' :
          plantDom.map(p => `<li><span class="colab-name">${p.Colaborador}</span> <span class="colab-time">${p.Horário || '08:00 às 17:00'}</span></li>`).join('')}
      </ul>
    `;

    row.appendChild(sabBlock);
    row.appendChild(domBlock);
    group.appendChild(row);
    container.appendChild(group);
    weekendIndex++;
  });

  if (container.children.length === 0) {
    container.innerHTML = '<div class="no-data">Nenhum plantão em fins de semana neste mês</div>';
  }

  // Navegação
  prevBtn.onclick = () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    if (window.dados) atualizarPlantao(window.dados.plantoes);
  };
  nextBtn.onclick = () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    if (window.dados) atualizarPlantao(window.dados.plantoes);
  };
  todayBtn.onclick = () => {
    currentMonth = new Date();
    if (window.dados) atualizarPlantao(window.dados.plantoes);
  };
}