# School Safe Connect (SSC) - Core API Contracts

## Base URL: `/api/v1`

### 1. Authentication (`/auth`)

#### `POST /auth/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "identifier": "user@school.edu",
    "password": "Password123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Credentials verified. 2FA OTP has been dispatched.",
    "data": {
      "requires2FA": true,
      "tempToken": "eyJhbGciOi...",
      "method": "SMS",
      "maskedPhone": "******3210",
      "maskedEmail": "u***r@school.edu"
    }
  }
  ```

#### `POST /auth/verify-2fa`
- **Access**: Public (requires `tempToken`)
- **Request Body**:
  ```json
  {
    "tempToken": "eyJhbGciOi...",
    "otp": "582914",
    "deviceDetails": {
      "deviceId": "dev-uuid-1029",
      "deviceModel": "Pixel 8",
      "osVersion": "Android 14",
      "appVersion": "1.0.0"
    }
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "2FA authentication successful. Logged in.",
    "data": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "user": {
        "userCode": "SSC-SCH-1023-PAR-015",
        "fullName": "Ravi Kumar",
        "email": "ravi.kumar@example.com",
        "role": "PARENT",
        "schoolCode": "SSC-SCH-1023",
        "status": "ACTIVE"
      }
    }
  }
  ```

#### `POST /auth/refresh-token`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```

#### `POST /auth/logout`
- **Access**: Authenticated

#### `GET /auth/me`
- **Access**: Authenticated

---

### 2. School Onboarding (`/onboarding`)

#### `POST /onboarding/apply`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "schoolName": "Example Public School",
    "board": "CBSE",
    "address": {
      "street": "123 Pilot Way",
      "city": "Delhi",
      "state": "Delhi",
      "postalCode": "110001",
      "country": "India"
    },
    "contactPerson": {
      "name": "Dr. Sharma",
      "phone": "+919876543210",
      "email": "sharma@example.edu"
    },
    "expectedStudents": 400,
    "proposedAdminDetails": {
      "fullName": "Rajesh Sharma",
      "email": "admin@example.edu",
      "phone": "+919876543211"
    },
    "documents": [
      {
        "title": "CBSE Affiliation Certificate",
        "fileUrl": "https://storage.schoolsafeconnect.internal/docs/cbse-cert.pdf"
      }
    ]
  }
  ```

---

### 3. Global Super Admin (`/super-admin`)
*All endpoints require Bearer Token with role `GLOBAL_SUPER_ADMIN`.*

#### `GET /super-admin/onboarding-requests`
- **Query Params**: `status`, `page`, `limit`

#### `POST /super-admin/schools/approve`
- **Request Body**:
  ```json
  {
    "requestId": "REQ-1731238912-A1B2C3",
    "reason": "Verified official CBSE accreditation documents and governing body resolution."
  }
  ```
- **Returns**: Provisioned `schoolCode` (`SSC-SCH-XXXX`), `adminUser` (`SSC-SCH-XXXX-ADM-001`), and initial temporary credentials.

#### `POST /super-admin/schools/reject`
- **Request Body**:
  ```json
  {
    "requestId": "REQ-1731238912-A1B2C3",
    "reason": "Incomplete regulatory documentation submitted after two notice periods."
  }
  ```

#### `PUT /super-admin/schools/:schoolCode/suspend`
- **Request Body**:
  ```json
  {
    "reason": "Pending safety audit compliance investigation."
  }
  ```

#### `PUT /super-admin/schools/:schoolCode/activate`
- **Request Body**:
  ```json
  {
    "reason": "Safety audit compliance requirements fully remediated."
  }
  ```

#### `POST /super-admin/schools/:schoolCode/admins/:adminUserCode/remove`
- **Request Body**:
  ```json
  {
    "confirmationText": "CONFIRM-REMOVE-ADMIN-SSC-SCH-1023-ADM-001",
    "reason": "School board replacement of administrative staff."
  }
  ```

#### `GET /super-admin/audit-logs`
- **Query Params**: `schoolCode`, `action`, `page`, `limit`
- **Returns**: Immutable audit ledger trail.
