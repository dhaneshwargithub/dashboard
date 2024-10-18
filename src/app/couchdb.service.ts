import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { map, timeout, switchMap } from 'rxjs/operators';
import { Sale } from './home/models/sales-data';

@Injectable({
  providedIn: 'root'
})
export class CouchdbService {
  private baseUrl = 'https://192.168.57.185:5984/sales_data/_all_docs?include_docs=true';

  private headers = new HttpHeaders({
    'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2')
  });

  private salesDataSubject = new BehaviorSubject<Sale[]>([]);
  salesData$ = this.salesDataSubject.asObservable();

  constructor(private http: HttpClient) {
    // Polling every 60 seconds
    interval(60000).pipe(
      switchMap(() => this.getSalesData())
    ).subscribe(data => {
      this.salesDataSubject.next(data);
    }, error => {
      console.error('Error fetching sales data:', error);
    });
  }

  getSalesData(): Observable<Sale[]> {
    return this.http.get<any>(this.baseUrl, { headers: this.headers }).pipe(
      timeout(10000),
      map(response => response.rows.map((row: any) => row.doc).filter((doc: any) => doc.type === 'sales'))
    );
  }
}
