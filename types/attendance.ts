export interface Department {
  id: string;
  name: string;
}

export interface StaffUser {
  uid: string;
  name: string;
  email: string;
  departmentId: string;
  departmentName: string;
  roles: string[];
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  departmentId: string;
  departmentName: string;
  date: string;
  status: "Present" | "Absent" | "Half Day";
  halfDaySession: "First Half" | "Second Half" | null;
  remarks: string | null;
  markedBy: string;
  markedByName: string;
  createdAt: string;
  updatedAt: string;
}