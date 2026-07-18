// Tipado de la definición JSONB de una escala (catálogo `scales.definition`).

export type ScaleOption = { value: number; label: string };
export type ScaleItem = { id: number; text: string };
export type SeverityRange = { min: number; max: number; label: string };

export type ScaleDefinition = {
  options: ScaleOption[];
  items: ScaleItem[];
  scoring: {
    method: string;
    min: number;
    max: number;
    severity: SeverityRange[];
  };
  flag_item?: number;
  flag_threshold?: number;
};

export type ScaleAnswers = Record<string, number>;
