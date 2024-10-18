 //manager-dashboard.component.ts
 import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
 import { Sale } from '../home/models/sales-data';
 import { CouchdbService } from '../couchdb.service';
 import { take } from 'rxjs/operators';
 import { Router } from '@angular/router';
 import { BubbleDataPoint, ChartData, ChartOptions, ChartTypeRegistry, ScatterDataPoint } from 'chart.js';
 import { registerables, Chart } from 'chart.js';
 import { HttpClient } from '@angular/common/http';
 import * as L from 'leaflet';
 import { Subscription, interval } from 'rxjs';
 import { switchMap } from 'rxjs/operators';
 import { NgZone } from '@angular/core';
 import { UserService } from '../user.service';
 import { User } from '../home/models/user.model';


 Chart.register(...registerables);

 @Component({
   selector: 'app-manager-dashboard',
   templateUrl: './manager-dashboard.component.html',
   styleUrls: ['./manager-dashboard.component.css']
   
 })

 export class ManagerDashboardComponent implements OnInit {
   // KPIs
   averageSalesPerTransaction: number = 0;
   grossProfitMargin: { [key: string]: number } = {};
   customerRetentionRate: number = 0;
   totalSales: number = 0;
   topPerformingCountries: any[] = [];
   averageOrderValue: number = 0;
   discountImpact: number = 0;
   aggregatedSales: { [key: string]: number } = {};
   geoJsonData: any; // To hold the GeoJSON data
   private pollingSubscription: Subscription | null = null;
   private pollingInterval = 60000; // Set the polling interval 60 seconds
   salesData: Sale[] = []; // Add this line
   // Chart Data
   public productCategoryProfitability: ChartData<'bar'> = { labels: [], datasets: [] };
   public customerSegmentation: ChartData<'pie', number[], string> = { labels: [], datasets: [] };
   public topCustomers: ChartData<'bar'> = { labels: [], datasets: [] };
   public salesByShipMode: ChartData<'doughnut', number[], string> = { labels: [], datasets: [] };
   public radarChartData: ChartData<'radar'> = { labels: [], datasets: [] };
   public discountedOrdersTrend: ChartData<'line'> = { labels: [], datasets: [] };

   //profile
   currentUser: User | null = null;
   showProfile: boolean = false;

   // Dark mode state
   isDarkMode = false;

   // Chart options for different chart types
   barChartOptions: ChartOptions<'bar'> = {
     responsive: true,
     scales: {
       y: {
         beginAtZero: true,
         ticks: {
           callback: function(value) {
             return '$' + (typeof value === 'number' ? value.toFixed(2) : value); // Format as $XX.XX
           }
         }
       },
     },
     plugins: {
       tooltip: {
         callbacks: {
           label: function(tooltipItem) {
             return '$' + (typeof tooltipItem.raw === 'number' ? tooltipItem.raw.toFixed(2) : tooltipItem.raw); // Format as $XX.XX
           }
         }
       }
     }
   };
   

   doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: (tooltipItem: any) => {
            return '$' + (typeof tooltipItem.raw === 'number' ? tooltipItem.raw.toFixed(2) : tooltipItem.raw);
          }
        }
      }
    }
  };

   lineChartOptions: ChartOptions<'line'> = {
     responsive: true,
     scales: {
         y: {
             beginAtZero: true,
             ticks: {
                 callback: function(value) {
                     return '$' + (typeof value === 'number' ? value.toFixed(2) : value); // Format as $XX.XX
                 }
             }
         },
         x: {
             title: {
                 display: true,
                 text: 'Year'
             }
         }
     },
     plugins: {
         tooltip: {
             callbacks: {
                 label: function(tooltipItem) {
                     return tooltipItem.dataset.label + ': $' + (typeof tooltipItem.raw === 'number' ? tooltipItem.raw.toFixed(2) : tooltipItem.raw);
                 }
             }
         }
     }
 };
   
   radarChartOptions: ChartOptions<'radar'> = {
     responsive: true,
     scales: {
       r: {
         angleLines: {
           display: false
         },
         suggestedMin: 0,
         suggestedMax: 100,
         ticks: {
           callback: function(value) {
             return '$' + (typeof value === 'number' ? value.toFixed(2) : value); // Format as $XX.XX
           }
         }
       }
     },
     plugins: {
       tooltip: {
         callbacks: {
           label: function(tooltipItem) {
             return tooltipItem.label + ': $' + (typeof tooltipItem.raw === 'number' ? tooltipItem.raw.toFixed(2) : tooltipItem.raw); // Format as $XX.XX
           }
         }
       }
     }
   };

   pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: (tooltipItem: any) => {
            return tooltipItem.label + ': $' + (typeof tooltipItem.raw === 'number' ? tooltipItem.raw.toFixed(2) : tooltipItem.raw);
          }
        }
      }
    }
  };



  private charts: {
    [key: string]: any
  } = {};

 constructor(private couchdbService: CouchdbService, private router: Router, private http: HttpClient, private changeDetector: ChangeDetectorRef,  private ngZone: NgZone, private userService: UserService) {}

 //profile
 loadCurrentUser(): void {
   this.userService.currentUser$.subscribe(user => {
     this.currentUser = user;
   });
 }

 toggleProfile(): void {
   this.showProfile = !this.showProfile;
 }

 ngAfterViewInit(): void {
   setTimeout(() => {
       this.updateCharts(this.salesData);
       this.changeDetector.detectChanges();
   }, 0); // Adjust the timeout as needed
}
 
 ngOnInit(): void {
   this.loadDashboardData();
   this.loadGeoJson();
   this.startPolling(); 
   this.loadCurrentUser();
}

   startPolling(): void {

     this.pollingSubscription = interval(this.pollingInterval).pipe(
       switchMap(() => this.couchdbService.getSalesData())
     ).subscribe(
       salesData => {
         if (salesData.length === 0) {
           console.warn('No sales data available.');
           return;
         }
         this.calculateKPIs(salesData);
         this.updateCharts(salesData);
       },
       error => {
         console.error('Error fetching sales data:', error);
       }
     );

   }

   loadDashboardData(): void {
     this.couchdbService.getSalesData().pipe(take(1)).subscribe(
         salesData => {
             if (salesData.length === 0) {
                 console.warn('No sales data available.');
                 return;
             }
             this.salesData = salesData;
             this.calculateKPIs(salesData);
             this.updateCharts(salesData);
             this.changeDetector.detectChanges();  // Ensure view is updated
         },
         error => {
             console.error('Error fetching sales data:', error);
         }
     );
 }
   
   //MAP
   loadGeoJson(): void {
     this.http.get<any>('./assets/Leaflet.VectorGrid-master/Leaflet.VectorGrid-master/docs/eu-countries.geo.json')
     .subscribe(
       (data: any) => {
         this.geoJsonData = data;
         console.log('GeoJSON Data loaded');
         this.initMap();
       },
       (error: any) => {
         console.error('Error loading GeoJSON file:', error);
       }
     );
   }
  
   initMap(): void {
     console.log('Initializing map...');    
     // Coordinates for the listed countries
     const countryCoordinates: { [key: string]: [number, number] } = {
       'United Kingdom': [51.5074, -0.1278],
       'France': [48.8566, 2.3522],
       'Germany': [52.52, 13.405],
       'Italy': [41.9028, 12.4964],
       'Spain': [40.4168, -3.7038],
       'Netherlands': [52.3676, 4.9041],
       'Sweden': [59.3293, 18.0686],
       'Belgium': [50.8503, 4.3517],
       'Austria': [48.2082, 16.3738],
       'Ireland': [53.3498, -6.2603],
       'Portugal': [38.7223, -9.1393],
       'Finland': [60.1695, 24.9354],
       'Denmark': [55.6761, 12.5683],
       'Norway': [59.9139, 10.7522],
       'Switzerland': [46.2044, 6.1432]
     };
   
     const map = L.map('europe-map').setView([51.505, -0.09], 4);
   
     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
       attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
     }).addTo(map);
   
     for (const [country, coords] of Object.entries(countryCoordinates)) {
   
       console.log(`Creating marker for ${country}`);
       
       const marker = L.marker(coords).addTo(map);
       marker.bindPopup(`${country}`);
     }
   
     // Add GeoJSON layer
     if (this.geoJsonData) {
       L.geoJSON(this.geoJsonData).addTo(map);
     } else {
       console.warn('GeoJSON data not loaded');
     }
   }

   calculateKPIs(salesData: Sale[]): void {
     this.calculateGrossProfitMargin(salesData);
     this.calculateCustomerRetentionRate(salesData);
     this.calculateTotalSales(salesData);
     this.calculateAverageSalesPerTransaction(salesData);
     this.calculateTopPerformingCountries(salesData);
     this.calculateAverageOrderValue(salesData);
     this.calculateDiscountImpact(salesData);
   }

   updateCharts(salesData: Sale[]): void {
    this.destroyCharts();
    this.calculateProductCategoryProfitability(salesData);
    this.calculateCustomerSegmentation(salesData);
    this.calculateTopCustomers(salesData);
    this.calculateSalesByShipMode(salesData);
    this.calculateRadarChartData(salesData);
    this.calculateDiscountedOrdersTrend(salesData);
    this.renderCharts();
    this.changeDetector.detectChanges();
  }
  
  private destroyCharts(): void {
    Object.values(this.charts).forEach(chart => chart.destroy());
    this.charts = {};
  }
  
  private renderCharts(): void {
    this.renderProductCategoryProfitabilityChart();
    this.renderCustomerSegmentationChart();
    this.renderTopCustomersChart();
    this.renderSalesByShipModeChart();
    this.renderRadarChart();
    this.renderDiscountedOrdersTrendChart();
  }
  private renderProductCategoryProfitabilityChart(): void {
    const ctx = document.getElementById('productCategoryProfitabilityChart') as HTMLCanvasElement;
    if (ctx) {
      this.charts['productCategoryProfitability'] = new Chart(ctx, {
        type: 'bar',
        data: this.productCategoryProfitability,
        options: this.barChartOptions
      });
    }
  }
  
  private renderCustomerSegmentationChart(): void {
    const ctx = document.getElementById('customerSegmentationChart') as HTMLCanvasElement;
    if (ctx) {
      this.charts['customerSegmentation'] = new Chart(ctx, {
        type: 'pie',
        data: this.customerSegmentation,
        options: this.pieChartOptions
      }) as Chart<'pie', number[], string>;
    }
  }
  private renderTopCustomersChart(): void {
    const ctx = document.getElementById('topCustomersChart') as HTMLCanvasElement;
    if (ctx) {
      this.charts['topCustomers'] = new Chart(ctx, {
        type: 'bar',
        data: this.topCustomers,
        options: this.barChartOptions
      });
    }
  }
  
  private renderSalesByShipModeChart(): void {
    const ctx = document.getElementById('salesByShipModeChart') as HTMLCanvasElement;
    if (ctx) {
      this.charts['salesByShipMode'] = new Chart(ctx, {
        type: 'doughnut',
        data: this.salesByShipMode,
        options: this.doughnutChartOptions
      }) as Chart<'doughnut', number[], string>;
    }
  }
  
  private renderRadarChart(): void {
    const ctx = document.getElementById('radarChart') as HTMLCanvasElement;
    if (ctx) {
      this.charts['radar'] = new Chart(ctx, {
        type: 'radar',
        data: this.radarChartData,
        options: this.radarChartOptions
      });
    }
  }
  
  private renderDiscountedOrdersTrendChart(): void {
    const ctx = document.getElementById('discountedOrdersTrendChart') as HTMLCanvasElement;
    if (ctx) {
      this.charts['discountedOrdersTrend'] = new Chart(ctx, {
        type: 'line',
        data: this.discountedOrdersTrend,
        options: this.lineChartOptions
      });
    }
  }
   // KPI Calculation Methods
   calculateGrossProfitMargin(salesData: Sale[]): void {
     const categories = this.uniqueCategories(salesData);
     categories.forEach(category => {
       const categorySales = salesData.filter(sale => sale.Category === category);
       const totalSales = this.sumByKey(categorySales, 'Sales');
       const totalProfit = this.sumByKey(categorySales, 'Profit');
       this.grossProfitMargin[category] = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
     });
   }

   calculateCustomerRetentionRate(salesData: Sale[]): void {
     const totalCustomers = this.uniqueCount(salesData, 'Customer ID');
     const returningCustomers = this.returningCustomerCount(salesData);
     this.customerRetentionRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;
   }

   calculateTotalSales(salesData: Sale[]): void {
     this.totalSales = this.sumByKey(salesData, 'Sales');
   }

   calculateAverageSalesPerTransaction(salesData: Sale[]): void {
     const totalRevenue = this.sumByKey(salesData, 'Sales');
     const numberOfTransactions = salesData.length;
     this.averageSalesPerTransaction = numberOfTransactions ? totalRevenue / numberOfTransactions : 0;
   }

   calculateTopPerformingCountries(salesData: Sale[]): void {
     const countrySales = this.groupByAndSum(salesData, 'Country', 'Sales');
     this.topPerformingCountries = Object.entries(countrySales)
       .map(([country, sales]) => ({ Country: country || 'Unknown', Sales: sales }))
       .sort((a, b) => b.Sales - a.Sales)
       .slice(0, 3);
   }

   calculateAverageOrderValue(salesData: Sale[]): void {
     const totalRevenue = this.sumByKey(salesData, 'Sales');
     const numberOfOrders = this.uniqueCount(salesData, 'Order_ID');
     this.averageOrderValue = numberOfOrders ? totalRevenue / numberOfOrders : 0;
   }

   calculateDiscountImpact(salesData: Sale[]): void {
     const totalSales = this.sumByKey(salesData, 'Sales');
     const totalDiscount = this.sumByKey(salesData, 'Discount');
     this.discountImpact = totalSales > 0 ? (totalDiscount / totalSales) * 100 : 0;
   }

   // Chart Calculation Methods
   calculateProductCategoryProfitability(salesData: Sale[]): void {
     const categories = this.uniqueCategories(salesData);
     const sales = categories.map(category => {
       const categorySales = salesData.filter(sale => sale.Category === category);
       const totalSales = this.sumByKey(categorySales, 'Sales');
       const totalProfit = this.sumByKey(categorySales, 'Profit');
       return { category, sales: totalSales, profit: totalProfit };
     });

     this.productCategoryProfitability.labels = sales.map(s => s.category);
     this.productCategoryProfitability.datasets = [
       { label: 'Sales', data: sales.map(s => s.sales), backgroundColor: 'rgba(75, 192, 192, 0.2)' },
       { label: 'Profit', data: sales.map(s => s.profit), backgroundColor: 'rgba(153, 102, 255, 0.2)' }
     ];
   }

   calculateCustomerSegmentation(salesData: Sale[]): void {
     const segments = ['Corporate', 'Consumer', 'Home Office'];
     const segmentSales = segments.map(segment => {
       const totalSales = this.sumByFilter(salesData, 'Segment', segment, 'Sales');
       return { segment, sales: totalSales };
     });
   
     this.customerSegmentation.labels = segmentSales.map(s => s.segment);
     this.customerSegmentation.datasets = [{
       data: segmentSales.map(s => s.sales),
       backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
     }];
   }
   
   
   calculateTopCustomers(salesData: Sale[]): void { 
     const customerSales = salesData.reduce((acc, sale) => {
       const { "Customer ID": customerId, "Customer Name": customerName, Sales } = sale; // Use correct names
       if (!acc[customerId]) {
         acc[customerId] = { name: customerName, totalSales: 0 };
       }
       acc[customerId].totalSales += Sales;
       return acc;
     }, {} as { [key: string]: { name: string; totalSales: number } });

     // Convert the object to an array and sort it
     const sortedCustomers = Object.entries(customerSales)
       .sort((a, b) => b[1].totalSales - a[1].totalSales)
       .slice(0, 10);

     console.log('Top 10 Customers:', sortedCustomers); // Log to check values

     this.topCustomers.labels = sortedCustomers.map(c => c[1].name); 
     this.topCustomers.datasets = [{
       label: 'Top Customers',
       data: sortedCustomers.map(c => c[1].totalSales),
       backgroundColor: 'rgba(75, 192, 192, 0.2)',
     }];
 }

 calculateSalesByShipMode(salesData: Sale[]): void {
   const modeSales = salesData.reduce((acc, sale) => {
       const mode = sale["Ship Mode"]; // Correctly reference "Ship Mode"
       const sales = sale.Sales;

       // Initialize if not present
       if (!acc[mode]) {
           acc[mode] = 0;
       }
       acc[mode] += sales; // Sum sales for each shipping mode
       return acc;
   }, {} as { [key: string]: number });

   // Prepare the data for the chart
   this.salesByShipMode.labels = Object.keys(modeSales);
   this.salesByShipMode.datasets = [{
       data: Object.values(modeSales),
       backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'] // Add more colors if needed
   }];
 }

 calculateRadarChartData(salesData: Sale[]): void {
   const categories = this.uniqueCategories(salesData);
   const salesDataArray = categories.map(category => {
       const categorySales = salesData.filter(sale => sale.Category === category);
       const totalSales = this.sumByKey(categorySales, 'Sales');
       const totalProfit = this.sumByKey(categorySales, 'Profit');
       const averageDiscount = this.sumByKey(categorySales, 'Discount') / categorySales.length || 0;

       return {
           category,
           sales: totalSales,
           profit: totalProfit,
           discount: averageDiscount * 100 
       };
   });

   this.radarChartData.labels = salesDataArray.map(s => s.category);
   this.radarChartData.datasets = [
       {
           label: 'Sales',
           data: salesDataArray.map(s => s.sales),
           backgroundColor: 'rgba(75, 192, 192, 0.2)',
           borderColor: 'rgba(75, 192, 192, 1)',
           borderWidth: 1
       },
       {
           label: 'Profit',
           data: salesDataArray.map(s => s.profit),
           backgroundColor: 'rgba(153, 102, 255, 0.2)',
           borderColor: 'rgba(153, 102, 255, 1)',
           borderWidth: 1
       },
       {
           label: 'Discount',
           data: salesDataArray.map(s => s.discount),
           backgroundColor: 'rgba(255, 99, 132, 0.2)',
           borderColor: 'rgba(255, 99, 132, 1)',
           borderWidth: 1
       }
   ];
 }

 calculateDiscountedOrdersTrend(salesData: Sale[]): void {
   const discountedOrders = salesData.filter(sale => sale.Discount > 0);
   
   const ordersPerYearAndHalf: { [key: string]: { firstHalf: number; secondHalf: number } } = {};
   
   discountedOrders.forEach(sale => {
       const year = new Date(sale.Order_Date).getFullYear();
       const month = new Date(sale.Order_Date).getMonth();

       const key = year.toString();

       // Initialize if not present
       if (!ordersPerYearAndHalf[key]) {
           ordersPerYearAndHalf[key] = { firstHalf: 0, secondHalf: 0 };
       }

       // Sum sales for the respective half of the year
       if (month < 6) { // January to June
           ordersPerYearAndHalf[key].firstHalf += sale.Sales;
       } else { // July to December
           ordersPerYearAndHalf[key].secondHalf += sale.Sales;
       }
   });

   // Prepare the data for the chart
   this.discountedOrdersTrend.labels = Object.keys(ordersPerYearAndHalf);
   this.discountedOrdersTrend.datasets = [
       {
           label: 'First Half',
           data: Object.values(ordersPerYearAndHalf).map(value => value.firstHalf),
           backgroundColor: 'rgba(75, 192, 192, 0.5)',
           borderColor: 'rgba(75, 192, 192, 1)',
           fill: false,
           borderWidth: 2
       },
       {
           label: 'Second Half',
           data: Object.values(ordersPerYearAndHalf).map(value => value.secondHalf),
           backgroundColor: 'rgba(153, 102, 255, 0.5)',
           borderColor: 'rgba(153, 102, 255, 1)',
           fill: false,
           borderWidth: 2
       }
   ];
}


   // Utility Functions
   private uniqueCategories(salesData: Sale[]): string[] {
     return Array.from(new Set(salesData.map(sale => sale.Category)));
   }

   private sumByKey(salesData: Sale[], key: keyof Sale): number {
     return salesData.reduce((sum, sale) => {
       const value = sale[key];
       return sum + (typeof value === 'number' ? value : 0);
     }, 0);
   }
   
   private sumByFilter(salesData: Sale[], filterKey: keyof Sale, filterValue: any, sumKey: keyof Sale): number {
     return salesData
       .filter(sale => sale[filterKey] === filterValue)
       .reduce((sum, sale) => {
         const value = sale[sumKey];
         return sum + (typeof value === 'number' ? value : 0);
       }, 0);
   }
   
   private uniqueCount(salesData: Sale[], key: keyof Sale): number {
     return new Set(salesData.map(sale => sale[key])).size;
   }

   private returningCustomerCount(salesData: Sale[]): number {
     const customerCount = new Set();
     salesData.forEach(sale => customerCount.add(sale["Customer ID"]));
     return customerCount.size;
   }

   private groupByAndSum(salesData: Sale[], groupByKey: keyof Sale, sumKey: keyof Sale): { [key: string]: number } {
     return salesData.reduce((acc, sale) => {
         const key = String(sale[groupByKey] ?? 'Unknown'); // Ensure key is a string
         const value = sale[sumKey];

         // Check if value is a number before summing
         if (typeof value === 'number') {
             acc[key] = (acc[key] || 0) + value;
         }

         return acc;
     }, {} as { [key: string]: number });
 }

   private groupByMonth(salesData: Sale[]): { [key: string]: number } {
     const monthlySales: { [key: string]: number } = {};
     salesData.forEach(sale => {
       const month = new Date(sale.Order_Date).toLocaleString('default', { month: 'long' });
       monthlySales[month] = (monthlySales[month] || 0) + (typeof sale.Sales === 'number' ? sale.Sales : 0);
     });
     return monthlySales;
   }

   private groupByAndCalculateReturnRate(salesData: Sale[]): { [key: string]: number } {
     const returns: { [key: string]: { returns: number; total: number } } = {};
     salesData.forEach(sale => {
         const product = sale.Product_Name || 'Unknown';
         if (!returns[product]) {
             returns[product] = { returns: 0, total: 0 };
         }
         returns[product].total += 1;
         if (sale.Return === true) { // Assuming 'Return' is a boolean
             returns[product].returns += 1;
         }
     });

     return Object.fromEntries(
         Object.entries(returns).map(([product, { returns, total }]) => {
             return [product, total > 0 ? (returns / total) * 100 : 0];
         })
     );
 }

 forecast(): void{
   this.router.navigate(['/forecast']);
 }

   toggleDarkMode(): void {
     this.isDarkMode = !this.isDarkMode;
   }

   logout(): void {
     // Handle logout logic here
     this.router.navigate(['/home']);
   }
 }