import { CLUB_SUBSCRIPTION, DRAFT_BOOSTS, SEASON_PASS_PRODUCT } from "@champion/shared";
import type { Metadata } from "next";

import { LegalPage, Section } from "@/components/legal/legal-page";
import { OPERATOR } from "@/content/operator";

export const metadata: Metadata = {
  title: "Terms of Use – Spinvincible",
  description: "The rules for using Spinvincible: accounts, coins, purchases, subscriptions and fair play.",
};

/** Terms of use (template – fill in content/operator.ts and have it reviewed before publishing). */
export default function TermsPage() {
  const star = DRAFT_BOOSTS.star;
  const legend = DRAFT_BOOSTS.legend;
  return (
    <LegalPage
      title="Terms of Use"
      intro={
        <p>
          These terms are the agreement between you and {OPERATOR.name} (&ldquo;we&rdquo;) for the Spinvincible app and
          website. By using Spinvincible you accept them. Please also read our <a href="/privacy">Privacy Policy</a>.
        </p>
      }
    >
      <Section title="1. The game">
        <p>
          Spinvincible is an <strong>unofficial fan game</strong>. It is not affiliated with, endorsed or sponsored by any
          football club, league, federation or player. Club and player names are used only to refer to real historical
          seasons; no logos, crests, kits or photos are used. All trademarks belong to their owners.
        </p>
        <p>
          Player ratings and match results are produced by our own statistical model. They are entertainment, not facts
          or predictions about real people or teams.
        </p>
      </Section>

      <Section title="2. Who can play">
        <p>
          You must be at least {OPERATOR.minimumAge} years old, or have permission from a parent or guardian who accepts
          these terms for you.
        </p>
      </Section>

      <Section title="3. Your account">
        <ul>
          <li>The app creates a guest account automatically; you can register it with an email and password.</li>
          <li>
            Keep your password and your backup code private – anyone with the backup code can use the account. Tell us
            at once if you think someone else has access.
          </li>
          <li>
            Usernames, mini-league names and other names you choose must not be offensive, impersonate anyone or infringe
            someone else&apos;s rights. We may change or remove them.
          </li>
          <li>You can delete your account at any time in the app (Profile → Delete account).</li>
        </ul>
      </Section>

      <Section title="4. Coins and store items">
        <ul>
          <li>
            Coins are a virtual in-game currency. You earn them by playing and can buy them with real money. They have no
            cash value, can&apos;t be exchanged for money or transferred to another account, and expire when the account is
            deleted.
          </li>
          <li>
            Coins buy cosmetics (frames, kits, crests, skins), conveniences (extra re-spins, Scout, Second chance, a Daily
            practice try) and draft boosts. They never buy a specific player, a rating or chemistry.
          </li>
          <li>
            <strong>Draft boosts and their odds.</strong> A {star.name} or {legend.name} applies to one draft. It makes the
            club reel land more often on clubs that have players rated {star.minRating}+ ({star.name}) or{" "}
            {legend.minRating}+ ({legend.name}) in the spun decade – roughly two to four times as often as without a
            boost. It never guarantees a club or a player, and you still pick from the club&apos;s real squad. Boosts
            can&apos;t be used in the Daily Challenge.
          </li>
          <li>Once used, a store item or boost is consumed and can&apos;t be returned for coins.</li>
        </ul>
      </Section>

      <Section title="5. Purchases, Season Pass and subscriptions">
        <ul>
          <li>
            Real-money purchases (coin packs, the Starter Pack, the Season Pass at €{SEASON_PASS_PRODUCT.eur} per season,
            the Spinvincible Club at €{CLUB_SUBSCRIPTION.eurPerMonth} per month) are made through the Apple App Store or
            Google Play and are subject to their terms. Prices in your currency are shown before you buy.
          </li>
          <li>
            <strong>Subscriptions renew automatically</strong> at the end of each period unless you cancel at least 24
            hours before it ends, in your App Store or Google Play account settings. Deleting the app does not cancel a
            subscription.
          </li>
          <li>
            Refunds are handled by Apple or Google under their policies. Your statutory consumer rights are not affected.
          </li>
          <li>
            By buying digital content that is delivered immediately, you agree that it is supplied at once and
            acknowledge that you lose the EU 14-day right of withdrawal once it is delivered.
          </li>
        </ul>
      </Section>

      <Section title="6. Fair play">
        <p>You agree not to:</p>
        <ul>
          <li>cheat, exploit bugs, or tamper with the app, its data or its network traffic;</li>
          <li>use bots, scripts or multiple accounts to gain coins, scores or leaderboard places;</li>
          <li>harass other players or use the game for anything unlawful.</li>
        </ul>
        <p>
          We may remove scores, coins or items gained this way and suspend or close accounts that break these rules,
          after telling you why where the law requires it.
        </p>
      </Section>

      <Section title="7. The service">
        <p>
          We work to keep Spinvincible running, but we can&apos;t promise it will always be available or error-free. We may
          change, add or remove features, modes and items. If we ever shut the game down, we will announce it in the app
          at least 30 days in advance.
        </p>
      </Section>

      <Section title="8. Liability">
        <p>
          Spinvincible is provided for entertainment. To the extent the law allows, we are not liable for indirect
          damages or lost profits. Nothing in these terms limits liability that can&apos;t be limited by law, such as for
          intent, gross negligence, or death and personal injury.
        </p>
      </Section>

      <Section title="9. Changes and law">
        <p>
          We may update these terms; the date at the top shows the latest version, and we tell you in the app about
          important changes before they take effect. These terms are governed by the law of {OPERATOR.country}. If you are
          a consumer, you also keep the protection of the mandatory law of the country where you live.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          {OPERATOR.name}, {OPERATOR.address} – <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        </p>
      </Section>
    </LegalPage>
  );
}
