"use client";

import { FormEvent, useState } from "react";
import { MessageSquarePlus, TriangleAlert } from "lucide-react";
import { CustomSelect } from "@/components/custom-select";

type FeedbackKind = "review" | "complaint";

export function FeedbackPanel({ exchangeSlug }: { exchangeSlug: string }) {
  const [kind, setKind] = useState<FeedbackKind>("review");
  const [reference, setReference] = useState("");
  const [rating, setRating] = useState("5");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");

    try {
      const response = await fetch(`/api/exchangers/${encodeURIComponent(exchangeSlug)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, reference, rating: Number(rating), body })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Не удалось отправить форму.");

      setNotice(payload.message ?? "Отправлено на модерацию.");
      setReference("");
      setRating("5");
      setBody("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось отправить форму.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel feedbackPanel">
      <div className="feedbackTabs">
        <button
          className={kind === "review" ? "active" : ""}
          onClick={() => setKind("review")}
          type="button"
        >
          <MessageSquarePlus size={17} /> Оставить отзыв
        </button>
        <button
          className={kind === "complaint" ? "active" : ""}
          onClick={() => setKind("complaint")}
          type="button"
        >
          <TriangleAlert size={17} /> Подать жалобу
        </button>
      </div>
      <form onSubmit={submit}>
        {notice && <p className="feedbackPanelNotice">{notice}</p>}
        <label>
          Номер операции
          <input
            minLength={3}
            name="reference"
            onChange={(event) => setReference(event.target.value)}
            required
            value={reference}
          />
        </label>
        <label>
          Оценка
          <CustomSelect
            onChange={setRating}
            value={rating}
            variant="compact"
            options={[
              { value: "5", label: "5 - отлично" },
              { value: "4", label: "4 - хорошо" },
              { value: "3", label: "3 - нормально" },
              { value: "2", label: "2 - плохо" },
              { value: "1", label: "1 - очень плохо" }
            ]}
          />
        </label>
        <label className="feedbackText">
          Описание
          <textarea
            minLength={20}
            name="body"
            onChange={(event) => setBody(event.target.value)}
            required
            rows={5}
            value={body}
          />
        </label>
        <button disabled={loading} type="submit">
          {loading ? "Отправка..." : kind === "complaint" ? "Отправить жалобу" : "Отправить отзыв"}
        </button>
      </form>
    </section>
  );
}
