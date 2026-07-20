const mediaBase = (import.meta.env?.BASE_URL ?? "/");

export const EXAMPLE_MENTORS = [
  {
    name: "Ryan Cain",
    university: "University of Pennsylvania",
    institutionShort: "Penn",
    major: "Engineering",
    specialty: "STEM",
    specialties: ["STEM", "Engineering essays", "Project stories"],
    description: "Software developer with standout project experience and a strong understanding of what makes a compelling CS application.",
    emblem: `${mediaBase}media/universities/upenn.svg`,
    photo: `${mediaBase}media/mentors/declan-brooks.png`,
    objectPosition: "50% 50%"
  },
  {
    name: "Kai Koblentz",
    university: "Cornell University",
    institutionShort: "Cornell",
    major: "Economics",
    specialty: "Economics",
    specialties: ["Economics", "College List", "Application strategy"],
    description: "Businessman with a talent for interviews and helping students communicate with confidence.",
    emblem: `${mediaBase}media/universities/cornell.svg`,
    photo: `${mediaBase}media/mentors/kai-koblentz.png`,
    objectPosition: "50% 20%"
  },
  {
    name: "Asim Yoonas",
    university: "Georgia Tech",
    institutionShort: "Georgia Tech",
    major: "Computer Science",
    specialty: "STEM",
    specialties: ["STEM", "Research positioning", "Technical activities"],
    description: "Sports medicine specialist known for strong time management and helping students build a strong, personalized roadmap.",
    emblem: `${mediaBase}media/universities/georgia-tech.png`,
    photo: `${mediaBase}media/mentors/asim-patel.png`,
    objectPosition: "50% 50%"
  },
  {
    name: "Jessica Li",
    university: "Brown University",
    institutionShort: "Brown",
    major: "Business",
    specialty: "Ivy Admissions",
    specialties: ["Ivy Admissions", "Leadership", "Entrepreneurship"],
    description: "Consultant and essay mentor with a sharp entrepreneurial mindset who helps students turn ambitious ideas into compelling applications.",
    emblem: `${mediaBase}media/universities/brown.svg`,
    photo: `${mediaBase}media/mentors/harrison-kim.png`,
    objectPosition: "50% 50%"
  },
  {
    name: "Hyunbin Moon",
    university: "Brown University",
    institutionShort: "Brown",
    major: "English",
    specialty: "Essays",
    specialties: ["Essays", "Personal statements", "Application voice"],
    description: "Sports agent and essay mentor who helps students shape their passions into a powerful story that feels entirely their own.",
    emblem: `${mediaBase}media/universities/brown.svg`,
    photo: `${mediaBase}media/mentors/jess-lin.png`,
    objectPosition: "50% 50%"
  }
];
