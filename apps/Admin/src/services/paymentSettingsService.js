import { apiClient } from "../api/client";

function normalizePaymentSettings(settings) {
  if (!settings) {
    return {
      paymentQr: "",
      updatedAt: null,
      updatedBy: null,
    };
  }

  return {
    paymentQr: settings.paymentQr || "",
    updatedAt: settings.updatedAt || null,
    updatedBy: settings.updatedBy || null,
  };
}

export async function fetchPaymentSettings() {
  const settings = await apiClient.get("/payment-settings");
  return normalizePaymentSettings(settings);
}

export async function updatePaymentSettings(payload) {
  const formData = new FormData();

  if (payload.paymentQrFile) {
    formData.append("paymentQr", payload.paymentQrFile);
  } else {
    formData.append("paymentQr", payload.paymentQr || "");
  }

  // include admin password for re-authentication of sensitive change
  if (payload.adminPassword !== undefined) {
    formData.append("adminPassword", payload.adminPassword);
  }

  const settings = await apiClient.put("/payment-settings", formData);
  return normalizePaymentSettings(settings);
}
