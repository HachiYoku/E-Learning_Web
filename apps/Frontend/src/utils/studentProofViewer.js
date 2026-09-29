export const shouldShowRejectedProof = (payment) => payment?.status === "rejected" && payment?.hasPaymentProof === true;

export function rejectedProofDisplayState({ loading, failed, thumbnailUrl }) {
  if (loading) return "loading";
  if (failed || !thumbnailUrl) return "failed";
  return "thumbnail";
}

export const proofRequestKey = (paymentId, retryCount = 0) => `${paymentId || ""}:${retryCount}`;

export const shouldFetchProof = ({ paymentId, retryCount, loadedRequestKey }) => {
  if (!paymentId) return false;
  return proofRequestKey(paymentId, retryCount) !== loadedRequestKey;
};

export const createProofObjectUrl = (blob, urlApi = URL) => urlApi.createObjectURL(blob);

export const revokeProofObjectUrl = (url, urlApi = URL) => {
  if (url) urlApi.revokeObjectURL(url);
};
