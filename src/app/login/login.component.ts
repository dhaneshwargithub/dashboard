import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../user.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  designation: string = '';
  errorMessage: string = '';

  // List of designations
  designations: string[] = [
    'Sales Representative',
    'Customer Service Representative',
    'Sales Manager',
    'Data Analyst',
    'Operations Manager'
  ];

  constructor(private router: Router, private userService: UserService) {}

  login() {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@chainsys\.com$/;
    if (!emailPattern.test(this.email)) {
      this.errorMessage = 'Invalid email. Please use an email ending with @chainsys.com.';
      return;
    }

    this.userService.fetchUserByEmail(this.email).subscribe(user => {
      if (user && user.password === this.password) {
        if (this.isDesignationValidForUser(user.role, this.designation)) {
          this.userService.setCurrentUser(user);
          this.router.navigate(this.isEmployeeDashboard(user.role) ? ['/employee-dashboard'] : ['/manager-dashboard']);
        } else {
          this.errorMessage = 'Designation does not match user role.';
        }
      } else {
        this.errorMessage = 'Invalid email or password.';
      }
    }, error => {
      this.errorMessage = 'An error occurred while fetching user data.';
      console.error(error);
    });
  }

  isDesignationValidForUser(role: string, designation: string): boolean {
    const roleDesignationMap: { [key: string]: string[] } = {
      'Sales Representative': ['Sales Representative'],
      'Customer Service Representative': ['Customer Service Representative'],
      'Sales Manager': ['Sales Manager'],
      'Data Analyst': ['Data Analyst'],
      'Operations Manager': ['Operations Manager']
    };
    return roleDesignationMap[role]?.includes(designation) || false;
  }

  isEmployeeDashboard(role: string): boolean {
    return ['Sales Representative', 'Customer Service Representative'].includes(role);
  }
}
