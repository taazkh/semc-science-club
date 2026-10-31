import { paymentSchema } from "./validation";
import type { Application } from "./types";

const detailsSchema = paymentSchema.omit({ paidAt: true, timeSource: true });

export function parsePaymentSubmission(
  raw: unknown,
  simulated: boolean,
  submittedAt: string,
): NonNullable<Application["payment"]> {
  return simulated
    ? {
        ...detailsSchema.parse(raw),
        paidAt: submittedAt,
        timeSource: "submission",
      }
    : paymentSchema.omit({ timeSource: true }).parse(raw);
}

export function samePaymentDetails(
  first: NonNullable<Application["payment"]>,
  second: NonNullable<Application["payment"]>,
) {
  return (
    first.transactionId === second.transactionId &&
    first.sender === second.sender &&
    first.amount === second.amount &&
    first.proofId === second.proofId
  );
}
