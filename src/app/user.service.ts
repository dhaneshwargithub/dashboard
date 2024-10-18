import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { map, timeout } from 'rxjs/operators';
import { User } from './home/models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private baseUrl = 'https://192.168.57.185:5984/user_credentials/_all_docs?include_docs=true';

  private headers = new HttpHeaders({
    'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2')
  });

  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromLocalStorage());
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  setCurrentUser(user: User) {
    this.currentUserSubject.next(user);
    this.saveUserToLocalStorage(user);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  clearCurrentUser() {
    this.currentUserSubject.next(null);
    localStorage.removeItem('currentUser'); 
  }

  private getUserFromLocalStorage(): User | null {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }

  private saveUserToLocalStorage(user: User) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  // Fetch user by email
  fetchUserByEmail(email: string): Observable<User | null> {
    return this.http.get<any>(this.baseUrl, { headers: this.headers }).pipe(
      timeout(10000),
      map(response => {
        const userDoc = response.rows.find((row: any) => row.doc.email === email);
        return userDoc ? userDoc.doc as User : null; // Cast to User type
      })
    );
  }
}
