"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send } from "lucide-react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate name
      const trimmedName = formData.name.trim();
      if (!trimmedName) {
        toast({
          title: "Name required",
          description: "Please enter your name.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedName.length < 2) {
        toast({
          title: "Name too short",
          description: "Name must be at least 2 characters long.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedName.length > 100) {
        toast({
          title: "Name too long",
          description: "Name must not exceed 100 characters.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate email
      const trimmedEmail = formData.email.trim();
      if (!trimmedEmail) {
        toast({
          title: "Email required",
          description: "Please enter your email address.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        toast({
          title: "Invalid email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate subject
      const trimmedSubject = formData.subject.trim();
      if (!trimmedSubject) {
        toast({
          title: "Subject required",
          description: "Please enter a subject.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedSubject.length < 3) {
        toast({
          title: "Subject too short",
          description: "Subject must be at least 3 characters long.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedSubject.length > 200) {
        toast({
          title: "Subject too long",
          description: "Subject must not exceed 200 characters.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate message
      const trimmedMessage = formData.message.trim();
      if (!trimmedMessage) {
        toast({
          title: "Message required",
          description: "Please enter your message.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedMessage.length < 10) {
        toast({
          title: "Message too short",
          description: "Message must be at least 10 characters long.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedMessage.length > 2000) {
        toast({
          title: "Message too long",
          description: "Message must not exceed 2000 characters.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

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
      setSubmitting(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Contact Us</h1>
        <p className="text-muted-foreground mb-8">
          Have a question or need help? We're here to assist you.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Get in Touch</h2>
            <p className="text-muted-foreground mb-6">
              Fill out the form and we'll get back to you as soon as possible.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">support@wagr.app</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Subject *</label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="What's this about?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Message *</label>
              <textarea
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={5}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                placeholder="Tell us more..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

