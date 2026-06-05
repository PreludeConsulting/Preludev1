export const LANGUAGES = [
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "es", label: "Español", shortLabel: "ES" }
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
        pricing: "Pricing",
        roadmap: "Roadmap",
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
      headline: "Access a network of students from top universities",
      subheadline: "Built on a network, not a single advisor",
      metrics: [
        {
          value: "25+",
          title: "Universities",
          description: "Represented across the Prelude mentor network."
        },
        {
          value: "<5 hr",
          title: "Average mentor response",
          description: "Get timely answers, feedback, and guidance when questions come up."
        },
        {
          value: "50+",
          title: "Unique perspectives",
          description: "Learn from students with different majors, backgrounds, and admissions journeys."
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
        eyebrow: "Why families choose Prelude",
        headline: "Clarity for students. Confidence for parents.",
        body: "You dream it. We map it — match, build, and apply with a roadmap that keeps everyone aligned.",
        cards: [
          {
            title: "Guidance students trust",
            text: "Talk to mentors who recently went through admissions and understand the pressure — not outdated playbooks."
          },
          {
            title: "Smarter spending",
            text: "Scholarship strategy, aid comparisons, and financial planning so families know where every dollar goes."
          },
          {
            title: "A story, not just a resume",
            text: "Build identity, essays, and activities into a compelling narrative — with AI organizing deadlines along the way."
          }
        ]
      },
      plans: {
        eyebrow: "Plans",
        headline: "Support that grows with your goals.",
        body: "Start free with Basic. Upgrade when you need more sessions, essay support, and financial strategy.",
        mostPopular: "Most popular",
        pleaseWait: "Please wait...",
        priceLabels: {
          free: "Free",
          paid: "Paid"
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
        pricing: "Precios",
        roadmap: "Ruta",
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
      headline: "Accede a una red de estudiantes de universidades destacadas",
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
        eyebrow: "Por qué las familias eligen Prelude",
        headline: "Claridad para estudiantes. Confianza para padres.",
        body: "Tú lo sueñas. Nosotros lo trazamos: conectar, construir y aplicar con una ruta que mantiene a todos alineados.",
        cards: [
          {
            title: "Orientación en la que confían los estudiantes",
            text: "Habla con mentores que recientemente vivieron el proceso de admisión y entienden la presión, no con estrategias anticuadas."
          },
          {
            title: "Gasto más inteligente",
            text: "Estrategia de becas, comparación de ayuda financiera y planificación para que las familias sepan a dónde va cada dólar."
          },
          {
            title: "Una historia, no solo un currículum",
            text: "Construye identidad, ensayos y actividades en una narrativa convincente, con IA organizando fechas límite en el camino."
          }
        ]
      },
      plans: {
        eyebrow: "Planes",
        headline: "Apoyo que crece con tus metas.",
        body: "Empieza gratis con Basic. Mejora cuando necesites más sesiones, apoyo con ensayos y estrategia financiera.",
        mostPopular: "Más popular",
        pleaseWait: "Espera un momento...",
        priceLabels: {
          free: "Gratis",
          paid: "De pago"
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
