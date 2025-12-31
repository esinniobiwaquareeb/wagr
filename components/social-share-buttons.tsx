"use client";

import { Share2, Twitter, Facebook, MessageCircle, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface SocialShareButtonsProps {
  url: string;
  title: string;
  description?: string;
  wagerId?: string;
}

export function SocialShareButtons({
  url,
  title,
  description,
  wagerId,
}: SocialShareButtonsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const shareText = description
    ? `${title} - ${description}`
    : `Check out this wager: ${title}`;

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const shareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText
    )}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
  };

  const shareFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareUrl
    )}`;
    window.open(facebookUrl, "_blank", "width=550,height=420");
  };

  const shareWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
      `${shareText} ${shareUrl}`
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or error occurred
      }
    } else {
      // Fallback to copy
      copyLink();
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <Button onClick={nativeShare} variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      )}

      <Button onClick={shareTwitter} variant="outline" size="sm">
        <Twitter className="h-4 w-4" />
      </Button>

      <Button onClick={shareFacebook} variant="outline" size="sm">
        <Facebook className="h-4 w-4" />
      </Button>

      <Button onClick={shareWhatsApp} variant="outline" size="sm">
        <MessageCircle className="h-4 w-4" />
      </Button>

      <Button onClick={copyLink} variant="outline" size="sm">
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}

