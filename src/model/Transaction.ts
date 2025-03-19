export interface Transaction {
    transaction_id: number;
    transaction_type: string;
    financial_product: {
      product_name: string;
      ticker: string;
      sector: {
        sector_id: number;
        sector_name: string;
      };
    };
    created_at: string;
    quantity: number;
    price: number;
    currency_code: string;
    currency: string;
    originalCurrency: string;
    profitRate?: number;
  }