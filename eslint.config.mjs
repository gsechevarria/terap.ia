import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Reglas propias, además del preset de Next.
 *
 * `no-floating-promises` y `no-misused-promises` necesitan información de
 * tipos (`projectService`), y son las que habrían detectado los rechazos sin
 * `catch` de las server actions que se corrigieron en la fase 1.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        // Los handlers de React (`onClick={() => run(...)}`) devuelven void por
        // diseño; lo que interesa es cazar la promesa olvidada, no el handler.
        { checksVoidReturn: { attributes: false } },
      ],
      // Era warning y ya se había silenciado a mano en PatientSearch.
      "react-hooks/exhaustive-deps": "error",
      // Accesibilidad.
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-autofocus": "error",
      //
      // `jsx-a11y/control-has-associated-label` queda DESACTIVADA a propósito.
      //
      // El patrón de formulario del repo es
      //   <label><span className="field-label">Texto</span><input /></label>
      // que es HTML correcto: el `<label>` envolvente asocia implícitamente el
      // control y el texto del span es su nombre accesible. La regla no
      // reconoce ese anidamiento (ni subiendo `depth`) y marcaba 77 errores
      // sobre campos bien etiquetados. Activarla obligaría a añadir un
      // `aria-label` redundante a cada campo, que además COMPITE con el texto
      // visible y empeora la experiencia con lector de pantalla.
      //
      // La cobertura real la da `label-has-associated-control`, que valida
      // justo ese patrón y sí está activa como error.
    },
  },

  // Los tests no se benefician de las reglas de promesas (usan `expect` y
  // aserciones de no-nulo a propósito).
  {
    files: ["src/**/*.test.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "www/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
