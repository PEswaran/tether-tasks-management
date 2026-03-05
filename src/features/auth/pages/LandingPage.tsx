import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  Zap,
  Globe,
  Lock,
  Play,
} from "lucide-react";
import { setDemoFlag } from "../../../config/demo";
import { trackLandingEngagement, trackLandingView, trackSignupStart } from "../../../libs/analytics/signupFunnel";

interface LandingPageProps {
  onSignIn: () => void;
  onGetStarted: () => void;
  authMessage?: string;
}

export default function LandingPage({ onSignIn, onGetStarted }: LandingPageProps) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showLogoIntro, setShowLogoIntro] = useState(false);
  const landingStartRef = useRef(Date.now());
  const demoVideoUrl = import.meta.env.VITE_DEMO_VIDEO_URL as string | undefined;

  useEffect(() => {
    // Skip intro for users with reduced-motion preference.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShowLogoIntro(false);
      return;
    }

    setShowLogoIntro(true);
    const timer = window.setTimeout(() => setShowLogoIntro(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Feature: Signup Funnel Analytics - record landing page view.
    trackLandingView();
    landingStartRef.current = Date.now();

    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      // Feature: Signup Funnel Analytics - estimate landing time spent.
      const secondsOnPage = (Date.now() - landingStartRef.current) / 1000;
      trackLandingEngagement(secondsOnPage);
    };
  }, []);

  const handleGetStartedClick = (source: string) => {
    // Feature: Signup Funnel Analytics - capture signup intent source.
    trackSignupStart(source);
    onGetStarted();
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="landing-page">
      {showLogoIntro && (
        <div className="landing-logo-intro-overlay" aria-hidden="true">
          <div className="landing-logo-intro-tile">
            <img src="/logo.png" alt="" className="landing-logo-intro-img" />
          </div>
        </div>
      )}

      {/* ========== NAVBAR ========== */}
      <nav className={`landing-nav${scrolled ? " scrolled" : ""}`}>
        <a
          href="/"
          className={`landing-nav-logo${showLogoIntro ? " intro-hidden" : ""}`}
          onClick={(e) => { e.preventDefault(); navigate("/"); }}
        >
          <div className="landing-logo-tile">
            <img
              src="/logo.png"
              alt="TetherTasks logo"
              className="landing-logo-img"
            />
          </div>
          TetherTasks
        </a>
        <div className="landing-nav-links">
          <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo("features"); }}>Features</a>
          <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo("how-it-works"); }}>How It Works</a>
          <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Pricing</a>
          <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>FAQ</a>
        </div>
        <div className="landing-nav-actions">
          <button className="landing-btn landing-btn-outline" onClick={onSignIn}>
            Sign In
          </button>
          <button className="landing-btn landing-btn-primary" onClick={() => handleGetStartedClick("nav_start_free")}>
            Start Free
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
          <span className="landing-hero-eyebrow">Task management built for multi-company operators</span>
          <h1>
            One Login. <span>Every Company.</span> Total Control.
          </h1>
          <p>
            Stop switching between accounts to manage your businesses.
            TetherTasks gives consultants, agencies, and operators a single
            dashboard to run every organization, workspace, and team
            &mdash; with complete data isolation between them.
          </p>
          <div className="landing-hero-buttons">
            <button className="landing-btn landing-btn-primary landing-btn-lg" onClick={() => handleGetStartedClick("hero_create_free_account")}>
              Create Free Account <ArrowRight size={18} />
            </button>
            <button
              className="landing-btn landing-btn-outline landing-btn-lg"
              onClick={() => {
                setDemoFlag();
                navigate("/login?demo=true");
              }}
            >
              Try Demo <Play size={16} />
            </button>
          </div>
          {demoVideoUrl && (
            <div className="landing-video-indicator">
              <a
                className="landing-video-link"
                href={demoVideoUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="See TetherTasks in action video"
              >
                <span className="landing-video-pill">
                  <Play size={12} />
                </span>
                <span>See it in action</span>
              </a>
            </div>
          )}
          <div className="landing-hero-proof">
            <span><Check size={14} /> Free forever plan</span>
            <span><Check size={14} /> No credit card required</span>
            <span><Check size={14} /> Set up in under 2 minutes</span>
          </div>
        </div>
      </section>

      {/* ========== PROBLEM / SOLUTION STRIP ========== */}
      <section className="landing-capacity-strip">
        <div className="landing-capacity-grid">
          <div className="landing-capacity-card">
            <div className="landing-capacity-label">The Problem</div>
            <div className="landing-capacity-value">Separate tools per company</div>
            <p>Most task platforms force a new account for each business. You end up with scattered logins, disconnected teams, and no unified view.</p>
          </div>
          <div className="landing-capacity-card featured">
            <div className="landing-capacity-label">The TetherTasks Way</div>
            <div className="landing-capacity-value">One account, every company</div>
            <p>Add organizations to your account. Each gets isolated workspaces, members, and task boards. Switch between them in one click.</p>
          </div>
          <div className="landing-capacity-card">
            <div className="landing-capacity-label">The Result</div>
            <div className="landing-capacity-value">Clarity as you scale</div>
            <p>Plan-aware capacity limits keep growth intentional. Role-based access keeps data secure. Audit trails keep you compliant.</p>
          </div>
        </div>
      </section>

      {/* ========== SOCIAL PROOF STRIP ========== */}
      <section className="landing-trusted">
        <p>Built for operators managing</p>
        <div className="landing-trusted-logos">
          <span>Consulting Firms</span>
          <span>Marketing Agencies</span>
          <span>Franchise Groups</span>
          <span>Holding Companies</span>
          <span>Multi-Brand Portfolios</span>
        </div>
      </section>

      {/* ========== FEATURES ========== */}
      <section className="landing-section" id="features">
        <div className="landing-section-header">
          <span className="landing-section-badge">Why TetherTasks</span>
          <h2>Everything You Need to Run Multiple Companies</h2>
          <p>
            The only task platform designed from day one for operators who manage
            more than one organization. No workarounds. No compromises.
          </p>
        </div>
        <div className="landing-features-grid">
          {[
            {
              icon: <Building2 size={24} />,
              title: "Multi-Company Dashboard",
              desc: "Switch between organizations instantly from one control center. Each company gets fully isolated workspaces, members, and data."
            },
            {
              icon: <LayoutGrid size={24} />,
              title: "Capacity Planning Built In",
              desc: "Know exactly how many workspaces and members each organization uses. Plan-aware limits prevent uncontrolled sprawl as you grow."
            },
            {
              icon: <Kanban size={24} />,
              title: "Visual Kanban Boards",
              desc: "Move tasks through customizable columns. See what's todo, in progress, and done at a glance across every workspace."
            },
            {
              icon: <Shield size={24} />,
              title: "Granular Role Permissions",
              desc: "Admins, owners, and members each see only what they should. Assign tasks, manage teams, and control access per organization."
            },
            {
              icon: <Bell size={24} />,
              title: "Real-Time Notifications",
              desc: "Task assignments, status changes, and team updates delivered instantly. Email notifications keep remote teams in sync."
            },
            {
              icon: <ClipboardList size={24} />,
              title: "Complete Audit Trail",
              desc: "Every admin action, role change, and invitation is logged. Full visibility for compliance, accountability, and peace of mind."
            },
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
      <section className="landing-section" id="how-it-works" style={{ background: "var(--panel-soft)" }}>
        <div className="landing-section-header">
          <span className="landing-section-badge">How It Works</span>
          <h2>From Sign-Up to Full Control in 3 Steps</h2>
          <p>No complex onboarding. No sales calls. Just sign up and start organizing.</p>
        </div>
        <div className="landing-steps">
          {[
            {
              n: "1",
              title: "Create Your Account",
              desc: "Sign up free. Set up your first organization, invite your team, and create your first task board in minutes."
            },
            {
              n: "2",
              title: "Add More Organizations",
              desc: "Onboard a new client or launch a new venture. Each organization gets its own workspaces, members, and complete data isolation."
            },
            {
              n: "3",
              title: "Manage Everything From One Place",
              desc: "Switch between companies in one click. Assign tasks, track progress, and manage teams across every organization from a single dashboard."
            },
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
          <h2>Built for People Who Run More Than One Thing</h2>
          <p>
            If you've ever wished all your companies lived in one tool
            &mdash; they can now.
          </p>
        </div>
        <div className="landing-persona-grid">
          {[
            {
              icon: <Briefcase size={28} />,
              title: "Consultants",
              desc: "Separate workspace per client. Invite their team, assign deliverables, track execution - without any data leaking between accounts."
            },
            {
              icon: <Users size={28} />,
              title: "Agencies",
              desc: "Manage every brand and retainer from one login. Each client gets their own organization with isolated boards, members, and reporting."
            },
            {
              icon: <Store size={28} />,
              title: "Franchise Operators",
              desc: "One dashboard for every location. Each franchise gets its own org, team, and task boards while you maintain full oversight."
            },
            {
              icon: <Rocket size={28} />,
              title: "Serial Entrepreneurs",
              desc: "Running multiple companies? Stop juggling logins. TetherTasks lets you switch between businesses instantly from one control center."
            },
          ].map((p) => (
            <div className="landing-persona-card" key={p.title}>
              <div className="landing-persona-icon">{p.icon}</div>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== KEY DIFFERENTIATORS ========== */}
      <section className="landing-section" style={{ background: "var(--panel-soft)" }}>
        <div className="landing-section-header">
          <span className="landing-section-badge">Why Us</span>
          <h2>What Makes TetherTasks Different</h2>
          <p>Other tools are built for single teams. We're built for operators.</p>
        </div>
        <div className="landing-features-grid">
          {[
            {
              icon: <Globe size={24} />,
              title: "True Multi-Tenancy",
              desc: "Not just separate projects — fully isolated organizations with their own members, workspaces, and data. No cross-contamination, ever."
            },
            {
              icon: <Zap size={24} />,
              title: "Instant Context Switching",
              desc: "One click to move between companies. No logging out, no re-authenticating, no waiting. Your workspace state is preserved."
            },
            {
              icon: <Lock size={24} />,
              title: "Enterprise-Grade Security",
              desc: "AWS infrastructure with encryption at rest and in transit. Role-based access, audit logging, and Cognito authentication baked in."
            },
          ].map((f) => (
            <div className="landing-feature-card" key={f.title}>
              <div className="landing-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section className="landing-section" id="pricing">
        <div className="landing-section-header">
          <span className="landing-section-badge">Pricing</span>
          <h2>Simple Pricing That Scales With You</h2>
          <p>Start free with one company. Add more as you grow. No hidden fees.</p>
        </div>
        <div className="landing-pricing-grid">
          {/* Starter */}
          <div className="landing-pricing-card">
            <h3>Starter</h3>
            <p className="landing-pricing-desc">Perfect for testing the waters with one company</p>
            <div className="landing-pricing-price">
              $0<span>/mo</span>
            </div>
            <ul className="landing-pricing-features">
              <li><Check size={16} /> 1 organization</li>
              <li><Check size={16} /> 1 workspace</li>
              <li><Check size={16} /> Up to 5 team members</li>
              <li><Check size={16} /> Kanban boards + task assignments</li>
              <li><Check size={16} /> Email notifications</li>
            </ul>
            <button className="landing-btn landing-btn-outline" onClick={() => handleGetStartedClick("pricing_starter_get_started")}>
              Get Started Free
            </button>
          </div>

          {/* Professional */}
          <div className="landing-pricing-card popular">
            <span className="landing-pricing-popular-badge">Most Popular</span>
            <h3>Professional</h3>
            <p className="landing-pricing-desc">For operators managing 2-3 companies or clients</p>
            <div className="landing-pricing-price">
              $29<span>/mo</span>
            </div>
            <ul className="landing-pricing-features">
              <li><Check size={16} /> 3 organizations</li>
              <li><Check size={16} /> 5 workspaces per organization</li>
              <li><Check size={16} /> Up to 50 team members</li>
              <li><Check size={16} /> Admin control center</li>
              <li><Check size={16} /> Full audit trail</li>
              <li><Check size={16} /> Priority support</li>
            </ul>
            <button className="landing-btn landing-btn-primary" onClick={() => handleGetStartedClick("pricing_pro_trial")}>
              Start 14-Day Free Trial
            </button>
          </div>

          {/* Enterprise */}
          <div className="landing-pricing-card">
            <h3>Enterprise</h3>
            <p className="landing-pricing-desc">For agencies and operators managing at scale</p>
            <div className="landing-pricing-price">
              $99<span>/mo</span>
            </div>
            <ul className="landing-pricing-features">
              <li><Check size={16} /> Up to 100 organizations</li>
              <li><Check size={16} /> 100 workspaces per organization</li>
              <li><Check size={16} /> Unlimited team members</li>
              <li><Check size={16} /> Everything in Professional</li>
              <li><Check size={16} /> Dedicated account support</li>
              <li><Check size={16} /> Custom onboarding</li>
            </ul>
            <button
              className="landing-btn landing-btn-outline"
              onClick={() => {
                // Feature: Signup Funnel Analytics - track contact-sales intent.
                trackSignupStart("pricing_enterprise_contact_sales");
                navigate("/contact");
              }}
            >
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section className="landing-section" id="faq" style={{ background: "var(--panel-soft)" }}>
        <div className="landing-section-header">
          <span className="landing-section-badge">FAQ</span>
          <h2>Common Questions</h2>
          <p>Everything you need to know before getting started.</p>
        </div>
        <div className="landing-faq-list">
          {[
            {
              q: "How is TetherTasks different from Asana, Monday, or Trello?",
              a: "Those tools are designed for single teams. TetherTasks is built from the ground up for operators who manage multiple companies. Each organization gets fully isolated data, members, and workspaces — something other tools can't do without separate paid accounts."
            },
            {
              q: "Can I really manage multiple companies from one login?",
              a: "Yes — it's the core reason TetherTasks exists. Add as many organizations as your plan allows. Switch between them instantly from one dashboard. No logging out, no separate accounts."
            },
            {
              q: "Is data truly isolated between my organizations?",
              a: "Completely. Each organization has its own workspaces, members, task boards, and data. Nothing is shared between organizations. A member in Company A cannot see anything from Company B."
            },
            {
              q: "How do workspace and organization limits work?",
              a: "Limits are per plan. Starter includes 1 organization with 1 workspace. Professional gives you 3 organizations with up to 5 workspaces each (15 total). Enterprise scales to 100 organizations with 100 workspaces each."
            },
            {
              q: "Is there a free plan?",
              a: "Yes. Starter is free forever — no credit card required. It includes 1 organization, 1 workspace, and up to 5 team members with full access to kanban boards and task assignments."
            },
            {
              q: "Can I upgrade or downgrade anytime?",
              a: "Yes. Switch between plans at any time. Upgrades take effect immediately. Downgrades take effect at the end of your billing cycle. Billing is always prorated."
            },
            {
              q: "How secure is my data?",
              a: "TetherTasks runs on AWS infrastructure with encryption at rest and in transit. Authentication is handled by Amazon Cognito. Role-based access controls and comprehensive audit logging are built in at every level."
            },
            {
              q: "Can I invite team members with different permission levels?",
              a: "Yes. Every organization supports three role levels: Admins (full management), Owners (workspace-level control), and Members (task execution). Each role sees only what they need to."
            },
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
        <h2>Your Companies Deserve One Home</h2>
        <p>
          Join operators who manage every organization, workspace, and team
          from a single control center. Free to start, scales as you grow.
        </p>
        <button className="landing-btn landing-btn-white landing-btn-lg" onClick={() => handleGetStartedClick("cta_banner_create_free_account")}>
          Create Your Free Account <ArrowRight size={18} />
        </button>
        <div className="landing-cta-subtext">
          No credit card required. Free plan includes 1 org, 1 workspace, and 5 members.
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <a href="/" className="landing-footer-logo" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            <div className="landing-logo-tile landing-logo-tile-sm">
              <img src="/logo.png" alt="TetherTasks logo" className="landing-logo-img" />
            </div>
            TetherTasks
          </a>
          <div className="landing-footer-links">
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo("features"); }}>Features</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Pricing</a>
            <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>FAQ</a>
            <a href="/contact" onClick={(e) => {
              e.preventDefault();
              // Feature: Signup Funnel Analytics - track footer contact intent.
              trackSignupStart("footer_contact_link");
              navigate("/contact");
            }}>Contact</a>
          </div>
          <div className="landing-footer-copy">
            &copy; {new Date().getFullYear()} TetherTasks. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
