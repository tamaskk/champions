import type { Metadata } from "next";

import { LegalPage, Section } from "@/components/legal/legal-page";
import { OPERATOR } from "@/content/operator";

export const metadata: Metadata = {
  title: "Support – Spinvincible",
  description: "Help with your Spinvincible account, purchases and the game.",
};

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "How do I keep my progress if I change phones?",
    a: (
      <>
        Create an account in the app (Profile → Create account) and log in on the new phone. Guests can also save their
        backup code (Profile → Save) and enter it on the new device.
      </>
    ),
  },
  {
    q: "I forgot my password.",
    a: (
      <>
        On the log-in screen tap <strong>Forgot password?</strong>. We email you a 6-digit code; or use your backup code
        instead.
      </>
    ),
  },
  {
    q: "How do I delete my account?",
    a: (
      <>
        In the app: <strong>Profile → Delete account</strong>. This removes your account and all its data for good. You
        can also email us from the address linked to your account.
      </>
    ),
  },
  {
    q: "A purchase didn't arrive, or I want a refund.",
    a: (
      <>
        Restart the app first – purchases are credited once the store confirms them. Refunds are handled by Apple (
        <a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a>) or Google Play (Order history → Request a
        refund). If coins or items are still missing, email us with the date and the order number.
      </>
    ),
  },
  {
    q: "How do I cancel a subscription?",
    a: (
      <>
        iPhone: Settings → your name → Subscriptions. Android: Google Play → Profile → Payments &amp; subscriptions →
        Subscriptions. Deleting the app doesn&apos;t cancel it.
      </>
    ),
  },
  {
    q: "How do draft boosts work?",
    a: (
      <>
        A boost makes the club reel land more often on clubs with top-rated players for one draft – never a guaranteed
        player. The exact rules are in our <a href="/terms">Terms</a>, section 4.
      </>
    ),
  },
];

/** Support page: FAQ and how to reach us. */
export default function SupportPage() {
  return (
    <LegalPage
      title="Support"
      intro={
        <p>
          Something not working, or a question about your account? Check the answers below, or write to{" "}
          <a className="text-white underline underline-offset-2" href={`mailto:${OPERATOR.email}`}>
            {OPERATOR.email}
          </a>{" "}
          – we usually reply within two working days.
        </p>
      }
    >
      {FAQ.map((f) => (
        <Section key={f.q} title={f.q}>
          <p>{f.a}</p>
        </Section>
      ))}
      <Section title="Contact">
        <p>
          Email <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. Please include your username (Profile) and,
          for purchases, the date and order number. Never send us your password or backup code.
        </p>
        <p>
          {OPERATOR.name}, {OPERATOR.address}
        </p>
      </Section>
    </LegalPage>
  );
}
