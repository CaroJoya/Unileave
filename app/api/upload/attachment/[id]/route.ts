// app/api/attachment/[id]/route.ts
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = getAuth();
    const rtdb = getRTDB();

    if (!auth || !rtdb) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Verify the user is authenticated
    await auth.verifySessionCookie(sessionCookie);

    // Get the attachment from RTDB
    const snapshot = await rtdb.ref(`attachments/${id}`).once("value");
    const attachment = snapshot.val();

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(attachment.data, 'base64');

    // Determine content type
    const contentType = attachment.mimeType || 'application/octet-stream';

    // Return the file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${attachment.fileName}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error("Error retrieving attachment:", error);
    return NextResponse.json(
      { error: "Failed to retrieve attachment" },
      { status: 500 }
    );
  }
}