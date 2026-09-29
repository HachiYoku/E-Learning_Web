const fixedCurrencies = ["THB", "MMK"];

export function explicitFixedAmounts(fixedAmounts = {}) {
  return Object.fromEntries(fixedCurrencies
    .filter((currency) => fixedAmounts[currency] !== "" && fixedAmounts[currency] !== undefined && fixedAmounts[currency] !== null)
    .map((currency) => [currency, Number(fixedAmounts[currency])]));
}

// The backend retains discountValue for legacy compatibility. New fixed promos
// never ask an admin to provide it: an explicitly configured currency value is
// used as the compatibility value while checkout uses fixedAmounts exclusively.
export function buildPromoPayload(form) {
  const fixedAmounts = explicitFixedAmounts(form.fixedAmounts);
  if (form.discountType === "fixed") {
    const hasExplicitAmounts = Object.keys(fixedAmounts).length > 0;
    return {
      ...form,
      discountValue: hasExplicitAmounts ? fixedAmounts.THB ?? fixedAmounts.MMK : Number(form.discountValue),
      ...(hasExplicitAmounts ? { fixedAmounts } : { fixedAmounts: undefined }),
    };
  }
  return { ...form, discountValue: Number(form.discountValue), fixedAmounts: {} };
}
