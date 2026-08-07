import { type NextRequest } from "next/server";
import { getAssignmentDetail } from "@/lib/queries/scales";
import { getCurrentProfessional } from "@/lib/queries/identity";

/** Respuestas de una escala clínica: fuera de cualquier caché. */
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  // Los route handlers NO ejecutan layouts: aunque esta ruta viva bajo /pro, no
  // hereda la guardia de ProLayout. La comprobación de sesión va aquí.
  const pro = await getCurrentProfessional();
  if (!pro) {
    return new Response("No autorizado", { status: 401, headers: NO_STORE });
  }

  const { id, assignmentId } = await params;
  const detail = await getAssignmentDetail(assignmentId);
  if (!detail || detail.patientId !== id) {
    return new Response("No encontrado", { status: 404, headers: NO_STORE });
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
      ...NO_STORE,
    },
  });
}
