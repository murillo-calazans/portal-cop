/* ============================================================
   js/equipe.js
   Lógica da aba Equipe
   ============================================================ */

function atualizarEquipe(colaboradores) {
  const grid = document.getElementById('teamGrid');
  const count = document.getElementById('teamCount');
  const filter = document.getElementById('teamFilter');

  if (!grid) return;

    function render(lista) {
    grid.innerHTML = '';
    if (!lista || lista.length === 0) {
      grid.innerHTML = '<div class="no-data">Nenhum colaborador encontrado</div>';
      count.textContent = '0 colaboradores';
      return;
    }
    count.textContent = `${lista.length} colaborador${lista.length > 1 ? 'es' : ''}`;

    lista.forEach(colab => {
      const card = document.createElement('div');
      card.className = 'team-card';

      const nome = colab.Nome || 'Anônimo';
      const horario = colab.Horário || 'Não informado';
      const cargo = colab.Cargo || 'Colaborador';
      const email = colab['E-mail'] || colab.Email || '';

      const initials = nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const colors = ['#4f8cf7', '#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#fd79a8', '#00cec9'];
      const colorIndex = (nome.length + (horario || '').length) % colors.length;

      const status = 'online'; // mock

      card.innerHTML = `
        <div class="avatar" style="background:${colors[colorIndex]}">
          ${initials}
          <span class="status-badge ${status}"></span>
        </div>
        <div class="team-info">
          <div class="team-name">${nome}</div>
          <div class="team-horario"><i class="fas fa-clock"></i> ${horario}</div>
          ${email ? `<div class="team-email"><i class="fas fa-envelope"></i> ${email}</div>` : ''}
          <span class="team-role">${cargo}</span>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // Filtro
  filter.addEventListener('input', () => {
    const termo = filter.value.toLowerCase().trim();
    if (!termo) {
      render(colaboradores);
      return;
    }
    const filtrados = colaboradores.filter(c => c.Nome.toLowerCase().includes(termo));
    render(filtrados);
  });

  render(colaboradores);
}
