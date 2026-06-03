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
      signIn: "Sign in",
      getStarted: "Get Started",
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
      signIn: "Iniciar sesión",
      getStarted: "Comenzar",
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
