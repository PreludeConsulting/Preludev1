const mediaBase = (import.meta.env?.BASE_URL ?? "/");

export const EXAMPLE_MENTORS = [
  {
    name: "Peter Kim",
    university: "Georgia Tech",
    institutionShort: "Georgia Tech",
    major: "Engineering",
    specialty: "STEM",
    specialties: ["STEM", "Engineering essays", "Project stories"],
    description: "Mechanical engineering mentor who helps students turn technical interests into clear project stories.",
    emblem: `${mediaBase}media/universities/georgia-tech.svg`,
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
    description: "Economics student who helps students think through school fit, application strategy, and building a balanced college list.",
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
    description: "CS mentor who guides students through research interests, technical activities, and essay positioning.",
    emblem: `${mediaBase}media/universities/georgia-tech.svg`,
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
    description: "Business mentor who helps students connect leadership, entrepreneurship, and community impact.",
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
    description: "English mentor who specializes in personal statements, voice, and shaping memorable application narratives.",
    emblem: `${mediaBase}media/universities/brown.svg`,
    photo: `${mediaBase}media/mentors/jess-lin.png`,
    objectPosition: "50% 50%"
  }
];
