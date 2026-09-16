import { redirect } from "next/navigation";

/**
 * Ruta anterior de las invitaciones de paciente.
 *
 * Se conserva como redirección permanente porque hay enlaces vivos en buzones
 * que apuntan aquí: la caducidad son 48 horas, pero borrar la ruta habría roto
 * los que estuvieran en vuelo en el momento del despliegue. El token viaja
 * intacto a la pantalla nueva y sigue sin consumirse al abrirlo.
 */
export default async function InviteLegacyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/invitacion/${encodeURIComponent(token)}`);
}
