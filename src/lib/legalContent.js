export const LEGAL_DOCUMENTS = {
  privacy: {
    title: "Privacy Policy",
    updated: "June 9, 2026",
    sections: [
      {
        heading: "Overview",
        body: [
          "Prelude (“we,” “us,” or “our”) provides student-led college admissions counseling, mentor matching, and AI-assisted guidance. This Privacy Policy explains how we collect, use, and protect personal information when you use our website, dashboard, and related services (collectively, the “Services”)."
        ]
      },
      {
        heading: "Information we collect",
        body: [
          "Account information such as your name, email address, password, role (student, mentor, or parent), and profile details you choose to provide.",
          "Admissions-related information including high school, grade level, intended major, college interests, application timelines, and responses to questionnaires or chat prompts.",
          "Usage data such as pages viewed, features used, device type, browser, IP address, and approximate location derived from IP.",
          "Communications including messages with mentors, support requests, and Prelude AI chat transcripts.",
          "Payment information processed by our payment provider. Prelude does not store full card numbers on our servers."
        ]
      },
      {
        heading: "How we use information",
        body: [
          "Provide and personalize the Services, including mentor matching, college recommendations, and dashboard features.",
          "Operate Prelude AI, improve response quality, and troubleshoot product issues.",
          "Process subscriptions, send service-related notices, and respond to support requests.",
          "Analyze aggregated usage to improve reliability, security, and user experience.",
          "Comply with legal obligations and enforce our Terms of Service."
        ]
      },
      {
        heading: "AI chat and recordings",
        body: [
          "Conversations with Prelude AI may be stored and reviewed to improve our models, safety systems, and product experience. Do not share passwords, full payment card numbers, or other highly sensitive credentials in chat.",
          "Where required by law or where you request deletion, we will remove or anonymize applicable chat history subject to reasonable retention limits."
        ]
      },
      {
        heading: "How we share information",
        body: [
          "With mentors or students when you use messaging or scheduling features, according to your account role and settings.",
          "With service providers that help us host infrastructure, process payments, send email, or analyze product usage. These providers may access data only to perform services for Prelude.",
          "When required by law, regulation, legal process, or to protect the rights, safety, and security of Prelude, our users, or others.",
          "We do not sell personal information."
        ]
      },
      {
        heading: "Data retention and security",
        body: [
          "We retain information for as long as your account is active or as needed to provide the Services, comply with law, resolve disputes, and enforce agreements.",
          "We use administrative, technical, and organizational safeguards designed to protect personal information. No method of transmission or storage is completely secure."
        ]
      },
      {
        heading: "Your choices and rights",
        body: [
          "You may update profile information in your account settings where available.",
          "You may request access, correction, or deletion of personal information by contacting us at privacy@prelude.app.",
          "You may opt out of non-essential marketing emails using the unsubscribe link in those messages.",
          "Depending on where you live, you may have additional privacy rights under applicable law."
        ]
      },
      {
        heading: "Children and students",
        body: [
          "Prelude is designed for students preparing for college. Users under 18 should use the Services with permission from a parent or guardian where required. Parents may contact us regarding a minor’s account."
        ]
      },
      {
        heading: "Changes and contact",
        body: [
          "We may update this Privacy Policy from time to time. Material changes will be posted on this page with an updated effective date.",
          "Questions about this policy can be sent to privacy@prelude.app or through the contact section on our website."
        ]
      }
    ]
  },
  terms: {
    title: "Terms of Service",
    updated: "June 9, 2026",
    sections: [
      {
        heading: "Agreement",
        body: [
          "By accessing or using Prelude’s website, dashboard, AI tools, or related services (the “Services”), you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the Services.",
          "If you create an account on behalf of a student, you represent that you have authority to accept these Terms for that user."
        ]
      },
      {
        heading: "Eligibility",
        body: [
          "You must provide accurate registration information and keep your account credentials secure.",
          "You must be at least 13 years old to use the Services, or the minimum age required in your jurisdiction, and comply with any parental consent requirements that apply."
        ]
      },
      {
        heading: "Services and disclaimers",
        body: [
          "Prelude offers college admissions guidance, mentor connections, planning tools, and AI-assisted information. We do not guarantee admission to any school, scholarship award, or specific outcome.",
          "Prelude AI provides general informational support and may be incomplete or inaccurate. It is not a substitute for professional counseling, legal, medical, or financial advice. You are responsible for verifying important decisions with qualified advisors and official school sources."
        ]
      },
      {
        heading: "Accounts and acceptable use",
        body: [
          "You are responsible for activity under your account and for maintaining the confidentiality of your login credentials.",
          "You agree not to misuse the Services, including by attempting unauthorized access, scraping or reverse engineering the platform, harassing other users, uploading unlawful content, or using Prelude to spam or mislead others.",
          "We may suspend or terminate accounts that violate these Terms or create risk for Prelude or other users."
        ]
      },
      {
        heading: "Mentors and user content",
        body: [
          "Mentors are independent contributors. Prelude does not employ every mentor as an agent of the company, and mentor guidance represents their own experience and perspective.",
          "You retain ownership of content you submit, but grant Prelude a license to host, display, and process that content as needed to operate the Services, including AI features and support."
        ]
      },
      {
        heading: "Subscriptions and payments",
        body: [
          "Paid plans, billing cycles, and feature limits are described at checkout or on our pricing pages. By subscribing, you authorize Prelude and our payment processor to charge applicable fees.",
          "Fees are generally non-refundable except where required by law or explicitly stated in a separate refund policy.",
          "We may change pricing or plan features with reasonable notice where required."
        ]
      },
      {
        heading: "Intellectual property",
        body: [
          "Prelude owns the platform, branding, software, and content we create, except for user-provided content and third-party materials. You may not copy, modify, or distribute Prelude materials without permission."
        ]
      },
      {
        heading: "Limitation of liability",
        body: [
          "The Services are provided on an “as is” and “as available” basis to the fullest extent permitted by law. Prelude disclaims warranties of merchantability, fitness for a particular purpose, and non-infringement.",
          "To the maximum extent permitted by law, Prelude will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or admissions outcomes arising from use of the Services."
        ]
      },
      {
        heading: "Changes and contact",
        body: [
          "We may modify these Terms from time to time. Continued use after changes become effective constitutes acceptance of the revised Terms.",
          "Questions about these Terms may be sent to legal@prelude.app or through the contact section on our website."
        ]
      }
    ]
  }
};

export function getLegalDocument(type) {
  return LEGAL_DOCUMENTS[type] ?? null;
}
