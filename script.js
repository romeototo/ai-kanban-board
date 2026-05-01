// --- Firebase Setup ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDt55WQCiR4oG2zO1sYxBlJfENklxID5BE",
    authDomain: "ai-kanban-board-8cc26.firebaseapp.com",
    projectId: "ai-kanban-board-8cc26",
    storageBucket: "ai-kanban-board-8cc26.firebasestorage.app",
    messagingSenderId: "100494573904",
    appId: "1:100494573904:web:ac14a9e32d4ff55eb72c55"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tasksCol = collection(db, 'tasks');

// --- Global State ---
let tasks = [];
const lists = document.querySelectorAll('.task-list');

// --- Initialization ---
function init() {
    setupDragAndDrop();
    
    // Listen to Real-time Updates from Firestore
    onSnapshot(tasksCol, (snapshot) => {
        tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by creation time so they don't jump randomly
        tasks.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        renderTasks();
    });
}

function renderTasks() {
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

        card.addEventListener('dragend', async () => {
            card.classList.remove('dragging');
            const newStatus = card.parentElement.dataset.status;
            const taskId = card.dataset.id;
            
            // Check if status actually changed before updating DB
            const task = tasks.find(t => t.id === taskId);
            if (task && task.status !== newStatus) {
                await updateTaskStatus(taskId, newStatus);
            }
        });
    });
}

function setupDragAndDrop() {
    lists.forEach(list => {
        list.addEventListener('dragover', e => {
            e.preventDefault(); 
            list.classList.add('drag-over');
            const draggingCard = document.querySelector('.dragging');
            if(draggingCard) {
                list.appendChild(draggingCard);
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

// --- Task Actions (Exposed to Window for HTML onclick) ---
window.addNewTask = async function(columnId) {
    const content = prompt("Enter new task:");
    if (!content || content.trim() === '') return;

    const status = document.getElementById(columnId).querySelector('.task-list').dataset.status;
    
    try {
        await addDoc(tasksCol, {
            content: content,
            status: status,
            createdAt: Date.now()
        });
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("Failed to add task. Please check if Firestore is enabled and rules are open.");
    }
};

window.deleteTask = async function(id) {
    if(confirm('Delete this task?')) {
        try {
            await deleteDoc(doc(db, 'tasks', id));
        } catch (e) {
            console.error("Error deleting document: ", e);
        }
    }
};

async function updateTaskStatus(id, newStatus) {
    try {
        await updateDoc(doc(db, 'tasks', id), {
            status: newStatus
        });
    } catch (e) {
        console.error("Error updating status: ", e);
    }
}

// Start
init();

// --- AI Integration (Gemini) ---
document.getElementById('aiGenerateBtn').addEventListener('click', async () => {
    const input = document.getElementById('aiTaskInput');
    const promptText = input.value.trim();
    if (!promptText) return;

    let apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        apiKey = prompt("Please enter your Gemini API Key to use the AI Assistant:");
        if (!apiKey) return;
        localStorage.setItem('gemini_api_key', apiKey);
    }

    const btn = document.getElementById('aiGenerateBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="material-icons">hourglass_empty</span> Generating...`;
    btn.disabled = true;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Break down the following project into 3 to 5 small, actionable tasks suitable for a Kanban board.
Respond ONLY with a valid JSON array of strings. Do not include markdown formatting like \`\`\`json or any other text.
Project: ${promptText}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.2
                }
            })
        });

        if (!response.ok) {
            if(response.status === 400 || response.status === 403) {
                localStorage.removeItem('gemini_api_key');
                throw new Error("Invalid API Key. Please try again.");
            }
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        let textResult = data.candidates[0].content.parts[0].text;
        
        // Clean up markdown code blocks if AI ignored instructions
        textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const tasksArr = JSON.parse(textResult);

        if (Array.isArray(tasksArr)) {
            for (const taskStr of tasksArr) {
                await addDoc(tasksCol, {
                    content: `✨ [AI] ${taskStr}`,
                    status: 'todo',
                    createdAt: Date.now()
                });
                // Small delay to ensure order
                await new Promise(r => setTimeout(r, 10));
            }
            input.value = '';
        } else {
            throw new Error("AI did not return an array.");
        }

    } catch (e) {
        console.error(e);
        alert("AI Generation failed: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});
