const mediaBase = (import.meta.env?.BASE_URL ?? "/");

export const EXAMPLE_MENTORS = [
  {
    name: "Declan Brooks",
    university: "Brown University",
    institutionShort: "Brown",
    major: "Engineering",
    description: "Mechanical engineering mentor who helps students turn technical interests into clear project stories.",
    emblem: `${mediaBase}media/universities/brown.svg`,
    photo: `${mediaBase}media/mentors/declan-brooks.png`,
    objectPosition: "50% 34%"
  },
  {
    name: "Ryan Morales",
    university: "University of Pennsylvania",
    institutionShort: "Penn",
    major: "Computer Science",
    description: "Computer science student focused on application strategy, campus fit, and building a balanced school list.",
    emblem: `${mediaBase}media/universities/upenn.svg`,
    photo: `${mediaBase}media/mentors/ryan-morales.png`,
    objectPosition: "50% 32%"
  },
  {
    name: "Asim Patel",
    university: "Georgia Tech",
    institutionShort: "Georgia Tech",
    major: "Computer Science",
    description: "CS mentor who guides students through research interests, technical activities, and essay positioning.",
    emblem: `${mediaBase}media/universities/georgia-tech.svg`,
    photo: `${mediaBase}media/mentors/asim-patel.png`,
    objectPosition: "50% 30%"
  },
  {
    name: "Harrison Kim",
    university: "University of Georgia",
    institutionShort: "UGA",
    major: "Business",
    description: "Business mentor who helps students connect leadership, entrepreneurship, and community impact.",
    emblem: `${mediaBase}media/universities/georgia.svg`,
    photo: `${mediaBase}media/mentors/harrison-kim.png`,
    objectPosition: "50% 32%"
  },
  {
    name: "Jess Lin",
    university: "Brown University",
    institutionShort: "Brown",
    major: "English",
    description: "English mentor who specializes in personal statements, voice, and shaping memorable application narratives.",
    emblem: `${mediaBase}media/universities/brown.svg`,
    photo: `${mediaBase}media/mentors/jess-lin.png`,
    objectPosition: "50% 35%"
  }
];
