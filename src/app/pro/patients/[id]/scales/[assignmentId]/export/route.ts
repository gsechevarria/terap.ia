import { type NextRequest } from "next/server";
import { getAssignmentDetail } from "@/lib/queries/scales";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  const { id, assignmentId } = await params;
  const detail = await getAssignmentDetail(assignmentId);
  if (!detail || detail.patientId !== id) {
    return new Response("No encontrado", { status: 404 });
  }

  const itemIds = detail.definition.items.map((it) => it.id);
  const header = [
    "fecha",
    "puntuacion",
    "severidad",
    "alerta",
    ...itemIds.map((i) => `item_${i}`),
  ];

  const rows = detail.responses.map((r) => {
    const answers = r.answers ?? {};
    return [
      r.submitted_at,
      r.score ?? "",
      r.severity ?? "",
      r.flagged ? "si" : "no",
      ...itemIds.map((i) => answers[String(i)] ?? ""),
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  const filename = `${detail.scaleCode}-${assignmentId.slice(0, 8)}.csv`;
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
