export declare function evidenceNumber(value: unknown): number | null;
export type ProductEvidence = { brand:string;product:string;purchasePrice:number|null;sellingPrice:number|null;dailySalesVolume:number|null };
export declare function productEvidence(answers?:Record<string,unknown>):ProductEvidence[];
