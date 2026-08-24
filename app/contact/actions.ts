"use server";

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/**
 * Stub action: validates and echoes success but does not yet send anywhere.
 * Wire this to a real inbox/CRM (Resend, HubSpot, a Sheets webhook, etc.)
 * before this form goes live.
 */
export async function submitContactForm(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const details = String(formData.get("details") || "").trim();

  if (!name || !email || !details) {
    return { status: "error", message: "Please fill in your name, email, and project details." };
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return { status: "error", message: "That email address looks incomplete." };
  }

  // TODO: send `formData` to a real inbox / CRM before launch.
  await new Promise((r) => setTimeout(r, 500));

  return { status: "success", message: "Message sent. We reply within one business day." };
}
