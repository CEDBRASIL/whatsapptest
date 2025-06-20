const tabDisparos = document.getElementById('tab-disparos');
const tabLeads = document.getElementById('tab-leads');
const disparosSection = document.getElementById('disparos');
const leadsSection = document.getElementById('leads');
const gruposDiv = document.getElementById('grupos');
const participantesDiv = document.getElementById('participantes');
const listaNumeros = document.getElementById('lista-numeros');
const grupoNome = document.getElementById('grupo-nome');

function switchTab(tab) {
  if (tab === 'disparos') {
    tabDisparos.classList.add('active');
    tabLeads.classList.remove('active');
    disparosSection.classList.remove('hidden');
    leadsSection.classList.add('hidden');
  } else {
    tabLeads.classList.add('active');
    tabDisparos.classList.remove('active');
    leadsSection.classList.remove('hidden');
    disparosSection.classList.add('hidden');
    loadGrupos();
  }
}

tabDisparos.addEventListener('click', () => switchTab('disparos'));
tabLeads.addEventListener('click', () => switchTab('leads'));

async function disparar(acao) {
  const numeros = document.getElementById('numeros').value;
  const mensagem = document.getElementById('mensagem').value;
  if (acao === 'iniciar') {
    await fetch('/disparar', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ numeros, mensagem })
    });
  } else {
    await fetch('/' + acao, { method: 'POST' });
  }
}

document.getElementById('iniciar').addEventListener('click', () => disparar('disparar'));
document.getElementById('pausar').addEventListener('click', () => disparar('pausar'));
document.getElementById('continuar').addEventListener('click', () => disparar('continuar'));

async function loadGrupos() {
  gruposDiv.innerHTML = 'Carregando...';
  const res = await fetch('/grupos');
  const grupos = await res.json();
  gruposDiv.innerHTML = '';
  grupos.forEach(g => {
    const btn = document.createElement('button');
    btn.textContent = g.nome;
    btn.addEventListener('click', () => loadGrupo(g.nome));
    gruposDiv.appendChild(btn);
  });
}

async function loadGrupo(nome) {
  const res = await fetch('/grupos/' + encodeURIComponent(nome));
  const data = await res.json();
  participantesDiv.classList.remove('hidden');
  grupoNome.textContent = data.nome;
  listaNumeros.innerHTML = '';
  data.participantes.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.numero + (p.admin ? ' (admin)' : '');
    listaNumeros.appendChild(li);
  });
}

document.getElementById('exportar-csv').addEventListener('click', () => {
  const rows = Array.from(listaNumeros.children).map(li => [li.textContent]);
  let csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = grupoNome.textContent + '.csv';
  a.click();
});

document.getElementById('exportar-xlsx').addEventListener('click', () => {
  const rows = Array.from(listaNumeros.children).map(li => [li.textContent]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  XLSX.writeFile(wb, grupoNome.textContent + '.xlsx');
});
