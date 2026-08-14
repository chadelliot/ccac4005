import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Christ Cathedral Apostolic Church" },
      {
        name: "description",
        content:
          "How Christ Cathedral Apostolic Church collects, uses and stores personal information through its website and member portal.",
      },
    ],
  }),
  component: PrivacyPolicy,
});

/**
 * Written from what the application actually does, not from a template. Every
 * claim below corresponds to real behaviour in this repository — the tables
 * named exist, the third parties named are the ones the browser and the edge
 * functions actually contact.
 *
 * If the data flows change, this page changes with them. The most likely
 * candidates are adding an analytics tool (there is none today) or a new
 * third-party embed.
 */
function PrivacyPolicy() {
  return (
    <LegalPage eyebrow="Privacy" title="Privacy Policy" updated="2026-08-13">
      <Section title="Who we are">
        <p>
          Christ Cathedral Apostolic Church ("the church", "we") operates this website at
          ccacbmore.com, including the member portal and the Bishop's engagement booking system.
          We are located at 4005 Old York Road, Baltimore, Maryland.
        </p>
        <p>
          This page explains what personal information the site handles, why, and who else sees
          it. It covers visitors, members with accounts, churches inviting the Bishop, and people
          whose details members record in our outreach tools.
        </p>
      </Section>

      <Section title="What we collect">
        <dl>
          <dt>Visiting the site</dt>
          <dd>
            No account is needed to browse, and the site sets no analytics or advertising
            trackers. We do not use Google Analytics, advertising pixels, or session recording.
            Our hosting provider receives your IP address as part of serving each page, as any
            web host does.
          </dd>

          <dt>Inviting the Bishop</dt>
          <dd>
            The invitation form collects your church's name and address, your pastor's name, your
            name, email address and telephone number, and the details of the engagement you are
            proposing — including any travel, accommodation and honorarium notes you choose to
            add. This is stored so the Bishop's office can consider and respond to your request.
          </dd>

          <dt>Preventing abuse of that form</dt>
          <dd>
            To stop automated submissions we store a one-way cryptographic hash of your IP
            address, salted with a secret value, together with your browser's user-agent string.
            <strong> We do not store your IP address itself</strong>, and the hash cannot be
            reversed to recover it. These records are prunable and are not used for any other
            purpose.
          </dd>

          <dt>Responding to an event</dt>
          <dd>
            If you RSVP to a public event without an account, we record the name, email address
            and response you give.
          </dd>

          <dt>Member accounts</dt>
          <dd>
            Signing up creates an account holding your email address and password, managed by our
            authentication provider — we never see your password. Your profile may also hold a
            display name, telephone number and avatar image if you provide them. Using the portal
            creates records of your group memberships and messages, event responses, reading-plan
            progress, quiz attempts and certificates.
          </dd>

          <dt>People recorded in outreach tools</dt>
          <dd>
            Members can record details of people they have witnessed to, which may include a
            name, telephone number, address and approximate location, notes, prayer requests and
            spiritual milestones. <strong>These people are usually not users of this site.</strong>{" "}
            We treat those records as confidential, restrict them to church leadership, and do not
            sell, publish or share them. If you are recorded in these notes and would like your
            entry removed, contact us and we will delete it.
          </dd>
        </dl>
      </Section>

      <Section title="Why we hold it">
        <ul>
          <li>To answer invitations and arrange the Bishop's engagements.</li>
          <li>To run church membership, groups, events and study programmes.</li>
          <li>To support pastoral care and follow-up with people who have asked for it.</li>
          <li>To keep the site working and protect it from abuse.</li>
        </ul>
        <p>
          We do not sell personal information, and we do not use it for advertising or
          profiling.
        </p>
      </Section>

      <Section title="Who else sees it">
        <p>
          We use a small number of service providers. Each receives only what it needs to do its
          job:
        </p>
        <dl>
          <dt>Supabase</dt>
          <dd>
            Database, authentication and server functions. Our data is stored in their Canada
            (Central) region. This is where almost everything described above lives.
          </dd>

          <dt>GitHub Pages</dt>
          <dd>Serves the website's pages and images, and receives your IP address to do so.</dd>

          <dt>Google Fonts</dt>
          <dd>
            Typefaces are loaded from Google's servers, which receive your IP address as part of
            that request.
          </dd>

          <dt>Google Maps</dt>
          <dd>
            The Find Us page embeds a map, and the leadership outreach map uses Google's mapping
            service. Loading them contacts Google.
          </dd>

          <dt>YouTube and Facebook</dt>
          <dd>
            The homepage background video is served by YouTube in its no-cookie mode, and the
            Watch Live page embeds Facebook's video player when a service is streaming. Playing
            embedded video means interacting with those companies under their own privacy
            policies.
          </dd>

          <dt>Google Calendar</dt>
          <dd>
            When an invitation is accepted, its details are written to the Bishop's calendar so
            the engagement can be scheduled.
          </dd>

          <dt>Email delivery</dt>
          <dd>
            Acknowledgements and notifications are sent through a transactional email provider,
            which processes the recipient address and message content.
          </dd>
        </dl>
        <p>
          We may also disclose information where the law requires it, or to protect someone's
          safety.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Engagement requests, member records and outreach notes are kept while they remain
          useful to the ministry, and removed on request. Anti-abuse records are short-lived by
          design. If you close your account we remove your profile and account record; content
          you contributed to shared spaces, such as group messages, may remain unless you ask us
          to remove that too.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can ask us to show you what we hold about you, correct it, or delete it. Members
          can edit much of their own profile directly in the portal. To make any other request,
          or to ask about a record someone else created about you, contact us using the details
          below and tell us enough to find the record.
        </p>
        <p>
          Most browsers let you block third-party content. Doing so may stop the embedded map or
          video from loading, but the rest of the site will work.
        </p>
      </Section>

      <Section title="Children">
        <p>
          The member portal is intended for adults and for young people participating in church
          programmes with the knowledge of a parent or guardian. We do not knowingly collect
          information from children outside that context. If you believe we hold information
          about a child that we should not, contact us and we will remove it.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we change how we handle personal information we will update this page and the date
          at the top. Significant changes affecting members will also be announced in the portal.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Christ Cathedral Apostolic Church
          <br />
          4005 Old York Road, Baltimore, Maryland
          <br />
          <a href="mailto:christcathedralapostolic@gmail.com">
            christcathedralapostolic@gmail.com
          </a>
        </p>
        <p>
          See also our <Link to="/terms">Terms of Service</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
