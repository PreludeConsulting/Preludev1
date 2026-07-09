export const LANGUAGES = [
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "es", label: "Español", shortLabel: "ES" },
  { code: "ko", label: "한국어", shortLabel: "KO" },
  { code: "zh", label: "中文（普通话）", shortLabel: "ZH" }
];

export const DEFAULT_LANGUAGE = "en";

export const translations = {
  en: {
    languageSwitcher: {
      buttonLabel: "Change language",
      menuLabel: "Select website language",
      current: "Language"
    },
    nav: {
      homeLabel: "Prelude home",
      primaryLabel: "Primary navigation",
      searchLabel: "Search Prelude",
      searchPlaceholder: "Search Prelude...",
      searchNoResults: "No results found",
      menuOpenLabel: "Open menu",
      menuCloseLabel: "Close menu",
      signIn: "Sign in",
      getStarted: "Get Started",
      searchItems: {
        financialAid: "Financial Aid",
        collegeList: "College List",
        applicationStrategy: "Application Strategy",
        mentorMatching: "Mentor Matching"
      },
      links: {
        about: "About",
        admissions: "Admissions Counseling",
        mentoring: "Mentoring",
        mentoringClarity: "Mentoring & Clarity",
        mentors: "Mentors",
        pricing: "Pricing",
        satPrepTutoring: "SAT Prep & Tutoring",
        clarity: "Clarity",
        contact: "Contact",
        dashboard: "Dashboard"
      }
    },
    hero: {
      headline: ["College admissions,", "", "made simple."],
      cinematicOpener: ["Four minutes of context.", "One mentor who actually fits."],
      typingPrefix: "made",
      typingPhrases: ["simple.", "personal.", "clearer.", "possible.", "less stressful."],
      subcopy: "Access a network of students from top universities who guide you through every step of the admissions process.",
      emailLabel: "Email address",
      emailPlaceholder: "Enter your email address",
      cta: "Book free call",
      note: "Start free, then get matched with a mentor from your dream school."
    },
    mentors: {
      eyebrow: "Mentor directory",
      headline: "Meet example mentors from standout universities.",
      body: "Explore the kind of college students who can help with essays, school lists, majors, and the day-to-day questions that come up during admissions.",
      primaryCta: "Get matched",
      secondaryCta: "View plans",
      heroCardTitle: "Student mentors",
      heroCardStat: "Front-facing guidance",
      directoryEyebrow: "Example mentors",
      directoryTitle: "A preview of the Prelude network"
    },
    carousel: {
      heading: "Mentorship from students at top universities"
    },
    studentNetwork: {
      headline: "A whole team helping you succeed.",
      subheadline: "Instead of relying on outdated consultants, students get direct access to modern college mentors who recently lived through the admissions process.",
      insightTitle: "Learn from different experiences",
      insightDescription: "Talk to students who understand exactly what you're going through.",
      helpTitle: "Need help now? Your mentor is always within reach",
      graphic: {
        label: "Modern mentor network",
        you: "You",
        student: "High school student",
        majors: {
          business: "Business",
          biology: "Biology",
          engineering: "Engineering"
        }
      },
      chat: {
        roleLine: "Mentor · Georgia Tech · CS",
        status: "Online",
        scheduleZoom: "Schedule Zoom",
        messages: [
          "Hey Maya, I keep rewriting my personal statement and now I have no idea if it's actually getting better.",
          "Haha, you're good~ I think you've just been looking at it for too long.",
          "Tell you what, instead of going back and forth over messages, let's hop on a quick Zoom call sometime this week. I think it'd be way easier to talk through your story together and figure out what's not clicking.",
          "That would help so much! I've been stressing about this for weeks 🥲",
          "Don't worry, we'll get it sorted out. I'll send over a few times that work for me and we'll figure it out together."
        ]
      }
    },
    network: {
      badge: "OUR NETWORK",
      headline: ["Access a network of students", "from top universities"],
      headlineAccent: "top universities",
      subtitle: "Connect with mentors and peers from leading schools across the United States.",
      subheadline: "Built on a network, not a single advisor",
      metrics: [
        {
          value: "25+",
          title: "Universities",
          description: "Represented across the Prelude mentor network."
        },
        {
          value: "<5 hr",
          title: "Mentor Response",
          description: "Get fast answers and guidance whenever questions come up."
        },
        {
          value: "50+",
          title: "Unique Perspectives",
          description: "Learn from students with different backgrounds and admissions journeys."
        }
      ],
      features: [
        {
          title: "Top university students",
          description: "Learn directly from students at leading universities."
        },
        {
          title: "Diverse insights",
          description: "Get advice from mentors with different goals, majors, and experiences."
        },
        {
          title: "Direct communication",
          description: "Message mentors, ask questions, and receive personalized feedback."
        },
        {
          title: "School-specific guidance",
          description: "Understand what actually worked for students at the colleges you're aiming for."
        }
      ],
      messagesVisual: {
        mentorMeta: "Mentor · Georgia Tech · CS",
        studentMeta: "Student · 12th grade",
        searchPlaceholder: "Search conversations…",
        status: "Online",
        scheduleZoom: "Schedule Zoom",
        joinZoom: "Join Zoom",
        composerPlaceholder: "Write a message…",
        threads: [
          {
            preview: "Great progress on your college list — let's focus on your essay strategy next.",
            time: "2h ago"
          },
          {
            preview: "Working on it — I'll share the doc tomorrow morning.",
            time: "1d ago"
          }
        ],
        messages: [
          "Hi Jordan — let's refine your reach schools on Thursday.",
          "Sounds good. I'll update my college list tiers tonight.",
          "Great progress on your college list — let's focus on your essay strategy next."
        ]
      }
    },
    match: {
      ariaLabel: "PreludeMatch interactive demo",
      intro: {
        eyebrow: "PreludeMatch",
        title: "Find your near-peer mentor match.",
        body: "Answer a few quick questions about your goals, target schools, interests, and preferred support style.",
        cta: "Start matching",
        footnote: "Personalized mentor matching powered by Prelude AI"
      }
    },
    sections: {
      cost: {
        imageAlt: "Piggy bank wearing a graduation cap with a 6,500 plus cost callout",
        bodyBefore: "American families spend over",
        bodyAfter: "on college admissions consulting every year.",
        headline: "Spend smarter, not more."
      },
      featureIntro: {
        eyebrow: "The Prelude approach",
        headline: "Affordable admissions support that feels personal, not generic.",
        body: "Traditional consulting is expensive and often disconnected from what students actually experience today. Prelude pairs you with near-peer mentors, practical financial guidance, and tools that keep the process organized — so families invest in clarity, not clutter."
      },
      split: {
        eyebrow: "PreludeMatch",
        headline: "Meet mentors who have already reached where you want to go.",
        body: "Match by target school, major, activities, and goals. Students get guidance from someone who recently navigated the same path — with messaging between sessions and updates parents can follow.",
        bullets: [
          "Current students from your target schools",
          "Steady momentum between Zoom sessions",
          "Clear progress families can see"
        ],
        imageAlt: "PreludeMatch mentorship preview"
      },
      benefits: {
        headline: "Built for Parents",
        imageAlt: "Parent view of a student dashboard showing progress, savings, mentor match, and upcoming milestones."
      },
      academicPrograms: {
        headline: "SAT Prep & Tutoring",
        subheadline: "Personalized support for academics and test preparation.",
        cards: [
          {
            id: "sat-act-prep",
            title: "SAT & ACT Prep",
            price: "$124.99/month",
            featuredCallout: "Weekly 1-on-1 Zoom Sessions",
            description: "Build a personalized testing strategy with guidance from high-achieving mentors.",
            features: [
              "Personalized mentor match",
              "Matched with a mentor from a top university",
              "Personalized study roadmap",
              "Practice test review",
              "Accountability check-ins",
              "Testing strategy guidance"
            ],
            cta: "Find My SAT Mentor",
            ctaHref: "/register?service=sat-mentor-match&ref=academic-programs"
          },
          {
            id: "academic-tutoring",
            title: "Academic Tutoring",
            price: "$159.99/month",
            featuredCallout: "Weekly 1-on-1 Zoom Tutoring",
            description: "Get support in challenging classes and stay on track throughout the school year.",
            features: [
              "Personalized mentor match",
              "Matched based on academic goals and coursework",
              "Math, Science, English & AP support",
              "Homework assistance",
              "Test review",
              "Flexible scheduling"
            ],
            cta: "Find My Academic Mentor",
            ctaHref: "/register?service=academic-mentor-match&ref=academic-programs"
          }
        ]
      },
      plans: {
        eyebrow: "Plans",
        headline: "Support that grows with your goals.",
        body: "Book a free call with us. Upgrade for more sessions, essay support, financial strategy, and more.",
        mostPopular: "Most popular",
        bestValue: "Best Value",
        pleaseWait: "Please wait...",
        priceLabels: {
          free: "Free",
          paid: "Paid",
          perMonth: " / month"
        },
        startFree: "Choose Basic",
        choose: "Choose {{plan}}",
        notices: {
          basicFree: "Create an account to choose the Basic plan, then complete checkout to get started.",
          signInFirst: "Create or sign into an account first. Your subscription will attach to that account when Stripe is connected.",
          comingSoon: "Paid subscriptions are coming soon. Plan checkout will turn on after Stripe is connected.",
          unavailable: "Billing is not available right now."
        },
        cards: [
          {
            id: "basic",
            name: "Basic",
            description: "Foundational support from real college mentors.",
            features: [
              "Monthly group mentor session",
              "PreludeMatch mentor pairing",
              "Assigned mentor messaging",
              "Personalized student roadmap",
              "Guidance from real admissions experience"
            ]
          },
          {
            id: "plus",
            name: "Plus",
            description: "More mentor access, 1-on-1 support, and rewards.",
            featureHeader: "Everything in Basic, and:",
            features: [
              "2 monthly 1-on-1 sessions",
              "Full mentor-network messaging",
              "Personalized admissions guidance",
              "Earn Prelude Coins for progress",
              "Redeem coins for bonus sessions, multi-mentor essay feedback, tutoring, and more"
            ]
          },
          {
            id: "pro",
            name: "Pro",
            description: "Our highest-touch plan with priority support and full application review.",
            featureHeader: "Everything in Plus, and:",
            features: [
              "4 monthly 1-on-1 sessions",
              "Priority mentor-network messaging",
              "Deeper personalized strategy",
              "Full application review",
              "Essay and activity review included",
              "Earn coins at a higher rate",
              "Advanced milestone rewards",
              "Redeem coins for 1-on-1s, essay review, tutoring, and more"
            ]
          }
        ]
      },
      cta: {
        headline: "Start your Prelude.",
        body: "Book a free call and learn how Prelude can help you reach your college goals.",
        primary: "Book a free call",
        secondary: "Email us"
      },
      footer: {
        body: "Student-led college admissions counseling — smarter spending, real mentors, affordable support.",
        label: "Footer",
        discoverLabel: "Discover footer links",
        discover: "Discover",
        resourcesLabel: "Resource footer links",
        resources: "Resources",
        supportLabel: "Support footer links",
        support: "Support",
        about: "About",
        aboutLabel: "About Prelude links",
        admissions: "Admissions",
        admissionsLabel: "Admissions footer links",
        follow: "Follow",
        copyright: "© 2026 Prelude. All rights reserved.",
        privacy: "Privacy Policy",
        terms: "Terms of Service",
        links: {
          how: "How it works",
          mentorship: "Mentorship",
          pricing: "Pricing",
          contact: "Contact",
          parentDashboard: "Parent dashboard",
          academicSupport: "Academic support",
          preludeMatch: "PreludeMatch",
          bookCall: "Book a call",
          email: "Email us"
        }
      }
    },
    parentDashboard: {
      overview: {
        greeting: "Welcome, {{name}}",
        greetingFallback: "Welcome, there",
        subtitle: "Follow your children's college journey with a simplified Prelude view.",
        childrenTitle: "Your children",
        loading: "Loading linked children…",
        emptyTitle: "No children linked yet",
        emptyDescription: "Ask your student to invite you from Prelude Settings → Family, or enter your email when they sign up.",
        studentFallback: "Student"
      },
      child: {
        viewingLabel: "Viewing child",
        viewingBanner: "Viewing {{name}}'s dashboard — you can add and edit calendar events, but not remove them.",
        backToChildren: "Back to all children",
        navLabel: "Student sections",
        cannotRemoveEvents: "Parents cannot remove calendar events."
      },
      nav: {
        home: "Home",
        myChildren: "My Children",
        summary: "Summary",
        calendar: "Calendar"
      },
      routeMeta: {
        overview: { title: "Parent home", subtitle: "A simplified view of your children on Prelude." },
        children: { title: "Linked children", subtitle: "Children connected to your parent account." },
        calendar: { title: "Calendar", subtitle: "View and help manage your child's schedule." },
        settings: { title: "Profile & settings", subtitle: "Manage your parent account, notifications, and preferences." },
        notifications: { title: "Notifications", subtitle: "Updates about your children, mentors, and meetings." },
        billing: { title: "Plans and billing", subtitle: "Your parent account subscription." },
        help: { title: "Help and support", subtitle: "Resources for parent accounts on Prelude." }
      }
    }
  },
  ko: {
    languageSwitcher: {
      buttonLabel: "언어 변경",
      menuLabel: "웹사이트 언어 선택",
      current: "언어"
    },
    nav: {
      homeLabel: "Prelude 홈",
      primaryLabel: "주요 내비게이션",
      searchLabel: "Prelude 검색",
      searchPlaceholder: "Prelude 검색...",
      searchNoResults: "검색 결과가 없습니다",
      menuOpenLabel: "메뉴 열기",
      menuCloseLabel: "메뉴 닫기",
      signIn: "로그인",
      getStarted: "시작하기",
      searchItems: {
        financialAid: "재정 지원",
        collegeList: "대학 리스트",
        applicationStrategy: "지원 전략",
        mentorMatching: "멘토 매칭"
      },
      links: {
        about: "소개",
        admissions: "입시 상담",
        mentoring: "멘토링",
        mentoringClarity: "멘토링 및 명확성",
        mentors: "멘토",
        pricing: "가격",
        satPrepTutoring: "SAT 준비 및 과외",
        clarity: "명확성",
        contact: "문의",
        dashboard: "대시보드"
      }
    },
    hero: {
      headline: ["대학 입시,", "", "새롭게."],
      cinematicOpener: ["4분이면 충분해요.", "당신에게 맞는 멘토를 찾아드려요."],
      typingPrefix: "",
      typingPhrases: ["더 간단하게.", "더 개인적으로.", "더 명확하게.", "더 가능하게.", "덜 부담스럽게."],
      subcopy: "또래 멘토링, 개인 맞춤 전략, 재정 가이드를 통해 학생들이 자신 있게 돋보이는 지원서를 만들 수 있도록 돕습니다.",
      emailLabel: "이메일 주소",
      emailPlaceholder: "이메일 주소를 입력하세요",
      cta: "무료 상담 예약",
      note: "무료로 시작한 뒤 꿈꾸는 대학의 멘토와 매칭되세요."
    },
    mentors: {
      eyebrow: "멘토 디렉터리",
      headline: "뛰어난 대학의 예시 멘토를 만나보세요.",
      body: "에세이, 학교 리스트, 전공, 입시 과정에서 생기는 일상적인 질문을 도와줄 수 있는 대학생 멘토 유형을 살펴보세요.",
      primaryCta: "매칭 시작하기",
      secondaryCta: "플랜 보기",
      heroCardTitle: "학생 멘토",
      heroCardStat: "직접적인 안내",
      directoryEyebrow: "예시 멘토",
      directoryTitle: "Prelude 네트워크 미리보기"
    },
    carousel: {
      heading: "최상위 대학 학생들에게 받는 멘토링"
    },
    studentNetwork: {
      headline: "당신의 성공을 돕는 온 팀이 함께합니다.",
      subheadline: "오래된 방식의 컨설턴트에 의존하는 대신, 학생들은 최근 입시 과정을 직접 경험한 현대적인 대학생 멘토들과 바로 연결됩니다.",
      insightTitle: "다양한 경험에서 배우세요",
      insightDescription: "당신이 겪고 있는 상황을 정확히 이해하는 학생들과 이야기하세요.",
      helpTitle: "지금 도움이 필요하신가요? 멘토가 항상 가까이 있습니다.",
      graphic: {
        label: "현대적인 멘토 네트워크",
        you: "나",
        student: "고등학생",
        majors: {
          business: "비즈니스",
          biology: "생물학",
          engineering: "공학"
        }
      },
      chat: {
        roleLine: "멘토 · Georgia Tech · CS",
        status: "온라인",
        scheduleZoom: "Zoom 예약",
        messages: [
          "Maya, 자기소개서를 계속 고쳐 쓰고 있는데 이제 정말 나아지고 있는지 모르겠어.",
          "하하, 괜찮아~ 너무 오래 들여다봐서 그런 것 같아.",
          "메시지로 계속 주고받기보다 이번 주에 짧게 Zoom으로 이야기해 보자. 네 이야기를 같이 풀어 보고 어디가 잘 안 맞는지 찾는 게 훨씬 쉬울 것 같아.",
          "그러면 정말 도움이 될 것 같아! 몇 주째 이것 때문에 스트레스였어 🥲",
          "걱정하지 마, 같이 정리해 보자. 내가 가능한 시간을 몇 개 보내 줄게. 함께 맞춰 보자."
        ]
      }
    },
    network: {
      badge: "OUR NETWORK",
      headline: ["최상위 대학 학생", "네트워크에 접근하세요"],
      headlineAccent: "최상위 대학",
      subtitle: "미국 전역의 주요 대학 멘토 및 동료들과 연결하세요.",
      subheadline: "한 명의 상담사가 아닌 네트워크로 만들어진 지원",
      metrics: [
        {
          value: "25+",
          title: "대학",
          description: "Prelude 멘토 네트워크에 포함된 대학들입니다."
        },
        {
          value: "<5 hr",
          title: "평균 멘토 응답 시간",
          description: "질문이 생길 때 신속한 답변, 피드백, 가이드를 받을 수 있습니다."
        },
        {
          value: "50+",
          title: "다양한 관점",
          description: "서로 다른 전공, 배경, 입시 여정을 가진 학생들에게 배울 수 있습니다."
        }
      ],
      features: [
        {
          title: "최상위 대학 학생들",
          description: "주요 대학에 재학 중인 학생들에게 직접 배웁니다."
        },
        {
          title: "다양한 인사이트",
          description: "서로 다른 목표, 전공, 경험을 가진 멘토들에게 조언을 받습니다."
        },
        {
          title: "직접 소통",
          description: "멘토에게 메시지를 보내고 질문하며 개인 맞춤 피드백을 받습니다."
        },
        {
          title: "학교별 맞춤 가이드",
          description: "목표 대학에 합격한 학생들에게 실제로 효과가 있었던 전략을 이해합니다."
        }
      ],
      messagesVisual: {
        mentorMeta: "멘토 · Georgia Tech · CS",
        studentMeta: "학생 · 12학년",
        searchPlaceholder: "대화 검색…",
        status: "온라인",
        scheduleZoom: "Zoom 예약",
        joinZoom: "Zoom 참여",
        composerPlaceholder: "메시지 작성…",
        threads: [
          {
            preview: "대학 리스트가 많이 좋아졌어 — 다음에는 에세이 전략에 집중해 보자.",
            time: "2시간 전"
          },
          {
            preview: "진행 중이야 — 내일 아침에 문서를 공유할게.",
            time: "1일 전"
          }
        ],
        messages: [
          "Jordan — 목요일에 상향 지원 학교 리스트를 더 다듬어 보자.",
          "좋아. 오늘 밤에 대학 리스트 티어를 업데이트할게.",
          "대학 리스트가 많이 좋아졌어 — 다음에는 에세이 전략에 집중해 보자."
        ]
      }
    },
    match: {
      ariaLabel: "PreludeMatch 인터랙티브 데모",
      intro: {
        eyebrow: "PreludeMatch",
        title: "나와 가까운 또래 멘토를 찾아보세요.",
        body: "목표, 관심 대학, 관심사, 원하는 지원 스타일에 대한 몇 가지 빠른 질문에 답하세요.",
        cta: "매칭 시작하기",
        footnote: "Prelude AI가 지원하는 개인 맞춤 멘토 매칭"
      }
    },
    sections: {
      cost: {
        imageAlt: "졸업모를 쓴 돼지저금통과 6,500달러 이상 비용 표시",
        bodyBefore: "미국 가정은 매년 대학 입시 컨설팅에",
        bodyAfter: "이상을 지출합니다.",
        headline: "더 많이 쓰는 것이 아니라, 더 똑똑하게 쓰세요."
      },
      featureIntro: {
        eyebrow: "Prelude 방식",
        headline: "개인적이면서도 부담 없는 입시 지원, 획일적이지 않습니다.",
        body: "전통적인 컨설팅은 비용이 높고 오늘날 학생들이 실제로 겪는 경험과 동떨어진 경우가 많습니다. Prelude는 가까운 또래 멘토, 실용적인 재정 가이드, 과정을 체계적으로 관리하는 도구를 연결해 가족이 혼란이 아닌 명확함에 투자하도록 돕습니다."
      },
      split: {
        eyebrow: "PreludeMatch",
        headline: "당신이 가고 싶은 곳에 이미 도착한 멘토를 만나세요.",
        body: "목표 대학, 전공, 활동, 목표에 맞춰 매칭합니다. 학생들은 최근 같은 길을 지나온 사람에게 가이드를 받고, 세션 사이의 메시지와 학부모가 확인할 수 있는 업데이트까지 함께 받습니다.",
        bullets: [
          "목표 대학에 재학 중인 현재 학생들",
          "Zoom 세션 사이에도 이어지는 꾸준한 추진력",
          "가족이 확인할 수 있는 명확한 진행 상황"
        ],
        imageAlt: "PreludeMatch 멘토링 미리보기"
      },
      benefits: {
        headline: "학부모를 위해 설계되었습니다",
        imageAlt: "학생 진행 상황, 절약, 멘토 매칭, 예정된 마일스톤을 보여주는 학부모용 대시보드 화면."
      },
      academicPrograms: {
        headline: "SAT 준비 및 과외",
        subheadline: "학업과 시험 준비를 위한 맞춤형 지원.",
        cards: [
          {
            id: "sat-act-prep",
            title: "SAT 및 ACT 준비",
            price: "$124.99/월",
            featuredCallout: "주간 1:1 Zoom 세션",
            description: "우수한 멘토의 안내로 맞춤형 시험 전략을 세우세요.",
            features: [
              "맞춤형 멘토 매칭",
              "최상위 대학 멘토와 연결",
              "맞춤형 학습 로드맵",
              "모의고사 리뷰",
              "진행 상황 점검",
              "시험 전략 가이드"
            ],
            cta: "SAT 멘토 찾기",
            ctaHref: "/register?service=sat-mentor-match&ref=academic-programs"
          },
          {
            id: "academic-tutoring",
            title: "학업 과외",
            price: "$159.99/월",
            featuredCallout: "주간 1:1 Zoom 과외",
            description: "어려운 수업에서 지원을 받고 학년 내내 학업을 유지하세요.",
            features: [
              "맞춤형 멘토 매칭",
              "학업 목표와 수업에 맞춰 연결",
              "수학, 과학, 영어 및 AP 지원",
              "숙제 도움",
              "시험 리뷰",
              "유연한 일정"
            ],
            cta: "학업 멘토 찾기",
            ctaHref: "/register?service=academic-mentor-match&ref=academic-programs"
          }
        ]
      },
      plans: {
        eyebrow: "플랜",
        headline: "목표와 함께 성장하는 지원.",
        body: "무료 상담을 예약하세요. 더 많은 세션, 에세이 지원, 재정 전략이 필요할 때 업그레이드하세요.",
        mostPopular: "가장 인기",
        bestValue: "최고의 가치",
        pleaseWait: "잠시만 기다려 주세요...",
        priceLabels: {
          free: "무료",
          paid: "유료",
          perMonth: "/월"
        },
        startFree: "Basic 선택",
        choose: "{{plan}} 선택",
        notices: {
          basicFree: "계정을 만들어 Basic 플랜을 선택한 뒤 결제를 완료하여 시작하세요.",
          signInFirst: "먼저 계정을 만들거나 로그인하세요. Stripe가 연결되면 구독이 해당 계정에 연결됩니다.",
          comingSoon: "유료 구독은 곧 제공됩니다. Stripe 연결 후 플랜 결제가 활성화됩니다.",
          unavailable: "현재 결제를 사용할 수 없습니다."
        },
        cards: [
          {
            id: "basic",
            name: "Basic",
            description: "실제 대학 멘토의 기본 지원.",
            features: [
              "월간 그룹 멘토 세션",
              "PreludeMatch 멘토 매칭",
              "배정된 멘토 메시징",
              "맞춤형 학생 로드맵",
              "실제 입시 경험 기반 가이드"
            ]
          },
          {
            id: "plus",
            name: "Plus",
            description: "더 많은 멘토 접근, 1:1 지원, 리워드.",
            featureHeader: "Basic의 모든 항목과:",
            features: [
              "월 2회 1:1 세션",
              "전체 멘토 네트워크 메시징",
              "맞춤형 입시 가이드",
              "진행에 따른 Prelude 코인 적립",
              "코인으로 추가 세션, 멀티 멘토 에세이 피드백, 과외 등 교환"
            ]
          },
          {
            id: "pro",
            name: "Pro",
            description: "우선 지원과 전체 지원서 검토가 포함된 최고 수준의 플랜.",
            featureHeader: "Plus의 모든 항목과:",
            features: [
              "월 4회 1:1 세션",
              "우선 멘토 네트워크 메시징",
              "더 깊은 맞춤 전략",
              "전체 지원서 검토",
              "에세이 및 활동 검토 포함",
              "더 높은 비율의 코인 적립",
              "고급 마일스톤 리워드",
              "코인으로 1:1, 에세이 검토, 과외 등 교환"
            ]
          }
        ]
      },
      cta: {
        headline: "당신의 Prelude를 시작하세요.",
        body: "무료 상담을 예약하고 Prelude가 대학 목표 달성에 어떻게 도움이 되는지 알아보세요.",
        primary: "무료 상담 예약",
        secondary: "이메일 보내기"
      },
      footer: {
        body: "또래 기반 대학 입시 상담 — 더 똑똑한 지출, 실제 멘토, 부담 없는 지원.",
        label: "푸터",
        discoverLabel: "푸터 탐색 링크",
        discover: "둘러보기",
        resourcesLabel: "푸터 리소스 링크",
        resources: "리소스",
        supportLabel: "푸터 지원 링크",
        support: "지원",
        about: "소개",
        aboutLabel: "Prelude 소개 링크",
        admissions: "입시",
        admissionsLabel: "입시 관련 링크",
        follow: "팔로우",
        copyright: "© 2026 Prelude. 모든 권리 보유.",
        privacy: "개인정보 처리방침",
        terms: "이용약관",
        links: {
          how: "작동 방식",
          mentorship: "멘토링",
          pricing: "가격",
          contact: "문의",
          parentDashboard: "학부모 대시보드",
          academicSupport: "학업 지원",
          preludeMatch: "PreludeMatch",
          bookCall: "상담 예약",
          email: "이메일 문의"
        }
      }
    },
    parentDashboard: {
      overview: {
        greeting: "환영합니다, {{name}}",
        greetingFallback: "환영합니다",
        subtitle: "간소화된 Prelude 화면으로 자녀의 대학 입시 여정을 함께하세요.",
        childrenTitle: "자녀",
        loading: "연결된 자녀를 불러오는 중…",
        emptyTitle: "아직 연결된 자녀가 없습니다",
        emptyDescription: "학생에게 Prelude 설정 → 가족에서 초대를 요청하거나, 가입 시 이메일을 입력하도록 안내하세요.",
        studentFallback: "학생"
      },
      child: {
        viewingLabel: "보고 있는 자녀",
        viewingBanner: "{{name}}의 대시보드를 보고 있습니다 — 일정 이벤트를 추가하고 수정할 수 있지만 삭제는 할 수 없습니다.",
        backToChildren: "모든 자녀로 돌아가기",
        navLabel: "학생 섹션",
        cannotRemoveEvents: "학부모는 일정 이벤트를 삭제할 수 없습니다."
      },
      nav: {
        home: "홈",
        myChildren: "내 자녀",
        summary: "요약",
        calendar: "일정"
      },
      routeMeta: {
        overview: { title: "학부모 홈", subtitle: "Prelude에서 자녀를 간단히 확인하세요." },
        children: { title: "연결된 자녀", subtitle: "학부모 계정에 연결된 자녀입니다." },
        calendar: { title: "일정", subtitle: "자녀의 일정을 확인하고 관리하세요." },
        settings: { title: "프로필 및 설정", subtitle: "학부모 계정, 알림, 환경설정을 관리하세요." },
        notifications: { title: "알림", subtitle: "자녀, 멘토, 미팅에 대한 업데이트입니다." },
        billing: { title: "플랜 및 결제", subtitle: "학부모 계정 구독입니다." },
        help: { title: "도움말 및 지원", subtitle: "Prelude 학부모 계정을 위한 리소스입니다." }
      }
    }
  },
  zh: {
    languageSwitcher: {
      buttonLabel: "更改语言",
      menuLabel: "选择网站语言",
      current: "语言"
    },
    nav: {
      homeLabel: "Prelude 首页",
      primaryLabel: "主导航",
      searchLabel: "搜索 Prelude",
      searchPlaceholder: "搜索 Prelude...",
      searchNoResults: "未找到结果",
      menuOpenLabel: "打开菜单",
      menuCloseLabel: "关闭菜单",
      signIn: "登录",
      getStarted: "开始使用",
      searchItems: {
        financialAid: "经济资助",
        collegeList: "大学清单",
        applicationStrategy: "申请策略",
        mentorMatching: "导师匹配"
      },
      links: {
        about: "关于我们",
        admissions: "升学申请咨询",
        mentoring: "导师辅导",
        mentoringClarity: "导师辅导与清晰规划",
        mentors: "导师",
        pricing: "价格",
        satPrepTutoring: "SAT 备考与辅导",
        clarity: "清晰规划",
        contact: "联系",
        dashboard: "仪表板"
      }
    },
    hero: {
      headline: ["大学申请，", "", "更简单。"],
      cinematicOpener: ["四分钟了解你。", "匹配真正合适的导师。"],
      typingPrefix: "",
      typingPhrases: ["更简单。", "更个性化。", "更清晰。", "更可实现。", "更少压力。"],
      subcopy: "由同龄导师驱动的辅导、个性化策略和财务规划指导，帮助学生自信打造出色的申请材料。",
      emailLabel: "电子邮箱地址",
      emailPlaceholder: "输入你的电子邮箱地址",
      cta: "预约免费咨询",
      note: "先免费开始，然后匹配来自你梦想学校的导师。"
    },
    mentors: {
      eyebrow: "导师目录",
      headline: "认识来自优秀大学的示例导师。",
      body: "了解 Prelude 大学生导师如何帮助学生处理文书、选校名单、专业方向和申请过程中出现的日常问题。",
      primaryCta: "开始匹配",
      secondaryCta: "查看方案",
      heroCardTitle: "学生导师",
      heroCardStat: "面对面式指导",
      directoryEyebrow: "示例导师",
      directoryTitle: "Prelude 导师网络预览"
    },
    carousel: {
      heading: "来自顶尖大学学生的导师辅导"
    },
    studentNetwork: {
      headline: "一支完整团队，助你成功。",
      subheadline: "学生不必依赖过时的顾问，而是可以直接接触刚刚经历过申请过程的现代大学生导师。",
      insightTitle: "向不同经历学习",
      insightDescription: "与真正理解你处境的学生交流。",
      helpTitle: "现在就需要帮助？你的导师随时触手可及。",
      graphic: {
        label: "现代导师网络",
        you: "你",
        student: "高中生",
        majors: {
          business: "商科",
          biology: "生物学",
          engineering: "工程学"
        }
      },
      chat: {
        roleLine: "导师 · Georgia Tech · CS",
        status: "在线",
        scheduleZoom: "预约 Zoom",
        messages: [
          "嘿 Maya，我一直在改个人陈述，现在完全不知道它到底有没有变好。",
          "哈哈，别担心~ 我觉得你只是盯着它看太久了。",
          "这样吧，与其一直发消息来回说，不如这周找个时间快速开个 Zoom。我觉得一起聊你的故事、找出哪里不顺，会容易很多。",
          "那真的太有帮助了！我已经为这个焦虑好几周了 🥲",
          "别担心，我们会一起理清楚。我会发几个我方便的时间，我们一起安排。"
        ]
      }
    },
    network: {
      badge: "OUR NETWORK",
      headline: ["连接顶尖大学", "学生网络"],
      headlineAccent: "顶尖大学",
      subtitle: "与美国各地顶尖学校的导师和同学建立联系。",
      subheadline: "建立在网络之上，而不是只依赖一位顾问",
      metrics: [
        {
          value: "25+",
          title: "大学",
          description: "覆盖 Prelude 导师网络中的代表院校。"
        },
        {
          value: "<5 hr",
          title: "导师平均回复时间",
          description: "当问题出现时，及时获得回答、反馈和指导。"
        },
        {
          value: "50+",
          title: "独特视角",
          description: "向拥有不同专业、背景和申请经历的学生学习。"
        }
      ],
      features: [
        {
          title: "顶尖大学学生",
          description: "直接向就读于领先大学的学生学习。"
        },
        {
          title: "多元洞察",
          description: "从拥有不同目标、专业和经历的导师那里获得建议。"
        },
        {
          title: "直接沟通",
          description: "给导师发消息、提问，并获得个性化反馈。"
        },
        {
          title: "学校定向指导",
          description: "了解目标院校学生实际用过并奏效的申请方法。"
        }
      ],
      messagesVisual: {
        mentorMeta: "导师 · Georgia Tech · CS",
        studentMeta: "学生 · 12 年级",
        searchPlaceholder: "搜索对话…",
        status: "在线",
        scheduleZoom: "预约 Zoom",
        joinZoom: "加入 Zoom",
        composerPlaceholder: "写一条消息…",
        threads: [
          {
            preview: "你的大学清单进展很好——接下来我们专注文书策略。",
            time: "2 小时前"
          },
          {
            preview: "我正在处理——明天早上会分享文档。",
            time: "1 天前"
          }
        ],
        messages: [
          "嗨 Jordan——我们周四再细化一下你的冲刺校清单。",
          "听起来不错。我今晚会更新大学清单分层。",
          "你的大学清单进展很好——接下来我们专注文书策略。"
        ]
      }
    },
    match: {
      ariaLabel: "PreludeMatch 互动演示",
      intro: {
        eyebrow: "PreludeMatch",
        title: "找到适合你的近龄导师。",
        body: "回答几个关于目标、目标院校、兴趣和偏好支持方式的快速问题。",
        cta: "开始匹配",
        footnote: "由 Prelude AI 支持的个性化导师匹配"
      }
    },
    sections: {
      cost: {
        imageAlt: "戴着毕业帽的存钱罐，旁边标注 6,500 美元以上费用",
        bodyBefore: "美国家庭每年在大学申请咨询上花费超过",
        bodyAfter: "。",
        headline: "花得更聪明，而不是更多。"
      },
      featureIntro: {
        eyebrow: "Prelude 方法",
        headline: "负担得起、真正个性化，而不是千篇一律的申请支持。",
        body: "传统咨询费用高昂，而且常常与今天学生真实经历的申请过程脱节。Prelude 将你与近龄导师、实用的财务指导和保持流程有序的工具配对，让家庭投资于清晰，而不是混乱。"
      },
      split: {
        eyebrow: "PreludeMatch",
        headline: "认识已经到达你想去之处的导师。",
        body: "按照目标院校、专业、活动和目标进行匹配。学生从最近走过同样道路的人那里获得指导，并可在课程之间继续发消息，家长也能看到进展更新。",
        bullets: [
          "来自你目标院校的在读学生",
          "Zoom 课程之间也保持稳定推进",
          "家庭可以看见的清晰进展"
        ],
        imageAlt: "PreludeMatch 导师辅导预览"
      },
      benefits: {
        headline: "为家长而打造",
        imageAlt: "家长视角的学生仪表盘，展示进度、节省金额、导师匹配和即将到来的里程碑。"
      },
      academicPrograms: {
        headline: "SAT 备考与辅导",
        subheadline: "为学业和考试准备提供个性化支持。",
        cards: [
          {
            id: "sat-act-prep",
            title: "SAT 与 ACT 备考",
            price: "$124.99/月",
            featuredCallout: "每周 1 对 1 Zoom 课程",
            description: "在优秀导师指导下制定个性化考试策略。",
            features: [
              "个性化导师匹配",
              "匹配顶尖大学导师",
              "个性化学习路线图",
              "模拟考试复盘",
              "进度跟进",
              "考试策略指导"
            ],
            cta: "寻找 SAT 导师",
            ctaHref: "/register?service=sat-mentor-match&ref=academic-programs"
          },
          {
            id: "academic-tutoring",
            title: "学业辅导",
            price: "$159.99/月",
            featuredCallout: "每周 1 对 1 Zoom 辅导",
            description: "在具有挑战性的课程中获得支持，并在整个学年保持进度。",
            features: [
              "个性化导师匹配",
              "根据学业目标和课程匹配",
              "数学、科学、英语与 AP 支持",
              "作业辅导",
              "考试复盘",
              "灵活排课"
            ],
            cta: "寻找学业导师",
            ctaHref: "/register?service=academic-mentor-match&ref=academic-programs"
          }
        ]
      },
      plans: {
        eyebrow: "方案",
        headline: "随着你的目标一起成长的支持。",
        body: "预约免费咨询。当你需要更多课程、文书支持和财务策略时再升级。",
        mostPopular: "最受欢迎",
        bestValue: "超值之选",
        pleaseWait: "请稍候...",
        priceLabels: {
          free: "免费",
          paid: "付费",
          perMonth: "/月"
        },
        startFree: "选择 Basic",
        choose: "选择 {{plan}}",
        notices: {
          basicFree: "创建账户以选择 Basic 方案，然后完成结账即可开始。",
          signInFirst: "请先创建或登录账户。Stripe 连接后，订阅会关联到该账户。",
          comingSoon: "付费订阅即将推出。Stripe 连接后将开启方案结账。",
          unavailable: "当前无法使用计费功能。"
        },
        cards: [
          {
            id: "basic",
            name: "Basic",
            description: "来自真实大学导师的基础支持。",
            features: [
              "每月小组导师课程",
              "PreludeMatch 导师匹配",
              "指定导师消息",
              "个性化学生路线图",
              "来自真实申请经验的指导"
            ]
          },
          {
            id: "plus",
            name: "Plus",
            description: "更多导师接触、1 对 1 支持和奖励。",
            featureHeader: "Basic 的全部内容，以及：",
            features: [
              "每月 2 次 1 对 1 课程",
              "完整导师网络消息",
              "个性化申请指导",
              "通过进度赚取 Prelude 币",
              "用币兑换额外课程、多导师文书反馈、辅导等"
            ]
          },
          {
            id: "pro",
            name: "Pro",
            description: "我们最高接触度的方案，含优先支持和完整申请审核。",
            featureHeader: "Plus 的全部内容，以及：",
            features: [
              "每月 4 次 1 对 1 课程",
              "优先导师网络消息",
              "更深入的个人策略",
              "完整申请审核",
              "含文书与活动审核",
              "更高比例的币赚取",
              "高级里程碑奖励",
              "用币兑换 1 对 1、文书审核、辅导等"
            ]
          }
        ]
      },
      cta: {
        headline: "开始你的 Prelude。",
        body: "预约免费咨询，了解 Prelude 如何帮助你实现大学目标。",
        primary: "预约免费通话",
        secondary: "给我们发邮件"
      },
      footer: {
        body: "由同龄导师驱动的大学申请咨询——更聪明的支出、真实导师、负担得起的支持。",
        label: "页脚",
        discoverLabel: "页脚探索链接",
        discover: "探索",
        resourcesLabel: "页脚资源链接",
        resources: "资源",
        supportLabel: "页脚支持链接",
        support: "支持",
        about: "关于",
        aboutLabel: "关于 Prelude 链接",
        admissions: "升学申请",
        admissionsLabel: "升学申请链接",
        follow: "关注",
        copyright: "© 2026 Prelude. 保留所有权利。",
        privacy: "隐私",
        terms: "条款",
        links: {
          how: "运作方式",
          mentorship: "导师辅导",
          pricing: "价格",
          contact: "联系",
          parentDashboard: "家长控制面板",
          academicSupport: "学术支持",
          preludeMatch: "PreludeMatch",
          bookCall: "预约通话",
          email: "给我们发邮件"
        }
      }
    },
    parentDashboard: {
      overview: {
        greeting: "欢迎，{{name}}",
        greetingFallback: "欢迎",
        subtitle: "通过简化的 Prelude 视图关注孩子的大学申请旅程。",
        childrenTitle: "你的孩子",
        loading: "正在加载已关联的孩子…",
        emptyTitle: "尚未关联孩子",
        emptyDescription: "请让你的学生在 Prelude 设置 → 家庭 中邀请你，或在注册时填写你的邮箱。",
        studentFallback: "学生"
      },
      child: {
        viewingLabel: "正在查看",
        viewingBanner: "正在查看 {{name}} 的仪表盘 — 你可以添加和编辑日历事件，但不能删除。",
        backToChildren: "返回所有孩子",
        navLabel: "学生版块",
        cannotRemoveEvents: "家长无法删除日历事件。"
      },
      nav: {
        home: "首页",
        myChildren: "我的孩子",
        summary: "概览",
        calendar: "日历"
      },
      routeMeta: {
        overview: { title: "家长首页", subtitle: "在 Prelude 上简化查看你的孩子。" },
        children: { title: "已关联的孩子", subtitle: "连接到你家长账户的孩子。" },
        calendar: { title: "日历", subtitle: "查看并协助管理孩子的日程。" },
        settings: { title: "个人资料与设置", subtitle: "管理家长账户、通知和偏好。" },
        notifications: { title: "通知", subtitle: "关于孩子、导师和会议的最新动态。" },
        billing: { title: "方案与账单", subtitle: "你的家长账户订阅。" },
        help: { title: "帮助与支持", subtitle: "Prelude 家长账户相关资源。" }
      }
    }
  },
  es: {
    languageSwitcher: {
      buttonLabel: "Cambiar idioma",
      menuLabel: "Seleccionar idioma del sitio",
      current: "Idioma"
    },
    nav: {
      homeLabel: "Inicio de Prelude",
      primaryLabel: "Navegación principal",
      searchLabel: "Buscar en Prelude",
      searchPlaceholder: "Buscar en Prelude...",
      searchNoResults: "No se encontraron resultados",
      menuOpenLabel: "Abrir menú",
      menuCloseLabel: "Cerrar menú",
      signIn: "Iniciar sesión",
      getStarted: "Comenzar",
      searchItems: {
        financialAid: "Ayuda financiera",
        collegeList: "Lista de universidades",
        applicationStrategy: "Estrategia de solicitud",
        mentorMatching: "Emparejamiento de mentores"
      },
      links: {
        about: "Acerca de",
        admissions: "Asesoría de admisiones",
        mentoring: "Mentoría",
        mentoringClarity: "Mentoría y claridad",
        mentors: "Mentores",
        pricing: "Precios",
        satPrepTutoring: "Preparación SAT y tutoría",
        clarity: "Claridad",
        contact: "Contacto",
        dashboard: "Panel"
      }
    },
    hero: {
      headline: ["Admisiones,", "", "más simples."],
      cinematicOpener: ["Cuatro minutos de contexto.", "Un mentor que realmente encaja."],
      typingPrefix: "",
      typingPhrases: ["más simples.", "más personales.", "más claras.", "más posibles.", "menos estresantes."],
      subcopy: "Accede a una red de estudiantes de universidades líderes que te guían en cada paso del proceso de admisión.",
      emailLabel: "Correo electrónico",
      emailPlaceholder: "Ingresa tu correo electrónico",
      cta: "Reserva una llamada gratis",
      note: "Comienza gratis y luego encuentra un mentor de la universidad de tus sueños."
    },
    mentors: {
      eyebrow: "Directorio de mentores",
      headline: "Conoce mentores de ejemplo de universidades destacadas.",
      body: "Explora el tipo de estudiantes universitarios que pueden ayudar con ensayos, listas de universidades, carreras y preguntas cotidianas de admisiones.",
      primaryCta: "Encontrar mentor",
      secondaryCta: "Ver planes",
      heroCardTitle: "Mentores estudiantes",
      heroCardStat: "Orientación cercana",
      directoryEyebrow: "Mentores de ejemplo",
      directoryTitle: "Una vista previa de la red Prelude"
    },
    carousel: {
      heading: "Mentoría de estudiantes en universidades destacadas"
    },
    studentNetwork: {
      headline: "Un equipo completo que te ayuda a triunfar.",
      subheadline: "En lugar de depender de consultores desactualizados, los estudiantes tienen acceso directo a mentores universitarios actuales que vivieron recientemente el proceso de admisión.",
      insightTitle: "Aprende de experiencias diversas",
      insightDescription: "Habla con estudiantes que entienden exactamente por lo que estás pasando.",
      helpTitle: "¿Necesitas ayuda ahora? Tu mentor siempre está a tu alcance",
      graphic: {
        label: "Red moderna de mentores",
        you: "Tú",
        student: "Estudiante de preparatoria",
        majors: {
          business: "Negocios",
          biology: "Biología",
          engineering: "Ingeniería"
        }
      },
      chat: {
        roleLine: "Mentora · Georgia Tech · CS",
        status: "En línea",
        scheduleZoom: "Agendar Zoom",
        messages: [
          "Hola Maya, sigo reescribiendo mi ensayo personal y ya no sé si realmente está mejorando.",
          "Jaja, vas bien~ creo que solo lo has mirado durante demasiado tiempo.",
          "Te propongo algo: en vez de seguir hablando por mensajes, hagamos una llamada rápida por Zoom esta semana. Creo que será mucho más fácil conversar sobre tu historia y descubrir qué no está funcionando.",
          "¡Eso me ayudaría muchísimo! Llevo semanas estresándome por esto 🥲",
          "No te preocupes, lo vamos a resolver. Te enviaré algunos horarios que me funcionan y lo vemos juntos."
        ]
      }
    },
    network: {
      badge: "OUR NETWORK",
      headline: ["Accede a una red de estudiantes", "de universidades destacadas"],
      headlineAccent: "universidades destacadas",
      subtitle: "Conéctate con mentores y compañeros de las mejores escuelas de Estados Unidos.",
      subheadline: "Construido sobre una red, no un solo asesor",
      metrics: [
        {
          value: "25+",
          title: "Universidades",
          description: "Representadas en la red de mentores de Prelude."
        },
        {
          value: "<5 h",
          title: "Respuesta promedio de mentores",
          description: "Recibe respuestas, comentarios y orientación a tiempo cuando surgen preguntas."
        },
        {
          value: "50+",
          title: "Perspectivas únicas",
          description: "Aprende de estudiantes con distintas carreras, contextos y recorridos de admisión."
        }
      ],
      features: [
        {
          title: "Estudiantes de universidades líderes",
          description: "Aprende directamente de estudiantes en universidades destacadas."
        },
        {
          title: "Perspectivas diversas",
          description: "Recibe consejos de mentores con diferentes metas, carreras y experiencias."
        },
        {
          title: "Comunicación directa",
          description: "Envía mensajes a mentores, haz preguntas y recibe comentarios personalizados."
        },
        {
          title: "Guía específica por universidad",
          description: "Entiende qué funcionó realmente para estudiantes en las universidades a las que aspiras."
        }
      ],
      messagesVisual: {
        mentorMeta: "Mentora · Georgia Tech · CS",
        studentMeta: "Estudiante · 12.º grado",
        searchPlaceholder: "Buscar conversaciones…",
        status: "En línea",
        scheduleZoom: "Agendar Zoom",
        joinZoom: "Unirse a Zoom",
        composerPlaceholder: "Escribe un mensaje…",
        threads: [
          {
            preview: "Gran avance en tu lista de universidades; ahora enfoquémonos en tu estrategia de ensayos.",
            time: "hace 2 h"
          },
          {
            preview: "Estoy trabajando en eso; compartiré el documento mañana por la mañana.",
            time: "hace 1 d"
          }
        ],
        messages: [
          "Hola Jordan: afinemos tus universidades de alcance el jueves.",
          "Suena bien. Actualizaré los niveles de mi lista de universidades esta noche.",
          "Gran avance en tu lista de universidades; ahora enfoquémonos en tu estrategia de ensayos."
        ]
      }
    },
    match: {
      ariaLabel: "Demostración interactiva de PreludeMatch",
      intro: {
        eyebrow: "PreludeMatch",
        title: "Encuentra tu mentor cercano ideal.",
        body: "Responde unas preguntas rápidas sobre tus metas, universidades objetivo, intereses y estilo de apoyo preferido.",
        cta: "Encontrar mentor",
        footnote: "Emparejamiento personalizado de mentores impulsado por Prelude AI"
      }
    },
    sections: {
      cost: {
        imageAlt: "Alcancía con birrete y una referencia de costo de más de 6,500",
        bodyBefore: "Las familias estadounidenses gastan más de",
        bodyAfter: "en consultoría de admisiones universitarias cada año.",
        headline: "Gasta con inteligencia, no de más."
      },
      featureIntro: {
        eyebrow: "El enfoque de Prelude",
        headline: "Apoyo de admisiones accesible que se siente personal, no genérico.",
        body: "La consultoría tradicional es costosa y a menudo está desconectada de lo que viven los estudiantes hoy. Prelude te conecta con mentores cercanos, orientación financiera práctica y herramientas que mantienen el proceso organizado, para que las familias inviertan en claridad, no en confusión."
      },
      split: {
        eyebrow: "PreludeMatch",
        headline: "Conoce mentores que ya llegaron a donde tú quieres llegar.",
        body: "Conecta según tu universidad objetivo, carrera, actividades y metas. Los estudiantes reciben orientación de alguien que recientemente recorrió el mismo camino, con mensajes entre sesiones y actualizaciones que los padres pueden seguir.",
        bullets: [
          "Estudiantes actuales de tus universidades objetivo",
          "Impulso constante entre sesiones por Zoom",
          "Progreso claro que las familias pueden ver"
        ],
        imageAlt: "Vista previa de mentoría PreludeMatch"
      },
      benefits: {
        headline: "Diseñado para padres",
        imageAlt: "Vista para padres de un panel del estudiante con progreso, ahorros, mentor asignado y próximos hitos."
      },
      academicPrograms: {
        headline: "Preparación SAT y tutoría",
        subheadline: "Apoyo personalizado para los estudios y la preparación de exámenes.",
        cards: [
          {
            id: "sat-act-prep",
            title: "Preparación SAT y ACT",
            price: "$124.99/mes",
            featuredCallout: "Sesiones semanales 1 a 1 por Zoom",
            description: "Crea una estrategia de exámenes personalizada con mentores de alto rendimiento.",
            features: [
              "Emparejamiento personalizado con mentor",
              "Conexión con un mentor de una universidad destacada",
              "Hoja de ruta de estudio personalizada",
              "Revisión de exámenes de práctica",
              "Seguimiento de responsabilidad",
              "Orientación de estrategia de exámenes"
            ],
            cta: "Encontrar mi mentor SAT",
            ctaHref: "/register?service=sat-mentor-match&ref=academic-programs"
          },
          {
            id: "academic-tutoring",
            title: "Tutoría académica",
            price: "$159.99/mes",
            featuredCallout: "Tutoría semanal 1 a 1 por Zoom",
            description: "Recibe apoyo en clases difíciles y mantente al día durante todo el año escolar.",
            features: [
              "Emparejamiento personalizado con mentor",
              "Conexión según metas académicas y cursos",
              "Apoyo en matemáticas, ciencias, inglés y AP",
              "Ayuda con tareas",
              "Revisión de exámenes",
              "Horarios flexibles"
            ],
            cta: "Encontrar mi mentor académico",
            ctaHref: "/register?service=academic-mentor-match&ref=academic-programs"
          }
        ]
      },
      plans: {
        eyebrow: "Planes",
        headline: "Apoyo que crece con tus metas.",
        body: "Reserva una llamada gratis con nosotros. Mejora tu plan cuando necesites más sesiones, apoyo con ensayos y estrategia financiera.",
        mostPopular: "Más popular",
        bestValue: "Mejor valor",
        pleaseWait: "Espera un momento...",
        priceLabels: {
          free: "Gratis",
          paid: "De pago",
          perMonth: "/mes"
        },
        startFree: "Elegir Basic",
        choose: "Elegir {{plan}}",
        notices: {
          basicFree: "Crea una cuenta para elegir el plan Basic y completa el pago para empezar.",
          signInFirst: "Crea o inicia sesión en una cuenta primero. Tu suscripción se asociará a esa cuenta cuando Stripe esté conectado.",
          comingSoon: "Las suscripciones pagadas estarán disponibles pronto. El pago de los planes se activará cuando Stripe esté conectado.",
          unavailable: "La facturación no está disponible en este momento."
        },
        cards: [
          {
            id: "basic",
            name: "Basic",
            description: "Apoyo fundamental de mentores universitarios reales.",
            features: [
              "Sesión mensual de mentoría grupal",
              "Emparejamiento con mentor PreludeMatch",
              "Mensajería con mentor asignado",
              "Hoja de ruta personalizada del estudiante",
              "Orientación basada en experiencia real de admisiones"
            ]
          },
          {
            id: "plus",
            name: "Plus",
            description: "Más acceso a mentores, apoyo 1 a 1 y recompensas.",
            featureHeader: "Todo lo de Basic, y además:",
            features: [
              "2 sesiones 1 a 1 al mes",
              "Mensajería con toda la red de mentores",
              "Orientación personalizada de admisiones",
              "Gana Prelude Coins por tu progreso",
              "Canjea monedas por sesiones extra, comentarios de ensayos con varios mentores, tutoría y más"
            ]
          },
          {
            id: "pro",
            name: "Pro",
            description: "Nuestro plan de mayor contacto con apoyo prioritario y revisión completa de solicitudes.",
            featureHeader: "Todo lo de Plus, y además:",
            features: [
              "4 sesiones 1 a 1 al mes",
              "Mensajería prioritaria con la red de mentores",
              "Estrategia personalizada más profunda",
              "Revisión completa de solicitudes",
              "Revisión de ensayos y actividades incluida",
              "Gana monedas a una tasa más alta",
              "Recompensas avanzadas por hitos",
              "Canjea monedas por sesiones 1 a 1, revisión de ensayos, tutoría y más"
            ]
          }
        ]
      },
      cta: {
        headline: "Comienza tu Prelude.",
        body: "Reserva una llamada gratis y descubre cómo Prelude puede ayudarte a alcanzar tus metas universitarias.",
        primary: "Agenda una llamada gratis",
        secondary: "Escríbenos"
      },
      footer: {
        body: "Asesoría de admisiones universitarias entre pares: gasto inteligente, mentores reales y apoyo accesible.",
        label: "Pie de página",
        discoverLabel: "Enlaces de descubrimiento del pie de página",
        discover: "Descubre",
        resourcesLabel: "Enlaces de recursos del pie de página",
        resources: "Recursos",
        supportLabel: "Enlaces de soporte del pie de página",
        support: "Soporte",
        about: "Acerca de",
        aboutLabel: "Enlaces sobre Prelude",
        admissions: "Admisiones",
        admissionsLabel: "Enlaces de admisiones",
        follow: "Síguenos",
        copyright: "© 2026 Prelude. Todos los derechos reservados.",
        privacy: "Privacidad",
        terms: "Términos",
        links: {
          how: "Cómo funciona",
          mentorship: "Mentoría",
          pricing: "Precios",
          contact: "Contacto",
          parentDashboard: "Panel para padres",
          academicSupport: "Apoyo académico",
          preludeMatch: "PreludeMatch",
          bookCall: "Agenda una llamada",
          email: "Escríbenos"
        }
      }
    },
    parentDashboard: {
      overview: {
        greeting: "Bienvenido, {{name}}",
        greetingFallback: "Bienvenido",
        subtitle: "Sigue el camino universitario de tus hijos con una vista simplificada de Prelude.",
        childrenTitle: "Tus hijos",
        loading: "Cargando hijos vinculados…",
        emptyTitle: "Aún no hay hijos vinculados",
        emptyDescription: "Pide a tu estudiante que te invite desde Prelude Configuración → Familia, o ingresa tu correo cuando se registre.",
        studentFallback: "Estudiante"
      },
      child: {
        viewingLabel: "Viendo a",
        viewingBanner: "Viendo el panel de {{name}} — puedes agregar y editar eventos del calendario, pero no eliminarlos.",
        backToChildren: "Volver a todos los hijos",
        navLabel: "Secciones del estudiante",
        cannotRemoveEvents: "Los padres no pueden eliminar eventos del calendario."
      },
      nav: {
        home: "Inicio",
        myChildren: "Mis hijos",
        summary: "Resumen",
        calendar: "Calendario"
      },
      routeMeta: {
        overview: { title: "Inicio para padres", subtitle: "Una vista simplificada de tus hijos en Prelude." },
        children: { title: "Hijos vinculados", subtitle: "Hijos conectados a tu cuenta de padre." },
        calendar: { title: "Calendario", subtitle: "Consulta y ayuda a gestionar el horario de tu hijo." },
        settings: { title: "Perfil y configuración", subtitle: "Administra tu cuenta de padre, notificaciones y preferencias." },
        notifications: { title: "Notificaciones", subtitle: "Actualizaciones sobre tus hijos, mentores y reuniones." },
        billing: { title: "Planes y facturación", subtitle: "La suscripción de tu cuenta de padre." },
        help: { title: "Ayuda y soporte", subtitle: "Recursos para cuentas de padres en Prelude." }
      }
    }
  }
};
