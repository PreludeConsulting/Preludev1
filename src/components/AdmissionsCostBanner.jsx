import { useLanguage } from "../context/LanguageContext.jsx";

const mediaBase = import.meta.env.BASE_URL;
const PIGGY_IMAGE = `${mediaBase}media/admissions-savings-piggy.png`;

export default function AdmissionsCostBanner() {
  const { t } = useLanguage();

  return (
    <section
      className="admissions-cost-banner"
      id="about-cost"
      aria-labelledby="admissions-cost-headline"
    >
      <div className="admissions-cost-banner__inner">
        <div className="admissions-cost-banner__visual">
          <div className="admissions-cost-banner__stage">
            <img
              src={PIGGY_IMAGE}
              alt={t("sections.cost.imageAlt")}
              className="admissions-cost-banner__image admissions-cost-banner__piggy"
            />
          </div>
        </div>

        <div className="admissions-cost-banner__copy">
          <p className="admissions-cost-banner__body max-w-lg text-lg leading-7 text-white md:text-xl md:leading-8">
            {t("sections.cost.bodyBefore")}{" "}
            <span className="admissions-cost-banner__amount">$6,500</span>{" "}
            {t("sections.cost.bodyAfter")}
          </p>
          <div className="admissions-cost-banner__headline-wrap">
            <h2
              id="admissions-cost-headline"
              className="admissions-cost-banner__headline ivy-display mt-6 max-w-xl text-5xl font-extrabold uppercase leading-[0.88] tracking-[-0.035em] text-white md:text-7xl lg:text-[5.8rem]"
            >
              {t("sections.cost.headline")}
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
}
