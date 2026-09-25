import type { PaperRunRow } from "@/lib/types";

declare module "./paper-format" {
  export function recordsListText(
    closedRows: PaperRunRow[],
    opts?: { seeMoreUrl?: string | null },
  ): string;
}
