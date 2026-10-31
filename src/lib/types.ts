export type Role = "owner" | "organiser" | "editor";
export type Segment = {
  id: string;
  name: string;
  category: string;
  description: string;
  kind: "individual" | "team" | "exhibition";
  approved: boolean;
  fee: number | null;
  minTeam: number | null;
  maxTeam: number | null;
  classes: number[];
  rules: string;
  active?: boolean;
  rulesStatus?: "draft" | "approved";
  minAge?: number | null;
  sources?: string[];
  position?: number;
};
export type Festival = {
  title: string;
  month: string;
  dates: string;
  venue: string;
  registrationOpen: boolean;
  bkashNumber: string;
  bkashInstruction: string;
  contactEmail: string;
  contactPhone: string;
  refundPolicy: string;
};
export type Person = {
  name: string;
  school: string;
  class: number;
  age?: number;
};
export type Entry = {
  segmentId: string;
  teamName?: string;
  participants: Person[];
  segmentName?: string;
  kind?: string;
  price?: number;
};
export type Application = {
  id: string;
  reference: string;
  createdAt: string;
  consentAt?: string;
  contact: { name: string; email: string; phone: string };
  entries: Entry[];
  total: number;
  paymentStatus:
    "unsubmitted" | "submitted" | "verified" | "rejected" | "not_required";
  approvalStatus: "pending" | "approved" | "rejected";
  emailSentAt: string | null;
  payment?: {
    transactionId: string;
    sender: string;
    amount: number;
    paidAt: string;
    timeSource?: "submission";
    proofId?: string;
  };
  isTest?: boolean;
  proofRequired?: boolean;
  submittedAt?: string | null;
  reviewDueAt?: string | null;
  reviewEmailSentAt?: string | null;
  reconciliationRequired: boolean;
  tokenHash?: string;
  idempotencyKey?: string;
  requestHash?: string;
};
export type ContentItem = {
  id: string;
  type: "member" | "post" | "sponsor";
  title: string;
  subtitle: string;
  body: string;
  image: string;
  url: string;
  group: string;
  published: boolean;
  position?: number;
};
export type PaymentProof = {
  id: string;
  applicationId: string;
  path: string;
  status: "pending" | "ready";
  mime: string;
  size: number;
  createdAt: string;
};
export type Audit = {
  id: string;
  applicationId: string | null;
  actor: string;
  action: string;
  before: unknown;
  after: unknown;
  at: string;
};
export type Admin = {
  id: string;
  email: string;
  role: Role;
  expiresAt?: number;
};
export type PublicData = {
  festival: Festival;
  segments: Segment[];
  content: ContentItem[];
  demo: boolean;
  liveEnabled: boolean;
};
