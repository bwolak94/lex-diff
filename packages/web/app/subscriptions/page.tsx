"use client";

// S5-17/S5-18: Subscription management page

import { Suspense, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Trash2, Bell } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSubscriptions, createSubscription, deleteSubscription } from "@/lib/api";
import type { Subscription } from "@/lib/api";

function SubscriptionsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function SubscriptionRow({
  sub,
  onDelete,
}: {
  sub: Subscription;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm font-medium text-slate-800">
          {sub.actEli}
        </p>
        <p className="text-xs text-slate-500">{sub.email}</p>
        {sub.webhookUrl && (
          <p className="truncate text-xs text-slate-400">{sub.webhookUrl}</p>
        )}
      </div>
      <button
        onClick={() => onDelete(sub.id)}
        className="ml-4 rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
        aria-label="Delete subscription"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function SubscriptionsContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [actEli, setActEli] = useState(
    searchParams.get("actEli")?.replace(/:/g, "/") ?? "",
  );
  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: fetchSubscriptions,
  });

  const createMutation = useMutation({
    mutationFn: createSubscription,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      setEmail("");
      setWebhookUrl("");
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!actEli.trim() || !email.trim()) {
      setFormError("Act ELI and email are required.");
      return;
    }
    createMutation.mutate({
      actEli: actEli.trim(),
      email: email.trim(),
      webhookUrl: webhookUrl.trim() || null,
    });
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Subscribe form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell size={16} />
              Subscribe to act changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Act ELI
                </label>
                <Input
                  placeholder="DU/2024/1234"
                  value={actEli}
                  onChange={(e) => setActEli(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Email address
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Webhook URL{" "}
                  <span className="font-normal text-slate-400">(optional, HTTPS)</span>
                </label>
                <Input
                  placeholder="https://hooks.example.com/lexdiff"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>
              {formError && (
                <p className="text-xs text-red-600">{formError}</p>
              )}
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? "Subscribing…" : "Subscribe"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Existing subscriptions */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Active subscriptions
          </h2>
          {isLoading && <SubscriptionsSkeleton />}
          {!isLoading && subscriptions?.length === 0 && (
            <p className="text-sm text-slate-400">No subscriptions yet.</p>
          )}
          <div className="space-y-2">
            {subscriptions?.map((sub) => (
              <SubscriptionRow
                key={sub.id}
                sub={sub}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense>
      <SubscriptionsContent />
    </Suspense>
  );
}
