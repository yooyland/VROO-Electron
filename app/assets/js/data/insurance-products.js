/**
 * CARE — 보험 상품·상담 리드·사고 케이스 스키마/데모
 * 가입 확정·민감정보·외부 전송 금지
 */

/** InsuranceLead / case 상태 상수 */
export const INSURANCE_LEAD_STATUS = Object.freeze([
  "inquiry",
  "quoteRequested",
  "quoted",
  "applied",
  "active",
  "expired",
  "cancelled"
]);

export const ACCIDENT_CASE_STATUS = Object.freeze([
  "draft",
  "reported",
  "assistanceRequested",
  "towing",
  "repair",
  "closed"
]);

/**
 * InsuranceProduct — 카탈로그 데모
 * estimatedPremium 은 참고용 숫자이며 실견적 아님
 */
export const INSURANCE_PRODUCTS = [
  {
    id: "ins_auto_demo_01",
    partnerId: "partner_insurance_01",
    companyName: "데모 보험사",
    productName: "자동차 보험 상담 (데모)",
    type: "auto",
    coverageSummary: "대인·대물·자차 기본 구성 안내(데모)",
    estimatedPremium: null,
    benefits: ["상담 신청만 가능", "가입 확정 없음"],
    status: "planned"
  },
  {
    id: "ins_driver_demo_01",
    partnerId: "partner_insurance_01",
    companyName: "데모 보험사",
    productName: "운전자 보험 상담 (데모)",
    type: "driver",
    coverageSummary: "운전자 부상·변호사 비용 등 안내(데모)",
    estimatedPremium: null,
    benefits: ["비교·상담 리드", "민감정보 미수집"],
    status: "planned"
  }
];

/**
 * InsuranceLead 스키마 예시 (인스턴스 저장 없음)
 * consentGiven 외 주민번호·상세 사고정보 필드 금지
 */
export const INSURANCE_LEAD_SCHEMA = {
  id: "string",
  userId: "string",
  productId: "string",
  requestedAt: "number|ISO",
  status: INSURANCE_LEAD_STATUS.join("|"),
  consentGiven: "boolean",
  contactMethod: "in_app|callback_request"
};

/**
 * AccidentCase 스키마 예시
 * location: { lat, lng } 수준만. 상세 인적 사고정보 금지
 */
export const ACCIDENT_CASE_SCHEMA = {
  id: "string",
  userId: "string",
  createdAt: "number|ISO",
  location: "{ lat, lng } | null",
  status: ACCIDENT_CASE_STATUS.join("|"),
  photoCount: "number",
  insurancePartnerId: "string|null",
  emergencyServiceRequested: "boolean",
  towingRequested: "boolean",
  notes: "string (비식별 메모만)"
};

/** CARE 데모 플로우 (문서·UI 안내용, 실행 로직 없음) */
export const CARE_DEMO_FLOW = [
  "사고 발생 인지",
  "사고 위치·시간 기록 (로컬 데모)",
  "사진 촬영 슬롯 (개수만, 업로드 서버 없음)",
  "보험 상담 연결 (InsuranceLead)",
  "긴급출동·견인 요청 의도 플래그",
  "정비소 연결 (planned)",
  "처리 상태 확인 (AccidentCase.status)"
];

/** 향후 API 연동 지점 (미구현) */
export const CARE_API_HOOKS = {
  createLead: "POST /care/insurance-leads",
  createAccident: "POST /care/accidents",
  requestAssistance: "POST /care/accidents/:id/assistance",
  /* 외부 보험사·출동 업체 전송은 Phase 4+ 및 동의 후에만 */
  externalDispatch: "NOT_IMPLEMENTED"
};

export function listInsuranceByType(type) {
  return INSURANCE_PRODUCTS.filter((p) => p.type === type);
}
