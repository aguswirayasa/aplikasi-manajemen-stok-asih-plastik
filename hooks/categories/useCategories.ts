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
    const response = await fetch(`/api/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = (await response.json()) as ApiResponse<Category>;

    if (!response.ok || !json.data) {
      toast.error(json.error || "Gagal memperbarui kategori.");
      return;
    }

    toast.success(json.message || `Kategori diperbarui menjadi "${name}".`);
    setCategories((current) =>
      sortCategories(
        current.map((category) => (category.id === id ? json.data! : category)),
      ),
    );
  };

  const handleCategoryDelete = async (id: string) => {
    const response = await fetch(`/api/categories/${id}`, {
      method: "DELETE",
    });
    const json = (await response.json()) as ApiResponse<null>;

    if (!response.ok) {
      toast.error(json.error || "Gagal menghapus kategori.");
      return;
    }

    toast.success(json.message || "Kategori berhasil dihapus.");
    setCategories((current) =>
      current.filter((category) => category.id !== id),
    );
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
