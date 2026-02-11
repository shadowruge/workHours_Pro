
/**
 * WorkHours Pro - Vanilla JavaScript Logic
 */

// --- Estado da Aplicação ---
let records = JSON.parse(localStorage.getItem('work_records')) || [];
let userProfile = JSON.parse(localStorage.getItem('work_profile')) || { name: '', registration: '', role: '' };
let editingId = null;
let selectedMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM" ou "all"

// --- Seletores do DOM ---
const workForm = document.getElementById('work-form');
const historyList = document.getElementById('history-list');
const totalWorkedEl = document.getElementById('total-worked');
const totalOvertimeEl = document.getElementById('total-overtime');
const recordCountEl = document.getElementById('record-count');
const headerStatsEl = document.getElementById('header-stats');
const noteInput = document.getElementById('note');
const charCountEl = document.getElementById('char-count');
const btnCancel = document.getElementById('btn-cancel');
const btnSubmit = document.getElementById('btn-submit');
const btnExport = document.getElementById('btn-export');
const formTitle = document.getElementById('form-title');
const monthSidebarEl = document.getElementById('month-sidebar');

// Seletores do Perfil
const profileNameInp = document.getElementById('profile-name');
const profileIdInp = document.getElementById('profile-id');
const profileRoleInp = document.getElementById('profile-role');

// --- Funções Utilitarias ---

const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const formatMinutes = (minutes) => {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    return `${h}h ${String(m).padStart(2, '0')}min`;
};

const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00');
    return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
    }).format(date);
};

const calculateMetrics = (entry, exit, breakMin) => {
    const entryMin = timeToMinutes(entry);
    const exitMin = timeToMinutes(exit);
    let diff = exitMin - entryMin;

    // Tratamento para turno da noite (cruza meia-noite)
    if (diff < 0) diff += 1440;

    const workedMinutes = Math.max(0, diff - breakMin);
    const standardMinutes = 420; // 7 horas padrão
    const overtimeMinutes = Math.max(0, workedMinutes - standardMinutes);

    return { workedMinutes, overtimeMinutes };
};

// --- Funções Principais ---

const saveToLocal = () => {
    localStorage.setItem('work_records', JSON.stringify(records));
};

const saveProfile = () => {
    userProfile = {
        name: profileNameInp.value,
        registration: profileIdInp.value,
        role: profileRoleInp.value
    };
    localStorage.setItem('work_profile', JSON.stringify(userProfile));
};

const renderSidebar = () => {
    if (!monthSidebarEl) return;

    // Coleta todos os meses com registros, em ordem decrescente
    const monthKeys = [...new Set(records.map(r => r.date.slice(0, 7)))]
        .sort((a, b) => b.localeCompare(a));

    monthSidebarEl.innerHTML = '';

    // Item "Todos"
    const allItem = document.createElement('button');
    allItem.className = `sidebar-item w-full text-left px-3 py-2 rounded-lg ${selectedMonth === 'all' ? 'active' : ''}`;
    allItem.innerHTML = `<span class="sidebar-month-label block text-xs font-bold text-slate-700">Todos</span>`;
    allItem.addEventListener('click', () => {
        selectedMonth = 'all';
        renderSidebar();
        renderRecords();
    });
    monthSidebarEl.appendChild(allItem);

    monthKeys.forEach(key => {
        const [year, month] = key.split('-');
        const label = new Date(`${year}-${month}-15`).toLocaleDateString('pt-BR', { month: 'short' });
        const labelFull = new Date(`${year}-${month}-15`).toLocaleDateString('pt-BR', { month: 'long' });
        const count = records.filter(r => r.date.slice(0, 7) === key).length;
        const isActive = selectedMonth === key;
        const isCurrentMonth = key === new Date().toISOString().slice(0, 7);

        const item = document.createElement('button');
        item.className = `sidebar-item w-full text-left px-3 py-2 rounded-lg ${isActive ? 'active' : ''}`;
        item.innerHTML = `
            <span class="sidebar-month-label block text-xs font-bold capitalize ${isActive ? 'text-white' : 'text-slate-700'}">${labelFull}${isCurrentMonth ? ' •' : ''}</span>
            <span class="sidebar-month-sub block text-[10px] ${isActive ? 'text-indigo-200' : 'text-slate-400'}">${year} · ${count} dia${count > 1 ? 's' : ''}</span>
        `;
        item.addEventListener('click', () => {
            selectedMonth = key;
            renderSidebar();
            renderRecords();
        });
        monthSidebarEl.appendChild(item);
    });
};

const renderRecords = () => {
    historyList.innerHTML = '';

    if (records.length === 0) {
        historyList.innerHTML = `
            <div class="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <h3 class="text-slate-800 font-semibold mb-1 text-sm">Nenhum registro</h3>
                <p class="text-slate-400 text-xs">Adicione seu primeiro dia de trabalho.</p>
            </div>
        `;
    } else {
        // Filtra pelo mes selecionado no sidebar
        const filtered = selectedMonth === 'all'
            ? records
            : records.filter(r => r.date.slice(0, 7) === selectedMonth);

        if (filtered.length === 0) {
            historyList.innerHTML = `
                <div class="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                    <h3 class="text-slate-800 font-semibold mb-1 text-sm">Nenhum registro neste mês</h3>
                    <p class="text-slate-400 text-xs">Selecione outro mês ou adicione registros.</p>
                </div>
            `;
            updateStats();
            return;
        }

        // Agrupa registros por "YYYY-MM" em ordem decrescente
        const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

        const groups = {};
        sorted.forEach(record => {
            const monthKey = record.date.slice(0, 7); // "YYYY-MM"
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push(record);
        });

        // Itera cada grupo (ordem decrescente herdada do sort)
        Object.entries(groups).forEach(([monthKey, monthRecords]) => {
            // --- Cabecalho do mes ---
            const [year, month] = monthKey.split('-');
            const monthLabel = new Date(`${year}-${month}-15`).toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric'
            });

            const totalMonthWorked = monthRecords.reduce((acc, r) => acc + r.workedMin, 0);
            const totalMonthOvertime = monthRecords.reduce((acc, r) => acc + r.overtimeMin, 0);

            const separator = document.createElement('div');
            separator.className = "flex items-center justify-between gap-3 mt-2 mb-1";
            separator.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-slate-500 uppercase tracking-widest capitalize">${monthLabel}</span>
                    <span class="text-[10px] font-bold text-slate-300">${monthRecords.length} dia${monthRecords.length > 1 ? 's' : ''}</span>
                </div>
                <div class="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                    <span class="text-slate-400">${formatMinutes(totalMonthWorked)}</span>
                    ${totalMonthOvertime > 0 ? `<span class="text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">+${formatMinutes(totalMonthOvertime)} extra</span>` : ''}
                </div>
            `;
            historyList.appendChild(separator);

            const divider = document.createElement('hr');
            divider.className = "border-slate-100 mb-3";
            historyList.appendChild(divider);

            // --- Cards do mes ---
            monthRecords.forEach(record => {
                const card = document.createElement('div');
                card.className = "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:border-indigo-200 transition-all mb-3";
                card.innerHTML = `
                    <div class="p-5">
                        <div class="flex items-start justify-between gap-4 mb-4">
                            <div class="flex items-center gap-3">
                                <div class="bg-slate-100 px-3 py-1 rounded-lg text-center min-w-[50px]">
                                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter">${new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}</span>
                                    <span class="block text-lg font-black text-slate-700 leading-none">${new Date(record.date + 'T12:00:00').getDate()}</span>
                                </div>
                                <div>
                                    <h4 class="font-bold text-slate-800 text-sm">${formatDate(record.date)}</h4>
                                    <p class="text-[10px] text-slate-400 font-semibold uppercase">${record.entry} → ${record.exit} • ${record.breakMin}m PAUSA</p>
                                </div>
                            </div>
                            <div class="flex gap-1">
                                <button onclick="editRecord('${record.id}')" class="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onclick="deleteRecord('${record.id}')" class="p-2 text-slate-300 hover:text-red-600 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                        ${record.note ? `<div class="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 text-xs text-slate-600 leading-relaxed italic">"${record.note}"</div>` : ''}
                        <div class="flex items-center justify-between text-[11px] pt-3 border-t border-slate-50">
                            <span class="text-slate-400 font-bold uppercase tracking-wider">Trabalhado</span>
                            <div class="flex items-center gap-2">
                                ${record.overtimeMin > 0 ? `<span class="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">+${formatMinutes(record.overtimeMin)} EXTRA</span>` : ''}
                                <span class="text-slate-800 font-bold">${formatMinutes(record.workedMin)}</span>
                            </div>
                        </div>
                    </div>
                `;
                historyList.appendChild(card);
            });

            // Espaco entre grupos
            const spacer = document.createElement('div');
            spacer.className = "pb-2";
            historyList.appendChild(spacer);
        });
    }

    updateStats();
};

const updateStats = () => {
    const filtered = selectedMonth === 'all'
        ? records
        : records.filter(r => r.date.slice(0, 7) === selectedMonth);

    const totalW = filtered.reduce((acc, r) => acc + r.workedMin, 0);
    const totalO = filtered.reduce((acc, r) => acc + r.overtimeMin, 0);

    let label;
    if (selectedMonth === 'all') {
        label = 'Todos os meses';
    } else {
        const [year, month] = selectedMonth.split('-');
        label = new Date(`${year}-${month}-15`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    const labelWorked = document.querySelector('[for-stat="worked-label"]');
    const labelOvertime = document.querySelector('[for-stat="overtime-label"]');
    const shortLabel = selectedMonth === 'all' ? 'Total geral' : label;
    if (labelWorked) labelWorked.innerText = `Trabalhado — ${shortLabel}`;
    if (labelOvertime) labelOvertime.innerText = `Extras — ${shortLabel}`;

    totalWorkedEl.innerText = formatMinutes(totalW);
    totalOvertimeEl.innerText = formatMinutes(totalO);
    recordCountEl.innerText = `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}`;
    headerStatsEl.innerHTML = `
        <span class="capitalize">${label}: ${formatMinutes(totalW)}</span>
        <span class="text-indigo-600">Extras: ${formatMinutes(totalO)}</span>
    `;
};

/**
 * Gera um arquivo CSV compatÃ­vel com Excel incluindo dados do colaborador
 */
const exportToExcel = () => {
    if (records.length === 0) {
        alert('NÃ£o hÃ¡ registros para exportar.');
        return;
    }

    // Bloco de IdentificaÃ§Ã£o no Topo
    const profileBlock = [
        ['RELATÃ“RIO DE HORAS TRABALHADAS'],
        [''],
        ['COLABORADOR:', userProfile.name || 'NÃ£o Informado'],
        ['MATRÃCULA:', userProfile.registration || 'NÃ£o Informado'],
        ['FUNÃ‡ÃƒO:', userProfile.role || 'NÃ£o Informado'],
        ['DATA DE EMISSÃƒO:', new Date().toLocaleDateString('pt-BR')],
        [''],
        ['']
    ];

    const headers = ['Data', 'Entrada', 'Saida', 'Pausa (min)', 'Nota', 'Trabalhadas', 'Extras'];

    const rows = records.sort((a, b) => b.date.localeCompare(a.date)).map(r => [
        r.date,
        r.entry,
        r.exit,
        r.breakMin,
        (r.note || '').replace(/;/g, ',').replace(/\n/g, ' '),
        formatMinutes(r.workedMin),
        formatMinutes(r.overtimeMin)
    ]);

    // Combina tudo
    const contentArr = [
        ...profileBlock.map(row => row.join(';')),
        headers.join(';'),
        ...rows.map(row => row.join(';'))
    ];

    const csvContent = "\uFEFF" + contentArr.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const namePrefix = (userProfile.name || 'Usuario').split(' ')[0];

    link.setAttribute("href", url);
    link.setAttribute("download", `Ponto_${namePrefix}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- Handlers de Eventos ---

// Salvar perfil em tempo real
[profileNameInp, profileIdInp, profileRoleInp].forEach(inp => {
    inp.addEventListener('input', saveProfile);
});

workForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const data = {
        date: document.getElementById('date').value,
        entry: document.getElementById('entry').value,
        exit: document.getElementById('exit').value,
        breakMin: parseInt(document.getElementById('break').value) || 0,
        note: document.getElementById('note').value
    };

    const { workedMinutes, overtimeMinutes } = calculateMetrics(data.entry, data.exit, data.breakMin);

    if (editingId) {
        records = records.map(r => r.id === editingId ? {
            ...r,
            ...data,
            workedMin: workedMinutes,
            overtimeMin: overtimeMinutes
        } : r);
        editingId = null;
    } else {
        const newRecord = {
            id: Date.now().toString(),
            ...data,
            workedMin: workedMinutes,
            overtimeMin: overtimeMinutes
        };
        records.push(newRecord);
    }

    saveToLocal();
    workForm.reset();
    resetFormState();
    renderSidebar();
    renderRecords();
});

const resetFormState = () => {
    editingId = null;
    formTitle.innerText = 'Novo Registro';
    btnSubmit.innerText = 'Salvar Registro';
    btnCancel.classList.add('hidden');
    charCountEl.innerText = '0';
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
    document.getElementById('entry').value = '08:00';
    document.getElementById('exit').value = '17:00';
    document.getElementById('break').value = '60';
};

btnCancel.addEventListener('click', resetFormState);

noteInput.addEventListener('input', (e) => {
    charCountEl.innerText = e.target.value.length;
});

btnExport.addEventListener('click', exportToExcel);

// --- FunÃ§Ãµes Expostas Globalmente ---

window.deleteRecord = (id) => {
    if (confirm('Deseja excluir este registro?')) {
        records = records.filter(r => r.id !== id);
        saveToLocal();
        renderSidebar();
        renderRecords();
    }
};

window.editRecord = (id) => {
    const record = records.find(r => r.id === id);
    if (!record) return;

    editingId = id;
    document.getElementById('date').value = record.date;
    document.getElementById('entry').value = record.entry;
    document.getElementById('exit').value = record.exit;
    document.getElementById('break').value = record.breakMin;
    document.getElementById('note').value = record.note;
    charCountEl.innerText = (record.note || '').length;

    formTitle.innerText = 'Editar Registro';
    btnSubmit.innerText = 'Atualizar';
    btnCancel.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- InicializaÃ§Ã£o ---
document.addEventListener('DOMContentLoaded', () => {
    // Carregar Perfil
    profileNameInp.value = userProfile.name || '';
    profileIdInp.value = userProfile.registration || '';
    profileRoleInp.value = userProfile.role || '';

    resetFormState();
    renderSidebar();
    renderRecords();
});
