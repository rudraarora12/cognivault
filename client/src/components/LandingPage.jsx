import HeroSection from "./HeroSection";
import ExperienceSection from "./ExperienceSection";
import HowItWorks from "./HowItWorks";
import FeatureGrid from "./FeatureGrid";
import TestimonialsCarousel from "./TestimonialsCarousel";

const momentumStats = [
  { label: "Knowledge captured", value: "4.8M+" },
  { label: "Teams collaborating", value: "12K+" },
  { label: "Avg. recall time", value: "680ms" },
  { label: "Proactive insights", value: "97.2%" },
];

const spotlightFeatures = [
  "Secure by design",
  "Graph-powered memory",
  "AI copilots for every team",
];

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <section className="momentum-band">
        <div className="container momentum-inner">
          <div className="momentum-title">
            We help high-output teams stay effortlessly in sync.
          </div>
          <div className="momentum-stats">
            {momentumStats.map((stat) => (
              <div key={stat.label} className="momentum-card glass">
                <span className="momentum-value">{stat.value}</span>
                <span className="momentum-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <ExperienceSection />
      <HowItWorks />
      <FeatureGrid />
      <TestimonialsCarousel />
      <section className="cta-section">
        <div className="container cta-inner glass">
          <div className="cta-copy">
            <p className="cta-kicker">Ready when you are</p>
            <h2>Launch a shared memory for your team in minutes.</h2>
            <p className="cta-subtitle">
              Build a living archive with automated syncs, AI copilots, and
              contextual insights. No more lost threads or forgotten decisions.
            </p>
            <div className="cta-actions">
              <a className="btn btn-primary btn-ripple" href="/signup">
                Start Free Trial
              </a>
              <a className="btn btn-ghost" href="/about">
                Explore the product
              </a>
            </div>
            <ul className="cta-highlights">
              {spotlightFeatures.map((item) => (
                <li key={item}>
                  <span className="cta-dot" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="cta-panel">
            <div className="cta-orb">
              <div className="cta-orb-core" />
            </div>
            <div className="cta-panel-copy">
              <p>
                “CogniVault is the connective tissue between every project
                decision and the context behind it.”
              </p>
              <span className="cta-signature">— Olivia Mendes, Chief of Staff</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

