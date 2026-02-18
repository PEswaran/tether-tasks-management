import { useState } from "react";
import { ArrowLeft, Send, CheckCircle, Kanban } from "lucide-react";
import { dataClient } from "./libs/data-client";

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
          <Kanban size={22} />
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
                Fill out the form below and our team will reach out to help you
                set up your workspace.
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
