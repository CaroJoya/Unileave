// app/api/headclerk/faculty/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  phoneNumber?: string;
  roles: string[];
  departmentId: string;
  departmentName: string;
  status: string;
  isEmployed: boolean;
  dateOfJoining?: string;
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = getAuth();
    const rtdb = getRTDB();

    if (!auth || !rtdb) {
      console.error('Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as UserRecord | null;
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const departmentId = searchParams.get("departmentId") || "";
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";

    const usersSnapshot = await rtdb.ref("users").once("value");
    const users = usersSnapshot.val() as Record<string, UserRecord> | null || {};

    let facultyList = Object.entries(users)
      .filter(([, user]: [string, UserRecord]) => {
        const roles = user.roles || [];
        return roles.includes("faculty") || 
               roles.includes("lab_assistant") || 
               roles.includes("office_staff") ||
               roles.includes("hod");
      })
      .map(([uid, user]: [string, UserRecord]) => ({
        uid,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber || "",
        roles: user.roles || [],
        departmentId: user.departmentId,
        departmentName: user.departmentName,
        status: user.status || "active",
        isEmployed: user.isEmployed !== false,
        dateOfJoining: user.dateOfJoining || null,
      }));

    if (search) {
      facultyList = facultyList.filter(member => 
        member.name.toLowerCase().includes(search.toLowerCase()) ||
        member.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (departmentId) {
      facultyList = facultyList.filter(member => member.departmentId === departmentId);
    }

    if (role) {
      facultyList = facultyList.filter(member => member.roles.includes(role));
    }

    if (status) {
      facultyList = facultyList.filter(member => member.status === status);
    }

    facultyList.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ faculty: facultyList });
  } catch (error) {
    console.error("Error fetching faculty list:", error);
    return NextResponse.json({ error: "Failed to fetch faculty list" }, { status: 500 });
  }
}