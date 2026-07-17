// Texto de consentimiento informado por defecto usado en el alta del paciente.
// La gestión de plantillas propias del profesional llegará más adelante; hasta
// entonces se firma este texto y se guarda su hash (integridad) en `consents`.

export const CONSENT_VERSION = 1;
export const CONSENT_TITLE = "Consentimiento informado";

export const CONSENT_BODY = `Al continuar, confirmas que has leído y aceptas lo siguiente:

1. terap.ia es un espacio de acompañamiento entre tu profesional de psicología y tú. No sustituye la atención sanitaria presencial ni es un canal de urgencias.

2. En caso de emergencia o riesgo, utiliza el botón de emergencia (024 / 112), siempre visible en la app.

3. Tu profesional podrá proponerte tareas, citas y, si lo activa expresamente, cuestionarios. La app no interpreta ni ofrece recomendaciones clínicas por sí misma.

4. Puedes registrar tu estado de ánimo y completar tareas de forma voluntaria. Tú decides qué compartir.

5. Entorno de demostración: durante esta fase se utilizan únicamente datos ficticios.

Marcando la casilla y continuando, otorgas tu consentimiento informado para el uso de terap.ia con tu profesional.`;
