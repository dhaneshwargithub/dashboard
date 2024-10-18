import { Component, OnInit } from '@angular/core';
import { SalesDataService } from '../sales-data.service';
import { Chart, registerables } from 'chart.js';

@Component({
  selector: 'app-forecast',
  templateUrl: './forecast.component.html',
  styleUrls: ['./forecast.component.css']
})
export class ForecastComponent implements OnInit {
  countries: string[] = [];
  categories: string[] = [];
  subCategories: string[] = [];
  
  country = '';
  category = '';
  subCategory = '';
  startDate = '';
  forecastMonths = 12;
  forecastData: any = {};
  chart: any;
  dateError: string | null = null;
  forecastMonthsError: string | null = null;

  private minDate = new Date('2015-01-01');
  private maxDate = new Date('2018-12-31');

  uniqueSubCategories: { [key: string]: string[] } = {
    "Office Supplies": ['Storage', 'Labels', 'Appliances', 'Fasteners', 'Art', 'Binders', 'Paper', 'Supplies', 'Envelopes'],
    "Technology": ['Accessories', 'Phones', 'Copiers', 'Machines'],
    "Furniture": ['Bookcases', 'Tables', 'Chairs', 'Furnishings']
  };

  constructor(private salesDataService: SalesDataService) {}

  ngOnInit(): void {
    Chart.register(...registerables); // Ensure Chart.js components are registered
    this.loadDropdownOptions();
  }

  loadDropdownOptions(): void {
    this.salesDataService.getDropdownOptions().subscribe(
      data => {
        this.countries = data.countries;
        this.categories = data.categories;
        // Initialize subCategories with the first category's sub-categories
        this.updateSubCategories(this.categories[0]);
      },
      error => {
        console.error('Error fetching dropdown options', error);
      }
    );
  }

  updateSubCategories(category: string): void {
    this.subCategories = this.uniqueSubCategories[category] || [];
    this.subCategory = this.subCategories[0] || '';
    this.isFormValid(); // Check form validity
  }

  validateStartDate(): void {
    const [year, month] = this.startDate.split('-').map(Number);
    const inputDate = new Date(year, month - 1, 1);

    if (isNaN(inputDate.getTime())) {
      this.dateError = 'Invalid date format. Please use YYYY-MM.';
    } else if (inputDate < this.minDate || inputDate > this.maxDate) {
      this.dateError = `Select a start date between ${this.minDate.toISOString().slice(0, 10)} and ${this.maxDate.toISOString().slice(0, 10)}.`;
    } else {
      this.dateError = null;
    }
    this.isFormValid(); // Check form validity
  }

  validateForecastMonths(): void {
    if (this.forecastMonths < 1 || this.forecastMonths > 24) {
      this.forecastMonthsError = 'Forecast months must be between 1 and 24.';
    } else {
      this.forecastMonthsError = null;
    }
    this.isFormValid(); // Check form validity
  }

  isFormValid(): boolean {
    return this.country !== '' &&
           this.category !== '' &&
           this.subCategory !== '' &&
           this.dateError === null &&
           this.forecastMonthsError === null &&
           this.startDate !== '' &&
           this.forecastMonths >= 1 && this.forecastMonths <= 24;
  }

  loadForecastData(): void {
    this.validateStartDate();
    this.validateForecastMonths();

    if (this.dateError || this.forecastMonthsError) {
      return; // Prevent submission if there are validation errors
    }

    this.salesDataService.getForecast(this.country, this.category, this.subCategory, this.startDate, this.forecastMonths)
      .subscribe(
        data => {
          this.forecastData = data;
          this.renderChart();
        },
        error => {
          console.error('Error fetching forecast data', error);
        }
      );
  }

  renderChart(): void {
    if (this.chart) {
      this.chart.destroy(); // Destroy existing chart instance
    }
  
    const forecastedSales = Object.values(this.forecastData['Forecasted Sales']);
    const actualSales = Object.values(this.forecastData['Actual Sales']);
    const labels = Object.keys(this.forecastData['Forecasted Sales']);
  
    this.chart = new Chart('forecastChart', {
      type: 'line',
      data: {
        labels: labels,  // Dates
        datasets: [
          {
            label: 'Forecasted Sales',
            data: forecastedSales,
            fill: false,
            borderColor: 'blue',
            tension: 0.1
          },
          {
            label: 'Actual Sales',
            data: actualSales,
            fill: false,
            borderColor: 'red',
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(tooltipItem: any) {
                // Format the tooltip label
                const value = tooltipItem.raw;
                return `${tooltipItem.dataset.label}: $${value.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Sales'
            }
          }
        }
      }
    });
  }
  
}
