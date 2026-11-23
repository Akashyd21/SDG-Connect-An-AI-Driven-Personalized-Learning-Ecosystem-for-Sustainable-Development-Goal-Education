// App Controller for SDG Connect Web Platform
// Main Router, Page Renderers, Auth Logic, Activity Workflows, and Faculty Review

// Shared SaaS-style notification dialog used instead of browser alert boxes.
window.sdgNotify = function (message, options = {}) {
  const text = String(message ?? "");
  const kind = options.kind || (/error|invalid|wrong|failed|not configured|cannot|must be|unable/i.test(text) ? "error" : /warning|notice|complete the previous/i.test(text) ? "warning" : /success|successfully|credited|unlocked|assigned|published/i.test(text) ? "success" : "info");
  const titles = { success: "Success", error: "Something needs attention", warning: "Please review", info: "Information" };
  const icons = { success: "fa-circle-check", error: "fa-circle-exclamation", warning: "fa-triangle-exclamation", info: "fa-circle-info" };

  let root = document.getElementById("sdg-notification-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "sdg-notification-root";
    root.innerHTML = `
      <div class="sdg-dialog-backdrop" data-sdg-dismiss>
        <section class="sdg-notification-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sdg-notification-title">
          <button type="button" class="sdg-dialog-close" aria-label="Close notification" data-sdg-dismiss><i class="fa-solid fa-xmark"></i></button>
          <div class="sdg-dialog-icon"><i class="fa-solid"></i></div>
          <div class="sdg-dialog-copy">
            <span class="sdg-dialog-kicker">SDG CONNECT</span>
            <h3 id="sdg-notification-title"></h3>
            <p class="sdg-dialog-message"></p>
          </div>
          <button type="button" class="btn btn-success sdg-dialog-action" data-sdg-dismiss>Continue</button>
        </section>
      </div>`;
    document.body.appendChild(root);
  }

  const backdrop = root.querySelector(".sdg-dialog-backdrop");
  const dialog = root.querySelector(".sdg-notification-dialog");
  const icon = root.querySelector(".sdg-dialog-icon");
  const title = root.querySelector("#sdg-notification-title");
  const body = root.querySelector(".sdg-dialog-message");
  const action = root.querySelector(".sdg-dialog-action");
  const close = root.querySelector(".sdg-dialog-close");
  const finish = () => {
    root.classList.remove("is-visible");
    document.body.classList.remove("sdg-dialog-open");
  };
  title.textContent = options.title || titles[kind];
  body.textContent = text;
  body.style.whiteSpace = "pre-line";
  icon.className = `sdg-dialog-icon is-${kind}`;
  icon.innerHTML = `<i class="fa-solid ${icons[kind]}"></i>`;
  dialog.className = `sdg-notification-dialog is-${kind}`;
  action.className = `btn sdg-dialog-action btn-${kind === "error" ? "danger" : kind === "warning" ? "warning" : kind === "info" ? "primary" : "success"}`;
  action.textContent = options.actionText || "Continue";
  root.classList.add("is-visible");
  document.body.classList.add("sdg-dialog-open");

  return new Promise(resolve => {
    let settled = false;
    const closeDialog = () => {
      if (settled) return;
      settled = true;
      finish();
      backdrop.removeEventListener("click", onBackdropClick);
      action.removeEventListener("click", closeDialog);
      close.removeEventListener("click", closeDialog);
      document.removeEventListener("keydown", onKeyDown);
      resolve();
    };
    const onBackdropClick = event => { if (event.target === backdrop) closeDialog(); };
    const onKeyDown = event => { if (event.key === "Escape" || event.key === "Enter") closeDialog(); };
    backdrop.addEventListener("click", onBackdropClick);
    action.addEventListener("click", closeDialog);
    close.addEventListener("click", closeDialog);
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(closeDialog, options.duration || 7000);
  });
};

// Keep legacy alert calls visually consistent across all existing features.
window.alert = message => window.sdgNotify(message);

class AppController {
  constructor() {
    this.currentCaptcha = { student: "", faculty: "", forgot: "" };
    this.aiAssignmentInFlight = new Set();
  }

  init() {
    document.documentElement.setAttribute("data-theme", "light");
    this.setupGlobalNavigation();
    this.setupAuthForms();
    this.setupStudentProfile();
    this.setupSubmissionModal();
    this.setupGoalDetailModal();
    this.setupActivityCreationForm();
    this.setupEventListeners();

    window.appState.subscribe((state) => {
      this.renderCurrentView(state);
    });

    this.renderCurrentView(window.appState.state);
    window.sdgChatbot.init();

    this.refreshCaptcha("student");
    this.refreshCaptcha("faculty");
    this.refreshCaptcha("forgot");
  }

  setupEventListeners() {
    document.querySelectorAll("[data-switch-role]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const role = e.currentTarget.getAttribute("data-switch-role");
        window.appState.switchRole(role);
      });
    });

    document.querySelectorAll("[data-nav-route]").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const route = link.getAttribute("data-nav-route");
        const subPage = link.getAttribute("data-nav-subpage");
        window.appState.setRoute(route, subPage);
      });
    });

    document.querySelectorAll(".btn-logout").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (confirm("Are you sure you want to logout?")) {
          await window.appState.logout();
        }
      });
    });
  }

  refreshCaptcha(type) {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.currentCaptcha[type] = code;

    const displayEl = document.getElementById(`captcha-display-${type}`);
    if (displayEl) {
      displayEl.textContent = code;
    }
  }

  setupAuthForms() {
    const validPassword = value => value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
    const validPhone = value => /^(?:\+91\s*)?[6-9]\d{9}$/.test(value.replace(/[ -]/g, ""));
    ["student", "faculty", "forgot"].forEach(type => {
      const btn = document.getElementById(`btn-refresh-captcha-${type}`);
      if (btn) {
        btn.addEventListener("click", () => this.refreshCaptcha(type));
      }
    });

    const setupTabToggles = (prefix) => {
      const loginTab = document.getElementById(`${prefix}-tab-login`);
      const signupTab = document.getElementById(`${prefix}-tab-signup`);
      const loginBox = document.getElementById(`${prefix}-form-login-box`);
      const signupBox = document.getElementById(`${prefix}-form-signup-box`);

      if (loginTab && signupTab && loginBox && signupBox) {
        loginTab.addEventListener("click", () => {
          loginTab.classList.add("active");
          signupTab.classList.remove("active");
          loginBox.classList.remove("d-none");
          signupBox.classList.add("d-none");
        });
        signupTab.addEventListener("click", () => {
          signupTab.classList.add("active");
          loginTab.classList.remove("active");
          signupBox.classList.remove("d-none");
          loginBox.classList.add("d-none");
        });
      }
    };

    setupTabToggles("student");
    setupTabToggles("faculty");

    // Student Login
    const studentLoginForm = document.getElementById("form-student-login");
    if (studentLoginForm) {
      studentLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const submitBtn = studentLoginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Signing In...';

          const usnOrEmail = document.getElementById("student-login-usn").value.trim();
          const pass = document.getElementById("student-login-pass").value;
          const captcha = document.getElementById("student-login-captcha").value.trim().toUpperCase();

          if (captcha !== this.currentCaptcha.student) {
            alert("Invalid Captcha code! Please enter the exact characters displayed.");
            this.refreshCaptcha("student");
            return;
          }

          const result = window.appState.isRemoteAuthEnabled()
            ? await window.appState.remoteLoginStudent(usnOrEmail, pass)
            : window.appState.loginStudent(usnOrEmail, pass);
          
          if (result.success) {
            console.log(`✅ Student logged in via ${result.backend}`);
            await window.sdgNotify("Your student account was verified. Redirecting to your Student Portal...", { kind: "success", title: "Login successful", duration: 2200 });
            // replace() prevents the browser back button from reopening a
            // stale login page after a successful session handoff.
            window.location.replace("student-dashboard.html");
          } else {
            alert("Login failed. Please check your credentials.");
          }
        } catch (error) {
          console.error('Login error:', error);
          alert(error.message || 'An error occurred during login. Please try again.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    }

    // Student Signup with Automatic AI Task Manager Assignment
    const studentSignupForm = document.getElementById("form-student-signup");
    if (studentSignupForm) {
      studentSignupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const submitBtn = studentSignupForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Creating Account...';

          const name = document.getElementById("student-signup-name").value.trim();
          const usn = document.getElementById("student-signup-usn").value.trim();
          const dept = document.getElementById("student-signup-dept").value;
          const skills = document.getElementById("student-signup-skills").value.trim();
          const interests = document.getElementById("student-signup-interests").value.trim();
          const phone = document.getElementById("student-signup-phone").value.trim();
          const email = document.getElementById("student-signup-email").value.trim();
          const skillLevel = document.getElementById("student-signup-skill-level")?.value || "intermediate";
          const availableHours = document.getElementById("student-signup-hours")?.value || "4";
          const pass = document.getElementById("student-signup-pass").value;
          const captcha = document.getElementById("student-signup-captcha").value.trim().toUpperCase();

          if (captcha !== this.currentCaptcha.student) {
            alert("Invalid Captcha code! Please try again.");
            this.refreshCaptcha("student");
            return;
          }
          if (name.length < 2 || name.length > 80) {
            alert("Name must be between 2 and 80 characters.");
            return;
          }
          if (!validPhone(phone)) {
            alert("Enter a valid 10-digit Indian phone number.");
            return;
          }
          if (!validPassword(pass)) {
            alert("Password must be at least 8 characters with uppercase, lowercase, number, and special character.");
            return;
          }

          const result = window.appState.isRemoteAuthEnabled()
            ? await window.appState.remoteSignupStudent({
                name, usn, department: dept, skills, interests, phone, email, password: pass,
                skillLevel, availableHours
              })
            : window.appState.signupStudent({
                name, usn, department: dept, skills, interests, phone, email, password: pass
              });

          if (result.success) {
            console.log(`✅ Student registered via ${result.backend}`);
            await window.sdgNotify("Your student account was created successfully. Redirecting to your Student Portal...", { kind: "success", title: "Registration successful", duration: 2200 });
            window.location.replace("student-dashboard.html");
          } else {
            alert("Signup failed. Please try again.");
          }
        } catch (error) {
          console.error('Signup error:', error);
          alert(error.message || 'An error occurred during signup. Please try again.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    }

    // Faculty Login
    const facultyLoginForm = document.getElementById("form-faculty-login");
    if (facultyLoginForm) {
      facultyLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const submitBtn = facultyLoginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Signing In...';

          const email = document.getElementById("faculty-login-email").value.trim();
          const pass = document.getElementById("faculty-login-pass").value;
          const captcha = document.getElementById("faculty-login-captcha").value.trim().toUpperCase();

          if (captcha !== this.currentCaptcha.faculty) {
            alert("Invalid Captcha code! Please try again.");
            this.refreshCaptcha("faculty");
            return;
          }
          if (name.length < 2 || name.length > 80) {
            alert("Name must be between 2 and 80 characters.");
            return;
          }
          if (!validPhone(phone) || !validPassword(pass)) {
            alert("Enter a valid phone number and a strong password (8+ characters with uppercase, lowercase, number, and special character).");
            return;
          }

          const result = window.appState.isRemoteAuthEnabled()
            ? await window.appState.remoteLoginFaculty(email, pass)
            : window.appState.loginFaculty(email, pass);
          
          if (result.success) {
            console.log(`✅ Faculty logged in via ${result.backend}`);
            await window.sdgNotify("Your faculty account was verified. Redirecting to the Faculty Portal...", { kind: "success", title: "Login successful", duration: 2200 });
            window.location.replace("faculty-dashboard.html");
          } else {
            alert("Login failed. Please check your credentials.");
          }
        } catch (error) {
          console.error('Login error:', error);
          alert(error.message || 'An error occurred during login. Please try again.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    }

    // Faculty Signup
    const facultySignupForm = document.getElementById("form-faculty-signup");
    if (facultySignupForm) {
      facultySignupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const submitBtn = facultySignupForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Creating Account...';

          const name = document.getElementById("faculty-signup-name").value.trim();
          const dept = document.getElementById("faculty-signup-dept").value;
          const designation = document.getElementById("faculty-signup-designation")?.value.trim() || "Assistant Professor";
          const phone = document.getElementById("faculty-signup-phone").value.trim();
          const email = document.getElementById("faculty-signup-email").value.trim();
          const pass = document.getElementById("faculty-signup-pass").value;
          const captcha = document.getElementById("faculty-signup-captcha").value.trim().toUpperCase();

          if (captcha !== this.currentCaptcha.faculty) {
            alert("Invalid Captcha code! Please try again.");
            this.refreshCaptcha("faculty");
            return;
          }

          const result = window.appState.isRemoteAuthEnabled()
            ? await window.appState.remoteSignupFaculty({
                name, department: dept, designation, phone, email, password: pass
              })
            : window.appState.signupFaculty({
                name, department: dept, phone, email, password: pass
              });

          if (result.success) {
            console.log(`✅ Faculty registered via ${result.backend}`);
            await window.sdgNotify("Your faculty account was created successfully. Redirecting to the Faculty Portal...", { kind: "success", title: "Registration successful", duration: 2200 });
            window.location.replace("faculty-dashboard.html");
          } else {
            alert("Signup failed. Please try again.");
          }
        } catch (error) {
          console.error('Signup error:', error);
          alert(error.message || 'An error occurred during signup. Please try again.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    }

    // Forgot Password
    const forgotForm = document.getElementById("form-forgot-password");
    if (forgotForm) {
      forgotForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("forgot-email").value.trim();
        const newPass = document.getElementById("forgot-new-pass").value;
        const confirmPass = document.getElementById("forgot-confirm-pass").value;
        const captcha = document.getElementById("forgot-captcha").value.trim().toUpperCase();

        if (captcha !== this.currentCaptcha.forgot) {
          alert("Invalid Captcha code! Please try again.");
          this.refreshCaptcha("forgot");
          return;
        }

        if (newPass.length < 6) {
          alert("Password must be at least 6 characters long.");
          return;
        }

        if (newPass !== confirmPass) {
          alert("Passwords do not match! Please check your confirmation password.");
          return;
        }

        alert(`✅ Password successfully reset for ${email}! You can now login with your new password.`);
        window.appState.setRoute("student-auth");
      });
    }
  }

  setupGlobalNavigation() {
    document.querySelectorAll("[data-student-tab]").forEach(tab => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        const page = tab.getAttribute("data-student-tab");
        window.appState.setStudentSubPage(page);
      });
    });

    document.querySelectorAll("[data-faculty-tab]").forEach(tab => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        const page = tab.getAttribute("data-faculty-tab");
        window.appState.setFacultySubPage(page);
      });
    });
  }

  renderCurrentView(state) {
    const route = state.currentRoute;
    const views = [
      "home-view", 
      "student-auth-view", 
      "faculty-auth-view", 
      "forgot-password-view", 
      "student-dashboard-view", 
      "faculty-dashboard-view"
    ];

    views.forEach(v => {
      const el = document.getElementById(v);
      if (el) el.classList.add("d-none");
    });

    const activeView = document.getElementById(`${route}-view`);
    if (activeView) {
      activeView.classList.remove("d-none");
    }

    this.updateNavbarUserBadge(state);

    if (route === "home") {
      this.renderHomeGoalsShowcase();
    } else if (route === "student-dashboard") {
      this.renderStudentDashboard(state);
    } else if (route === "faculty-dashboard") {
      this.renderFacultyDashboard(state);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  updateNavbarUserBadge(state) {
    const userBadge = document.getElementById("navbar-user-badge");
    const userRolePill = document.getElementById("navbar-role-pill");
    const userAvatar = document.getElementById("navbar-user-avatar");
    const authActions = document.getElementById("navbar-auth-actions");
    const userProfileDropdown = document.getElementById("navbar-user-dropdown");

    if (state.currentUser) {
      if (authActions) authActions.classList.add("d-none");
      if (userProfileDropdown) userProfileDropdown.classList.remove("d-none");
      if (userBadge) userBadge.textContent = state.currentUser.name;
      if (userRolePill) {
        userRolePill.textContent = state.userRole === "faculty" ? "Faculty" : "Student";
        userRolePill.className = state.userRole === "faculty" ? "badge bg-info-soft text-info" : "badge bg-success-soft text-success";
      }
      if (userAvatar && state.currentUser.avatar) {
        userAvatar.src = state.currentUser.avatar;
      }
    } else {
      if (authActions) authActions.classList.remove("d-none");
      if (userProfileDropdown) userProfileDropdown.classList.add("d-none");
    }
  }

  setupStudentProfile() {
    const profileButton = document.getElementById("btn-student-profile");
    const form = document.getElementById("form-student-profile");
    const modalEl = document.getElementById("studentProfileModal");
    if (!profileButton || !form || !modalEl) return;

    profileButton.addEventListener("click", () => this.openStudentProfileModal());
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const list = value => String(value || "").split(",").map(item => item.trim()).filter(Boolean);
      const submitButton = form.querySelector("button[type='submit']");
      const profileData = {
        name: document.getElementById("profile-name").value,
        phone: document.getElementById("profile-phone").value,
        department: document.getElementById("profile-department").value,
        skillLevel: document.getElementById("profile-skill-level").value,
        skills: list(document.getElementById("profile-skills").value),
        interests: list(document.getElementById("profile-interests").value),
        availableHours: Number(document.getElementById("profile-hours").value)
      };
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Saving...';
      }
      try {
        await window.appState.updateStudentProfile(profileData);
        window.bootstrap?.Modal.getInstance(modalEl)?.hide();
        await window.sdgNotify("Your profile, skills, and interests were updated.", { kind: "success", title: "Profile saved" });
      } catch (error) {
        await window.sdgNotify(error.message || "The profile could not be updated.", { kind: "error", title: "Profile update failed" });
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Save Profile';
        }
      }
    });
  }

  openStudentProfileModal() {
    const student = window.appState?.state?.currentUser;
    const modalEl = document.getElementById("studentProfileModal");
    if (!student || !modalEl) return;
    const setValue = (id, value) => { const field = document.getElementById(id); if (field) field.value = value ?? ""; };
    setValue("profile-name", student.name);
    setValue("profile-usn", student.usn);
    setValue("profile-email", student.email);
    setValue("profile-phone", student.phone);
    setValue("profile-department", student.department);
    setValue("profile-skill-level", student.skillLevel || "intermediate");
    setValue("profile-skills", (student.skills || []).join(", "));
    setValue("profile-interests", (student.interests || []).join(", "));
    setValue("profile-hours", student.availableHours || 4);
    new window.bootstrap.Modal(modalEl).show();
  }

  // ----------------------------------------------------
  // HOME PAGE RENDERER
  // ----------------------------------------------------
  renderHomeGoalsShowcase() {
    const grid = document.getElementById("home-sdg-grid");
    if (!grid) return;

    grid.innerHTML = window.SDG_DATA.goals.map(goal => `
      <div class="col-6 col-md-4 col-lg-2 col-xl-2">
        <div class="home-sdg-card p-3 rounded-4 h-100 d-flex flex-column justify-content-between text-white" 
             style="background: ${goal.color}; cursor: pointer;" 
             data-goal-id="${goal.id}">
          <div>
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="fs-4 fw-bold opacity-75">${goal.number}</span>
              <i class="${goal.icon} fs-4"></i>
            </div>
            <h6 class="fw-bold mb-1 lh-sm">${goal.name}</h6>
          </div>
          <small class="opacity-75" style="font-size: 0.75rem;">${goal.shortName}</small>
        </div>
      </div>
    `).join("");

    grid.querySelectorAll(".home-sdg-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = parseInt(card.getAttribute("data-goal-id"), 10);
        this.openGoalDetailModal(id);
      });
    });
  }

  // ----------------------------------------------------
  // STUDENT DASHBOARD RENDERER
  // ----------------------------------------------------
  renderStudentDashboard(state) {
    const student = state.currentUser || state.students[0];
    if (!student) return;

    const subPage = state.studentSubPage || "progress";

    document.querySelectorAll("[data-student-tab]").forEach(tab => {
      if (tab.getAttribute("data-student-tab") === subPage) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });

    const container = document.getElementById("student-subpage-container");
    if (!container) return;

    // Load the student's current activities before relying on activity detail
    // fields returned by the backend. The first render remains immediate, and
    // the page is refreshed once the remote records are available.
    if (subPage === "activities" && window.appState.isRemoteAuthEnabled()) {
      this.loadStudentActivities(student).then(() => {
        if (window.appState.state.userRole === "student" &&
            window.appState.state.currentUser?.id === student.id &&
            window.appState.state.studentSubPage === "activities") {
          this.renderStudentActivitiesPage(container, student, window.appState.state);
        }
      });
    }

    switch (subPage) {
      case "progress":
        this.renderStudentProgressPage(container, student, state);
        break;
      case "sdg-goals":
        this.renderStudentSdgGoalsPage(container);
        break;
      case "quiz":
        this.renderStudentQuizPage(container);
        break;
      case "games":
        window.gamesEngine.renderGamesHub();
        break;
      case "activities":
        this.renderStudentActivitiesPage(container, student, state);
        break;
      case "leaderboard":
        this.renderStudentLeaderboardPage(container, student, state);
        break;
      default:
        this.renderStudentProgressPage(container, student, state);
    }
  }

  // Page 1: My Progress
  renderStudentProgressPage(container, student, state) {
    const completedSubs = state.submissions.filter(s => s.studentId === student.id && s.submissionStatus === "approved");
    
    const ongoingTasks = state.studentOngoingTasks.filter(og =>
      og.assignedBy === "ai_agent" && og.status !== "completed"
    ).map(og => {
      const task = state.activities.find(a => a.id === og.taskId);
      return { ...og, task };
    }).filter(og => og.task);
    const assignedAiActivity = state.activities.find(task =>
      task.aiAssigned && task.assignedToStudentId === student.id && task.status === "Active"
    );
    const displayTasks = ongoingTasks.length
      ? ongoingTasks.slice(0, 1)
      : (assignedAiActivity ? [{ task: assignedAiActivity, pendingEnrollment: true, progressPct: 0 }] : []);

    const aiRecs = window.sdgAiEngine.getRecommendedTasks(student, 3);
    const enrolledTaskIds = new Set(state.studentOngoingTasks.map(task => task.taskId));

    container.innerHTML = `
      <div class="student-progress-wrapper animate-fade-in">
        <!-- Welcome Banner -->
        <div class="card-glass student-welcome-banner p-4 mb-4 position-relative overflow-hidden">
          <div class="row align-items-center">
            <div class="col-lg-8">
              <div class="d-flex align-items-center gap-3 mb-2">
                <span class="badge bg-success-soft text-success px-3 py-1 fw-bold">
                  <i class="fa-solid fa-microchip me-1"></i> CS & AI SDG Changemaker
                </span>
                <span class="text-muted small">USN: <strong>${student.usn}</strong></span>
              </div>
              <h2 class="fw-bold mb-1">Hey, ${student.name}!</h2>
              <p class="text-muted mb-3">
                Welcome back • <strong>${student.department}</strong>
              </p>

              <div class="d-flex align-items-center gap-3 flex-wrap">
                <div class="stat-pill-inline">
                  <i class="fa-solid fa-award text-warning"></i>
                  <span><strong>${student.points || 0}</strong> SDG Points</span>
                </div>
                <div class="stat-pill-inline">
                  <i class="fa-solid fa-circle-check text-success"></i>
                  <span><strong>${completedSubs.length}</strong> Completed Tasks</span>
                </div>
                <div class="stat-pill-inline">
                  <i class="fa-solid fa-diagram-project text-primary"></i>
                  <span><strong>${displayTasks.length}</strong> Active AI Task</span>
                </div>
              </div>
            </div>

            <div class="col-lg-4 text-lg-end mt-3 mt-lg-0">
              <button class="btn btn-primary px-4 py-2" id="btn-request-ai-assignment">
                <i class="fa-solid fa-wand-magic-sparkles me-2"></i> AI Auto-Assign Task
              </button>
            </div>
          </div>
        </div>

        <!-- Visual Graphs & AI Recommendations Row -->
        <div class="row g-4 mb-4">
          <!-- SDG Radar / Doughnut Coverage -->
          <div class="col-12">
            <div class="card-glass p-4 h-100">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold mb-0">🎯 Your SDG Impact Distribution</h5>
                <span class="badge bg-light text-muted">17 UN Goals</span>
              </div>
              
              <div class="d-flex justify-content-center align-items-center my-3" style="min-height: 220px;">
                ${this.generateSdgDoughnutSvg(student.sdgCoverage || {})}
              </div>

              <!-- Unlocked Badges -->
              <div class="mt-3">
                <small class="text-muted fw-bold d-block mb-2">Unlocked Badges:</small>
                <div class="d-flex flex-wrap gap-2">
                  ${(student.badges || ["New Changemaker"]).map(b => `
                    <span class="badge rounded-pill bg-warning-soft text-dark px-3 py-1 border">
                      🏅 ${b}
                    </span>
                  `).join("")}
                </div>
              </div>
            </div>
          </div>

          <!-- AI Recommended SDG Activities (moved to Activities page) -->
          <div class="col-lg-6 d-none">
            <div class="card-glass p-4 h-100">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold mb-0">🤖 AI Recommended For You</h5>
                <span class="badge bg-primary-soft text-primary">Profile Match</span>
              </div>

              <div class="ai-recommendations-list d-flex flex-column gap-3">
                ${aiRecs.map(rec => `
                  <div class="ai-rec-card p-3 rounded-3 bg-light border">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                      <span class="badge ${rec.taskType === 'technical_dl_project' ? 'bg-primary text-white' : 'bg-light text-dark border'}">
                        ${rec.taskType === 'technical_dl_project' ? '💻 Coding Activity' : `SDG ${rec.goalId} Field Activity`}
                      </span>
                      <span class="badge bg-success-soft text-success fw-bold">
                        <i class="fa-solid fa-sparkles me-1"></i> ${rec.matchScore}% Match
                      </span>
                    </div>
                    <h6 class="fw-bold mb-1">${rec.title}</h6>
                    <p class="text-muted small mb-2">${rec.matchReasons.join("; ")}</p>
                    <div class="d-flex justify-content-between align-items-center">
                      <strong class="text-warning small">+${rec.points} Points</strong>
                      ${enrolledTaskIds.has(rec.id) ? `
                        <button class="btn btn-sm btn-light text-muted border" disabled>
                          You're enrolled
                        </button>
                      ` : `
                        <button class="btn btn-sm btn-outline-primary btn-enroll-task" data-task-id="${rec.id}">
                          Enroll & Start <i class="fa-solid fa-arrow-right ms-1"></i>
                        </button>
                      `}
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>

        <!-- Ongoing Tasks -->
        <div class="row g-4">
          <div class="col-lg-7">
            <div class="card-glass p-4 h-100">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 class="fw-bold mb-0">⏳ Active AI Task (${displayTasks.length})</h5>
                  <small class="text-muted">Complete this task, then submit it from Activities.</small>
                </div>
              </div>

              ${displayTasks.length === 0 ? `
                <div class="text-center py-4 text-muted">
                  <p class="mb-2">No active tasks right now.</p>
                  <button class="btn btn-sm btn-primary" id="btn-browse-activities">Browse Tasks Catalog</button>
                </div>
              ` : `
                <div class="d-flex flex-column gap-3">
                  ${displayTasks.map(item => {
                    const isDl = item.task.taskType === "technical_dl_project";
                    return `
                      <div class="ongoing-task-card p-4 rounded-4 bg-light border">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <span class="badge ${isDl ? 'bg-primary text-white' : 'bg-secondary text-white'} mb-1">
                              ${isDl ? '💻 Coding Activity' : 'Field Activity'}
                            </span>
                            <h6 class="fw-bold mb-0">${item.task.title}</h6>
                          </div>
                          <span class="badge bg-warning-soft text-warning fw-bold fs-6">+${item.task.points} pts</span>
                        </div>

                        <p class="text-muted small mb-3">${item.task.description}</p>

                        <div class="p-3 rounded-3 bg-white border mb-3">
                          <div class="small text-muted"><i class="fa-solid fa-circle-info text-primary me-1"></i> Complete the assigned project and submit the required project information from Activities.</div>
                        </div>

                        <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                          <small class="text-muted">Deadline: <strong>${item.task.deadline}</strong></small>
                          ${item.pendingEnrollment ? `
                            <button class="btn btn-sm btn-outline-primary px-3 btn-enroll-ai-task" data-task-id="${item.task.id}">
                              <i class="fa-solid fa-right-to-bracket me-1"></i> Enroll to Start
                            </button>
                          ` : `
                            <button class="btn btn-sm btn-success px-3 btn-submit-proof" data-task-id="${item.task.id}">
                              <i class="fa-solid ${isDl ? 'fa-code-branch' : 'fa-camera'} me-1"></i>
                              ${isDl ? 'Submit Coding Work' : 'Submit Field Work'}
                            </button>
                          `}
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              `}
            </div>
          </div>

          <!-- Completed History -->
          <div class="col-lg-5">
            <div class="card-glass p-4 h-100">
              <h5 class="fw-bold mb-3">✅ Verified Completed Activities (${completedSubs.length})</h5>

              ${completedSubs.length === 0 ? `
                <div class="text-center py-4 text-muted">
                  <p class="mb-0">Complete your first SDG activity and submit it for faculty review to build your transcript!</p>
                </div>
              ` : `
                <div class="completed-subs-scroll d-flex flex-column gap-3" style="max-height: 480px; overflow-y: auto;">
                  ${completedSubs.map(sub => `
                    <div class="completed-item-card p-3 rounded-3 bg-light border d-flex align-items-center gap-3">
                      <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start">
                          <h6 class="fw-bold mb-0 text-truncate" style="max-width: 70%;">${sub.taskTitle}</h6>
                          <span class="badge bg-success text-white">+${sub.pointsAwarded} pts</span>
                        </div>
                        <small class="text-muted d-block">${sub.submittedAt}</small>
                        <span class="badge bg-success-soft text-success small mt-1">
                          <i class="fa-solid fa-circle-check me-1"></i> Faculty Approved
                        </span>
                      </div>
                    </div>
                  `).join("")}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    // Listeners
    const reqBtn = document.getElementById("btn-request-ai-assignment");
    if (reqBtn) {
      reqBtn.addEventListener("click", async () => {
        await this.assignAiTaskForStudent(student, container);
        window.appState.setStudentSubPage("activities");
        return;
        const dynamicTask = window.sdgAiEngine.generateDynamicTaskForStudent(student);
        window.appState.state.activities.unshift(dynamicTask);
        window.appState.assignTaskToStudent(dynamicTask.id);
        alert(`🌟 AI Task Assigned: "${dynamicTask.title}" (+${dynamicTask.points} pts) added to your ongoing tasks!`);
      });
    }

    container.querySelectorAll(".btn-enroll-task").forEach(btn => {
      btn.addEventListener("click", () => {
        const taskId = btn.getAttribute("data-task-id");
        window.appState.assignTaskToStudent(taskId);
        this.renderStudentProgressPage(container, student, window.appState.state);
      });
    });

    container.querySelectorAll(".btn-enroll-ai-task").forEach(btn => {
      btn.addEventListener("click", () => {
        const taskId = btn.getAttribute("data-task-id");
        if (!window.appState.assignTaskToStudent(taskId, student.id, "ai_agent")) {
          alert("Complete your current active task before enrolling in another task.");
          return;
        }
        this.renderStudentProgressPage(container, student, window.appState.state);
      });
    });

    container.querySelectorAll(".btn-submit-proof").forEach(btn => {
      btn.addEventListener("click", () => {
        const taskId = btn.getAttribute("data-task-id");
        this.openSubmissionModal(taskId);
      });
    });

    const browseBtn = document.getElementById("btn-browse-activities");
    if (browseBtn) browseBtn.addEventListener("click", () => window.appState.setStudentSubPage("activities"));
  }

  // Generate SVG Doughnut
  generateSdgDoughnutSvg(coverage) {
    const goals = window.SDG_DATA.goals;
    const activeGoals = Object.keys(coverage).map(Number);

    if (activeGoals.length === 0) {
      return `
        <div class="text-center text-muted">
          <p class="small mb-1">No SDG activities recorded yet.</p>
          <small>Complete tasks to populate your institutional impact wheel!</small>
        </div>
      `;
    }

    const totalCount = Object.values(coverage).reduce((a, b) => a + b, 0);
    let cumulativeAngle = 0;
    const radius = 70;
    const strokeWidth = 26;
    const center = 90;
    const circumference = 2 * Math.PI * radius;

    const segments = activeGoals.map(goalId => {
      const count = coverage[goalId];
      const fraction = count / totalCount;
      const strokeDasharray = `${fraction * circumference} ${circumference}`;
      const strokeDashoffset = -cumulativeAngle * circumference;
      cumulativeAngle += fraction;
      const goal = goals.find(g => g.id === goalId) || { color: "#3F7E44", shortName: `SDG ${goalId}` };

      return `
        <circle cx="${center}" cy="${center}" r="${radius}" 
                fill="transparent" 
                stroke="${goal.color}" 
                stroke-width="${strokeWidth}" 
                stroke-dasharray="${strokeDasharray}" 
                stroke-dashoffset="${strokeDashoffset}"
                transform="rotate(-90 ${center} ${center})">
          <title>${goal.shortName}: ${count} task(s)</title>
        </circle>
      `;
    }).join("");

    return `
      <div class="d-flex align-items-center gap-4 flex-wrap justify-content-center">
        <svg width="180" height="180" viewBox="0 0 180 180">
          ${segments}
          <text x="${center}" y="${center - 5}" text-anchor="middle" font-size="22" font-weight="bold" fill="#1e293b">${totalCount}</text>
          <text x="${center}" y="${center + 15}" text-anchor="middle" font-size="11" fill="#64748b">Verified Tasks</text>
        </svg>

        <div class="d-flex flex-column gap-1" style="max-height: 160px; overflow-y: auto;">
          ${activeGoals.map(id => {
            const g = goals.find(item => item.id === id);
            return `
              <div class="d-flex align-items-center gap-2 small">
                <span class="badge-sdg-dot" style="background: ${g ? g.color : '#333'}; width: 10px; height: 10px;"></span>
                <span><strong>SDG ${id}:</strong> ${g ? g.shortName : ''} (${coverage[id]})</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  // Page 2: About SDG Goals
  renderStudentSdgGoalsPage(container) {
    container.innerHTML = `
      <div class="sdg-goals-page animate-fade-in">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <div>
            <h3 class="fw-bold mb-1">🌍 The 17 UN Sustainable Development Goals</h3>
            <p class="text-muted mb-0">Explore the global vision, targets, and campus initiatives driving sustainable transformation.</p>
          </div>

          <div class="d-flex gap-2 flex-wrap" id="sdg-category-filters">
            <button class="btn btn-sm btn-primary filter-category-btn active" data-cat="all">All (17)</button>
            <button class="btn btn-sm btn-outline-secondary filter-category-btn" data-cat="Biosphere">Biosphere</button>
            <button class="btn btn-sm btn-outline-secondary filter-category-btn" data-cat="Society">Society</button>
            <button class="btn btn-sm btn-outline-secondary filter-category-btn" data-cat="Economy">Economy</button>
            <button class="btn btn-sm btn-outline-secondary filter-category-btn" data-cat="Governance">Governance</button>
          </div>
        </div>

        <div class="row g-4" id="goals-card-container">
          ${window.SDG_DATA.goals.map(goal => `
            <div class="col-md-6 col-lg-4 goal-grid-item" data-category="${goal.category}">
              <div class="card-glass goal-detail-card h-100 p-4 d-flex flex-column justify-content-between" 
                   style="border-top: 5px solid ${goal.color};">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="badge rounded-pill text-white fw-bold px-3 py-1" style="background: ${goal.color};">
                      Goal ${goal.number}
                    </span>
                    <i class="${goal.icon} fs-3" style="color: ${goal.color};"></i>
                  </div>
                  <h5 class="fw-bold mb-2">${goal.name}</h5>
                  <p class="text-muted small mb-3">${goal.vision}</p>
                </div>

                <div class="mt-3 pt-3 border-top d-flex justify-content-between align-items-center">
                  <span class="badge bg-light text-dark border">${goal.category}</span>
                  <button class="btn btn-sm btn-outline-primary btn-inspect-goal" data-goal-id="${goal.id}">
                    Explore Targets <i class="fa-solid fa-arrow-right ms-1"></i>
                  </button>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    container.querySelectorAll(".btn-inspect-goal").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-goal-id"), 10);
        this.openGoalDetailModal(id);
      });
    });
  }

  // Page 3: Quiz Arena
  renderStudentQuizPage(container) {
    const quizProgress = window.appState.state.quizProgress || {};
    const quizzes = window.SDG_DATA.quizzes;

    container.innerHTML = `
      <div class="quiz-hub-wrapper animate-fade-in">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <div>
            <h3 class="fw-bold mb-1">🧠 SDG Knowledge Arena & Quizzes</h3>
            <p class="text-muted mb-0">Test your mastery on key SDGs, earn institutional points, and unlock verified mastery badges.</p>
            <p class="small text-muted mt-2 mb-0"><strong>Scoring:</strong> correct answers ÷ total questions × 100. A score of 60% or higher passes and unlocks the next quiz. Your first passing score is added to your activity points.</p>
          </div>
        </div>

        <div class="row g-4">
          ${quizzes.map((quiz, index) => {
            const progress = quizProgress[quiz.topicId] || {};
            const unlocked = index === 0 || Boolean(progress.unlocked);
            const completed = Boolean(progress.completed);
            return `
            <div class="col-md-6">
              <div class="card-glass quiz-topic-card h-100 p-4 d-flex flex-column justify-content-between ${unlocked ? '' : 'opacity-75'}">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="badge rounded-pill text-white px-3 py-1" style="background: ${quiz.color};">
                      SDG ${quiz.goalId}
                    </span>
                    <span class="badge bg-light text-dark border">
                      <i class="fa-solid fa-clock me-1"></i> ${quiz.timeLimitSeconds / 60} mins
                    </span>
                  </div>

                  <div class="d-flex align-items-center gap-3 mb-3">
                    <div class="quiz-icon-box" style="background: ${quiz.color}20; color: ${quiz.color}; width: 50px; height: 50px; border-radius: 12px; display: grid; place-items: center;">
                      <i class="${quiz.icon} fs-4"></i>
                    </div>
                    <h5 class="fw-bold mb-0">${quiz.title}</h5>
                  </div>

                  <p class="text-muted small mb-3">
                    ${quiz.questions.length} challenging questions covering global targets, real-world case studies, and campus sustainability.
                  </p>
                </div>

                <div class="pt-3 border-top d-flex justify-content-between align-items-center">
                  <span class="text-success small fw-bold">
                    <i class="fa-solid ${completed ? 'fa-circle-check' : 'fa-award'} me-1"></i> ${completed ? `Completed • Best: ${progress.bestScore || 0}%` : `Badge: ${quiz.badge}`}
                  </span>
                  <button class="btn ${unlocked ? 'btn-primary' : 'btn-light text-muted border'} px-4 btn-start-quiz" data-topic-id="${quiz.topicId}" ${unlocked ? '' : 'disabled'}>
                    ${unlocked ? (completed ? 'Retake Quiz' : 'Start Quiz') : '<i class="fa-solid fa-lock me-1"></i> Locked'} ${unlocked ? '<i class="fa-solid fa-play ms-1"></i>' : ''}
                  </button>
                </div>
              </div>
            </div>
          `;
          }).join("")}
        </div>
      </div>
    `;

    container.querySelectorAll(".btn-start-quiz").forEach(btn => {
      btn.addEventListener("click", () => {
        const topicId = btn.getAttribute("data-topic-id");
        window.quizEngine.startQuiz(topicId);
      });
    });
  }

  async assignAiTaskForStudent(student, container) {
    const studentKey = String(student?.id || student?.usn || "student");
    if (this.aiAssignmentInFlight.has(studentKey)) return;
    const activeAiTask = (window.appState.state.studentOngoingTasks || []).find(item =>
      item.studentId === student.id && item.assignedBy === "ai_agent" && item.status !== "completed"
    );
    const pendingAiTask = (window.appState.state.activities || []).find(task =>
      task.aiAssigned && task.assignedToStudentId === student.id && task.status === "Active"
    );
    if (activeAiTask || pendingAiTask) {
      const activeTask = window.appState.state.activities.find(task =>
        task.id === (activeAiTask?.taskId || pendingAiTask?.id)
      );
      alert(`Please complete your active AI task${activeTask ? `: "${activeTask.title}"` : ""} first, then click Assign AI Task for a new task.`);
      return;
    }
    this.aiAssignmentInFlight.add(studentKey);
    const loadingModalEl = document.getElementById("taskAssignmentLoadingModal");
    const loadingModal = loadingModalEl && window.bootstrap ? new window.bootstrap.Modal(loadingModalEl) : null;
    const assignButtons = document.querySelectorAll("#btn-ai-assign-task, #btn-trigger-ai-assign-2");
    assignButtons.forEach(button => {
      button.disabled = true;
      button.dataset.previousText = button.innerHTML;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Generating...';
    });
    loadingModal?.show();
    let newTask;
    try {
      newTask = await window.sdgAiEngine.generateTaskForStudent(student);
    } catch (error) {
      alert(error.message || "Complete your current task before requesting a new one.");
      loadingModal?.hide();
      this.aiAssignmentInFlight.delete(studentKey);
      assignButtons.forEach(button => {
        button.disabled = false;
        button.innerHTML = button.dataset.previousText || '<i class="fa-solid fa-wand-magic-sparkles me-1"></i> Assign AI Task';
        delete button.dataset.previousText;
      });
      return;
    }
    newTask.aiAssigned = true;
    newTask.assignedToStudentId = student.id;
    window.appState.state.activities.unshift(newTask);
    window.appState.save();
    if (newTask.approvalPending) {
      alert(`Your personalized activity "${newTask.title}" was generated and sent to faculty for approval. It is shown below while approval is pending.`);
    } else {
      alert(`AI task assigned: "${newTask.title}". Enroll in Activities to start it.`);
    }
    this.renderStudentActivitiesPage(container, student, window.appState.state);
    loadingModal?.hide();
    this.aiAssignmentInFlight.delete(studentKey);
    assignButtons.forEach(button => {
      button.disabled = false;
      button.innerHTML = button.dataset.previousText || '<i class="fa-solid fa-wand-magic-sparkles me-1"></i> Assign AI Task';
      delete button.dataset.previousText;
    });
  }

  // Page 5: Activities Catalog & Proof Submission
  renderStudentActivitiesPage(container, student, state) {
    const activities = state.activities || [];
    const enrolledAiTask = (state.studentOngoingTasks || []).find(item =>
      item.studentId === student.id && item.assignedBy === "ai_agent" && item.status !== "completed"
    );
    const assignedAiTask = activities.find(task =>
      task.aiAssigned && task.assignedToStudentId === student.id && (task.status === "Active" || task.approvalRejected)
    );
    const visibleActivities = (assignedAiTask || (enrolledAiTask && activities.find(task => task.id === enrolledAiTask.taskId)))
      ? [assignedAiTask || activities.find(task => task.id === enrolledAiTask.taskId)]
      : [];
    const enrolledTaskIds = new Set((state.studentOngoingTasks || []).map(task => task.taskId));

    container.innerHTML = `
      <div class="student-activities-wrapper animate-fade-in">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <div>
            <h3 class="fw-bold mb-1">📋 AI-Assigned SDG Activity</h3>
            <p class="text-muted mb-0">Only your current AI-assigned task is shown here.</p>
          </div>

          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-primary px-3" id="btn-ai-assign-task">
              <i class="fa-solid fa-wand-magic-sparkles me-1"></i> Assign AI Task
            </button>
          </div>
        </div>

        ${visibleActivities.length === 0 ? `
          <!-- Clean Blank State: Waiting for LLM / AI Agent Generation -->
          <div class="empty-activities-placeholder my-4">
            <div class="agent-pulse-badge mb-3">
              <i class="fa-solid fa-robot"></i> LLM & Autonomous Agent Pipeline Active
            </div>
            <h4 class="fw-bold mb-2">No Activities Assigned Yet</h4>
            <p class="text-muted max-w-600 mx-auto mb-4" style="font-size: 0.92rem;">
              Your activities section is currently blank. When your LLM or Autonomous AI Agent assigns tasks based on your chosen department (<strong>${student.department}</strong>), skills, and SDG interests, your customized activities and technical projects will appear here.
            </p>
            <div class="d-flex justify-content-center gap-3 flex-wrap">
              <small class="text-muted">Use <strong>Assign AI Task</strong> above to receive one personalized task at a time.</small>
            </div>
          </div>
        ` : `
          <div class="row g-4" id="tasks-cards-grid">
            ${visibleActivities.map(task => {
              const isDl = task.taskType === "technical_dl_project";
              const isPendingApproval = Boolean(task.approvalPending);
              const isRejected = Boolean(task.approvalRejected);
              return `
                <div class="col-md-6 col-lg-4 task-card-item">
                  <div class="card-glass task-item-card h-100 p-4 d-flex flex-column justify-content-between position-relative">
                    <div>
                      <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge ${isPendingApproval ? 'bg-warning-soft text-dark' : (isDl ? 'bg-primary text-white' : (task.status === 'Active' ? 'bg-success-soft text-success' : 'bg-secondary-soft text-secondary'))}">
                          ${isDl ? '💻 Coding Activity' : `● ${task.status}`}
                        </span>
                        <span class="badge bg-warning-soft text-dark fw-bold">+${task.points} pts</span>
                      </div>

                      <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
                        <h5 class="fw-bold mb-0">${task.title}</h5>
                        <button type="button" class="btn btn-sm btn-outline-primary rounded-circle btn-view-activity flex-shrink-0"
                          data-task-id="${task.id}" aria-label="View activity information" title="View activity information">
                          <i class="fa-solid fa-circle-info"></i>
                        </button>
                      </div>
                      ${isPendingApproval ? '<div class="small text-warning fw-semibold mb-2"><i class="fa-solid fa-clock me-1"></i>Awaiting faculty approval</div>' : ''}
                      ${isRejected ? `<div class="alert alert-danger py-2 px-3 small mb-2"><strong>Faculty feedback:</strong> ${task.reviewerNote || "Please review and update this activity before requesting approval again."}</div>` : ''}
                      <p class="text-muted small mb-3">${task.description}</p>

                      <div class="task-metadata mb-3">
                        <div class="small text-muted mb-1">
                          <i class="fa-solid fa-bullseye me-1 text-primary"></i> <strong>SDG ${task.goalId}</strong>
                        </div>
                        <div class="small text-muted mb-1">
                          <i class="fa-solid fa-building-columns me-1 text-secondary"></i> ${task.department}
                        </div>
                        <div class="small text-muted">
                          <i class="fa-solid fa-calendar me-1 text-danger"></i> Deadline: ${task.deadline}
                        </div>
                      </div>
                    </div>

                    <div class="pt-3 border-top d-flex gap-2">
                      ${isPendingApproval ? `
                        <button class="btn btn-sm btn-outline-warning w-100" disabled>
                          <i class="fa-solid fa-clock me-1"></i> Awaiting Faculty Approval
                        </button>
                      ` : isRejected ? `
                        <button class="btn btn-sm btn-outline-danger w-100" disabled>
                          <i class="fa-solid fa-message me-1"></i> Review Faculty Feedback
                        </button>
                      ` : enrolledTaskIds.has(task.id) ? `
                        <div class="d-flex gap-2 w-100">
                          <button class="btn btn-sm btn-success flex-grow-1 btn-submit-single" data-task-id="${task.id}">Submit Project</button>
                        </div>
                      ` : `
                        <div class="d-flex gap-2 w-100">
                          <button class="btn btn-sm btn-outline-primary flex-grow-1 btn-enroll-single" data-task-id="${task.id}">
                            <i class="fa-solid fa-right-to-bracket me-1"></i> Enroll to Start
                          </button>
                        </div>
                      `}
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}
      </div>
    `;

    // Event listeners
    container.querySelector("#btn-ai-assign-task")?.addEventListener("click", () => {
      this.assignAiTaskForStudent(student, container);
    });
    container.querySelector("#btn-agent-generate-now")?.addEventListener("click", async () => {
      await this.assignAiTaskForStudent(student, container);
      return;
      if (window.sdgAiEngine) {
        const newTask = await window.sdgAiEngine.generateTaskForStudent(student);
        window.appState.state.activities.unshift(newTask);
        window.appState.assignTaskToStudent(newTask.id, student.id, "ai_agent");
        window.appState.save();
        alert(`✨ Autonomous AI Agent generated and assigned a challenge for your profile:\n\n"${newTask.title}"`);
      }
    });

    container.querySelectorAll(".btn-enroll-single").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-task-id");
        const task = window.appState.state.activities.find(item => item.id === id);
        const modalEl = document.getElementById("enrollmentConfirmModal");
        const textEl = document.getElementById("enrollmentConfirmText");
        const confirmBtn = document.getElementById("btn-confirm-enrollment");
        if (!task || !modalEl || !confirmBtn) return;
        if (textEl) textEl.textContent = `Enroll in “${task.title}”? You can submit the project after completing it.`;
        confirmBtn.onclick = () => {
          if (!window.appState.assignTaskToStudent(id, student.id, "ai_agent")) {
            alert("Complete your current active task before enrolling in another task.");
            return;
          }
          window.bootstrap.Modal.getInstance(modalEl)?.hide();
          this.renderStudentActivitiesPage(container, student, window.appState.state);
          window.sdgNotify("You are successfully enrolled in this activity.", { kind: "success", title: "Enrollment successful" });
        };
        new window.bootstrap.Modal(modalEl).show();
      });
    });

    container.querySelectorAll(".btn-submit-single").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-task-id");
        this.openSubmissionModal(id);
      });
    });

    container.querySelectorAll(".btn-view-activity").forEach(btn => {
      btn.addEventListener("click", () => this.openActivityDetailModal(btn.getAttribute("data-task-id")));
    });

    const quickSubmitBtn = document.getElementById("btn-quick-submit-proof");
    if (quickSubmitBtn) {
      quickSubmitBtn.addEventListener("click", () => this.openSubmissionModal(null));
    }

    const aiAssignBtn2 = document.getElementById("btn-trigger-ai-assign-2");
    if (aiAssignBtn2) {
      aiAssignBtn2.addEventListener("click", async () => {
        await this.assignAiTaskForStudent(student, container);
        return;
        if (window.sdgAiEngine) {
          const newTask = await window.sdgAiEngine.generateTaskForStudent(student);
          window.appState.state.activities.unshift(newTask);
          window.appState.assignTaskToStudent(newTask.id, student.id, "ai_agent");
          window.appState.save();
          alert(`✨ Autonomous AI Agent generated and assigned a challenge for your profile:\n\n"${newTask.title}"`);
        }
      });
    }
  }

  // Page 6: Leaderboard
  renderCuteAvatar(profile, large = false) {
    const avatarSet = [
      { face: "&#128060;", bg: "#dbeafe", accent: "#2563eb" },
      { face: "&#128039;", bg: "#fef3c7", accent: "#d97706" },
      { face: "&#128049;", bg: "#fce7f3", accent: "#db2777" },
      { face: "&#128048;", bg: "#dcfce7", accent: "#16a34a" },
      { face: "&#129421;", bg: "#ffedd5", accent: "#ea580c" },
      { face: "&#129416;", bg: "#ede9fe", accent: "#7c3aed" },
      { face: "&#128018;", bg: "#cffafe", accent: "#0891b2" },
      { face: "&#128005;", bg: "#fef9c3", accent: "#ca8a04" }
    ];
    const seed = String(profile?.id || profile?.name || "student");
    const index = [...seed].reduce((total, character) => total + character.charCodeAt(0), 0) % avatarSet.length;
    const avatar = avatarSet[index];
    return `<div class="cute-avatar ${large ? "cute-avatar-large" : ""}" style="--avatar-bg:${avatar.bg};--avatar-accent:${avatar.accent};" role="img" aria-label="${profile?.name || "Student"} avatar"><span>${avatar.face}</span></div>`;
  }

  renderStudentLeaderboardPage(container, student, state) {
    container.innerHTML = `
      <div class="leaderboard-page-wrapper animate-fade-in">
        <div class="card-glass p-5 text-center">
          <div class="badge-glow-circle mx-auto mb-3" style="background: rgba(2, 132, 199, 0.12); width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center;">
            <i class="fa-solid fa-ranking-star text-primary fs-2"></i>
          </div>
          <h3 class="fw-bold mb-2">Leaderboard unavailable</h3>
          <p class="text-muted mb-0">Leaderboard data will appear here only when it is loaded from the current Supabase records.</p>
        </div>
      </div>
    `;
    return;

    const studentsSorted = [...state.students].sort((a, b) => (b.points || 0) - (a.points || 0));
    const top3 = studentsSorted.slice(0, 3);

    container.innerHTML = `
      <div class="leaderboard-page-wrapper animate-fade-in">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <div>
            <h3 class="fw-bold mb-1">🏆 Campus Sustainability Leaderboard</h3>
            <p class="text-muted mb-0">Celebrating top student changemakers across departments driving the UN Sustainable Development Goals.</p>
          </div>
        </div>

        <div class="podium-showcase-row row g-4 align-items-end justify-content-center mb-5">
          ${top3[1] ? `
            <div class="col-md-4 order-2 order-md-1">
              <div class="card-glass podium-card podium-silver text-center p-4">
                <div class="podium-avatar-wrapper position-relative mx-auto mb-3">
                  ${this.renderCuteAvatar(top3[1])}
                  <span class="podium-rank-badge badge-silver">2</span>
                </div>
                <h5 class="fw-bold mb-1">${top3[1].name}</h5>
                <small class="text-muted d-block mb-2">${top3[1].department}</small>
                <div class="badge bg-light text-dark border px-3 py-1 mb-2"><strong>${top3[1].points}</strong> Points</div>
              </div>
            </div>
          ` : ""}

          ${top3[0] ? `
            <div class="col-md-4 order-1 order-md-2">
              <div class="card-glass podium-card podium-gold text-center p-4">
                <div class="crown-icon mb-1"><i class="fa-solid fa-crown text-warning fs-2"></i></div>
                <div class="podium-avatar-wrapper position-relative mx-auto mb-3">
                  ${this.renderCuteAvatar(top3[0], true)}
                  <span class="podium-rank-badge badge-gold">1</span>
                </div>
                <h4 class="fw-bold mb-1">${top3[0].name}</h4>
                <small class="text-muted d-block mb-2">${top3[0].department}</small>
                <div class="badge bg-warning text-dark px-3 py-1 mb-2 fs-6"><strong>${top3[0].points}</strong> Points</div>
              </div>
            </div>
          ` : ""}

          ${top3[2] ? `
            <div class="col-md-4 order-3 order-md-3">
              <div class="card-glass podium-card podium-bronze text-center p-4">
                <div class="podium-avatar-wrapper position-relative mx-auto mb-3">
                  ${this.renderCuteAvatar(top3[2])}
                  <span class="podium-rank-badge badge-bronze">3</span>
                </div>
                <h5 class="fw-bold mb-1">${top3[2].name}</h5>
                <small class="text-muted d-block mb-2">${top3[2].department}</small>
                <div class="badge bg-light text-dark border px-3 py-1 mb-2"><strong>${top3[2].points}</strong> Points</div>
              </div>
            </div>
          ` : ""}
        </div>

        <div class="card-glass p-4">
          <h5 class="fw-bold mb-3">🏅 Institutional Rankings</h5>
          <div class="table-responsive">
            <table class="table align-middle table-hover">
              <thead>
                <tr class="text-muted small">
                  <th>Rank</th>
                  <th>Student</th>
                  <th>USN</th>
                  <th>Department</th>
                  <th>Completed Tasks</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                ${studentsSorted.map((stu, index) => `
                  <tr>
                    <td>${index === 0 ? '🥇 #1' : (index === 1 ? '🥈 #2' : (index === 2 ? '🥉 #3' : `#${index + 1}`))}</td>
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        ${this.renderCuteAvatar(stu)}
                        <span>${stu.name}</span>
                      </div>
                    </td>
                    <td><code>${stu.usn}</code></td>
                    <td class="small text-muted">${stu.department}</td>
                    <td><span class="badge bg-light text-dark border">${stu.tasksCompletedCount || 0}</span></td>
                    <td><strong class="text-warning">${stu.points}</strong></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------
  // FACULTY DASHBOARD RENDERER (With Technical DL Code Review)
  // ----------------------------------------------------
  async loadFacultyPendingActivities() {
    const faculty = window.appState?.state?.currentUser;
    const apiBaseUrl = window.SDG_SUPABASE_CONFIG?.apiBaseUrl;
    if (!faculty || faculty.role === "student" || !apiBaseUrl) return;
    if (this.pendingActivitiesLoadedFor === faculty.id) return;
    this.pendingActivitiesLoadedFor = faculty.id;

    try {
      const response = await fetch(`${apiBaseUrl}/admin/activities/pending?refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Pending activity request failed (${response.status})`);
      const rows = await response.json();
      const remoteActivities = rows
        .filter(row => !row.department || row.department === faculty.department || row.department === "All Departments")
        .map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        goalId: row.sdgs?.[0] || 12,
        department: row.department || "All Departments",
        points: Math.max(100, Math.round(Number(row.hours || 4) * 30)),
        deadline: row.deadline || "Pending approval",
        status: row.approval_status === "rejected" ? "Rejected" : "Active",
        difficulty: row.difficulty || "intermediate",
        hours: row.hours,
        taskType: row.submission_type === "coding" ? "technical_dl_project" : "field_activity",
        aiAssigned: true,
        approvalPending: row.approval_status === "pending",
        approvalRejected: row.approval_status === "rejected",
        approval_status: row.approval_status,
        reviewerNote: row.reviewer_note || "",
        requestedBy: row.requested_by,
        requestedByName: row.requested_by_name || "Student",
        requestedByUsn: row.requested_by_usn || "",
        requestedByDepartment: row.requested_by_department || row.department || "",
        matchedSkills: row.matched_skills || [],
        whyItFits: row.why_it_fits,
        steps: row.steps || [],
        problemStatement: row.problem_statement || "",
        teachingGoals: row.teaching_goals || [],
        sdgRelation: row.sdg_relation || "",
        matchedInterests: row.matched_interests || [],
        requiredTools: row.required_tools || [],
        requirements: row.requirements || [],
        deliverables: row.deliverables || [],
        submissionInstructions: row.submission_instructions || "Submit the required project links and summary.",
        evaluationCriteria: row.evaluation_criteria || [],
        createdBy: "AI/RAG Recommendation Agent"
        }));
      const existing = window.appState.state.activities || [];
      const remoteIds = new Set(remoteActivities.map(item => item.id));
      window.appState.state.activities = [
        ...remoteActivities,
        ...existing.filter(item => !remoteIds.has(item.id))
      ];
      window.appState.save();
    } catch (error) {
      this.pendingActivitiesLoadedFor = null;
      console.error("Could not load AI approval queue", error);
    }
  }

  async loadFacultyRoster() {
    const faculty = window.appState?.state?.currentUser;
    const apiBaseUrl = window.SDG_SUPABASE_CONFIG?.apiBaseUrl;
    if (!faculty || !apiBaseUrl || this.facultyRosterLoadedFor === faculty.id) return;
    this.facultyRosterLoadedFor = faculty.id;
    try {
      const response = await fetch(`${apiBaseUrl}/admin/students?department=${encodeURIComponent(faculty.department)}&refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Student roster request failed (${response.status})`);
      const rows = await response.json();
      const department = String(faculty.department || "").trim().toLowerCase();
      window.appState.state.students = rows
        .filter(row => String(row.department || "").trim().toLowerCase() === department)
        .map(row => window.appState.profileToFrontend(row));
      window.appState.save();
    } catch (error) {
      this.facultyRosterLoadedFor = null;
      console.error("Could not load faculty department roster", error);
    }
  }

  async loadStudentActivities(student) {
    const apiBaseUrl = window.SDG_SUPABASE_CONFIG?.apiBaseUrl;
    if (!student?.id || !apiBaseUrl || this.studentActivitiesLoadedFor === student.id) return;
    this.studentActivitiesLoadedFor = student.id;
    try {
      const response = await fetch(`${apiBaseUrl}/activities/student/${encodeURIComponent(student.id)}?refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Student activities request failed (${response.status})`);
      const rows = await response.json();
      const remoteActivities = rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        goalId: row.sdgs?.[0] || 12,
        department: row.department || student.department,
        points: Math.max(100, Math.round(Number(row.hours || 4) * 30)),
        deadline: row.deadline || "Pending approval",
        status: row.approval_status === "rejected" ? "Rejected" : "Active",
        difficulty: row.difficulty || "intermediate",
        hours: row.hours,
        taskType: row.submission_type === "coding" ? "technical_dl_project" : "field_activity",
        aiAssigned: true,
        assignedToStudentId: student.id,
        approvalPending: row.approval_status === "pending",
        approvalRejected: row.approval_status === "rejected",
        approval_status: row.approval_status,
        reviewerNote: row.reviewer_note || "",
        whyItFits: row.why_it_fits,
        steps: row.steps || [],
        problemStatement: row.problem_statement || "",
        teachingGoals: row.teaching_goals || [],
        sdgRelation: row.sdg_relation || "",
        matchedSkills: row.matched_skills?.length ? row.matched_skills : (student.skills || []),
        matchedInterests: row.matched_interests || (student.interests || []),
        requiredTools: row.required_tools || [],
        requirements: row.requirements || [],
        deliverables: row.deliverables || [],
        submissionInstructions: row.submission_instructions || "Submit the required project links and summary.",
        evaluationCriteria: row.evaluation_criteria || [],
        createdBy: "AI/RAG Recommendation Agent"
      }));
      window.appState.state.activities = remoteActivities;
      window.appState.save();
    } catch (error) {
      this.studentActivitiesLoadedFor = null;
      console.error("Could not load current student activities", error);
    }
  }

  renderFacultyDashboard(state) {
    const faculty = state.currentUser || state.faculty[0];
    if (!faculty) return;

    const subPage = state.facultySubPage || "student-progress";

    document.querySelectorAll("[data-faculty-tab]").forEach(tab => {
      if (tab.getAttribute("data-faculty-tab") === subPage) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });

    const container = document.getElementById("faculty-subpage-container");
    if (!container) return;

    if (subPage === "student-progress") {
      this.renderFacultyProgressPage(container, faculty, state);
    } else {
      this.renderFacultyActivityCreationPage(container, faculty, state);
    }
  }

  renderFacultyProgressPage(container, faculty, state) {
    const submissions = state.submissions;
    const students = state.students;
    const pendingReviews = submissions.filter(s => ["submitted", "needs_changes"].includes(s.submissionStatus));
    const pendingActivities = (state.activities || []).filter(task =>
      task.approvalPending && (!task.department || task.department === faculty.department || task.department === "All Departments")
    ).map(task => {
      const assignedStudent = students.find(student => student.id === task.assignedToStudentId || student.id === task.requestedBy);
      return {
        ...task,
        requestedByName: task.requestedByName || assignedStudent?.name || "Student",
        requestedByUsn: task.requestedByUsn || assignedStudent?.usn || "",
        requestedByDepartment: task.requestedByDepartment || assignedStudent?.department || task.department
      };
    });
    const rosterCounts = students.reduce((counts, item) => {
      const status = item.workflowStatus || "not_started";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, { approved: 0, in_progress: 0, completed: 0, not_started: 0 });

    container.innerHTML = `
      <div class="faculty-progress-wrapper animate-fade-in">
        <div class="card-glass p-4 mb-4">
          <h5 class="fw-bold mb-3 d-flex align-items-center gap-2">
            <i class="fa-solid fa-wand-magic-sparkles text-primary"></i>
            AI Activities Awaiting Approval (${pendingActivities.length})
          </h5>
          ${pendingActivities.length === 0 ? `
            <p class="text-muted mb-0">No AI-generated activities are waiting for approval.</p>
          ` : `
            <div class="d-flex flex-column gap-3">
              ${pendingActivities.map(task => `
                <div class="p-3 rounded-3 bg-light border">
                  <div class="d-flex justify-content-between gap-3 flex-wrap">
                    <div>
                      <span class="badge bg-warning-soft text-dark mb-2">Pending Faculty Approval</span>
                      <h6 class="fw-bold mb-1">${task.title}</h6>
                      <p class="text-muted small mb-2">${task.description}</p>
                      <div class="mt-2 d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary btn-view-activity" data-task-id="${task.id}">
                          <i class="fa-solid fa-circle-info me-1"></i> View full activity
                        </button>
                        <button class="btn btn-sm btn-outline-secondary btn-edit-ai-activity" data-activity-id="${task.id}">
                          <i class="fa-solid fa-pen me-1"></i> Edit
                        </button>
                      </div>
                      <div class="small text-dark mt-2"><strong>Assigned student:</strong> ${task.requestedByName || "Student"} ${task.requestedByUsn ? `(<code>${task.requestedByUsn}</code>)` : ""}</div>
                      <div class="small text-dark"><strong>Student department:</strong> ${task.requestedByDepartment || task.department}</div>
                      <small class="text-muted">Department: <strong>${task.department}</strong> · SDG ${task.goalId}</small>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                      <button class="btn btn-sm btn-success btn-approve-ai-activity" data-activity-id="${task.id}">
                        <i class="fa-solid fa-check me-1"></i> Approve
                      </button>
                      <button class="btn btn-sm btn-outline-danger btn-reject-ai-activity" data-activity-id="${task.id}">
                        <i class="fa-solid fa-xmark me-1"></i> Reject
                      </button>
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          `}
        </div>

        <div class="row g-3 mb-4">
          ${[
            ["Approved", rosterCounts.approved, "text-primary", "fa-circle-check"],
            ["In Progress", rosterCounts.in_progress, "text-warning", "fa-spinner"],
            ["Completed", rosterCounts.completed, "text-success", "fa-trophy"],
            ["Not Started", rosterCounts.not_started, "text-secondary", "fa-hourglass-start"]
          ].map(([label, count, color, icon]) => `
            <div class="col-6 col-xl-3">
              <div class="card-glass p-3 h-100 border-start border-4">
                <div class="d-flex justify-content-between align-items-center">
                  <div><small class="text-muted d-block">${label}</small><strong class="fs-3 ${color}">${count}</strong></div>
                  <i class="fa-solid ${icon} ${color} fs-3"></i>
                </div>
              </div>
            </div>
          `).join("")}
        </div>

        <div class="card-glass p-4 mb-4">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <span class="badge bg-info-soft text-info px-3 py-1 mb-2 fw-bold">
                <i class="fa-solid fa-chalkboard-user me-1"></i> Faculty Portal
              </span>
              <h2 class="fw-bold mb-1">Welcome, ${faculty.name}</h2>
              <p class="text-muted mb-0">${faculty.designation} • <strong>${faculty.department}</strong></p>
            </div>
            <div class="d-flex gap-3">
              <div class="metric-card p-3 rounded-3 bg-light border text-center">
                <small class="text-muted d-block">Pending Reviews</small>
                <strong class="fs-4 ${pendingReviews.length > 0 ? 'text-danger' : 'text-success'}">${pendingReviews.length}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- Human-In-The-Loop AI Review Queue (Supports Technical DL Code & Loss Curves) -->
        <div class="card-glass p-4 mb-4">
          <h5 class="fw-bold mb-3 d-flex align-items-center gap-2">
            <i class="fa-solid fa-shield-halved text-warning"></i> Human-In-The-Loop Technical Review Queue (${pendingReviews.length})
          </h5>

          ${pendingReviews.length === 0 ? `
            <div class="text-center py-4 text-muted">
              <i class="fa-solid fa-circle-check fs-1 mb-2 text-success"></i>
              <p class="mb-0">All student submissions are currently reviewed!</p>
            </div>
          ` : `
            <div class="review-queue-list d-flex flex-column gap-3">
              ${pendingReviews.map(item => {
                const isDl = item.taskType === "technical_dl_project";
                return `
                  <div class="review-queue-item p-4 rounded-4 bg-light border">
                    <div class="row g-3">
                      <div class="col-md-4">
                        <div class="p-4 rounded-3 bg-light border text-center text-muted h-100 d-flex flex-column justify-content-center">
                          <i class="fa-solid fa-file-circle-check fs-2 mb-2"></i>
                          <small>${isDl ? "Coding evidence attached" : "Activity evidence attached"}</small>
                        </div>
                      </div>

                      <div class="col-md-4">
                        <span class="badge ${isDl ? 'bg-primary text-white' : 'bg-warning-soft text-dark'} mb-2">
                        ${isDl ? '💻 Coding Activity Submission' : `SDG ${item.sdgGoalId} Field Activity`}
                        </span>
                        <h6 class="fw-bold mb-1">${item.taskTitle}</h6>
                        <p class="text-muted small mb-2">${item.impactSummary}</p>
                        
                        <div class="small text-muted mb-2">
                          <div><strong>Student:</strong> ${item.studentName} (<code>${item.usn}</code>)</div>
                          <div><strong>Submitted:</strong> ${item.submittedAt}</div>
                        </div>

                        ${isDl && item.githubRepoUrl ? `
                          <div class="d-flex gap-2 flex-wrap">
                            <a href="${item.githubRepoUrl}" target="_blank" class="btn btn-sm btn-dark">
                              <i class="fa-brands fa-github me-1"></i> Inspect GitHub Code
                            </a>
                            ${item.colabNotebookUrl ? `
                              <a href="${item.colabNotebookUrl}" target="_blank" class="btn btn-sm btn-outline-warning">
                                <i class="fa-solid fa-code me-1"></i> Colab
                              </a>
                            ` : ""}
                          </div>
                        ` : ""}
                      </div>

                      <div class="col-md-4 border-start-md">
                        <div class="p-3 bg-white rounded-3 border mb-3">
                          <small class="fw-bold text-muted d-block mb-1">Submission status</small>
                          <span class="badge bg-warning-soft text-dark">${item.submissionStatus}</span>
                          ${item.verification ? `
                            <small class="d-block mt-2"><strong>Automated checks:</strong> ${item.verification.status || "needs_review"}</small>
                            <small class="text-muted d-block">${item.verification.aiExplanation || "Basic evidence checks were completed."}</small>
                          ` : ""}
                          <small class="text-dark d-block mt-2">Faculty review is required before points are awarded.</small>
                        </div>

                        <div class="mb-2">
                          <label class="form-label small fw-bold mb-1">Marks (0–100)</label>
                          <input type="number" class="form-control form-control-sm faculty-marks-input" data-sub-id="${item.id}" min="0" max="100" step="1" value="100">
                        </div>
                        <div class="d-flex gap-2">
                          <button class="btn btn-sm btn-success flex-grow-1 btn-faculty-approve" data-sub-id="${item.id}">
                            <i class="fa-solid fa-check me-1"></i> Approve & Save Marks
                          </button>
                          <button class="btn btn-sm btn-danger flex-grow-1 btn-faculty-reject" data-sub-id="${item.id}">
                            <i class="fa-solid fa-xmark me-1"></i> Request Refactor
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          `}
        </div>

        <!-- Student Roster -->
        <div class="card-glass p-4">
          <h5 class="fw-bold mb-3">👥 Department Students Progress Roster</h5>
          <div class="table-responsive">
            <table class="table align-middle table-hover">
              <thead>
                <tr class="text-muted small">
                  <th>Student Name</th>
                  <th>USN</th>
                  <th>Department</th>
                  <th>Ongoing Tasks</th>
                  <th>Completed</th>
                  <th>Points</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${students.map(stu => `
                  <tr>
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        <strong>${stu.name}</strong>
                      </div>
                    </td>
                    <td><code>${stu.usn}</code></td>
                    <td class="small text-muted">${stu.department}</td>
                    <td><span class="badge bg-warning-soft text-dark">${stu.ongoingTasksCount || 0}</span></td>
                    <td><span class="badge bg-success-soft text-success">${stu.tasksCompletedCount || 0}</span></td>
                    <td><strong class="text-warning">${stu.points || 0}</strong></td>
                    <td>
                      <button class="btn btn-sm btn-outline-primary btn-assign-student-direct" data-student-id="${stu.id}">
                        Assign Task
                      </button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll(".btn-faculty-approve").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-sub-id");
        const marksInput = container.querySelector(`.faculty-marks-input[data-sub-id="${id}"]`);
        const marks = Number(marksInput?.value);
        if (!Number.isInteger(marks) || marks < 0 || marks > 100) {
          alert("Enter marks between 0 and 100.");
          return;
        }
        await window.appState.reviewSubmission(id, "approve", `Approved by Faculty Mentor. Marks: ${marks}/100`, marks);
        alert("✅ Submission Approved! SDG Points credited to student.");
      });
    });

    container.querySelectorAll(".btn-faculty-reject").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-sub-id");
        const reason = prompt("Enter feedback or request for code refactoring:", "Please adjust hyperparameter learning rate to improve loss curve convergence.");
        if (reason !== null) {
          window.appState.reviewSubmission(id, "reject", reason);
          alert("Marked for revision.");
        }
      });
    });

    const reviewAiActivity = async (activityId, approved) => {
      let note = "Approved by faculty.";
      if (!approved) {
        note = await this.requestFacultyRejectionNote();
        if (note === null || !note.trim()) return;
        note = note.trim();
      }
      try {
        const response = await fetch(`${window.SDG_SUPABASE_CONFIG.apiBaseUrl}/admin/activities/${activityId}/approval`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved, reviewer_note: note })
        });
        if (!response.ok) throw new Error(`Approval update failed (${response.status})`);
        const task = window.appState.state.activities.find(item => item.id === activityId);
        if (task) {
          task.approvalPending = false;
          task.approvalRejected = !approved;
          task.approval_status = approved ? "approved" : "rejected";
          task.status = approved ? "Active" : "Rejected";
          task.reviewerNote = note;
        }
        window.appState.save();
        this.pendingActivitiesLoadedFor = null;
        await window.sdgNotify(approved ? "The AI activity is now approved." : "The AI activity was rejected.", { kind: approved ? "success" : "warning" });
      } catch (error) {
        await window.sdgNotify(error.message || "The approval update could not be saved.", { kind: "error" });
      }
    };

    container.querySelectorAll(".btn-approve-ai-activity").forEach(btn => {
      btn.addEventListener("click", () => reviewAiActivity(btn.dataset.activityId, true));
    });
    container.querySelectorAll(".btn-reject-ai-activity").forEach(btn => {
      btn.addEventListener("click", () => reviewAiActivity(btn.dataset.activityId, false));
    });

    container.querySelectorAll(".btn-assign-student-direct").forEach(btn => {
      btn.addEventListener("click", () => {
        const stuId = btn.getAttribute("data-student-id");
        const targetStudent = students.find(s => s.id === stuId);
        const dynamicTask = window.sdgAiEngine.generateDynamicTaskForStudent(targetStudent);
        window.appState.state.activities.unshift(dynamicTask);
        window.appState.assignTaskToStudent(dynamicTask.id, stuId);
        alert(`🌟 Task "${dynamicTask.title}" directly assigned to ${targetStudent.name}!`);
      });
    });
    container.querySelectorAll(".btn-view-activity").forEach(btn => {
      btn.addEventListener("click", () => this.openActivityDetailModal(btn.getAttribute("data-task-id")));
    });
    container.querySelectorAll(".btn-edit-ai-activity").forEach(btn => {
      btn.addEventListener("click", () => this.openActivityEditModal(btn.getAttribute("data-activity-id")));
    });
  }

  // Faculty Page 2: Activity Creation & Management
  renderFacultyActivityCreationPage(container, faculty, state) {
    const activities = state.activities || [];

    container.innerHTML = `
      <div class="activity-creation-wrapper animate-fade-in">
        <div class="row g-4">
          <!-- Left Column: Create or Edit Activity -->
          <div class="col-lg-6">
            <div class="card-glass p-4 h-100">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold mb-0" id="activity-form-title">✍️ Publish New SDG Activity / Project</h5>
                <button class="btn btn-sm btn-outline-primary" id="btn-generate-ai-ideas">
                  <i class="fa-solid fa-wand-magic-sparkles me-1"></i> AI Idea Generator
                </button>
              </div>

              <form id="form-faculty-create-activity">
                <input type="hidden" id="edit-task-id" value="" />

                <div class="mb-3">
                  <label class="form-label small fw-bold">Task Type</label>
                  <select id="new-task-type" class="form-select form-select-sm">
                    <option value="technical_dl_project">🔬 Technical / Coding Project</option>
                    <option value="field_activity">🌱 Field Sustainability Activity</option>
                  </select>
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-bold">Title</label>
                  <input type="text" id="new-task-title" class="form-control form-control-sm" placeholder="e.g. YOLOv8 Waste Classifier" required />
                </div>

                <div class="row g-2 mb-3">
                  <div class="col-md-6">
                    <label class="form-label small fw-bold">SDG Goal</label>
                    <select id="new-task-goal" class="form-select form-select-sm" required>
                      ${window.SDG_DATA.goals.map(g => `<option value="${g.id}">SDG ${g.id}: ${g.shortName}</option>`).join("")}
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label small fw-bold">Target Department</label>
                    <select id="new-task-dept" class="form-select form-select-sm">
                      <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                      <option value="Artificial Intelligence & ML">Artificial Intelligence & ML</option>
                      <option value="Electronics & Communication Eng">Electronics & Communication Eng</option>
                      <option value="Electrical & Electronics Eng">Electrical & Electronics Eng</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil & Environmental Eng">Civil & Environmental Eng</option>
                      <option value="All Departments">All Departments</option>
                    </select>
                  </div>
                </div>

                <div class="row g-2 mb-3">
                  <div class="col-md-6">
                    <label class="form-label small fw-bold">Points</label>
                    <input type="number" id="new-task-points" class="form-control form-control-sm" value="300" min="50" max="500" required />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label small fw-bold">Deadline</label>
                    <input type="date" id="new-task-deadline" class="form-control form-control-sm" value="2026-09-30" required />
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-bold">Description</label>
                  <textarea id="new-task-desc" class="form-control form-control-sm" rows="3" placeholder="Describe the technical project or campus action..." required></textarea>
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-bold">Verification Rules</label>
                  <input type="text" id="new-task-rules" class="form-control form-control-sm" placeholder="Submit GitHub repo and loss curve plot" required />
                </div>

                <div class="d-flex gap-2">
                  <button type="submit" class="btn btn-primary flex-grow-1 py-2 fw-bold" id="btn-submit-activity-form">
                    <i class="fa-solid fa-plus-circle me-1"></i> Publish Activity
                  </button>
                  <button type="button" class="btn btn-outline-secondary d-none" id="btn-cancel-edit-activity">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- Right Column: Manage, Edit & Delete Published Activities -->
          <div class="col-lg-6">
            <div class="card-glass p-4 h-100">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold mb-0">📑 Published Activities (${activities.length})</h5>
                <span class="badge bg-light text-muted small">Live In Catalog</span>
              </div>

              ${activities.length === 0 ? `
                <div class="text-center py-5 text-muted border rounded-3 bg-light">
                  <i class="fa-solid fa-clipboard-list fs-2 mb-2 opacity-50"></i>
                  <h6 class="fw-bold mb-1">No Activities in Catalog</h6>
                  <p class="small text-muted mb-0">Publish an activity using the form on the left or click "AI Idea Generator" to seed one.</p>
                </div>
              ` : `
                <div class="activities-manage-list d-flex flex-column gap-3" style="max-height: 540px; overflow-y: auto;">
                  ${activities.map(task => `
                    <div class="manage-task-item p-3 rounded-3 bg-light border d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <div style="max-width: 60%;">
                        <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                          <span class="badge ${task.taskType === 'technical_dl_project' ? 'bg-primary text-white' : 'bg-light text-dark border'}">
                            ${task.taskType === 'technical_dl_project' ? 'Coding Activity' : `SDG ${task.goalId}`}
                          </span>
                          <span class="badge ${task.status === 'Active' ? 'bg-success-soft text-success' : 'bg-secondary-soft text-secondary'}">
                            ${task.status}
                          </span>
                          <strong class="text-truncate d-block">${task.title}</strong>
                        </div>
                        <small class="text-muted d-block">Points: +${task.points} • ${task.department}</small>
                      </div>

                      <div class="d-flex align-items-center gap-1 flex-wrap">
                        <button class="btn btn-sm btn-outline-primary btn-edit-activity" data-task-id="${task.id}" title="Edit Activity">
                          <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                        <button class="btn btn-sm ${task.status === 'Active' ? 'btn-outline-warning' : 'btn-outline-success'} btn-toggle-activity" data-task-id="${task.id}" title="Toggle Active">
                          ${task.status === 'Active' ? 'Pause' : 'Activate'}
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-delete-activity" data-task-id="${task.id}" title="Delete Activity">
                          <i class="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  `).join("")}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    const createForm = document.getElementById("form-faculty-create-activity");
    const editTaskIdInput = document.getElementById("edit-task-id");
    const formTitle = document.getElementById("activity-form-title");
    const submitBtn = document.getElementById("btn-submit-activity-form");
    const cancelEditBtn = document.getElementById("btn-cancel-edit-activity");

    function resetFormToCreate() {
      if (editTaskIdInput) editTaskIdInput.value = "";
      if (formTitle) formTitle.textContent = "✍️ Publish New SDG Activity / Project";
      if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-plus-circle me-1"></i> Publish Activity`;
      if (cancelEditBtn) cancelEditBtn.classList.add("d-none");
      createForm?.reset();
    }

    cancelEditBtn?.addEventListener("click", resetFormToCreate);

    if (createForm) {
      createForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const editId = editTaskIdInput.value.trim();
        const title = document.getElementById("new-task-title").value.trim();
        const goalId = document.getElementById("new-task-goal").value;
        const dept = document.getElementById("new-task-dept").value;
        const points = parseInt(document.getElementById("new-task-points").value, 10);
        const deadline = document.getElementById("new-task-deadline").value;
        const desc = document.getElementById("new-task-desc").value.trim();
        const rules = document.getElementById("new-task-rules").value.trim();
        const taskType = document.getElementById("new-task-type").value;

        if (editId) {
          window.appState.editActivity(editId, {
            title, goalId: parseInt(goalId, 10), department: dept, points, deadline,
            description: desc, verificationRules: rules, taskType
          });
          alert("✅ Activity updated successfully!");
          resetFormToCreate();
        } else {
          window.appState.createActivity({
            title, goalId: parseInt(goalId, 10), department: dept, points, deadline,
            description: desc, verificationRules: rules,
            taskType: taskType, status: "Active"
          });
          alert("🎉 Activity published successfully to task catalog!");
          resetFormToCreate();
        }
      });
    }

    container.querySelectorAll(".btn-edit-activity").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-task-id");
        const task = activities.find(t => t.id === id);
        if (!task) return;

        editTaskIdInput.value = task.id;
        document.getElementById("new-task-title").value = task.title;
        document.getElementById("new-task-goal").value = task.goalId;
        document.getElementById("new-task-dept").value = task.department;
        document.getElementById("new-task-points").value = task.points;
        document.getElementById("new-task-deadline").value = task.deadline;
        document.getElementById("new-task-desc").value = task.description;
        document.getElementById("new-task-rules").value = task.verificationRules || "";
        document.getElementById("new-task-type").value = task.taskType || "field_activity";

        formTitle.textContent = `✏️ Edit Activity: ${task.title}`;
        submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk me-1"></i> Save & Update Activity`;
        cancelEditBtn.classList.remove("d-none");
        document.getElementById("new-task-title").focus();
      });
    });

    container.querySelectorAll(".btn-toggle-activity").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-task-id");
        window.appState.toggleActivityStatus(id);
      });
    });

    container.querySelectorAll(".btn-delete-activity").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-task-id");
        if (confirm("Are you sure you want to delete this activity? This will remove it from the catalog.")) {
          window.appState.deleteActivity(id);
        }
      });
    });

    const aiIdeasBtn = document.getElementById("btn-generate-ai-ideas");
    if (aiIdeasBtn) {
      aiIdeasBtn.addEventListener("click", () => {
        const goalId = document.getElementById("new-task-goal").value;
        const dept = document.getElementById("new-task-dept").value;
        const ideas = window.sdgAiEngine.generateFacultyTaskIdeas(goalId, dept);
        const chosen = ideas[Math.floor(Math.random() * ideas.length)];

        document.getElementById("new-task-title").value = chosen.title;
        document.getElementById("new-task-points").value = chosen.points;
        document.getElementById("new-task-desc").value = chosen.description;
        document.getElementById("new-task-rules").value = chosen.verificationRules;
        if (chosen.taskType) document.getElementById("new-task-type").value = chosen.taskType;
        alert("✨ AI populated form with high-impact task idea aligned to the selected SDG!");
      });
    }
  }

  // ----------------------------------------------------
  // Separate Coding and Field Work submission flows
  // ----------------------------------------------------
  setupSubmissionModal() {
    const modalEl = document.getElementById("evidenceSubmissionModal");
    if (!modalEl) return;

    const form = document.getElementById("form-evidence-submit");
    const taskSelect = document.getElementById("submission-task-select");
    const codingSection = document.getElementById("coding-submission-fields");
    const fieldSection = document.getElementById("field-activity-submission-fields");
    const codingImageInput = document.getElementById("evidence-image-file");
    const fieldImageInput = document.getElementById("field-evidence-image-file");
    const aiAnalysisBox = document.getElementById("ai-analysis-output");

    if (taskSelect) {
      taskSelect.addEventListener("change", () => {
        const taskId = taskSelect.value;
        const task = window.appState.state.activities.find(t => t.id === taskId);
        const isCoding = task && task.taskType === "technical_dl_project";

        if (codingSection && fieldSection) {
          if (isCoding) {
            codingSection.classList.remove("d-none");
            fieldSection.classList.add("d-none");
          } else {
            codingSection.classList.add("d-none");
            fieldSection.classList.remove("d-none");
          }
        }
      });
    }

    document.getElementById("btn-capture-location")?.addEventListener("click", () => {
      const locationInput = document.getElementById("submission-location");
      if (!navigator.geolocation) {
        alert("Geolocation is not available in this browser.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        position => { locationInput.value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`; },
        () => alert("Location permission was not granted. Enter the campus location manually.")
      );
    });

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const taskId = taskSelect.value;
        const task = window.appState.state.activities.find(t => t.id === taskId);
        const isCoding = task && task.taskType === "technical_dl_project";

        const impact = document.getElementById("submission-impact-summary").value.trim();
        const milestoneIndex = parseInt(document.getElementById("submission-milestone-select")?.value || 1, 10);
        const githubRepoUrl = document.getElementById("submission-github-url")?.value.trim() || "";
        const colabNotebookUrl = "";
        const modelAccuracy = "";
        const liveDemoUrl = document.getElementById("submission-demo-url")?.value.trim() || "";
        const location = document.getElementById("submission-location")?.value.trim() || "Campus Grounds";
        const activityName = document.getElementById("submission-activity-name")?.value.trim() || task?.title || "Field activity";
        const file = (isCoding ? codingImageInput : fieldImageInput)?.files[0] || null;

        if (isCoding && (!githubRepoUrl || !githubRepoUrl.includes("github.com/"))) {
          alert("Add a valid GitHub repository URL before submitting.");
          return;
        }
        if (!isCoding && !file) {
          alert("Add a proof photo before submitting the field activity.");
          return;
        }

        const submitBtn = form.querySelector("button[type='submit']");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-2"></i> ${isCoding ? 'Checking Coding Submission...' : 'Checking Field Evidence...'}`;
        }

        if (aiAnalysisBox) {
          aiAnalysisBox.classList.remove("d-none");
          aiAnalysisBox.innerHTML = `
            <div class="p-3 bg-light rounded-3 border text-center">
              <div class="spinner-border spinner-border-sm text-primary mb-2"></div>
              <p class="small text-muted mb-0">${isCoding ? 'Checking GitHub repository and screenshot...' : 'Checking proof photo and location evidence...'}</p>
            </div>
          `;
        }

        const verification = await window.sdgAiEngine.analyzeSubmissionEvidence(file, task, {
          taskType: task ? task.taskType : "field_activity",
          milestoneIndex: milestoneIndex,
          githubRepoUrl: githubRepoUrl,
          modelAccuracy: modelAccuracy,
          location: location
        });

        window.appState.addSubmission({
          taskId: taskId,
          impactSummary: impact,
          taskTitle: isCoding ? task?.title : activityName,
          activityName: activityName,
          taskType: isCoding ? "technical_dl_project" : "field_activity",
          milestoneIndex: milestoneIndex,
          githubRepoUrl: githubRepoUrl,
          colabNotebookUrl: colabNotebookUrl,
          modelMetricsSummary: { accuracy: modelAccuracy },
          liveDemoUrl: liveDemoUrl,
          location: location,
          imageUrl: null,
          trainingLossPlotUrl: null,
          verification: verification
        });

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i class="fa-solid fa-check me-2"></i> Deliverables Submitted`;
        }

        if (aiAnalysisBox) {
          aiAnalysisBox.innerHTML = `
            <div class="p-3 rounded-3 border bg-success-soft border-success animate-fade-in">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <strong class="text-success">🎉 ${isCoding ? 'Coding Submission Received' : 'Field Evidence Received'}</strong>
                <span class="badge bg-success text-white">Certainty: ${verification.aiConfidence}%</span>
              </div>
              <p class="small mb-1">${verification.aiExplanation}</p>
              <small class="text-muted d-block">${verification.metadataIntegrity}</small>
              <div class="alert alert-info py-1 mb-0 mt-2 small text-center">
                ${isCoding ? 'GitHub repository and screenshot sent for review.' : 'Field activity evidence sent for review.'}
              </div>
            </div>
          `;
        }

        setTimeout(() => {
          if (window.bootstrap && modalEl) {
            const bsModal = window.bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
          }
          window.appState.setStudentSubPage("progress");
        }, 3000);
      });
    }
  }

  // Part 1 submission flow: collect only the requested project fields.
  // This later class method intentionally overrides the legacy evidence
  // handler above while keeping the existing visual modal layout intact.
  setupSubmissionModal() {
    const modalEl = document.getElementById("evidenceSubmissionModal");
    const form = document.getElementById("form-evidence-submit");
    const taskSelect = document.getElementById("submission-task-select");
    if (!modalEl || !form || !taskSelect) return;

    const codingSection = document.getElementById("coding-submission-fields");
    const fieldSection = document.getElementById("field-activity-submission-fields");
    const analysisBox = document.getElementById("ai-analysis-output");

    const updateSubmissionType = () => {
      const task = window.appState.state.activities.find(item => item.id === taskSelect.value);
      const isCoding = task?.taskType === "technical_dl_project";
      codingSection?.classList.toggle("d-none", !isCoding);
      fieldSection?.classList.toggle("d-none", isCoding);
      document.getElementById("submission-github-url")?.toggleAttribute("required", isCoding);
      document.getElementById("field-evidence-image-file")?.toggleAttribute("required", !isCoding);
    };

    taskSelect.addEventListener("change", updateSubmissionType);
    document.getElementById("btn-capture-location")?.addEventListener("click", () => {
      const locationInput = document.getElementById("submission-location");
      if (!navigator.geolocation) {
        alert("Geolocation is not available in this browser.");
        return;
      }
      locationInput.value = "Capturing location...";
      navigator.geolocation.getCurrentPosition(
        position => {
          locationInput.value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
        },
        () => {
          locationInput.value = "";
          alert("Location permission was not granted. GPS is required for field verification.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const task = window.appState.state.activities.find(item => item.id === taskSelect.value);
      const isCoding = task?.taskType === "technical_dl_project";
      const githubRepoUrl = document.getElementById("submission-github-url")?.value.trim() || "";
      const liveDemoUrl = document.getElementById("submission-demo-url")?.value.trim() || "";
      const notebookUrl = document.getElementById("submission-notebook-url")?.value.trim() || "";
      const projectSummary = document.getElementById("submission-impact-summary")?.value.trim() || "";
      const fieldImage = document.getElementById("field-evidence-image-file")?.files?.[0] || null;
      const locationText = document.getElementById("submission-location")?.value.trim() || "";
      const locationParts = locationText.split(",").map(value => Number(value.trim()));
      if (!task || !projectSummary) {
        alert("Select an activity and enter a project summary.");
        return;
      }
      if (isCoding && !githubRepoUrl) {
        alert("Add the GitHub repository URL before submitting.");
        return;
      }
      if (!isCoding && (!fieldImage || locationParts.length !== 2 || locationParts.some(value => !Number.isFinite(value)))) {
        alert("Upload a proof photo and capture your GPS location before submitting.");
        return;
      }

      const submitBtn = form.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Checking evidence...';
      }
      analysisBox?.classList.remove("d-none");
      if (analysisBox) analysisBox.innerHTML = '<div class="alert alert-info py-2 small mb-0">Running basic evidence checks...</div>';
      try {
        const verification = isCoding
          ? await window.sdgAiEngine.verifyGitHubRepository(githubRepoUrl)
          : await window.sdgAiEngine.verifyFieldEvidence(fieldImage, {
              latitude: locationParts[0],
              longitude: locationParts[1]
            });
        const submissionStatus = verification.status === "rejected" ? "needs_changes" : "submitted";
        window.appState.addSubmission({
          taskId: task.id,
          taskTitle: task.title,
          activityName: task.title,
          taskType: task.taskType || "field_activity",
          githubRepoUrl,
          colabNotebookUrl: notebookUrl,
          liveDemoUrl,
          impactSummary: projectSummary,
          location: isCoding ? null : locationText,
          imageUrl: isCoding ? null : fieldImage?.name || null,
          verification,
          submissionStatus
        });
        if (analysisBox) {
          const rejected = verification.status === "rejected";
          analysisBox.innerHTML = `
            <div class="alert ${rejected ? "alert-warning" : "alert-success"} py-2 small mb-0">
              <strong>${rejected ? "Evidence needs changes" : "Evidence checks completed"}</strong>
              <div>${verification.aiExplanation}</div>
              <div class="text-muted mt-1">${verification.metadataIntegrity}</div>
              <div class="mt-1">Final decision: Faculty review required.</div>
            </div>`;
        }
        await window.sdgNotify(
          verification.status === "rejected"
            ? "The evidence was saved and marked as needing changes."
            : "Your evidence was received and is waiting for faculty review.",
          {
            kind: verification.status === "rejected" ? "warning" : "success",
            title: verification.status === "rejected" ? "Evidence needs changes" : "Submission submitted"
          }
        );
        if (verification.status === "rejected") {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-rotate-left me-1"></i> Try Again';
          }
          return;
        }
        window.bootstrap?.Modal.getInstance(modalEl)?.hide();
        window.appState.setStudentSubPage("progress");
      } catch (error) {
        if (analysisBox) analysisBox.innerHTML = `<div class="alert alert-danger py-2 small mb-0">Evidence check failed: ${error.message}</div>`;
        await window.sdgNotify(error.message || "Evidence verification failed.", {
          kind: "error", title: "Verification failed"
        });
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          if (submitBtn.innerHTML.includes("Checking")) {
            submitBtn.innerHTML = '<i class="fa-solid fa-check me-2"></i> Verify & Submit';
          }
        }
      }
    });
  }

  openSubmissionModal(preselectedTaskId = null) {
    const modalEl = document.getElementById("evidenceSubmissionModal");
    const taskSelect = document.getElementById("submission-task-select");
    const aiAnalysisBox = document.getElementById("ai-analysis-output");
    const codingSection = document.getElementById("coding-submission-fields");
    const fieldSection = document.getElementById("field-activity-submission-fields");

    if (aiAnalysisBox) aiAnalysisBox.classList.add("d-none");

    if (taskSelect) {
      taskSelect.innerHTML = `
        <option value="">-- Select an AI-Assigned Activity --</option>
        ${window.appState.state.activities.filter(a => a.status === "Active").map(t => `
          <option value="${t.id}" ${preselectedTaskId === t.id ? "selected" : ""}>
            [${t.taskType === 'technical_dl_project' ? '💻 Coding' : '🌱 Field Work'}] ${t.title} (+${t.points} pts)
          </option>
        `).join("")}
      `;

      const chosenTask = window.appState.state.activities.find(t => t.id === (preselectedTaskId || taskSelect.value));
      const isCoding = chosenTask && chosenTask.taskType === "technical_dl_project";
      if (codingSection && fieldSection) {
        if (isCoding) {
          codingSection.classList.remove("d-none");
          fieldSection.classList.add("d-none");
        } else {
          codingSection.classList.add("d-none");
          fieldSection.classList.remove("d-none");
        }
      }
      document.getElementById("submission-github-url")?.toggleAttribute("required", Boolean(isCoding));
      document.getElementById("field-evidence-image-file")?.toggleAttribute("required", !isCoding);
    }

    if (modalEl && window.bootstrap) {
      const modal = new window.bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  openGoalDetailModal(goalId) {
    const goal = window.SDG_DATA.goals.find(g => g.id === goalId);
    if (!goal) return;

    const modalTitle = document.getElementById("goalModalTitle");
    const modalBody = document.getElementById("goalModalBody");
    const modalHeader = document.getElementById("goalModalHeader");

    if (modalHeader) {
      modalHeader.style.background = goal.color;
      modalHeader.style.color = "#ffffff";
    }

    if (modalTitle) {
      modalTitle.innerHTML = `<i class="${goal.icon} me-2"></i> SDG ${goal.number}: ${goal.name}`;
    }

    if (modalBody) {
      modalBody.innerHTML = `
        <div class="goal-modal-content">
          <div class="p-3 mb-3 rounded-3 bg-light border">
            <h6 class="fw-bold mb-1 text-dark">Global Vision:</h6>
            <p class="text-muted small mb-0">${goal.vision}</p>
          </div>
          <h6 class="fw-bold mb-2">🎯 Key UN Targets:</h6>
          <ul class="small text-muted mb-3">
            ${goal.keyTargets.map(t => `<li class="mb-1">${t}</li>`).join("")}
          </ul>
          <div class="p-3 mb-3 rounded-3 bg-light border">
            <h6 class="fw-bold mb-1 text-success"><i class="fa-solid fa-leaf me-1"></i> Campus Action & Technical Projects:</h6>
            <p class="text-muted small mb-0">${goal.campusImpact}</p>
          </div>
        </div>
      `;
    }

    const modalEl = document.getElementById("goalDetailModal");
    if (modalEl && window.bootstrap) {
      const modal = new window.bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  requestFacultyRejectionNote() {
    const modalEl = document.getElementById("facultyRejectActivityModal");
    const form = document.getElementById("faculty-reject-activity-form");
    const noteField = document.getElementById("faculty-rejection-note");
    if (!modalEl || !form || !noteField || !window.bootstrap) {
      return Promise.resolve(null);
    }
    noteField.value = "";
    return new Promise(resolve => {
      let finished = false;
      const modal = new window.bootstrap.Modal(modalEl);
      const finish = value => {
        if (finished) return;
        finished = true;
        form.removeEventListener("submit", onSubmit);
        modalEl.removeEventListener("hidden.bs.modal", onHidden);
        modal.hide();
        resolve(value);
      };
      const onSubmit = event => {
        event.preventDefault();
        const note = noteField.value.trim();
        if (!note) {
          noteField.classList.add("is-invalid");
          noteField.focus();
          return;
        }
        noteField.classList.remove("is-invalid");
        finish(note);
      };
      const onHidden = () => finish(null);
      form.addEventListener("submit", onSubmit);
      modalEl.addEventListener("hidden.bs.modal", onHidden);
      modal.show();
      window.setTimeout(() => noteField.focus(), 250);
    });
  }

  async openActivityEditModal(activityId) {
    const activity = window.appState.state.activities.find(item => item.id === activityId);
    const modalEl = document.getElementById("activityDetailModal");
    const titleEl = document.getElementById("activityDetailTitle");
    const bodyEl = document.getElementById("activityDetailBody");
    const apiBaseUrl = window.SDG_SUPABASE_CONFIG?.apiBaseUrl;
    if (!activity || !modalEl || !bodyEl) return;

    const lines = value => Array.isArray(value) ? value.join("\n") : (value || "");
    if (titleEl) titleEl.textContent = `Edit activity: ${activity.title}`;
    bodyEl.innerHTML = `
      <form id="faculty-activity-edit-form" class="row g-3">
        <div class="col-12"><label class="form-label small fw-bold">Title</label><input class="form-control" name="title" value="${activity.title || ""}" required></div>
        <div class="col-12"><label class="form-label small fw-bold">Description</label><textarea class="form-control" name="description" rows="3" required>${activity.description || ""}</textarea></div>
        <div class="col-12"><label class="form-label small fw-bold">Problem statement</label><textarea class="form-control" name="problem_statement" rows="2">${activity.problemStatement || ""}</textarea></div>
        <div class="col-md-6"><label class="form-label small fw-bold">Difficulty</label><select class="form-select" name="difficulty"><option ${activity.difficulty === "beginner" ? "selected" : ""}>beginner</option><option ${activity.difficulty === "intermediate" ? "selected" : ""}>intermediate</option><option ${activity.difficulty === "advanced" ? "selected" : ""}>advanced</option></select></div>
        <div class="col-md-6"><label class="form-label small fw-bold">Hours</label><input class="form-control" type="number" name="hours" min="0.5" max="40" step="0.5" value="${activity.hours || 4}" required></div>
        ${[
          ["teaching_goals", "Teaching goals", activity.teachingGoals],
          ["requirements", "Prerequisites", activity.requirements],
          ["required_tools", "Tools", activity.requiredTools],
          ["steps", "Steps", activity.steps],
          ["deliverables", "Deliverables", activity.deliverables],
          ["evaluation_criteria", "Evaluation criteria", activity.evaluationCriteria]
        ].map(([name, label, value]) => `<div class="col-md-6"><label class="form-label small fw-bold">${label} <span class="fw-normal text-muted">(one item per line)</span></label><textarea class="form-control" name="${name}" rows="4">${lines(value)}</textarea></div>`).join("")}
        <div class="col-12"><label class="form-label small fw-bold">SDG relation</label><textarea class="form-control" name="sdg_relation" rows="2">${activity.sdgRelation || ""}</textarea></div>
        <div class="col-12"><label class="form-label small fw-bold">Submission instructions</label><textarea class="form-control" name="submission_instructions" rows="2">${activity.submissionInstructions || ""}</textarea></div>
        <div class="col-12 d-flex justify-content-end gap-2"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk me-1"></i> Save changes</button></div>
      </form>`;

    const form = document.getElementById("faculty-activity-edit-form");
    form?.addEventListener("submit", async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const arrayFields = ["teaching_goals", "requirements", "required_tools", "steps", "deliverables", "evaluation_criteria"];
      const changes = {};
      for (const [key, value] of formData.entries()) {
        changes[key] = arrayFields.includes(key)
          ? String(value).split(/\r?\n/).map(item => item.trim()).filter(Boolean)
          : String(value).trim();
      }
      changes.hours = Number(changes.hours);
      try {
        let saved = changes;
        if (apiBaseUrl && activity.id) {
          const response = await fetch(`${apiBaseUrl}/admin/activities/${encodeURIComponent(activity.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(changes)
          });
          if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || `Activity update failed (${response.status})`);
          saved = await response.json();
        }
        Object.assign(activity, {
          ...saved,
          problemStatement: saved.problem_statement ?? changes.problem_statement,
          teachingGoals: saved.teaching_goals ?? changes.teaching_goals,
          sdgRelation: saved.sdg_relation ?? changes.sdg_relation,
          requiredTools: saved.required_tools ?? changes.required_tools,
          requirements: saved.requirements ?? changes.requirements,
          deliverables: saved.deliverables ?? changes.deliverables,
          submissionInstructions: saved.submission_instructions ?? changes.submission_instructions,
          evaluationCriteria: saved.evaluation_criteria ?? changes.evaluation_criteria
        });
        window.appState.save();
        window.bootstrap?.Modal.getInstance(modalEl)?.hide();
        await window.sdgNotify("The activity details were updated.", { kind: "success", title: "Activity updated" });
        this.renderFacultyDashboard(window.appState.state);
      } catch (error) {
        await window.sdgNotify(error.message || "The activity could not be updated.", { kind: "error", title: "Update failed" });
      }
    });
    new window.bootstrap.Modal(modalEl).show();
  }

  openActivityDetailModal(activityId) {
    const activity = window.appState.state.activities.find(item => item.id === activityId);
    const modalEl = document.getElementById("activityDetailModal");
    const titleEl = document.getElementById("activityDetailTitle");
    const bodyEl = document.getElementById("activityDetailBody");
    if (!activity || !modalEl || !bodyEl) return;

    const list = value => Array.isArray(value) && value.length
      ? `<ul class="small text-muted mb-0">${value.map(item => `<li class="mb-1">${item}</li>`).join("")}</ul>`
      : '<p class="small text-muted mb-0">Not specified yet.</p>';
    const section = (icon, title, content, extraClass = "") => `
      <section class="activity-detail-section card shadow-sm ${extraClass}">
        <div class="activity-detail-section-title bg-primary-subtle border-bottom"><i class="fa-solid ${icon} text-primary"></i><span>${title}</span></div>
        <div class="activity-detail-section-content px-1">${content}</div>
      </section>`;
    if (titleEl) titleEl.textContent = activity.title;
    bodyEl.innerHTML = `
      <div class="activity-detail-hero mb-4">
        <div class="activity-detail-card-label"><i class="fa-solid fa-align-left"></i> Summary</div>
        <p class="text-muted mb-3">${activity.description || "Personalized SDG activity"}</p>
      </div>
      <div class="d-flex flex-wrap gap-2 mb-4">
        <span class="badge bg-success-soft text-success">SDG ${activity.goalId || activity.sdgs?.join(", ") || "—"}</span>
        <span class="badge bg-light text-dark">${activity.difficulty || "Intermediate"}</span>
        <span class="badge bg-light text-dark">${activity.hours || "—"} hours</span>
        <span class="badge ${activity.approvalRejected ? "bg-danger text-white" : "bg-warning-soft text-dark"}">${activity.approvalPending ? "Pending approval" : (activity.approvalRejected ? "Rejected" : "Approved")}</span>
      </div>
      <div class="activity-detail-grid">
        ${section("fa-bullseye", "Problem statement", `<p class="small text-muted mb-0">${activity.problemStatement || "Defined by the personalized activity brief."}</p>`, "activity-detail-section-featured")}
        ${section("fa-graduation-cap", "Learning goals", list(activity.teachingGoals))}
        ${section("fa-leaf", "SDG connection", `<p class="small text-muted mb-0">${activity.sdgRelation || "Aligned with the selected SDGs."}</p>`)}
        ${section("fa-code", "Matched skills", list(activity.matchedSkills))}
        ${section("fa-heart", "Matched interests", list(activity.matchedInterests))}
        ${section("fa-book-open", "Prerequisites", list(activity.requirements))}
        ${section("fa-screwdriver-wrench", "Helpful tools", list(activity.requiredTools))}
        ${section("fa-list-check", "How to complete it", list(activity.steps))}
        ${section("fa-box-open", "Expected deliverables", list(activity.deliverables))}
        ${section("fa-file-arrow-up", "Submission instructions", `<p class="small text-muted mb-0">${activity.submissionInstructions || "Submit the required project links and summary."}</p>`)}
        ${section("fa-clipboard-check", "Evaluation criteria", list(activity.evaluationCriteria))}
        ${activity.reviewerNote ? section("fa-comment-dots", "Faculty feedback", `<p class="small text-danger mb-0">${activity.reviewerNote}</p>`) : ""}
      </div>`;
    new window.bootstrap.Modal(modalEl).show();
  }

  setupGoalDetailModal() {}
  setupActivityCreationForm() {}
}

document.addEventListener("DOMContentLoaded", () => {
  window.appController = new AppController();
  window.appController.init();
});
