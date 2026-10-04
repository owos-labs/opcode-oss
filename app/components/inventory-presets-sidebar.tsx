"use client";

import { Button } from "@heroui/react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useState } from "react";

import type { ItemPreset } from "@/lib/character-sheets/item-presets.types";
import { Card } from "@/app/components/card";
import { ItemPresetsPanel } from "@/app/components/item-presets-panel";
import { useT } from "@/lib/character-sheets/i18n";

export function InventoryPresetsSidebar({ onAdd }: { onAdd: (preset: ItemPreset) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <Card as="aside" tone="secondary" radius="md" padding="sm" className="w-11 shrink-0 items-center !gap-0 !p-1">
        <Button variant="ghost" aria-label={t("inventory.presets.open")} className="size-9 min-w-9 p-0" onPress={() => setOpen(true)}>
          <PanelRightOpen className="size-4" />
        </Button>
      </Card>
    );
  }

  return (
    <Card as="aside" tone="secondary" radius="md" padding="none" className="min-h-0 w-full shrink-0 lg:w-72">
      <ItemPresetsPanel
        onAdd={onAdd}
        className="flex min-h-0 flex-1 flex-col"
        headerAction={(
          <Button variant="ghost" aria-label={t("inventory.presets.close")} className="size-9 min-w-9 p-0" onPress={() => setOpen(false)}>
            <PanelRightClose className="size-4" />
          </Button>
        )}
      />
    </Card>
  );
}
