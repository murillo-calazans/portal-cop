/* ============================================================
   js/app.js
   Orquestração principal: API, cache, inicialização
   (Versão corrigida sem gráficos/calendário)
   ============================================================ */

(function() {
  'use strict';

 // ===== CONFIGURAÇÕES =====
  const SHEET_URLS = {
    colaboradores: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBhKN6Ez2TVTXmKuTXrATXr0jwNGIFfB-YLliQfZkbuIOoYremINoFpl30DPymLLND9SNJIULkyIa4/pub?gid=716596129&single=true&output=csv',
    plantoes: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBhKN6Ez2TVTXmKuTXrATXr0jwNGIFfB-YLliQfZkbuIOoYremINoFpl30DPymLLND9SNJIULkyIa4/pub?gid=1014264179&single=true&output=csv',
    ferias: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBhKN6Ez2TVTXmKuTXrATXr0jwNGIFfB-YLliQfZkbuIOoYremINoFpl30DPymLLND9SNJIULkyIa4/pub?gid=2128176886&single=true&output=csv',
    aniversarios: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBhKN6Ez2TVTXmKuTXrATXr0jwNGIFfB-YLliQfZkbuIOoYremINoFpl30DPymLLND9SNJIULkyIa4/pub?gid=1345651469&single=true&output=csv',
    avisos: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBhKN6Ez2TVTXmKuTXrATXr0jwNGIFfB-YLliQfZkbuIOoYremINoFpl30DPymLLND9SNJIULkyIa4/pub?gid=1824308061&single=true&output=csv',
   mensagensRetorno: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBhKN6Ez2TVTXmKuTXrATXr0jwNGIFfB-YLliQfZkbuIOoYremINoFpl30DPymLLND9SNJIULkyIa4/pub?gid=1695158649&single=true&output=csv'

  };
  const CACHE_KEY = 'portalCopData_v5'; // versão nova, para não misturar com cache antigo do n8n
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  const FETCH_TIMEOUT = 30000;

  // ===== PARSER DE CSV (lida com vírgulas e aspas dentro dos campos) =====
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i], next = text[i + 1];
      if (inQuotes) {
        if (char === '"' && next === '"') { field += '"'; i++; }
        else if (char === '"') { inQuotes = false; }
        else { field += char; }
      } else {
        if (char === '"') { inQuotes = true; }
        else if (char === ',') { row.push(field); field = ''; }
        else if (char === '\r') { /* ignora */ }
        else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else { field += char; }
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(v => v !== ''));
  }

  function csvToObjects(text) {
    const rows = parseCSV(text);
    if (rows.length === 0) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (r[idx] !== undefined ? r[idx].trim() : ''); });
      return obj;
    }).filter(obj => Object.values(obj).some(v => v !== ''));
  }

  async function buscarCSV(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      return csvToObjects(text);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('Tempo limite excedido (30s)');
      throw err;
    }
  }

  let dados = null;
  let loading = false;

  // ===== FUNÇÕES DE CACHE =====
  function salvarCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch (e) {
    console.warn('⚠️ Cache não disponível (localStorage desabilitado)');
  }
}

  function carregarCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      return payload.data;
    } catch (e) {
      return null;
    }
  }

  function cacheExpirado() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return true;
      const payload = JSON.parse(raw);
      return (Date.now() - payload.timestamp) > CACHE_TTL;
    } catch (e) {
      return true;
    }
  }

 // ===== FUNÇÕES DE API =====
async function buscarDadosRemotos() {
    const [colaboradores, plantoes, ferias, aniversarios, avisos, mensagensRetorno] = await Promise.all([
      buscarCSV(SHEET_URLS.colaboradores),
      buscarCSV(SHEET_URLS.plantoes),
      buscarCSV(SHEET_URLS.ferias),
      buscarCSV(SHEET_URLS.aniversarios),
      buscarCSV(SHEET_URLS.avisos),
      buscarCSV(SHEET_URLS.mensagensRetorno)
    ]);
    return { colaboradores, plantoes, ferias, aniversarios, avisos, mensagensRetorno };
  }

  // ===== FUNÇÃO PARA DADOS MOCK (fallback) =====
  async function buscarDadosMock() {
    // Simula atraso de rede
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      colaboradores: [
        { Nome: 'Ana Silva', Horário: '08:00-17:00', Cargo: 'Analista' },
        { Nome: 'Carlos Souza', Horário: '09:00-18:00', Cargo: 'Coordenador' },
        { Nome: 'Mariana Costa', Horário: '10:00-19:00', Cargo: 'Desenvolvedora' },
        { Nome: 'João Pereira', Horário: '08:00-17:00', Cargo: 'Suporte' },
        { Nome: 'Fernanda Lima', Horário: '12:00-21:00', Cargo: 'Designer' }
      ],
      plantoes: [
        { Data: 45678, Colaborador: 'Ana Silva', Horário: '08:00-17:00' },
        { Data: 45679, Colaborador: 'Carlos Souza', Horário: '09:00-18:00' },
        { Data: 45685, Colaborador: 'Mariana Costa', Horário: '10:00-19:00' }
      ],
      ferias: [
        { Nome: 'Ana Silva', Início: 45600, Fim: 45614 },
        { Nome: 'João Pereira', Início: 45620, Fim: 45634 }
      ],
      aniversarios: [
        { Nome: 'Ana Silva', Data: 44562 },
        { Nome: 'Carlos Souza', Data: 44890 }
      ]
    };
  }

  // ===== FUNÇÃO PRINCIPAL DE CARREGAMENTO =====
  async function carregarDados(forceRefresh = false) {
    if (loading) return;
    loading = true;

    // Mostra skeleton (já existe no HTML, mas garantimos)
    mostrarSkeleton();

    try {
      if (!forceRefresh && !cacheExpirado()) {
        const cache = carregarCache();
        if (cache) {
          dados = cache;
          loading = false;
          atualizarTudo();
          // Atualização em segundo plano
          buscarDadosRemotos()
            .then(novos => {
              dados = novos;
              salvarCache(novos);
              atualizarTudo();
            })
            .catch(() => {});
          return;
        }
      }

      // Tenta API real, se falhar usa mock
      let novos;
      try {
        novos = await buscarDadosRemotos();
      } catch (err) {
        console.warn('API falhou, usando dados mock:', err.message);
        novos = await buscarDadosMock();
      }

      dados = novos;
      window.dados = novos;   // <-- EXPÕE GLOBALMENTE
      salvarCache(novos);
      atualizarTudo();
    } catch (err) {
      const cache = carregarCache();
      if (cache) {
        dados = cache;
        atualizarTudo();
        mostrarAvisoCache(err.message);
      } else {
        // Último recurso: mock
        try {
          dados = await buscarDadosMock();
          salvarCache(dados);
          atualizarTudo();
          mostrarAvisoCache('Usando dados de exemplo (mock)');
        } catch (e) {
          mostrarErro(e.message);
        }
      }
    } finally {
      loading = false;
    }
  }

  // ===== ATUALIZAR TODAS AS ABAS =====
  function atualizarTudo() {
    if (!dados) {
      console.warn('⚠️ Nenhum dado disponível para atualizar');
      return;
    }

    // Normaliza os dados (aceita maiúsculas/minúsculas)
    const colaboradores = dados.colaboradores || dados.Colaboradores || [];
    const plantoes = dados.plantoes || dados.Plantoes || [];
    const ferias = dados.ferias || dados.Ferias || [];
    const aniversarios = dados.aniversarios || dados.Aniversarios || [];
    const avisos = dados.avisos || dados.Avisos || [];
    const mensagensRetorno = dados.mensagensRetorno || dados.MensagensRetorno || [];

    console.log('📦 Dados normalizados:', {
      colaboradores: colaboradores.length,
      plantoes: plantoes.length,
      ferias: ferias.length,
      aniversarios: aniversarios.length
    });

    // Dashboard
    if (typeof atualizarDashboard === 'function') {
      atualizarDashboard({ colaboradores, plantoes, ferias, aniversarios, avisos });
    } else {
      console.warn('⚠️ Função atualizarDashboard não encontrada');
    }

    // Equipe
    if (typeof atualizarEquipe === 'function') {
      atualizarEquipe(colaboradores);
    } else {
      console.warn('⚠️ Função atualizarEquipe não encontrada');
    }

    // Plantões
    if (typeof atualizarPlantao === 'function') {
      atualizarPlantao(plantoes);
    } else {
      console.warn('⚠️ Função atualizarPlantao não encontrada');
    }

    // Férias
    if (typeof atualizarFerias === 'function') {
      atualizarFerias(ferias, colaboradores, mensagensRetorno);
    } else {
      console.warn('⚠️ Função atualizarFerias não encontrada');
    }

    // Aniversários
    if (typeof atualizarAniversarios === 'function') {
      atualizarAniversarios(aniversarios);
    } else {
      console.warn('⚠️ Função atualizarAniversarios não encontrada');
    }

    // Relógio
    iniciarRelogio();

    console.log('✅ Portal atualizado com sucesso');
  }

  // ===== SKELETON E ERRO =====
  function mostrarSkeleton() {
    const grid = document.getElementById('dashboardGrid');
    if (grid && grid.children.length === 0) {
      grid.innerHTML = `
        <div class="dashboard-card" id="card-colaboradores">
          <div class="card-header"><span class="card-title"><i class="fas fa-users"></i> Colaboradores</span></div>
          <div class="skeleton"></div>
        </div>
        <div class="dashboard-card" id="card-plantoes-mes">
          <div class="card-header"><span class="card-title"><i class="fas fa-calendar-alt"></i> Plantões</span></div>
          <div class="skeleton"></div>
        </div>
        <div class="dashboard-card" id="card-ferias">
          <div class="card-header"><span class="card-title"><i class="fas fa-umbrella-beach"></i> Férias</span></div>
          <div class="skeleton"></div>
        </div>
        <div class="dashboard-card" id="card-aniversariantes">
          <div class="card-header"><span class="card-title"><i class="fas fa-birthday-cake"></i> Aniversários</span></div>
          <div class="skeleton"></div>
        </div>
        <div class="dashboard-card" id="card-proximo-fds">
          <div class="card-header"><span class="card-title"><i class="fas fa-calendar-week"></i> Próximo FDS</span></div>
          <div class="skeleton"></div>
        </div>
        <div class="dashboard-card" id="card-avisos">
          <div class="card-header"><span class="card-title"><i class="fas fa-bullhorn"></i> Avisos</span></div>
          <div class="skeleton"></div>
        </div>
      `;
    }
  }

  function mostrarAvisoCache(msg) {
    // Remove avisos antigos
    const old = document.querySelector('.error-box');
    if (old) old.remove();

    const grid = document.getElementById('dashboardGrid');
    if (!grid) return;
    const aviso = document.createElement('div');
    aviso.className = 'error-box';
    aviso.style.gridColumn = '1 / -1';
    aviso.style.marginTop = '1rem';
    aviso.innerHTML = `
      <p>ℹ️ ${msg}</p>
      <button class="retry-btn" onclick="carregarDados(true)">🔄 Atualizar</button>
    `;
    grid.appendChild(aviso);
  }

  function mostrarErro(msg) {
    const grid = document.getElementById('dashboardGrid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="error-box" style="grid-column:1/-1;padding:2rem;">
        <p>❌ ${msg}</p>
        <button class="retry-btn" onclick="carregarDados(true)">🔄 Tentar novamente</button>
      </div>
    `;
  }

  // ===== RELÓGIO =====
  function iniciarRelogio() {
    const display = document.getElementById('clockDisplay');
    if (!display) return;
    function update() {
      const now = new Date();
      display.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    update();
    if (window._clockInterval) clearInterval(window._clockInterval);
    window._clockInterval = setInterval(update, 1000);
  }

  // ===== SIDEBAR MOBILE =====
  function initSidebar() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('appSidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
          if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
            sidebar.classList.remove('open');
          }
        }
      });
    }
  }

  // ===== NAVEGAÇÃO POR TABS =====
  function initTabs() {
    const items = document.querySelectorAll('.sidebar-item');
    items.forEach(item => {
      item.addEventListener('click', function() {
        items.forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        const tab = this.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(`panel-${tab}`);
        if (panel) panel.classList.add('active');
        // Fecha sidebar mobile
        const sidebar = document.getElementById('appSidebar');
        if (window.innerWidth <= 768) sidebar.classList.remove('open');
      });
    });
  }

  // ===== PESQUISA GLOBAL =====
  function initGlobalSearch() {
    const input = document.getElementById('globalSearch');
    if (!input) return;
    input.addEventListener('input', function() {
      const termo = this.value.trim().toLowerCase();
      const teamTab = document.querySelector('.sidebar-item[data-tab="equipe"]');
      if (teamTab) {
        teamTab.click();
        const filterInput = document.getElementById('teamFilter');
        if (filterInput) {
          filterInput.value = termo;
          filterInput.dispatchEvent(new Event('input'));
        }
      }
    });
  }

  // ===== EXPORTA FUNÇÃO PARA RETRY =====
  window.carregarDados = carregarDados;

  // ===== INICIALIZAÇÃO =====
  function init() {
    console.log('🚀 Inicializando Portal COP v4...');
    initSidebar();
    initTabs();
    initGlobalSearch();

    // Verifica se os cards do dashboard têm os IDs corretos
    const ids = ['card-colaboradores', 'card-plantoes-mes', 'card-ferias', 'card-aniversariantes', 'card-proximo-fds', 'card-avisos'];
    ids.forEach(id => {
      if (!document.getElementById(id)) {
        console.warn(`⚠️ ID "${id}" não encontrado no DOM. Verifique o index.html`);
      }
    });

    carregarDados();
    window.dados = dados;
window.atualizarTudo = atualizarTudo;

    // Atualização periódica (5 min)
    setInterval(() => {
      if (dados) {
        buscarDadosRemotos()
          .then(novos => {
            dados = novos;
            salvarCache(novos);
            atualizarTudo();
          })
          .catch(() => {});
      }
    }, 5 * 60 * 1000);
  }

  // Aguarda DOM carregado
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // EXPOR GLOBALMENTE PARA NAVEGAÇÃO DOS PLANTÕES
  window.dados = dados;
  window.atualizarPlantao = atualizarPlantao;
  window.atualizarTudo = atualizarTudo;

})();
