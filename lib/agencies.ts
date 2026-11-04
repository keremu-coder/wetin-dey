export const AGENCIES = [
  "NEPA",
  "NERC",
  "Ikeja Electric",
  "Eko Electricity Distribution",
  "Abuja Electricity Distribution",
  "Enugu Electricity Distribution",
  "Port Harcourt Electricity Distribution",
  "Benin Electricity Distribution",
  "Kaduna Electricity Distribution",
  "Kano Electricity Distribution",
  "Jos Electricity Distribution",
  "Yola Electricity Distribution",
  "Nigerian Police Force",
  "Nigeria Customs Service",
  "Federal Inland Revenue Service",
  "EFCC",
  "ICPC",
  "NIMC",
  "NNPC Limited",
  "Central Bank of Nigeria",
  "Nigerian Ports Authority",
  "Federal Road Safety Corps",
  "other"
] as const;

export type Agency = (typeof AGENCIES)[number];
