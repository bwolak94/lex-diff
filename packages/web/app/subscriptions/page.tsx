"use client";

// S5-17/S5-18: Subscription management page
// B-1: keyword + publisher subscription types

import { Suspense, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Trash2, Bell, Hash, BookOpen } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSubscriptions, createSubscription, deleteSubscription } from "@/lib/api";
import type { Subscription } from "@/lib/api";

type SubscriptionType = "act" | "keyword" | "publisher";

const TYPE_LABELS: Record<SubscriptionType, string> = {
  act: "Specific act",
  keyword: "Keyword",
  publisher: "Publisher",
};

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
  const label =
    sub.subscriptionType === "keyword"
      ? sub.keyword ?? sub.actEli
      : sub.subscriptionType === "publisher"
        ? sub.publisherFilter ?? sub.actEli
        : sub.actEli;

  const typeLabel = TYPE_LABELS[sub.subscriptionType ?? "act"];

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
            {typeLabel}
          </span>
          <p className="truncate font-mono text-sm font-medium text-slate-800">
            {label}
          </p>
        </div>
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

  const initialKeyword = searchParams.get("keyword") ?? "";
  const initialPublisher = searchParams.get("publisher") ?? "";
  const initialActEli = searchParams.get("actEli")?.replace(/:/g, "/") ?? "";

  const defaultType: SubscriptionType = initialKeyword
    ? "keyword"
    : initialPublisher
      ? "publisher"
      : "act";

  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>(defaultType);
  const [actEli, setActEli] = useState(initialActEli);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [publisherFilter, setPublisherFilter] = useState(initialPublisher);
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
    if (!email.trim()) {
      setFormError("Email is required.");
      return;
    }
    if (subscriptionType === "act" && !actEli.trim()) {
      setFormError("Act ELI is required for act subscriptions.");
      return;
    }
    if (subscriptionType === "keyword" && !keyword.trim()) {
      setFormError("Keyword is required for keyword subscriptions.");
      return;
    }
    if (subscriptionType === "publisher" && !publisherFilter.trim()) {
      setFormError("Publisher is required for publisher subscriptions.");
      return;
    }
    createMutation.mutate({
      subscriptionType,
      actEli: subscriptionType === "act" ? actEli.trim() : undefined,
      keyword: subscriptionType === "keyword" ? keyword.trim() : null,
      publisherFilter: subscriptionType === "publisher" ? publisherFilter.trim() : null,
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
              Subscribe to changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Subscription type selector */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Subscription type
                </label>
                <div className="flex gap-2">
                  {(["act", "keyword", "publisher"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSubscriptionType(t)}
                      className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        subscriptionType === t
                          ? "border-slate-800 bg-slate-800 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {t === "act" && <Bell size={12} />}
                      {t === "keyword" && <Hash size={12} />}
                      {t === "publisher" && <BookOpen size={12} />}
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type-specific identifier field */}
              {subscriptionType === "act" && (
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
              )}
              {subscriptionType === "keyword" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Keyword
                  </label>
                  <Input
                    placeholder="prawo cywilne"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                </div>
              )}
              {subscriptionType === "publisher" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Publisher
                  </label>
                  <Input
                    placeholder="DU or MP"
                    value={publisherFilter}
                    onChange={(e) => setPublisherFilter(e.target.value)}
                  />
                </div>
              )}

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
