"use client";

import { useActionState } from "react";
import { submitContactForm, ContactState } from "@/app/contact/actions";
import { services } from "@/lib/nav-data";

const initialState: ContactState = { status: "idle" };

const budgetRanges = ["Under ₹1L / month", "₹1L – 3L / month", "₹3L – 10L / month", "₹10L+ / month"];

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactForm, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <div className="grid sm:grid-cols-2 gap-8">
        <Field label="Name" name="name" required />
        <Field label="Company" name="company" />
        <Field label="Email" name="email" type="email" required />
        <Field label="Phone" name="phone" type="tel" />
        <Field label="Website" name="website" type="url" className="sm:col-span-2" />
      </div>

      <fieldset>
        <legend className="font-mono-label text-ink-faint mb-4">Services Required</legend>
        <div className="flex flex-wrap gap-3">
          {services.map((s) => (
            <label
              key={s.slug}
              className="font-mono-label text-ink-dim px-4 py-2.5 border border-line has-checked:border-gold has-checked:text-gold transition-colors duration-200 cursor-pointer"
            >
              <input type="checkbox" name="services" value={s.name} className="sr-only" />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="budget" className="font-mono-label text-ink-faint block mb-3">
          Budget Range
        </label>
        <select
          id="budget"
          name="budget"
          defaultValue=""
          className="w-full bg-transparent border border-line px-4 py-3.5 text-[15px] focus-visible:border-gold focus-visible:outline-none"
        >
          <option value="" disabled>
            Select a range
          </option>
          {budgetRanges.map((b) => (
            <option key={b} value={b} className="bg-void">
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="details" className="font-mono-label text-ink-faint">
          Project Details
        </label>
        <textarea
          id="details"
          name="details"
          rows={5}
          required
          className="bg-transparent border border-line px-4 py-3.5 text-[15px] resize-y focus-visible:border-gold focus-visible:outline-none"
        />
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <button
          type="submit"
          disabled={pending}
          className="font-mono-label px-7 py-4 border border-gold bg-gold text-on-gold hover:bg-transparent hover:text-gold transition-colors duration-200 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Start the Conversation"}
        </button>
        {state.status !== "idle" && (
          <span
            role="status"
            aria-live="polite"
            className={`font-mono-label ${state.status === "success" ? "text-gold" : "text-[#e8794a]"}`}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <label htmlFor={name} className="font-mono-label text-ink-faint">
        {label}
        {required && <span className="text-gold"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="bg-transparent border border-line px-4 py-3.5 text-[15px] focus-visible:border-gold focus-visible:outline-none"
      />
    </div>
  );
}
