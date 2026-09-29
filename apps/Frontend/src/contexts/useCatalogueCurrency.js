import { useContext } from "react"
import { CatalogueCurrencyContext } from "./catalogueCurrencyContext"

export function useCatalogueCurrency() {
  const value = useContext(CatalogueCurrencyContext)
  if (!value) throw new Error("useCatalogueCurrency must be used within CatalogueCurrencyProvider")
  return value
}
