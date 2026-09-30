import type { Metadata } from "next";

import { LegalPage, Section } from "@/components/legal/legal-page";
import { OPERATOR } from "@/content/operator";

export const metadata: Metadata = {
  title: "Privacy Policy – Spinvincible",
  description: "What data Spinvincible collects, why, how long it is kept and your rights.",
};

/** Privacy policy (template – fill in content/operator.ts and have it reviewed before publishing). */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          Spinvincible is a football draft game for iOS and Android, with this website. This policy explains what
          personal data we process, why, and what you can do about it. We collect as little as the game needs, we
          don&apos;t sell data, and we don&apos;t use advertising trackers or analytics tools.
        </p>
      }
    >
      <Section title="1. Who is responsible">
        <p>
          The controller of your data is <strong>{OPERATOR.name}</strong>, {OPERATOR.address} ({OPERATOR.registration}).
          For any privacy question or request, write to <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
        </p>
      </Section>

      <Section title="2. What we process and why">
        <p>
          <strong>Guest account.</strong> The first time the app goes online it creates an account with a random
          identifier (your &ldquo;backup code&rdquo;) and a generated username. Needed to run the game: your coins, saved
          squads and scores are tied to it. Legal basis: performance of our contract with you (GDPR Art. 6(1)(b)).
        </p>
        <p>
          <strong>Registered account (optional).</strong> Name, username, email address and a password, stored only as
          a salted hash. Used to log in on other devices and to send you a code if you forget your password. Basis: contract.
        </p>
        <p>
          <strong>Game data.</strong> Squads you save to the leaderboard (with your username, visible to other players),
          tournament results, Daily Challenge scores, mini-leagues you create or join (members see each other&apos;s
          usernames and scores), head-to-head matchmaking, coin balance and the history of coins earned and spent.
          Basis: contract.
        </p>
        <p>
          <strong>Purchases.</strong> When in-app purchases are live, payment is handled by Apple or Google; we only
          receive a confirmation of what was bought (no card details), through our payment partner RevenueCat. Basis:
          contract; tax and accounting records where the law requires them (Art. 6(1)(c)).
        </p>
        <p>
          <strong>Launch waitlist.</strong> If you sign up on this website: your email address, the time, which form you
          used and your browser language. Used only to tell you when the app launches. Basis: your consent (Art. 6(1)(a)),
          which you can withdraw at any time.
        </p>
        <p>
          <strong>Technical data.</strong> Our hosting provider processes IP addresses and request logs to deliver the
          service and keep it secure. Basis: our legitimate interest in running a secure service (Art. 6(1)(f)).
        </p>
        <p>
          <strong>Usage statistics and error reports.</strong> The app sends us anonymous events (app opened, draft
          started or completed, tournament finished and its mode, something shared) and, when the app hits an error, the
          error message and where in the code it happened. They carry a random installation id created by the app – not
          your account, username or IP address – plus the platform (iOS/Android) and app version. We use them only to see
          which parts of the game work and to fix bugs; no third party receives them. Basis: our legitimate interest in
          improving the game and keeping it stable (Art. 6(1)(f)).
        </p>
        <p>
          <strong>On your device.</strong> The app keeps your progress, settings, records and drafts in progress in its
          own storage on your device. It does not read other data on your phone.
        </p>
      </Section>

      <Section title="3. What we don't do">
        <ul>
          <li>No advertising or third-party analytics SDKs, no tracking across apps or websites, no selling or renting of data.</li>
          <li>No photos, contacts, location or microphone data.</li>
          <li>No automated decisions with legal or similarly significant effects on you.</li>
        </ul>
      </Section>

      <Section title="4. Who else processes it">
        <p>We use a small number of processors, bound by data processing agreements:</p>
        <ul>
          <li>Vercel Inc. – hosting of this website and the game&apos;s server.</li>
          <li>MongoDB Inc. (Atlas) – database, region: {OPERATOR.databaseRegion}.</li>
          <li>Resend – sending password-reset emails.</li>
          <li>Apple, Google and RevenueCat – in-app purchases, once available.</li>
        </ul>
        <p>
          Some of them are based in the United States. Transfers rely on the EU–US Data Privacy Framework or the
          European Commission&apos;s standard contractual clauses.
        </p>
      </Section>

      <Section title="5. How long we keep it">
        <ul>
          <li>Account and game data: until you delete your account (in the app: Profile → Delete account).</li>
          <li>Waitlist email: until the launch announcement is sent, or earlier if you ask us to remove it.</li>
          <li>Password-reset codes: 15 minutes.</li>
          <li>Usage statistics and error reports: 180 days.</li>
          <li>Server logs: kept by our hosting provider for a short period for security.</li>
          <li>Purchase records: as long as tax and accounting law requires.</li>
        </ul>
      </Section>

      <Section title="6. Your rights">
        <p>
          You can ask for access to your data, correction, deletion, restriction, portability, and you can object to
          processing based on legitimate interest or withdraw consent. You can delete your account and all its game data
          yourself in the app (Profile → Delete account); for anything else write to{" "}
          <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. We answer within one month.
        </p>
        <p>You can also complain to the data protection authority: {OPERATOR.authority}.</p>
      </Section>

      <Section title="7. Children">
        <p>
          Spinvincible is meant for players aged {OPERATOR.minimumAge} and over. We don&apos;t knowingly collect data from
          younger children; if you believe a child has created an account, write to us and we will delete it.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          Connections are encrypted (HTTPS), passwords are stored only as salted hashes, and access to the database is
          restricted. Keep your backup code private: anyone who has it can use your account.
        </p>
      </Section>

      <Section title="9. Changes">
        <p>
          If we change this policy, we update the date at the top and, for important changes, tell you in the app before
          they take effect.
        </p>
      </Section>
    </LegalPage>
  );
}
