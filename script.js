// --- Initial State (Mock Data Before Firebase) ---
let tasks = [
    { id: '1', content: 'Design Kanban UI (Glassmorphism)', status: 'todo' },
    { id: '2', content: 'Implement Drag and Drop logic in Vanilla JS', status: 'doing' },
    { id: '3', content: 'Setup basic HTML/CSS skeleton', status: 'done' }
];

// --- DOM Elements ---
const lists = document.querySelectorAll('.task-list');

// --- Initialization ---
function init() {
    renderTasks();
    setupDragAndDrop();
}

function renderTasks() {
    // Clear all lists
    lists.forEach(list => list.innerHTML = '');

    tasks.forEach(task => {
        const list = document.querySelector(`.task-list[data-status="${task.status}"]`);
        if (list) {
            const card = document.createElement('div');
            card.className = 'task-card';
            card.draggable = true;
            card.dataset.id = task.id;
            card.innerHTML = `
                <div class="task-content">${task.content}</div>
                <button class="delete-btn" onclick="deleteTask('${task.id}')">
                    <span class="material-icons" style="font-size: 16px;">delete</span>
                </button>
            `;
            list.appendChild(card);
        }
    });

    attachDragEventsToCards();
}

// --- Drag & Drop Logic ---
function attachDragEventsToCards() {
    const cards = document.querySelectorAll('.task-card');
    
    cards.forEach(card => {
        card.addEventListener('dragstart', () => {
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            // Update status in data array based on new parent
            const newStatus = card.parentElement.dataset.status;
            const taskId = card.dataset.id;
            updateTaskStatus(taskId, newStatus);
        });
    });
}

function setupDragAndDrop() {
    lists.forEach(list => {
        list.addEventListener('dragover', e => {
            e.preventDefault(); // Necessary to allow dropping
            list.classList.add('drag-over');
            const draggingCard = document.querySelector('.dragging');
            if(draggingCard) {
                list.appendChild(draggingCard); // Move element visually
            }
        });

        list.addEventListener('dragleave', () => {
            list.classList.remove('drag-over');
        });

        list.addEventListener('drop', () => {
            list.classList.remove('drag-over');
        });
    });
}

// --- Task Actions ---
function addNewTask(columnId) {
    const content = prompt("Enter new task:");
    if (!content || content.trim() === '') return;

    const status = document.getElementById(columnId).querySelector('.task-list').dataset.status;
    const newTask = {
        id: Date.now().toString(), // Simple unique ID
        content: content,
        status: status
    };
    
    tasks.push(newTask);
    renderTasks();
}

// Ensure global scope for inline onclick handler
window.deleteTask = function(id) {
    if(confirm('Delete this task?')) {
        tasks = tasks.filter(t => t.id !== id);
        renderTasks();
    }
}

function updateTaskStatus(id, newStatus) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = newStatus;
        // Ready for Firebase update here!
    }
}

// Start
init();
