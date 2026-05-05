/**
 * LatticeGrid — re-exports the custom DataGrid so every existing import
 * (`import LatticeGrid from "@/components/ui/LatticeGrid"`) keeps working
 * without any changes at call sites.
 */
export { default, type Column, type DataGridProps as LatticeGridProps } from "./DataGrid";
