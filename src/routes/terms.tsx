import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Christ Cathedral Apostolic Church" },
      {
        name: "description",
        content:
          "The terms governing use of the Christ Cathedral Apostolic Church website, member portal and engagement booking system.",
      },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage eyebrow="Terms" title="Terms of Service" updated="2026-08-13">
      <Section title="About these terms">
        <p>
          These terms cover your use of the Christ Cathedral Apostolic Church website at
          ccacbmore.com, including the member portal and the system for inviting Bishop Justin O.
          Marcus to speak. By using the site you accept them. If you do not, please do not use
          the site.
        </p>
      </Section>

      <Section title="Using the site">
        <p>You agree not to:</p>
        <ul>
          <li>Submit false information, or impersonate another person, church or organisation.</li>
          <li>
            Attempt to access accounts, records or areas of the site you have not been given
            access to.
          </li>
          <li>
            Use automated tools to submit forms, harvest information, or place unreasonable load
            on the site.
          </li>
          <li>Upload anything unlawful, abusive, or infringing someone else's rights.</li>
        </ul>
      </Section>

      <Section title="Member accounts">
        <p>
          You are responsible for keeping your password secure and for what happens under your
          account. Tell us promptly if you believe it has been used without your permission.
        </p>
        <p>
          Some areas of the portal are restricted to particular roles within the ministry. Access
          is granted by the church and can be changed or withdrawn at its discretion. We may
          suspend or close an account that is being misused.
        </p>
        <p>
          Information members record about other people — including outreach and pastoral notes —
          must be handled with care and confidentiality, and used only for the ministry purposes
          it was gathered for.
        </p>
      </Section>

      <Section title="Invitations to the Bishop">
        <p>
          This is the part most likely to be misunderstood, so it is worth stating plainly:
        </p>
        <ul>
          <li>
            <strong>Submitting the form is a request, not a booking.</strong> It creates no
            commitment on either side.
          </li>
          <li>
            The reference number you receive confirms that we have your request. It is not a
            confirmation that the Bishop will attend.
          </li>
          <li>
            <strong>An engagement is confirmed only when the Bishop's office tells you so
            directly.</strong> Any availability shown on the site is indicative and may not
            reflect commitments not yet recorded.
          </li>
          <li>
            The Bishop may decline any invitation, and may withdraw from a confirmed engagement
            where illness, bereavement, travel disruption or the needs of this congregation
            require it. We will tell you as soon as we can if that happens.
          </li>
          <li>
            Sunday engagements cannot be accepted, as the Bishop is with his own congregation.
          </li>
          <li>
            Travel, accommodation and honorarium arrangements are agreed between your church and
            the Bishop's office. Anything stated on this site describes our usual practice, not a
            binding agreement.
          </li>
        </ul>
        <p>
          Please do not announce, advertise or print materials naming the Bishop before you have
          written confirmation from his office.
        </p>
      </Section>

      <Section title="Events, giving and other services">
        <p>
          Event details may change, and we will publish updates where we can. Giving is handled
          by third-party payment providers under their own terms; we do not process or store card
          details on this site.
        </p>
      </Section>

      <Section title="Content and copyright">
        <p>
          Sermons, teaching materials, photographs, text and design on this site belong to the
          church or its licensors. You may share links freely, and reproduce material for
          personal or congregational use with attribution. Commercial use, or republishing at
          scale, requires our permission.
        </p>
        <p>
          If you submit content, you confirm you have the right to do so and give the church
          permission to use it in connection with the ministry.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>
          The site embeds services operated by others, including video players and maps, and
          links to external sites. We do not control them and are not responsible for their
          content or practices. Our{" "}
          <Link to="/privacy-policy">Privacy Policy</Link> lists which services are involved.
        </p>
      </Section>

      <Section title="Availability">
        <p>
          We provide the site as it is, and we do not guarantee it will always be available,
          uninterrupted, or free of errors. We may change, suspend or withdraw any part of it. We
          try to keep livestreams reliable, but they depend on services and connections outside
          our control.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the extent the law allows, the church is not liable for indirect or consequential
          loss arising from use of this site — including costs incurred in reliance on an
          engagement that is not confirmed in writing by the Bishop's office. Nothing here limits
          liability that cannot lawfully be limited.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these terms. The date at the top of this page shows when they last
          changed, and continuing to use the site means accepting the current version.
        </p>
      </Section>

      <Section title="Governing law and contact">
        <p>
          These terms are governed by the laws of the State of Maryland, United States.
        </p>
        <p>
          Christ Cathedral Apostolic Church
          <br />
          4005 Old York Road, Baltimore, Maryland
          <br />
          <a href="mailto:christcathedralapostoic@gmail.com">
            christcathedralapostoic@gmail.com
          </a>
        </p>
      </Section>
    </LegalPage>
  );
}
