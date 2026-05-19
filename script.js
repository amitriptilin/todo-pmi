const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2, null: 3 };
const THEMES = [
    { name: "Зелёная", color: "#6D8B5D", id: "default" },
    { name: "Красная", color: "#D96C6C", id: "red" },
    { name: "Синяя",   color: "#4A8BB8", id: "blue" },
    { name: "Фиолетовая", color: "#9B7EBD", id: "purple" },
    { name: "Серая",   color: "#6F7A8A", id: "gray" },
    { name: "Тёмная",  color: "#2C3E50", id: "dark" }
];


let tasks = [];
let currentTab = 'today';
let editingTaskId = null;


document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'default';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const storedTasks = localStorage.getItem('tasks');
    tasks = storedTasks ? JSON.parse(storedTasks) : [];
    saveTasks();

    initEventListeners();
    initSettings();
    renderTasks();
});


function initEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchTab(item.dataset.tab));
    });

    const addBtn = document.getElementById('add-btn');
    const taskInput = document.getElementById('task-input');
    addBtn.addEventListener('click', addSimpleTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addSimpleTask();
    });

    document.getElementById('detailed-btn').addEventListener('click', () => {
        document.getElementById('taskDetails').classList.toggle('open');
    });

    document.getElementById('add-detailed-btn').addEventListener('click', addDetailedTask);

    document.getElementById('cancel-edit').addEventListener('click', closeModal);
    document.getElementById('save-edit').addEventListener('click', saveEditedTask);
}


function initSettings() {
    const container = document.getElementById('theme-options');
    container.innerHTML = '';

    THEMES.forEach(theme => {
        const div = document.createElement('div');
        div.className = 'theme-option';
        div.style.background = theme.color;
        div.title = theme.name;
        div.dataset.id = theme.id;

        const currentTheme = localStorage.getItem('theme') || 'default';
        if (theme.id === currentTheme) div.classList.add('active');

        div.addEventListener('click', () => {
            document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            applyTheme(theme.id);
        });
        container.appendChild(div);
    });

    document.getElementById('clear-data').addEventListener('click', () => {
        if (confirm('Очистить все задачи?')) {
            tasks = [];
            saveTasks();
            renderTasks();
            showToast('Все задачи удалены');
        }
    });

    document.getElementById('reset-app').addEventListener('click', () => {
        if (confirm('Сбросить приложение полностью? Это действие нельзя отменить.')) {
            localStorage.clear();
            location.reload();
        }
    });
}

function applyTheme(themeId) {
    const currentTheme = localStorage.getItem('theme') || 'default';
    if (themeId === currentTheme) return;
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('theme', themeId);
    showToast('Тема изменена');
}


function switchTab(tab) {
    currentTab = tab;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tab);
    });

    const areas = {
        today: { list: 'today-list', area: '.new-task-area' },
        list: { list: 'today-list', area: '.new-task-area' },
        profile: { list: 'profile-container', area: null },
        settings: { list: 'settings-container', area: null }
    };

    document.getElementById('today-list').style.display = 'none';
    document.getElementById('profile-container').style.display = 'none';
    document.getElementById('settings-container').style.display = 'none';
    document.querySelector('.new-task-area').style.display = 'none';

    const info = areas[tab];
    if (info) {
        document.getElementById(info.list).style.display = 'block';
        if (info.area) document.querySelector(info.area).style.display = 'block';
        const title = document.getElementById('listTitle');
        title.textContent = tab === 'today' ? 'СЕГОДНЯ' : 'ВСЕ ЗАДАЧИ';
        if (tab === 'today' || tab === 'list') renderTasks();
    }
}


function getFilteredTasks() {
    if (currentTab === 'today') {
        const todayStr = getTodayStr();
        return tasks
            .filter(task => task.date === todayStr)
            .sort((a, b) => {
                const pA = PRIORITY_WEIGHT[a.priority || null] ?? 3;
                const pB = PRIORITY_WEIGHT[b.priority || null] ?? 3;
                if (pA !== pB) return pA - pB;
                return (a.time || '99:99').localeCompare(b.time || '99:99');
            });
    }

    const weekRange = getWeekRange();
    const monthRange = getMonthRange();

    const thisWeek = [], thisMonth = [], others = [];

    tasks.forEach(task => {
        if (!task.date) { others.push(task); return; }
        const taskDate = new Date(task.date);
        if (taskDate >= weekRange.start && taskDate <= weekRange.end) thisWeek.push(task);
        else if (taskDate >= monthRange.start && taskDate <= monthRange.end) thisMonth.push(task);
        else others.push(task);
    });

    const sortFn = (arr) => arr.sort((a, b) => {
        const pA = PRIORITY_WEIGHT[a.priority || null] ?? 3;
        const pB = PRIORITY_WEIGHT[b.priority || null] ?? 3;
        if (pA !== pB) return pA - pB;
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '99:99').localeCompare(b.time || '99:99');
    });

    return {
        thisWeek: sortFn(thisWeek),
        thisMonth: sortFn(thisMonth),
        others: sortFn(others)
    };
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function getWeekRange() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
}

function getMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}


function addSimpleTask() {
    const input = document.getElementById('task-input');
    const text = input.value.trim();
    if (!text) return;

    tasks.push({
        id: Date.now(),
        text: text,
        completed: false,
        date: getTodayStr(),
        time: null,
        desc: null,
        priority: 'medium'
    });

    input.value = '';
    saveTasks();
    renderTasks();
    showToast('Задача добавлена!');
}

function addDetailedTask() {
    const text = document.getElementById('task-input').value.trim();
    if (!text) return;

    tasks.push({
        id: Date.now(),
        text: text,
        completed: false,
        date: document.getElementById('task-date').value || null,
        time: document.getElementById('task-time').value || null,
        desc: document.getElementById('task-desc').value.trim() || null,
        priority: document.getElementById('task-priority').value || 'medium'
    });

    document.getElementById('task-input').value = '';
    document.getElementById('task-date').value = '';
    document.getElementById('task-time').value = '';
    document.getElementById('task-desc').value = '';
    document.getElementById('task-priority').value = 'medium';
    document.getElementById('taskDetails').classList.remove('open');

    saveTasks();
    renderTasks();
    showToast('Задача добавлена!');
}

function openEditModal(task) {
    editingTaskId = task.id;
    document.getElementById('edit-text').value = task.text;
    document.getElementById('edit-desc').value = task.desc || '';
    document.getElementById('edit-date').value = task.date || '';
    document.getElementById('edit-time').value = task.time || '';
    document.getElementById('edit-priority').value = task.priority || 'medium';
    document.getElementById('edit-modal').classList.add('show');
}

function saveEditedTask() {
    if (!editingTaskId) return;
    const task = tasks.find(t => t.id === editingTaskId);
    if (task) {
        task.text = document.getElementById('edit-text').value.trim();
        task.desc = document.getElementById('edit-desc').value.trim() || null;
        task.date = document.getElementById('edit-date').value || null;
        task.time = document.getElementById('edit-time').value || null;
        task.priority = document.getElementById('edit-priority').value || 'medium';
    }
    closeModal();
    saveTasks();
    renderTasks();
    showToast('Задача обновлена!');
}

function closeModal() {
    document.getElementById('edit-modal').classList.remove('show');
    editingTaskId = null;
}


function buildPriorityHtml(task) {
    if (!task.priority) return '';
    const label = task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий';
    return `
        <span class="task-priority-indicator priority-${task.priority}">
            <span class="priority-dot"></span>
            <span class="priority-label">${label}</span>
        </span>
    `;
}

function buildMetaHtml(task) {
    const parts = [];
    if (task.date) {
        const dateObj = new Date(task.date);
        const formatted = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
        const dateStr = task.time ? `${formatted}, ${task.time}` : formatted;
        parts.push(`<span class="meta-item"><i class="far fa-calendar-alt"></i> ${dateStr}</span>`);
    } else if (task.time) {
        parts.push(`<span class="meta-item"><i class="far fa-clock"></i> ${task.time}</span>`);
    }
    if (task.desc) {
        parts.push(`
            <span class="task-desc-wrapper">
                <i class="far fa-file-alt"></i>
                <span class="task-desc-text">${task.desc}</span>
                <span class="expand-desc-btn">...</span>
            </span>
        `);
    }
    if (parts.length === 0) return '';
    return `<div class="task-meta">${parts.join('')}</div>`;
}

function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;
    li.dataset.id = task.id;

    li.innerHTML = `
        <div class="task-main">
            <input type="checkbox" ${task.completed ? 'checked' : ''}>
            <span class="task-text">${task.text}</span>
            ${buildPriorityHtml(task)}
            <div class="actions">
                <i class="fas fa-edit edit-btn"></i>
                <i class="fas fa-trash-alt delete-btn"></i>
            </div>
        </div>
        <div class="task-meta-wrapper">${buildMetaHtml(task)}</div>
    `;

    li.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
        e.stopPropagation();
        toggleTask(task.id);
    });

    li.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTask(task.id, li);
    });

    li.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(task);
    });

    li.addEventListener('click', (e) => {
        if (!e.target.closest('input') && !e.target.closest('.actions')) {
            li.classList.toggle('open');
        }
    });

    const expandBtn = li.querySelector('.expand-desc-btn');
    if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = li.querySelector('.task-desc-text');
            const expanded = text.classList.toggle('expanded');
            expandBtn.textContent = expanded ? 'Свернуть' : '...';
        });
    }

    return li;
}


function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) task.completed = !task.completed;
    saveTasks();
    renderTasks();
}

function deleteTask(id, element) {
    element.classList.add('removing');

    const task = tasks.find(t => t.id === id);
    if (!task) {
        element.classList.remove('removing');
        return;
    }

    let isCancelled = false;
    let isExpired = false;

    const onUndo = () => {
        if (isExpired) return;
        isCancelled = true;
        element.classList.remove('removing');
        updateProgress();
    };

    const onExpire = () => {
        if (isCancelled) return;
        isExpired = true;
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
    };

    showUndoToast('Задача удалена', onUndo, onExpire, 3000);
}

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}


function updateProgress() {
    let total = 0, completed = 0;
    if (currentTab === 'today') {
        const todayStr = getTodayStr();
        const todayTasks = tasks.filter(t => t.date === todayStr);
        total = todayTasks.length;
        completed = todayTasks.filter(t => t.completed).length;
    } else {
        total = tasks.length;
        completed = tasks.filter(t => t.completed).length;
    }
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    document.getElementById('progress-circle').style.setProperty('--progress', percent + '%');
    document.getElementById('progress-text').textContent = `${percent}%`;
    document.getElementById('progress-count').innerHTML = `${completed}/${total} задач`;
}

function renderTasks() {
    const list = document.getElementById('task-list');
    list.innerHTML = '';

    if (currentTab === 'today') {
        const filtered = getFilteredTasks();
        if (filtered.length === 0) {
            list.innerHTML = `<li class="task-item" style="text-align:center;padding:40px;background:transparent;box-shadow:none;color:#aaa;">Нет задач на сегодня</li>`;
        } else {
            filtered.forEach(task => list.appendChild(createTaskElement(task)));
        }
        updateProgress();
        return;
    }

    const grouped = getFilteredTasks();
    const sections = [
        { title: "На этой неделе", tasks: grouped.thisWeek },
        { title: "В этом месяце", tasks: grouped.thisMonth },
        { title: "Остальные", tasks: grouped.others }
    ];

    let hasContent = false;
    sections.forEach(section => {
        if (section.tasks.length > 0) {
            hasContent = true;
            const header = document.createElement('li');
            header.className = 'task-item';
            header.style.cssText = 'cursor:default;background:transparent;box-shadow:none;padding:8px 0;';
            header.innerHTML = `<div style="font-weight:700;color:var(--main-color);">${section.title}</div>`;
            list.appendChild(header);
            section.tasks.forEach(task => list.appendChild(createTaskElement(task)));
        }
    });

    if (!hasContent) {
        list.innerHTML = `<li class="task-item" style="text-align:center;padding:40px;background:transparent;box-shadow:none;color:#aaa;">Список задач пуст</li>`;
    }
    updateProgress();
}

function showToast(message, duration = 2500) {
    const container = document.getElementById('toast-container');
    const existing = container.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <i class="fas fa-check-circle toast-icon"></i>
        <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showUndoToast(message, onUndo, onExpire, duration = 3000) {
    const container = document.getElementById('toast-container');
    const existing = container.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast undo-toast';
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-undo-btn">Отменить</button>
        <div class="toast-progress-bar"></div>
    `;

    toast.style.setProperty('--duration', duration + 'ms');

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);

    let timeoutId = setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', function handler() {
            toast.removeEventListener('transitionend', handler);
            toast.remove();
            if (onExpire) onExpire();
        });
    }, duration);

    const undoHandler = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        toast.classList.remove('show');
        toast.addEventListener('transitionend', function handler() {
            toast.removeEventListener('transitionend', handler);
            toast.remove();
            if (onUndo) onUndo();
        });
    };

    toast.querySelector('.toast-undo-btn').addEventListener('click', undoHandler);
}