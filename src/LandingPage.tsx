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
  Users,
  Briefcase,
  Store,
  Rocket,
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
            One Dashboard. <span>Every Company.</span>
          </h1>
          <p>
            Manage all your organizations, teams, and tasks from a single
            account. Built for consultants, agencies, and founders who run
            more than one company.
          </p>
          <div className="landing-hero-buttons">
            <button className="landing-btn landing-btn-primary landing-btn-lg" onClick={onGetStarted}>
              Start Free <ArrowRight size={18} />
            </button>
            <button
              className="landing-btn landing-btn-outline landing-btn-lg"
              onClick={() => scrollTo("features")}
            >
              See How It Works
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
          <h2>Run Multiple Companies From One Login</h2>
          <p>
            No more juggling separate accounts. TetherTasks is the only task
            platform built for people who manage more than one organization.
          </p>
        </div>
        <div className="landing-features-grid">
          {[
            { icon: <Building2 size={24} />, title: "Multi-Company Management", desc: "Switch between organizations instantly. Each company gets its own workspaces, members, and data — completely isolated." },
            { icon: <LayoutGrid size={24} />, title: "Workspaces", desc: "Organize projects into dedicated workspaces with their own members and task boards." },
            { icon: <Kanban size={24} />, title: "Kanban Boards", desc: "Visual task boards with drag-and-drop columns to track work from start to finish." },
            { icon: <Shield size={24} />, title: "Role-Based Access", desc: "Fine-grained permissions for admins, owners, and members across every organization." },
            { icon: <Bell size={24} />, title: "Notifications", desc: "Real-time alerts keep your team informed about task assignments and updates." },
            { icon: <ClipboardList size={24} />, title: "Audit Trail", desc: "Full activity logs so you can see who did what and when — complete transparency." },
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
          <p>Three simple steps to manage all your companies from one place.</p>
        </div>
        <div className="landing-steps">
          {[
            { n: "1", title: "Create Your First Company", desc: "Sign up and set up your first organization with workspaces and team members." },
            { n: "2", title: "Add More Organizations", desc: "Launch a new venture or onboard another client — add it to your account in seconds." },
            { n: "3", title: "Switch Between Them Instantly", desc: "One dashboard, every company. Jump between organizations without logging out." },
          ].map((s) => (
            <div className="landing-step" key={s.n}>
              <div className="landing-step-number">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== WHO IT'S FOR ========== */}
      <section className="landing-section">
        <div className="landing-section-header">
          <span className="landing-section-badge">Who It's For</span>
          <h2>Built for People Who Wear Multiple Hats</h2>
          <p>
            If you manage more than one company, team, or client — TetherTasks
            was made for you.
          </p>
        </div>
        <div className="landing-persona-grid">
          {[
            { icon: <Briefcase size={28} />, title: "Consultants", desc: "Keep each client's projects, teams, and tasks organized in their own space — no cross-contamination." },
            { icon: <Users size={28} />, title: "Agencies", desc: "Manage multiple brands and client accounts from one login. Each gets their own workspace and team." },
            { icon: <Store size={28} />, title: "Franchise Operators", desc: "Oversee every location with its own org, members, and task boards — all from a single dashboard." },
            { icon: <Rocket size={28} />, title: "Serial Entrepreneurs", desc: "Running two companies? Five? Switch between them instantly without juggling logins." },
          ].map((p) => (
            <div className="landing-persona-card" key={p.title}>
              <div className="landing-persona-icon">{p.icon}</div>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
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
            <p className="landing-pricing-desc">For individuals managing one company</p>
            <div className="landing-pricing-price">
              $0<span>/mo</span>
            </div>
            <ul className="landing-pricing-features">
              <li><Check size={16} /> 1 organization</li>
              <li><Check size={16} /> 1 workspace</li>
              <li><Check size={16} /> Up to 5 members</li>
              <li><Check size={16} /> Kanban boards</li>
            </ul>
            <button className="landing-btn landing-btn-outline" onClick={onGetStarted}>
              Get Started
            </button>
          </div>

          {/* Professional */}
          <div className="landing-pricing-card popular">
            <span className="landing-pricing-popular-badge">Most Popular</span>
            <h3>Professional</h3>
            <p className="landing-pricing-desc">For professionals managing multiple companies</p>
            <div className="landing-pricing-price">
              $29<span>/mo</span>
            </div>
            <ul className="landing-pricing-features">
              <li><Check size={16} /> 3 organizations</li>
              <li><Check size={16} /> Unlimited workspaces</li>
              <li><Check size={16} /> Up to 50 members</li>
              <li><Check size={16} /> Audit trail</li>
            </ul>
            <button className="landing-btn landing-btn-primary" onClick={onGetStarted}>
              Start Free Trial
            </button>
          </div>

          {/* Enterprise */}
          <div className="landing-pricing-card">
            <h3>Enterprise</h3>
            <p className="landing-pricing-desc">For agencies and operators at scale</p>
            <div className="landing-pricing-price">
              $99<span>/mo</span>
            </div>
            <ul className="landing-pricing-features">
              <li><Check size={16} /> Unlimited organizations</li>
              <li><Check size={16} /> Unlimited workspaces</li>
              <li><Check size={16} /> Unlimited members</li>
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
            { q: "Can I manage multiple companies from one account?", a: "Yes — it's what TetherTasks is built for. Unlike other task tools that force you to create separate accounts, you can switch between organizations instantly from a single dashboard." },
            { q: "How many organizations can I have?", a: "It depends on your plan. Starter includes 1 organization, Professional supports up to 3, and Enterprise gives you unlimited organizations. Upgrade anytime as you grow." },
            { q: "Is there a free plan?", a: "Yes! Our Starter plan is completely free and includes 1 organization, 1 workspace, and up to 5 team members. No credit card required." },
            { q: "Is my data isolated between companies?", a: "Completely. Each organization gets its own workspaces, members, tasks, and data. Nothing is shared between organizations unless you choose to." },
            { q: "Can I upgrade or downgrade anytime?", a: "Absolutely. You can switch between plans at any time. Changes take effect immediately, and billing is prorated." },
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
        <h2>Stop Juggling Logins</h2>
        <p>
          Manage every company, team, and task from one account.
          Start free — upgrade when you add more organizations.
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
