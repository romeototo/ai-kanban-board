// --- Firebase Setup ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDt55WQCiR4oG2zO1sYxBlJfENklxID5BE",
  authDomain: "ai-kanban-board-8cc26.firebaseapp.com",
  projectId: "ai-kanban-board-8cc26",
  storageBucket: "ai-kanban-board-8cc26.firebasestorage.app",
  messagingSenderId: "100494573904",
  appId: "1:100494573904:web:ac14a9e32d4ff55eb72c55",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const tasksCol = collection(db, "tasks");

// --- Global State ---
let tasks = [];
let currentUser = null;
let unsubscribeSnapshot = null;
const lists = document.querySelectorAll(".task-list");

// --- Auth Logic ---
const authOverlay = document.getElementById("auth-overlay");
const loginBtn = document.getElementById("loginBtn");
const userProfile = document.getElementById("userProfile");
const userAvatar = document.getElementById("userAvatar");

loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("Login failed", e);
    alert("Login Error: " + e.message);
  }
});

userProfile.addEventListener("click", () => {
  if (confirm("Do you want to log out?")) signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authOverlay.style.display = "none";
    userProfile.style.display = "flex";
    userAvatar.src = user.photoURL || "https://via.placeholder.com/36";
    initBoard();
  } else {
    currentUser = null;
    authOverlay.style.display = "flex";
    userProfile.style.display = "none";
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    tasks = [];
    renderTasks();
  }
});

// --- Initialization ---
function initBoard() {
  setupDragAndDrop();

  // Listen to Real-time Updates from Firestore (User Specific)
  const q = query(tasksCol, where("userId", "==", currentUser.uid));

  if (unsubscribeSnapshot) unsubscribeSnapshot();

  unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
    tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    // Sort by creation time so they don't jump randomly
    tasks.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    renderTasks();
  });
}

function renderTasks() {
  lists.forEach((list) => (list.innerHTML = ""));

  tasks.forEach((task) => {
    const list = document.querySelector(
      `.task-list[data-status="${task.status}"]`,
    );
    if (list) {
      const card = document.createElement("div");
      card.className = "task-card";
      card.draggable = true;
      card.dataset.id = task.id;
      card.innerHTML = `
                <div class="task-content" style="width: 100%;">
                    <div style="font-weight: 500;">${task.content}</div>
                    ${task.dueDate ? `<div style="font-size: 0.75rem; color: #a855f7; margin-top: 4px;">⏰ ${task.dueDate}</div>` : ""}
                    ${task.description ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${task.description}</div>` : ""}
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); deleteTask('${task.id}')">
                    <span class="material-icons" style="font-size: 16px;">delete</span>
                </button>
            `;
      card.addEventListener("click", () => openTaskModal(task));
      list.appendChild(card);
    }
  });

  attachDragEventsToCards();
}

// --- Drag & Drop Logic ---
function attachDragEventsToCards() {
  const cards = document.querySelectorAll(".task-card");

  cards.forEach((card) => {
    card.addEventListener("dragstart", () => {
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", async () => {
      card.classList.remove("dragging");
      const newStatus = card.parentElement.dataset.status;
      const taskId = card.dataset.id;

      // Check if status actually changed before updating DB
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== newStatus) {
        await updateTaskStatus(taskId, newStatus);
      }
    });
  });
}

function setupDragAndDrop() {
  lists.forEach((list) => {
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      list.classList.add("drag-over");
      const draggingCard = document.querySelector(".dragging");
      if (draggingCard) {
        list.appendChild(draggingCard);
      }
    });

    list.addEventListener("dragleave", () => {
      list.classList.remove("drag-over");
    });

    list.addEventListener("drop", () => {
      list.classList.remove("drag-over");
    });
  });
}

// --- Task Actions (Exposed to Window for HTML onclick) ---
window.addNewTask = async function (columnId) {
  const content = prompt("Enter new task:");
  if (!content || content.trim() === "") return;

  const status = document.getElementById(columnId).querySelector(".task-list")
    .dataset.status;

  try {
    await addDoc(tasksCol, {
      content: content,
      status: status,
      createdAt: Date.now(),
      userId: currentUser.uid,
    });
  } catch (e) {
    console.error("Error adding document: ", e);
    alert(
      "Failed to add task. Please check if Firestore is enabled and rules are open.",
    );
  }
};

window.deleteTask = async function (id) {
  if (confirm("Delete this task?")) {
    try {
      await deleteDoc(doc(db, "tasks", id));
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  }
};

window.clearDoneTasks = async function () {
  const doneTasks = tasks.filter((t) => t.status === "done");
  if (doneTasks.length === 0) return;
  if (
    confirm(
      `Are you sure you want to delete ${doneTasks.length} completed task(s)?`,
    )
  ) {
    try {
      for (const task of doneTasks) {
        await deleteDoc(doc(db, "tasks", task.id));
      }
    } catch (e) {
      console.error("Error clearing tasks: ", e);
      alert("Failed to clear tasks.");
    }
  }
};

async function updateTaskStatus(id, newStatus) {
  try {
    await updateDoc(doc(db, "tasks", id), {
      status: newStatus,
    });
  } catch (e) {
    console.error("Error updating status: ", e);
  }
}

// --- Modal Logic ---
let currentEditingTaskId = null;
const sharedModal = document.getElementById("shared-modal");
const modalTitle = document.getElementById("modalTitle");
const taskModalBody = document.getElementById("taskModalBody");
const aiReviewBody = document.getElementById("aiReviewBody");
const taskDescInput = document.getElementById("taskDescInput");
const taskDateInput = document.getElementById("taskDateInput");

document
  .getElementById("closeModalBtn")
  .addEventListener("click", () => (sharedModal.style.display = "none"));

window.openTaskModal = function (task) {
  currentEditingTaskId = task.id;
  modalTitle.innerText = "Edit Task";
  taskModalBody.style.display = "block";
  aiReviewBody.style.display = "none";
  taskDescInput.value = task.description || "";
  taskDateInput.value = task.dueDate || "";
  sharedModal.style.display = "flex";
};

document.getElementById("saveTaskBtn").addEventListener("click", async () => {
  if (!currentEditingTaskId) return;
  try {
    const btn = document.getElementById("saveTaskBtn");
    btn.innerText = "Saving...";
    await updateDoc(doc(db, "tasks", currentEditingTaskId), {
      description: taskDescInput.value.trim(),
      dueDate: taskDateInput.value,
    });
    sharedModal.style.display = "none";
    btn.innerText = "Save Details";
  } catch (e) {
    alert("Failed to save: " + e.message);
  }
});

// Auth state listener triggers initBoard() automatically.

// --- AI Integration (Gemini) ---
document.getElementById("aiGenerateBtn").addEventListener("click", async () => {
  const input = document.getElementById("aiTaskInput");
  const promptText = input.value.trim();
  if (!promptText) return;

  let apiKey = localStorage.getItem("gemini_api_key");
  if (!apiKey) {
    apiKey = prompt(
      "Please enter your Gemini API Key to use the AI Assistant:",
    );
    if (!apiKey) return;
    localStorage.setItem("gemini_api_key", apiKey);
  }

  const btn = document.getElementById("aiGenerateBtn");
  const originalText = btn.innerHTML;
  btn.innerHTML = `<span class="material-icons">hourglass_empty</span> Generating...`;
  btn.disabled = true;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Break down the following project into 3 to 5 small, actionable tasks suitable for a Kanban board.
Respond ONLY with a valid JSON array of strings. Do not include markdown formatting like \`\`\`json or any other text.
Project: ${promptText}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 400 || response.status === 403) {
        localStorage.removeItem("gemini_api_key");
        throw new Error("Invalid API Key. Please try again.");
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    let textResult = data.candidates[0].content.parts[0].text;

    // Clean up markdown code blocks if AI ignored instructions
    textResult = textResult
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const tasksArr = JSON.parse(textResult);

    if (Array.isArray(tasksArr)) {
      for (const taskStr of tasksArr) {
        await addDoc(tasksCol, {
          content: `✨ [AI] ${taskStr}`,
          status: "todo",
          createdAt: Date.now(),
          userId: currentUser.uid,
        });
        // Small delay to ensure order
        await new Promise((r) => setTimeout(r, 10));
      }
      input.value = "";
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

document.getElementById("aiReviewBtn").addEventListener("click", async () => {
  const doingTasks = tasks
    .filter((t) => t.status === "doing")
    .map((t) => t.content);
  const todoTasks = tasks
    .filter((t) => t.status === "todo")
    .map((t) => t.content);

  if (doingTasks.length === 0 && todoTasks.length === 0) {
    alert("Board is empty! Nothing to review.");
    return;
  }

  let apiKey = localStorage.getItem("gemini_api_key");
  if (!apiKey) {
    apiKey = prompt("Please enter your Gemini API Key:");
    if (!apiKey) return;
    localStorage.setItem("gemini_api_key", apiKey);
  }

  const btn = document.getElementById("aiReviewBtn");
  const originalText = btn.innerHTML;
  btn.innerHTML = `<span class="material-icons">hourglass_empty</span> Analyzing...`;
  btn.disabled = true;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are an expert Agile/Kanban coach. Review the user's current tasks and provide a short, punchy, and helpful analysis. Limit to 3-4 sentences. Be encouraging but realistic.
                        Tasks in "Doing" column: ${doingTasks.join(", ") || "None"}
                        Tasks in "To Do" column: ${todoTasks.join(", ") || "None"}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.4 },
        }),
      },
    );

    if (!response.ok) throw new Error("API Error");

    const data = await response.json();
    const analysis = data.candidates[0].content.parts[0].text;

    modalTitle.innerText = "🤖 AI Board Analysis";
    taskModalBody.style.display = "none";
    aiReviewBody.style.display = "block";
    document.getElementById("aiReviewContent").innerText = analysis;
    sharedModal.style.display = "flex";
  } catch (e) {
    alert("AI Review failed: " + e.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});
