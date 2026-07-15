import { apiClient } from "../api/client";

function normalizePaymentSettings(settings) {
  if (!settings) {
    return {
      paymentQr: "",
    };
  }

  return {
    paymentQr: settings.paymentQr || "",
  };
}

export async function fetchPaymentSettings() {
  const settings = await apiClient.get("/payment-settings");
  return normalizePaymentSettings(settings);
}
