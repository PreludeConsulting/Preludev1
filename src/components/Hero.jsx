import { useState } from "react";
import { motion } from "motion/react";
import HeroDashboardMockup from "./HeroDashboardMockup.jsx";

const registerPath = `${import.meta.env.BASE_URL}register`.replace(/\/+/g, "/");

export default function Hero() {
  const [email, setEmail] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim();
    const target = trimmed
      ? `${registerPath}?email=${encodeURIComponent(trimmed)}`
      : registerPath;
    window.location.href = target;
  }

  return (
    <section id="home" className="shopify-hero">
      <div className="shopify-hero__bg" aria-hidden="true" />
      <div className="shopify-hero__inner">
        <div className="shopify-hero__grid">
          <motion.div
            className="shopify-hero__copy"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <h1 className="shopify-hero__headline">
              College admissions counseling,{" "}
              <span className="shopify-hero__headline-accent">reimagined.</span>
            </h1>
            <p className="shopify-hero__subcopy">
              Peer-powered mentorship, personalized strategy, and financial guidance to help students build standout
              applications with confidence.
            </p>

            <form className="shopify-hero__form" onSubmit={handleSubmit}>
              <label className="sr-only" htmlFor="hero-email">
                Email address
              </label>
              <input
                id="hero-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="shopify-hero__input"
              />
              <button type="submit" className="shopify-hero__cta">
                Start free trial
              </button>
            </form>
            <p className="shopify-hero__note">
              Start free, then get matched with a mentor from your dream school.
            </p>
          </motion.div>

          <motion.div
            className="shopify-hero__visual"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.6, ease: "easeOut" }}
          >
            <div className="shopify-hero__deco shopify-hero__deco--one" aria-hidden="true" />
            <div className="shopify-hero__deco shopify-hero__deco--two" aria-hidden="true" />
            <HeroDashboardMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
