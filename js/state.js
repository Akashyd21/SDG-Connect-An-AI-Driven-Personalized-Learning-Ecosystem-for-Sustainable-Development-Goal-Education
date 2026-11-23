// Shared State and Session Management for Multi-Page SDG Connect Web Platform
// Synchronizes Auth State across separate HTML pages using LocalStorage only

class AppState {
  constructor() {
    // Start with a clean local data namespace. This prevents records created by
    // the former demo/social-login flow from being restored as real accounts.
    this.STORAGE_KEY = "SDG_CAMPUS_PLATFORM_V7_CLEAN_AUTH";
    localStorage.removeItem("SDG_CAMPUS_PLATFORM_V6_CLEAN_AUTH");
    localStorage.removeItem("SDG_CAMPUS_PLATFORM_V5_CLEAN_AUTH");
    this.state = this.loadInitialState();
    // Standalone dashboard pages are opened directly, so establish their
    // route before the shared renderer subscribes to state changes. Without
    // this, a refresh could leave the renderer with an undefined route.
    const page = String(window.location.pathname || "").split("/").pop().toLowerCase();
    this.state.currentRoute = page.includes("student-dashboard")
      ? "student-dashboard"
      : page.includes("faculty-dashboard")
        ? "faculty-dashboard"
        : "home";
    this.listeners = new Set();
  }

  loadInitialState() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Reset quiz unlock data once when the quiz catalog changes so the first
        // quiz is the only starting point for every student.
        if (parsed.quizUnlockVersion !== 1) {
          parsed.quizProgress = {};
          parsed.quizUnlockVersion = 1;
        }
        if (parsed.gameUnlockVersion !== 1) {
          parsed.gameProgress = {};
          parsed.gameUnlockVersion = 1;
        }
        // Keep the student experience to one active task. Older local state may
        // contain several records from the previous multi-task flow.
        const activeRecords = (parsed.studentOngoingTasks || []).filter(item => item.status !== "completed");
        if (activeRecords.length > 1) {
          const keepTask = activeRecords[0];
          parsed.studentOngoingTasks = (parsed.studentOngoingTasks || []).filter(item =>
            item.status === "completed" || item === keepTask
          );
        }
        return parsed;
      } catch (e) {
        console.error("Failed to parse saved state, initializing fresh state", e);
      }
    }

    // Default Fresh State: Clean blank databases ready for user signup or backend DB connection
    return {
      currentUser: null,
      userRole: "guest",
      studentSubPage: "progress",
      facultySubPage: "student-progress",

      activities: [],
      submissions: [],
      students: [],
      faculty: [],
      quizzes: [...(window.SDG_DATA?.quizzes || [])],
      quizProgress: {},
      quizUnlockVersion: 1,
      gameProgress: {},
      gameUnlockVersion: 1,

      studentOngoingTasks: [],
      chatHistory: [],
      gameScores: {},

      theme: "light",
      notifications: []
    };
  }

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("Could not save to LocalStorage", e);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("State listener error:", err);
      }
    }
  }

  // Auth Guard Helper for Protected Dashboard Pages
  checkAuthGuard(requiredRole) {
    if (!this.state.currentUser || this.state.userRole !== requiredRole) {
      return false;
    }
    return true;
  }

  isRemoteAuthEnabled() {
    return Boolean(window.sdgSupabaseEnabled && window.sdgSupabase);
  }

  getApiBaseUrl() {
    return String(window.SDG_SUPABASE_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");
  }

  async authRequest(path, payload) {
    const response = await fetch(`${this.getApiBaseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Authentication service unavailable");
    if (data.access_token && data.refresh_token) {
      const { error } = await window.sdgSupabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      });
      if (error) throw error;
    }
    return data;
  }

  profileToFrontend(profile) {
    return {
      id: profile.id,
      name: profile.name,
      usn: profile.usn || "",
      department: profile.department,
      phone: profile.phone || "",
      email: profile.email || "",
      skills: profile.skills || [],
      interests: profile.interests || [],
      skillLevel: profile.skill_level || "intermediate",
      availableHours: Number(profile.available_hours || 4),
      designation: profile.designation || "Assistant Professor",
      points: profile.points ?? 100,
      tasksCompletedCount: profile.tasks_completed_count ?? 0,
      ongoingTasksCount: profile.ongoing_tasks_count ?? 0,
      avatar: profile.avatar || "",
      sdgCoverage: profile.sdg_coverage || {},
      badges: profile.badges || ["New Changemaker"],
      workflowStatus: profile.workflow_status || "not_started"
    };
  }

  async restoreRemoteSession(requiredRole) {
    if (!this.isRemoteAuthEnabled()) return true;
    const { data: sessionData, error: sessionError } = await window.sdgSupabase.auth.getSession();
    if (sessionError) {
      console.warn("Supabase session could not be checked; keeping the current browser state", sessionError);
      return Boolean(this.state.currentUser && this.state.userRole === requiredRole);
    }
    const authUser = sessionData?.session?.user;
    if (!authUser) {
      this.state.currentUser = null;
      this.state.userRole = "guest";
      this.clearRemoteCache(requiredRole);
      this.save();
      return false;
    }
    const { data: profile, error: profileError } = await window.sdgSupabase
      .from("profiles").select("*").eq("id", authUser.id).eq("role", requiredRole).single();
    if (profileError || !profile) {
      if (profileError && profileError.code !== "PGRST116") {
        console.warn("Supabase profile check could not be completed; keeping the current session", profileError);
        return Boolean(this.state.currentUser && this.state.userRole === requiredRole);
      }
      await window.sdgSupabase.auth.signOut();
      this.state.currentUser = null;
      this.state.userRole = "guest";
      this.clearRemoteCache(requiredRole);
      this.save();
      return false;
    }
    const user = this.profileToFrontend(profile);
    this.clearRemoteCache(requiredRole);
    this.state.currentUser = user;
    this.state.userRole = requiredRole;
    this.state[requiredRole === "student" ? "students" : "faculty"] = [user];
    this.save();
    if (requiredRole === "student") await this.loadRemoteStudentWorkflow(user.id);
    return true;
  }

  clearRemoteCache(role) {
    this.state.students = role === "student" ? [] : this.state.students.filter(item => item.id === this.state.currentUser?.id && role === "student");
    this.state.faculty = role === "faculty" ? [] : this.state.faculty.filter(item => item.id === this.state.currentUser?.id && role === "faculty");
    this.state.activities = [];
    this.state.submissions = [];
    this.state.studentOngoingTasks = [];
    this.state.chatHistory = [];
  }

  async loadRemoteStudentWorkflow(studentId) {
    if (!this.isRemoteAuthEnabled()) return;
    const { data, error } = await window.sdgSupabase
      .from("ongoing_tasks")
      .select("id,activity_id,assigned_at,status,assigned_by,ai_match_rationale,deadline")
      .eq("student_id", studentId)
      .neq("status", "completed");
    if (error) {
      console.error("Could not load current student task", error);
      return;
    }
    this.state.studentOngoingTasks = (data || []).map(task => ({
      id: task.id,
      taskId: task.activity_id,
      studentId,
      assignedAt: task.assigned_at,
      status: task.status,
      assignedBy: task.assigned_by || "ai_agent",
      aiMatchRationale: task.ai_match_rationale || "",
      deadline: task.deadline || null
    }));
    this.save();
  }

  async remoteLoginStudent(identifier, password) {
    if (!this.isRemoteAuthEnabled()) return this.loginStudent(identifier, password);
    const data = await this.authRequest("/auth/login", { identifier, password, role: "student" });
    const profile = data.user;

    const student = this.profileToFrontend(profile);
    this.clearRemoteCache("student");
    this.state.students = [student];
    this.state.currentUser = student;
    this.state.userRole = "student";
    this.save();
    await this.loadRemoteStudentWorkflow(student.id);
    return { success: true, user: student, backend: "supabase" };
  }

  async remoteSignupStudent(formData) {
    if (!this.isRemoteAuthEnabled()) return this.signupStudent(formData);

    const skills = formData.skills ? formData.skills.split(",").map(s => s.trim()).filter(Boolean) : ["Python"];
    const interests = formData.interests ? formData.interests.split(",").map(s => s.trim()).filter(Boolean) : [];
    const data = await this.authRequest("/auth/signup", {
      role: "student", name: formData.name, usn: formData.usn.toUpperCase(),
      department: formData.department, phone: formData.phone, skills, interests,
      email: formData.email, password: formData.password,
      skill_level: formData.skillLevel || "intermediate",
      available_hours: Number(formData.availableHours || 4)
    });
    const profile = data.user;
    const student = this.profileToFrontend(profile);
    this.clearRemoteCache("student");
    this.state.students = [student];
    this.state.currentUser = student;
    this.state.userRole = "student";
    this.save();
    return { success: true, user: student, backend: "supabase" };
  }

  async updateStudentProfile(profileData) {
    const student = this.state.currentUser;
    if (!student || this.state.userRole !== "student") {
      throw new Error("Student session is required to update the profile");
    }

    const skills = Array.isArray(profileData.skills) ? profileData.skills : [];
    const interests = Array.isArray(profileData.interests) ? profileData.interests : [];
    if (!skills.length || !interests.length) {
      throw new Error("Add at least one skill and one SDG interest");
    }

    const updated = {
      name: String(profileData.name || student.name).trim(),
      department: String(profileData.department || student.department).trim(),
      phone: String(profileData.phone || student.phone).trim(),
      skills,
      interests,
      skillLevel: profileData.skillLevel || student.skillLevel || "intermediate",
      availableHours: Number(profileData.availableHours || student.availableHours || 4)
    };
    if (!updated.name || !updated.department || !updated.phone || !Number.isFinite(updated.availableHours) || updated.availableHours < 1 || updated.availableHours > 40) {
      throw new Error("Enter valid profile details and available hours between 1 and 40");
    }

    if (this.isRemoteAuthEnabled()) {
      const { data, error } = await window.sdgSupabase.from("profiles")
        .update({
          name: updated.name,
          department: updated.department,
          phone: updated.phone,
          skills: updated.skills,
          interests: updated.interests,
          skill_level: updated.skillLevel,
          available_hours: updated.availableHours
        })
        .eq("id", student.id)
        .eq("role", "student")
        .select("*")
        .single();
      if (error) throw error;
      Object.assign(updated, this.profileToFrontend(data));
    }

    Object.assign(student, updated);
    const storedStudent = this.state.students.find(item => item.id === student.id);
    if (storedStudent && storedStudent !== student) Object.assign(storedStudent, updated);
    this.save();
    return student;
  }

  async remoteLoginFaculty(email, password) {
    if (!this.isRemoteAuthEnabled()) return this.loginFaculty(email, password);
    const data = await this.authRequest("/auth/login", { identifier: email, password, role: "faculty" });
    const profile = data.user;
    const faculty = this.profileToFrontend(profile);
    this.clearRemoteCache("faculty");
    this.state.faculty = [faculty];
    this.state.currentUser = faculty;
    this.state.userRole = "faculty";
    this.save();
    return { success: true, user: faculty, backend: "supabase" };
  }

  async remoteSignupFaculty(formData) {
    if (!this.isRemoteAuthEnabled()) return this.signupFaculty(formData);
    const data = await this.authRequest("/auth/signup", {
      role: "faculty", name: formData.name, department: formData.department,
      phone: formData.phone, designation: formData.designation || "Assistant Professor",
      email: formData.email, password: formData.password
    });
    const profile = data.user;
    const faculty = this.profileToFrontend(profile);
    this.clearRemoteCache("faculty");
    this.state.faculty = [faculty];
    this.state.currentUser = faculty;
    this.state.userRole = "faculty";
    this.save();
    return { success: true, user: faculty, backend: "supabase" };
  }

  async saveQuizAttempt(attempt) {
    if (!this.isRemoteAuthEnabled() || !this.state.currentUser?.id) return;

    const studentId = this.state.currentUser.id;
    const { error: attemptError } = await window.sdgSupabase
      .from("quiz_attempts")
      .insert({
        student_id: studentId,
        quiz_topic_id: attempt.quizTopicId,
        score: attempt.score,
        total_questions: attempt.totalQuestions,
        answers: attempt.answers,
        points_awarded: attempt.pointsAwarded
      });

    const student = this.state.currentUser;
    const { error: profileError } = await window.sdgSupabase
      .from("profiles")
      .update({
        points: student.points || 0,
        tasks_completed_count: student.tasksCompletedCount || 0,
        ongoing_tasks_count: student.ongoingTasksCount || 0,
        sdg_coverage: student.sdgCoverage || {},
        badges: student.badges || []
      })
      .eq("id", studentId);

    if (attemptError || profileError) {
      console.error("Could not save quiz result to Supabase", attemptError || profileError);
    }
  }

  async saveGameScore(game) {
    if (!this.isRemoteAuthEnabled() || !this.state.currentUser?.id) return;

    const { error } = await window.sdgSupabase
      .from("game_scores")
      .upsert({
        student_id: this.state.currentUser.id,
        game_id: game.gameId,
        score: game.score,
        played_at: new Date().toISOString()
      }, { onConflict: "student_id,game_id" });

    const student = this.state.currentUser;
    const { error: profileError } = await window.sdgSupabase
      .from("profiles")
      .update({ points: student.points || 0, badges: student.badges || [] })
      .eq("id", student.id);

    if (error || profileError) console.error("Could not save game score to Supabase", error || profileError);
  }

  async saveOngoingTask(task) {
    if (!this.isRemoteAuthEnabled() || !this.state.currentUser?.id) return;
    // Local fallback task IDs are not Supabase UUIDs and cannot reference activities.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(task.taskId))) return;

    const { error } = await window.sdgSupabase
      .from("ongoing_tasks")
      .upsert({
        student_id: this.state.currentUser.id,
        activity_id: task.taskId,
        status: task.status || "in-progress",
        deadline: task.deadline || null,
        assigned_by: task.assignedBy || "student_enroll",
        ai_match_rationale: task.aiMatchRationale || null
      }, { onConflict: "student_id,activity_id" });

    if (error) console.error("Could not save enrollment to Supabase", error);
  }

  async removeOngoingTask(taskId) {
    if (!this.isRemoteAuthEnabled() || !this.state.currentUser?.id) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(taskId))) return;
    const { error } = await window.sdgSupabase
      .from("ongoing_tasks")
      .delete()
      .eq("student_id", this.state.currentUser.id)
      .eq("activity_id", taskId);
    if (error) console.error("Could not remove completed enrollment from Supabase", error);
  }

  loginStudent(usnOrEmail, password) {
    const student = this.state.students.find(
      s => (s.usn.toLowerCase() === usnOrEmail.toLowerCase() || s.email.toLowerCase() === usnOrEmail.toLowerCase())
    );

    if (student) {
      if (student.password && student.password !== password) {
        return { success: false, message: "Incorrect password. Please verify and try again." };
      }
      this.state.currentUser = student;
      this.state.userRole = "student";
      this.save();
      return { success: true, user: student, backend: 'localstorage' };
    }

    return {
      success: false,
      message: "Student account not found with this USN/Email. Please register or use Social Sign In.",
      backend: 'localstorage'
    };
  }

  signupStudent(formData) {
    const skillsList = formData.skills ? formData.skills.split(",").map(s => s.trim()).filter(Boolean) : ["Python", "Deep Learning"];
    const interestsList = formData.interests ? formData.interests.split(",").map(i => i.trim()).filter(Boolean) : ["Responsible Consumption (SDG 12)"];

    const newStudent = {
      id: "STU-" + Math.floor(1000 + Math.random() * 9000),
      name: formData.name,
      usn: formData.usn.toUpperCase(),
      department: formData.department,
      skills: skillsList,
      interests: interestsList,
      skillLevel: formData.skillLevel || "intermediate",
      availableHours: Number(formData.availableHours || 4),
      phone: formData.phone,
      email: formData.email,
      password: formData.password,
      points: 100,
      tasksCompletedCount: 0,
      ongoingTasksCount: 0,
      avatar: "",
      sdgCoverage: {},
      badges: ["New Changemaker"]
    };

    this.state.students.unshift(newStudent);
    this.state.currentUser = newStudent;
    this.state.userRole = "student";

    this.save();
    return { success: true, user: newStudent, backend: 'localstorage' };
  }

  // Social login requires a real provider integration. Do not create local
  // placeholder accounts when one is not configured.
  socialLoginStudent(provider) {
    return {
      success: false,
      message: `${provider} sign-in is not configured. Please use the student registration or sign-in form.`
    };
  }

  loginFaculty(email, password) {
    const faculty = this.state.faculty.find(
      f => f.email.toLowerCase() === email.toLowerCase()
    );

    if (faculty) {
      if (faculty.password && faculty.password !== password) {
        return { success: false, message: "Incorrect password. Please verify and try again." };
      }
      this.state.currentUser = faculty;
      this.state.userRole = "faculty";
      this.save();
      return { success: true, user: faculty, backend: 'localstorage' };
    }

    return {
      success: false,
      message: "Faculty account not found with this Email. Please register or use Social Sign In.",
      backend: 'localstorage'
    };
  }

  signupFaculty(formData) {
    const newFaculty = {
      id: "FAC-" + Math.floor(1000 + Math.random() * 9000),
      name: formData.name,
      department: formData.department,
      phone: formData.phone,
      email: formData.email,
      password: formData.password,
      designation: formData.designation || "Assistant Professor",
      avatar: ""
    };

    this.state.faculty.unshift(newFaculty);
    this.state.currentUser = newFaculty;
    this.state.userRole = "faculty";
    this.save();
    return { success: true, user: newFaculty, backend: 'localstorage' };
  }

  // Social login requires a real provider integration. Do not create local
  // placeholder accounts when one is not configured.
  socialLoginFaculty(provider) {
    return {
      success: false,
      message: `${provider} sign-in is not configured. Please use the faculty registration or sign-in form.`
    };
  }

  resetPassword(email, newPassword) {
    const student = this.state.students.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (student) {
      student.password = newPassword;
      this.save();
      return { success: true, role: 'student', user: student };
    }
    const faculty = this.state.faculty.find(f => f.email.toLowerCase() === email.toLowerCase());
    if (faculty) {
      faculty.password = newPassword;
      this.save();
      return { success: true, role: 'faculty', user: faculty };
    }
    return { success: false, message: "No account registered with this email address." };
  }

  async logout() {
    if (this.isRemoteAuthEnabled()) {
      const { error } = await window.sdgSupabase.auth.signOut();
      if (error) console.warn("Supabase sign-out failed", error);
    }
    this.state.currentUser = null;
    this.state.userRole = "guest";
    this.clearRemoteCache("student");
    this.save();
    window.location.href = "index.html";
  }

  // Task & Submission Methods
  setStudentSubPage(page) {
    this.state.studentSubPage = page;
    this.save();
  }

  setFacultySubPage(page) {
    this.state.facultySubPage = page;
    this.save();
  }

  createActivity(activityData) {
    const isDl = activityData.taskType === "technical_dl_project";

    const newActivity = {
      id: isDl ? "TASK-DL-" + Math.floor(300 + Math.random() * 600) : "TASK-" + Math.floor(200 + Math.random() * 800),
      title: activityData.title,
      goalId: parseInt(activityData.goalId, 10),
      department: activityData.department || "All Departments",
      points: parseInt(activityData.points, 10) || (isDl ? 300 : 150),
      deadline: activityData.deadline || "2026-09-30",
      status: activityData.status || "Active",
      difficulty: activityData.difficulty || (isDl ? "Advanced" : "Intermediate"),
      taskType: activityData.taskType || "field_activity",
      aiAssigned: false,
      matchedSkills: activityData.matchedSkills || (isDl ? ["Python", "Deep Learning", "PyTorch"] : ["Campus Action", "Sustainability"]),
      description: activityData.description,
      verificationRules: activityData.verificationRules || "Complete deliverables and upload verification proof.",
      participantsCount: 0,
      createdBy: this.state.currentUser ? this.state.currentUser.name : "Faculty Administrator"
    };

    this.state.activities.unshift(newActivity);
    this.save();
    return newActivity;
  }

  toggleActivityStatus(taskId) {
    const task = this.state.activities.find(t => t.id === taskId);
    if (task) {
      task.status = task.status === "Active" ? "Inactive" : "Active";
      this.save();
      return task;
    }
    return null;
  }

  editActivity(taskId, updatedData) {
    const index = this.state.activities.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.state.activities[index] = {
        ...this.state.activities[index],
        ...updatedData
      };
      this.save();
      return this.state.activities[index];
    }
    return null;
  }

  deleteActivity(taskId) {
    this.state.activities = this.state.activities.filter(t => t.id !== taskId);
    this.state.studentOngoingTasks = this.state.studentOngoingTasks.filter(o => o.taskId !== taskId);
    this.save();
    return true;
  }

  assignTaskToStudent(taskId, studentId = null, assignedBy = "student_enroll") {
    const targetStudentId = studentId || (this.state.currentUser ? this.state.currentUser.id : "STU-001");
    const task = this.state.activities.find(t => t.id === taskId);
    if (!task) return false;
    if (task.approvalPending || task.approval_status === "pending") return false;

    const existing = this.state.studentOngoingTasks.find(o =>
      o.taskId === taskId && o.studentId === targetStudentId && o.status !== "completed"
    );
    if (!existing) {
      const activeTask = this.state.studentOngoingTasks.find(item =>
        item.studentId === targetStudentId && item.status !== "completed" && item.taskId !== taskId
      );
      if (activeTask) return false;

      this.state.studentOngoingTasks.unshift({
        taskId: taskId,
        studentId: targetStudentId,
        deadline: task.deadline || null,
        assignedAt: new Date().toISOString().split("T")[0],
        status: "in-progress",
        assignedBy: assignedBy,
        aiMatchRationale: `Assigned based on skill profile for SDG ${task.goalId}.`
      });

      const student = this.state.students.find(s => s.id === targetStudentId);
      if (student) {
        student.ongoingTasksCount = (student.ongoingTasksCount || 0) + 1;
      }
      task.participantsCount = (task.participantsCount || 0) + 1;
      this.save();
      this.saveOngoingTask(this.state.studentOngoingTasks[0]);
      return true;
    }
    return false;
  }

  addSubmission(submissionData) {
    const student = this.state.currentUser || this.state.students[0];
    const task = this.state.activities.find(t => t.id === submissionData.taskId);
    const isDl = task ? task.taskType === "technical_dl_project" : (submissionData.taskType === "technical_dl_project");

    const newSub = {
      id: isDl ? "SUB-DL-" + Math.floor(900 + Math.random() * 1000) : "SUB-" + Math.floor(900 + Math.random() * 1000),
      taskId: submissionData.taskId,
      taskTitle: submissionData.activityName || (task ? task.title : submissionData.taskTitle),
      activityName: submissionData.activityName || (task ? task.title : submissionData.taskTitle),
      sdgGoalId: task ? task.goalId : (submissionData.goalId || 12),
      studentId: student.id,
      studentName: student.name,
      usn: student.usn,
      department: student.department,
      taskType: isDl ? "technical_dl_project" : "field_activity",
      submittedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
      impactSummary: submissionData.impactSummary,
      githubRepoUrl: submissionData.githubRepoUrl || null,
      colabNotebookUrl: submissionData.colabNotebookUrl || null,
      liveDemoUrl: submissionData.liveDemoUrl || null,
      location: submissionData.location || null,
      imageUrl: submissionData.imageUrl || null,
      submissionStatus: submissionData.submissionStatus || "submitted",
      verification: submissionData.verification || null,
      pointsAwarded: 0
    };

    this.state.submissions.unshift(newSub);

    this.save();
    this.saveRemoteSubmission(newSub);
    return newSub;
  }

  async saveRemoteSubmission(submission) {
    if (!this.isRemoteAuthEnabled() || !this.state.currentUser?.id) return;
    const { error } = await window.sdgSupabase.from("submissions").insert({
      student_id: this.state.currentUser.id,
      activity_id: submission.taskId,
      task_title: submission.taskTitle,
      task_type: submission.taskType,
      impact_summary: submission.impactSummary,
      project_summary: submission.impactSummary,
      github_repo_url: submission.githubRepoUrl,
      live_demo_url: submission.liveDemoUrl,
      notebook_url: submission.colabNotebookUrl,
      colab_notebook_url: submission.colabNotebookUrl,
      location: submission.location,
      image_url: submission.imageUrl,
      verification: submission.verification || {},
      submission_status: submission.submissionStatus
    });
    if (error) console.error("Could not save submission to Supabase", error);
  }

  async reviewSubmission(submissionId, decision, feedback = "", marks = null) {
    const sub = this.state.submissions.find(s => s.id === submissionId);
    if (!sub) return null;

    const task = this.state.activities.find(t => t.id === sub.taskId);
    const awardedMarks = marks === null ? (task ? task.points : (sub.taskType === "technical_dl_project" ? 100 : 100)) : Number(marks);
    if (decision === "approve" && (!Number.isInteger(awardedMarks) || awardedMarks < 0 || awardedMarks > 100)) {
      throw new Error("Marks must be a whole number between 0 and 100");
    }

    sub.submissionStatus = decision === "approve" ? "approved" : (decision === "reject" ? "rejected" : "needs_changes");
    sub.facultyFeedback = feedback;

    if (decision === "approve") {
      sub.pointsAwarded = awardedMarks;
      this.creditStudentReward(sub.studentId, awardedMarks, sub.sdgGoalId);
      this.state.studentOngoingTasks = this.state.studentOngoingTasks.filter(t => t.taskId !== sub.taskId);
      this.removeOngoingTask(sub.taskId);
      if (task?.aiAssigned) {
        task.aiAssigned = false;
        task.assignedToStudentId = null;
        task.status = "Completed";
      }
    }

    this.save();
    if (this.isRemoteAuthEnabled() && sub.id && /^[0-9a-f-]{36}$/i.test(sub.id)) {
      const { error } = await window.sdgSupabase.from("submissions").update({
        submission_status: sub.submissionStatus,
        points_awarded: sub.pointsAwarded || 0
      }).eq("id", sub.id);
      if (error) console.error("Could not save submission review to Supabase", error);
    }
    return sub;
  }

  creditStudentReward(studentId, points, goalId) {
    const student = this.state.students.find(s => s.id === studentId);
    if (student) {
      student.points = (student.points || 0) + points;
      student.tasksCompletedCount = (student.tasksCompletedCount || 0) + 1;
      if (student.ongoingTasksCount > 0) student.ongoingTasksCount--;

      if (!student.sdgCoverage) student.sdgCoverage = {};
      student.sdgCoverage[goalId] = (student.sdgCoverage[goalId] || 0) + 1;

      if (!student.badges.includes("Technical Changemaker")) {
        student.badges.push("Technical Changemaker");
      }
    }
  }

  addChatMessage(message) {
    this.state.chatHistory.push(message);
    this.save();
  }
}

window.appState = new AppState();
