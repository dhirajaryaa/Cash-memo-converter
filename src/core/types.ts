/** One customer memo exactly as read from the distributor's PDF. */
export interface RawMemo {
  name: string;
  addressLines: string[];
  mobile: string;
  bookingDate: string;
  netPayable: number;
  area: string;
  invoiceNo: string;
}

export type Payment = "Cash" | "Online";

/** One printed row of the delivery list. */
export interface DeliveryRow {
  name: string;
  address: string;
  mobile: string;
  area: string;
  payment: Payment;
  bookingDate: string;
  invoiceNo: string;
}

export type SortMode = "memo" | "area" | "name";

export interface ConvertOptions {
  sort?: SortMode;
  /** Maximum address parts to keep (1-5). Default 3. */
  parts?: number;
}

export interface AreaCount {
  area: string;
  count: number;
}

export interface ConvertStats {
  total: number;
  cash: number;
  online: number;
  areas: AreaCount[];
  missingFields: number;
}

export interface ConvertResult {
  rows: DeliveryRow[];
  stats: ConvertStats;
  warnings: string[];
}
