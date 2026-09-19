# Diario emocional

Cuatro caras, una nota opcional y mensajes de apoyo. Y una escala anterior que
sigue significando lo que significaba.

---

## 1. Qué cambia

| | Antes | Ahora |
|---|---|---|
| Opciones | 5 (Muy mal · Mal · Normal · Bien · Muy bien) | **4** (Mal · Regular · Bien · Muy bien) |
| Selector | Botones con `aria-pressed` | **Radios nativos** |
| Inicio | Guardaba al tocar una cara, sin nota | Mismo formulario que el diario |
| Nota | Se recortaba en silencio a 5.000 | Contador, y se **rechaza** pasarse |
| Apoyo | — | Mensaje fijo al elegir «Mal» o «Regular» |

Un solo componente, `MoodEntryForm`, en Inicio y en Diario. Antes eran dos
caminos hacia la misma fila, y por tanto dos sitios donde equivocarse con la
escala, con el límite y con el mensaje.

---

## 2. Las dos escalas, y por qué no se tocan

**El problema no es el rango, es el significado.** Un 3 era «Normal» en la
escala de cinco y es «Bien» en la de cuatro. Convertir los valores antiguos
—o, peor, dejarlos quietos y reinterpretarlos con las etiquetas nuevas—
cambiaría en silencio lo que un paciente dijo sobre cómo se sentía un martes de
agosto. Es falsificar un registro clínico, aunque sea sin querer.

La escala viaja **con cada fila**, en `mood_entries.mood_scale`:

- Filas anteriores → `5`. No es relleno: es exactamente lo que eran.
- Filas nuevas → `4`.
- `check (mood_value between 1 and mood_scale)`: un 5 en una fila de escala 4
  no entra en la base.

Consecuencias en pantalla, todas deliberadas:

- **Ninguna función traduce un valor suelto.** `etiquetaAnimo(valor, escala)`
  exige las dos cosas. Un valor sin escala no se puede interpretar.
- **La semana del paciente no dibuja las dos escalas juntas.** Los días de la
  escala anterior se marcan con una raya baja y un texto que lo explica.
- **La ficha del profesional pinta una gráfica por escala**, cada una con su
  propio máximo y con un aviso de que la anterior no es comparable.
- **No se calcula ninguna media ni tendencia** que cruce escalas. No existía
  antes y no se ha añadido.

> **Límite del discriminante, dicho en la propia migración:** `mood_scale`
> distingue por número de opciones, no por versión de etiquetas. Si algún día
> se renombran las cuatro caras sin cambiar cuántas son, esta columna no
> bastará.

---

## 3. Mensajes de apoyo — excepción de producto

`src/app/app/_ui/apoyo.ts`, un fichero, tipado y corto a propósito: son las
frases que lee alguien que acaba de decir que está mal, y tienen que poder
revisarse de una pasada por quien no lea TypeScript.

**Qué es:** una respuesta fija a la opción pulsada. Nada más.

**Qué no es, y por qué importa:**

- **No analiza la nota.** El texto libre no se lee, no se clasifica y no entra
  en la decisión. La función ni siquiera recibe la nota como argumento, y hay
  una prueba que lo comprueba.
- **No hay modelo de lenguaje ni servicio externo.** El módulo no tiene ni un
  `import`.
- **No es detección de riesgo.** Elegir «Mal» **no** avisa a nadie, no crea
  notificación y no levanta ninguna alerta clínica. El circuito de riesgo sigue
  siendo el ítem 9 del PHQ-9 y el 024 de la cabecera, intactos.

Esa frontera es la que mantiene la aplicación fuera del reglamento de producto
sanitario: acompañar no es interpretar.

### Reglas de redacción

Comprobadas por `src/lib/apoyo.test.ts`, con patrones que a su vez se prueban
contra frases que **deben** rechazar:

Nada que prometa que todo mejorará · nada que minimice el malestar · nada que
culpabilice · nada que recomiende un tratamiento · nada que sugiera supervisión
en tiempo real · ni rachas, ni puntos, ni premios.

«Bien» y «Muy bien» **no llevan mensaje previo**, y la confirmación tras
guardar es **la misma para las cuatro opciones**: felicitar un «Muy bien»
convertiría el diario en algo que se puede hacer bien o mal, y dejaría al que
marcó «Mal» habiéndolo hecho peor.

### Estabilidad

El mensaje **se deriva** de la opción y del día con una función pura; no es
estado. Así no puede cambiar mientras la persona escribe, ni al volver a
renderizar, ni al reintentar un guardado que falló, y es el mismo en Inicio y
en Diario. Con un aleatorio por render, cada tecla podría reescribir la frase
que está leyendo.

---

## 4. Reglas que no han cambiado

- **Un registro por día y expediente** (`mood_entries_patient_day_uq`). La
  escritura es un `upsert`, así que una doble pulsación o un reintento
  actualizan la misma fila: no hay duplicados.
- **Editable solo el mismo día.** Los días anteriores son inmutables, y lo
  impone la RLS, no la interfaz.
- **«Hoy» es la fecha en `Europe/Madrid`**, la zona de negocio, tanto en la
  acción (`todayYMD()`) como en las políticas de la tabla. No se acepta una
  fecha del cliente: no se puede retrodatar para tocar un registro cerrado.
- **El expediente sale de la sesión**, nunca de un parámetro.
- **La nota la puede leer el profesional** con acceso al expediente, y el campo
  lo dice. No se presenta como privada porque no lo es.

---

## 5. Despliegue

1. Aplicar `supabase/migrations/20260919100001_diario_escala_4.sql` en el
   remoto (persona, desde el editor SQL).
2. Comprobar:
   ```sql
   select mood_scale, count(*) from public.mood_entries group by 1 order by 1;
   ```
   Todo lo anterior al despliegue debe salir como `5`.
3. Fusionar el PR. **Antes no**: el código nuevo escribe `mood_scale` y sobre
   el esquema viejo fallaría toda escritura del diario.

## 6. Reversión

La migración **no destruye nada**, así que revertir es volver atrás el código.

Si además hay que deshacer el esquema, sin perder un solo registro:

```sql
begin;
-- Los registros de la escala de cuatro se CONSERVAN. Solo se retiran las
-- restricciones nuevas; `mood_scale` se queda para no perder el discriminante.
alter table public.mood_entries drop constraint if exists mood_entries_valor_en_escala;
alter table public.mood_entries drop constraint if exists mood_entries_escala_conocida;
alter table public.mood_entries drop constraint if exists mood_entries_nota_longitud;
alter table public.mood_entries
  add constraint mood_entries_mood_value_check check (mood_value between 1 and 5);
commit;
```

⚠️ Esa última línea vuelve a admitir cualquier valor de 1 a 5 **sin mirar la
escala**, que es justo lo que este trabajo vino a evitar. Con el código
anterior, los registros de escala 4 se mostrarían con las etiquetas de la de
cinco: un «Muy bien» (4 de 4) se leería como «Bien». **No borra datos, pero los
muestra mal.** Si se llega a esto, conviene decidir antes qué se hace con las
filas de `mood_scale = 4`.

No se recomienda borrar la columna: es lo único que distingue unas filas de
otras.

---

## 7. Lo que no se ha comprobado

- **Nada en dispositivo físico.** El diseño se ha verificado por código y por
  construcción, no en pantalla: faltan 320/375/390/430 px reales, claro y
  oscuro, y el teclado virtual.
- **El cliente Expo** (`C:\dev\terap-app`) **no consume `mood_entries`**: hoy
  solo tiene pantallas de autenticación. Comprobado por inspección del código.
  Lo que sí existe es `docs/SINCRONIZACION-terapia-terapapp.md`, que describe
  el contrato del diario para cuando se implemente; **ese documento habla de la
  escala 1-5 y queda desactualizado**. No se ha modificado: vive en otro
  repositorio.
- **La migración no se ha aplicado a ningún entorno remoto.**
