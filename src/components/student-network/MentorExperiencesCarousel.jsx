import { useMemo } from "react";
import { EXAMPLE_MENTORS } from "../../data/mentors.js";
import Carousel from "./Carousel.jsx";

const FEATURED_MENTOR_NAMES = [
  "Ryan Cain",
  "Kai Koblentz",
  "Asim Yoonas",
  "Jessica Li",
  "Hyunbin Moon"
];

function schoolLabel(mentor) {
  if (mentor.name === "Ryan Cain") return "UPenn";
  return mentor.institutionShort || mentor.university;
}

export default function MentorExperiencesCarousel() {
  const items = useMemo(() => {
    const byName = new Map(EXAMPLE_MENTORS.map((mentor) => [mentor.name, mentor]));
    return FEATURED_MENTOR_NAMES.map((name, index) => {
      const mentor = byName.get(name);
      if (!mentor) return null;
      return {
        id: index + 1,
        title: mentor.name,
        description: `${schoolLabel(mentor)} · ${mentor.specialty}`,
        emblem: mentor.emblem,
        icon: (
          <img
            src={mentor.photo}
            alt=""
            className="carousel-mentor-photo"
            style={{ objectPosition: mentor.objectPosition }}
            width={280}
            height={220}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        )
      };
    }).filter(Boolean);
  }, []);

  return (
    <div className="mentor-experiences-carousel">
      <Carousel
        items={items}
        baseWidth={310}
        autoplay
        autoplayDelay={2000}
        pauseOnHover={false}
        loop
        round={false}
      />
    </div>
  );
}
