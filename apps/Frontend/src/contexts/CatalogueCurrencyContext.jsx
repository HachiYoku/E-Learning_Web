import { useState } from "react"
import { loadCatalogueCurrency, saveCatalogueCurrency } from "../utils/catalogueCurrency"
import { CatalogueCurrencyContext } from "./catalogueCurrencyContext"

export function CatalogueCurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(loadCatalogueCurrency)
  const setCurrency = (nextCurrency) => setCurrencyState(saveCatalogueCurrency(nextCurrency))
  return <CatalogueCurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CatalogueCurrencyContext.Provider>
}
