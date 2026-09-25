import { addDays } from "date-fns";

export type LeadDisposition =
  | "OPEN"
  | "PROMISED"
  | "DISPUTED"
  | "NO_ANSWER"
  | "DECLINED"
  | "RESOLVED";

/** Collection: next follow-up date after logging a call outcome. Null = leaves the queue. */
export function nextDebtorFollowUp(
  disposition: LeadDisposition,
  promisedDate?: Date | null
): Date | null {
  switch (disposition) {
    case "OPEN":
      return addDays(new Date(), 2);
    case "PROMISED":
      return promisedDate ?? addDays(new Date(), 3);
    case "DISPUTED":
      return addDays(new Date(), 3);
    case "NO_ANSWER":
      return addDays(new Date(), 1);
    case "DECLINED":
    case "RESOLVED":
      return null;
  }
}

export type ProspectDisposition =
  | "NEW"
  | "NO_ANSWER"
  | "ENGAGED"
  | "NEGOTIATING"
  | "PROPOSAL_SENT"
  | "MEETING_SET"
  | "LOST"
  | "CONVERTED";

/** Sales: next follow-up date after logging outreach. `override` wins when the rep sets a real date (e.g. a booked meeting). */
export function nextProspectFollowUp(
  disposition: ProspectDisposition,
  override?: Date | null
): Date | null {
  if (override) return override;
  switch (disposition) {
    case "NEW":
      return null;
    case "NO_ANSWER":
      return addDays(new Date(), 1);
    case "ENGAGED":
      return addDays(new Date(), 2);
    case "NEGOTIATING":
      return addDays(new Date(), 3);
    case "PROPOSAL_SENT":
      return addDays(new Date(), 5);
    case "MEETING_SET":
      return addDays(new Date(), 7);
    case "LOST":
    case "CONVERTED":
      return null;
  }
}
