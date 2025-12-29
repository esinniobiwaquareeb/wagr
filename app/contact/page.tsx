"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Phone, MessageSquare, User, AtSign, FileText, Loader2 } from "lucide-react";
import { StructuredData } from "@/components/seo/structured-data";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { BackButton } from "@/components/back-button";
import { contactPageSchema } from "./metadata";
import { logger } from "@/lib/logger";

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [supportInfo, setSupportInfo] = useState({
    email: "support@wagr.app",
    phone: "",
    note: "",
  });
  const [loadingInfo, setLoadingInfo] = useState(true);
  const { toast } = useToast();

  // Fetch support information from platform settings
  useEffect(() => {
    const fetchSupportInfo = async () => {
      try {
        const response = await fetch('/api/settings/public');
        if (response.ok) {
          const data = await response.json();
          const settings = data.settings || {};
          
          setSupportInfo({
            email: settings['support.email'] || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@wagr.app',
            phone: settings['support.phone'] || '',
            note: settings['support.note'] || '',
          });
        }
      } catch (error) {
        logger.error('Error fetching support info', error);
      } finally {
        setLoadingInfo(false);
      }
    };

    fetchSupportInfo();
  }, []);

  const validateField = (name: keyof FormErrors, value: string): string | undefined => {
    const trimmed = value.trim();
    
    switch (name) {
      case "name":
        if (!trimmed) return "Name is required";
        if (trimmed.length < 2) return "Name must be at least 2 characters";
        if (trimmed.length > 100) return "Name must not exceed 100 characters";
        break;
      case "email":
        if (!trimmed) return "Email is required";
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) return "Please enter a valid email address";
        break;
      case "subject":
        if (!trimmed) return "Subject is required";
        if (trimmed.length < 3) return "Subject must be at least 3 characters";
        if (trimmed.length > 200) return "Subject must not exceed 200 characters";
        break;
      case "message":
        if (!trimmed) return "Message is required";
        if (trimmed.length < 10) return "Message must be at least 10 characters";
        if (trimmed.length > 2000) return "Message must not exceed 2000 characters";
        break;
    }
    return undefined;
  };

  const handleBlur = (field: keyof FormErrors) => {
    const error = validateField(field, formData[field]);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const newErrors: FormErrors = {};
    (Object.keys(formData) as Array<keyof FormErrors>).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: "Please fix the errors",
        description: "Some fields need attention before submitting.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const trimmedName = formData.name.trim();
      const trimmedEmail = formData.email.trim();
      const trimmedSubject = formData.subject.trim();
      const trimmedMessage = formData.message.trim();

      // Send message to backend
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          subject: trimmedSubject,
          message: trimmedMessage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      toast({
        title: "Message sent!",
        description: "We'll get back to you as soon as possible.",
      });
      setFormData({ name: "", email: "", subject: "", message: "" });
      setErrors({});
      setSubmitting(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  return (
    <>
      <StructuredData data={contactPageSchema} />
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-6">
          <div className="mb-6">
            <Breadcrumbs items={[{ name: "Contact", url: "/contact" }]} className="mb-4" />
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Contact Us</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Have a question or need help? We're here to assist you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {/* Contact Information Card */}
            <div className="bg-card border border-border rounded-lg p-5 md:p-6">
              <h2 className="text-xl font-semibold mb-3">Get in Touch</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Fill out the form and we'll get back to you as soon as possible.
              </p>
              {JSON.stringify(supportInfo)}

              <div className="space-y-4">
                {loadingInfo ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 animate-pulse">
                      <div className="h-5 w-5 rounded bg-muted mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 rounded bg-muted" />
                        <div className="h-4 w-40 rounded bg-muted" />
                      </div>
                    </div>
                    <div className="flex items-start gap-3 animate-pulse">
                      <div className="h-5 w-5 rounded bg-muted mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 rounded bg-muted" />
                        <div className="h-4 w-32 rounded bg-muted" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {supportInfo.email && (
                      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="p-1.5 rounded-md bg-primary/10">
                          <Mail className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm mb-1">Support Email</p>
                          <a 
                            href={`mailto:${supportInfo.email}`}
                            className="text-sm text-primary hover:underline break-all"
                          >
                            {supportInfo.email}
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {supportInfo.phone && (
                      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="p-1.5 rounded-md bg-primary/10">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm mb-1">Contact Phone</p>
                          <a 
                            href={`tel:${supportInfo.phone}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {supportInfo.phone}
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {supportInfo.note && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="p-1.5 rounded-md bg-primary/10">
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm mb-1.5">Support Note</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-line">
                            {supportInfo.note}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Contact Form */}
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-5 md:p-6 space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Name <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    onBlur={() => handleBlur("name")}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 transition ${
                      errors.name
                        ? "border-destructive focus:ring-destructive/50"
                        : "border-input focus:ring-primary/50"
                    }`}
                    placeholder="Your name"
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "name-error" : undefined}
                  />
                </div>
                {errors.name && (
                  <p id="name-error" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                    {errors.name}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formData.name.length}/100 characters
                </p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 transition ${
                      errors.email
                        ? "border-destructive focus:ring-destructive/50"
                        : "border-input focus:ring-primary/50"
                    }`}
                    placeholder="your@email.com"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium mb-2">
                  Subject <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="subject"
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    onBlur={() => handleBlur("subject")}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 transition ${
                      errors.subject
                        ? "border-destructive focus:ring-destructive/50"
                        : "border-input focus:ring-primary/50"
                    }`}
                    placeholder="What's this about?"
                    aria-invalid={!!errors.subject}
                    aria-describedby={errors.subject ? "subject-error" : undefined}
                  />
                </div>
                {errors.subject && (
                  <p id="subject-error" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                    {errors.subject}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formData.subject.length}/200 characters
                </p>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <textarea
                    id="message"
                    required
                    value={formData.message}
                    onChange={(e) => handleChange("message", e.target.value)}
                    onBlur={() => handleBlur("message")}
                    rows={6}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 resize-none transition ${
                      errors.message
                        ? "border-destructive focus:ring-destructive/50"
                        : "border-input focus:ring-primary/50"
                    }`}
                    placeholder="Tell us more about your question or concern..."
                    aria-invalid={!!errors.message}
                    aria-describedby={errors.message ? "message-error" : undefined}
                  />
                </div>
                {errors.message && (
                  <p id="message-error" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                    {errors.message}
                  </p>
                )}
                <p className={`mt-1.5 text-xs ${
                  formData.message.length > 2000 
                    ? "text-destructive" 
                    : formData.message.length > 1800 
                    ? "text-yellow-600 dark:text-yellow-500" 
                    : "text-muted-foreground"
                }`}>
                  {formData.message.length}/2000 characters
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}

