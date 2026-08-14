/**
 * "Host Ministry Courtesies for Bishop Dr. Justin Marcus", as supplied by the
 * church, transcribed for the web.
 *
 * The wording is the ministry's own and is left intact — this is the Bishop's
 * stated terms, not copy to be improved. Only two editorial changes were made,
 * both structural rather than substantive:
 *
 *  - The source document ran the opening greeting and the "Ministry Style"
 *    section together in one paragraph. They are separated here.
 *  - The back half of the document was a paper intake form (church name, city,
 *    pastor, contact, dates, event type) which the invitation form now
 *    collects directly. It is omitted rather than duplicated, along with the
 *    instruction to return the sheet by email — submitting the form is the
 *    return.
 *
 * NOT omitted, and worth noticing: the paper form asked for **appropriate
 * apparel** (vestments / civic attire / shirt and tie / casual), which the web
 * form does not yet ask. Until it does, that has to be settled by conversation.
 */

export type CourtesySection = {
  id: string;
  title: string;
  /** Paragraphs, in order. */
  body: string[];
};

/** The scannable version — what a host needs to budget and plan for. */
export type CourtesyHighlight = {
  id: string;
  title: string;
  points: string[];
};

export const COURTESY_INTRO =
  "The following information is provided to help you in hosting and preparing for Bishop Dr. Justin Marcus' ministry visit to your ministry. He is very low maintenance and easy to serve. If you are unsure about anything, just ask him. Thank you for your consideration and hospitality towards Bishop.";

export const COURTESY_HIGHLIGHTS: CourtesyHighlight[] = [
  {
    id: "honorarium",
    title: "Honorarium",
    points: [
      "At least $600 per service",
      "At least $300 for instructional sessions and ceremonial occasions",
      "Check or certified funds — personal cheques are not accepted; cash is fine",
      "Given on arrival, or immediately after ministry on the day",
    ],
  },
  {
    id: "travel",
    title: "Travel",
    points: [
      "Driving over an hour: a stipend at the current IRS mileage rate, sent at least 3 days ahead",
      "Flying: two full unrestricted tickets — the Bishop and his travel assistant",
      "Fly into Baltimore Washington International (BWI), or Amtrak",
      "Speak to the office before you finalise any booking",
    ],
  },
  {
    id: "ground",
    title: "Ground transportation",
    points: [
      "Car and driver for his exclusive use throughout the visit",
      "No rental or luxury vehicle needed — just presentable",
      "Met at baggage claim with a sign, ideally by a brother from your ministry",
      "Driver's full contact details to the office 48 hours before arrival",
    ],
  },
  {
    id: "lodging",
    title: "Lodging",
    points: [
      "No particular hotel required — a 3-star or better",
      "One non-smoking king room",
    ],
  },
];

export const COURTESY_SECTIONS: CourtesySection[] = [
  {
    id: "ministry-style",
    title: "Bishop's ministry style",
    body: [
      "Bishop Marcus's delivery of the word of God is uniquely detailed and contextual. However, in his proclamation he always seeks to remain relevant to that local ministry or assembly and their specific way of worship.",
      "We ask that you brief us on your belief system, doctrine, service structure, preaching time and proper attire for ministry. Bishop Marcus believes in order and submission to pastoral leadership; these components will ensure that the ministry moment is as effective as possible.",
    ],
  },
  {
    id: "honorarium",
    title: "Honorarium",
    body: [
      "Bishop Marcus has been in ministry for over 21 years and has become accustomed to receiving an honorarium commensurate to the ministry that has been provided, and we trust that you will honour the anointing on his life.",
      "We request that your ministry prepare an honorarium of at least $600 per service for Bishop Marcus. For instructional sessions and ceremonial occasions, please prepare an honorarium of at least $300.",
      "We ask that the honoraria be given to the Bishop upon arrival, or right after ministry on the day of the engagement. These funds must be tendered via check or certified funds. Personal checks will not be accepted. Cash is also an acceptable form of payment.",
      "Because financial gain is not the aim of Justin Marcus Ministries, if the requested ministry gift cannot be met, please submit a proposed budget to us so that all parties involved can come to a respectable medium.",
    ],
  },
  {
    id: "food",
    title: "Food and beverages",
    body: [
      "Bishop is very low maintenance. He prefers cold water and at times 100% juice while he is ministering. He prefers not to do a lot of eating at various restaurants before or after services.",
    ],
  },
  {
    id: "travel-driving",
    title: "Travel — driving",
    body: [
      "If your event location is more than one hour of driving time, we do ask that you send a travel stipend using the current standard IRS mileage rate to and from your event location. This should be sent at least three days prior to the event.",
    ],
  },
  {
    id: "travel-flying",
    title: "Travel — flying",
    body: [
      "Bishop does not have a preferred airline. Our office will handle the scheduling of travel arrangements for both Bishop Marcus and his ministry travel assistant. The sponsoring ministry shall be responsible for the purchase of two full unrestricted airline tickets.",
      "Please use Baltimore Washington International (BWI), or Amtrak, when booking his travel itinerary. Please call or email us before you finalise the purchase of tickets.",
    ],
  },
  {
    id: "ground-transportation",
    title: "Ground transportation",
    body: [
      "Your ministry must provide all ground transportation: a car and driver for the exclusive and private use of Bishop Marcus and his travelling assistant throughout the duration of his stay and ministerial obligations with your ministry — to and from the airport, the hotel and the venue.",
      "Bishop Marcus does not require a private rental, luxury vehicle or limousine, but please ensure assigned personnel and vehicles from your ministry are presentable for the ministry guest. Bishop prefers to be picked up by at least one brother representing your ministry upon his arrival.",
      "All ground transportation providers must be waiting for the arrival of Bishop Marcus and his travel assistant in baggage claim, with a sign indicating Bishop Justin Marcus' name for pick-up. Most times he travels in a black suit and clerical collar and should be easy to identify.",
      "Justin Marcus Ministries must be provided with full contact information for the ground transportation — including full name, cell phone number, company name and confirmation number where applicable — at least 48 hours prior to his scheduled arrival in the city.",
    ],
  },
  {
    id: "hotels",
    title: "Hotels",
    body: [
      "Bishop Marcus does not request or require a specific hotel for lodging; however, we ask that the hotel be at least a 3-star hotel to ensure comfort during his stay. Bishop Marcus requests one non-smoking king room for him.",
    ],
  },
  {
    id: "other",
    title: "Other helpful tips",
    body: [
      "When providing hospitality to the man of God, his personal preference is that he not be directly served independently by the sisters of your ministry — adjutant sisters and female armour bearers.",
      "Bishop Marcus loves fellowship with the saints of God, however he will usually not want to shake hands with congregants after the service is over, as his spirit will be open and he needs to be sure he does not overly engage after the worship experience other than with the ministry leaders in place. Please allow a few minutes for him to do so if at all possible.",
      "After ministering he will need to change clothes immediately, as he is usually extremely wet. Please have two copies of the audio and/or video, in CD and/or DVD format, ready upon his departure.",
    ],
  },
];

/**
 * Stated on the source document and worth keeping in front of a host: this sets
 * out expectations, it does not bind either party.
 */
export const COURTESY_DISCLAIMER =
  "Please be advised: this is not a contractual agreement.";
