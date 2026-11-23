// Games Engine for SDG Connect Web Platform
// Mini-games cover practical decisions across multiple SDGs.

class GamesEngine {
  constructor() {
    this.activeGame = null;
    this.timer = null;
    this.score = 0;
    this.streak = 0;
    this.timeLeft = 45;
    this.gameOrder = ["eco-sorter", "net-zero", "water-guardian", "city-planner", "biodiversity-keeper"];

    // Waste items bank for Eco-Sorter
    this.wasteItems = [
      { id: "item1", name: "Banana Peel & Apple Core", type: "organic", icon: "🍌", tip: "Biodegradable organic material ideal for campus compost." },
      { id: "item2", name: "Clean PET Water Bottle", type: "recyclable", icon: "🧴", tip: "Clean plastics are shredded and recycled into new fiber." },
      { id: "item3", name: "Obsolete Lithium-Ion Battery", type: "ewaste", icon: "🔋", tip: "Batteries contain toxic heavy metals and must go to certified e-waste hubs." },
      { id: "item4", name: "Greasy Pizza Cardboard Box", type: "landfill", icon: "🍕", tip: "Food oil contaminates paper recycling fibers, so soiled paper goes to landfill or industrial composting." },
      { id: "item5", name: "Aluminum Soda Can", type: "recyclable", icon: "🥫", tip: "Aluminum can be recycled indefinitely with 95% energy savings!" },
      { id: "item6", name: "Cracked Smartphone Display", type: "ewaste", icon: "📱", tip: "Contains rare earth metals that must be reclaimed in specialized recovery labs." },
      { id: "item7", name: "Fallen Garden Leaves", type: "organic", icon: "🍂", tip: "Nutrient-rich mulch for campus soil regeneration." },
      { id: "item8", name: "Non-recyclable Snack Chip Bag (Multi-layer foil)", type: "landfill", icon: "🍟", tip: "Multi-layered foil plastic cannot be mechanically recycled easily." },
      { id: "item9", name: "Discarded Lab PCB Motherboard", type: "ewaste", icon: "💻", tip: "E-waste containing precious metals like copper and gold." },
      { id: "item10", name: "Cardboard Courier Shipping Box", type: "recyclable", icon: "📦", tip: "Clean cardboard is 100% recyclable into new packaging." }
    ];
  }

  isGameUnlocked(gameId) {
    const progress = window.appState.state.gameProgress || {};
    const index = this.gameOrder.indexOf(gameId);
    return index <= 0 || Boolean(progress[gameId]?.unlocked);
  }

  unlockNextGame(gameId) {
    const progress = window.appState.state.gameProgress || {};
    const index = this.gameOrder.indexOf(gameId);
    progress[gameId] = { ...(progress[gameId] || {}), unlocked: true, completed: true };
    const nextGame = this.gameOrder[index + 1];
    if (nextGame) progress[nextGame] = { ...(progress[nextGame] || {}), unlocked: true };
    window.appState.state.gameProgress = progress;
    window.appState.save();
  }

  // 1. Eco-Sorter Challenge Game
  startEcoSorter() {
    if (!this.isGameUnlocked("eco-sorter")) return;
    this.activeGame = "eco-sorter";
    this.score = 0;
    this.streak = 0;
    this.timeLeft = 45;
    this.currentItemIndex = 0;
    this.shuffledItems = [...this.wasteItems].sort(() => 0.5 - Math.random());

    this.renderEcoSorterUI();
    this.runGameTimer();
  }

  runGameTimer() {
    clearInterval(this.timer);
    const timerDisplay = document.getElementById("game-timer-display");

    this.timer = setInterval(() => {
      this.timeLeft--;
      if (timerDisplay) {
        timerDisplay.textContent = `${this.timeLeft}s`;
        if (this.timeLeft <= 10) timerDisplay.classList.add("text-danger", "pulse-fast");
      }

      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.finishEcoSorter();
      }
    }, 1000);
  }

  renderEcoSorterUI() {
    const container = document.getElementById("game-arena-mount");
    if (!container) return;

    const currentItem = this.shuffledItems[this.currentItemIndex];

    container.innerHTML = `
      <div class="eco-sorter-board animate-fade-in card-glass p-4">
        <!-- Game HUD -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <button class="btn btn-sm btn-outline-secondary" id="btn-exit-game">
            <i class="fa-solid fa-arrow-left me-1"></i> Back to Games Menu
          </button>
          
          <div class="d-flex align-items-center gap-3">
            <div class="game-hud-stat">
              <small class="text-muted d-block">Time Left</small>
              <strong id="game-timer-display" class="fs-4 text-primary">${this.timeLeft}s</strong>
            </div>
            <div class="game-hud-stat">
              <small class="text-muted d-block">Score</small>
              <strong id="game-score-display" class="fs-4 text-warning">${this.score}</strong>
            </div>
            <div class="game-hud-stat">
              <small class="text-muted d-block">Streak</small>
              <strong id="game-streak-display" class="fs-4 text-success">${this.streak}x 🔥</strong>
            </div>
          </div>
        </div>

        <!-- Current Waste Item Showcase -->
        <div class="waste-conveyor-card text-center my-4 py-4 px-3 rounded-4 bg-light border shadow-sm">
          <div class="waste-emoji-large mb-2" style="font-size: 4.5rem; animation: float 3s ease-in-out infinite;">
            ${currentItem.icon}
          </div>
          <h3 class="fw-bold mb-1">${currentItem.name}</h3>
          <p class="text-muted small mb-0">Select the correct SDG 12 waste category bin below to sort this item!</p>
          <div id="sort-feedback" class="mt-2 fw-bold" style="min-height: 24px;"></div>
        </div>

        <!-- 4 Sorting Bins -->
        <div class="row g-3 mt-2">
          <div class="col-6 col-md-3">
            <button class="bin-btn bin-organic w-100 p-3 rounded-4 text-start border shadow-sm" data-bin-type="organic">
              <div class="d-flex align-items-center gap-2 mb-2">
                <i class="fa-solid fa-leaf text-success fs-3"></i>
                <h5 class="fw-bold mb-0 text-success">Compost</h5>
              </div>
              <small class="text-muted">Food waste, fruit peels, yard clippings</small>
            </button>
          </div>

          <div class="col-6 col-md-3">
            <button class="bin-btn bin-recyclable w-100 p-3 rounded-4 text-start border shadow-sm" data-bin-type="recyclable">
              <div class="d-flex align-items-center gap-2 mb-2">
                <i class="fa-solid fa-recycle text-primary fs-3"></i>
                <h5 class="fw-bold mb-0 text-primary">Recyclable</h5>
              </div>
              <small class="text-muted">Clean plastic, paper, glass, cans</small>
            </button>
          </div>

          <div class="col-6 col-md-3">
            <button class="bin-btn bin-ewaste w-100 p-3 rounded-4 text-start border shadow-sm" data-bin-type="ewaste">
              <div class="d-flex align-items-center gap-2 mb-2">
                <i class="fa-solid fa-plug-circle-bolt text-warning fs-3"></i>
                <h5 class="fw-bold mb-0 text-warning">E-Waste</h5>
              </div>
              <small class="text-muted">Electronics, batteries, cables, PCBs</small>
            </button>
          </div>

          <div class="col-6 col-md-3">
            <button class="bin-btn bin-landfill w-100 p-3 rounded-4 text-start border shadow-sm" data-bin-type="landfill">
              <div class="d-flex align-items-center gap-2 mb-2">
                <i class="fa-solid fa-trash-can text-danger fs-3"></i>
                <h5 class="fw-bold mb-0 text-danger">Landfill</h5>
              </div>
              <small class="text-muted">Greasy boxes, multi-foil wrappers</small>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-exit-game").addEventListener("click", () => {
      clearInterval(this.timer);
      this.renderGamesHub();
    });

    const binBtns = container.querySelectorAll(".bin-btn");
    binBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const binType = btn.getAttribute("data-bin-type");
        this.handleBinSelection(binType);
      });
    });
  }

  handleBinSelection(selectedBin) {
    const currentItem = this.shuffledItems[this.currentItemIndex];
    const isCorrect = selectedBin === currentItem.type;
    const feedbackDiv = document.getElementById("sort-feedback");

    if (isCorrect) {
      this.streak++;
      const multiplier = Math.min(this.streak, 5);
      const pointsAdded = 20 * multiplier;
      this.score += pointsAdded;
      if (feedbackDiv) {
        feedbackDiv.innerHTML = `<span class="text-success"><i class="fa-solid fa-circle-check me-1"></i> Correct! +${pointsAdded} pts (${multiplier}x streak)</span>`;
      }
    } else {
      this.streak = 0;
      if (feedbackDiv) {
        feedbackDiv.innerHTML = `<span class="text-danger"><i class="fa-solid fa-circle-xmark me-1"></i> Incorrect! Fact: ${currentItem.tip}</span>`;
      }
    }

    // Update HUD
    const scoreDisp = document.getElementById("game-score-display");
    const streakDisp = document.getElementById("game-streak-display");
    if (scoreDisp) scoreDisp.textContent = this.score;
    if (streakDisp) streakDisp.textContent = `${this.streak}x 🔥`;

    // Move to next item or recycle items
    setTimeout(() => {
      this.currentItemIndex = (this.currentItemIndex + 1) % this.shuffledItems.length;
      this.renderEcoSorterUI();
    }, 600);
  }

  finishEcoSorter() {
    const container = document.getElementById("game-arena-mount");
    if (!container) return;

    // Credit student points
    const rewardPoints = Math.round(this.score / 2);
    if (window.appState.state.currentUser && rewardPoints > 0) {
      const student = window.appState.state.currentUser;
      student.points = (student.points || 0) + rewardPoints;
      if (!student.badges.includes("Zero-Waste Sorter")) {
        student.badges.push("Zero-Waste Sorter");
      }
      window.appState.save();
      window.appState.saveGameScore({ gameId: "eco-sorter", score: this.score });
    }
    this.unlockNextGame("eco-sorter");

    container.innerHTML = `
      <div class="card-glass text-center p-5 animate-fade-in my-3">
        <div class="badge-glow-circle mx-auto mb-3">
          <i class="fa-solid fa-award text-warning" style="font-size: 3.5rem;"></i>
        </div>
        <h2 class="fw-bold mb-1">Time's Up! Great Segregation Effort!</h2>
        <p class="text-muted mb-4">You contributed to SDG 12 Responsible Consumption & Waste Reduction</p>

        <div class="row justify-content-center g-3 my-4">
          <div class="col-6 col-md-3">
            <div class="p-3 bg-light rounded-4 border">
              <small class="text-muted d-block">Final Score</small>
              <h3 class="fw-bold text-primary mb-0">${this.score}</h3>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="p-3 bg-light rounded-4 border">
              <small class="text-muted d-block">SDG Reward Points</small>
              <h3 class="fw-bold text-warning mb-0">+${rewardPoints} pts</h3>
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-center gap-3 mt-4">
          <button class="btn btn-outline-secondary px-4 py-2" id="btn-replay-sorter">
            <i class="fa-solid fa-rotate-left me-1"></i> Play Again
          </button>
          <button class="btn btn-primary px-4 py-2" id="btn-back-hub">
            <i class="fa-solid fa-gamepad me-1"></i> Return to Games Hub
          </button>
        </div>
      </div>
    `;

    document.getElementById("btn-replay-sorter").addEventListener("click", () => this.startEcoSorter());
    document.getElementById("btn-back-hub").addEventListener("click", () => this.renderGamesHub());
  }

  // 2. NetZero Campus Grid Challenge
  startNetZero() {
    if (!this.isGameUnlocked("net-zero")) {
      alert("Complete the previous game to unlock this game.");
      return;
    }
    this.activeGame = "net-zero";
    this.renderNetZeroUI();
  }

  renderNetZeroUI() {
    const container = document.getElementById("game-arena-mount");
    if (!container) return;

    let budget = 100000;
    let solarPanels = 2; // units
    let smartBatteries = 1;
    let evShuttles = 1;
    let treeParcels = 3;
    let ledRetrofits = 2;

    const calculateMetrics = () => {
      const spent = (solarPanels * 15000) + (smartBatteries * 20000) + (evShuttles * 18000) + (treeParcels * 5000) + (ledRetrofits * 8000);
      const remainingBudget = 100000 - spent;
      
      // Carbon Offset: baseline campus is 500 tCO2/yr
      const offset = (solarPanels * 45) + (smartBatteries * 20) + (evShuttles * 35) + (treeParcels * 18) + (ledRetrofits * 25);
      const netZeroPct = Math.min(100, Math.round((offset / 320) * 100));
      const reliability = Math.min(99, Math.max(60, 70 + (smartBatteries * 12) + (solarPanels * 4) - (evShuttles * 2)));

      return { spent, remainingBudget, offset, netZeroPct, reliability };
    };

    const updateView = () => {
      const m = calculateMetrics();

      container.innerHTML = `
        <div class="card-glass p-4 animate-fade-in">
          <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <button class="btn btn-sm btn-outline-secondary" id="btn-exit-netzero">
              <i class="fa-solid fa-arrow-left me-1"></i> Back to Games Menu
            </button>
            <div class="d-flex align-items-center gap-3">
              <span class="badge bg-success-soft text-success px-3 py-2">
                <i class="fa-solid fa-solar-panel me-1"></i> SDG 7 & SDG 13 Simulator
              </span>
            </div>
          </div>

          <div class="row g-4">
            <!-- Left Controls: Budget Allocation -->
            <div class="col-lg-7">
              <div class="p-3 bg-light rounded-4 border mb-4">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="text-muted fw-bold">Available Campus Budget:</span>
                  <span class="fs-4 fw-bold ${m.remainingBudget < 0 ? 'text-danger' : 'text-primary'}">$${m.remainingBudget.toLocaleString()}</span>
                </div>
                <div class="progress" style="height: 10px;">
                  <div class="progress-bar ${m.remainingBudget < 0 ? 'bg-danger' : 'bg-primary'}" style="width: ${Math.min(100, (m.spent / 100000) * 100)}%"></div>
                </div>
              </div>

              <!-- Asset Sliders/Controls -->
              <div class="asset-control-list d-flex flex-column gap-3">
                <div class="asset-item-card p-3 rounded-3 bg-white border d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="fw-bold mb-0">☀️ Rooftop Solar PV Arrays ($15k / unit)</h6>
                    <small class="text-muted">Generates clean electricity (-45 tCO2/yr)</small>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-outline-secondary" id="btn-solar-minus">-</button>
                    <span class="fw-bold px-2">${solarPanels}</span>
                    <button class="btn btn-sm btn-outline-primary" id="btn-solar-plus">+</button>
                  </div>
                </div>

                <div class="asset-item-card p-3 rounded-3 bg-white border d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="fw-bold mb-0">🔋 Microgrid Vanadium Battery Banks ($20k / unit)</h6>
                    <small class="text-muted">Stores solar energy & boosts reliability (+12% Rel)</small>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-outline-secondary" id="btn-bat-minus">-</button>
                    <span class="fw-bold px-2">${smartBatteries}</span>
                    <button class="btn btn-sm btn-outline-primary" id="btn-bat-plus">+</button>
                  </div>
                </div>

                <div class="asset-item-card p-3 rounded-3 bg-white border d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="fw-bold mb-0">🚌 Zero-Emission EV Campus Shuttle ($18k / unit)</h6>
                    <small class="text-muted">Eliminates diesel commuter emissions (-35 tCO2/yr)</small>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-outline-secondary" id="btn-ev-minus">-</button>
                    <span class="fw-bold px-2">${evShuttles}</span>
                    <button class="btn btn-sm btn-outline-primary" id="btn-ev-plus">+</button>
                  </div>
                </div>

                <div class="asset-item-card p-3 rounded-3 bg-white border d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="fw-bold mb-0">🌳 Native Miyawaki Micro-Forest ($5k / parcel)</h6>
                    <small class="text-muted">Natural carbon sink & biodiversity shelter (-18 tCO2/yr)</small>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-outline-secondary" id="btn-tree-minus">-</button>
                    <span class="fw-bold px-2">${treeParcels}</span>
                    <button class="btn btn-sm btn-outline-primary" id="btn-tree-plus">+</button>
                  </div>
                </div>

                <div class="asset-item-card p-3 rounded-3 bg-white border d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="fw-bold mb-0">💡 Smart Motion-Sensor LED Retrofits ($8k / block)</h6>
                    <small class="text-muted">Cuts lighting energy usage by 60% (-25 tCO2/yr)</small>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-outline-secondary" id="btn-led-minus">-</button>
                    <span class="fw-bold px-2">${ledRetrofits}</span>
                    <button class="btn btn-sm btn-outline-primary" id="btn-led-plus">+</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Impact Dashboard -->
            <div class="col-lg-5">
              <div class="p-4 bg-white rounded-4 border h-100 d-flex flex-column justify-content-between">
                <div>
                  <h5 class="fw-bold mb-3 d-flex align-items-center gap-2">
                    <i class="fa-solid fa-gauge-high text-success"></i> Campus Net-Zero Gauge
                  </h5>

                  <div class="text-center my-4">
                    <div class="netzero-dial-circle mx-auto position-relative" style="width: 140px; height: 140px; border-radius: 50%; background: conic-gradient(var(--brand-teal) ${m.netZeroPct}%, #e2e8f0 0); display: grid; place-items: center;">
                      <div class="bg-white rounded-circle d-flex flex-column justify-content-center align-items-center" style="width: 110px; height: 110px;">
                        <span class="fs-3 fw-bold text-success">${m.netZeroPct}%</span>
                        <small class="text-muted" style="font-size: 0.7rem;">NET ZERO</small>
                      </div>
                    </div>
                  </div>

                  <div class="metric-row d-flex justify-content-between py-2 border-bottom">
                    <span class="text-muted">Total CO2 Avoided:</span>
                    <strong class="text-success">${m.offset} tCO2 / year</strong>
                  </div>

                  <div class="metric-row d-flex justify-content-between py-2 border-bottom">
                    <span class="text-muted">Grid Reliability Index:</span>
                    <strong class="${m.reliability > 85 ? 'text-success' : 'text-warning'}">${m.reliability}%</strong>
                  </div>

                  <div class="metric-row d-flex justify-content-between py-2">
                    <span class="text-muted">Budget Feasibility:</span>
                    <strong class="${m.remainingBudget >= 0 ? 'text-success' : 'text-danger'}">
                      ${m.remainingBudget >= 0 ? 'Within Budget' : 'Over Budget!'}
                    </strong>
                  </div>
                </div>

                <div class="mt-4">
                  ${m.netZeroPct >= 95 && m.remainingBudget >= 0 && m.reliability >= 85 ? `
                    <div class="alert alert-success text-center py-2 mb-3">
                      🎉 <strong>Target Achieved!</strong> You designed a viable Net-Zero Campus!
                    </div>
                    <button class="btn btn-success w-100 py-2 fw-bold" id="btn-claim-netzero-badge">
                      <i class="fa-solid fa-award me-1"></i> Claim NetZero Architect Badge (+150 pts)
                    </button>
                  ` : `
                    <div class="alert alert-light border text-center py-2 mb-0 small text-muted">
                      Aim for 95%+ Net Zero, ≥85% Reliability while staying within the $100k budget.
                    </div>
                  `}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Event Listeners
      document.getElementById("btn-exit-netzero").addEventListener("click", () => this.renderGamesHub());
      
      const setupBtn = (id, changeFn) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener("click", () => { changeFn(); updateView(); });
      };

      setupBtn("btn-solar-plus", () => solarPanels++);
      setupBtn("btn-solar-minus", () => { if (solarPanels > 0) solarPanels--; });

      setupBtn("btn-bat-plus", () => smartBatteries++);
      setupBtn("btn-bat-minus", () => { if (smartBatteries > 0) smartBatteries--; });

      setupBtn("btn-ev-plus", () => evShuttles++);
      setupBtn("btn-ev-minus", () => { if (evShuttles > 0) evShuttles--; });

      setupBtn("btn-tree-plus", () => treeParcels++);
      setupBtn("btn-tree-minus", () => { if (treeParcels > 0) treeParcels--; });

      setupBtn("btn-led-plus", () => ledRetrofits++);
      setupBtn("btn-led-minus", () => { if (ledRetrofits > 0) ledRetrofits--; });

      const claimBtn = document.getElementById("btn-claim-netzero-badge");
      if (claimBtn) {
        claimBtn.addEventListener("click", () => {
          if (window.appState.state.currentUser) {
            const student = window.appState.state.currentUser;
            student.points = (student.points || 0) + 150;
            if (!student.badges.includes("NetZero Architect")) {
              student.badges.push("NetZero Architect");
            }
            window.appState.save();
            window.appState.saveGameScore({ gameId: "net-zero", score: m.netZeroPct });
            this.unlockNextGame("net-zero");
            alert("🌟 Badge Unlocked: NetZero Architect! +150 Points credited to your profile.");
            this.renderGamesHub();
          }
        });
      }
    };

    updateView();
  }

  // Games Hub Overview Listing
  startSdgChallenge(gameId) {
    if (!this.isGameUnlocked(gameId)) {
      alert("Complete the previous game to unlock this game.");
      return;
    }
    const games = {
      "water-guardian": {
        title: "Water Guardian Sprint", sdgs: "SDG 6: Clean Water", icon: "💧", color: "#0d6efd",
        intro: "Choose the best campus response to protect water quality and reduce waste.", badge: "Water Guardian",
        questions: [
          { prompt: "A hostel tap drips all day. What should happen first?", options: ["Report and repair the leak", "Ignore it because the drop is small", "Increase water pressure"], answer: 0, fact: "Fast leak reporting prevents thousands of litres of water loss." },
          { prompt: "Which practice reduces greywater demand?", options: ["Reuse treated hand-wash water for gardens", "Rinse every path with a hose", "Use fresh water for toilet flushing"], answer: 0, fact: "Safe greywater reuse reduces freshwater demand." },
          { prompt: "What is the safest way to protect a campus stream?", options: ["Keep chemicals and litter out of storm drains", "Flush chemicals into the drain", "Cover the stream with concrete"], answer: 0, fact: "Storm drains can carry pollutants directly to streams." },
          { prompt: "A water test shows high nitrate levels. What is the best response?", options: ["Trace and reduce fertilizer runoff", "Add more fertilizer", "Stop testing"], answer: 0, fact: "Nutrient runoff can cause algal blooms and oxygen loss." }
        ]
      },
      "city-planner": {
        title: "Sustainable City Planner", sdgs: "SDG 11: Sustainable Cities", icon: "🏙️", color: "#6f42c1",
        intro: "Make four planning decisions that keep a growing city inclusive, safe, and low-carbon.", badge: "City Planner",
        questions: [
          { prompt: "A new neighborhood needs transport. Which plan serves more people fairly?", options: ["Frequent buses, walking paths, and cycling lanes", "Only a large parking garage", "A highway through the neighborhood"], answer: 0, fact: "Public and active transport improves access while reducing emissions." },
          { prompt: "Where should a heat-resilient public space be placed?", options: ["Near homes with trees, shade, and drinking water", "Behind an industrial fence", "Only inside a private mall"], answer: 0, fact: "Accessible shaded spaces help people cope with heat." },
          { prompt: "What makes housing more resilient to flooding?", options: ["Protect wetlands and improve permeable drainage", "Build over every wetland", "Remove all rain gardens"], answer: 0, fact: "Wetlands and permeable surfaces absorb stormwater." },
          { prompt: "Which indicator best checks inclusive city progress?", options: ["Access to safe services across neighborhoods", "Number of luxury towers only", "Total road width only"], answer: 0, fact: "Inclusion is measured by equitable access, not construction alone." }
        ]
      },
      "biodiversity-keeper": {
        title: "Biodiversity Keeper", sdgs: "SDG 15: Life on Land", icon: "🌿", color: "#198754",
        intro: "Protect campus habitats by choosing actions that restore ecosystems and support native species.", badge: "Biodiversity Keeper",
        questions: [
          { prompt: "Which planting plan helps local pollinators most?", options: ["Native plants that flower across seasons", "One decorative invasive species", "Artificial grass everywhere"], answer: 0, fact: "Native plants provide food and habitat for local species." },
          { prompt: "What should students do when they see an invasive plant?", options: ["Record it and report it to the campus ecology team", "Spread its seeds", "Move it to a forest"], answer: 0, fact: "Early reporting helps prevent invasive species from spreading." },
          { prompt: "Why are wildlife corridors useful?", options: ["They connect fragmented habitats safely", "They remove all vegetation", "They increase traffic through habitats"], answer: 0, fact: "Connected habitats allow species to move and reproduce." },
          { prompt: "Which campus light policy protects nocturnal wildlife?", options: ["Use shielded, motion-sensitive lights only where needed", "Keep every light at maximum brightness", "Point lights into tree canopies"], answer: 0, fact: "Lower light pollution protects insects, birds, and other night species." }
        ]
      }
    };

    const game = games[gameId];
    if (!game) return;
    this.activeGame = gameId;
    this.challengeGame = game;
    this.challengeIndex = 0;
    this.challengeScore = 0;
    this.renderSdgChallenge();
  }

  renderSdgChallenge() {
    const container = document.getElementById("game-arena-mount");
    const game = this.challengeGame;
    const question = game.questions[this.challengeIndex];
    if (!container || !question) return;

    container.innerHTML = `
      <div class="card-glass p-4 animate-fade-in">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <button class="btn btn-sm btn-outline-secondary" id="btn-exit-challenge"><i class="fa-solid fa-arrow-left me-1"></i> Back to Games Menu</button>
          <span class="badge px-3 py-2" style="background:${game.color}; color:#fff;">${game.sdgs}</span>
        </div>
        <div class="text-center mb-4">
          <div style="font-size:4rem;">${game.icon}</div>
          <h3 class="fw-bold mb-2">${game.title}</h3>
          <p class="text-muted mb-0">${game.intro}</p>
        </div>
        <div class="progress mb-4" style="height:8px;"><div class="progress-bar" style="width:${((this.challengeIndex + 1) / game.questions.length) * 100}%; background:${game.color};"></div></div>
        <p class="small text-muted">Decision ${this.challengeIndex + 1} of ${game.questions.length} · Score: ${this.challengeScore}</p>
        <h4 class="fw-bold mb-4">${question.prompt}</h4>
        <div class="d-grid gap-3">
          ${question.options.map((option, index) => `<button class="btn btn-outline-primary text-start p-3 challenge-option" data-answer="${index}">${String.fromCharCode(65 + index)}. ${option}</button>`).join("")}
        </div>
      </div>`;

    document.getElementById("btn-exit-challenge").addEventListener("click", () => this.renderGamesHub());
    container.querySelectorAll(".challenge-option").forEach(button => {
      button.addEventListener("click", () => this.answerSdgChallenge(Number(button.dataset.answer)));
    });
  }

  answerSdgChallenge(answer) {
    const question = this.challengeGame.questions[this.challengeIndex];
    const buttons = document.querySelectorAll(".challenge-option");
    buttons.forEach(button => { button.disabled = true; });
    const selected = buttons[answer];
    if (answer === question.answer) {
      this.challengeScore += 100;
      if (selected) selected.classList.replace("btn-outline-primary", "btn-success");
    } else {
      if (selected) selected.classList.replace("btn-outline-primary", "btn-danger");
      if (buttons[question.answer]) buttons[question.answer].classList.replace("btn-outline-primary", "btn-success");
    }
    const feedback = document.createElement("p");
    feedback.className = "alert alert-light border mt-4 mb-0";
    feedback.innerHTML = `<strong>${answer === question.answer ? "Correct!" : "Not quite."}</strong> ${question.fact}`;
    document.querySelector("#game-arena-mount .d-grid").after(feedback);
    setTimeout(() => {
      this.challengeIndex++;
      if (this.challengeIndex >= this.challengeGame.questions.length) this.finishSdgChallenge();
      else this.renderSdgChallenge();
    }, 1100);
  }

  finishSdgChallenge() {
    const rewardPoints = Math.round(this.challengeScore / 2);
    const student = window.appState.state.currentUser;
    if (student && rewardPoints > 0) {
      student.points = (student.points || 0) + rewardPoints;
      if (!student.badges.includes(this.challengeGame.badge)) student.badges.push(this.challengeGame.badge);
      window.appState.save();
      window.appState.saveGameScore({ gameId: this.activeGame, score: this.challengeScore });
    }
    this.unlockNextGame(this.activeGame);
    const container = document.getElementById("game-arena-mount");
    if (!container) return;
    container.innerHTML = `<div class="card-glass text-center p-5 animate-fade-in"><div style="font-size:4rem;">${this.challengeGame.icon}</div><h2 class="fw-bold">Challenge Complete!</h2><p class="text-muted">${this.challengeGame.title}</p><h3 class="text-primary">${this.challengeScore} / ${this.challengeGame.questions.length * 100}</h3><p class="text-warning fw-bold">+${rewardPoints} SDG reward points</p><button class="btn btn-primary me-2" id="btn-replay-challenge">Play Again</button><button class="btn btn-outline-secondary" id="btn-back-challenge">Games Hub</button></div>`;
    document.getElementById("btn-replay-challenge").addEventListener("click", () => this.startSdgChallenge(this.activeGame));
    document.getElementById("btn-back-challenge").addEventListener("click", () => this.renderGamesHub());
  }

  renderGamesHub() {
    const container = document.getElementById("student-subpage-container");
    if (!container) return;

    container.innerHTML = `
      <div class="games-hub-wrapper animate-fade-in">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <div>
            <h3 class="fw-bold mb-1">🎮 SDG Interactive Mini-Games</h3>
            <p class="text-muted mb-0">Complete each game to unlock the next one. Learn sustainability through challenges, high scores, and SDG reward points.</p>
          </div>
        </div>

        <div id="game-arena-mount">
          <div class="row g-4">
            <!-- Game 1: Eco-Sorter -->
            <div class="col-md-6">
              <div class="card-glass game-teaser-card h-100 p-4 d-flex flex-column justify-content-between">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="badge bg-warning-soft text-dark px-3 py-2">
                      <i class="fa-solid fa-arrows-rotate me-1 text-warning"></i> SDG 12: Circular Economy
                    </span>
                    <span class="badge bg-primary-soft text-primary px-2 py-1">Fast Arcade (45s)</span>
                  </div>

                  <div class="text-center my-3">
                    <span style="font-size: 4rem;">♻️</span>
                  </div>

                  <h4 class="fw-bold mb-2">Eco-Sorter Challenge</h4>
                  <p class="text-muted small">
                    Sort incoming campus waste items into Compost, Recyclables, E-Waste, or Landfill before time runs out. Build combos to multiply points!
                  </p>
                </div>

                <div class="mt-3">
                  <button class="btn btn-primary w-100 py-2 fw-bold" id="btn-launch-eco-sorter">
                    <i class="fa-solid fa-play me-2"></i> Play Eco-Sorter Challenge
                  </button>
                </div>
              </div>
            </div>

            <!-- Game 2: NetZero Campus Grid -->
            <div class="col-md-6">
              <div class="card-glass game-teaser-card h-100 p-4 d-flex flex-column justify-content-between">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="badge bg-success-soft text-success px-3 py-2">
                      <i class="fa-solid fa-leaf me-1"></i> SDG 7 & 13: Climate & Energy
                    </span>
                    <span class="badge bg-info-soft text-info px-2 py-1">Strategy Simulator</span>
                  </div>

                  <div class="text-center my-3">
                    <span style="font-size: 4rem;">⚡</span>
                  </div>

                  <h4 class="fw-bold mb-2">NetZero Campus Grid Architect</h4>
                  <p class="text-muted small">
                    Balance a $100k budget across solar arrays, battery storage, native forests, and LED retrofits to drive campus carbon emissions to Zero!
                  </p>
                </div>

                <div class="mt-3">
                  <button class="btn btn-success w-100 py-2 fw-bold" id="btn-launch-netzero">
                    <i class="fa-solid fa-sliders me-2"></i> Launch NetZero Simulator
                  </button>
                </div>
              </div>
            </div>

            <!-- Game 3: Water Guardian -->
            <div class="col-md-6">
              <div class="card-glass game-teaser-card h-100 p-4 d-flex flex-column justify-content-between">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="badge bg-primary-soft text-primary px-3 py-2"><i class="fa-solid fa-droplet me-1"></i> SDG 6: Clean Water</span>
                    <span class="badge bg-info-soft text-info px-2 py-1">Decision Sprint</span>
                  </div>
                  <div class="text-center my-3"><span style="font-size:4rem;">💧</span></div>
                  <h4 class="fw-bold mb-2">Water Guardian Sprint</h4>
                  <p class="text-muted small">Respond to leaks, runoff, and water-quality problems in a campus sustainability challenge.</p>
                </div>
                <button class="btn btn-primary w-100 py-2 fw-bold" id="btn-launch-water-guardian"><i class="fa-solid fa-play me-2"></i> Play Water Guardian</button>
              </div>
            </div>

            <!-- Game 4: Sustainable City Planner -->
            <div class="col-md-6">
              <div class="card-glass game-teaser-card h-100 p-4 d-flex flex-column justify-content-between">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="badge px-3 py-2" style="background:#6f42c120;color:#6f42c1;"><i class="fa-solid fa-city me-1"></i> SDG 11: Sustainable Cities</span>
                    <span class="badge bg-info-soft text-info px-2 py-1">Planning Sprint</span>
                  </div>
                  <div class="text-center my-3"><span style="font-size:4rem;">🏙️</span></div>
                  <h4 class="fw-bold mb-2">Sustainable City Planner</h4>
                  <p class="text-muted small">Make tough planning choices about transport, housing, public space, and flood resilience.</p>
                </div>
                <button class="btn btn-primary w-100 py-2 fw-bold" id="btn-launch-city-planner"><i class="fa-solid fa-play me-2"></i> Plan the City</button>
              </div>
            </div>

            <!-- Game 5: Biodiversity Keeper -->
            <div class="col-md-6">
              <div class="card-glass game-teaser-card h-100 p-4 d-flex flex-column justify-content-between">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="badge bg-success-soft text-success px-3 py-2"><i class="fa-solid fa-seedling me-1"></i> SDG 15: Life on Land</span>
                    <span class="badge bg-info-soft text-info px-2 py-1">Ecology Sprint</span>
                  </div>
                  <div class="text-center my-3"><span style="font-size:4rem;">🌿</span></div>
                  <h4 class="fw-bold mb-2">Biodiversity Keeper</h4>
                  <p class="text-muted small">Protect habitats, native species, pollinators, and wildlife corridors around campus.</p>
                </div>
                <button class="btn btn-success w-100 py-2 fw-bold" id="btn-launch-biodiversity"><i class="fa-solid fa-play me-2"></i> Protect Biodiversity</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const launchButtons = {
      "eco-sorter": "btn-launch-eco-sorter",
      "net-zero": "btn-launch-netzero",
      "water-guardian": "btn-launch-water-guardian",
      "city-planner": "btn-launch-city-planner",
      "biodiversity-keeper": "btn-launch-biodiversity"
    };
    this.gameOrder.forEach(gameId => {
      if (this.isGameUnlocked(gameId)) return;
      const button = document.getElementById(launchButtons[gameId]);
      if (!button) return;
      button.disabled = true;
      button.className = "btn btn-light text-muted border w-100 py-2 fw-bold";
      button.innerHTML = '<i class="fa-solid fa-lock me-2"></i> Locked';
      button.closest(".game-teaser-card")?.classList.add("opacity-75");
    });

    document.getElementById("btn-launch-eco-sorter").addEventListener("click", () => this.startEcoSorter());
    document.getElementById("btn-launch-netzero").addEventListener("click", () => this.startNetZero());
    document.getElementById("btn-launch-water-guardian").addEventListener("click", () => this.startSdgChallenge("water-guardian"));
    document.getElementById("btn-launch-city-planner").addEventListener("click", () => this.startSdgChallenge("city-planner"));
    document.getElementById("btn-launch-biodiversity").addEventListener("click", () => this.startSdgChallenge("biodiversity-keeper"));
  }
}

window.gamesEngine = new GamesEngine();
