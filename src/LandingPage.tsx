import { useState, useEffect } from "react";
import {
  LayoutGrid,
  Shield,
  Bell,
  ClipboardList,
  Building2,
  ChevronDown,
  Check,
  ArrowRight,
  Kanban,
} from "lucide-react";

interface LandingPageProps {
  onSignIn: () => void;
  onGetStarted: () => void;
}

export default function LandingPage({ onSignIn, onGetStarted }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="landing-page">
      {/* ========== NAVBAR ========== */}
      <nav className={`landing-nav${scrolled ? " scrolled" : ""}`}>
        <div className="landing-nav-logo">
          <Kanban size={22} />
          TetherTasks
        </div>
        <div className="landing-nav-links">
          <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo("features"); }}>Features</a>
          <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Pricing</a>
          <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>FAQ</a>
        </div>
        <div className="landing-nav-actions">
          <button className="landing-btn landing-btn-outline" onClick={onSignIn}>
            Sign In
          </button>
          <button className="landing-btn landing-btn-primary" onClick={onGetStarted}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section className="landing-hero">
        <div className="landing-hero-shapes">
          <div className="landing-hero-shape" />
          <div className="landing-hero-shape" />
          <div className="landing-hero-shape" />
        </div>
        <div className="landing-hero-content">
          <h1>
            Manage Your Team's Work <span>Without the Chaos</span>
          </h1>
          <p>
            TetherTasks is the multi-tenant task management platform built for
            growing companies. Organize workspaces, assign tasks, and keep
            everyone accountable — all in one place.
          </p>
          <div className="landing-hero-buttons">
            <button className="landing-btn landing-btn-primary landing-btn-lg" onClick={onGetStarted}>
              Start Free <ArrowRight size={18} />
            </button>
            <button
              className="landing-btn landing-btn-outline landing-btn-lg"
              onClick={() => scrollTo("features")}
            >
              See Features
            </button>
          </div>
        </div>
      </section>

      {/* ========== TRUSTED BY ========== */}
      {/*   <section className="landing-trusted">
        <p>Trusted by teams at</p>
        <div className="landing-trusted-logos">
          <span>Acme Corp</span>
          <span>Globex</span>
          <span>Initech</span>
          <span>Umbrella Co</span>
          <span>Stark Ind</span>
        </div>
      </section> */}

      {/* ========== FEATURES ========== */}
      <section className="landing-section" id="features">
        <div className="landing-section-header">
          <span className="landing-section-badge">Features</span>
          <h2>Everything Your Team Needs</h2>
          <p>
            Powerful tools designed to help teams of all sizes stay organized
            and ship faster.
          </p>
        </div>
        <div className="landing-features-grid">
          {[
            { icon: <LayoutGrid size={24} />, title: "Workspaces", desc: "Organize projects into dedicated workspaces with their own members and task boards." },
            { icon: <Kanban size={24} />, title: "Kanban Boards", desc: "Visual task boards with drag-and-drop columns to track work from start to finish." },
            { icon: <Shield size={24} />, title: "Role-Based Access", desc: "Fine-grained permissions for platform admins, tenant admins, owners, and members." },
            { icon: <Bell size={24} />, title: "Notifications", desc: "Real-time alerts keep your team informed about task assignments and updates." },
            { icon: <ClipboardList size={24} />, title: "Audit Trail", desc: "Full activity logs so you can see who did what and when — complete transparency." },
            { icon: <Building2 size={24} />, title: "Multi-Tenant", desc: "Isolated tenant environments with their own organizations, members, and data." },
          ].map((f) => (
            <div className="landing-feature-card" key={f.title}>
              <div className="landing-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="landing-section" style={{ background: "var(--panel-soft)" }}>
        <div className="landing-section-header">
          <span className="landing-section-badge">How It Works</span>
          <h2>Up and Running in Minutes</h2>
          <p>Three simple steps to get your team organized.</p>
        </div>
        <div className="landing-steps">
          {[
            { n: "1", title: "Create Your Company", desc: "Sign up, name your organization, and configure your workspace in seconds." },
            { n: "2", title: "Invite Your Team", desc: "Add members by email. They get instant access with the right permissions." },
            { n: "3", title: "Track Your Tasks", desc: "Create boards, assign tasks, and watch progress in real time." },
          ].map((s) => (
            <div className="landing-step" key={s.n}>
              <div className="landing-step-number">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section className="landing-section" id="pricing">
        <div className="landing-section-header">
          <span className="landing-section-badge">Pricing</span>
          <h2>Simple, Transparent Pricing</h2>
          <p>Start free. Upgrade when you're ready.</p>
        </div>
        <div className="landing-pricing-grid">
          {/* Starter */}
          <div className="landing-pricing-card">
            <h3>Starter</h3>
            <p className="landing-pricing-desc">For individuals and small teams</p>
            <div className="landing-pricing-price">
              $0<span>/mo</span>
            </div>
            <ul className="landing-pricing-features">
              <li><Check size={16} /> 1 workspace</li>
              <li><Check size={16} /> Up to 5 members</li>
              <li><Check size={16} /> Kanban boards</li>
              <li><Check size={16} /> Basic notifications</li>
            </ul>
            <button className="landing-btn landing-btn-outline" onClick={onGetStarted}>
              Get Started
            </button>
          </div>

          {/* Professional */}
          <div className="landing-pricing-card popular">
            <span className="landing-pricing-popular-badge">Most Popular</span>
            <h3>Professional</h3>
            <p className="landing-pricing-desc">For growing teams that need more</p>
            <div className="landing-pricing-price">
              $29<span>/mo</span>
            </div>
            <ul className="landing-pricing-features">
              <li><Check size={16} /> Unlimited workspaces</li>
              <li><Check size={16} /> Up to 50 members</li>
              <li><Check size={16} /> Audit trail</li>
              <li><Check size={16} /> Priority support</li>
            </ul>
            <button className="landing-btn landing-btn-primary" onClick={onGetStarted}>
              Start Free Trial
            </button>
          </div>

          {/* Enterprise */}
          <div className="landing-pricing-card">
            <h3>Enterprise</h3>
            <p className="landing-pricing-desc">For organizations at scale</p>
            <div className="landing-pricing-price">
              $99<span>/mo</span>
            </div>
            <ul className="landing-pricing-features">
              <li><Check size={16} /> Unlimited everything</li>
              <li><Check size={16} /> Multi-tenant isolation</li>
              <li><Check size={16} /> Advanced permissions</li>
              <li><Check size={16} /> Dedicated support</li>
            </ul>
            <button className="landing-btn landing-btn-outline" onClick={onGetStarted}>
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section className="landing-section" id="faq" style={{ background: "var(--panel-soft)" }}>
        <div className="landing-section-header">
          <span className="landing-section-badge">FAQ</span>
          <h2>Frequently Asked Questions</h2>
          <p>Got questions? We've got answers.</p>
        </div>
        <div className="landing-faq-list">
          {[
            { q: "What is TetherTasks?", a: "TetherTasks is a multi-tenant task management platform that helps teams organize their work with workspaces, kanban boards, and role-based access control." },
            { q: "Is there a free plan?", a: "Yes! Our Starter plan is completely free and includes 1 workspace with up to 5 team members. No credit card required." },
            { q: "How does multi-tenant work?", a: "Each tenant gets a fully isolated environment with their own organizations, workspaces, members, and data. Tenant admins manage everything within their scope." },
            { q: "Can I upgrade or downgrade anytime?", a: "Absolutely. You can switch between plans at any time. Changes take effect immediately, and billing is prorated." },
            { q: "What kind of support do you offer?", a: "Starter plans get community support. Professional plans include priority email support. Enterprise customers get a dedicated account manager." },
            { q: "Is my data secure?", a: "Yes. We use AWS infrastructure with encryption at rest and in transit, role-based access controls, and comprehensive audit logging." },
          ].map((item, i) => (
            <div className={`landing-faq-item${openFaq === i ? " open" : ""}`} key={i}>
              <button
                className="landing-faq-question"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                {item.q}
                <ChevronDown size={18} />
              </button>
              <div className="landing-faq-answer">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========== CTA BANNER ========== */}
      <section className="landing-cta-banner">
        <h2>Ready to Get Started?</h2>
        <p>
          Join thousands of teams already using TetherTasks to ship faster
          and stay organized.
        </p>
        <button className="landing-btn landing-btn-white landing-btn-lg" onClick={onGetStarted}>
          Create Free Account <ArrowRight size={18} />
        </button>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-logo">TetherTasks</div>
          <div className="landing-footer-links">
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo("features"); }}>Features</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Pricing</a>
            <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>FAQ</a>
          </div>
          <div className="landing-footer-copy">
            &copy; {new Date().getFullYear()} TetherTasks. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
