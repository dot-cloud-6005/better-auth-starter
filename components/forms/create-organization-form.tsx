"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50),
});

export function CreateOrganizationForm({
  onSuccess,
}: {
  onSuccess?: (org: { id: string; slug: string }) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      const { data, error } = await authClient.organization.create({
        name: values.name,
        slug: values.slug,
      });

      if (error) {
        throw new Error(error.message ?? "Failed to create organisation");
      }

      // Safely extract id and slug from either data.organization or data itself
      let orgId = "";
      let slug = values.slug;
      if (data && typeof data === "object") {
        const maybeOrg = "organization" in data && data.organization && typeof (data as Record<string, unknown>).organization === "object"
          ? (data as { organization: { id?: string; slug?: string } }).organization
          : (data as { id?: string; slug?: string });
        if (maybeOrg?.id) orgId = maybeOrg.id;
        if (maybeOrg?.slug) slug = maybeOrg.slug;
      }

      toast.success("Organisation created successfully");
      onSuccess?.({ id: orgId, slug });
    } catch (error) {
      console.error(error);
      toast.error("Failed to create organisation");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="My Organisation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input placeholder="my-org" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button disabled={isLoading} type="submit">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Create Organisation"
          )}
        </Button>
      </form>
    </Form>
  );
}
