import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accessCookieName, roleFromToken } from "@/lib/access";
import { allowedPhotoTypes, maxPhotoBytes } from "@/lib/gallery";

export const dynamic = "force-dynamic";

/**
 * Hands the browser a short-lived token so the photo travels straight from the
 * phone to blob storage, never through this function. Any member of the
 * clubhouse may upload; the passcode is the gate.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json() as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
        if (!role) throw new Error("Not authenticated");
        return {
          allowedContentTypes: allowedPhotoTypes,
          maximumSizeInBytes: maxPhotoBytes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ role }),
        };
      },
      onUploadCompleted: async () => {
        // The browser records the photo against the gallery once `upload()`
        // resolves, which also works locally where this callback cannot reach.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
