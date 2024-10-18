import { Component, OnInit } from '@angular/core';
import { CouchdbService } from '../couchdb.service';
import { Sale } from '../home/models/sales-data';
import { Chart, ChartType, registerables } from 'chart.js';
import { Router } from '@angular/router';
import 'chartjs-adapter-date-fns';
import { UserService } from '../user.service';
import { User } from '../home/models/user.model';
import { TooltipItem } from 'chart.js';


Chart.register(...registerables);

@Component({
  selector: 'app-employee-dashboard',
  templateUrl: './employee-dashboard.component.html',
  styleUrls: ['./employee-dashboard.component.css']
})

export class EmployeeDashboardComponent implements OnInit {
  salesData: Sale[] = [];
  totalSales = 0;
  totalProfit = 0;
  salesByRegion: { [key: string]: number } = {};
  topCategories: { [key: string]: number } = {};
  salesTrend: { x: Date, y: number }[] = [];
  profitMargin = 0;
  profitDistribution: { [key: string]: number } = {};
  monthlyRevenue: { [key: string]: { [category: string]: number } } = {};

  // New KPIs
  customerAcquisitionCost = 0;
  customerLifetimeValue = 0;
  averageFulfillmentTime = 0;
  returnOnInvestment = 0;

  pollingInterval = 60000; // 60 seconds
  isDarkMode = false; 

  //profile
  currentUser: User | null = null;
  showProfile: boolean = false;

  constructor(private couchdbService: CouchdbService, private router: Router, private userService: UserService) {}

  ngOnInit(): void {
    this.loadSalesData();
    this.startPolling();
    this.loadCurrentUser();
  }

  loadSalesData() {
    this.couchdbService.getSalesData().subscribe(
      (sales: Sale[]) => {
        this.salesData = sales;
        this.calculateKPIs();
        this.renderCharts();
      },
      error => {
        console.error('Error fetching sales data:', error);
      }
    );
  }

  startPolling() {
    setInterval(() => {
      this.couchdbService.getSalesData().subscribe(
        (sales: Sale[]) => {
          this.salesData = sales;
          this.calculateKPIs();
          this.renderCharts();
        },
        error => {
          console.error('Error fetching sales data:', error);
        }
      );
    }, this.pollingInterval);
  }


  calculateKPIs() {
    this.totalSales = this.salesData.reduce((sum, record) => sum + (record.Sales || 0), 0);
    this.totalProfit = this.salesData.reduce((sum, record) => sum + (record.Profit || 0), 0);

    this.salesByRegion = this.salesData.reduce((acc, record) => {
      if (record.Region) {
        acc[record.Region] = (acc[record.Region] || 0) + (record.Sales || 0);
      }
      return acc;
    }, {} as { [key: string]: number });

    this.topCategories = this.salesData.reduce((acc, record) => {
      if (record.Category) {
        acc[record.Category] = (acc[record.Category] || 0) + (record.Sales || 0);
      }
      return acc;
    }, {} as { [key: string]: number });

    this.topCategories = Object.fromEntries(
      Object.entries(this.topCategories).sort(([, a], [, b]) => b - a)
    );

    this.profitDistribution = this.salesData.reduce((acc, record) => {
      if (record.Country) {
        acc[record.Country] = (acc[record.Country] || 0) + (record.Profit || 0);
      }
      return acc;
    }, {} as { [key: string]: number });

    this.salesTrend = this.salesData.reduce((acc, record) => {
      let orderDate = new Date(record.Order_Date);
      if (isNaN(orderDate.getTime())) {
        orderDate = new Date(0);
      }

      const halfYearStart = orderDate.getMonth() < 6 
        ? new Date(orderDate.getFullYear(), 0, 1)
        : new Date(orderDate.getFullYear(), 6, 1); 

      const foundPeriod = acc.find(d => d.x.getTime() === halfYearStart.getTime());
      if (foundPeriod) {
        foundPeriod.y += record.Sales;
      } else {
        acc.push({ x: halfYearStart, y: record.Sales });
      }

      return acc;
    }, [] as { x: Date, y: number }[]);

    this.profitMargin = this.totalSales > 0 ? (this.totalProfit / this.totalSales) * 100 : 0;

    this.customerAcquisitionCost = this.calculateCustomerAcquisitionCost();
    this.customerLifetimeValue = this.calculateCustomerLifetimeValue();
    this.averageFulfillmentTime = this.calculateAverageFulfillmentTime() || 0;
    this.returnOnInvestment = this.calculateReturnOnInvestment();

    this.monthlyRevenue = this.salesData.reduce((acc, record) => {
      const month = new Date(record.Order_Date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!acc[month]) {
        acc[month] = {};
      }
      if (record.Category) {
        acc[month][record.Category] = (acc[month][record.Category] || 0) + (record.Sales || 0);
      }
      return acc;
    }, {} as { [key: string]: { [category: string]: number } });
  }

  calculateCustomerAcquisitionCost(): number {
    return this.totalSales / (this.salesData.length || 1);
  }

  calculateCustomerLifetimeValue(): number {
    return this.totalProfit / (this.salesData.length || 1);
  }

  calculateAverageFulfillmentTime(): number | null {
    const validRecords = this.salesData.filter(record => {
      const orderDate = new Date(record.Order_Date);
      const shipDate = new Date(record.Ship_Date);
      return !isNaN(orderDate.getTime()) && !isNaN(shipDate.getTime());
    });

    if (validRecords.length === 0) {
      return null;
    }

    // Calculate fulfillment times in days
    const fulfillmentTimes = validRecords.map(record => {
      const orderDate = new Date(record.Order_Date);
      const shipDate = new Date(record.Ship_Date);
      const diffInMs = shipDate.getTime() - orderDate.getTime();
      return diffInMs / (1000 * 60 * 60 * 24); // Convert ms to days
    });

    function calculateMedian(values: number[]): number {
      if (values.length === 0) return 0;
      const sorted = values.slice().sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
      } else {
        return sorted[middle];
      }
    }

    const medianFulfillmentTime = calculateMedian(fulfillmentTimes);

    const meanFulfillmentTime = fulfillmentTimes.reduce((a, b) => a + b, 0) / fulfillmentTimes.length;
    
    return medianFulfillmentTime > 0 ? medianFulfillmentTime : (meanFulfillmentTime > 0 ? meanFulfillmentTime : null);
  }

  calculateReturnOnInvestment(): number {
    return (this.totalProfit / this.totalSales) * 100;
  }

  renderCharts() {
    const axisLabelColor = this.isDarkMode ? '#ffffff' : '#000000'; // White for dark mode, black for light mode
    const gridLineColor = this.isDarkMode ? '#444444' : '#dddddd'; // Adjusted grid line color for dark mode

    const dollarFormatter = (value: number) => `$${value.toLocaleString()}`; // Dollar formatter function


    this.renderChart('salesTrendChart', 'line', {
        datasets: [{
            label: 'Sales Trend',
            data: this.salesTrend,
            borderColor: 'rgba(0, 255, 255, 1)', 
            backgroundColor: 'rgba(0, 255, 255, 0.2)', 
            fill: false
        }]
    }, {
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'month'
                },
                ticks: {
                    color: axisLabelColor, // X-axis label color
                },
                grid: {
                    color: gridLineColor, // Grid line color
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: axisLabelColor, // Y-axis label color
                    callback: dollarFormatter,
                },
                grid: {
                    color: gridLineColor, // Grid line color
                }
            }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: TooltipItem<'line'>) => {
                const value = context.parsed.y; 
                return `${context.dataset.label}: ${dollarFormatter(value)}`; // Format with dollar sign
            }
            }
          }
        }
    });

    this.renderChart('salesByRegionChart', 'bar', {
        labels: Object.keys(this.salesByRegion),
        datasets: [{
            label: 'Sales by Region',
            data: Object.values(this.salesByRegion),
            backgroundColor: 'rgba(153, 102, 255, 0.8)', 
            borderColor: 'rgba(153, 102, 255, 1)', 
            borderWidth: 1
        }]
    }, {
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    color: axisLabelColor, // Y-axis label color
                    callback: dollarFormatter,

                },
                grid: {
                    color: gridLineColor, // Grid line color
                }
            },
            x: {
                ticks: {
                    color: axisLabelColor, // X-axis label color
                },
                grid: {
                    color: gridLineColor, // Grid line color
                }
            }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: TooltipItem<'bar'>) => {
                const value = context.raw as number; // Correctly reference the Y value
                return `${context.dataset.label}: ${dollarFormatter(value)}`; // Format with dollar sign
            },
            title: (context: TooltipItem<'bar'>[]) => {
              return context[0].label; // Show the label of the bar
          }

            }
          }
        }
    });

    this.renderChart('topCategoriesChart', 'pie', {
      labels: Object.keys(this.topCategories),
      datasets: [{
          label: 'Top Categories by Sales',
          data: Object.values(this.topCategories),
          backgroundColor: Object.keys(this.topCategories).map(category => this.getCategoryColor(category)), 
          borderColor: Object.keys(this.topCategories).map(category => this.getCategoryColor(category, true)), 
          borderWidth: 1
      }]
  }, {
      responsive: true,
      plugins: {
          tooltip: {
              callbacks: {
                  label: (context: TooltipItem<'pie'>) => {
                      const value = context.raw as number;
                      return `${context.label}: $${value.toLocaleString()}`; // Format with dollar sign
                  }
              }
          },
          legend: {
              labels: {
                  color: axisLabelColor // Legend labels color
              }
          }
      }
  });
  this.renderChart('profitDistributionChart', 'doughnut', {
    labels: Object.keys(this.profitDistribution),
    datasets: [{
        label: 'Profit Distribution by Country',
        data: Object.values(this.profitDistribution),
        backgroundColor: Object.keys(this.profitDistribution).map(country => this.getCategoryColor(country)), 
        borderColor: Object.keys(this.profitDistribution).map(country => this.getCategoryColor(country, true)), 
        borderWidth: 1
    }]
}, {
    responsive: true,
    plugins: {
        tooltip: {
            callbacks: {
                label: (context: TooltipItem<'doughnut'>) => {
                    const value = context.raw as number; // Type assertion to number
                    return `${context.label}: $${value.toLocaleString()}`; // Format with dollar sign
                }
            }
        },
        legend: {
            labels: {
                color: axisLabelColor // Legend labels color
            }
        }
    }
});


    if (Object.keys(this.monthlyRevenue).length > 0) {
        setTimeout(() => {
            const ctx = document.getElementById('monthlyRevenueBreakdownChart') as HTMLCanvasElement;
            if (ctx) {
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(this.monthlyRevenue),
                        datasets: Object.keys(this.monthlyRevenue[Object.keys(this.monthlyRevenue)[0]]).map(category => ({
                            label: category,
                            data: Object.keys(this.monthlyRevenue).map(month => this.monthlyRevenue[month][category] || 0),
                            backgroundColor: this.getCategoryColor(category), 
                            borderColor: this.getCategoryColor(category, true), 
                            borderWidth: 1
                        }))
                    },
                    options: {
                        scales: {
                            x: {
                                stacked: true,
                                ticks: {
                                    color: axisLabelColor // X-axis label color
                                },
                                grid: {
                                    color: gridLineColor // Grid line color
                                }
                            },
                            y: {
                                beginAtZero: true,
                                stacked: true,
                                ticks: {
                                    color: axisLabelColor, // Y-axis label color
                                    callback: (value) => `$${value.toLocaleString()}`
                                  },
                                grid: {
                                    color: gridLineColor // Grid line color
                                }
                            }
                        },
                        plugins: {
                          tooltip : {
                            callbacks : {
                              label: (context: TooltipItem<'bar'>) => {
                                const value = context.raw as number; // Type assertion to number
                                return `${context.label}: $${value.toLocaleString()}`; // Format with dollar sign
                            }
                            }
                          }
                        }
                    }
                });
            } else {
                console.error('Canvas element for monthlyRevenueChart not found.');
            }
        });
    }
}


  renderChart(chartId: string, type: ChartType, data: any, options: any) {
    const ctx = document.getElementById(chartId) as HTMLCanvasElement;
    if (ctx) {
      new Chart(ctx, {
        type: type,
        data: data,
        options: options
      });
    }
  }

  getCategoryColor(category: string, border = false): string {
    const darkThemeColors: { [key: string]: string } = {
      'Category1': 'rgba(255, 99, 132, 0.6)',
      'Category2': 'rgba(54, 162, 235, 0.6)',
      'Category3': 'rgba(255, 206, 86, 0.6)',
      'Category4': 'rgba(75, 192, 192, 0.6)',
      'Category5': 'rgba(153, 102, 255, 0.6)',
      'Category6': 'rgba(255, 159, 64, 0.6)',
      'Category7': 'rgba(199, 199, 199, 0.6)',
      'Category8': 'rgba(83, 102, 255, 0.6)',
    };
    
    const lightThemeColors: { [key: string]: string } = {
      'Category1': 'rgba(255, 99, 132, 0.6)',
      'Category2': 'rgba(54, 162, 235, 0.6)',
      'Category3': 'rgba(255, 206, 86, 0.6)',
      'Category4': 'rgba(75, 192, 192, 0.6)',
      'Category5': 'rgba(153, 102, 255, 0.6)',
      'Category6': 'rgba(255, 159, 64, 0.6)',
      'Category7': 'rgba(199, 199, 199, 0.6)',
      'Category8': 'rgba(83, 102, 255, 0.6)',
    };

    const borderColors: { [key: string]: string } = {
      'Category1': 'rgba(255, 99, 132, 1)',
      'Category2': 'rgba(54, 162, 235, 1)',
      'Category3': 'rgba(255, 206, 86, 1)',
      'Category4': 'rgba(75, 192, 192, 1)',
      'Category5': 'rgba(153, 102, 255, 1)',
      'Category6': 'rgba(255, 159, 64, 1)',
      'Category7': 'rgba(199, 199, 199, 1)',
      'Category8': 'rgba(83, 102, 255, 1)',
    };

    const colors = this.isDarkMode ? darkThemeColors : lightThemeColors;
    
    if (!colors[category]) {
      const randomColor = `rgba(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${border ? 1 : 0.6})`;
      return border ? randomColor.replace('0.6', '1') : randomColor;
    }

    return border ? colors[category] || 'rgba(0,0,0,1)' : colors[category] || 'rgba(0,0,0,0.6)';
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    const dashboard = document.querySelector('.dashboard');
    if (this.isDarkMode) {
      dashboard?.classList.add('dark-theme');
    } else {
      dashboard?.classList.remove('dark-theme');
    }
    this.renderCharts(); // Re-render charts to apply dark mode styles
  }

  //profile
  loadCurrentUser(): void {
    this.userService.currentUser$.subscribe(user => {
      this.currentUser = user;
      console.log('Current user:', this.currentUser);
    });
  }
  

  toggleProfile(): void {
    this.showProfile = !this.showProfile;
  }
  
  // Logout function
  logout() {
    // Logic for logout can be added here (like clearing session data)
    this.router.navigate(['/home']);  // Redirect to home page
  }
}
