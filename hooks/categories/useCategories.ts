"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ApiResponse } from "@/lib/api-helpers";
import type { Category } from "@/types/categories";

function sortCategories(categories: Category[]) {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/categories");
      const json = (await response.json()) as ApiResponse<Category[]>;

      if (!response.ok || !json.data) {
        throw new Error(json.error || "Gagal memuat kategori.");
      }

      setCategories(json.data);
      setError(null);
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Gagal memuat kategori.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadCategories() {
      await fetchCategories();
    }

    void loadCategories();
  }, [fetchCategories]);

  const addCategoryToState = (category: Category) => {
    setCategories((current) => sortCategories([...current, category]));
  };

  const handleCategoryRename = async (id: string, name: string) => {
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = (await response.json()) as ApiResponse<Category>;

      if (!response.ok || !json.data) {
        throw new Error(json.error || "Gagal memperbarui kategori.");
      }

      toast.success(json.message || `Kategori diperbarui menjadi "${name}".`);
      setCategories((current) =>
        sortCategories(
          current.map((category) => (category.id === id ? json.data! : category)),
        ),
      );
    } catch (error: unknown) {
      const message = error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Gagal memperbarui kategori. Periksa koneksi lalu coba lagi.";
      toast.error(message);
      throw new Error(message);
    }
  };

  const handleCategoryDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as ApiResponse<null>;

      if (!response.ok) {
        throw new Error(json.error || "Gagal menghapus kategori.");
      }

      toast.success(json.message || "Kategori berhasil dihapus.");
      setCategories((current) =>
        current.filter((category) => category.id !== id),
      );
    } catch (error: unknown) {
      const message = error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Gagal menghapus kategori. Periksa koneksi lalu coba lagi.";
      toast.error(message);
      throw new Error(message);
    }
  };

  return {
    categories,
    loading,
    error,
    fetchCategories,
    addCategoryToState,
    handleCategoryRename,
    handleCategoryDelete,
  };
}
