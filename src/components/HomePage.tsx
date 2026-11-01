"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { OpenTreeLink } from "@/components/OpenTreeLink";
import { useI18n } from "@/i18n/I18nProvider";

export function HomePage() {
  const { messages } = useI18n();
  const home = messages.home;
  useEffect(() => {
    window.document.title = messages.appName;
  }, [messages.appName]);
  return (
    <div className="home">
      <header className="home-nav">
        <Link href="/" className="home-mark">
          <img className="home-logo" src="/family-tree-logo.png" alt="" />
          {messages.appName}
        </Link>
        <nav className="home-nav-links" aria-label={home.page}>
          <a href="#product">{home.product}</a>
          <a href="#steps">{home.how}</a>
          <a href="#privacy">{home.privacy}</a>
          <a href="#questions">{home.questions}</a>
        </nav>
        <div className="home-nav-actions">
          <LanguageSwitch bare />
          <OpenTreeLink className="home-button home-button-small" />
        </div>
      </header>

      <main>
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="home-kicker">{home.kicker}</p>
            <h1>{home.heroTitle}</h1>
            <p className="home-lede">{home.lede}</p>
            <div className="home-actions">
              <OpenTreeLink className="home-button home-button-primary" />
              <a className="home-button" href="#steps">
                {home.how}
              </a>
            </div>
          </div>
          <ExampleTree label={home.exampleLabel} caption={home.example} />
        </section>

        <section className="home-points" aria-label={home.glance}>
          {home.points.map((point) => (
            <p key={point}>{point}</p>
          ))}
        </section>

        <section id="product" className="home-section">
          <div className="home-section-head">
            <p className="home-kicker">{home.productKicker}</p>
            <h2>{home.productTitle}</h2>
          </div>
          <ul className="home-features">
            {home.features.map((feature) => (
              <li key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="steps" className="home-section">
          <div className="home-section-head">
            <p className="home-kicker">{home.how}</p>
            <h2>{home.stepsTitle}</h2>
          </div>
          <ol className="home-steps">
            {home.steps.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="privacy" className="home-band">
          <div>
            <p className="home-kicker">{home.privacy}</p>
            <h2>{home.privacyTitle}</h2>
            <p>{home.privacyText}</p>
          </div>
          <ul>
            {home.privacyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>

        <section id="questions" className="home-section">
          <div className="home-section-head">
            <p className="home-kicker">{home.questions}</p>
            <h2>{home.questionsTitle}</h2>
          </div>
          <dl className="home-questions">
            {home.faqs.map((item) => (
              <div key={item.question}>
                <dt>{item.question}</dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="home-close">
          <h2>{home.closeTitle}</h2>
          <p>{home.closeText}</p>
          <OpenTreeLink className="home-button home-button-primary" />
        </section>
      </main>

      <footer className="home-footer">
        <div>
          <p className="home-mark">
            <img className="home-logo" src="/family-tree-logo.png" alt="" />
            {messages.appName}
          </p>
          <p>{home.footer}</p>
        </div>
        <nav aria-label={home.footerNav}>
          <a href="#product">{home.product}</a>
          <a href="#privacy">{home.privacy}</a>
          <Link href="/tree">{home.openTree}</Link>
        </nav>
      </footer>
    </div>
  );
}

function ExampleTree({ label, caption }: { label: string; caption: string }) {
  return (
    <figure className="home-preview" aria-label={label}>
      <figcaption>{caption}</figcaption>
      <div className="home-preview-tree">
        <div className="home-couple">
          <span>Nora Hale</span>
          <span>Owen Hale</span>
        </div>
        <div className="home-couple home-couple-focus">
          <span>Elena Hale</span>
          <span>James Adey</span>
        </div>
        <div className="home-couple">
          <span>Mina Adey</span>
          <span>Theo Adey</span>
        </div>
      </div>
    </figure>
  );
}
