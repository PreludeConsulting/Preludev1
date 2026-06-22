import { CheckCircle, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button.jsx";

export default function AcademicProgramCard({ card }) {
  return (
    <article className="academic-program-card">
      <h3 className="academic-program-card__title">{card.title}</h3>
      <p className="academic-program-card__price">{card.price}</p>

      <div className="academic-program-card__featured-callout">
        <Video className="academic-program-card__featured-icon" aria-hidden="true" />
        <span>{card.featuredCallout}</span>
      </div>

      <p className="academic-program-card__desc">{card.description}</p>

      <ul className="academic-program-card__features">
        {card.features.map((feature) => (
          <li key={feature}>
            <CheckCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button as={Link} to={card.ctaHref} className="academic-program-card__cta">
        {card.cta}
      </Button>
    </article>
  );
}
