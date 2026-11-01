import Link from "next/link";
import { OpenTreeLink } from "@/components/OpenTreeLink";

const features = [
  {
    title: "Ancestors and descendants",
    text: "The canvas centers on one person. Parents sit above, a partner beside them, and children below. Click anyone and the view recenters.",
  },
  {
    title: "A full profile",
    text: "Keep a photo, birth and death, places, and a note. Record where a fact came from. A couple can also record a marriage date and place.",
  },
  {
    title: "Living people stay private",
    text: "Mark someone alive and a share link shows them only as Living. Their name, photo, dates, places, and note stay off that page.",
  },
  {
    title: "An account when you want one",
    text: "Without signing in, this browser keeps one tree. An account keeps up to five and is what creates a share link.",
  },
  {
    title: "Files you can take with you",
    text: "Export JSON, GEDCOM, a picture, or a printable PDF. Import JSON or GEDCOM when a tree already exists somewhere else.",
  },
  {
    title: "One link, view only",
    text: "A signed-in tree gets a stable link. Anyone who opens it sees the shared view and cannot edit the record.",
  },
];

const steps = [
  {
    number: "01",
    title: "Start with one person",
    text: "Enter a given name and a family name. The tree opens on them.",
  },
  {
    number: "02",
    title: "Attach the family",
    text: "Add a parent, a partner, or a child. Create someone new, or link a person already in the tree.",
  },
  {
    number: "03",
    title: "Keep it, or share a view",
    text: "The tree stays in this browser. Sign in to store it, export a file, or send a view-only link.",
  },
];

const questions = [
  {
    question: "Do I need an account?",
    answer: "No. The tree stays in this browser, and you can export a file at any time. Sign in when you want the tree stored online, more than one tree, or a share link.",
  },
  {
    question: "What does a share link show?",
    answer: "Only the shared view. People marked alive appear as Living. Everyone else keeps the details you recorded. Sources stay off that page. The page has no editor.",
  },
  {
    question: "Can I record where a fact came from?",
    answer: "Yes. On a person, or on a couple, add a source: someone who told you, a certificate, or a short note. It stays in the tree and in an exported file. A share link leaves it out.",
  },
  {
    question: "Can the same person be their own ancestor?",
    answer: "No. Linking a parent, partner, or child is refused when it would make a cycle.",
  },
];

export default function HomePage() {
  return (
    <div className="home">
      <header className="home-nav">
        <Link href="/" className="home-mark">
          <TreeMark />
          Family tree
        </Link>
        <nav className="home-nav-links" aria-label="Page">
          <a href="#product">Product</a>
          <a href="#steps">How it works</a>
          <a href="#privacy">Privacy</a>
          <a href="#questions">Questions</a>
        </nav>
        <OpenTreeLink className="home-button home-button-small" />
      </header>

      <main>
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="home-kicker">A private family record</p>
            <h1>Follow a family in both directions.</h1>
            <p className="home-lede">
              Start with one person. Add parents above, a partner beside them, and children below. Move through the
              tree, keep living people private, and share a link that can only be viewed.
            </p>
            <div className="home-actions">
              <OpenTreeLink className="home-button home-button-primary" />
              <a className="home-button" href="#steps">
                How it works
              </a>
            </div>
          </div>
          <ExampleTree />
        </section>

        <section className="home-points" aria-label="At a glance">
          <p>Ancestors above, descendants below</p>
          <p>One tree in this browser, five in an account</p>
          <p>A view-only link for everyone else</p>
        </section>

        <section id="product" className="home-section">
          <div className="home-section-head">
            <p className="home-kicker">Product</p>
            <h2>Everything you need to build the tree and hand someone a view.</h2>
          </div>
          <ul className="home-features">
            {features.map((feature) => (
              <li key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="steps" className="home-section">
          <div className="home-section-head">
            <p className="home-kicker">How it works</p>
            <h2>Three steps from an empty page to a tree you can share.</h2>
          </div>
          <ol className="home-steps">
            {steps.map((step) => (
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
            <p className="home-kicker">Privacy</p>
            <h2>Living people do not travel with the link.</h2>
            <p>
              Checking Alive stores that the person is living and clears the death fields. On a share link they appear
              as Living. A person with no alive mark keeps their name, dates, places, note, and photo.
            </p>
          </div>
          <ul>
            <li>The public page is the shared view, with no way back to the private record.</li>
            <li>Marriage details are hidden when either partner is marked alive.</li>
            <li>Sources stay off the share link, including for people whose other details are shown.</li>
            <li>Your own Shared view button is a preview. The link is the copy other people open.</li>
          </ul>
        </section>

        <section id="questions" className="home-section">
          <div className="home-section-head">
            <p className="home-kicker">Questions</p>
            <h2>Before you start.</h2>
          </div>
          <dl className="home-questions">
            {questions.map((item) => (
              <div key={item.question}>
                <dt>{item.question}</dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="home-close">
          <h2>Open the tree and add the first person.</h2>
          <p>If this browser already has a tree, it opens where you left it.</p>
          <OpenTreeLink className="home-button home-button-primary" />
        </section>
      </main>

      <footer className="home-footer">
        <div>
          <p className="home-mark">
            <TreeMark />
            Family tree
          </p>
          <p>Build a family record, keep it in this browser or an account, and share only the view you intend.</p>
        </div>
        <nav aria-label="Footer">
          <a href="#product">Product</a>
          <a href="#privacy">Privacy</a>
          <Link href="/tree">Open your tree</Link>
        </nav>
      </footer>
    </div>
  );
}

function TreeMark() {
  return (
    <svg className="home-logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="12" y="3" width="8" height="8" rx="2" />
      <rect x="2" y="21" width="8" height="8" rx="2" />
      <rect x="22" y="21" width="8" height="8" rx="2" />
      <path d="M16 11v5M16 16H6v5M16 16h10v5" />
    </svg>
  );
}

function ExampleTree() {
  return (
    <figure className="home-preview" aria-label="Example of a small family tree">
      <figcaption>Example</figcaption>
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
