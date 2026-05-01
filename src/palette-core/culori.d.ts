declare module 'culori' {
  export function converter(mode: string): (color: any) => any;
  export function formatHex(color: any): string;
}
