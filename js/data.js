// SDG Connect Data Store
// Seed data for 17 SDGs, Quizzes, Activities, CS Deep Learning Mini-Projects, Students, and Submissions

window.SDG_DATA = {
  // 17 UN Sustainable Development Goals
  goals: [
    {
      id: 1, number: "01", name: "No Poverty", shortName: "No Poverty",
      tagline: "End poverty in all its forms everywhere", color: "#E5243B",
      icon: "fa-solid fa-hand-holding-dollar",
      vision: "Eradicate extreme poverty globally, build resilience among vulnerable communities, and guarantee equal rights to economic resources.",
      category: "Society", campusImpact: "Textbook donation drives, student hardship emergency funds, and community tutoring.",
      keyTargets: ["Eradicate extreme poverty for all.", "Ensure equal access to economic resources."]
    },
    {
      id: 2, number: "02", name: "Zero Hunger", shortName: "Zero Hunger",
      tagline: "End hunger, achieve food security and improved nutrition", color: "#DDA63A",
      icon: "fa-solid fa-wheat-awn",
      vision: "Ensure year-round access to safe, nutritious food and promote resilient, sustainable agriculture practices.",
      category: "Biosphere", campusImpact: "Hostel food waste audits, surplus meal recovery, and campus organic composting.",
      keyTargets: ["End hunger and ensure food access.", "Promote sustainable agriculture."]
    },
    {
      id: 3, number: "03", name: "Good Health and Well-being", shortName: "Good Health",
      tagline: "Ensure healthy lives and promote well-being for all at all ages", color: "#4C9F38",
      icon: "fa-solid fa-heart-pulse",
      vision: "Universal health coverage, mental wellness support, and active healthy lifestyles.",
      category: "Society", campusImpact: "Mental wellness workshops, blood donation camps, and campus yoga marathons.",
      keyTargets: ["Promote mental health and emotional well-being.", "Achieve universal healthcare access."]
    },
    {
      id: 4, number: "04", name: "Quality Education", shortName: "Quality Education",
      tagline: "Ensure inclusive and equitable quality education", color: "#C5192D",
      icon: "fa-solid fa-graduation-cap",
      vision: "Equitable education, open educational resources, and STEM training for underserved schools.",
      category: "Society", campusImpact: "Mentoring rural school kids in coding & robotics, peer tutoring pods.",
      keyTargets: ["Ensure equal access to affordable technical education.", "Increase youth digital skills."]
    },
    {
      id: 5, number: "05", name: "Gender Equality", shortName: "Gender Equality",
      tagline: "Achieve gender equality and empower all women and girls", color: "#FF3A21",
      icon: "fa-solid fa-venus-mars",
      vision: "Eliminate discrimination, ensure leadership representation, and foster safe academic environments.",
      category: "Society", campusImpact: "Women in STEM hackathons, leadership mentorship, and campus safety audits.",
      keyTargets: ["End all forms of discrimination.", "Ensure women full participation in leadership."]
    },
    {
      id: 6, number: "06", name: "Clean Water and Sanitation", shortName: "Clean Water",
      tagline: "Ensure availability and sustainable management of water", color: "#26BDE2",
      icon: "fa-solid fa-droplet",
      vision: "Clean drinking water access, reduction of pollution, rainwater harvesting, and smart water management.",
      category: "Biosphere", campusImpact: "Campus IoT smart water leak detectors, rainwater catchment restoration, lake cleanups.",
      keyTargets: ["Achieve safe drinking water for all.", "Substantially increase water-use efficiency."]
    },
    {
      id: 7, number: "07", name: "Affordable and Clean Energy", shortName: "Clean Energy",
      tagline: "Ensure access to affordable, reliable, sustainable and modern energy", color: "#FCC30B",
      icon: "fa-solid fa-solar-panel",
      vision: "Accelerate renewable energy adoption, boost energy efficiency, and transition away from fossil fuels.",
      category: "Economy", campusImpact: "Rooftop solar monitoring dashboards, campus smart lighting retrofits, bicycle charging hubs.",
      keyTargets: ["Increase the share of renewable energy.", "Double the global rate of energy efficiency."]
    },
    {
      id: 8, number: "08", name: "Decent Work and Economic Growth", shortName: "Decent Work",
      tagline: "Promote sustained, inclusive and sustainable economic growth", color: "#A21942",
      icon: "fa-solid fa-briefcase",
      vision: "Promote innovation, entrepreneurship, youth employment, and safe working conditions.",
      category: "Economy", campusImpact: "Student green startup incubators, ethical career fairs, freelance gig skill training.",
      keyTargets: ["Achieve higher levels of productivity through innovation.", "Promote safe work environments."]
    },
    {
      id: 9, number: "09", name: "Industry, Innovation and Infrastructure", shortName: "Innovation",
      tagline: "Build resilient infrastructure, promote sustainable industrialization and foster innovation", color: "#FD6925",
      icon: "fa-solid fa-industry",
      vision: "Foster technological research, develop resilient green infrastructure, and support sustainable industrial processes.",
      category: "Economy", campusImpact: "AI for Sustainability labs, smart IoT campus testbeds, circular economy prototyping.",
      keyTargets: ["Upgrade technological capabilities of industrial sectors.", "Enhance scientific research."]
    },
    {
      id: 10, number: "10", name: "Reduced Inequalities", shortName: "Reduced Inequalities",
      tagline: "Reduce inequality within and among countries", color: "#DD1367",
      icon: "fa-solid fa-scale-balanced",
      vision: "Promote universal social, economic, and political inclusion.",
      category: "Society", campusImpact: "Campus wheelchair accessibility mapping, assistive tech projects, digital divide bridging.",
      keyTargets: ["Empower and promote social, economic and political inclusion for all."]
    },
    {
      id: 11, number: "11", name: "Sustainable Cities and Communities", shortName: "Sustainable Cities",
      tagline: "Make cities inclusive, safe, resilient and sustainable", color: "#FD9D24",
      icon: "fa-solid fa-city",
      vision: "Safe public spaces, accessible green transport, cultural heritage preservation, and disaster risk reduction.",
      category: "Biosphere", campusImpact: "Campus pedestrianization advocacy, EV shuttle scheduling apps, heritage tree mapping.",
      keyTargets: ["Provide access to safe, sustainable transport.", "Reduce environmental impact of cities."]
    },
    {
      id: 12, number: "12", name: "Responsible Consumption and Production", shortName: "Responsible Consumption",
      tagline: "Ensure sustainable consumption and production patterns", color: "#BF8B2E",
      icon: "fa-solid fa-arrows-rotate",
      vision: "Halve per capita food waste, promote 3R (Reduce, Reuse, Recycle), and eliminate single-use plastics.",
      category: "Economy", campusImpact: "Zero single-use plastic campus pledge, swap-shops for electronics, e-waste dismantling workshops.",
      keyTargets: ["Halve food waste.", "Substantially reduce waste through prevention, recycling and reuse."]
    },
    {
      id: 13, number: "13", name: "Climate Action", shortName: "Climate Action",
      tagline: "Take urgent action to combat climate change and its impacts", color: "#3F7E44",
      icon: "fa-solid fa-cloud-sun-rain",
      vision: "Strengthen climate resilience, institutionalize carbon footprint tracking, and educate on climate adaptation.",
      category: "Biosphere", campusImpact: "Campus Carbon Footprint calculator, Miyawaki micro-forest planting, climate policy hackathons.",
      keyTargets: ["Strengthen resilience to climate hazards.", "Improve education on climate change mitigation."]
    },
    {
      id: 14, number: "14", name: "Life Below Water", shortName: "Life Below Water",
      tagline: "Conserve and sustainably use the oceans, seas and marine resources", color: "#0A97D9",
      icon: "fa-solid fa-water",
      vision: "Prevent marine pollution, stop ocean acidification, and restore fragile aquatic ecosystems.",
      category: "Biosphere", campusImpact: "River basin microplastic studies, local wetland conservation, clean waterways campaigns.",
      keyTargets: ["Prevent and significantly reduce marine pollution of all kinds."]
    },
    {
      id: 15, number: "15", name: "Life on Land", shortName: "Life on Land",
      tagline: "Protect, restore and promote sustainable use of terrestrial ecosystems", color: "#56C02B",
      icon: "fa-solid fa-tree",
      vision: "Halt biodiversity loss, reverse land degradation, and reforest degraded lands.",
      category: "Biosphere", campusImpact: "Native biodiversity census, 1000-tree afforestation drives, seed-bomb making.",
      keyTargets: ["Halt deforestation and restore degraded forests.", "Halt the loss of biodiversity."]
    },
    {
      id: 16, number: "16", name: "Peace, Justice and Strong Institutions", shortName: "Peace & Justice",
      tagline: "Promote peaceful and inclusive societies, provide access to justice", color: "#00689D",
      icon: "fa-solid fa-gavel",
      vision: "Promote the rule of law, eradicate corruption, and foster transparent, accountable institutions.",
      category: "Governance", campusImpact: "Campus student council transparency portals, dispute resolution mediation cells.",
      keyTargets: ["Substantially reduce corruption.", "Develop effective, accountable and transparent institutions."]
    },
    {
      id: 17, number: "17", name: "Partnerships for the Goals", shortName: "Partnerships",
      tagline: "Strengthen the means of implementation and revitalize global partnerships", color: "#19486A",
      icon: "fa-solid fa-handshake-angle",
      vision: "Multi-stakeholder partnerships mobilizing resources, technology sharing, and cross-border innovation.",
      category: "Governance", campusImpact: "Inter-university sustainability consortiums, open SDG data hackathons.",
      keyTargets: ["Enhance international cooperation on technology and innovation."]
    }
  ],

  // Activities, Field Actions, and CS Deep Learning Technical Projects
  // Initially blank so LLM / Autonomous AI Agent or Faculty dynamically populates tasks
  activities: [],

  // Quizzes
  quizzes: [
    {
      topicId: "climate-13",
      goalId: 13,
      title: "SDG 13: Climate Action & Carbon Footprint Masterclass",
      badge: "Climate Sentinel",
      icon: "fa-solid fa-cloud-sun-rain",
      color: "#3F7E44",
      timeLimitSeconds: 120,
      questions: [
        {
          id: "q1",
          question: "What is the global temperature rise limit targeted by the Paris Climate Agreement?",
          options: [
            "Well below 2.0°C, aiming for 1.5°C above pre-industrial levels",
            "Below 3.5°C above pre-industrial levels",
            "Exactly 0.5°C above pre-industrial levels",
            "No limit set as long as carbon trading is active"
          ],
          correctIndex: 0,
          explanation: "The Paris Agreement aims to hold global average temperature increase to well below 2°C above pre-industrial levels and pursue efforts to limit it to 1.5°C."
        },
        {
          id: "q2",
          question: "Which greenhouse gas has a global warming potential (GWP) roughly 28-36 times higher than CO2 over 100 years?",
          options: ["Methane (CH4)", "Water Vapor (H2O)", "Nitrogen (N2)", "Argon (Ar)"],
          correctIndex: 0,
          explanation: "Methane is a potent greenhouse gas with a warming potential estimated between 28 and 36 times that of CO2 over a century."
        },
        {
          id: "q3",
          question: "What does 'Net Zero emissions' specifically mean for an institution?",
          options: [
            "Emitting zero carbon by shutting down all electricity",
            "Balancing greenhouse gas emissions produced with an equivalent amount removed from the atmosphere",
            "Only purchasing carbon offsets without reducing actual emissions",
            "Relying entirely on coal with scrubbers"
          ],
          correctIndex: 1,
          explanation: "Net Zero means achieving an overall balance between emissions produced and emissions sequestered or removed from the atmosphere."
        }
      ]
    },
    {
      topicId: "energy-7",
      goalId: 7,
      title: "SDG 7: Affordable & Clean Energy Technologies",
      badge: "Clean Spark Pioneer",
      icon: "fa-solid fa-bolt",
      color: "#FCC30B",
      timeLimitSeconds: 120,
      questions: [
        {
          id: "q1",
          question: "Which renewable energy source converts sunlight directly into electricity via the photovoltaic effect?",
          options: ["Solar Photovoltaic (PV) Panels", "Concentrated Solar Thermal (CSP)", "Geothermal binary turbines", "Hydroelectric wheels"],
          correctIndex: 0,
          explanation: "Solar PV panels utilize semiconductor materials to convert photons directly into electric current through the photovoltaic effect."
        },
        {
          id: "q2",
          question: "What is the primary benefit of a 'Smart Microgrid' on a university campus?",
          options: [
            "Allows the campus to intelligently balance renewable generation, battery storage, and grid demand with resilience during outages",
            "Increases electricity consumption by 50%",
            "Bans laptop use after sunset",
            "Replaces all cables with satellite microwaves"
          ],
          correctIndex: 0,
          explanation: "Smart microgrids optimize local renewable energy generation, battery storage, and critical loads with resilience."
        }
      ]
    },
    {
      topicId: "consumption-12",
      goalId: 12,
      title: "SDG 12: Circular Economy & Zero Waste Habits",
      badge: "Circular Champion",
      icon: "fa-solid fa-arrows-rotate",
      color: "#BF8B2E",
      timeLimitSeconds: 120,
      questions: [
        {
          id: "q1",
          question: "In the Waste Hierarchy, which step provides the greatest environmental benefit?",
          options: ["Refuse / Prevention (Source Reduction)", "Recycling into low-grade plastic", "Incineration for energy recovery", "Engineered Landfill"],
          correctIndex: 0,
          explanation: "Preventing waste before it is created (Refusing & Reducing) saves raw materials and pollution most effectively."
        },
        {
          id: "q2",
          question: "What constitutes a 'Circular Economy' compared to a traditional linear economy?",
          options: [
            "Designing out waste and keeping materials/products in loop use indefinitely through repair, reuse, and remanufacturing",
            "Take, Make, and Dispose model",
            "Dumping waste into circular trenches",
            "Printing round coins instead of rectangular paper money"
          ],
          correctIndex: 0,
          explanation: "A circular economy aims to design out waste and pollution, keep products in use, and regenerate natural systems."
        }
      ]
    },
    {
      topicId: "water-6", goalId: 6, title: "SDG 6: Water Systems & Resilience Challenge", badge: "Water Systems Analyst", icon: "fa-solid fa-droplet", color: "#26BDE2", difficulty: "Advanced", timeLimitSeconds: 180,
      questions: [
        { id: "q1", question: "A campus reports lower water use but unchanged groundwater stress. What is most plausible?", options: ["Use shifted to an unmetered borewell or external supply", "Rainfall automatically replenished all aquifers", "Lower use always proves lower water stress", "Groundwater stress is unrelated to withdrawals"], correctIndex: 0, explanation: "Metered reductions can hide leakage, unmetered abstraction, or a change in supply source." },
        { id: "q2", question: "Which intervention follows the strongest water-sensitive hierarchy?", options: ["Reduce demand, repair losses, reuse treated water, then add supply", "Build tanks before measuring demand", "Treat all wastewater as potable immediately", "Increase pumping to guarantee availability"], correctIndex: 0, explanation: "Demand reduction and loss control should precede reuse and new supply." },
        { id: "q3", question: "Which metric best evaluates a campus rainwater program?", options: ["Verified potable-water displacement normalized for rainfall and demand", "Number of tanks installed", "Total rainfall alone", "Project budget"], correctIndex: 0, explanation: "The useful outcome is reliable, normalized displacement of potable demand." }
      ]
    },
    {
      topicId: "cities-11", goalId: 11, title: "SDG 11: Sustainable Campus & Urban Design", badge: "Resilient Campus Planner", icon: "fa-solid fa-city", color: "#FD9D24", difficulty: "Advanced", timeLimitSeconds: 180,
      questions: [
        { id: "q1", question: "A cycle lane has high usage but pedestrian injuries rise nearby. What should be investigated first?", options: ["Intersection design, crossing priority, speed, and conflict points", "Remove all cycling infrastructure", "Count bicycle trips only", "Assume users are violating rules"], correctIndex: 0, explanation: "Safety depends on conflict geometry, speeds, sightlines, and priority rules." },
        { id: "q2", question: "Which approach best reduces heat exposure for vulnerable campus users?", options: ["Combine shade, cool surfaces, water, route access, and heat alerts", "Install one decorative tree", "Measure only daily maximum temperature", "Move all activities indoors"], correctIndex: 0, explanation: "Heat resilience requires layered protection and access for vulnerable groups." },
        { id: "q3", question: "What evidence best supports a claim that public-space investment improved inclusion?", options: ["Before/after usage and safety data disaggregated by users and accessibility needs", "One positive testimonial", "Construction cost", "Staff aesthetic ratings"], correctIndex: 0, explanation: "Inclusion claims need comparable outcome evidence across groups and time." }
      ]
    },
    {
      topicId: "industry-9", goalId: 9, title: "SDG 9: Innovation, Infrastructure & Responsible AI", badge: "Responsible Innovation Engineer", icon: "fa-solid fa-microchip", color: "#FD6925", difficulty: "Advanced", timeLimitSeconds: 180,
      questions: [
        { id: "q1", question: "A model has 98% accuracy on imbalanced data but fails the minority class. Which metric matters most?", options: ["Per-class recall/precision or macro-F1", "Accuracy alone", "Training time", "Parameter count"], correctIndex: 0, explanation: "Macro metrics prevent a dominant class from hiding minority-class failure." },
        { id: "q2", question: "What is the strongest control against data leakage?", options: ["Split by time or entity before feature engineering and fit transforms only on training data", "Increase epochs", "Use a larger test set after tuning", "Duplicate rare samples across all splits"], correctIndex: 0, explanation: "Evaluation boundaries must be respected during splitting and preprocessing." },
        { id: "q3", question: "Which design best supports a maintainable campus IoT deployment?", options: ["Documented interfaces, device identity, monitoring, failure modes, and staged rollout", "One deployment with no rollback", "Hard-coded credentials", "Collect every signal without a purpose"], correctIndex: 0, explanation: "Reliable infrastructure needs identity, observability, security, and reversibility." }
      ]
    },
    {
      topicId: "biodiversity-15", goalId: 15, title: "SDG 15: Biodiversity, Soil & Ecosystem Evidence", badge: "Ecosystem Evidence Keeper", icon: "fa-solid fa-seedling", color: "#56C02B", difficulty: "Advanced", timeLimitSeconds: 180,
      questions: [
        { id: "q1", question: "Why is species richness alone insufficient to assess biodiversity recovery?", options: ["It ignores abundance, composition, functional roles, and native versus invasive gains", "Richness always equals health", "Richness measures soil carbon", "Only mammals affect biodiversity"], correctIndex: 0, explanation: "Multiple indicators are needed to distinguish healthy recovery from simple species counts." },
        { id: "q2", question: "Which sampling design gives stronger evidence for a habitat intervention?", options: ["Repeated standardized sampling with comparable control and intervention areas", "One survey after planting", "Only the most attractive area", "Changing methods every visit"], correctIndex: 0, explanation: "Controls and repeated comparable sampling help separate intervention effects from seasonal variation." },
        { id: "q3", question: "A soil amendment increases plant growth but reduces microbial diversity. What is the best conclusion?", options: ["Evaluate the trade-off over time with multiple ecosystem indicators before scaling", "The intervention is automatically successful", "Plant height proves soil recovery", "Microbial diversity is irrelevant"], correctIndex: 0, explanation: "Short-term productivity can conflict with longer-term ecosystem function." }
      ]
    },
    {
      topicId: "education-4", goalId: 4, title: "SDG 4: Education Equity & Learning Impact", badge: "Learning Impact Strategist", icon: "fa-solid fa-graduation-cap", color: "#C5192D", difficulty: "Advanced", timeLimitSeconds: 180,
      questions: [
        { id: "q1", question: "A course has high completion but large achievement gaps. What is the strongest conclusion?", options: ["Completion hides unequal outcomes; disaggregated learning evidence is required", "The course is equitable", "The gap is only motivation", "More exams automatically remove the gap"], correctIndex: 0, explanation: "Equity requires examining outcomes, support access, and barriers across groups." },
        { id: "q2", question: "Which design best tests whether peer mentoring improved learning?", options: ["Compare baseline and follow-up outcomes with a suitable comparison group", "Count mentor meetings", "Ask mentors if it worked", "Measure attendance once"], correctIndex: 0, explanation: "A comparison design provides stronger evidence than activity counts or opinions." },
        { id: "q3", question: "What best demonstrates meaningful learning transfer?", options: ["Students apply concepts to a new real-world problem and explain their reasoning", "Students memorize more definitions", "Students spend more time online", "Students receive more notifications"], correctIndex: 0, explanation: "Applying knowledge in an unfamiliar context demonstrates deeper learning." }
      ]
    }
  ],

  // User information initially blank - populated dynamically via registration, social login, or backend DB
  students: [],
  faculty: [],
  submissions: []
};
