"use client";

import { useState } from "react";
import { Mail, MessageCircle, Send } from "lucide-react";

export function ContactForm() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [successAlert, setSuccessAlert] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !subject || !message) {
      setErrorAlert("Пожалуйста, заполните все поля формы.");
      return;
    }

    setLoading(true);
    setErrorAlert(null);
    setSuccessAlert(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, subject, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Произошла ошибка при отправке.");
      }

      setSuccessAlert("Ваше обращение успешно отправлено.");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error) {
      setErrorAlert(error instanceof Error ? error.message : "Не удалось отправить сообщение.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="contactFormNew" onSubmit={handleSubmit}>
      {errorAlert && (
        <div className="errorAlert" style={{ padding: "10px 14px", borderRadius: "6px", fontSize: "12px" }}>
          {errorAlert}
        </div>
      )}
      {successAlert && (
        <div className="successAlert" style={{ padding: "10px 14px", borderRadius: "6px", fontSize: "12px" }}>
          {successAlert}
        </div>
      )}

      <div className="formField">
        <label className="fieldLabel" htmlFor="email">Email</label>
        <div className="inputWrapper">
          <Mail size={16} className="inputIcon" />
          <input
            id="email"
            type="email"
            className="textInput"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
            required
          />
        </div>
      </div>

      <div className="formField">
        <label className="fieldLabel" htmlFor="subject">Тема</label>
        <div className="inputWrapper">
          <Send size={16} className="inputIcon" />
          <input
            id="subject"
            type="text"
            className="textInput"
            placeholder="Профиль обменника / отзыв / интеграция"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={loading}
            required
          />
        </div>
      </div>

      <div className="formField">
        <label className="fieldLabel" htmlFor="message">Сообщение</label>
        <div className="inputWrapper textareaWrapper">
          <MessageCircle size={16} className="inputIcon" />
          <textarea
            id="message"
            className="textareaInput"
            placeholder="Опишите ситуацию"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={loading}
            required
          />
        </div>
      </div>

      <button className="submitButton" type="submit" disabled={loading}>
        {loading ? "Отправка..." : "Отправить"}
      </button>
    </form>
  );
}
