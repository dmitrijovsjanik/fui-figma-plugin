export interface StepPreset {
  name: string;
  light: Record<number, number>;
  dark: Record<number, number>;
  builtIn?: boolean;
}
