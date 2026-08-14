import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Find Us was folded into Plan a Visit — they answered the same question, and a
 * visitor had to read both to assemble one answer.
 *
 * Kept as a redirect rather than deleted. The address has been on this URL long
 * enough to be linked from elsewhere and printed on things nobody can recall,
 * and a 404 for someone trying to find the building on a Sunday morning is the
 * worst possible failure for this particular page.
 */
export const Route = createFileRoute("/find-us")({
  beforeLoad: () => {
    throw redirect({ to: "/plan-visit", replace: true });
  },
  // Prerendering renders the component, so it needs to stand alone if a crawler
  // or a JS-less client ever lands here.
  component: () => null,
  head: () => ({
    meta: [
      { title: "Find Us — Christ Cathedral Apostolic Church" },
      { name: "description", content: "4005 Old York Road, Baltimore. Sunday worship at 2:27 PM." },
    ],
    links: [{ rel: "canonical", href: "https://ccacbmore.com/plan-visit" }],
  }),
});
