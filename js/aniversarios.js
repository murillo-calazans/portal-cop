function atualizarAniversarios(aniversarios) {
  const grid = document.getElementById('aniversariosGrid');
  const stats = document.getElementById('anivStats');
  if (!grid) return;

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  // Converte datas e filtra as válidas
  const anivValidos = aniversarios.filter(a => {
    const d = excelDateToJSDate(a.Data);
    return d !== null && !isNaN(d.getTime());
  });

  // Calcula próximos aniversários (próximos 30 dias)
  const proximos = anivValidos.filter(a => {
    const d = excelDateToJSDate(a.Data);
    if (!d) return false;
    const prox = new Date(anoAtual, d.getMonth(), d.getDate());
    if (prox < hoje) prox.setFullYear(anoAtual + 1);
    const diff = Math.ceil((prox - hoje) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 30;
  });
  stats.textContent = `${proximos.length} nos próximos 30 dias`;

  if (anivValidos.length === 0) {
    grid.innerHTML = '<div class="no-data">Nenhum aniversário registrado</div>';
    return;
  }

  // Ordena por data (próximos primeiro)
  const sorted = [...anivValidos].sort((a, b) => {
    const da = excelDateToJSDate(a.Data);
    const db = excelDateToJSDate(b.Data);
    if (!da || !db) return 0;
    const proxA = new Date(anoAtual, da.getMonth(), da.getDate());
    if (proxA < hoje) proxA.setFullYear(anoAtual + 1);
    const proxB = new Date(anoAtual, db.getMonth(), db.getDate());
    if (proxB < hoje) proxB.setFullYear(anoAtual + 1);
    return proxA - proxB;
  });

  const colors = ['#4f8cf7', '#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#fd79a8', '#00cec9'];

  grid.innerHTML = '';
  sorted.forEach((a, idx) => {
    const data = excelDateToJSDate(a.Data);
    if (!data) return;

    const isThisMonth = data.getMonth() === mesAtual;
    const cor = colors[idx % colors.length];

    const prox = new Date(anoAtual, data.getMonth(), data.getDate());
    if (prox < hoje) prox.setFullYear(anoAtual + 1);
    const dias = Math.ceil((prox - hoje) / (1000 * 60 * 60 * 24));
    let contador = `${dias} dias`;
    if (dias === 0) contador = '🎉 Hoje!';
    else if (dias < 0) contador = 'Já passou';

    const card = document.createElement('div');
    card.className = 'aniversario-card';
    if (isThisMonth) card.classList.add('destaque');

    const initials = a.Nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    card.innerHTML = `
      <div class="aniversario-avatar" style="background:${cor}">${initials}</div>
      <div class="aniversario-nome">${a.Nome}</div>
      <div class="aniversario-data">${data.toLocaleDateString('pt-BR', { month: 'long', day: 'numeric' })}</div>
      <div class="aniversario-contador">${contador}</div>
    `;
    grid.appendChild(card);
  });
}