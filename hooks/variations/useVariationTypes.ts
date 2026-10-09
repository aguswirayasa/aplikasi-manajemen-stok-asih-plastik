"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  VariationType,
  VariationValue,
} from "@/types/variations";

export function useVariationTypes() {
  const [types, setTypes] = useState<VariationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/variations/types");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat data");
      }

      setTypes(json.data);
      setError(null);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadTypes() {
      await fetchTypes();
    }

    void loadTypes();
  }, [fetchTypes]);

  const addTypeToState = (type: VariationType) => {
    setTypes((prev) => [...prev, type]);
  };

  const handleTypeRename = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/variations/types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Gagal memperbarui tipe variasi.");

      toast.success(json.message);
      setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    } catch (error: unknown) {
      const message = error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Gagal memperbarui tipe variasi. Periksa koneksi lalu coba lagi.";
      toast.error(message);
      throw new Error(message);
    }
  };

  const handleTypeDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/variations/types/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Gagal menghapus tipe variasi.");

      toast.success(json.message);
      setTypes((prev) => prev.filter((t) => t.id !== id));
    } catch (error: unknown) {
      const message = error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Gagal menghapus tipe variasi. Periksa koneksi lalu coba lagi.";
      toast.error(message);
      throw new Error(message);
    }
  };

  const handleValueAdd = (typeId: string, val: VariationValue) => {
    setTypes((prev) =>
      prev.map((t) =>
        t.id === typeId ? { ...t, values: [...t.values, val] } : t
      )
    );
  };

  const handleValueRename = async (
    typeId: string,
    valId: string,
    newName: string
  ) => {
    try {
      const res = await fetch(`/api/variations/values/${valId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newName }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Gagal memperbarui nilai variasi.");

      toast.success(json.message);
      setTypes((prev) =>
        prev.map((t) =>
          t.id === typeId
            ? {
                ...t,
                values: t.values.map((v) =>
                  v.id === valId ? { ...v, value: newName } : v
                ),
              }
            : t
        )
      );
    } catch (error: unknown) {
      const message = error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Gagal memperbarui nilai variasi. Periksa koneksi lalu coba lagi.";
      toast.error(message);
      throw new Error(message);
    }
  };

  const handleValueDelete = async (typeId: string, valId: string) => {
    try {
      const res = await fetch(`/api/variations/values/${valId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Gagal menghapus nilai variasi.");

      toast.success(json.message);
      setTypes((prev) =>
        prev.map((t) =>
          t.id === typeId
            ? { ...t, values: t.values.filter((v) => v.id !== valId) }
            : t
        )
      );
    } catch (error: unknown) {
      const message = error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Gagal menghapus nilai variasi. Periksa koneksi lalu coba lagi.";
      toast.error(message);
      throw new Error(message);
    }
  };

  return {
    types,
    loading,
    error,
    fetchTypes,
    addTypeToState,
    handleTypeRename,
    handleTypeDelete,
    handleValueAdd,
    handleValueRename,
    handleValueDelete,
  };
}
