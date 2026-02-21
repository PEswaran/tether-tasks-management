import { useState } from "react";
import { ArrowLeft, Send, CheckCircle } from "lucide-react";
import { dataClient } from "../../../libs/data-client";

interface ContactPageProps {
  onBack: () => void;
}

export default function ContactPage({ onBack }: ContactPageProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    companyName: "",
    phone: "",
    teamSize: "",
    numberOfOrgs: "",
    businessType: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const client = dataClient();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await client.mutations.submitContactRequest(
        {
          name: form.name,
          email: form.email,
          companyName: form.companyName,
          phone: form.phone || undefined,
          teamSize: form.teamSize || undefined,
          numberOfOrgs: form.numberOfOrgs || undefined,
          businessType: form.businessType || undefined,
          message: form.message,
        },
        { authMode: "apiKey" }
      );

      if (res.errors?.length) {
        setError(res.errors[0].message);
      } else if (res.data?.success) {
        setSubmitted(true);
      } else {
        setError(res.data?.message || "Something went wrong. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <img src="/logo.png" alt="TetherTasks logo" className="landing-logo-img" />
          TetherTasks
        </div>
        <div className="landing-nav-actions">
          <button className="landing-btn landing-btn-outline" onClick={onBack}>
            <ArrowLeft size={16} /> Back to Home
          </button>
        </div>
      </nav>

      {/* Contact Form Section */}
      <section className="contact-section">
        {submitted ? (
          <div className="contact-success">
            <CheckCircle size={56} />
            <h2>Thank You!</h2>
            <p>
              Your request has been submitted successfully. Our team will review
              your information and get in touch shortly.
            </p>
            <button
              className="landing-btn landing-btn-primary landing-btn-lg"
              onClick={onBack}
            >
              Back to Home
            </button>
          </div>
        ) : (
          <div className="contact-form-wrapper">
            <div className="contact-header">
              <h1>Get Started with TetherTasks</h1>
              <p>
                Tell us about your business and how many organizations you
                manage. We'll help you find the right plan.
              </p>
            </div>

            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="contact-form-row">
                <div className="contact-form-field">
                  <label htmlFor="name">Full Name *</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={form.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                  />
                </div>
                <div className="contact-form-field">
                  <label htmlFor="email">Email *</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="john@company.com"
                  />
                </div>
              </div>

              <div className="contact-form-row">
                <div className="contact-form-field">
                  <label htmlFor="companyName">Company Name *</label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required
                    value={form.companyName}
                    onChange={handleChange}
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="contact-form-field">
                  <label htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="contact-form-row">
                <div className="contact-form-field">
                  <label htmlFor="numberOfOrgs">Number of Organizations</label>
                  <select
                    id="numberOfOrgs"
                    name="numberOfOrgs"
                    value={form.numberOfOrgs}
                    onChange={handleChange}
                  >
                    <option value="">How many companies do you manage?</option>
                    <option value="1">1 company</option>
                    <option value="2-3">2–3 companies</option>
                    <option value="4-10">4–10 companies</option>
                    <option value="10+">10+ companies</option>
                  </select>
                </div>
                <div className="contact-form-field">
                  <label htmlFor="businessType">Type of Business</label>
                  <select
                    id="businessType"
                    name="businessType"
                    value={form.businessType}
                    onChange={handleChange}
                  >
                    <option value="">Select your business type</option>
                    <option value="consulting">Consulting</option>
                    <option value="agency">Agency</option>
                    <option value="franchise">Franchise / Multi-location</option>
                    <option value="startup">Startup</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="contact-form-field">
                <label htmlFor="teamSize">Team Size</label>
                <select
                  id="teamSize"
                  name="teamSize"
                  value={form.teamSize}
                  onChange={handleChange}
                >
                  <option value="">Select team size</option>
                  <option value="1-5">1–5 people</option>
                  <option value="6-20">6–20 people</option>
                  <option value="21-50">21–50 people</option>
                  <option value="50+">50+ people</option>
                </select>
              </div>

              <div className="contact-form-field">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={4}
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Tell us about your team and what you're looking for..."
                />
              </div>

              {error && <div className="contact-error">{error}</div>}

              <button
                type="submit"
                className="landing-btn landing-btn-primary landing-btn-lg"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : (
                  <>Submit Request <Send size={18} /></>
                )}
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
