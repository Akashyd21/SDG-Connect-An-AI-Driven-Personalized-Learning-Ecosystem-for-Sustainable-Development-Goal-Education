// AI Mentor Chatbot for SDG Connect Web Platform
// Persistent animated floating bot, step-by-step guidance, and Deep Learning technical mentoring

class SdgChatbot {
  constructor() {
    this.isOpen = false;
  }

  init() {
    this.renderWidget();
    this.attachEventListeners();
  }

  renderWidget() {
    const existing = document.getElementById("ai-mentor-widget-root");
    if (existing) existing.remove();

    const root = document.createElement("div");
    root.id = "ai-mentor-widget-root";
    root.className = "ai-mentor-floating-container";

    root.innerHTML = `
      <!-- Floating Bot Button with Pulse & Animation -->
      <button class="ai-bot-trigger-btn" id="btn-toggle-chatbot" aria-label="Open AI SDG Mentor">
        <div class="bot-avatar-inner">
          <div class="bot-eyes">
            <span class="bot-eye left"></span>
            <span class="bot-eye right"></span>
          </div>
          <i class="fa-solid fa-leaf bot-leaf-icon"></i>
        </div>
        <span class="bot-pulse-ring"></span>
        <span class="bot-status-online" title="AI Mentor Active"></span>
      </button>

      <!-- Expandable Chat Panel -->
      <div class="ai-chat-window card-glass d-none" id="ai-chat-window">
        <!-- Chat Header -->
        <div class="ai-chat-header d-flex justify-content-between align-items-center p-3 border-bottom">
          <div class="d-flex align-items-center gap-2">
            <div class="ai-header-avatar">
              <i class="fa-solid fa-robot text-white"></i>
            </div>
            <div>
              <h6 class="mb-0 fw-bold">SustainAI Mentor</h6>
              <small class="text-success d-flex align-items-center gap-1">
              <span class="online-dot"></span> Simple SDG Platform Guide
              </small>
            </div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-sm btn-icon-ghost" id="btn-explainability" title="Responsible AI & Transparency">
              <i class="fa-solid fa-circle-info"></i>
            </button>
            <button class="btn btn-sm btn-icon-ghost" id="btn-close-chatbot">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <!-- Chat Messages Body -->
        <div class="ai-chat-body p-3" id="ai-chat-messages">
          <!-- Rendered dynamically -->
        </div>

        <!-- Quick Prompt Suggestions -->
        <div class="ai-quick-prompts p-2 border-top bg-light-subtle d-flex gap-1 overflow-x-auto" id="ai-quick-prompts">
          <button class="quick-chip-btn" data-action="platform-help">How SDG Connect works</button>
          <button class="quick-chip-btn" data-action="course-help">Why SDG courses matter</button>
          <button class="quick-chip-btn" data-action="project-help">Explain my assigned project</button>
          <button class="quick-chip-btn" data-action="submission-help">How do I submit?</button>
        </div>

        <!-- Chat Input Form -->
        <form class="ai-chat-input-row p-3 border-top d-flex gap-2" id="ai-chat-form">
          <input type="text" id="ai-user-input" class="form-control form-control-sm" placeholder="Ask AI mentor or type 'assign task'..." autocomplete="off" />
          <button type="submit" class="btn btn-sm btn-primary px-3">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>

      <!-- AI Explainability Modal -->
      <div class="modal fade" id="aiExplainModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content card-glass">
            <div class="modal-header border-bottom">
              <h5 class="modal-title fw-bold"><i class="fa-solid fa-circle-info text-primary me-2"></i> About the SDG Connect Mentor</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-dark">
              <p class="small text-muted mb-3">The mentor explains the platform, SDG learning, assigned projects, enrollment, and submissions. Faculty approval remains part of the activity workflow.</p>
              
              <div class="d-flex flex-column gap-2">
                <div class="p-2 rounded bg-light border">
                  <strong>🎯 Personalized activities:</strong>
                  <p class="small text-muted mb-0">Recommendations use your department, skills, interests, SDG preferences, skill level, and available time.</p>
                </div>
                <div class="p-2 rounded bg-light border">
                  <strong>📚 SDG learning support:</strong>
                  <p class="small text-muted mb-0">Ask how an assigned project supports an SDG course, what it means, and what steps or resources can help you complete it.</p>
                </div>
                <div class="p-2 rounded bg-light border">
                  <strong>👩‍🏫 Faculty workflow:</strong>
                  <p class="small text-muted mb-0">AI-generated activities wait for faculty approval before enrollment, and submissions are sent to faculty for review.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    this.renderMessages();
  }

  attachEventListeners() {
    const triggerBtn = document.getElementById("btn-toggle-chatbot");
    const closeBtn = document.getElementById("btn-close-chatbot");
    const chatWindow = document.getElementById("ai-chat-window");
    const form = document.getElementById("ai-chat-form");
    const input = document.getElementById("ai-user-input");
    const explainBtn = document.getElementById("btn-explainability");

    if (triggerBtn) {
      triggerBtn.addEventListener("click", () => {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
          chatWindow.classList.remove("d-none");
          input.focus();
        } else {
          chatWindow.classList.add("d-none");
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.isOpen = false;
        chatWindow.classList.add("d-none");
      });
    }

    if (explainBtn) {
      explainBtn.addEventListener("click", () => {
        const modalEl = document.getElementById("aiExplainModal");
        if (modalEl && window.bootstrap) {
          const modal = new window.bootstrap.Modal(modalEl);
          modal.show();
        }
      });
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        this.handleUserQuery(text);
        input.value = "";
      });
    }

    const quickPrompts = document.getElementById("ai-quick-prompts");
    if (quickPrompts) {
      quickPrompts.addEventListener("click", (e) => {
        const btn = e.target.closest(".quick-chip-btn");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        if (action === "platform-help") {
          this.handleUserQuery("How does SDG Connect work?");
        } else if (action === "course-help") {
          this.handleUserQuery("Why are SDG courses important for students?");
        } else if (action === "project-help") {
          this.handleUserQuery("How is my assigned project connected to the SDG course?");
        } else if (action === "submission-help") {
          this.handleUserQuery("What information do I need to submit for my assigned project?");
        }
      });
    }
  }

  renderMessages() {
    const container = document.getElementById("ai-chat-messages");
    if (!container) return;

    const history = window.appState.state.chatHistory;
    container.innerHTML = history.map(msg => {
      const isAi = msg.sender === "ai";
      return `
        <div class="chat-message-row ${isAi ? 'ai-row' : 'user-row'} mb-3 animate-fade-in">
          <div class="chat-bubble ${isAi ? 'ai-bubble' : 'user-bubble'}">
            <div class="bubble-content">${this.formatMarkdown(msg.text)}</div>
            ${msg.actionButton ? `
              <div class="mt-2">
                <button class="btn btn-sm btn-success fw-bold chat-action-btn" data-task-id="${msg.actionButton.taskId}">
                  <i class="fa-solid fa-plus-circle me-1"></i> ${msg.actionButton.label}
                </button>
              </div>
            ` : ""}
            <div class="bubble-time text-end mt-1">${msg.timestamp || ""}</div>
          </div>
        </div>
      `;
    }).join("");

    container.scrollTop = container.scrollHeight;

    const actionBtns = container.querySelectorAll(".chat-action-btn");
    actionBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const taskId = btn.getAttribute("data-task-id");
        this.executeTaskAssignment(taskId);
      });
    });
  }

  formatMarkdown(text) {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br/>");
  }

  handleUserQuery(query) {
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    window.appState.addChatMessage({
      sender: "user",
      text: query,
      timestamp: timestamp
    });
    this.renderMessages();

    this.showTypingIndicator();

    this.requestAiResponse(query);
  }

  async requestAiResponse(query) {
    const student = window.appState.state.currentUser || window.appState.state.students[0] || {};
    const config = window.SDG_SUPABASE_CONFIG || {};
    const history = (window.appState.state.chatHistory || []).slice(-12);

    try {
      const response = await fetch(`${config.apiBaseUrl || "http://127.0.0.1:8000"}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          student: {
            name: student.name,
            department: student.department,
            skills: student.skills || [],
            interests: student.interests || [],
            ongoingTasks: window.appState.state.studentOngoingTasks || []
          },
          history
        })
      });

      if (!response.ok) throw new Error("Chat service unavailable");
      const data = await response.json();
      this.hideTypingIndicator();
      window.appState.addChatMessage({
        sender: "ai",
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      });
      this.renderMessages();
    } catch (error) {
      this.hideTypingIndicator();
      window.appState.addChatMessage({
        sender: "ai",
        text: "The live AI mentor is unavailable right now. Check that the FastAPI server is running and the LLM account has available credits.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      });
      this.renderMessages();
    }
  }

  showTypingIndicator() {
    const container = document.getElementById("ai-chat-messages");
    if (!container) return;
    const typingRow = document.createElement("div");
    typingRow.id = "ai-typing-indicator";
    typingRow.className = "chat-message-row ai-row mb-2";
    typingRow.innerHTML = `
      <div class="chat-bubble ai-bubble py-2 px-3">
        <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
      </div>
    `;
    container.appendChild(typingRow);
    container.scrollTop = container.scrollHeight;
  }

  hideTypingIndicator() {
    const indicator = document.getElementById("ai-typing-indicator");
    if (indicator) indicator.remove();
  }

  generateAiResponse(query) {
    const student = window.appState.state.currentUser || window.appState.state.students[0];
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let responseText = "";
    let actionButton = null;

    if (query.includes("assign") || query.includes("give me a task")) {
      const dynamicTask = window.sdgAiEngine.generateDynamicTaskForStudent(student);
      window.appState.state.activities.unshift(dynamicTask);
      
      responseText = `✨ **Personalized SDG Activity Assigned!**\n\n**${dynamicTask.title}**\n• **Goal**: SDG ${dynamicTask.goalId}\n• **Type**: ${dynamicTask.taskType === 'technical_dl_project' ? 'Project Activity' : 'Field Activity'}\n• **Reward**: +${dynamicTask.points} Points\n• **Brief**: ${dynamicTask.description}\n\nWould you like to enroll and add this to your Activities?`;
      actionButton = {
        label: `Accept & Start ${dynamicTask.id}`,
        taskId: dynamicTask.id
      };
    } else if (query.includes("recommend") || query.includes("suggest")) {
      const recommendations = window.sdgAiEngine.getRecommendedTasks(student, 2);
      if (recommendations.length > 0) {
        const top = recommendations[0];
        responseText = `🎯 **Personalized Recommendation** (${top.matchScore}% Match for you):\n\n**${top.title}** (SDG ${top.goalId})\n• **Why**: ${top.matchReasons.join("; ")}\n• **Reward**: +${top.points} pts\n• **Type**: ${top.taskType === 'technical_dl_project' ? 'Technical Project' : 'Field Action'}`;
        actionButton = {
          label: `Start Task: ${top.id}`,
          taskId: top.id
        };
      }
    } else {
      responseText = `I'm your **SDG Connect Mentor**. I can explain how the platform works, why SDG courses matter, how your assigned project supports an SDG, how to enroll, and what to include in your submission. Ask me about your department, activity, SDG course, project description, or submission.`;
    }

    window.appState.addChatMessage({
      sender: "ai",
      text: responseText,
      timestamp: timestamp,
      actionButton: actionButton
    });
    this.renderMessages();
  }

  executeTaskAssignment(taskId) {
    const success = window.appState.assignTaskToStudent(taskId);
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (success) {
      window.appState.addChatMessage({
        sender: "ai",
        text: `🎉 **Success! Task ${taskId} has been assigned to your Activities list!**\n\nYou can open the activity information, enroll, and submit the required project information from your dashboard.`,
        timestamp: timestamp
      });
      if (window.appState.state.currentRoute === "student-dashboard") {
        window.appState.setStudentSubPage("progress");
      }
    } else {
      window.appState.addChatMessage({
        sender: "ai",
        text: `Task ${taskId} is already in your active task list!`,
        timestamp: timestamp
      });
    }
    this.renderMessages();
  }
}

window.sdgChatbot = new SdgChatbot();
