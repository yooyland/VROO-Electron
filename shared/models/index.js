/** Lightweight schema markers for console domain objects */
export const UserModel = { id: "string", nickname: "string", status: "active|inactive|pending|suspended" };
export const PartnerModel = { id: "string", category: "string", status: "string" };
export const ProductModel = { id: "string", partnerId: "string|null", status: "string" };
export const BenefitModel = { id: "string", partnerId: "string|null", status: "string" };
export const SupportTicketModel = { id: "string", status: "open|pending|resolved" };
export const IncidentModel = { id: "string", status: "draft|reported|assistanceRequested|towing|repair|closed" };
