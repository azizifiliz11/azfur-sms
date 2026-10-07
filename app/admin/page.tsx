"use client";

import React from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { AdminView } from "@/components/AdminView";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AdminPage() {
  return (
    <ClientOnly>
      <div className="min-h-screen bg-[#090a0f] text-zinc-100 p-4">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center justify-between pb-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Mini App Görünümüne Dön</span>
            </Link>
          </div>

          <AdminView />
        </div>
      </div>
    </ClientOnly>
  );
}
