"use client";

import {signOut} from "next-auth/react";

type Props = {
  locale: string;
};

export function BackToStartButton({locale}: Props) {
  return (
    <button
      type="button"
      onClick={() => signOut({callbackUrl: `/${locale}`})}
      className="mt-5 inline-flex rounded-lg bg-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-100"
    >
      Volver al inicio
    </button>
  );
}
