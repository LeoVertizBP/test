declare module 'long' {
  class Long {
    constructor(low: number, high?: number, unsigned?: boolean);
    
    // Basic properties
    low: number;
    high: number;
    unsigned: boolean;
    
    // Common methods
    toString(radix?: number): string;
    toNumber(): number;
    toJSON(): string;
    valueOf(): string;
    
    // Static factory methods
    static fromInt(value: number, unsigned?: boolean): Long;
    static fromNumber(value: number, unsigned?: boolean): Long;
    static fromString(str: string, unsigned?: boolean, radix?: number): Long;
    static fromValue(val: any): Long;
    
    // These should cover most usage patterns
    add(addend: Long | number | string): Long;
    subtract(subtrahend: Long | number | string): Long;
    multiply(multiplier: Long | number | string): Long;
    divide(divisor: Long | number | string): Long;
    modulo(divisor: Long | number | string): Long;
    
    // Comparison methods
    equals(other: Long | number | string): boolean;
    lessThan(other: Long | number | string): boolean;
    lessThanOrEqual(other: Long | number | string): boolean;
    greaterThan(other: Long | number | string): boolean;
    greaterThanOrEqual(other: Long | number | string): boolean;
  }
  
  export = Long;
  // Only use one export style, not both
}
