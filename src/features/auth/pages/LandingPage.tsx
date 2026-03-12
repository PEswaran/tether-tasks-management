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
  UserPlus,
  FolderKanban,
  Waypoints,
  UserCog,
  FileCheck2,
  SearchCheck,
  Linkedin,
} from "lucide-react";
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
  const [animationOff, setAnimationOff] = useState(
    () => localStorage.getItem("landing_animation_off") === "1"
  );
  const landingStartRef = useRef(Date.now());
  const demoVideoUrl = import.meta.env.VITE_DEMO_VIDEO_URL as string | undefined;

  useEffect(() => {
    if (
      animationOff ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShowLogoIntro(false);
      return;
    }

    setShowLogoIntro(true);
    const timer = window.setTimeout(() => setShowLogoIntro(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleAnimation() {
    if (animationOff) {
      localStorage.removeItem("landing_animation_off");
      setAnimationOff(false);
    } else {
      localStorage.setItem("landing_animation_off", "1");
      setAnimationOff(true);
      setShowLogoIntro(false);
    }
  }

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
            <img src="https://tethertasks-assets.s3.us-east-1.amazonaws.com/tetherTasksv2.PNG" alt="" className="landing-logo-intro-img" />
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
              src="https://tethertasks-assets.s3.us-east-1.amazonaws.com/tetherTasksv2.PNG"
              alt="TetherTasks logo"
              className="landing-logo-img"
            />
          </div>
          <div className="landing-nav-brand">
            <span className="landing-nav-brand-name">
              Tether<span className="landing-nav-brand-accent">Tasks</span>
            </span>
            <span className="landing-nav-brand-tagline">Multi-Company Task Management</span>
          </div>
        </a>
        <div className="landing-nav-links">
          <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo("features"); }}>Features</a>
          <a href="#architecture" onClick={(e) => { e.preventDefault(); scrollTo("architecture"); }}>Architecture</a>
          <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo("how-it-works"); }}>Getting Started</a>
          <a href="#who-its-for" onClick={(e) => { e.preventDefault(); scrollTo("who-its-for"); }}>Built For</a>
          <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Pricing</a>
          <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>FAQ</a>
        </div>
        <div className="landing-nav-actions">
          <button
            className="landing-animation-toggle"
            onClick={toggleAnimation}
            title={animationOff ? "Turn on intro animation" : "Turn off intro animation"}
            aria-label={animationOff ? "Turn on intro animation" : "Turn off intro animation"}
          >
            {animationOff ? "Animation Off" : "Animation On"}
          </button>
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
            One Company. <span>Multiple Orgs.</span> Total Control.
          </h1>
          <p>
            Structure work the way operators actually run it:
            one company account with multiple organizations, and inside each
            organization multiple workspaces and task boards
            &mdash; all from one login with clean separation between teams.
          </p>
          <div className="landing-hero-buttons">
            <button className="landing-btn landing-btn-primary landing-btn-lg" onClick={() => handleGetStartedClick("hero_create_free_account")}>
              Create Free Account <ArrowRight size={18} />
            </button>
            {demoVideoUrl && (
              <button
                className="landing-btn landing-btn-outline landing-btn-lg"
                onClick={() => {
                  // Feature: Signup Funnel Analytics - track demo video engagement.
                  trackLandingEngagement(30); // Estimate 30 seconds of engagement for watching the video.
                  window.open(demoVideoUrl, "_blank");
                }}
              >
                <Play size={18} style={{ marginRight: 8 }} />
                Watch Demo Video
              </button>
            )}
          </div>


          <div className="landing-hero-proof">
            <span><Check size={14} /> One company can manage multiple orgs</span>
            <span><Check size={14} /> Each org supports multiple workspaces and boards</span>
            <span><Check size={14} /> Role-based access, notifications, and audit trails</span>
          </div>
        </div>
      </section>

      {/* ========== PROBLEM / SOLUTION STRIP ========== */}
      <section className="landing-capacity-strip">
        <div className="landing-capacity-grid">
          <div className="landing-capacity-card">
            <div className="landing-capacity-label">The Problem</div>
            <div className="landing-capacity-value">Work scattered across accounts</div>
            <p>Most task tools break down when one operator manages several business units, clients, or brands. Visibility disappears fast.</p>
          </div>
          <div className="landing-capacity-card featured">
            <div className="landing-capacity-label">The TetherTasks Way</div>
            <div className="landing-capacity-value">One company, many orgs</div>
            <p>Run one company account with multiple organizations, each containing its own workspaces, members, and task boards.</p>
          </div>
          <div className="landing-capacity-card">
            <div className="landing-capacity-label">The Result</div>
            <div className="landing-capacity-value">Scale without losing control</div>
            <p>Capacity limits, role scoping, and audit visibility help you grow the structure without turning it into operational chaos.</p>
          </div>
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

      <section className="landing-section" id="features">
        <div className="landing-section-header">
          <span className="landing-section-badge">Why TetherTasks</span>
          <h2>Operator-First Infrastructure for Multi-Org Execution</h2>
          <p>
            Built for the real structure behind multi-company work:
            oversight at the top, clean org boundaries in the middle, and execution where the work actually happens.
          </p>
        </div>
        <div className="landing-features-grid">
          {[
            {
              icon: <Building2 size={24} />,
              title: "Tenant Admin Control Center",
              desc: "Manage organizations, workspaces, members, usage, and account health from one control center."
            },
            {
              icon: <Waypoints size={24} />,
              title: "True Company Hierarchy",
              desc: "Model the business the way it actually operates instead of flattening everything into one shared team."
            },
            {
              icon: <Kanban size={24} />,
              title: "Visual Kanban Boards",
              desc: "Run execution inside the right workspace with clear board flow, ownership, and status visibility."
            },
            {
              icon: <UserCog size={24} />,
              title: "Role-Based Workspaces",
              desc: "Tenant admins, owners, members, and cross-workspace users each land in the right operating view."
            },
            {
              icon: <UserPlus size={24} />,
              title: "Invites and Onboarding",
              desc: "Invite admins and members, send branded emails, and onboard users through structured welcome and agreement flows."
            },
            {
              icon: <LayoutGrid size={24} />,
              title: "Plan-Aware Capacity Controls",
              desc: "Plan limits are part of the product, so growth stays visible and intentional instead of drifting."
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

      <section className="landing-section landing-section-architecture" id="architecture">
        <div className="landing-section-header">
          <span className="landing-section-badge">Product Architecture</span>
          <h2>Built to Expand Without Losing Structure</h2>
          <p>
            One company account can support multiple organizations, and each
            organization can run its own workspaces, task boards, and tasks without losing control.
          </p>
        </div>
        <div className="landing-architecture-shell">
          <div className="landing-architecture-company">
            <div className="landing-architecture-node landing-architecture-node-company">
              <div className="landing-architecture-icon"><Building2 size={20} /></div>
              <h3>One Company</h3>
              <p>One account for admin controls, plan limits, reporting, and multi-org oversight.</p>
            </div>
          </div>

          <div className="landing-architecture-company-line" aria-hidden="true" />

          <div className="landing-architecture-orgs">
            {[
              {
                title: "Organization A",
                desc: "Client, business unit, brand, or location with isolated members and reporting."
              },
              {
                title: "Organization B",
                desc: "Runs its own workspace structure while staying under the same company account."
              },
              {
                title: "Organization C",
                desc: "Separated from other orgs, but managed from the same control center."
              },
            ].map((org) => (
              <div className="landing-architecture-node landing-architecture-node-org" key={org.title}>
                <div className="landing-architecture-icon"><Briefcase size={18} /></div>
                <h3>{org.title}</h3>
                <p>{org.desc}</p>
              </div>
            ))}
          </div>

          <div className="landing-architecture-branch-note">Each organization can expand into its own execution structure</div>

          <div className="landing-architecture-detail">
            {[
              {
                icon: <LayoutGrid size={18} />,
                title: "Workspaces",
                desc: "Separate spaces for teams, initiatives, departments, or programs."
              },
              {
                icon: <FolderKanban size={18} />,
                title: "Task Boards",
                desc: "Boards inside each workspace for planning, tracking, and managing flow."
              },
              {
                icon: <ClipboardList size={18} />,
                title: "Tasks",
                desc: "Assignments, due dates, priorities, ownership, and notifications."
              },
            ].map((item) => (
              <div className="landing-architecture-step" key={item.title}>
                <div className="landing-architecture-node landing-architecture-node-detail">
                  <div className="landing-architecture-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" style={{ background: "var(--panel-soft)" }}>
        <div className="landing-section-header">
          <span className="landing-section-badge">Inside The App</span>
          <h2>Built for the Work Between Strategy and Delivery</h2>
          <p>
            The app already covers the operating layer most teams struggle to keep clean:
            assignment, accountability, permissions, and visibility across orgs.
          </p>
        </div>
        <div className="landing-ops-grid">
          {[
            {
              icon: <Bell size={22} />,
              title: "Notifications that keep work moving",
              desc: "Assignments and updates trigger in-app alerts and email notifications so teams stay aligned without extra chasing."
            },
            {
              icon: <ClipboardList size={22} />,
              title: "Audit visibility for admin actions",
              desc: "Track invitations, role changes, tenant activity, and important actions across the platform with a real audit trail."
            },
            {
              icon: <Shield size={22} />,
              title: "Security through scoped access",
              desc: "Cognito auth, role-based permissions, and tenant-aware data boundaries keep the right people in the right places."
            },
            {
              icon: <SearchCheck size={22} />,
              title: "Cross-workspace visibility when needed",
              desc: "General members and operators with broader responsibilities can work across multiple org contexts without juggling accounts."
            },
          ].map((item) => (
            <div className="landing-ops-card" key={item.title}>
              <div className="landing-ops-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="landing-section" id="how-it-works" style={{ background: "var(--panel-soft)" }}>
        <div className="landing-section-header">
          <span className="landing-section-badge">Getting Started</span>
          <h2>From Sign-Up to Full Control in 3 Steps</h2>
          <p>No complex onboarding. No sales calls. Just sign up and start organizing.</p>
        </div>
        <div className="landing-steps">
          {[
            {
              n: "1",
              title: "Set Up the Company Account",
              desc: "Start free, create your first organization, and define the structure you want operators and teams to work inside."
            },
            {
              n: "2",
              title: "Expand with More Organizations",
              desc: "Add new clients, brands, or business units with their own members, workspaces, and isolated operating context."
            },
            {
              n: "3",
              title: "Run Execution from One Control Layer",
              desc: "Move between orgs, assign work, track progress, and manage teams without jumping between separate accounts."
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
      <section className="landing-section" id="who-its-for">
        <div className="landing-section-header">
          <span className="landing-section-badge">Built For</span>
          <h2>Built for Operators Managing Parallel Work</h2>
          <p>
            If your work spans multiple clients, brands, locations, or business units,
            this gives you one operating layer without flattening everything together.
          </p>
        </div>
        <div className="landing-persona-grid">
          {[
            {
              icon: <Briefcase size={28} />,
              title: "Consultants",
              desc: "Run separate client orgs with their own workspaces, members, and deliverables without spinning up a new account each time."
            },
            {
              icon: <Users size={28} />,
              title: "Agencies",
              desc: "Manage multiple brands and retainers from one login while keeping each client’s work isolated and accountable."
            },
            {
              icon: <Store size={28} />,
              title: "Franchise Operators",
              desc: "Give each location its own operating structure while keeping visibility at the company level."
            },
            {
              icon: <Rocket size={28} />,
              title: "Serial Entrepreneurs",
              desc: "Stop juggling separate tools and logins as you build across ventures, brands, or internal teams."
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
      <section className="landing-section">
        <div className="landing-section-header">
          <span className="landing-section-badge">Why Us</span>
          <h2>What Other Task Tools Usually Leave to Workarounds</h2>
          <p>TetherTasks handles the structure, control, and onboarding layer that multi-org operators usually have to patch together themselves.</p>
        </div>
        <div className="landing-comparison-grid">
          {[
            {
              icon: <Globe size={24} />,
              title: "Beyond Separate Projects",
              desc: "Separate projects are not enough when the real problem is managing isolated org structures under one company account."
            },
            {
              icon: <Zap size={24} />,
              title: "Context Switching Without Friction",
              desc: "Move across organizations and workspaces from one login instead of treating every org like a separate tool."
            },
            {
              icon: <FileCheck2 size={24} />,
              title: "Operational Onboarding, Not Just Signup",
              desc: "Trials, pilots, admin creation, invite flows, welcome pages, and agreement handling make rollout feel structured."
            },
            {
              icon: <Lock size={24} />,
              title: "Security and Accountability",
              desc: "Role scoping, Cognito auth, notifications, and audit logging support real operational accountability once stakes are higher."
            },
          ].map((f) => (
            <div className="landing-comparison-card" key={f.title}>
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
          <p>Start with a simple org structure, then expand your company account as more organizations and teams come online.</p>
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

      <section className="landing-pilot-banner">
        <div className="landing-pilot-copy">
          <span className="landing-section-badge">Pilot Ready</span>
          <h2>Need a Guided Rollout First?</h2>
          <p>
            The platform already supports pilot provisioning, agreement generation, and structured admin onboarding.
            That gives you a credible rollout path for agencies, franchise groups, and larger teams that want a guided start.
          </p>
        </div>
        <div className="landing-pilot-actions">
          <button
            className="landing-btn landing-btn-primary"
            onClick={() => {
              trackSignupStart("pilot_banner_contact_sales");
              navigate("/pilot");
            }}
          >
            Start a Pilot
          </button>
          <button className="landing-btn landing-btn-outline" onClick={() => handleGetStartedClick("pilot_banner_start_free")}>
            Try Starter Free
          </button>
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
          Run organizations, workspaces, and task execution from one control layer.
          Start free, stay structured, and expand as the business grows.
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
              <img src="https://tethertasks-assets.s3.us-east-1.amazonaws.com/tetherTasksv2.PNG" alt="TetherTasks logo" className="landing-logo-img" />
            </div>
            <span className="landing-footer-brand">
              Tether<span className="landing-nav-brand-accent">Tasks</span>
            </span>
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
          <div className="landing-footer-socials">
            <a
              href="https://www.linkedin.com/company/tethertasks"
              target="_blank"
              rel="noreferrer"
              aria-label="Visit TetherTasks on LinkedIn"
            >
              <Linkedin size={18} />
            </a>
          </div>
          <div className="landing-footer-copy">
            &copy; {new Date().getFullYear()} TetherTasks. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
