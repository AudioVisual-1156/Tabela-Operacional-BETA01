/* ============================================================
   SISTEMA DE RELATÓRIO OPERACIONAL DIÁRIO - AUDIOVISUAL
   Script Principal — Lógica Completa do Sistema
   ============================================================ */

// ==================== CONSTANTS & STATE ====================

const STORAGE_KEY = 'sro_activities';
const THEME_KEY   = 'sro_theme';

const STATUS_MAP = {
    'Não Iniciada': 'nao-iniciada',
    'Em Andamento': 'em-andamento',
    'Pausada':      'pausada',
    'Concluída':    'concluida',
    'Cancelada':    'cancelada'
};

const STATUS_COLORS_CHART = {
    'Não Iniciada': '#0284c7',
    'Em Andamento': '#d97706',
    'Pausada':      '#94a3b8',
    'Concluída':    '#059669',
    'Cancelada':    '#dc2626'
};

const CHART_PALETTE = [
    '#3b82f6', '#059669', '#d97706', '#dc2626', '#7c3aed',
    '#0d9488', '#ea580c', '#4f46e5', '#0284c7', '#be185d',
    '#65a30d', '#9333ea', '#0891b2', '#c2410c', '#6d28d9'
];

let activities = [];
let currentView = 'dashboard';
let sortColumn = null;
let sortDirection = 'asc';
let confirmCallback = null;



// ==================== DOM REFERENCES ====================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadActivities();
    initClock();
    initNavigation();
    initForm();

    initTable();
    initReport();
    initModals();
    initGlobalSearch();
    setFormDefaults();
    updateDashboard();
    renderTable();
    updateRecentList();

    // Hide loading screen
    setTimeout(() => {
        $('#loading-screen').classList.add('hidden');
    }, 800);
});

// ==================== THEME ====================

function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeIcon(next);
    // Re-render charts with new theme
    renderCharts();
}

function updateThemeIcon(theme) {
    const icon = $('#theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
}

$('#theme-toggle')?.addEventListener('click', toggleTheme);

// ==================== CLOCK ====================

function initClock() {
    function update() {
        const now = new Date();
        const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const date = now.toLocaleDateString('pt-BR');
        const clockEl = $('#sidebar-clock');
        const dateEl = $('#sidebar-date');
        if (clockEl) clockEl.textContent = time;
        if (dateEl)  dateEl.textContent  = date;
    }
    update();
    setInterval(update, 1000);
}

// ==================== NAVIGATION ====================

function initNavigation() {
    const navItems = $$('.nav-item');
    const titles = {
        'dashboard': 'Dashboard Operacional',
        'registro':  'Novo Registro de Demanda',
        'tabela':    'Tabela Operacional',
        'relatorio': 'Relatório Operacional Diário'
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            switchView(view, titles[view]);
            // Close sidebar on mobile
            $('#sidebar').classList.remove('open');
        });
    });

    // Sidebar toggle (mobile)
    $('#sidebar-toggle-open')?.addEventListener('click', () => {
        $('#sidebar').classList.add('open');
    });
    $('#sidebar-toggle-close')?.addEventListener('click', () => {
        $('#sidebar').classList.remove('open');
    });

    // Fullscreen
    $('#btn-fullscreen')?.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    });
}

function switchView(view, title) {
    currentView = view;
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#view-${view}`)?.classList.add('active');
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    $(`.nav-item[data-view="${view}"]`)?.classList.add('active');
    if (title) $('#page-title').textContent = title;

    if (view === 'dashboard') {
        updateDashboard();
        renderCharts();
    }
    if (view === 'tabela') renderTable();
}

// ==================== STORAGE ====================

function loadActivities() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        activities = data ? JSON.parse(data) : [];
    } catch {
        activities = [];
    }
}

function saveActivities() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
}

// ==================== FORM ====================

function setFormDefaults() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    $('#field-data').value = dateStr;
    $('#field-hora').value = timeStr;
    $('#field-inicio').value = timeStr;
}

function initForm() {
    const form = $('#activity-form');
    form.addEventListener('submit', handleFormSubmit);

    // Auto-calculate tempo total
    $('#field-inicio')?.addEventListener('change', calcTempoTotal);
    $('#field-termino')?.addEventListener('change', calcTempoTotal);

    // Clear button
    $('#btn-limpar')?.addEventListener('click', resetForm);
}

function calcTempoTotal() {
    const inicio  = $('#field-inicio').value;
    const termino = $('#field-termino').value;
    const display = $('#tempo-total-display');

    if (inicio && termino) {
        const mins = calcMinutesDiff(inicio, termino);
        if (mins >= 0) {
            display.textContent = formatMinutes(mins);
        } else {
            display.textContent = '--h --min';
        }
    } else {
        display.textContent = '--h --min';
    }
}

function calcMinutesDiff(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
}

function formatMinutes(mins) {
    if (mins < 0) return '--h --min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}min`;
    return `${h}h ${m}min`;
}

function handleFormSubmit(e) {
    e.preventDefault();

    const editId = $('#edit-id').value;
    const data = {
        id:           editId || generateId(),
        data:         $('#field-data').value,
        hora:         $('#field-hora').value,
        colaborador:  $('#field-colaborador').value.trim(),
        equipe:       $('#field-equipe').value.trim(),
        local:        $('#field-local').value.trim(),
        tipo:         $('#field-tipo').value,
        descricao:    $('#field-descricao').value.trim(),
        inicio:       $('#field-inicio').value,
        termino:      $('#field-termino').value || '',
        status:       $('#field-status').value,
        observacoes:  $('#field-observacoes').value.trim(),
        tempoTotal:   0,
        createdAt:    editId ? (activities.find(a => a.id === editId)?.createdAt || Date.now()) : Date.now()
    };

    // Calculate tempo total
    if (data.inicio && data.termino) {
        data.tempoTotal = Math.max(0, calcMinutesDiff(data.inicio, data.termino));
    }

    if (editId) {
        // Update existing
        const idx = activities.findIndex(a => a.id === editId);
        if (idx !== -1) activities[idx] = data;
        notify('Registro atualizado com sucesso!', 'success');
    } else {
        // Add new
        activities.push(data);
        notify('Atividade registrada com sucesso!', 'success');
    }

    saveActivities();
    resetForm();
    updateDashboard();
    renderTable();
    updateRecentList();
    renderCharts();
}

function resetForm() {
    $('#activity-form').reset();
    $('#edit-id').value = '';
    $('#tempo-total-display').textContent = '--h --min';
    $('#btn-salvar').innerHTML = '<span class="material-icons-outlined">save</span> Salvar Registro';
    setFormDefaults();
}

function editActivity(id) {
    const act = activities.find(a => a.id === id);
    if (!act) return;

    switchView('registro', 'Editar Registro');

    $('#edit-id').value          = act.id;
    $('#field-data').value       = act.data;
    $('#field-hora').value       = act.hora;
    $('#field-colaborador').value = act.colaborador;
    $('#field-equipe').value     = act.equipe;
    $('#field-local').value      = act.local;
    $('#field-tipo').value       = act.tipo;
    $('#field-descricao').value  = act.descricao;
    $('#field-inicio').value     = act.inicio;
    $('#field-termino').value    = act.termino;
    $('#field-status').value     = act.status;
    $('#field-observacoes').value = act.observacoes;

    calcTempoTotal();
    $('#btn-salvar').innerHTML = '<span class="material-icons-outlined">save</span> Atualizar Registro';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteActivity(id) {
    showConfirm('Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.', () => {
        activities = activities.filter(a => a.id !== id);
        saveActivities();
        renderTable();
        updateDashboard();
        updateRecentList();
        renderCharts();
        notify('Registro excluído com sucesso.', 'warning');
    });
}



// ==================== TABLE ====================

function initTable() {
    // Filters
    $('#filter-data')?.addEventListener('change', renderTable);
    $('#filter-colaborador')?.addEventListener('input', renderTable);
    $('#filter-status')?.addEventListener('change', renderTable);
    $('#filter-local')?.addEventListener('input', renderTable);
    $('#table-search')?.addEventListener('input', renderTable);
    $('#btn-clear-filters')?.addEventListener('click', clearFilters);

    // Sort
    $$('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (sortColumn === col) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = col;
                sortDirection = 'asc';
            }
            // Update visual
            $$('th.sortable').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
            th.classList.add(`sort-${sortDirection}`);
            th.querySelector('.sort-icon').textContent = sortDirection === 'asc' ? '↑' : '↓';
            renderTable();
        });
    });

    // Delete all
    $('#btn-delete-all')?.addEventListener('click', () => {
        showConfirm('Tem certeza que deseja excluir TODOS os registros? Esta ação é irreversível.', () => {
            activities = [];
            saveActivities();
            renderTable();
            updateDashboard();
            updateRecentList();
            renderCharts();
            notify('Todos os registros foram excluídos.', 'warning');
        });
    });
}

function clearFilters() {
    $('#filter-data').value = '';
    $('#filter-colaborador').value = '';
    $('#filter-status').value = '';
    $('#filter-local').value = '';
    $('#table-search').value = '';
    renderTable();
}

function getFilteredActivities() {
    let filtered = [...activities];

    const fData   = $('#filter-data')?.value || '';
    const fColab  = ($('#filter-colaborador')?.value || '').toLowerCase();
    const fStatus = $('#filter-status')?.value || '';
    const fLocal  = ($('#filter-local')?.value || '').toLowerCase();
    const fSearch = ($('#table-search')?.value || '').toLowerCase();

    if (fData)   filtered = filtered.filter(a => a.data === fData);
    if (fColab)  filtered = filtered.filter(a => a.colaborador.toLowerCase().includes(fColab));
    if (fStatus) filtered = filtered.filter(a => a.status === fStatus);
    if (fLocal)  filtered = filtered.filter(a => a.local.toLowerCase().includes(fLocal));

    if (fSearch) {
        filtered = filtered.filter(a =>
            Object.values(a).some(v =>
                String(v).toLowerCase().includes(fSearch)
            )
        );
    }

    // Sort
    if (sortColumn) {
        filtered.sort((a, b) => {
            let va = a[sortColumn] || '';
            let vb = b[sortColumn] || '';
            if (sortColumn === 'tempoTotal') {
                va = Number(va); vb = Number(vb);
            } else {
                va = String(va).toLowerCase();
                vb = String(vb).toLowerCase();
            }
            if (va < vb) return sortDirection === 'asc' ? -1 : 1;
            if (va > vb) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return filtered;
}

function renderTable() {
    const tbody = $('#table-body');
    const filtered = getFilteredActivities();
    const deleteAllBtn = $('#btn-delete-all');

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="11">
                    <div class="empty-state">
                        <span class="material-icons-outlined">inbox</span>
                        <p>Nenhuma atividade encontrada</p>
                        <span class="empty-hint">Ajuste os filtros ou adicione novos registros</span>
                    </div>
                </td>
            </tr>`;
        $('#table-count').textContent = '0 registros encontrados';
        if (deleteAllBtn) deleteAllBtn.style.display = 'none';
        return;
    }

    if (deleteAllBtn) deleteAllBtn.style.display = activities.length > 0 ? 'inline-flex' : 'none';

    tbody.innerHTML = filtered.map(a => `
        <tr class="animate-fade">
            <td>${formatDateBR(a.data)}</td>
            <td>${a.hora}</td>
            <td><strong>${escapeHtml(a.colaborador)}</strong></td>
            <td>${escapeHtml(a.local)}</td>
            <td>${escapeHtml(a.tipo)} — ${escapeHtml(truncate(a.descricao, 40))}</td>
            <td>${a.inicio}</td>
            <td>${a.termino || '—'}</td>
            <td><strong>${a.tempoTotal > 0 ? formatMinutes(a.tempoTotal) : '—'}</strong></td>
            <td><span class="status-badge ${STATUS_MAP[a.status] || ''}">${a.status}</span></td>
            <td>${escapeHtml(truncate(a.observacoes || '—', 25))}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit" onclick="editActivity('${a.id}')" title="Editar">
                        <span class="material-icons-outlined">edit</span>
                    </button>
                    <button class="action-btn edit" onclick="quickEdit('${a.id}')" title="Edição rápida">
                        <span class="material-icons-outlined">bolt</span>
                    </button>
                    <button class="action-btn delete" onclick="deleteActivity('${a.id}')" title="Excluir">
                        <span class="material-icons-outlined">delete</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    $('#table-count').textContent = `${filtered.length} registro${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`;
}

// ==================== QUICK EDIT (MODAL) ====================

function quickEdit(id) {
    const act = activities.find(a => a.id === id);
    if (!act) return;

    $('#modal-edit-id').value = id;
    $('#modal-status').value = act.status;
    $('#modal-termino').value = act.termino || '';
    $('#modal-observacoes').value = act.observacoes || '';

    $('#edit-modal').style.display = 'flex';
}

function initModals() {
    // Edit modal
    $('#modal-close')?.addEventListener('click', closeEditModal);
    $('#modal-cancel')?.addEventListener('click', closeEditModal);
    $('#edit-form')?.addEventListener('submit', handleQuickEditSubmit);

    // Confirm modal
    $('#confirm-yes')?.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        closeConfirmModal();
    });
    $('#confirm-no')?.addEventListener('click', closeConfirmModal);

    // Close on overlay click
    $('#edit-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeEditModal();
    });
    $('#confirm-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeConfirmModal();
    });
}

function closeEditModal() {
    $('#edit-modal').style.display = 'none';
}

function handleQuickEditSubmit(e) {
    e.preventDefault();
    const id = $('#modal-edit-id').value;
    const act = activities.find(a => a.id === id);
    if (!act) return;

    act.status = $('#modal-status').value;
    const newTermino = $('#modal-termino').value;
    if (newTermino) {
        act.termino = newTermino;
        if (act.inicio) {
            act.tempoTotal = Math.max(0, calcMinutesDiff(act.inicio, act.termino));
        }
    }
    act.observacoes = $('#modal-observacoes').value.trim();

    saveActivities();
    renderTable();
    updateDashboard();
    renderCharts();
    closeEditModal();
    notify('Registro atualizado com sucesso!', 'success');
}

function showConfirm(message, callback) {
    $('#confirm-message').textContent = message;
    confirmCallback = callback;
    $('#confirm-modal').style.display = 'flex';
}

function closeConfirmModal() {
    $('#confirm-modal').style.display = 'none';
    confirmCallback = null;
}

// ==================== RECENT LIST ====================

function updateRecentList() {
    const list = $('#recent-list');
    if (!list) return;

    const recent = [...activities].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

    if (recent.length === 0) {
        list.innerHTML = '<li class="empty-state-mini">Nenhum registro recente</li>';
        return;
    }

    list.innerHTML = recent.map(a => `
        <li>
            <span class="recent-time">${a.hora}</span>
            <span>${escapeHtml(a.tipo)} — ${escapeHtml(truncate(a.descricao, 30))}</span>
        </li>
    `).join('');
}

// ==================== DASHBOARD ====================

function updateDashboard() {
    const total     = activities.length;
    const concluidas = activities.filter(a => a.status === 'Concluída').length;
    const andamento  = activities.filter(a => a.status === 'Em Andamento').length;
    const totalMins  = activities.reduce((s, a) => s + (a.tempoTotal || 0), 0);

    // Most active collaborator
    const colabCount = {};
    activities.forEach(a => { colabCount[a.colaborador] = (colabCount[a.colaborador] || 0) + 1; });
    const topColab = Object.entries(colabCount).sort((a, b) => b[1] - a[1])[0];

    // Most active location
    const localCount = {};
    activities.forEach(a => { localCount[a.local] = (localCount[a.local] || 0) + 1; });
    const topLocal = Object.entries(localCount).sort((a, b) => b[1] - a[1])[0];

    // Daily average
    const dates = [...new Set(activities.map(a => a.data))];
    const avgDaily = dates.length > 0 ? (total / dates.length).toFixed(1) : 0;

    // Update KPI values
    animateValue('kpi-total-val', total);
    animateValue('kpi-concluidas-val', concluidas);
    animateValue('kpi-andamento-val', andamento);
    $('#kpi-tempo-val').textContent = formatMinutes(totalMins);
    $('#kpi-ativo-val').textContent = topColab ? topColab[0] : '—';
    $('#kpi-local-val').textContent = topLocal ? topLocal[0] : '—';
    $('#kpi-media-val').textContent = avgDaily;

    renderCharts();
}

function animateValue(elId, target) {
    const el = document.getElementById(elId);
    if (!el) return;
    const current = parseInt(el.textContent) || 0;
    if (current === target) { el.textContent = target; return; }

    const duration = 400;
    const start = performance.now();

    function step(timestamp) {
        const progress = Math.min((timestamp - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = Math.round(current + (target - current) * eased);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ==================== CHARTS (Canvas) ====================

function renderCharts() {
    renderCollaboratorChart();
    renderStatusChart();
    renderTempoChart();
}

function getChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        text:    isDark ? '#94a3b8' : '#475569',
        grid:    isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)',
        bg:      isDark ? '#1a2236' : '#ffffff'
    };
}

function renderCollaboratorChart() {
    const canvas = document.getElementById('chart-colaborador');
    const emptyEl = document.getElementById('chart-colab-empty');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const colors = getChartColors();

    // Gather data
    const counts = {};
    activities.forEach(a => { counts[a.colaborador] = (counts[a.colaborador] || 0) + 1; });
    const labels = Object.keys(counts);
    const values = Object.values(counts);

    if (labels.length === 0) {
        canvas.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    // Size
    const w = canvas.parentElement.clientWidth - 48;
    const h = 280;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw bars
    const padding = { top: 20, right: 20, bottom: 50, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const maxVal = Math.max(...values, 1);
    const barW = Math.min(48, (chartW / labels.length) * .6);
    const gap = (chartW - barW * labels.length) / (labels.length + 1);

    // Grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + chartH - (chartH * i / 4);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = colors.text;
        ctx.font = '11px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(maxVal * i / 4), padding.left - 8, y + 4);
    }

    // Bars
    labels.forEach((label, i) => {
        const x = padding.left + gap + i * (barW + gap);
        const barH = (values[i] / maxVal) * chartH;
        const y = padding.top + chartH - barH;

        // Bar gradient
        const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
        const color = CHART_PALETTE[i % CHART_PALETTE.length];
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '88');

        ctx.fillStyle = gradient;
        roundRect(ctx, x, y, barW, barH, 4);
        ctx.fill();

        // Value on top
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(values[i], x + barW / 2, y - 6);

        // Label
        ctx.font = '10px Inter';
        ctx.fillStyle = colors.text;
        ctx.save();
        ctx.translate(x + barW / 2, padding.top + chartH + 12);
        const labelText = label.length > 10 ? label.slice(0, 10) + '…' : label;
        ctx.fillText(labelText, 0, 0);
        ctx.restore();
    });
}

function renderStatusChart() {
    const canvas = document.getElementById('chart-status');
    const emptyEl = document.getElementById('chart-status-empty');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const colors = getChartColors();

    const counts = {};
    activities.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const total = values.reduce((s, v) => s + v, 0);

    if (labels.length === 0) {
        canvas.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    const w = canvas.parentElement.clientWidth - 48;
    const h = 280;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Doughnut chart
    const cx = w * .38;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 30;
    const innerRadius = radius * .55;
    let startAngle = -Math.PI / 2;

    labels.forEach((label, i) => {
        const sliceAngle = (values[i] / total) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;
        const color = STATUS_COLORS_CHART[label] || CHART_PALETTE[i];

        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        startAngle = endAngle;
    });

    // Center text
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 24px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy - 6);
    ctx.font = '11px Inter';
    ctx.fillText('Total', cx, cy + 14);

    // Legend
    const legendX = w * .68;
    let legendY = (h - labels.length * 26) / 2;

    labels.forEach((label, i) => {
        const color = STATUS_COLORS_CHART[label] || CHART_PALETTE[i];
        const pct = ((values[i] / total) * 100).toFixed(0);

        ctx.fillStyle = color;
        roundRect(ctx, legendX, legendY, 12, 12, 3);
        ctx.fill();

        ctx.fillStyle = colors.text;
        ctx.font = '12px Inter';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${label} (${values[i]} — ${pct}%)`, legendX + 20, legendY + 6);

        legendY += 26;
    });
}

function renderTempoChart() {
    const canvas = document.getElementById('chart-tempo');
    const emptyEl = document.getElementById('chart-tempo-empty');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const colors = getChartColors();

    // Group tempo by date
    const dateMap = {};
    activities.forEach(a => {
        if (!dateMap[a.data]) dateMap[a.data] = 0;
        dateMap[a.data] += (a.tempoTotal || 0);
    });
    const dates = Object.keys(dateMap).sort();
    const values = dates.map(d => dateMap[d] / 60); // convert to hours

    if (dates.length === 0) {
        canvas.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    const w = canvas.parentElement.clientWidth - 48;
    const h = 280;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const padding = { top: 20, right: 20, bottom: 50, left: 55 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const maxVal = Math.max(...values, 0.5);
    const barW = Math.min(48, (chartW / dates.length) * .6);
    const gap = (chartW - barW * dates.length) / (dates.length + 1);

    // Grid
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + chartH - (chartH * i / 4);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = colors.text;
        ctx.font = '11px Inter';
        ctx.textAlign = 'right';
        ctx.fillText((maxVal * i / 4).toFixed(1) + 'h', padding.left - 8, y + 4);
    }

    // Bars
    dates.forEach((date, i) => {
        const x = padding.left + gap + i * (barW + gap);
        const barH = (values[i] / maxVal) * chartH;
        const y = padding.top + chartH - barH;

        const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
        gradient.addColorStop(0, '#7c3aed');
        gradient.addColorStop(1, '#7c3aed55');
        ctx.fillStyle = gradient;
        roundRect(ctx, x, y, barW, barH, 4);
        ctx.fill();

        // Value
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(values[i].toFixed(1) + 'h', x + barW / 2, y - 6);

        // Date label
        ctx.font = '10px Inter';
        const parts = date.split('-');
        const dateLabel = `${parts[2]}/${parts[1]}`;
        ctx.fillText(dateLabel, x + barW / 2, padding.top + chartH + 16);
    });
}

function roundRect(ctx, x, y, w, h, r) {
    if (h <= 0) { ctx.beginPath(); return; }
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// Redraw charts on resize
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (currentView === 'dashboard') renderCharts();
    }, 200);
});

// ==================== REPORT ====================

function initReport() {
    $('#btn-gerar-relatorio')?.addEventListener('click', generateReport);
    $('#btn-export-pdf')?.addEventListener('click', exportPDF);
    $('#btn-export-print')?.addEventListener('click', exportPrint);
    $('#btn-export-json')?.addEventListener('click', exportJSON);
    $('#btn-export-csv')?.addEventListener('click', exportCSV);
}

function generateReport() {
    const container = $('#report-content');
    if (!container) return;

    if (activities.length === 0) {
        container.innerHTML = `
            <div class="report-placeholder">
                <span class="material-icons-outlined">warning</span>
                <p>Nenhuma atividade registrada para gerar o relatório.</p>
            </div>`;
        notify('Nenhuma atividade para gerar relatório.', 'warning');
        return;
    }

    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const total = activities.length;
    const concluidas = activities.filter(a => a.status === 'Concluída').length;
    const pendentes = activities.filter(a => a.status !== 'Concluída' && a.status !== 'Cancelada').length;
    const totalMins = activities.reduce((s, a) => s + (a.tempoTotal || 0), 0);
    const mediaMins = total > 0 ? Math.round(totalMins / total) : 0;

    // Per collaborator
    const colabData = {};
    activities.forEach(a => {
        if (!colabData[a.colaborador]) colabData[a.colaborador] = { count: 0, mins: 0 };
        colabData[a.colaborador].count++;
        colabData[a.colaborador].mins += (a.tempoTotal || 0);
    });

    // Per location
    const localData = {};
    activities.forEach(a => {
        localData[a.local] = (localData[a.local] || 0) + 1;
    });

    // Timeline (sorted)
    const timeline = [...activities].sort((a, b) => {
        if (a.data !== b.data) return a.data.localeCompare(b.data);
        return (a.inicio || '').localeCompare(b.inicio || '');
    });

    container.innerHTML = `
        <!-- REPORT HEADER -->
        <div class="report-header animate-slide">
            <h2>RELATÓRIO OPERACIONAL DIÁRIO</h2>
            <p>Unicesumar — Audiovisual</p>
            <p style="margin-top:4px;font-weight:600;color:var(--text-primary);">${today}</p>
        </div>

        <!-- RESUMO GERAL -->
        <div class="report-section animate-slide">
            <div class="report-section-title">
                <span class="material-icons-outlined">assessment</span> Resumo Geral
            </div>
            <div class="report-kpi-grid">
                <div class="report-kpi">
                    <div class="report-kpi-value">${total}</div>
                    <div class="report-kpi-label">Total de Atividades</div>
                </div>
                <div class="report-kpi">
                    <div class="report-kpi-value">${concluidas}</div>
                    <div class="report-kpi-label">Concluídas</div>
                </div>
                <div class="report-kpi">
                    <div class="report-kpi-value">${pendentes}</div>
                    <div class="report-kpi-label">Pendentes</div>
                </div>
                <div class="report-kpi">
                    <div class="report-kpi-value">${formatMinutes(totalMins)}</div>
                    <div class="report-kpi-label">Horas Trabalhadas</div>
                </div>
                <div class="report-kpi">
                    <div class="report-kpi-value">${formatMinutes(mediaMins)}</div>
                    <div class="report-kpi-label">Média por Atividade</div>
                </div>
            </div>
        </div>

        <!-- RESUMO POR COLABORADOR -->
        <div class="report-section animate-slide">
            <div class="report-section-title">
                <span class="material-icons-outlined">groups</span> Resumo por Colaborador
            </div>
            <table class="report-mini-table">
                <thead>
                    <tr>
                        <th>Colaborador</th>
                        <th>Demandas</th>
                        <th>Tempo Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(colabData).sort((a, b) => b[1].count - a[1].count).map(([name, d]) => `
                        <tr>
                            <td><strong>${escapeHtml(name)}</strong></td>
                            <td>${d.count}</td>
                            <td>${formatMinutes(d.mins)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- RESUMO POR LOCAL -->
        <div class="report-section animate-slide">
            <div class="report-section-title">
                <span class="material-icons-outlined">location_on</span> Resumo por Local
            </div>
            <table class="report-mini-table">
                <thead>
                    <tr>
                        <th>Local</th>
                        <th>Atividades</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(localData).sort((a, b) => b[1] - a[1]).map(([loc, count]) => `
                        <tr>
                            <td><strong>${escapeHtml(loc)}</strong></td>
                            <td>${count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- LINHA DO TEMPO -->
        <div class="report-section animate-slide">
            <div class="report-section-title">
                <span class="material-icons-outlined">timeline</span> Linha do Tempo Operacional
            </div>
            <div class="timeline">
                ${timeline.map(a => `
                    <div class="timeline-item">
                        <span class="timeline-time">${a.inicio || a.hora}</span>
                        <div class="timeline-desc">${escapeHtml(a.tipo)} — ${escapeHtml(a.descricao)}</div>
                        <div class="timeline-meta">
                            <span class="status-badge ${STATUS_MAP[a.status] || ''}" style="font-size:.65rem;padding:2px 8px;">${a.status}</span>
                            &nbsp; ${escapeHtml(a.colaborador)} · ${escapeHtml(a.local)}
                            ${a.tempoTotal > 0 ? ' · ' + formatMinutes(a.tempoTotal) : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- FOOTER -->
        <div style="text-align:center;padding:24px 0 8px;border-top:1px solid var(--border-color);margin-top:32px;">
            <p style="font-size:.78rem;color:var(--text-muted);">
                Relatório gerado automaticamente — Unicesumar — Audiovisual<br>
                ${new Date().toLocaleString('pt-BR')}
            </p>
        </div>
    `;

    notify('Relatório gerado com sucesso!', 'success');
}

// ==================== EXPORTS ====================

/**
 * Carrega um script externo dinamicamente e retorna uma Promise.
 */
function loadScript(url) {
    return new Promise((resolve, reject) => {
        // Verifica se já foi carregado
        const existing = document.querySelector(`script[src="${url}"]`);
        if (existing) { resolve(); return; }

        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Garante que html2canvas e jsPDF estejam carregados.
 */
async function ensurePdfLibs() {
    if (typeof html2canvas === 'undefined') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }
    if (typeof window.jspdf === 'undefined') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js');
    }
}

/**
 * Exportar relatório como PDF real para download.
 */
async function exportPDF() {
    // Gera o relatório se ainda não gerado
    if ($('#report-content .report-placeholder')) {
        generateReport();
    }

    const reportEl = $('#report-content');
    if (!reportEl || activities.length === 0) {
        notify('Nenhuma atividade para gerar o relatório.', 'warning');
        return;
    }

    notify('Preparando PDF, aguarde...', 'info');

    try {
        // Tenta carregar as bibliotecas dinamicamente
        await ensurePdfLibs();

        const { jsPDF } = window.jspdf;

        // Forçar modo claro para captura limpa
        const currentTheme = document.documentElement.getAttribute('data-theme');
        document.documentElement.setAttribute('data-theme', 'light');

        // Aguarda repaint do tema claro
        await new Promise(r => setTimeout(r, 200));

        const canvas = await html2canvas(reportEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: reportEl.scrollWidth,
            windowWidth: 900
        });

        // Restaurar tema
        document.documentElement.setAttribute('data-theme', currentTheme);

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 largura em mm
        const pageHeight = 297; // A4 altura em mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const pdf = new jsPDF('p', 'mm', 'a4');
        let heightLeft = imgHeight;
        let position = 0;

        // Primeira página
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Páginas adicionais se o conteúdo ultrapassar
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const filename = `relatorio_operacional_${getDateStr()}.pdf`;
        pdf.save(filename);
        notify(`PDF "${filename}" baixado com sucesso!`, 'success');

    } catch (err) {
        console.error('Erro ao gerar PDF com bibliotecas:', err);
        // Restaurar tema em caso de erro
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme !== localStorage.getItem(THEME_KEY)) {
            document.documentElement.setAttribute('data-theme', localStorage.getItem(THEME_KEY) || 'light');
        }

        // FALLBACK: Gerar HTML standalone para download
        notify('Gerando PDF alternativo...', 'info');
        exportPDFfallback();
    }
}

/**
 * Fallback robusto: gera um HTML completo standalone como arquivo para impressão/PDF.
 * Abre em nova janela com botão de download automático.
 */
function exportPDFfallback() {
    const reportHTML = $('#report-content')?.innerHTML || '';
    if (!reportHTML) {
        notify('Gere o relatório primeiro.', 'warning');
        return;
    }

    // Monta documento HTML standalone completo
    const fullHTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório Operacional Diário — Unicesumar Audiovisual — ${new Date().toLocaleDateString('pt-BR')}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #fff; color: #0f172a; line-height: 1.6;
            padding: 24px 32px; max-width: 900px; margin: 0 auto;
        }
        .no-print { text-align: center; margin-bottom: 24px; }
        .no-print button {
            padding: 12px 28px; font-size: 1rem; font-weight: 700;
            background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff;
            border: none; border-radius: 8px; cursor: pointer;
            font-family: inherit; margin: 0 8px;
        }
        .no-print button:hover { opacity: .9; }
        .no-print p { font-size: .85rem; color: #64748b; margin-top: 8px; }

        .report-header { text-align: center; padding: 20px 0 16px; border-bottom: 2px solid #bfdbfe; margin-bottom: 24px; }
        .report-header h2 { font-size: 1.3rem; font-weight: 800; color: #1d4ed8; }
        .report-header p { color: #64748b; font-size: .85rem; }
        .report-section { margin-bottom: 28px; }
        .report-section-title {
            display: flex; align-items: center; gap: 8px;
            font-size: .95rem; font-weight: 700; color: #1d4ed8;
            padding-bottom: 8px; border-bottom: 2px solid #bfdbfe; margin-bottom: 14px;
        }
        .report-kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px,1fr)); gap: 12px; margin-bottom: 8px; }
        .report-kpi {
            text-align: center; padding: 14px; background: #f8fafc;
            border-radius: 8px; border: 1px solid #e2e8f0;
        }
        .report-kpi-value { font-size: 1.4rem; font-weight: 800; color: #2563eb; }
        .report-kpi-label { font-size: .7rem; color: #64748b; text-transform: uppercase; letter-spacing: .5px; font-weight: 600; margin-top: 4px; }

        table, .report-mini-table { width: 100%; border-collapse: collapse; font-size: .82rem; margin-top: 8px; }
        th { text-align: left; padding: 8px 12px; background: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: .75rem; text-transform: uppercase; border-bottom: 2px solid #bfdbfe; }
        td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; }

        .timeline { position: relative; padding-left: 28px; }
        .timeline::before { content: ''; position: absolute; left: 10px; top: 0; bottom: 0; width: 2px; background: #bfdbfe; }
        .timeline-item { position: relative; margin-bottom: 16px; padding: 10px 14px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
        .timeline-item::before { content: ''; position: absolute; left: -24px; top: 14px; width: 8px; height: 8px; border-radius: 50%; background: #2563eb; border: 2px solid #fff; }
        .timeline-time { font-weight: 700; color: #2563eb; font-size: .82rem; }
        .timeline-desc { font-size: .82rem; color: #475569; margin-top: 2px; }
        .timeline-meta { font-size: .72rem; color: #94a3b8; margin-top: 2px; }

        .status-badge {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 2px 8px; border-radius: 12px;
            font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
            border: 1px solid #ccc;
        }
        .status-badge.concluida { background: #d1fae5; color: #059669; border-color: #86efac; }
        .status-badge.em-andamento { background: #fef3c7; color: #d97706; border-color: #fde047; }
        .status-badge.nao-iniciada { background: #e0f2fe; color: #0284c7; border-color: #7dd3fc; }
        .status-badge.pausada { background: #f3f4f6; color: #4b5563; border-color: #d1d5db; }
        .status-badge.cancelada { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }

        .animate-slide { animation: none; }
        .material-icons-outlined { display: none; }

        @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="no-print">
        <button onclick="window.print()">⬇ Salvar como PDF / Imprimir</button>
        <p>Na janela de impressão, selecione <strong>"Salvar como PDF"</strong> como destino para baixar o arquivo.</p>
    </div>
    ${reportHTML}
</body>
</html>`;

    // Cria Blob e abre em nova aba
    const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');

    if (newWindow) {
        // Aguarda carregar e dispara impressão automaticamente
        newWindow.addEventListener('load', () => {
            setTimeout(() => {
                newWindow.print();
            }, 500);
        });
        notify('Relatório aberto em nova aba. Use "Salvar como PDF" na janela de impressão.', 'success');
    } else {
        // Se popup bloqueado, oferece download direto do HTML
        downloadBlob(blob, `relatorio_operacional_${getDateStr()}.html`);
        notify('Arquivo HTML do relatório baixado. Abra e use Ctrl+P para salvar como PDF.', 'info');
    }
}

function exportPrint() {
    if ($('#report-content .report-placeholder')) {
        generateReport();
    }
    // Switch to report view for print
    switchView('relatorio', 'Relatório Operacional Diário');
    setTimeout(() => window.print(), 300);
}

function exportJSON() {
    if (activities.length === 0) {
        notify('Nenhum dado para exportar.', 'warning');
        return;
    }
    const blob = new Blob([JSON.stringify(activities, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `relatorio_operacional_${getDateStr()}.json`);
    notify('Arquivo JSON exportado com sucesso!', 'success');
}

function exportCSV() {
    if (activities.length === 0) {
        notify('Nenhum dado para exportar.', 'warning');
        return;
    }

    const headers = ['Data', 'Hora', 'Colaborador', 'Equipe', 'Local', 'Tipo', 'Descrição', 'Início', 'Término', 'Tempo Total (min)', 'Status', 'Observações'];
    const rows = activities.map(a => [
        a.data, a.hora, a.colaborador, a.equipe, a.local, a.tipo,
        `"${(a.descricao || '').replace(/"/g, '""')}"`,
        a.inicio, a.termino,
        a.tempoTotal || 0,
        a.status,
        `"${(a.observacoes || '').replace(/"/g, '""')}"`
    ]);

    const csv = '\uFEFF' + headers.join(';') + '\n' + rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `relatorio_operacional_${getDateStr()}.csv`);
    notify('Arquivo CSV exportado com sucesso!', 'success');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== GLOBAL SEARCH ====================

function initGlobalSearch() {
    $('#global-search')?.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) return;

        // Switch to table view and search there
        switchView('tabela', 'Tabela Operacional');
        $('#table-search').value = query;
        renderTable();
    });
}

// ==================== NOTIFICATIONS ====================

function notify(message, type = 'info') {
    const container = $('#notification-container');
    if (!container) return;

    const icons = {
        success: 'check_circle',
        warning: 'warning',
        error:   'error',
        info:    'info'
    };

    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `
        <span class="material-icons-outlined notif-icon">${icons[type] || 'info'}</span>
        <span class="notif-text">${message}</span>
        <span class="material-icons-outlined notif-close" onclick="this.parentElement.classList.add('hide'); setTimeout(()=>this.parentElement.remove(),300);">close</span>
    `;

    container.appendChild(notif);

    // Auto-dismiss after 4s
    setTimeout(() => {
        notif.classList.add('hide');
        setTimeout(() => notif.remove(), 300);
    }, 4000);
}

// ==================== UTILITY FUNCTIONS ====================

function generateId() {
    return 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function formatDateBR(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function getDateStr() {
    return new Date().toISOString().split('T')[0];
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
}

// Make functions available globally for onclick handlers
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;
window.quickEdit = quickEdit;
