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
        pricing: "Pricing",
        clarity: "Clarity",
        dashboard: "Dashboard"
      }
    },
    hero: {
      headline: ["College admissions", "counseling,", "reimagined."],
      subcopy: "Peer-powered mentorship, personalized strategy, and financial guidance to help students build standout applications with confidence.",
      emailLabel: "Email address",
      emailPlaceholder: "Enter your email address",
      cta: "Start free trial",
      note: "Start free, then get matched with a mentor from your dream school."
    },
    carousel: {
      heading: "Mentorship from students at top universities"
    },
    studentNetwork: {
      headline: "How Prelude's student network changes college guidance",
      subheadline: "Instead of relying on outdated consultants, students get direct access to modern college mentors who recently lived through the admissions process.",
      insightTitle: "Real students. Real insight.",
      insightDescription: "Prelude connects high schoolers with college students who understand today's admissions process, campus culture, majors, essays, and student life firsthand.",
      helpTitle: "Help when you need it",
      helpDescription: "Questions do not wait for the next scheduled meeting. Prelude mentors can step in, message back, and suggest a call when a student needs real support.",
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
      headline: ["Access a network of students", "from top universities"],
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
      plans: {
        eyebrow: "Plans",
        headline: "Support that grows with your goals.",
        body: "Start free with Basic. Upgrade when you need more sessions, essay support, and financial strategy.",
        mostPopular: "Most popular",
        pleaseWait: "Please wait...",
        priceLabels: {
          free: "Free",
          paid: "Paid",
          perMonth: "/month"
        },
        startFree: "Start free",
        choose: "Choose {{plan}}",
        notices: {
          basicFree: "Basic is free. Create an account to start, then upgrade when paid subscriptions are available.",
          signInFirst: "Create or sign into a free Basic account first. Paid subscriptions will attach to that account when Stripe is connected.",
          comingSoon: "Paid subscriptions are coming soon. Basic is free today, and Plus/Pro checkout will turn on after Stripe is connected.",
          unavailable: "Billing is not available right now."
        },
        cards: [
          {
            id: "basic",
            name: "Basic",
            description: "Foundational guidance for students beginning their college journey.",
            features: [
              "Monthly group mentorship session",
              "Access to a matched mentor through PreludeMatch",
              "Limited direct messaging",
              "Personalized college roadmap",
              "Progress tracking",
              "General essay brainstorming support",
              "Financial aid and scholarship resources",
              "General consultant support"
            ]
          },
          {
            id: "plus",
            name: "Plus",
            description: "More personalized guidance and consistent support.",
            features: [
              "Everything in Basic",
              "Two 1-on-1 mentor sessions per month",
              "Additional monthly group strategy session",
              "Expanded direct messaging",
              "Customized college and application roadmap",
              "Identity-building coaching",
              "Essay feedback and revision support",
              "Peer benchmarking insights"
            ]
          },
          {
            id: "pro",
            name: "Pro",
            description: "End-to-end support for students aiming for top-tier outcomes.",
            features: [
              "Everything in Plus",
              "Weekly or biweekly 1-on-1 mentor sessions",
              "Priority mentor matching",
              "Priority direct messaging",
              "Comprehensive essay editing",
              "Full application review",
              "Interview preparation",
              "School-specific admissions strategy",
              "Advanced financial consulting",
              "Parent strategy sessions",
              "Premium gamified progress tracking"
            ]
          }
        ]
      },
      cta: {
        headline: "Start your Prelude.",
        body: "Book a free strategy call and begin admissions with clarity, confidence, and support that respects your budget.",
        primary: "Book a free call",
        secondary: "View plans"
      },
      footer: {
        body: "Peer-powered college admissions counseling — smarter spending, real mentors, affordable support.",
        label: "Footer",
        copyright: "© 2026 Prelude. All rights reserved.",
        privacy: "Privacy",
        terms: "Terms",
        links: {
          how: "How it works",
          mentorship: "Mentorship",
          pricing: "Pricing",
          contact: "Contact"
        }
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
        pricing: "가격",
        clarity: "명확성",
        dashboard: "대시보드"
      }
    },
    hero: {
      headline: ["대학 입시", "상담,", "새롭게."],
      subcopy: "또래 멘토링, 개인 맞춤 전략, 재정 가이드를 통해 학생들이 자신 있게 돋보이는 지원서를 만들 수 있도록 돕습니다.",
      emailLabel: "이메일 주소",
      emailPlaceholder: "이메일 주소를 입력하세요",
      cta: "무료로 시작하기",
      note: "무료로 시작한 뒤 꿈꾸는 대학의 멘토와 매칭되세요."
    },
    carousel: {
      heading: "최상위 대학 학생들에게 받는 멘토링"
    },
    studentNetwork: {
      headline: "Prelude의 학생 네트워크가 대학 상담을 바꾸는 방식",
      subheadline: "오래된 방식의 컨설턴트에 의존하는 대신, 학생들은 최근 입시 과정을 직접 경험한 현대적인 대학생 멘토들과 바로 연결됩니다.",
      insightTitle: "진짜 학생. 진짜 인사이트.",
      insightDescription: "Prelude는 고등학생을 오늘의 입시 과정, 캠퍼스 문화, 전공, 에세이, 학생 생활을 직접 이해하는 대학생들과 연결합니다.",
      helpTitle: "필요할 때 받는 도움",
      helpDescription: "질문은 다음 정기 미팅까지 기다려 주지 않습니다. 학생에게 실질적인 지원이 필요할 때 Prelude 멘토가 메시지로 답하고 통화를 제안할 수 있습니다.",
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
      headline: ["최상위 대학 학생", "네트워크에 접근하세요"],
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
      plans: {
        eyebrow: "플랜",
        headline: "목표와 함께 성장하는 지원.",
        body: "Basic으로 무료 시작하세요. 더 많은 세션, 에세이 지원, 재정 전략이 필요할 때 업그레이드하세요.",
        mostPopular: "가장 인기",
        pleaseWait: "잠시만 기다려 주세요...",
        priceLabels: {
          free: "무료",
          paid: "유료",
          perMonth: "/월"
        },
        startFree: "무료로 시작하기",
        choose: "{{plan}} 선택",
        notices: {
          basicFree: "Basic은 무료입니다. 계정을 만들어 시작한 뒤 유료 구독이 제공되면 업그레이드하세요.",
          signInFirst: "먼저 무료 Basic 계정을 만들거나 로그인하세요. Stripe가 연결되면 유료 구독이 해당 계정에 연결됩니다.",
          comingSoon: "유료 구독은 곧 제공됩니다. 현재 Basic은 무료이며 Stripe 연결 후 Plus/Pro 결제가 활성화됩니다.",
          unavailable: "현재 결제를 사용할 수 없습니다."
        },
        cards: [
          {
            id: "basic",
            name: "Basic",
            description: "대학 여정을 시작하는 학생을 위한 기본 가이드.",
            features: [
              "월 1회 그룹 멘토링 세션",
              "PreludeMatch를 통한 맞춤 멘토 접근",
              "제한된 직접 메시지",
              "개인 맞춤 대학 로드맵",
              "진행 상황 추적",
              "일반적인 에세이 브레인스토밍 지원",
              "재정 지원 및 장학금 리소스",
              "일반 컨설턴트 지원"
            ]
          },
          {
            id: "plus",
            name: "Plus",
            description: "더 개인화된 가이드와 꾸준한 지원.",
            features: [
              "Basic의 모든 항목",
              "월 2회 1:1 멘토 세션",
              "월 1회 추가 그룹 전략 세션",
              "확장된 직접 메시지",
              "맞춤형 대학 및 지원 로드맵",
              "정체성 구축 코칭",
              "에세이 피드백 및 수정 지원",
              "또래 벤치마킹 인사이트"
            ]
          },
          {
            id: "pro",
            name: "Pro",
            description: "최상위 결과를 목표로 하는 학생을 위한 전방위 지원.",
            features: [
              "Plus의 모든 항목",
              "매주 또는 격주 1:1 멘토 세션",
              "우선 멘토 매칭",
              "우선 직접 메시지",
              "종합 에세이 편집",
              "전체 지원서 검토",
              "인터뷰 준비",
              "학교별 입시 전략",
              "고급 재정 컨설팅",
              "학부모 전략 세션",
              "프리미엄 게임화 진행 추적"
            ]
          }
        ]
      },
      cta: {
        headline: "당신의 Prelude를 시작하세요.",
        body: "무료 전략 상담을 예약하고, 예산을 존중하는 명확함과 자신감, 지원으로 입시를 시작하세요.",
        primary: "무료 상담 예약",
        secondary: "플랜 보기"
      },
      footer: {
        body: "또래 기반 대학 입시 상담 — 더 똑똑한 지출, 실제 멘토, 부담 없는 지원.",
        label: "푸터",
        copyright: "© 2026 Prelude. 모든 권리 보유.",
        privacy: "개인정보 처리방침",
        terms: "이용약관",
        links: {
          how: "작동 방식",
          mentorship: "멘토링",
          pricing: "가격",
          contact: "문의"
        }
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
        pricing: "价格",
        clarity: "清晰规划",
        dashboard: "仪表板"
      }
    },
    hero: {
      headline: ["大学申请", "咨询，", "重新想象。"],
      subcopy: "由同龄导师驱动的辅导、个性化策略和财务规划指导，帮助学生自信打造出色的申请材料。",
      emailLabel: "电子邮箱地址",
      emailPlaceholder: "输入你的电子邮箱地址",
      cta: "免费开始试用",
      note: "先免费开始，然后匹配来自你梦想学校的导师。"
    },
    carousel: {
      heading: "来自顶尖大学学生的导师辅导"
    },
    studentNetwork: {
      headline: "Prelude 的学生网络如何改变大学申请指导",
      subheadline: "学生不必依赖过时的顾问，而是可以直接接触刚刚经历过申请过程的现代大学生导师。",
      insightTitle: "真实学生。真实洞察。",
      insightDescription: "Prelude 将高中生与大学生连接起来，这些大学生亲身了解当下的申请流程、校园文化、专业、文书和学生生活。",
      helpTitle: "在你需要时获得帮助",
      helpDescription: "问题不会等到下一次预约会议才出现。当学生需要真正的支持时，Prelude 导师可以介入、回复消息，并建议安排通话。",
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
      headline: ["连接顶尖大学", "学生网络"],
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
      plans: {
        eyebrow: "方案",
        headline: "随着你的目标一起成长的支持。",
        body: "从免费的 Basic 开始。当你需要更多课程、文书支持和财务策略时再升级。",
        mostPopular: "最受欢迎",
        pleaseWait: "请稍候...",
        priceLabels: {
          free: "免费",
          paid: "付费",
          perMonth: "/月"
        },
        startFree: "免费开始",
        choose: "选择 {{plan}}",
        notices: {
          basicFree: "Basic 免费。创建账户即可开始，等付费订阅可用后再升级。",
          signInFirst: "请先创建或登录免费的 Basic 账户。Stripe 连接后，付费订阅会关联到该账户。",
          comingSoon: "付费订阅即将推出。Basic 目前免费，Stripe 连接后将开启 Plus/Pro 结账。",
          unavailable: "当前无法使用计费功能。"
        },
        cards: [
          {
            id: "basic",
            name: "Basic",
            description: "为刚开始大学申请旅程的学生提供基础指导。",
            features: [
              "每月一次小组导师辅导课程",
              "通过 PreludeMatch 获得匹配导师",
              "有限的直接消息",
              "个性化大学路线图",
              "进度追踪",
              "一般文书头脑风暴支持",
              "经济资助和奖学金资源",
              "一般顾问支持"
            ]
          },
          {
            id: "plus",
            name: "Plus",
            description: "更个性化的指导和持续支持。",
            features: [
              "Basic 的全部内容",
              "每月两次 1 对 1 导师课程",
              "每月额外一次小组策略课程",
              "更多直接消息",
              "定制大学与申请路线图",
              "身份构建辅导",
              "文书反馈和修改支持",
              "同龄人基准洞察"
            ]
          },
          {
            id: "pro",
            name: "Pro",
            description: "为追求顶尖结果的学生提供端到端支持。",
            features: [
              "Plus 的全部内容",
              "每周或每两周一次 1 对 1 导师课程",
              "优先导师匹配",
              "优先直接消息",
              "全面文书编辑",
              "完整申请审核",
              "面试准备",
              "学校定向申请策略",
              "高级财务咨询",
              "家长策略课程",
              "高级游戏化进度追踪"
            ]
          }
        ]
      },
      cta: {
        headline: "开始你的 Prelude。",
        body: "预约一次免费策略通话，用清晰、自信和尊重预算的支持开启申请之路。",
        primary: "预约免费通话",
        secondary: "查看方案"
      },
      footer: {
        body: "由同龄导师驱动的大学申请咨询——更聪明的支出、真实导师、负担得起的支持。",
        label: "页脚",
        copyright: "© 2026 Prelude. 保留所有权利。",
        privacy: "隐私",
        terms: "条款",
        links: {
          how: "运作方式",
          mentorship: "导师辅导",
          pricing: "价格",
          contact: "联系"
        }
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
        pricing: "Precios",
        clarity: "Claridad",
        dashboard: "Panel"
      }
    },
    hero: {
      headline: ["Asesoría de", "admisiones", "reinventada."],
      subcopy: "Mentoría entre pares, estrategia personalizada y orientación financiera para ayudar a los estudiantes a crear solicitudes destacadas con confianza.",
      emailLabel: "Correo electrónico",
      emailPlaceholder: "Ingresa tu correo electrónico",
      cta: "Empieza gratis",
      note: "Comienza gratis y luego encuentra un mentor de la universidad de tus sueños."
    },
    carousel: {
      heading: "Mentoría de estudiantes en universidades destacadas"
    },
    studentNetwork: {
      headline: "Cómo la red estudiantil de Prelude transforma la orientación universitaria",
      subheadline: "En lugar de depender de consultores desactualizados, los estudiantes tienen acceso directo a mentores universitarios actuales que vivieron recientemente el proceso de admisión.",
      insightTitle: "Estudiantes reales. Perspectiva real.",
      insightDescription: "Prelude conecta a estudiantes de preparatoria con universitarios que entienden de primera mano el proceso de admisión actual, la cultura del campus, las carreras, los ensayos y la vida estudiantil.",
      helpTitle: "Ayuda cuando la necesitas",
      helpDescription: "Las preguntas no esperan a la próxima reunión programada. Los mentores de Prelude pueden intervenir, responder mensajes y sugerir una llamada cuando un estudiante necesita apoyo real.",
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
      headline: ["Accede a una red de estudiantes", "de universidades destacadas"],
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
      plans: {
        eyebrow: "Planes",
        headline: "Apoyo que crece con tus metas.",
        body: "Empieza gratis con Basic. Mejora cuando necesites más sesiones, apoyo con ensayos y estrategia financiera.",
        mostPopular: "Más popular",
        pleaseWait: "Espera un momento...",
        priceLabels: {
          free: "Gratis",
          paid: "De pago",
          perMonth: "/mes"
        },
        startFree: "Empieza gratis",
        choose: "Elegir {{plan}}",
        notices: {
          basicFree: "Basic es gratis. Crea una cuenta para empezar y mejora cuando las suscripciones pagadas estén disponibles.",
          signInFirst: "Crea o inicia sesión en una cuenta Basic gratis primero. Las suscripciones pagadas se asociarán a esa cuenta cuando Stripe esté conectado.",
          comingSoon: "Las suscripciones pagadas estarán disponibles pronto. Basic es gratis hoy y el pago de Plus/Pro se activará cuando Stripe esté conectado.",
          unavailable: "La facturación no está disponible en este momento."
        },
        cards: [
          {
            id: "basic",
            name: "Basic",
            description: "Orientación fundamental para estudiantes que comienzan su camino universitario.",
            features: [
              "Sesión mensual de mentoría grupal",
              "Acceso a un mentor asignado por PreludeMatch",
              "Mensajería directa limitada",
              "Ruta universitaria personalizada",
              "Seguimiento del progreso",
              "Apoyo general para lluvia de ideas de ensayos",
              "Recursos de ayuda financiera y becas",
              "Apoyo general de consultoría"
            ]
          },
          {
            id: "plus",
            name: "Plus",
            description: "Orientación más personalizada y apoyo constante.",
            features: [
              "Todo lo incluido en Basic",
              "Dos sesiones 1 a 1 con mentor al mes",
              "Sesión mensual adicional de estrategia grupal",
              "Más mensajería directa",
              "Ruta personalizada para universidades y solicitudes",
              "Coaching para construir identidad",
              "Comentarios y revisión de ensayos",
              "Perspectivas de comparación con pares"
            ]
          },
          {
            id: "pro",
            name: "Pro",
            description: "Apoyo integral para estudiantes que buscan resultados de alto nivel.",
            features: [
              "Todo lo incluido en Plus",
              "Sesiones 1 a 1 semanales o quincenales",
              "Asignación prioritaria de mentor",
              "Mensajería directa prioritaria",
              "Edición completa de ensayos",
              "Revisión completa de solicitudes",
              "Preparación para entrevistas",
              "Estrategia de admisión por universidad",
              "Consultoría financiera avanzada",
              "Sesiones estratégicas para padres",
              "Seguimiento de progreso gamificado premium"
            ]
          }
        ]
      },
      cta: {
        headline: "Comienza tu Prelude.",
        body: "Agenda una llamada estratégica gratis y empieza admisiones con claridad, confianza y apoyo que respeta tu presupuesto.",
        primary: "Agenda una llamada gratis",
        secondary: "Ver planes"
      },
      footer: {
        body: "Asesoría de admisiones universitarias entre pares: gasto inteligente, mentores reales y apoyo accesible.",
        label: "Pie de página",
        copyright: "© 2026 Prelude. Todos los derechos reservados.",
        privacy: "Privacidad",
        terms: "Términos",
        links: {
          how: "Cómo funciona",
          mentorship: "Mentoría",
          pricing: "Precios",
          contact: "Contacto"
        }
      }
    }
  }
};
