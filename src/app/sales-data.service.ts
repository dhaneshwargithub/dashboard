import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Define interfaces for type safety
interface ForecastRequest {
  country: string;
  category: string;
  sub_category: string;
  start_date: string;
  forecast_months: number;
}

interface ForecastedData {
  mean: number;
  mean_ci_lower: number;
  mean_ci_upper: number;
}

interface ForecastResponse {
  'Forecasted Sales': { [key: string]: number };
  'Actual Sales': { [key: string]: number };
}

interface DropdownOptions {
  countries: string[];
  categories: string[];
  subCategories: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SalesDataService {
  private apiUrl = 'http://127.0.0.1:8000'; // Use environment variables for better configuration

  constructor(private http: HttpClient) { }

  // Method to fetch forecast data
  getForecast(
    country: string,
    category: string,
    subCategory: string,
    startDate: string,
    forecastMonths: number
  ): Observable<ForecastResponse> {
    const body: ForecastRequest = {
      country,
      category,
      sub_category: subCategory,
      start_date: startDate,
      forecast_months: forecastMonths
    };

    return this.http.post<ForecastResponse>(`${this.apiUrl}/forecast`, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }) // Ensure backend expects JSON
    }).pipe(
      catchError(this.handleError) // Handle any errors
    );
  }

  // Method to fetch dropdown options
  getDropdownOptions(): Observable<DropdownOptions> {
    return this.http.get<DropdownOptions>(`${this.apiUrl}/dropdown-options`).pipe(
      catchError(this.handleError) // Handle any errors
    );
  }

  // Error handling method
  private handleError(error: any): Observable<never> {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      errorMessage = `Client-side error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server-side error: ${error.status} ${error.message}`;
    }
    console.error('An error occurred:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
