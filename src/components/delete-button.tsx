"use client";

import { useTransition } from "react";

type DeleteButtonProps = {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
  className?: string;
};

export function DeleteButton({ action, id, label, className = "" }: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      className={`delete-btn ${className}`}
      onClick={() => {
        if (confirm(`Вы уверены, что хотите удалить "${label}"?`)) {
          const formData = new FormData();
          formData.append("id", id);
          startTransition(async () => {
            await action(formData);
          });
        }
      }}
      style={{
        backgroundColor: "#d32f2f",
        color: "#fff",
        cursor: "pointer",
        opacity: isPending ? 0.7 : 1,
      }}
    >
      {isPending ? "Удаление..." : "Удалить"}
    </button>
  );
}
