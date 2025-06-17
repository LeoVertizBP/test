declare module 'node-srt' {
  export interface SrtEntry {
    id: number;
    startTime: number;
    endTime: number;
    text: string;
  }
  
  export function parse(srtContent: string): SrtEntry[];
  export function stringify(entries: SrtEntry[]): string;
}
