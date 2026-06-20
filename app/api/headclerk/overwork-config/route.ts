// app/api/headclerk/overwork-config/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);

    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val();

    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    // Get overwork config
    const configSnapshot = await rtdb.ref("overworkConfig/overwork_config").once("value");
    let config = configSnapshot.val();

    // Return default if not configured
    if (!config) {
      config = {
        id: "overwork_config",
        conversionHours: 5,
        minHoursPerEntry: 0.5,
        maxHoursPerDay: 24,
        autoConversionEnabled: true,
        updatedAt: null,
        updatedBy: null,
      };
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Error fetching overwork config:", error);
    return NextResponse.json({ error: "Failed to fetch overwork config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);

    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val();

    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    const body = await request.json();
    const { conversionHours, minHoursPerEntry, maxHoursPerDay, autoConversionEnabled } = body;

    // Validation
    if (conversionHours !== undefined && (conversionHours < 1 || conversionHours > 24)) {
      return NextResponse.json({ error: "Conversion hours must be between 1 and 24" }, { status: 400 });
    }

    if (minHoursPerEntry !== undefined && (minHoursPerEntry < 0.5 || minHoursPerEntry > 24)) {
      return NextResponse.json({ error: "Minimum hours per entry must be between 0.5 and 24" }, { status: 400 });
    }

    if (maxHoursPerDay !== undefined && (maxHoursPerDay < 0.5 || maxHoursPerDay > 24)) {
      return NextResponse.json({ error: "Maximum hours per day must be between 0.5 and 24" }, { status: 400 });
    }

    // Get current config or create default
    const configRef = rtdb.ref("overworkConfig/overwork_config");
    const snapshot = await configRef.once("value");
    const existingConfig = snapshot.val();

    const updatedConfig = {
      id: "overwork_config",
      conversionHours: conversionHours !== undefined ? conversionHours : (existingConfig?.conversionHours || 5),
      minHoursPerEntry: minHoursPerEntry !== undefined ? minHoursPerEntry : (existingConfig?.minHoursPerEntry || 0.5),
      maxHoursPerDay: maxHoursPerDay !== undefined ? maxHoursPerDay : (existingConfig?.maxHoursPerDay || 24),
      autoConversionEnabled: autoConversionEnabled !== undefined ? autoConversionEnabled : (existingConfig?.autoConversionEnabled !== false),
      updatedBy: decodedToken.uid,
      updatedAt: new Date().toISOString(),
    };

    await configRef.set(updatedConfig);

    // Create audit log
    const auditLog = {
      userId: decodedToken.uid,
      userName: userData.name,
      userRole: "head_clerk",
      action: "OVERWORK_CONFIG_UPDATED",
      module: "overworkConfig",
      oldData: existingConfig ? {
        conversionHours: existingConfig.conversionHours,
        minHoursPerEntry: existingConfig.minHoursPerEntry,
        maxHoursPerDay: existingConfig.maxHoursPerDay,
        autoConversionEnabled: existingConfig.autoConversionEnabled,
      } : null,
      newData: {
        conversionHours: updatedConfig.conversionHours,
        minHoursPerEntry: updatedConfig.minHoursPerEntry,
        maxHoursPerDay: updatedConfig.maxHoursPerDay,
        autoConversionEnabled: updatedConfig.autoConversionEnabled,
      },
      createdAt: new Date().toISOString(),
    };

    await rtdb.ref("auditLogs").push(auditLog);

    return NextResponse.json({ success: true, config: updatedConfig });
  } catch (error) {
    console.error("Error updating overwork config:", error);
    return NextResponse.json({ error: "Failed to update overwork config" }, { status: 500 });
  }
}