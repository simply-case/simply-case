/**
 * Recorded/derived USCIS responses used by the offline tests.
 *
 * The success payloads follow the published examples; the 503 is copied
 * verbatim from a live sandbox call, which is where the nested-envelope
 * divergence from the docs was discovered.
 */

/** Standard schema, with history. Mirrors the documented example. */
export const CASE_WITH_HISTORY = {
  case_status: {
    receiptNumber: "EAC9999103403",
    formType: "I-130",
    submittedDate: "09-05-2023 14:28:46",
    modifiedDate: "09-05-2023 14:28:46",
    current_case_status_text_en: "Case Was Approved",
    current_case_status_desc_en:
      "On September 5, 2023, we approved your Form I-130, Petition for Alien Relative, Receipt Number EAC9999103403. We sent you an approval notice. Please follow the instructions in the notice.",
    current_case_status_text_es: "Caso Fue Aprobado",
    current_case_status_desc_es:
      "El 05 de Septiembre de 2023, aprobamos su Formulario I-130, Petición de Familiar Extranjero, Número de Recibo EAC9999103403. Le enviamos un aviso de aprobación. Por favor, siga las instrucciones en el aviso.",
    hist_case_status: [
      {
        date: "2023-09-05",
        completed_text_en: "We approved your Form I-130, Petition for Alien Relative.",
        completed_text_es: "Aprobamos su Formulario I-130, Petición de Familiar Extranjero.",
      },
    ],
  },
  message: "Query was successful for payload {'receipt_number': 'EAC9999103403'}",
};

/** Standard schema, no history array at all. */
export const CASE_WITHOUT_HISTORY = {
  case_status: {
    receiptNumber: "EAC9999103400",
    formType: "I-765",
    submittedDate: "01-15-2024 09:02:11",
    modifiedDate: "03-02-2024 11:45:00",
    current_case_status_text_en: "Case Was Received",
    current_case_status_desc_en:
      "On January 15, 2024, we received your Form I-765, Application for Employment Authorization.",
    current_case_status_text_es: "Caso Fue Recibido",
    current_case_status_desc_es:
      "El 15 de Enero de 2024, recibimos su Formulario I-765, Solicitud de Autorización de Empleo.",
  },
  message: "Query was successful for payload {'receipt_number': 'EAC9999103400'}",
};

/**
 * IOE-prefix schema: submittedDate and modifiedDate are absent entirely.
 * This is the case that makes timestamp-based change detection unusable.
 */
export const CASE_IOE_PREFIX = {
  case_status: {
    receiptNumber: "IOE0912345678",
    formType: "I-485",
    current_case_status_text_en: "Case Is Being Actively Reviewed By USCIS",
    current_case_status_desc_en:
      "As of March 4, 2024, we are actively reviewing your Form I-485, Application to Register Permanent Residence or Adjust Status.",
    current_case_status_text_es: "Caso Está Siendo Revisado Activamente Por USCIS",
    current_case_status_desc_es:
      "Al 4 de Marzo de 2024, estamos revisando activamente su Formulario I-485.",
    hist_case_status: [
      {
        date: "2024-02-01",
        completed_text_en: "We received your Form I-485.",
        completed_text_es: "Recibimos su Formulario I-485.",
      },
      {
        date: "2024-03-04",
        completed_text_en: "We are actively reviewing your Form I-485.",
        completed_text_es: "Estamos revisando activamente su Formulario I-485.",
      },
    ],
  },
  message: "Query was successful for payload {'receipt_number': 'IOE0912345678'}",
};

/** History deliberately out of chronological order, to exercise sorting. */
export const CASE_UNORDERED_HISTORY = {
  case_status: {
    receiptNumber: "SRC9999102777",
    formType: "I-140",
    current_case_status_text_en: "Case Was Approved",
    hist_case_status: [
      { date: "2024-06-10", completed_text_en: "We approved your Form I-140." },
      { date: "2024-01-05", completed_text_en: "We received your Form I-140." },
      { date: "2024-03-22", completed_text_en: "We sent a request for evidence." },
    ],
  },
  message: "ok",
};

/** Live sandbox 503 — nested envelope, string code. Differs from the docs. */
export const ERROR_503_LIVE = {
  error: {
    code: "503",
    message:
      "The Case Status API Sandbox is unavailable at this time. Please retry your API request during normal operation hours M-F 7:00AM EST - 8:00 PM EST",
  },
};

/** Flat envelope with numeric code, as the published spec describes. */
export const ERROR_404_DOCUMENTED = {
  code: 404,
  message:
    "Case Status Online does not recognize the receipt number entered. Please check your receipt number and try again. If you need further assistance, please call the USCIS Contact Center at 1-800-375-5283.",
};

export const ERROR_422_DOCUMENTED = {
  code: 422,
  message:
    "The application receipt number is not formatted correctly, It should be total of 13 characters (3 character prefix followed by 10 digits). Please check your receipt number and try again",
};

export const ERROR_429_DOCUMENTED = {
  code: 429,
  message: "Spike Arrest Violation",
};

export const ERROR_401_DOCUMENTED = {
  code: 401,
  message: "Invalid Access Token",
};

export const TOKEN_RESPONSE = {
  refresh_token_expires_in: "0",
  api_product_list: "[Case Status API - Sandbox]",
  organization_name: "uscis",
  token_type: "Bearer",
  issued_at: "1789097256213",
  access_token: "TESTTOKEN0000000000000000001",
  scope: "",
  expires_in: "1800",
  status: "approved",
};
