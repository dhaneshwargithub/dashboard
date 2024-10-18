  // sales-data.ts
  export interface Sale {
    _id: string;
    _rev: string;
    Order_ID: string;
    Fulfillment_Date: string;
    Order_Date: string;
    Ship_Date: string;
    "Ship Mode": string;
    "Customer ID": string;
    "Customer Name": string;
    Segment: string;
    City: string;
    State: string;
    Country: string;
    Region: string;
    Product_ID: string;
    Category: string;
    Sub_Category: string;
    Product_Name: string;
    Sales: number;
    Quantity: number;
    Discount: number;
    Profit: number;
    type: string;
    Customer_Segment: string; // Ensure this exists
    Shipping_Time: number; // Ensure this exists
    Return: boolean; // Ensure this exists
  }
